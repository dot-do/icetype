/**
 * MySQL DDL Generation Helpers
 *
 * Provides utilities for generating MySQL DDL statements from
 * IceType schemas.
 *
 * @packageDocumentation
 */

import type { FieldDefinition } from '@icetype/core';

import type {
  MySQLColumn,
  MySQLDDL,
  MySQLTypeMapping,
} from './types.js';

import { ICETYPE_TO_MYSQL } from './types.js';

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * Map an IceType primitive type to a MySQL type.
 *
 * @param iceType - The IceType type string
 * @param field - Optional field definition for additional type info
 * @returns The MySQL type mapping
 */
export function mapIceTypeToMySQL(
  iceType: string,
  field?: FieldDefinition
): MySQLTypeMapping {
  const normalized = iceType.toLowerCase();
  const mapping = ICETYPE_TO_MYSQL[normalized];

  if (mapping) {
    // Handle decimal with custom precision/scale from field
    if (normalized === 'decimal' && field) {
      return {
        mysqlType: 'DECIMAL',
        precision: field.precision ?? mapping.precision,
        scale: field.scale ?? mapping.scale,
      };
    }
    return mapping;
  }

  // Default to VARCHAR(255) for unknown types
  return { mysqlType: 'VARCHAR', length: 255 };
}

/**
 * Get the full MySQL type string including parameters.
 *
 * @param mapping - The type mapping
 * @returns The full type string (e.g., "DECIMAL(38, 9)")
 */
export function getMySQLTypeString(mapping: MySQLTypeMapping): string {
  if (mapping.mysqlType === 'DECIMAL' && mapping.precision !== undefined) {
    const scale = mapping.scale ?? 0;
    return `DECIMAL(${mapping.precision}, ${scale})`;
  }
  if (mapping.length !== undefined) {
    return `${mapping.mysqlType}(${mapping.length})`;
  }
  return mapping.mysqlType;
}

// =============================================================================
// Column Generation
// =============================================================================

/**
 * Convert an IceType field definition to a MySQL column definition.
 *
 * @param fieldName - The field name
 * @param field - The IceType field definition
 * @returns The MySQL column definition
 */
export function fieldToMySQLColumn(
  fieldName: string,
  field: FieldDefinition
): MySQLColumn {
  const typeMapping = mapIceTypeToMySQL(field.type, field);
  let typeString = getMySQLTypeString(typeMapping);

  // Handle relation fields - store as foreign key reference (VARCHAR)
  if (field.relation) {
    typeString = 'VARCHAR(255)';
  }

  const column: MySQLColumn = {
    name: fieldName,
    type: typeString,
    nullable: field.isOptional || field.modifier === '?',
    unique: field.isUnique || field.modifier === '#',
  };

  // Add precision/scale for decimal
  if (typeMapping.precision !== undefined) {
    column.precision = typeMapping.precision;
    column.scale = typeMapping.scale;
  }

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
 * @param type - The MySQL type
 * @returns The SQL expression string
 */
export function formatDefaultValue(value: unknown, type: string): string {
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
    return value ? 'TRUE' : 'FALSE';
  }

  if (value instanceof Date) {
    // For DATE types (not DATETIME), return only the date portion
    if (type.toUpperCase().includes('DATE') && !type.toUpperCase().includes('DATETIME')) {
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
// System Fields
// =============================================================================

/**
 * Generate system field columns for MySQL tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table.
 *
 * @returns Array of system column definitions
 */
export function generateSystemColumns(): MySQLColumn[] {
  return [
    {
      name: '$id',
      type: 'VARCHAR(255)',
      nullable: false,
      primaryKey: true,
    },
    {
      name: '$type',
      type: 'VARCHAR(255)',
      nullable: false,
    },
    {
      name: '$version',
      type: 'INT',
      nullable: false,
      default: '1',
    },
    {
      name: '$createdAt',
      type: 'BIGINT',
      nullable: false,
    },
    {
      name: '$updatedAt',
      type: 'BIGINT',
      nullable: false,
    },
  ];
}

// =============================================================================
// DDL Serialization
// =============================================================================

/**
 * Escape an identifier for MySQL SQL.
 *
 * MySQL uses backticks for identifier quoting.
 *
 * Identifiers are escaped (wrapped in backticks) if they:
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

  // MySQL uses backticks
  const escaped = identifier.replace(/`/g, '``');
  return `\`${escaped}\``;
}

/**
 * Serialize a column definition to a DDL fragment.
 *
 * @param column - The column definition
 * @returns The DDL column fragment
 */
export function serializeColumn(column: MySQLColumn): string {
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

  if (column.autoIncrement) {
    parts.push('AUTO_INCREMENT');
  }

  if (column.default !== undefined) {
    parts.push(`DEFAULT ${column.default}`);
  }

  return parts.join(' ');
}

/**
 * Serialize a MySQL DDL structure to a CREATE TABLE statement.
 *
 * @param ddl - The DDL structure
 * @returns The CREATE TABLE SQL statement
 */
export function serializeDDL(ddl: MySQLDDL): string {
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

  // Primary key constraint
  if (ddl.primaryKey && ddl.primaryKey.length > 0) {
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

  // Engine (default to InnoDB)
  const engine = ddl.engine ?? 'InnoDB';
  tableOptions.push(`ENGINE=${engine}`);

  // Character set
  if (ddl.charset) {
    tableOptions.push(`CHARACTER SET ${ddl.charset}`);
  }

  // Collation
  if (ddl.collation) {
    tableOptions.push(`COLLATE ${ddl.collation}`);
  }

  // Comment
  if (ddl.comment) {
    const escapedComment = ddl.comment.replace(/'/g, "''");
    tableOptions.push(`COMMENT='${escapedComment}'`);
  }

  if (tableOptions.length > 0) {
    lines[lines.length - 1] += ' ' + tableOptions.join(' ');
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
  columns: MySQLColumn[]
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
