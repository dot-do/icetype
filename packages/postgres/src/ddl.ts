/**
 * PostgreSQL DDL Generation Helpers
 *
 * Provides utilities for generating PostgreSQL DDL statements from
 * IceType schemas. Compatible with postgres.do and Drizzle ORM.
 *
 * @packageDocumentation
 */

import type { FieldDefinition } from '@icetype/core';

import {
  escapeIdentifier as escapeIdentifierBase,
  formatDefaultValue as formatDefaultValueBase,
  serializeColumn as serializeColumnBase,
  generateSystemColumns as generateSystemColumnsBase,
  generateIndexStatements as generateIndexStatementsBase,
  type SqlColumn,
} from '@icetype/sql-common';

import type {
  PostgresColumn,
  PostgresDDL,
  PostgresTypeMapping,
} from './types.js';

import { ICETYPE_TO_POSTGRES } from './types.js';

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * Map an IceType primitive type to a PostgreSQL type.
 *
 * @param iceType - The IceType type string
 * @param field - Optional field definition for additional type info
 * @returns The PostgreSQL type mapping
 */
export function mapIceTypeToPostgres(
  iceType: string,
  field?: FieldDefinition
): PostgresTypeMapping {
  const normalized = iceType.toLowerCase();
  const mapping = ICETYPE_TO_POSTGRES[normalized];

  if (mapping) {
    // Handle decimal with custom precision/scale from field
    if (normalized === 'decimal' && field) {
      return {
        postgresType: 'DECIMAL',
        precision: field.precision ?? mapping.precision,
        scale: field.scale ?? mapping.scale,
      };
    }
    return mapping;
  }

  // Default to TEXT for unknown types
  return { postgresType: 'TEXT' };
}

/**
 * Get the full PostgreSQL type string including parameters.
 *
 * @param mapping - The type mapping
 * @returns The full type string (e.g., "DECIMAL(38, 9)")
 */
export function getPostgresTypeString(mapping: PostgresTypeMapping): string {
  if (mapping.postgresType === 'DECIMAL' && mapping.precision !== undefined) {
    const scale = mapping.scale ?? 0;
    return `DECIMAL(${mapping.precision}, ${scale})`;
  }
  if ((mapping.postgresType === 'VARCHAR' || mapping.postgresType === 'CHAR') && mapping.length !== undefined) {
    return `${mapping.postgresType}(${mapping.length})`;
  }
  return mapping.postgresType;
}

/**
 * Convert an IceType field to an array type in PostgreSQL.
 *
 * @param baseType - The base type string
 * @returns The array type string (e.g., "TEXT[]")
 */
export function toArrayType(baseType: string): string {
  return `${baseType}[]`;
}

// =============================================================================
// Column Generation
// =============================================================================

/**
 * Convert an IceType field definition to a PostgreSQL column definition.
 *
 * @param fieldName - The field name
 * @param field - The IceType field definition
 * @returns The PostgreSQL column definition
 */
export function fieldToPostgresColumn(
  fieldName: string,
  field: FieldDefinition
): PostgresColumn {
  const typeMapping = mapIceTypeToPostgres(field.type, field);
  let typeString = getPostgresTypeString(typeMapping);

  // Handle array types
  if (field.isArray) {
    typeString = toArrayType(typeString);
  }

  // Handle relation fields - store as foreign key reference (UUID/TEXT)
  if (field.relation) {
    if (field.isArray) {
      typeString = 'TEXT[]';
    } else {
      typeString = 'TEXT';
    }
  }

  const column: PostgresColumn = {
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
 * @param type - The PostgreSQL type
 * @returns The SQL expression string
 */
export function formatDefaultValue(value: unknown, type: string): string {
  return formatDefaultValueBase(value, type);
}

// =============================================================================
// System Fields
// =============================================================================

/**
 * Generate system field columns for PostgreSQL tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table.
 *
 * @returns Array of system column definitions
 */
export function generateSystemColumns(): PostgresColumn[] {
  // Use shared implementation and cast to PostgresColumn[]
  // The types are compatible since PostgresColumn extends SqlColumn's shape
  return generateSystemColumnsBase('postgres') as PostgresColumn[];
}

// =============================================================================
// DDL Serialization
// =============================================================================

/**
 * Escape an identifier for PostgreSQL SQL.
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
  return escapeIdentifierBase(identifier, 'postgres');
}

/**
 * Serialize a column definition to a DDL fragment.
 *
 * @param column - The column definition
 * @returns The DDL column fragment
 */
export function serializeColumn(column: PostgresColumn): string {
  return serializeColumnBase(column as SqlColumn, 'postgres');
}

/**
 * Serialize a PostgreSQL DDL structure to a CREATE TABLE statement.
 *
 * @param ddl - The DDL structure
 * @returns The CREATE TABLE SQL statement
 */
export function serializeDDL(ddl: PostgresDDL): string {
  const lines: string[] = [];

  // CREATE TABLE header
  let header = 'CREATE';
  if (ddl.unlogged) {
    header += ' UNLOGGED';
  }
  header += ' TABLE';
  if (ddl.ifNotExists) {
    header += ' IF NOT EXISTS';
  }

  // Table name with optional schema
  const tableName = ddl.schemaName
    ? `${escapeIdentifier(ddl.schemaName)}.${escapeIdentifier(ddl.tableName)}`
    : escapeIdentifier(ddl.tableName);

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
  lines.push(');');

  return lines.join('\n');
}

/**
 * Generate index DDL statements for indexed fields.
 *
 * @param tableName - The table name
 * @param schemaName - Optional schema name
 * @param columns - The columns to potentially index
 * @returns Array of CREATE INDEX statements
 */
export function generateIndexStatements(
  tableName: string,
  schemaName: string | undefined,
  columns: PostgresColumn[]
): string[] {
  return generateIndexStatementsBase(tableName, schemaName, columns as SqlColumn[], 'postgres');
}
