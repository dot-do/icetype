/**
 * @icetype/sql-common
 *
 * Shared SQL DDL utilities for IceType database adapters.
 * Provides common functionality for escaping identifiers, formatting values,
 * and generating DDL statements across DuckDB, PostgreSQL, ClickHouse, SQLite, and MySQL.
 *
 * @packageDocumentation
 */

import { SYSTEM_COLUMNS } from '@icetype/core';

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
 * Error thrown when an identifier is invalid (e.g., empty, whitespace-only, contains control characters).
 */
export class InvalidIdentifierError extends Error {
  constructor(identifier: string, reason: string) {
    super(`Invalid identifier: "${identifier.slice(0, 20)}${identifier.length > 20 ? '...' : ''}". ${reason}`);
    this.name = 'InvalidIdentifierError';
  }
}

/**
 * Error thrown when an identifier exceeds the maximum length for a dialect.
 */
export class IdentifierTooLongError extends Error {
  constructor(identifier: string, dialect: SqlDialect, maxLength: number, actualLength: number, unit: 'bytes' | 'characters') {
    super(`Identifier too long for ${dialect}: "${identifier.slice(0, 20)}${identifier.length > 20 ? '...' : ''}". Maximum is ${maxLength} ${unit}, got ${actualLength}.`);
    this.name = 'IdentifierTooLongError';
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
// SQL Reserved Keywords (for all dialects)
// =============================================================================

/**
 * Common SQL reserved keywords that should always be quoted when used as identifiers.
 * These keywords are reserved across most SQL dialects and could cause issues if not quoted.
 *
 * This list includes keywords from:
 * - SQL:2023 ANSI/ISO standard
 * - PostgreSQL (https://www.postgresql.org/docs/current/sql-keywords-appendix.html)
 * - MySQL 8.0 (https://dev.mysql.com/doc/refman/8.0/en/keywords.html)
 * - ClickHouse
 * - SQLite
 * - DuckDB
 */
const SQL_RESERVED_KEYWORDS = new Set([
  // Core SQL reserved keywords (ANSI SQL)
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
  // Additional SQL standard keywords
  'with', 'recursive', 'using', 'natural', 'fetch', 'first', 'next', 'only',
  'rows', 'row', 'window', 'over', 'partition', 'range', 'unbounded', 'preceding',
  'following', 'current', 'no', 'action', 'cascade', 'restrict', 'nulls',
  // Data types that are reserved
  'int', 'integer', 'smallint', 'bigint', 'float', 'real', 'double', 'precision',
  'numeric', 'decimal', 'char', 'character', 'varchar', 'text', 'boolean', 'bool',
  'date', 'time', 'timestamp', 'interval', 'blob', 'binary', 'varbinary',
  // MySQL-specific reserved keywords (MySQL 8.0+)
  'accessible', 'analyze', 'asensitive', 'both', 'call', 'change', 'condition',
  'continue', 'convert', 'cube', 'cume_dist', 'cursor', 'databases', 'day_hour',
  'day_microsecond', 'day_minute', 'day_second', 'declare', 'delayed',
  'dense_rank', 'describe', 'deterministic', 'distinctrow', 'div', 'dual',
  'each', 'elseif', 'empty', 'enclosed', 'escaped', 'exit', 'explain',
  'first_value', 'for', 'force', 'function', 'generated', 'get', 'groups',
  'high_priority', 'hour_microsecond', 'hour_minute', 'hour_second', 'if',
  'ignore', 'infile', 'inout', 'insensitive', 'iterate', 'keys', 'kill',
  'lag', 'last_value', 'lead', 'leading', 'leave', 'lines', 'linear', 'load',
  'localtime', 'localtimestamp', 'lock', 'long', 'loop', 'low_priority',
  'master_bind', 'master_ssl_verify_server_cert', 'match', 'maxvalue', 'mediumint',
  'minute_microsecond', 'minute_second', 'mod', 'modifies', 'nth_value', 'ntile',
  'of', 'optimize', 'optimizer_costs', 'option', 'optionally', 'out', 'outfile',
  'percent_rank', 'procedure', 'purge', 'rank', 'read', 'reads', 'read_write',
  'regexp', 'release', 'rename', 'repeat', 'replace', 'require', 'resignal',
  'return', 'rlike', 'second_microsecond', 'sensitive', 'separator', 'show',
  'signal', 'spatial', 'specific', 'sql', 'sqlexception', 'sqlstate', 'sqlwarning',
  'sql_big_result', 'sql_calc_found_rows', 'sql_small_result', 'ssl', 'starting',
  'stored', 'straight_join', 'system', 'terminated', 'tinyint', 'to', 'trailing',
  'trigger', 'undo', 'unlock', 'unsigned', 'usage', 'use', 'utc_date', 'utc_time',
  'utc_timestamp', 'varcharacter', 'varying', 'virtual', 'while', 'write',
  'xor', 'year_month', 'zerofill',
  // PostgreSQL-specific reserved keywords
  'analyse', 'array', 'asymmetric', 'authorization', 'collate', 'concurrently',
  'deferrable', 'do', 'freeze', 'ilike', 'initially', 'isnull', 'lateral',
  'leading', 'limit', 'notnull', 'offset', 'placing', 'returning', 'similar',
  'some', 'symmetric', 'tablesample', 'trailing', 'variadic', 'verbose',
  // ClickHouse-specific keywords
  'alias', 'async', 'attach', 'cluster', 'codec', 'deduplicate', 'detach',
  'dictionaries', 'dictionary', 'engine', 'events', 'final', 'format', 'global',
  'granularity', 'live', 'materialize', 'materialized', 'mutations', 'optimize',
  'outfile', 'populate', 'prewhere', 'projection', 'sample', 'settings', 'sync',
  'totals', 'ttl', 'watch',
  // SQLite-specific keywords
  'abort', 'autoincrement', 'conflict', 'detach', 'fail', 'glob', 'indexed',
  'instead', 'notnull', 'plan', 'pragma', 'query', 'raise', 'reindex', 'temp',
  'temporary', 'vacuum', 'without',
  // DuckDB-specific keywords
  'anti', 'asof', 'copy', 'export', 'import', 'macro', 'pivot', 'positional',
  'qualify', 'semi', 'unpivot',
]);

/**
 * Check if an identifier is a SQL reserved keyword.
 *
 * @param identifier - The identifier to check
 * @returns True if the identifier is a reserved keyword
 */
export function isReservedKeyword(identifier: string): boolean {
  return SQL_RESERVED_KEYWORDS.has(identifier.toLowerCase());
}

// =============================================================================
// Identifier Escaping
// =============================================================================

/**
 * Check if a string contains only ASCII characters (no Unicode).
 * @param str - The string to check
 * @returns True if the string contains only ASCII characters
 */
function isAsciiOnly(str: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(str);
}

/**
 * Check if an identifier needs quoting based on its content.
 * An identifier needs quoting if it:
 * - Contains non-ASCII characters (Unicode)
 * - Contains special characters (anything besides ASCII letters, digits, underscore)
 * - Starts with a digit
 * - Starts with $ (system fields)
 * - Is empty or contains only whitespace
 * - Is a SQL reserved keyword
 *
 * @param identifier - The identifier to check
 * @returns True if the identifier needs quoting
 */
function needsQuoting(identifier: string): boolean {
  // Empty or whitespace-only identifiers need quoting
  if (!identifier || identifier.trim() === '') {
    return true;
  }

  // Check for non-ASCII characters (Unicode) - these always need quoting
  if (!isAsciiOnly(identifier)) {
    return true;
  }

  // Simple ASCII identifier pattern: starts with letter/underscore, followed by letters/digits/underscore
  const isSimpleIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);

  // Check if starts with $ (system fields)
  const startsWithDollar = identifier.startsWith('$');

  // Check if it's a reserved keyword
  const isKeyword = isReservedKeyword(identifier);

  // Needs quoting if not a simple identifier OR starts with $ OR is a keyword
  return !isSimpleIdentifier || startsWithDollar || isKeyword;
}

/**
 * Escape an identifier for the given SQL dialect.
 *
 * Different dialects use different quote characters:
 * - DuckDB, PostgreSQL, and SQLite use double quotes ("identifier")
 * - ClickHouse and MySQL use backticks (`identifier`)
 *
 * Identifiers are escaped (quoted) if they:
 * - Contain special characters (anything besides ASCII letters, digits, underscore)
 * - Contain non-ASCII characters (Unicode)
 * - Start with a digit
 * - Start with $ (system fields)
 * - Are SQL reserved keywords (all dialects)
 * - Are empty or contain only whitespace
 *
 * @param identifier - The identifier to escape
 * @param dialect - The SQL dialect to use
 * @returns The escaped identifier
 */
export function escapeIdentifier(identifier: string, dialect: SqlDialect): string {
  // Check if identifier needs escaping
  if (!needsQuoting(identifier)) {
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
// Identifier Validation
// =============================================================================

/**
 * Maximum identifier lengths by dialect.
 * - PostgreSQL: 63 bytes (NAMEDATALEN - 1)
 * - MySQL: 64 characters
 * - SQLite: No documented limit (we use 1000 as a practical limit)
 * - ClickHouse: No documented limit (we use 1000 as a practical limit)
 * - DuckDB: No documented limit (we use 1000 as a practical limit)
 */
const MAX_IDENTIFIER_LENGTH: Record<SqlDialect, { max: number; unit: 'bytes' | 'characters' }> = {
  postgres: { max: 63, unit: 'bytes' },
  mysql: { max: 64, unit: 'characters' },
  sqlite: { max: 1000, unit: 'characters' },
  clickhouse: { max: 1000, unit: 'characters' },
  duckdb: { max: 1000, unit: 'characters' },
};

/**
 * Dangerous control characters that should be rejected in identifiers.
 * Includes:
 * - NULL byte (0x00)
 * - Control characters (0x01-0x1F, 0x7F)
 * - Bidirectional text override characters (security risk)
 */
// eslint-disable-next-line no-control-regex
const DANGEROUS_CHAR_PATTERN = /[\x00-\x1F\x7F\u202A-\u202E\u2066-\u2069]/;

/**
 * Result of identifier validation.
 */
export interface IdentifierValidationResult {
  /** Whether the identifier is valid */
  valid: boolean;
  /** The identifier that was validated */
  identifier: string;
  /** The dialect used for validation */
  dialect: SqlDialect;
  /** Whether the identifier needs quoting */
  needsQuoting: boolean;
  /** Whether the identifier is a reserved keyword */
  isReservedKeyword: boolean;
  /** Byte length of the identifier (UTF-8) */
  byteLength: number;
  /** Character length of the identifier */
  charLength: number;
}

/**
 * Validate an identifier for the given SQL dialect.
 *
 * Validates:
 * - Not empty or whitespace-only
 * - Does not exceed maximum length for the dialect
 * - Does not contain dangerous control characters
 * - Does not contain bidirectional override characters (security risk)
 *
 * @param identifier - The identifier to validate
 * @param dialect - The SQL dialect to validate against
 * @returns Validation result with details
 * @throws InvalidIdentifierError if the identifier is empty, whitespace-only, or contains dangerous characters
 * @throws IdentifierTooLongError if the identifier exceeds the maximum length for the dialect
 */
export function validateIdentifier(identifier: string, dialect: SqlDialect): IdentifierValidationResult {
  // Check for empty identifier
  if (!identifier || identifier.length === 0) {
    throw new InvalidIdentifierError(identifier, 'Identifier cannot be empty.');
  }

  // Check for whitespace-only identifier
  if (identifier.trim() === '') {
    throw new InvalidIdentifierError(identifier, 'Identifier cannot be whitespace-only.');
  }

  // Check for dangerous control characters (including null bytes and bidi overrides)
  if (DANGEROUS_CHAR_PATTERN.test(identifier)) {
    throw new InvalidIdentifierError(identifier, 'Identifier contains dangerous control characters.');
  }

  // Calculate lengths
  // Use Buffer.byteLength for UTF-8 byte count
  const byteLength = Buffer.byteLength(identifier, 'utf8');
  // Use spread operator to properly count Unicode code points (not UTF-16 code units)
  const charLength = [...identifier].length;

  // Check length limits by dialect
  const lengthConfig = MAX_IDENTIFIER_LENGTH[dialect];
  const actualLength = lengthConfig.unit === 'bytes' ? byteLength : charLength;

  if (actualLength > lengthConfig.max) {
    throw new IdentifierTooLongError(identifier, dialect, lengthConfig.max, actualLength, lengthConfig.unit);
  }

  // Determine if it needs quoting and if it's a keyword
  const isKeyword = isReservedKeyword(identifier);
  const requiresQuoting = needsQuoting(identifier);

  return {
    valid: true,
    identifier,
    dialect,
    needsQuoting: requiresQuoting,
    isReservedKeyword: isKeyword,
    byteLength,
    charLength,
  };
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
      name: SYSTEM_COLUMNS.$id.name,
      type: types.stringType,
      nullable: SYSTEM_COLUMNS.$id.nullable,
      primaryKey: SYSTEM_COLUMNS.$id.primaryKey,
    },
    {
      name: SYSTEM_COLUMNS.$type.name,
      type: types.stringType,
      nullable: SYSTEM_COLUMNS.$type.nullable,
    },
    {
      name: SYSTEM_COLUMNS.$version.name,
      type: types.intType,
      nullable: SYSTEM_COLUMNS.$version.nullable,
      default: String(SYSTEM_COLUMNS.$version.defaultValue),
    },
    {
      name: SYSTEM_COLUMNS.$createdAt.name,
      type: types.bigintType,
      nullable: SYSTEM_COLUMNS.$createdAt.nullable,
    },
    {
      name: SYSTEM_COLUMNS.$updatedAt.name,
      type: types.bigintType,
      nullable: SYSTEM_COLUMNS.$updatedAt.nullable,
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

// =============================================================================
// Foreign Key Re-exports
// =============================================================================

export {
  extractForeignKeys,
  serializeForeignKey,
  type ForeignKeyDefinition,
  type ReferentialAction,
  type ExtractForeignKeysOptions,
} from './foreign-keys.js';

// =============================================================================
// DDL Serialization Re-exports
// =============================================================================

export {
  serializeDDL,
  type DDLStructure,
  type ForeignKey,
  type ForeignKeyAction,
  type CheckConstraint,
} from './serialize.js';
