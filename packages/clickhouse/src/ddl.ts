/**
 * ClickHouse DDL Generation Helpers
 *
 * Provides utilities for generating ClickHouse DDL statements
 * from ClickHouseDDL structures.
 *
 * Uses @icetype/sql-common for shared SQL utilities like identifier
 * escaping, default value formatting, system column generation, and
 * column serialization.
 *
 * @packageDocumentation
 */

import {
  escapeIdentifier as escapeIdentifierBase,
  formatDefaultValue as formatDefaultValueBase,
  generateSystemColumns as generateSystemColumnsBase,
  serializeColumn as serializeColumnBase,
  type SqlColumn,
} from '@icetype/sql-common';

import type {
  ClickHouseDDL,
  ClickHouseColumn,
  ClickHouseEngine,
} from './types.js';

// =============================================================================
// Re-exports from sql-common (bound to ClickHouse dialect)
// =============================================================================

/**
 * Escape a ClickHouse identifier (table/column name).
 *
 * Uses backticks for identifiers that contain special characters,
 * start with $ (system fields), or start with a number.
 *
 * @param identifier - The identifier to escape
 * @returns The escaped identifier
 */
export function escapeIdentifier(identifier: string): string {
  return escapeIdentifierBase(identifier, 'clickhouse');
}

/**
 * Format a default value as a SQL expression for ClickHouse.
 *
 * @param value - The default value
 * @param type - The ClickHouse type
 * @returns The SQL expression string
 */
export function formatDefaultValue(value: unknown, type: string): string {
  return formatDefaultValueBase(value, type);
}

/**
 * Generate system field columns for ClickHouse tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table:
 * - $id: Primary key identifier (String)
 * - $type: Entity type name (String)
 * - $version: Row version for optimistic locking (Int32)
 * - $createdAt: Creation timestamp as BIGINT epoch ms (Int64)
 * - $updatedAt: Last update timestamp as BIGINT epoch ms (Int64)
 *
 * @returns Array of system column definitions
 */
export function generateSystemColumns(): ClickHouseColumn[] {
  return generateSystemColumnsBase('clickhouse') as ClickHouseColumn[];
}

/**
 * Serialize a column definition to a DDL fragment for ClickHouse.
 *
 * Generates a column definition string like:
 * "column_name TYPE NOT NULL UNIQUE DEFAULT value"
 *
 * @param column - The column definition
 * @returns The DDL column fragment
 */
export function serializeColumn(column: SqlColumn): string {
  return serializeColumnBase(column, 'clickhouse');
}

/**
 * Escape a string value for ClickHouse.
 *
 * @param value - The string value to escape
 * @returns The escaped string with single quotes
 */
export function escapeString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// =============================================================================
// Settings Escaping
// =============================================================================

/**
 * Error thrown when a setting key is invalid.
 */
export class InvalidSettingKeyError extends Error {
  constructor(key: string) {
    super(`Invalid setting key: "${key}". Setting keys must contain only alphanumeric characters and underscores, and must start with a letter or underscore.`);
    this.name = 'InvalidSettingKeyError';
  }
}

/**
 * Error thrown when a setting value is invalid.
 */
export class InvalidSettingValueError extends Error {
  constructor(value: unknown) {
    super(`Invalid setting value: ${JSON.stringify(value)}. Setting values must be strings, numbers, or booleans.`);
    this.name = 'InvalidSettingValueError';
  }
}

/**
 * Validate and escape a ClickHouse setting key.
 *
 * Setting keys must contain only alphanumeric characters and underscores,
 * and must start with a letter or underscore (not a number).
 *
 * @param key - The setting key to validate/escape
 * @returns The validated setting key
 * @throws InvalidSettingKeyError if the key contains invalid characters
 */
export function escapeSettingKey(key: string): string {
  // Setting keys must:
  // - Be non-empty
  // - Contain only alphanumeric characters and underscores
  // - Start with a letter or underscore (not a number)
  if (!key || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
    throw new InvalidSettingKeyError(key);
  }
  return key;
}

/**
 * Escape a ClickHouse setting value.
 *
 * Handles the following value types:
 * - Numbers: returned as-is
 * - Booleans: converted to 0 or 1
 * - Strings: escaped with single quotes (handling embedded quotes)
 *
 * @param value - The setting value to escape
 * @returns The escaped setting value
 * @throws InvalidSettingValueError if the value type is not supported
 */
export function escapeSettingValue(value: string | number | boolean): string {
  if (typeof value === 'number') {
    // Validate it's a finite number
    if (!Number.isFinite(value)) {
      throw new InvalidSettingValueError(value);
    }
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (typeof value === 'string') {
    // If the value looks like a number, return it as-is
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return value;
    }
    // If it's already quoted, validate and return (after checking for injection)
    if (value.startsWith("'") && value.endsWith("'")) {
      // Check for unescaped quotes inside
      const inner = value.slice(1, -1);
      // Re-escape to ensure safety
      return `'${inner.replace(/'/g, "''")}'`;
    }
    // Escape as a string
    return `'${value.replace(/'/g, "''")}'`;
  }

  throw new InvalidSettingValueError(value);
}

// =============================================================================
// Column DDL Generation
// =============================================================================

/**
 * Generate the DDL for a single column definition.
 *
 * @param column - The column definition
 * @returns The column DDL string
 */
export function generateColumnDDL(column: ClickHouseColumn): string {
  const parts: string[] = [escapeIdentifier(column.name)];

  // Type with nullable wrapper if needed
  parts.push(column.type);

  // Default value
  if (column.default !== undefined) {
    parts.push('DEFAULT', column.default);
  }

  // Codec
  if (column.codec) {
    parts.push(`CODEC(${column.codec})`);
  }

  // TTL
  if (column.ttl) {
    parts.push('TTL', column.ttl);
  }

  // Comment
  if (column.comment) {
    parts.push('COMMENT', escapeString(column.comment));
  }

  return parts.join(' ');
}

// =============================================================================
// Engine DDL Generation
// =============================================================================

/**
 * Generate the ENGINE clause for a table.
 *
 * @param ddl - The DDL structure
 * @returns The ENGINE clause string
 */
export function generateEngineDDL(ddl: ClickHouseDDL): string {
  const engine = ddl.engine;
  const parts: string[] = ['ENGINE ='];

  switch (engine) {
    case 'ReplacingMergeTree':
      if (ddl.versionColumn) {
        parts.push(`ReplacingMergeTree(${escapeIdentifier(ddl.versionColumn)})`);
      } else {
        parts.push('ReplacingMergeTree()');
      }
      break;

    case 'SummingMergeTree':
      if (ddl.sumColumns && ddl.sumColumns.length > 0) {
        const cols = ddl.sumColumns.map(escapeIdentifier).join(', ');
        parts.push(`SummingMergeTree(${cols})`);
      } else {
        parts.push('SummingMergeTree()');
      }
      break;

    case 'AggregatingMergeTree':
      parts.push('AggregatingMergeTree()');
      break;

    case 'CollapsingMergeTree':
      if (ddl.signColumn) {
        parts.push(`CollapsingMergeTree(${escapeIdentifier(ddl.signColumn)})`);
      } else {
        parts.push('CollapsingMergeTree(sign)');
      }
      break;

    case 'MergeTree':
    default:
      parts.push('MergeTree()');
      break;
  }

  return parts.join(' ');
}

// =============================================================================
// Full DDL Generation
// =============================================================================

/**
 * Generate a complete CREATE TABLE DDL statement.
 *
 * @param ddl - The DDL structure
 * @returns The complete DDL statement
 */
export function generateCreateTableDDL(ddl: ClickHouseDDL): string {
  const lines: string[] = [];

  // CREATE TABLE line
  const tableNameParts: string[] = [];
  if (ddl.database) {
    tableNameParts.push(escapeIdentifier(ddl.database));
  }
  tableNameParts.push(escapeIdentifier(ddl.tableName));
  const fullTableName = tableNameParts.join('.');

  let createLine = 'CREATE TABLE';
  if (ddl.ifNotExists) {
    createLine += ' IF NOT EXISTS';
  }
  createLine += ` ${fullTableName}`;
  lines.push(createLine);

  // Opening parenthesis
  lines.push('(');

  // Column definitions
  const columnDDLs = ddl.columns.map((col) => `    ${generateColumnDDL(col)}`);
  lines.push(columnDDLs.join(',\n'));

  // Closing parenthesis
  lines.push(')');

  // ENGINE clause
  lines.push(generateEngineDDL(ddl));

  // PARTITION BY clause
  if (ddl.partitionBy) {
    lines.push(`PARTITION BY ${ddl.partitionBy}`);
  }

  // PRIMARY KEY clause (if different from ORDER BY)
  if (ddl.primaryKey && ddl.primaryKey.length > 0) {
    const pkCols = ddl.primaryKey.map(escapeIdentifier).join(', ');
    lines.push(`PRIMARY KEY (${pkCols})`);
  }

  // ORDER BY clause
  if (ddl.orderBy && ddl.orderBy.length > 0) {
    const orderCols = ddl.orderBy.map(escapeIdentifier).join(', ');
    lines.push(`ORDER BY (${orderCols})`);
  } else {
    // MergeTree family requires ORDER BY
    lines.push('ORDER BY tuple()');
  }

  // TTL clause
  if (ddl.ttl) {
    lines.push(`TTL ${ddl.ttl}`);
  }

  // SETTINGS clause
  if (ddl.settings && Object.keys(ddl.settings).length > 0) {
    const settingsParts: string[] = [];
    for (const [key, value] of Object.entries(ddl.settings)) {
      const escapedKey = escapeSettingKey(key);
      const escapedValue = escapeSettingValue(value);
      settingsParts.push(`${escapedKey} = ${escapedValue}`);
    }
    lines.push(`SETTINGS ${settingsParts.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Generate a DROP TABLE DDL statement.
 *
 * @param tableName - The table name
 * @param database - Optional database name
 * @param ifExists - Whether to add IF EXISTS
 * @returns The DROP TABLE statement
 */
export function generateDropTableDDL(
  tableName: string,
  database?: string,
  ifExists = true
): string {
  const tableNameParts: string[] = [];
  if (database) {
    tableNameParts.push(escapeIdentifier(database));
  }
  tableNameParts.push(escapeIdentifier(tableName));
  const fullTableName = tableNameParts.join('.');

  let ddl = 'DROP TABLE';
  if (ifExists) {
    ddl += ' IF EXISTS';
  }
  ddl += ` ${fullTableName}`;

  return ddl;
}

/**
 * Generate an ALTER TABLE ADD COLUMN DDL statement.
 *
 * @param tableName - The table name
 * @param column - The column to add
 * @param database - Optional database name
 * @param after - Column name to add after
 * @returns The ALTER TABLE statement
 */
export function generateAddColumnDDL(
  tableName: string,
  column: ClickHouseColumn,
  database?: string,
  after?: string
): string {
  const tableNameParts: string[] = [];
  if (database) {
    tableNameParts.push(escapeIdentifier(database));
  }
  tableNameParts.push(escapeIdentifier(tableName));
  const fullTableName = tableNameParts.join('.');

  let ddl = `ALTER TABLE ${fullTableName} ADD COLUMN ${generateColumnDDL(column)}`;

  if (after) {
    ddl += ` AFTER ${escapeIdentifier(after)}`;
  }

  return ddl;
}

/**
 * Generate an ALTER TABLE DROP COLUMN DDL statement.
 *
 * @param tableName - The table name
 * @param columnName - The column to drop
 * @param database - Optional database name
 * @returns The ALTER TABLE statement
 */
export function generateDropColumnDDL(
  tableName: string,
  columnName: string,
  database?: string
): string {
  const tableNameParts: string[] = [];
  if (database) {
    tableNameParts.push(escapeIdentifier(database));
  }
  tableNameParts.push(escapeIdentifier(tableName));
  const fullTableName = tableNameParts.join('.');

  return `ALTER TABLE ${fullTableName} DROP COLUMN ${escapeIdentifier(columnName)}`;
}

/**
 * Validate a ClickHouse engine type.
 *
 * @param engine - The engine string to validate
 * @returns True if the engine is valid
 */
export function isValidEngine(engine: string): engine is ClickHouseEngine {
  const validEngines: ClickHouseEngine[] = [
    'MergeTree',
    'ReplacingMergeTree',
    'SummingMergeTree',
    'AggregatingMergeTree',
    'CollapsingMergeTree',
  ];
  return validEngines.includes(engine as ClickHouseEngine);
}

/**
 * Infer a reasonable ORDER BY clause from schema fields.
 *
 * Looks for common patterns like:
 * - id fields (uuid, id)
 * - timestamp fields (created_at, updated_at)
 * - indexed/unique fields
 *
 * @param ddl - The DDL structure
 * @returns Array of column names for ORDER BY
 */
export function inferOrderBy(ddl: ClickHouseDDL): string[] {
  const orderBy: string[] = [];

  // If already specified, use it
  if (ddl.orderBy && ddl.orderBy.length > 0) {
    return ddl.orderBy;
  }

  // Look for id or uuid column first
  for (const col of ddl.columns) {
    const name = col.name.toLowerCase();
    if (name === 'id' || col.type === 'UUID') {
      orderBy.push(col.name);
      break;
    }
  }

  // If no id found, look for a timestamp
  if (orderBy.length === 0) {
    for (const col of ddl.columns) {
      const name = col.name.toLowerCase();
      if (
        name.includes('created') ||
        name.includes('timestamp') ||
        col.type.includes('DateTime')
      ) {
        orderBy.push(col.name);
        break;
      }
    }
  }

  // If still nothing, use first column
  if (orderBy.length === 0 && ddl.columns.length > 0 && ddl.columns[0]) {
    orderBy.push(ddl.columns[0].name);
  }

  return orderBy;
}
