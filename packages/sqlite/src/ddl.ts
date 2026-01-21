/**
 * SQLite DDL Generation Helpers
 *
 * Provides utilities for generating SQLite DDL statements from
 * IceType schemas.
 *
 * @packageDocumentation
 */

import type { Brand, FieldDefinition } from '@icetype/core';
import {
  escapeIdentifier as sqlCommonEscapeIdentifier,
  formatDefaultValue as sqlCommonFormatDefaultValue,
  generateSystemColumns as sqlCommonGenerateSystemColumns,
  type SqlColumn,
} from '@icetype/sql-common';

import type {
  SQLiteColumn,
  SQLiteDDL,
  SQLiteTypeMapping,
} from './types.js';

import { ICETYPE_TO_SQLITE } from './types.js';

// =============================================================================
// Array Type Detection
// =============================================================================

/**
 * Branded type for array type strings (strings ending with `[]`).
 * Use isArrayType() to narrow a string to this type.
 * Uses the reusable Brand<T, B> pattern for consistent nominal typing.
 */
export type ArrayTypeString = Brand<string, 'ArrayTypeString'>;

/**
 * Check if a field type string represents an array type.
 *
 * Array types are denoted by `[]` suffix (e.g., `string[]`, `int[]`).
 * This is a type guard that narrows the string to ArrayTypeString.
 *
 * Note: When working with parsed FieldDefinition objects, use the
 * `field.isArray` property instead for accurate detection, since
 * the parser strips the `[]` suffix and sets `isArray: true`.
 *
 * @param fieldType - The IceType field type string
 * @returns True if the type string ends with `[]`
 *
 * @example
 * ```typescript
 * const type = 'string[]';
 * if (isArrayType(type)) {
 *   // TypeScript knows type is ArrayTypeString
 *   const elementType = type.slice(0, -2); // Extract element type
 * }
 * ```
 */
export function isArrayType(fieldType: string): fieldType is ArrayTypeString {
  // Must have at least one character before []
  return fieldType.length > 2 && fieldType.endsWith('[]');
}

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * Map an IceType primitive type to a SQLite type.
 *
 * @param iceType - The IceType type string
 * @param _field - Optional field definition (unused for SQLite, kept for API consistency)
 * @returns The SQLite type mapping
 */
export function mapIceTypeToSQLite(
  iceType: string,
  _field?: FieldDefinition
): SQLiteTypeMapping {
  const normalized = iceType.toLowerCase();
  const mapping = ICETYPE_TO_SQLITE[normalized];

  if (mapping) {
    return mapping;
  }

  // Default to TEXT for unknown types
  return { sqliteType: 'TEXT' };
}

/**
 * Get the SQLite type string.
 *
 * SQLite uses only storage classes (INTEGER, REAL, TEXT, BLOB)
 * without parameters.
 *
 * @param mapping - The type mapping
 * @returns The type string (e.g., "TEXT", "INTEGER")
 */
export function getSQLiteTypeString(mapping: SQLiteTypeMapping): string {
  return mapping.sqliteType;
}

// =============================================================================
// Column Generation
// =============================================================================

/**
 * Warning message generated during DDL transformation.
 */
export interface DDLWarning {
  /** The field name that triggered the warning */
  fieldName: string;
  /** Warning message */
  message: string;
  /** Warning code for programmatic handling */
  code: string;
}

/**
 * Result of converting an IceType field to a SQLite column.
 */
export interface FieldToColumnResult {
  /** The SQLite column definition */
  column: SQLiteColumn;
  /** Any warnings generated during conversion */
  warning?: DDLWarning;
}

/**
 * Convert an IceType field definition to a SQLite column definition.
 *
 * @param fieldName - The field name
 * @param field - The IceType field definition
 * @returns The SQLite column definition and any warnings
 */
export function fieldToSQLiteColumn(
  fieldName: string,
  field: FieldDefinition
): FieldToColumnResult {
  let warning: DDLWarning | undefined;
  let typeString: string;

  // Check if this is an array type using the parsed isArray property
  // The parser strips [] from the type and sets isArray: true
  if (field.isArray) {
    // SQLite doesn't have native array support - store as JSON in TEXT
    typeString = 'TEXT';
    const arrayTypeName = `${field.type}[]`;
    warning = {
      fieldName,
      message: `SQLite does not have native array support. Array type '${arrayTypeName}' will be stored as JSON in a TEXT column. Use JSON functions (json_each, json_extract, etc.) to query array data.`,
      code: 'SQLITE_ARRAY_AS_JSON',
    };
  } else {
    const typeMapping = mapIceTypeToSQLite(field.type, field);
    typeString = getSQLiteTypeString(typeMapping);
  }

  // Handle relation fields - store as foreign key reference (TEXT)
  if (field.relation) {
    typeString = 'TEXT';
  }

  const column: SQLiteColumn = {
    name: fieldName,
    type: typeString,
    nullable: field.isOptional || field.modifier === '?',
    unique: field.isUnique || field.modifier === '#',
  };

  // Handle default value
  if (field.defaultValue !== undefined) {
    column.default = formatDefaultValue(field.defaultValue, typeString);
  }

  return { column, warning };
}

/**
 * Format a default value as a SQL expression for SQLite.
 *
 * Uses the shared sql-common formatDefaultValue with SQLite dialect.
 *
 * @param value - The default value
 * @param type - The SQLite type
 * @returns The SQL expression string
 */
export function formatDefaultValue(value: unknown, type: string): string {
  return sqlCommonFormatDefaultValue(value, type, 'sqlite');
}

// =============================================================================
// System Fields
// =============================================================================

/**
 * Generate system field columns for SQLite tables.
 *
 * Uses the shared sql-common generateSystemColumns with SQLite dialect.
 * These are the standard IceType system fields that should be included
 * in every table.
 *
 * @returns Array of system column definitions
 */
export function generateSystemColumns(): SQLiteColumn[] {
  // Get columns from sql-common and convert to SQLiteColumn format
  const columns = sqlCommonGenerateSystemColumns('sqlite');
  return columns.map((col: SqlColumn): SQLiteColumn => ({
    name: col.name,
    type: col.type,
    nullable: col.nullable,
    primaryKey: col.primaryKey,
    default: col.default,
  }));
}

// =============================================================================
// DDL Serialization
// =============================================================================

/**
 * Escape an identifier for SQLite SQL.
 *
 * Uses the shared sql-common escapeIdentifier with SQLite dialect.
 * SQLite uses double quotes for identifier quoting.
 *
 * Identifiers are escaped (wrapped in double quotes) if they:
 * - Contain special characters (anything besides letters, digits, underscore)
 * - Start with a digit
 * - Start with $ (system fields)
 * - Are SQL reserved keywords
 *
 * @param identifier - The identifier to escape
 * @returns The escaped identifier
 */
export function escapeIdentifier(identifier: string): string {
  return sqlCommonEscapeIdentifier(identifier, 'sqlite');
}

/**
 * Serialize a column definition to a DDL fragment.
 *
 * @param column - The column definition
 * @returns The DDL column fragment
 */
export function serializeColumn(column: SQLiteColumn): string {
  const parts: string[] = [
    escapeIdentifier(column.name),
    column.type,
  ];

  if (!column.nullable) {
    parts.push('NOT NULL');
  }

  if (column.unique) {
    parts.push('UNIQUE');
  }

  // PRIMARY KEY and AUTOINCREMENT must come together for INTEGER columns
  if (column.primaryKey) {
    parts.push('PRIMARY KEY');
    if (column.autoIncrement && column.type === 'INTEGER') {
      parts.push('AUTOINCREMENT');
    }
  }

  if (column.default !== undefined) {
    parts.push(`DEFAULT ${column.default}`);
  }

  return parts.join(' ');
}

/**
 * Serialize a SQLite DDL structure to a CREATE TABLE statement.
 *
 * Note: SQLite uses its own implementation instead of the shared serializeDDL
 * because SQLite has unique column-level features (inline PRIMARY KEY with
 * AUTOINCREMENT) that require custom column serialization.
 *
 * @param ddl - The DDL structure
 * @returns The CREATE TABLE SQL statement
 */
export function serializeDDL(ddl: SQLiteDDL): string {
  const lines: string[] = [];

  // CREATE TABLE header
  let header = 'CREATE TABLE';
  if (ddl.ifNotExists) {
    header += ' IF NOT EXISTS';
  }

  // Table name
  const tableName = escapeIdentifier(ddl.tableName);
  header += ` ${tableName} (`;
  lines.push(header);

  // Column definitions (using SQLite-specific serializeColumn)
  const columnDefs = ddl.columns.map(col => `  ${serializeColumn(col)}`);

  // Primary key constraint (only if not defined inline on a column)
  const hasInlinePrimaryKey = ddl.columns.some(col => col.primaryKey);
  if (ddl.primaryKey && ddl.primaryKey.length > 0 && !hasInlinePrimaryKey) {
    const pkCols = ddl.primaryKey.map(escapeIdentifier).join(', ');
    columnDefs.push(`  PRIMARY KEY (${pkCols})`);
  }

  // Unique constraints
  if (ddl.uniqueConstraints) {
    for (const uniqueCols of ddl.uniqueConstraints) {
      const cols = uniqueCols.map(escapeIdentifier).join(', ');
      columnDefs.push(`  UNIQUE (${cols})`);
    }
  }

  // Check constraints
  if (ddl.checkConstraints) {
    for (const check of ddl.checkConstraints) {
      if (check.name) {
        columnDefs.push(`  CONSTRAINT ${escapeIdentifier(check.name)} CHECK (${check.expression})`);
      } else {
        columnDefs.push(`  CHECK (${check.expression})`);
      }
    }
  }

  // Foreign key constraints
  if (ddl.foreignKeys) {
    for (const fk of ddl.foreignKeys) {
      const fkCols = fk.columns.map(escapeIdentifier).join(', ');
      const refTable = escapeIdentifier(fk.references.table);
      const refCols = fk.references.columns.map(escapeIdentifier).join(', ');

      let fkDef = `  FOREIGN KEY (${fkCols}) REFERENCES ${refTable} (${refCols})`;

      if (fk.onDelete) {
        fkDef += ` ON DELETE ${fk.onDelete}`;
      }
      if (fk.onUpdate) {
        fkDef += ` ON UPDATE ${fk.onUpdate}`;
      }

      columnDefs.push(fkDef);
    }
  }

  lines.push(columnDefs.join(',\n'));
  lines.push(')');

  // Table options
  const tableOptions: string[] = [];

  // WITHOUT ROWID
  if (ddl.withoutRowid) {
    tableOptions.push('WITHOUT ROWID');
  }

  // STRICT mode (SQLite 3.37+)
  if (ddl.strict) {
    tableOptions.push('STRICT');
  }

  if (tableOptions.length > 0) {
    lines[lines.length - 1] += ' ' + tableOptions.join(', ');
  }

  lines[lines.length - 1] += ';';

  return lines.join('\n');
}

/**
 * Generate index DDL statements for indexed fields.
 *
 * @param tableName - The table name
 * @param columns - The columns to potentially index
 * @returns Array of CREATE INDEX statements
 */
export function generateIndexStatements(
  tableName: string,
  columns: SQLiteColumn[]
): string[] {
  const statements: string[] = [];
  const escapedTableName = escapeIdentifier(tableName);

  for (const column of columns) {
    // Create indexes for unique columns
    if (column.unique) {
      // Replace $ with _ in index name to avoid issues
      const indexName = `idx_${tableName}_${column.name}`.replace(/\$/g, '_');
      statements.push(
        `CREATE INDEX ${escapeIdentifier(indexName)} ON ${escapedTableName} (${escapeIdentifier(column.name)});`
      );
    }
  }

  return statements;
}
