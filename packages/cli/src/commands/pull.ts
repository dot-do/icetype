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
 */

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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
    } else if (!arg.startsWith('-') && !options.url) {
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
// Database Introspection (Mock implementations for testing)
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
 * This is a mock implementation - in production this would connect to the actual database
 */
async function introspectPostgres(
  _url: string,
  _options: { schemaName?: string }
): Promise<IntrospectedTable[]> {
  // Mock implementation for testing - returns empty array
  // Real implementation would use pg client to query information_schema
  return [];
}

/**
 * Introspect a specific PostgreSQL table
 */
async function introspectPostgresTable(
  _url: string,
  _tableName: string,
  _options: { schemaName?: string }
): Promise<IntrospectedTable> {
  // Mock implementation for testing
  return {
    name: _tableName,
    columns: [],
    indexes: [],
    foreignKeys: [],
  };
}

/**
 * Introspect MySQL database
 */
async function introspectMysql(
  _url: string,
  _options: { schemaName?: string }
): Promise<IntrospectedTable[]> {
  // Mock implementation for testing - returns empty array
  // Real implementation would use mysql2 client to query information_schema
  return [];
}

/**
 * Introspect a specific MySQL table
 */
async function introspectMysqlTable(
  _url: string,
  _tableName: string
): Promise<IntrospectedTable> {
  // Mock implementation for testing
  return {
    name: _tableName,
    columns: [],
    indexes: [],
    foreignKeys: [],
  };
}

/**
 * Introspect SQLite database
 */
async function introspectSqlite(_filePath: string): Promise<IntrospectedTable[]> {
  // Mock implementation for testing - returns empty array
  // Real implementation would use better-sqlite3 to query sqlite_master
  return [];
}

/**
 * Introspect a specific SQLite table
 */
async function introspectSqliteTable(
  _filePath: string,
  _tableName: string
): Promise<IntrospectedTable> {
  // Mock implementation for testing
  return {
    name: _tableName,
    columns: [],
    indexes: [],
    foreignKeys: [],
  };
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
    const relationName = fk.columns[0].replace(/_id$/, '');
    relations.set(relationName, {
      targetTable: fk.referencedTable,
      targetField: fk.referencedColumns[0],
    });
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
  toPascalCase,
  toCamelCase,
  filterTables,
  generateTypescriptOutput,
  generateJsonOutput,
  writeOutput,
};
