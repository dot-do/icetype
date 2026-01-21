/**
 * @icetype/sql-common
 *
 * Shared SQL DDL utilities for IceType database adapters.
 * Provides common functionality for escaping identifiers, formatting values,
 * and generating DDL statements across DuckDB, PostgreSQL, ClickHouse, SQLite, and MySQL.
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Supported SQL dialects.
 */
export type SqlDialect = 'duckdb' | 'postgres' | 'clickhouse' | 'sqlite' | 'mysql';

/**
 * Common column definition interface used across all SQL dialects.
 */
export interface SqlColumn {
  /** Column name */
  name: string;
  /** SQL data type */
  type: string;
  /** Whether the column allows NULL values */
  nullable: boolean;
  /** Default value expression (as SQL string) */
  default?: string;
  /** Whether this column is part of the primary key */
  primaryKey?: boolean;
  /** Whether this column has a unique constraint */
  unique?: boolean;
  /** Precision for DECIMAL type */
  precision?: number;
  /** Scale for DECIMAL type */
  scale?: number;
}

// =============================================================================
// Schema Name Validation
// =============================================================================

/**
 * Error thrown when a schema name is invalid.
 */
export class InvalidSchemaNameError extends Error {
  constructor(name: string) {
    super(`Invalid schema name: "${name}". Schema names must contain only alphanumeric characters, underscores, and dots (for qualified names), and must start with a letter or underscore.`);
    this.name = 'InvalidSchemaNameError';
  }
}

/**
 * Validate a SQL schema name to prevent SQL injection.
 *
 * Schema names must:
 * - Be non-empty
 * - Contain only alphanumeric characters, underscores, and optionally dots (for qualified names like "catalog.schema")
 * - Start with a letter or underscore (not a number or dot)
 * - Each segment (split by dots) must start with a letter or underscore
 *
 * This validation is intentionally strict to prevent any SQL injection vectors.
 *
 * @param name - The schema name to validate
 * @throws InvalidSchemaNameError if the name contains dangerous characters
 */
export function validateSchemaName(name: string): void {
  if (!name || name.length === 0) {
    throw new InvalidSchemaNameError(name);
  }

  // Check for common SQL injection patterns first
  if (name.includes(';') || name.includes('--') || name.includes('/*') || name.includes("'") || name.includes('"')) {
    throw new InvalidSchemaNameError(name);
  }

  // Split by dots to handle qualified names like "catalog.schema"
  const segments = name.split('.');

  for (const segment of segments) {
    // Each segment must be non-empty
    if (!segment || segment.length === 0) {
      throw new InvalidSchemaNameError(name);
    }

    // Each segment must match: starts with letter or underscore, followed by alphanumeric or underscore
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)) {
      throw new InvalidSchemaNameError(name);
    }
  }
}

// =============================================================================
// SQL Reserved Keywords (for PostgreSQL)
// =============================================================================

/**
 * Common SQL reserved keywords that should always be quoted when used as identifiers.
 * This is a subset of PostgreSQL reserved keywords that are most commonly used
 * and could cause issues if not quoted.
 */
const SQL_RESERVED_KEYWORDS = new Set([
  'select', 'from', 'where', 'insert', 'update', 'delete', 'drop', 'create',
  'alter', 'table', 'index', 'view', 'database', 'schema', 'column', 'constraint',
  'primary', 'foreign', 'key', 'references', 'unique', 'check', 'default',
  'null', 'not', 'and', 'or', 'in', 'is', 'like', 'between', 'exists',
  'case', 'when', 'then', 'else', 'end', 'as', 'on', 'join', 'left', 'right',
  'inner', 'outer', 'cross', 'full', 'group', 'by', 'having', 'order', 'asc',
  'desc', 'limit', 'offset', 'union', 'intersect', 'except', 'all', 'distinct',
  'into', 'values', 'set', 'grant', 'revoke', 'begin', 'commit', 'rollback',
  'transaction', 'true', 'false', 'user', 'role', 'public', 'current_user',
  'current_date', 'current_time', 'current_timestamp', 'localtime', 'localtimestamp',
]);

/**
 * Check if an identifier is a SQL reserved keyword.
 *
 * @param identifier - The identifier to check
 * @returns True if the identifier is a reserved keyword
 */
function isReservedKeyword(identifier: string): boolean {
  return SQL_RESERVED_KEYWORDS.has(identifier.toLowerCase());
}

// =============================================================================
// Identifier Escaping
// =============================================================================

/**
 * Escape an identifier for the given SQL dialect.
 *
 * Different dialects use different quote characters:
 * - DuckDB, PostgreSQL, and SQLite use double quotes ("identifier")
 * - ClickHouse and MySQL use backticks (`identifier`)
 *
 * Identifiers are escaped (quoted) if they:
 * - Contain special characters (anything besides letters, digits, underscore)
 * - Start with a digit
 * - Start with $ (system fields)
 * - Are SQL reserved keywords (PostgreSQL only)
 *
 * @param identifier - The identifier to escape
 * @param dialect - The SQL dialect to use
 * @returns The escaped identifier
 */
export function escapeIdentifier(identifier: string, dialect: SqlDialect): string {
  // Check if identifier needs escaping
  const isSimpleIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
  const startsWithDollar = identifier.startsWith('$');
  const isKeyword = dialect === 'postgres' && isReservedKeyword(identifier);

  // If it's a simple identifier without special conditions, return as-is
  if (isSimpleIdentifier && !startsWithDollar && !isKeyword) {
    return identifier;
  }

  // Determine quote character based on dialect
  if (dialect === 'clickhouse' || dialect === 'mysql') {
    // ClickHouse and MySQL use backticks
    const escaped = identifier.replace(/`/g, '``');
    return `\`${escaped}\``;
  } else {
    // DuckDB, PostgreSQL, and SQLite use double quotes
    const escaped = identifier.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}

// =============================================================================
// Default Value Formatting
// =============================================================================

/**
 * Format a default value as a SQL expression.
 *
 * Handles the following value types:
 * - null: Returns 'NULL'
 * - string: Escapes single quotes and wraps in single quotes
 * - number: Returns the number as a string
 * - boolean: Returns 'TRUE'/'FALSE' (or '1'/'0' for SQLite)
 * - Date: Returns ISO string for TIMESTAMP, date-only for DATE types
 * - Array/Object: JSON serializes and wraps in single quotes
 *
 * @param value - The default value
 * @param type - The SQL type (used for Date formatting)
 * @param dialect - Optional SQL dialect (defaults to 'postgres' behavior)
 * @returns The SQL expression string
 */
export function formatDefaultValue(value: unknown, type: string, dialect?: SqlDialect): string {
  if (value === null) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    // Escape single quotes
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    // SQLite uses 0/1 for booleans
    if (dialect === 'sqlite') {
      return value ? '1' : '0';
    }
    return value ? 'TRUE' : 'FALSE';
  }

  if (value instanceof Date) {
    // For DATE types (not TIMESTAMP), return only the date portion
    if (type.toUpperCase().includes('DATE') && !type.toUpperCase().includes('TIMESTAMP')) {
      return `'${value.toISOString().split('T')[0]}'`;
    }
    return `'${value.toISOString()}'`;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    // JSON serialize for complex types
    const escaped = JSON.stringify(value).replace(/'/g, "''");
    return `'${escaped}'`;
  }

  return String(value);
}

// =============================================================================
// Column Serialization
// =============================================================================

/**
 * Serialize a column definition to a DDL fragment.
 *
 * Generates a column definition string like:
 * "column_name TYPE NOT NULL UNIQUE DEFAULT value"
 *
 * @param column - The column definition
 * @param dialect - The SQL dialect to use
 * @returns The DDL column fragment
 */
export function serializeColumn(column: SqlColumn, dialect: SqlDialect): string {
  const parts: string[] = [
    escapeIdentifier(column.name, dialect),
    column.type,
  ];

  if (!column.nullable) {
    parts.push('NOT NULL');
  }

  if (column.unique) {
    parts.push('UNIQUE');
  }

  if (column.default !== undefined) {
    parts.push(`DEFAULT ${column.default}`);
  }

  return parts.join(' ');
}

// =============================================================================
// System Columns
// =============================================================================

/**
 * Type configurations for system columns across dialects.
 */
const SYSTEM_COLUMN_TYPES: Record<SqlDialect, {
  stringType: string;
  intType: string;
  bigintType: string;
}> = {
  duckdb: {
    stringType: 'VARCHAR',
    intType: 'INTEGER',
    bigintType: 'BIGINT',
  },
  postgres: {
    stringType: 'TEXT',
    intType: 'INTEGER',
    bigintType: 'BIGINT',
  },
  clickhouse: {
    stringType: 'String',
    intType: 'Int32',
    bigintType: 'Int64',
  },
  sqlite: {
    stringType: 'TEXT',
    intType: 'INTEGER',
    bigintType: 'INTEGER',
  },
  mysql: {
    stringType: 'VARCHAR(255)',
    intType: 'INT',
    bigintType: 'BIGINT',
  },
};

/**
 * Generate system field columns for SQL tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table:
 * - $id: Primary key identifier
 * - $type: Entity type name
 * - $version: Row version for optimistic locking
 * - $createdAt: Creation timestamp (as BIGINT epoch ms)
 * - $updatedAt: Last update timestamp (as BIGINT epoch ms)
 *
 * @param dialect - The SQL dialect to use
 * @returns Array of system column definitions
 */
export function generateSystemColumns(dialect: SqlDialect): SqlColumn[] {
  const types = SYSTEM_COLUMN_TYPES[dialect];

  return [
    {
      name: '$id',
      type: types.stringType,
      nullable: false,
      primaryKey: true,
    },
    {
      name: '$type',
      type: types.stringType,
      nullable: false,
    },
    {
      name: '$version',
      type: types.intType,
      nullable: false,
      default: '1',
    },
    {
      name: '$createdAt',
      type: types.bigintType,
      nullable: false,
    },
    {
      name: '$updatedAt',
      type: types.bigintType,
      nullable: false,
    },
  ];
}

// =============================================================================
// Index Statements
// =============================================================================

/**
 * Generate index DDL statements for indexed fields.
 *
 * Creates CREATE INDEX statements for columns marked as unique.
 * Note: UNIQUE constraints already create indexes in most databases,
 * but explicit indexes might be wanted for non-unique indexed fields.
 *
 * ClickHouse handles indexes differently (ORDER BY, materialized indexes),
 * so this returns an empty array for ClickHouse dialect.
 *
 * @param tableName - The table name
 * @param schemaName - Optional schema name
 * @param columns - The columns to potentially index
 * @param dialect - The SQL dialect to use
 * @returns Array of CREATE INDEX statements
 */
export function generateIndexStatements(
  tableName: string,
  schemaName: string | undefined,
  columns: SqlColumn[],
  dialect: SqlDialect
): string[] {
  // ClickHouse handles indexes differently - it uses ORDER BY and
  // specialized index types (skip indexes, projections)
  if (dialect === 'clickhouse') {
    return [];
  }

  const statements: string[] = [];
  const fullTableName = schemaName
    ? `${escapeIdentifier(schemaName, dialect)}.${escapeIdentifier(tableName, dialect)}`
    : escapeIdentifier(tableName, dialect);

  for (const column of columns) {
    // Create indexes for unique columns
    if (column.unique) {
      // Replace $ with _ in index name to avoid issues
      const indexName = `idx_${tableName}_${column.name}`.replace(/\$/g, '_');
      statements.push(
        `CREATE INDEX IF NOT EXISTS ${escapeIdentifier(indexName, dialect)} ON ${fullTableName} (${escapeIdentifier(column.name, dialect)});`
      );
    }
  }

  return statements;
}
