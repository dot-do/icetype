/**
 * ice pull command
 *
 * Introspects existing databases (PostgreSQL, MySQL, SQLite) and generates
 * IceType schema files from database tables.
 *
 * Usage:
 *   ice pull <connection-url> [options]
 *
 * Examples:
 *   ice pull postgres://localhost:5432/mydb --output ./schema.ts
 *   ice pull mysql://localhost:3306/mydb -o ./schema.ts
 *   ice pull ./database.sqlite --format json
 *   ice pull postgres://localhost:5432/mydb --diff ./schema.ts
 */

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Client as PgClient } from 'pg';
import * as mysql from 'mysql2/promise';
import * as BetterSqlite3 from 'better-sqlite3';
import type { IceTypeSchema, FieldDefinition, SchemaDirectives, FieldModifier } from '@icetype/core';
import { diffSchemas, type SchemaDiff } from '@icetype/core';

// ESM interop for better-sqlite3
const Database = BetterSqlite3.default || BetterSqlite3;

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a database column from introspection
 */
export interface IntrospectedColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
}

/**
 * Represents a database index from introspection
 */
export interface IntrospectedIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

/**
 * Represents a foreign key from introspection
 */
export interface IntrospectedForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

/**
 * Represents a database table structure from introspection
 */
export interface IntrospectedTable {
  name: string;
  schema?: string;
  columns: IntrospectedColumn[];
  primaryKey?: string[];
  indexes: IntrospectedIndex[];
  foreignKeys: IntrospectedForeignKey[];
}

/**
 * Parsed command-line arguments for the pull command
 */
export interface PullOptions {
  url: string;
  output?: string;
  schemaName?: string;
  tables?: string[];
  exclude?: string[];
  format: 'typescript' | 'json';
  verbose: boolean;
  quiet: boolean;
  /** Path to an existing schema file to diff against */
  diff?: string;
}

/**
 * Result of diffing introspected schema against target schema
 */
export interface IntrospectionDiffResult {
  /** Name of the schema/table being compared */
  tableName: string;
  /** The diff result from comparing the schemas */
  diff: SchemaDiff;
  /** The introspected schema (converted to IceTypeSchema) */
  introspectedSchema: IceTypeSchema;
  /** The target schema (from the schema file), if it exists */
  targetSchema?: IceTypeSchema;
  /** Whether this table only exists in the database */
  onlyInDatabase: boolean;
  /** Whether this table only exists in the schema file */
  onlyInSchemaFile: boolean;
}

/**
 * Internal schema representation for generation
 */
export interface GeneratedField {
  type: string;
  isOptional: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  isPrimaryKey: boolean;
  modifier: string;
}

/**
 * Internal schema for IceType generation
 */
export interface GeneratedSchema {
  name: string;
  fields: Map<string, GeneratedField>;
  relations: Map<string, { targetTable: string; targetField: string }>;
  directives: {
    $partitionBy?: string[];
    $index?: string[][];
  };
}

export type DatabaseDialect = 'postgres' | 'mysql' | 'sqlite';

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * Parse command-line arguments for the pull command
 */
function parseArgs(args: string[]): PullOptions {
  const options: PullOptions = {
    url: '',
    format: 'typescript',
    verbose: false,
    quiet: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--schema-name') {
      options.schemaName = args[++i];
    } else if (arg === '--tables') {
      const tablesArg = args[++i];
      options.tables = tablesArg ? tablesArg.split(',').map(t => t.trim()) : [];
    } else if (arg === '--exclude') {
      const excludeArg = args[++i];
      options.exclude = excludeArg ? excludeArg.split(',').map(t => t.trim()) : [];
    } else if (arg === '--format') {
      const format = args[++i];
      if (format === 'json' || format === 'typescript') {
        options.format = format;
      }
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--diff') {
      const diffArg = args[++i];
      if (diffArg) {
        options.diff = diffArg;
      }
    } else if (arg && !arg.startsWith('-') && !options.url) {
      options.url = arg;
    }

    i++;
  }

  return options;
}

// =============================================================================
// Dialect Detection
// =============================================================================

/**
 * Detect database dialect from connection URL
 */
function detectDialect(url: string): DatabaseDialect {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgres';
  }
  if (url.startsWith('mysql://')) {
    return 'mysql';
  }
  if (url.startsWith('sqlite://') || url.endsWith('.db') || url.endsWith('.sqlite') || url.endsWith('.sqlite3')) {
    return 'sqlite';
  }

  throw new Error(`Unsupported database dialect: could not determine database type from URL '${url}'`);
}

// =============================================================================
// Type Mappings
// =============================================================================

/**
 * Map PostgreSQL types to IceType types
 */
function mapPostgresType(pgType: string, _hasDefault?: boolean): string {
  // Handle arrays
  if (pgType.endsWith('[]')) {
    const baseType = pgType.slice(0, -2);
    return mapPostgresType(baseType) + '[]';
  }

  // Normalize the type name
  const normalizedType = pgType.toLowerCase().replace(/\(\d+\)/g, '').trim();

  const typeMap: Record<string, string> = {
    'uuid': 'uuid',
    'varchar': 'string',
    'character varying': 'string',
    'char': 'string',
    'character': 'string',
    'text': 'text',
    'integer': 'int',
    'int': 'int',
    'int4': 'int',
    'smallint': 'int',
    'int2': 'int',
    'bigint': 'bigint',
    'int8': 'bigint',
    'boolean': 'bool',
    'bool': 'bool',
    'timestamp': 'timestamp',
    'timestamp with time zone': 'timestamp',
    'timestamp without time zone': 'timestamp',
    'timestamptz': 'timestamp',
    'date': 'date',
    'time': 'time',
    'time with time zone': 'time',
    'time without time zone': 'time',
    'jsonb': 'json',
    'json': 'json',
    'double precision': 'double',
    'float8': 'double',
    'real': 'float',
    'float4': 'float',
    'numeric': 'decimal',
    'decimal': 'decimal',
    'bytea': 'binary',
    'serial': 'int',
    'bigserial': 'bigint',
    'smallserial': 'int',
  };

  return typeMap[normalizedType] || 'string';
}

/**
 * Map MySQL types to IceType types
 */
function mapMysqlType(mysqlType: string): string {
  // Normalize the type name
  const normalizedType = mysqlType.toLowerCase().replace(/\(\d+(?:,\s*\d+)?\)/g, '').trim();

  // Special case for tinyint(1) which is boolean
  if (mysqlType.toLowerCase() === 'tinyint(1)') {
    return 'bool';
  }

  const typeMap: Record<string, string> = {
    'varchar': 'string',
    'char': 'string',
    'tinytext': 'string',
    'text': 'text',
    'mediumtext': 'text',
    'longtext': 'text',
    'int': 'int',
    'integer': 'int',
    'tinyint': 'int',
    'smallint': 'int',
    'mediumint': 'int',
    'bigint': 'bigint',
    'boolean': 'bool',
    'bool': 'bool',
    'datetime': 'timestamp',
    'timestamp': 'timestamp',
    'date': 'date',
    'time': 'time',
    'json': 'json',
    'double': 'double',
    'float': 'float',
    'decimal': 'decimal',
    'numeric': 'decimal',
    'blob': 'binary',
    'tinyblob': 'binary',
    'mediumblob': 'binary',
    'longblob': 'binary',
    'binary': 'binary',
    'varbinary': 'binary',
  };

  return typeMap[normalizedType] || 'string';
}

/**
 * Map SQLite types to IceType types
 */
function mapSqliteType(sqliteType: string): string {
  // Normalize the type name
  const normalizedType = sqliteType.toUpperCase().replace(/\(\d+(?:,\s*\d+)?\)/g, '').trim();

  const typeMap: Record<string, string> = {
    'TEXT': 'string',
    'VARCHAR': 'string',
    'CHAR': 'string',
    'CHARACTER': 'string',
    'VARYING CHARACTER': 'string',
    'NCHAR': 'string',
    'NATIVE CHARACTER': 'string',
    'NVARCHAR': 'string',
    'CLOB': 'string',
    'INTEGER': 'int',
    'INT': 'int',
    'TINYINT': 'int',
    'SMALLINT': 'int',
    'MEDIUMINT': 'int',
    'BIGINT': 'bigint',
    'UNSIGNED BIG INT': 'bigint',
    'INT2': 'int',
    'INT8': 'bigint',
    'REAL': 'double',
    'DOUBLE': 'double',
    'DOUBLE PRECISION': 'double',
    'FLOAT': 'float',
    'NUMERIC': 'decimal',
    'DECIMAL': 'decimal',
    'BOOLEAN': 'bool',
    'BLOB': 'binary',
    'NULL': 'string',
    'DATE': 'date',
    'DATETIME': 'timestamp',
  };

  return typeMap[normalizedType] || 'string';
}

// =============================================================================
// Database Introspection
// =============================================================================

/**
 * Extract schema from a database connection
 */
async function extractSchema(url: string, dialect: DatabaseDialect): Promise<IntrospectedTable[]> {
  // For SQLite, check if the file exists
  if (dialect === 'sqlite') {
    // Extract file path from URL or use directly
    const filePath = url.startsWith('sqlite://') ? url.replace('sqlite://', '') : url;
    if (!existsSync(filePath)) {
      throw new Error(`Database file not found: ${filePath}`);
    }
    return introspectSqlite(filePath);
  }

  if (dialect === 'postgres') {
    return introspectPostgres(url, {});
  }

  if (dialect === 'mysql') {
    return introspectMysql(url, {});
  }

  return [];
}

/**
 * Introspect PostgreSQL database
 */
async function introspectPostgres(
  url: string,
  options: { schemaName?: string }
): Promise<IntrospectedTable[]> {
  const client = new PgClient({ connectionString: url });
  try {
    await client.connect();
    const schemaName = options.schemaName || 'public';

    // Get all tables in the schema
    const tablesResult = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [schemaName]
    );

    const tables: IntrospectedTable[] = [];

    for (const row of tablesResult.rows) {
      const table = await introspectPostgresTableWithClient(client, row.table_name, schemaName);
      tables.push(table);
    }

    return tables;
  } finally {
    await client.end();
  }
}

/**
 * Internal helper to introspect a PostgreSQL table using an existing client connection
 */
async function introspectPostgresTableWithClient(
  client: InstanceType<typeof PgClient>,
  tableName: string,
  schemaName: string
): Promise<IntrospectedTable> {
  // Get columns
  const columnsResult = await client.query<{
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT
       column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schemaName, tableName]
  );

  // Get primary key columns
  const pkResult = await client.query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = $1
       AND tc.table_name = $2
       AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.ordinal_position`,
    [schemaName, tableName]
  );
  const primaryKeyColumns = new Set(pkResult.rows.map((r: { column_name: string }) => r.column_name));

  // Get unique columns
  const uniqueResult = await client.query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = $1
       AND tc.table_name = $2
       AND tc.constraint_type = 'UNIQUE'`,
    [schemaName, tableName]
  );
  const uniqueColumns = new Set(uniqueResult.rows.map((r: { column_name: string }) => r.column_name));

  // Get indexes
  const indexesResult = await client.query<{
    index_name: string;
    column_name: string;
    is_unique: boolean;
  }>(
    `SELECT
       i.relname AS index_name,
       a.attname AS column_name,
       ix.indisunique AS is_unique
     FROM pg_class t
     JOIN pg_index ix ON t.oid = ix.indrelid
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = $1 AND t.relname = $2 AND NOT ix.indisprimary
     ORDER BY i.relname, a.attnum`,
    [schemaName, tableName]
  );

  // Group index columns by index name
  const indexMap = new Map<string, { columns: string[]; unique: boolean }>();
  for (const row of indexesResult.rows) {
    if (!indexMap.has(row.index_name)) {
      indexMap.set(row.index_name, { columns: [], unique: row.is_unique });
    }
    indexMap.get(row.index_name)!.columns.push(row.column_name);
  }

  // Get foreign keys
  const fkResult = await client.query<{
    constraint_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
  }>(
    `SELECT
       tc.constraint_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
     WHERE tc.table_schema = $1
       AND tc.table_name = $2
       AND tc.constraint_type = 'FOREIGN KEY'`,
    [schemaName, tableName]
  );

  // Group foreign key columns
  const fkMap = new Map<string, { columns: string[]; refTable: string; refColumns: string[] }>();
  for (const row of fkResult.rows) {
    if (!fkMap.has(row.constraint_name)) {
      fkMap.set(row.constraint_name, {
        columns: [],
        refTable: row.foreign_table_name,
        refColumns: [],
      });
    }
    const fk = fkMap.get(row.constraint_name)!;
    fk.columns.push(row.column_name);
    fk.refColumns.push(row.foreign_column_name);
  }

  // Build columns
  type PgColumnRow = {
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
  };
  const columns: IntrospectedColumn[] = columnsResult.rows.map((row: PgColumnRow) => {
    // Handle array types (udt_name starts with _)
    let type = row.data_type;
    if (row.udt_name.startsWith('_')) {
      type = row.udt_name.substring(1) + '[]';
    } else if (row.data_type === 'ARRAY') {
      type = row.udt_name.replace(/^_/, '') + '[]';
    } else if (row.data_type === 'USER-DEFINED') {
      type = row.udt_name;
    }

    return {
      name: row.column_name,
      type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default ?? undefined,
      isPrimaryKey: primaryKeyColumns.has(row.column_name),
      isUnique: uniqueColumns.has(row.column_name) || primaryKeyColumns.has(row.column_name),
    };
  });

  // Build indexes
  const indexes: IntrospectedIndex[] = Array.from(indexMap.entries()).map(([name, data]) => ({
    name,
    columns: data.columns,
    unique: data.unique,
  }));

  // Build foreign keys
  const foreignKeys: IntrospectedForeignKey[] = Array.from(fkMap.entries()).map(([name, data]) => ({
    name,
    columns: data.columns,
    referencedTable: data.refTable,
    referencedColumns: data.refColumns,
  }));

  return {
    name: tableName,
    schema: schemaName,
    columns,
    primaryKey: pkResult.rows.map((r: { column_name: string }) => r.column_name),
    indexes,
    foreignKeys,
  };
}

/**
 * Introspect a specific PostgreSQL table
 */
async function introspectPostgresTable(
  url: string,
  tableName: string,
  options: { schemaName?: string }
): Promise<IntrospectedTable> {
  const client = new PgClient({ connectionString: url });
  try {
    await client.connect();
    return await introspectPostgresTableWithClient(client, tableName, options.schemaName || 'public');
  } finally {
    await client.end();
  }
}

/**
 * Introspect MySQL database
 */
async function introspectMysql(
  url: string,
  options: { schemaName?: string }
): Promise<IntrospectedTable[]> {
  // Parse database name from URL
  const urlObj = new URL(url);
  const databaseName = options.schemaName || urlObj.pathname.replace(/^\//, '');

  const connection = await mysql.createConnection(url);
  try {
    // Get all tables in the database
    const [tablesRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [databaseName]
    );

    const tables: IntrospectedTable[] = [];

    for (const row of tablesRows) {
      const table = await introspectMysqlTableWithConnection(connection, row.table_name as string, databaseName);
      tables.push(table);
    }

    return tables;
  } finally {
    await connection.end();
  }
}

/**
 * Internal helper to introspect a MySQL table using an existing connection
 */
async function introspectMysqlTableWithConnection(
  connection: mysql.Connection,
  tableName: string,
  databaseName: string
): Promise<IntrospectedTable> {
  // Get columns
  const [columnsRows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT
       column_name,
       column_type,
       data_type,
       is_nullable,
       column_default,
       column_key,
       extra
     FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ?
     ORDER BY ordinal_position`,
    [databaseName, tableName]
  );

  // Get primary key columns
  const [pkRows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT column_name
     FROM information_schema.key_column_usage
     WHERE table_schema = ?
       AND table_name = ?
       AND constraint_name = 'PRIMARY'
     ORDER BY ordinal_position`,
    [databaseName, tableName]
  );
  const primaryKeyColumns = new Set(pkRows.map(r => r.column_name as string));

  // Get unique indexes
  const [uniqueRows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT DISTINCT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
     WHERE tc.table_schema = ?
       AND tc.table_name = ?
       AND tc.constraint_type = 'UNIQUE'`,
    [databaseName, tableName]
  );
  const uniqueColumns = new Set(uniqueRows.map(r => r.column_name as string));

  // Get indexes
  const [indexRows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT
       index_name,
       column_name,
       non_unique
     FROM information_schema.statistics
     WHERE table_schema = ? AND table_name = ? AND index_name != 'PRIMARY'
     ORDER BY index_name, seq_in_index`,
    [databaseName, tableName]
  );

  // Group index columns by index name
  const indexMap = new Map<string, { columns: string[]; unique: boolean }>();
  for (const row of indexRows) {
    const indexName = row.index_name as string;
    if (!indexMap.has(indexName)) {
      indexMap.set(indexName, { columns: [], unique: (row.non_unique as number) === 0 });
    }
    indexMap.get(indexName)!.columns.push(row.column_name as string);
  }

  // Get foreign keys
  const [fkRows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT
       constraint_name,
       column_name,
       referenced_table_name,
       referenced_column_name
     FROM information_schema.key_column_usage
     WHERE table_schema = ?
       AND table_name = ?
       AND referenced_table_name IS NOT NULL
     ORDER BY constraint_name, ordinal_position`,
    [databaseName, tableName]
  );

  // Group foreign key columns
  const fkMap = new Map<string, { columns: string[]; refTable: string; refColumns: string[] }>();
  for (const row of fkRows) {
    const constraintName = row.constraint_name as string;
    if (!fkMap.has(constraintName)) {
      fkMap.set(constraintName, {
        columns: [],
        refTable: row.referenced_table_name as string,
        refColumns: [],
      });
    }
    const fk = fkMap.get(constraintName)!;
    fk.columns.push(row.column_name as string);
    fk.refColumns.push(row.referenced_column_name as string);
  }

  // Build columns
  const columns: IntrospectedColumn[] = columnsRows.map(row => ({
    name: row.column_name as string,
    type: row.column_type as string, // Use column_type which includes size info like varchar(255)
    nullable: (row.is_nullable as string) === 'YES',
    defaultValue: row.column_default as string | undefined,
    isPrimaryKey: primaryKeyColumns.has(row.column_name as string),
    isUnique: uniqueColumns.has(row.column_name as string) || primaryKeyColumns.has(row.column_name as string),
  }));

  // Build indexes
  const indexes: IntrospectedIndex[] = Array.from(indexMap.entries()).map(([name, data]) => ({
    name,
    columns: data.columns,
    unique: data.unique,
  }));

  // Build foreign keys
  const foreignKeys: IntrospectedForeignKey[] = Array.from(fkMap.entries()).map(([name, data]) => ({
    name,
    columns: data.columns,
    referencedTable: data.refTable,
    referencedColumns: data.refColumns,
  }));

  return {
    name: tableName,
    schema: databaseName,
    columns,
    primaryKey: pkRows.map(r => r.column_name as string),
    indexes,
    foreignKeys,
  };
}

/**
 * Introspect a specific MySQL table
 */
async function introspectMysqlTable(
  url: string,
  tableName: string
): Promise<IntrospectedTable> {
  const urlObj = new URL(url);
  const databaseName = urlObj.pathname.replace(/^\//, '');

  const connection = await mysql.createConnection(url);
  try {
    return await introspectMysqlTableWithConnection(connection, tableName, databaseName);
  } finally {
    await connection.end();
  }
}

/**
 * Introspect SQLite database
 */
async function introspectSqlite(filePath: string): Promise<IntrospectedTable[]> {
  const db = new Database(filePath, { readonly: true });
  try {
    // Get all tables
    const tables = db.prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    ).all() as Array<{ name: string }>;

    const result: IntrospectedTable[] = [];
    for (const tableRow of tables) {
      result.push(introspectSqliteTableSync(db, tableRow.name));
    }
    return result;
  } finally {
    db.close();
  }
}

/**
 * Internal helper to introspect a SQLite table synchronously
 */
function introspectSqliteTableSync(db: BetterSqlite3.Database, tableName: string): IntrospectedTable {
  // Get columns using PRAGMA
  const columnsInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;

  // Get foreign keys using PRAGMA
  const fkInfo = db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all() as Array<{
    id: number;
    seq: number;
    table: string;
    from: string;
    to: string;
    on_update: string;
    on_delete: string;
    match: string;
  }>;

  // Get indexes
  const indexList = db.prepare(`PRAGMA index_list("${tableName}")`).all() as Array<{
    seq: number;
    name: string;
    unique: number;
    origin: string;
    partial: number;
  }>;

  // Get primary key columns
  const primaryKeyColumns = new Set(
    columnsInfo.filter(col => col.pk > 0).map(col => col.name)
  );

  // Get unique columns from unique indexes
  const uniqueColumns = new Set<string>();
  const indexMap = new Map<string, { columns: string[]; unique: boolean }>();

  for (const idx of indexList) {
    // Skip auto-created indexes for PRIMARY KEY
    if (idx.origin === 'pk') continue;

    const indexInfo = db.prepare(`PRAGMA index_info("${idx.name}")`).all() as Array<{
      seqno: number;
      cid: number;
      name: string;
    }>;

    const columns = indexInfo.map(i => i.name);
    indexMap.set(idx.name, { columns, unique: idx.unique === 1 });

    if (idx.unique === 1) {
      for (const col of columns) {
        uniqueColumns.add(col);
      }
    }
  }

  // Group foreign keys by id (constraint)
  const fkMap = new Map<number, { columns: string[]; refTable: string; refColumns: string[] }>();
  for (const fk of fkInfo) {
    if (!fkMap.has(fk.id)) {
      fkMap.set(fk.id, { columns: [], refTable: fk.table, refColumns: [] });
    }
    const entry = fkMap.get(fk.id)!;
    entry.columns.push(fk.from);
    entry.refColumns.push(fk.to);
  }

  // Build columns
  const columns: IntrospectedColumn[] = columnsInfo.map(col => ({
    name: col.name,
    type: col.type || 'TEXT', // SQLite allows empty type, default to TEXT
    nullable: col.notnull === 0 && col.pk === 0, // NOT NULL or PK means not nullable
    defaultValue: col.dflt_value ?? undefined,
    isPrimaryKey: col.pk > 0,
    isUnique: uniqueColumns.has(col.name) || col.pk > 0,
  }));

  // Build indexes
  const indexes: IntrospectedIndex[] = Array.from(indexMap.entries()).map(([name, data]) => ({
    name,
    columns: data.columns,
    unique: data.unique,
  }));

  // Build foreign keys
  const foreignKeys: IntrospectedForeignKey[] = Array.from(fkMap.entries()).map(([id, data]) => ({
    name: `fk_${tableName}_${id}`,
    columns: data.columns,
    referencedTable: data.refTable,
    referencedColumns: data.refColumns,
  }));

  return {
    name: tableName,
    columns,
    primaryKey: Array.from(primaryKeyColumns),
    indexes,
    foreignKeys,
  };
}

/**
 * Introspect a specific SQLite table
 */
async function introspectSqliteTable(
  filePath: string,
  tableName: string
): Promise<IntrospectedTable> {
  const db = new Database(filePath, { readonly: true });
  try {
    return introspectSqliteTableSync(db, tableName);
  } finally {
    db.close();
  }
}

// =============================================================================
// Schema Generation
// =============================================================================

/**
 * Convert an introspected table to an IceType schema representation
 */
function tableToIceTypeSchema(table: IntrospectedTable): GeneratedSchema {
  const fields = new Map<string, GeneratedField>();
  const relations = new Map<string, { targetTable: string; targetField: string }>();
  const directives: {
    $partitionBy?: string[];
    $index?: string[][];
  } = {};

  // Track indexed columns for directive
  const indexedColumns: string[][] = [];

  // Process columns
  for (const column of table.columns) {
    const iceType = mapPostgresType(column.type); // Default to postgres mapping

    // Check if column is in an index
    const isInIndex = table.indexes.some(idx => idx.columns.includes(column.name));

    // Determine modifier based on constraints
    // Primary key: !
    // Unique (not PK): #
    // Optional: ? (but we'll use isOptional flag instead)
    // Required (not PK, not unique): no modifier
    let modifier = '';
    if (column.isPrimaryKey) {
      modifier = '!';
    } else if (column.isUnique && isInIndex) {
      modifier = '#';
    }

    fields.set(column.name, {
      type: iceType,
      isOptional: column.nullable,
      isUnique: column.isUnique,
      isIndexed: isInIndex,
      isPrimaryKey: column.isPrimaryKey,
      modifier,
    });
  }

  // Process indexes - add to directives
  for (const index of table.indexes) {
    if (index.columns.length >= 1) {
      indexedColumns.push(index.columns);
    }
  }

  if (indexedColumns.length > 0) {
    directives.$index = indexedColumns;
  }

  // Process foreign keys as relations
  for (const fk of table.foreignKeys) {
    // Generate relation name from foreign key
    // e.g., author_id -> author
    const firstColumn = fk.columns[0];
    const firstRefColumn = fk.referencedColumns[0];
    if (firstColumn && firstRefColumn) {
      const relationName = firstColumn.replace(/_id$/, '');
      relations.set(relationName, {
        targetTable: fk.referencedTable,
        targetField: firstRefColumn,
      });
    }
  }

  // Handle composite primary key
  if (table.primaryKey && table.primaryKey.length > 1) {
    directives.$partitionBy = table.primaryKey;
  }

  return {
    name: table.name,
    fields,
    relations,
    directives,
  };
}

/**
 * Convert an introspected table to a full IceTypeSchema.
 * This enables diffing against existing schema files.
 */
export function introspectedTableToIceTypeSchema(table: IntrospectedTable): IceTypeSchema {
  const generatedSchema = tableToIceTypeSchema(table);
  const fields = new Map<string, FieldDefinition>();
  const relations = new Map<string, { operator: '->' | '~>' | '<-' | '<~'; targetType: string; inverse?: string; onDelete?: 'cascade' | 'set_null' | 'restrict' }>();

  // Convert GeneratedField to FieldDefinition
  for (const [fieldName, genField] of generatedSchema.fields) {
    const modifier: FieldModifier = genField.modifier as FieldModifier || '';
    const fieldDef: FieldDefinition = {
      name: fieldName,
      type: genField.type,
      modifier,
      isArray: false,
      isOptional: genField.isOptional,
      isUnique: genField.isUnique,
      isIndexed: genField.isIndexed,
    };
    fields.set(fieldName, fieldDef);
  }

  // Convert relations
  for (const [relationName, genRelation] of generatedSchema.relations) {
    relations.set(relationName, {
      operator: '->',
      targetType: genRelation.targetTable,
    });
  }

  // Convert directives
  const directives: SchemaDirectives = {};
  if (generatedSchema.directives.$partitionBy) {
    directives.partitionBy = generatedSchema.directives.$partitionBy;
  }
  if (generatedSchema.directives.$index) {
    directives.index = generatedSchema.directives.$index.map(cols => ({
      fields: cols,
      unique: false,
    }));
  }

  return {
    name: table.name,
    fields,
    directives,
    relations,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Diff an introspected table against an existing IceTypeSchema.
 * Returns the differences between what's in the database and the schema file.
 */
export function diffIntrospectedAgainstSchema(
  introspectedTable: IntrospectedTable,
  targetSchema: IceTypeSchema
): SchemaDiff {
  const introspectedSchema = introspectedTableToIceTypeSchema(introspectedTable);
  return diffSchemas(introspectedSchema, targetSchema);
}

/**
 * Diff all introspected tables against a set of target schemas.
 * Returns results for:
 * - Tables in both (with diff)
 * - Tables only in database
 * - Tables only in schema file
 */
export function diffIntrospectedTables(
  introspectedTables: IntrospectedTable[],
  targetSchemas: Map<string, IceTypeSchema>
): IntrospectionDiffResult[] {
  const results: IntrospectionDiffResult[] = [];
  const introspectedNames = new Set(introspectedTables.map(t => t.name));

  // Process tables that exist in the database
  for (const table of introspectedTables) {
    const introspectedSchema = introspectedTableToIceTypeSchema(table);
    const targetSchema = targetSchemas.get(table.name);

    if (targetSchema) {
      // Table exists in both - compute diff
      const diff = diffSchemas(introspectedSchema, targetSchema);
      results.push({
        tableName: table.name,
        diff,
        introspectedSchema,
        targetSchema,
        onlyInDatabase: false,
        onlyInSchemaFile: false,
      });
    } else {
      // Table only exists in database
      // Create an empty diff to represent "all fields are new"
      const emptySchema: IceTypeSchema = {
        name: table.name,
        fields: new Map(),
        directives: {},
        relations: new Map(),
        version: 0,
        createdAt: 0,
        updatedAt: 0,
      };
      const diff = diffSchemas(emptySchema, introspectedSchema);
      results.push({
        tableName: table.name,
        diff,
        introspectedSchema,
        onlyInDatabase: true,
        onlyInSchemaFile: false,
      });
    }
  }

  // Process tables that only exist in the schema file
  for (const [schemaName, targetSchema] of targetSchemas) {
    if (!introspectedNames.has(schemaName)) {
      // Create an "all removed" diff
      const emptySchema: IceTypeSchema = {
        name: schemaName,
        fields: new Map(),
        directives: {},
        relations: new Map(),
        version: 0,
        createdAt: 0,
        updatedAt: 0,
      };
      const diff = diffSchemas(targetSchema, emptySchema);
      results.push({
        tableName: schemaName,
        diff,
        introspectedSchema: emptySchema,
        targetSchema,
        onlyInDatabase: false,
        onlyInSchemaFile: true,
      });
    }
  }

  return results;
}

/**
 * Format diff results for console output
 */
export function formatDiffResults(results: IntrospectionDiffResult[]): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('Schema Diff: Database vs Schema File');
  lines.push('='.repeat(60));
  lines.push('');

  let hasChanges = false;

  for (const result of results) {
    if (result.onlyInDatabase) {
      hasChanges = true;
      lines.push(`[NEW IN DB] ${result.tableName}`);
      lines.push('  This table exists in the database but not in the schema file.');
      lines.push('  Consider adding it to your schema.');
      lines.push('');
    } else if (result.onlyInSchemaFile) {
      hasChanges = true;
      lines.push(`[MISSING IN DB] ${result.tableName}`);
      lines.push('  This table is defined in the schema file but does not exist in the database.');
      lines.push('  Run migrations to create it, or remove it from the schema.');
      lines.push('');
    } else if (result.diff.changes.length > 0) {
      hasChanges = true;
      lines.push(`[DIFFERS] ${result.tableName}`);
      lines.push(`  ${result.diff.changes.length} change(s) detected:`);

      for (const change of result.diff.changes) {
        switch (change.type) {
          case 'add_field':
            lines.push(`    + Field "${change.field}" added (${change.definition.type})`);
            break;
          case 'remove_field':
            lines.push(`    - Field "${change.field}" removed`);
            break;
          case 'rename_field':
            lines.push(`    ~ Field renamed: "${change.oldName}" -> "${change.newName}"`);
            break;
          case 'change_type':
            lines.push(`    ~ Field "${change.field}" type: ${change.oldType} -> ${change.newType}`);
            break;
          case 'change_modifier':
            lines.push(`    ~ Field "${change.field}" modifier: "${change.oldModifier}" -> "${change.newModifier}"`);
            break;
          case 'change_directive':
            lines.push(`    ~ Directive ${change.directive} changed`);
            break;
        }
      }

      if (result.diff.isBreaking) {
        lines.push('  ⚠️  Contains breaking changes');
      }
      lines.push('');
    } else {
      lines.push(`[OK] ${result.tableName}`);
      lines.push('  No differences detected.');
      lines.push('');
    }
  }

  if (!hasChanges) {
    lines.push('No differences detected. Database and schema are in sync.');
  } else {
    const added = results.filter(r => r.onlyInDatabase).length;
    const missing = results.filter(r => r.onlyInSchemaFile).length;
    const modified = results.filter(r => !r.onlyInDatabase && !r.onlyInSchemaFile && r.diff.changes.length > 0).length;

    lines.push('-'.repeat(60));
    lines.push('Summary:');
    if (added > 0) lines.push(`  - ${added} table(s) only in database`);
    if (missing > 0) lines.push(`  - ${missing} table(s) only in schema file`);
    if (modified > 0) lines.push(`  - ${modified} table(s) with differences`);
  }

  return lines.join('\n');
}

// =============================================================================
// Naming Conventions
// =============================================================================

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Get a variable name for export, preserving lowercase single words
 */
function getExportName(tableName: string): string {
  // If contains underscore, convert to PascalCase
  if (tableName.includes('_')) {
    return toPascalCase(tableName);
  }
  // Otherwise preserve original (lowercase single words stay lowercase)
  return tableName;
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// =============================================================================
// Table Filtering
// =============================================================================

/**
 * System tables that should be excluded by default
 */
const SYSTEM_TABLE_PATTERNS = [
  /^pg_/,           // PostgreSQL system
  /^information_schema/,  // Standard SQL system
  /^sqlite_/,       // SQLite system
  /^mysql\./,       // MySQL system
  /^sys\./,         // MySQL sys schema
  /^performance_schema/,  // MySQL performance
];

/**
 * Filter tables based on options
 */
function filterTables(
  tables: IntrospectedTable[],
  options: { tables?: string[]; exclude?: string[] }
): IntrospectedTable[] {
  let filtered = tables;

  // Exclude system tables by default
  filtered = filtered.filter(table => {
    return !SYSTEM_TABLE_PATTERNS.some(pattern => pattern.test(table.name));
  });

  // Include only specified tables
  if (options.tables && options.tables.length > 0) {
    const includeSet = new Set(options.tables);
    filtered = filtered.filter(table => includeSet.has(table.name));
  }

  // Exclude specified tables
  if (options.exclude && options.exclude.length > 0) {
    const excludeSet = new Set(options.exclude);
    filtered = filtered.filter(table => !excludeSet.has(table.name));
  }

  return filtered;
}

// =============================================================================
// Output Generation
// =============================================================================

/**
 * Generate TypeScript output from introspected tables
 */
function generateTypescriptOutput(tables: IntrospectedTable[]): string {
  const lines: string[] = [
    "import { parseSchema } from '@icetype/core';",
    '',
  ];

  for (const table of tables) {
    const schema = tableToIceTypeSchema(table);
    const varName = getExportName(table.name);
    const typeName = table.name;

    lines.push(`export const ${varName} = parseSchema({`);
    lines.push(`  $type: '${typeName}',`);

    // Add directives
    if (schema.directives.$partitionBy) {
      lines.push(`  $partitionBy: ${JSON.stringify(schema.directives.$partitionBy)},`);
    }
    if (schema.directives.$index && schema.directives.$index.length > 0) {
      lines.push(`  $index: ${JSON.stringify(schema.directives.$index)},`);
    }

    lines.push('');

    // Add fields
    for (const [fieldName, field] of schema.fields) {
      const camelName = toCamelCase(fieldName);
      let typeStr = field.type;

      // Add modifier if set
      // modifier is determined by tableToIceTypeSchema:
      // - Primary key: !
      // - Unique indexed: #
      // - Other: no modifier
      if (field.modifier) {
        typeStr += field.modifier;
      }

      lines.push(`  ${camelName}: '${typeStr}',`);
    }

    // Add relations
    for (const [relationName, relation] of schema.relations) {
      const camelName = toCamelCase(relationName);
      lines.push(`  ${camelName}: '-> ${toPascalCase(relation.targetTable)}',`);
    }

    lines.push('});');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate JSON output from introspected tables
 */
function generateJsonOutput(tables: IntrospectedTable[]): string {
  const schemas = tables.map(table => {
    const schema = tableToIceTypeSchema(table);
    const fields: Record<string, GeneratedField> = {};
    for (const [key, value] of schema.fields) {
      fields[key] = value;
    }
    const relations: Record<string, { targetTable: string; targetField: string }> = {};
    for (const [key, value] of schema.relations) {
      relations[key] = value;
    }
    return {
      name: table.name,
      fields,
      relations,
      directives: schema.directives,
    };
  });

  return JSON.stringify({ schemas }, null, 2);
}

/**
 * Write output to file, creating directories if needed
 */
async function writeOutput(outputPath: string, content: string): Promise<void> {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(outputPath, content);
}

// =============================================================================
// Main Command
// =============================================================================

/**
 * Main pull command handler
 */
export async function pull(args: string[]): Promise<void> {
  const options = parseArgs(args);

  // Validate required arguments
  if (!options.url) {
    throw new Error('Connection URL is required');
  }

  // Validate URL format
  let dialect: DatabaseDialect;
  try {
    dialect = detectDialect(options.url);
  } catch {
    throw new Error(`Invalid connection URL: '${options.url}'. Expected postgres://, mysql://, sqlite://, or a .db/.sqlite file path.`);
  }

  // Extract schema from database
  let tables: IntrospectedTable[];
  try {
    tables = await extractSchema(options.url, dialect);
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw specific errors
      if (error.message.includes('Database file not found')) {
        throw error;
      }
      // Map common database errors
      if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
        throw new Error(`Connection refused: Could not connect to database at '${options.url}'`);
      }
      if (error.message.includes('authentication') || error.message.includes('password') || error.message.includes('permission')) {
        throw new Error(`Authentication failed: Invalid credentials for database '${options.url}'`);
      }
      if (error.message.includes('does not exist') || error.message.includes('not found')) {
        throw new Error(`Database not found: The database specified in '${options.url}' does not exist`);
      }
    }
    throw error;
  }

  // Filter tables
  tables = filterTables(tables, {
    tables: options.tables,
    exclude: options.exclude,
  });

  // Handle diff mode
  if (options.diff) {
    // Import schema loader dynamically to avoid circular dependency
    const { loadSchemaFile } = await import('../utils/schema-loader.js');

    if (!existsSync(options.diff)) {
      throw new Error(`Schema file not found: ${options.diff}`);
    }

    const loadResult = await loadSchemaFile(options.diff);
    if (loadResult.errors.length > 0) {
      throw new Error(`Failed to load schema file: ${loadResult.errors.join(', ')}`);
    }

    // Build a map of schemas by name
    const targetSchemas = new Map<string, IceTypeSchema>();
    for (const loadedSchema of loadResult.schemas) {
      targetSchemas.set(loadedSchema.schema.name, loadedSchema.schema);
    }

    // Perform diff
    const diffResults = diffIntrospectedTables(tables, targetSchemas);
    const diffOutput = formatDiffResults(diffResults);

    // Output diff results
    if (options.output) {
      await writeOutput(options.output, diffOutput);
      if (!options.quiet) {
        console.log(`Diff results written to: ${options.output}`);
      }
    } else {
      console.log(diffOutput);
    }

    return;
  }

  // Generate output
  let output: string;
  if (options.format === 'json') {
    output = generateJsonOutput(tables);
  } else {
    output = generateTypescriptOutput(tables);
  }

  // Write or print output
  if (options.output) {
    await writeOutput(options.output, output);
    if (!options.quiet) {
      console.log(`Schema exported to: ${options.output}`);
    }
  } else {
    console.log(output);
  }
}

// =============================================================================
// Test Helpers (exported for testing)
// =============================================================================

/**
 * Internal helper functions exported for testing purposes only.
 * These should not be used in production code.
 */
export const _testHelpers = {
  parseArgs,
  detectDialect,
  mapPostgresType,
  mapMysqlType,
  mapSqliteType,
  extractSchema,
  introspectPostgres,
  introspectPostgresTable,
  introspectMysql,
  introspectMysqlTable,
  introspectSqlite,
  introspectSqliteTable,
  tableToIceTypeSchema,
  introspectedTableToIceTypeSchema,
  diffIntrospectedAgainstSchema,
  diffIntrospectedTables,
  formatDiffResults,
  toPascalCase,
  toCamelCase,
  filterTables,
  generateTypescriptOutput,
  generateJsonOutput,
  writeOutput,
};
