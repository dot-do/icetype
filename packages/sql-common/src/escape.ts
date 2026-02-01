/**
 * SQL Identifier Escaping and Validation
 *
 * This module contains shared identifier escaping and validation functions
 * that are used across all sql-common modules to avoid circular dependencies.
 *
 * @packageDocumentation
 */

import type { SqlDialect } from './types.js';

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
export function needsQuoting(identifier: string): boolean {
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
