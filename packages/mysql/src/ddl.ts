/**
 * MySQL DDL Generation Helpers
 *
 * Provides utilities for generating MySQL DDL statements from
 * IceType schemas.
 *
 * @packageDocumentation
 */

import type { FieldDefinition } from '@icetype/core';
import {
  escapeIdentifier as escapeIdentifierCommon,
  formatDefaultValue as formatDefaultValueCommon,
  generateSystemColumns as generateSystemColumnsCommon,
  validateSchemaName,
  type SqlColumn,
} from '@icetype/sql-common';

import type {
  MySQLColumn,
  MySQLDDL,
  MySQLTypeMapping,
} from './types.js';

import { ICETYPE_TO_MYSQL } from './types.js';

// Re-export validateSchemaName for use in the adapter
export { validateSchemaName };

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
 * Escape an identifier for MySQL SQL.
 *
 * MySQL uses backticks for identifier quoting.
 * This is a wrapper around the sql-common escapeIdentifier with 'mysql' dialect.
 *
 * @param identifier - The identifier to escape
 * @returns The escaped identifier
 */
export function escapeIdentifier(identifier: string): string {
  return escapeIdentifierCommon(identifier, 'mysql');
}

/**
 * Format a default value as a SQL expression for MySQL.
 *
 * This is a wrapper around the sql-common formatDefaultValue.
 *
 * @param value - The default value
 * @param type - The MySQL type
 * @returns The SQL expression string
 */
export function formatDefaultValue(value: unknown, type: string): string {
  return formatDefaultValueCommon(value, type, 'mysql');
}

/**
 * Generate system field columns for MySQL tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table. This wraps the sql-common generateSystemColumns with
 * 'mysql' dialect and converts to MySQLColumn format.
 *
 * @returns Array of system column definitions
 */
export function generateSystemColumns(): MySQLColumn[] {
  const sqlColumns = generateSystemColumnsCommon('mysql');
  return sqlColumns.map((col: SqlColumn): MySQLColumn => ({
    name: col.name,
    type: col.type,
    nullable: col.nullable,
    default: col.default,
    primaryKey: col.primaryKey,
    unique: col.unique,
    precision: col.precision,
    scale: col.scale,
  }));
}

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

// =============================================================================
// DDL Serialization
// =============================================================================

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
