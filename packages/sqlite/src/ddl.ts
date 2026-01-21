/**
 * SQLite DDL Generation Helpers
 *
 * Provides utilities for generating SQLite DDL statements from
 * IceType schemas.
 *
 * @packageDocumentation
 */

import type { FieldDefinition } from '@icetype/core';

import type {
  SQLiteColumn,
  SQLiteDDL,
  SQLiteTypeMapping,
} from './types.js';

import { ICETYPE_TO_SQLITE } from './types.js';

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
 * Convert an IceType field definition to a SQLite column definition.
 *
 * @param fieldName - The field name
 * @param field - The IceType field definition
 * @returns The SQLite column definition
 */
export function fieldToSQLiteColumn(
  fieldName: string,
  field: FieldDefinition
): SQLiteColumn {
  const typeMapping = mapIceTypeToSQLite(field.type, field);
  let typeString = getSQLiteTypeString(typeMapping);

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

  return column;
}

/**
 * Format a default value as a SQL expression.
 *
 * @param value - The default value
 * @param type - The SQLite type
 * @returns The SQL expression string
 */
export function formatDefaultValue(value: unknown, _type: string): string {
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
    // SQLite uses 0/1 for boolean
    return value ? '1' : '0';
  }

  if (value instanceof Date) {
    // Store as ISO8601 string
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
// System Fields
// =============================================================================

/**
 * Generate system field columns for SQLite tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table.
 *
 * @returns Array of system column definitions
 */
export function generateSystemColumns(): SQLiteColumn[] {
  return [
    {
      name: '$id',
      type: 'TEXT',
      nullable: false,
      primaryKey: true,
    },
    {
      name: '$type',
      type: 'TEXT',
      nullable: false,
    },
    {
      name: '$version',
      type: 'INTEGER',
      nullable: false,
      default: '1',
    },
    {
      name: '$createdAt',
      type: 'INTEGER',
      nullable: false,
    },
    {
      name: '$updatedAt',
      type: 'INTEGER',
      nullable: false,
    },
  ];
}

// =============================================================================
// DDL Serialization
// =============================================================================

/**
 * Escape an identifier for SQLite SQL.
 *
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
  // Check if identifier needs escaping
  const isSimpleIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
  const startsWithDollar = identifier.startsWith('$');

  // If it's a simple identifier without special conditions, return as-is
  if (isSimpleIdentifier && !startsWithDollar) {
    return identifier;
  }

  // SQLite uses double quotes
  const escaped = identifier.replace(/"/g, '""');
  return `"${escaped}"`;
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

  // Column definitions
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
