/**
 * DuckDB DDL Generation Helpers
 *
 * Provides utilities for generating DuckDB DDL statements from
 * IceType schemas.
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
  serializeDDL as serializeDDLBase,
  type SqlColumn,
  type DDLStructure,
} from '@icetype/sql-common';

import type {
  DuckDBColumn,
  DuckDBDDL,
  DuckDBTypeMapping,
} from './types.js';

import { ICETYPE_TO_DUCKDB } from './types.js';

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * Map an IceType primitive type to a DuckDB type.
 *
 * @param iceType - The IceType type string
 * @param field - Optional field definition for additional type info
 * @returns The DuckDB type mapping
 */
export function mapIceTypeToDuckDB(
  iceType: string,
  field?: FieldDefinition
): DuckDBTypeMapping {
  const normalized = iceType.toLowerCase();
  const mapping = ICETYPE_TO_DUCKDB[normalized];

  if (mapping) {
    // Handle decimal with custom precision/scale from field
    if (normalized === 'decimal' && field) {
      return {
        duckdbType: 'DECIMAL',
        precision: field.precision ?? mapping.precision,
        scale: field.scale ?? mapping.scale,
      };
    }
    return mapping;
  }

  // Default to VARCHAR for unknown types
  return { duckdbType: 'VARCHAR' };
}

/**
 * Get the full DuckDB type string including parameters.
 *
 * @param mapping - The type mapping
 * @returns The full type string (e.g., "DECIMAL(38, 9)")
 */
export function getDuckDBTypeString(mapping: DuckDBTypeMapping): string {
  if (mapping.duckdbType === 'DECIMAL' && mapping.precision !== undefined) {
    const scale = mapping.scale ?? 0;
    return `DECIMAL(${mapping.precision}, ${scale})`;
  }
  return mapping.duckdbType;
}

/**
 * Convert an IceType field to an array type in DuckDB.
 *
 * @param baseType - The base type string
 * @returns The array type string (e.g., "VARCHAR[]")
 */
export function toArrayType(baseType: string): string {
  return `${baseType}[]`;
}

// =============================================================================
// Column Generation
// =============================================================================

/**
 * Convert an IceType field definition to a DuckDB column definition.
 *
 * @param fieldName - The field name
 * @param field - The IceType field definition
 * @returns The DuckDB column definition
 */
export function fieldToDuckDBColumn(
  fieldName: string,
  field: FieldDefinition
): DuckDBColumn {
  const typeMapping = mapIceTypeToDuckDB(field.type, field);
  let typeString = getDuckDBTypeString(typeMapping);

  // Handle array types
  if (field.isArray) {
    typeString = toArrayType(typeString);
  }

  // Handle relation fields - store as foreign key reference (UUID/VARCHAR)
  if (field.relation) {
    if (field.isArray) {
      typeString = 'VARCHAR[]';
    } else {
      typeString = 'VARCHAR';
    }
  }

  const column: DuckDBColumn = {
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
 * @param type - The DuckDB type
 * @returns The SQL expression string
 */
export function formatDefaultValue(value: unknown, type: string): string {
  return formatDefaultValueBase(value, type);
}

// =============================================================================
// System Fields
// =============================================================================

/**
 * Generate system field columns for DuckDB tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table.
 *
 * @returns Array of system column definitions
 */
export function generateSystemColumns(): DuckDBColumn[] {
  // Use shared implementation and cast to DuckDBColumn[]
  // The types are compatible since DuckDBColumn extends SqlColumn's shape
  return generateSystemColumnsBase('duckdb') as DuckDBColumn[];
}

// =============================================================================
// DDL Serialization
// =============================================================================

/**
 * Escape an identifier for DuckDB SQL.
 *
 * @param identifier - The identifier to escape
 * @returns The escaped identifier
 */
export function escapeIdentifier(identifier: string): string {
  return escapeIdentifierBase(identifier, 'duckdb');
}

/**
 * Serialize a column definition to a DDL fragment.
 *
 * @param column - The column definition
 * @returns The DDL column fragment
 */
export function serializeColumn(column: DuckDBColumn): string {
  return serializeColumnBase(column as SqlColumn, 'duckdb');
}

/**
 * Serialize a DuckDB DDL structure to a CREATE TABLE statement.
 *
 * Uses the shared serializeDDL from @icetype/sql-common.
 *
 * @param ddl - The DDL structure
 * @returns The CREATE TABLE SQL statement
 */
export function serializeDDL(ddl: DuckDBDDL): string {
  // Convert DuckDBDDL to the common DDLStructure format
  const commonDDL: DDLStructure = {
    tableName: ddl.tableName,
    schemaName: ddl.schemaName,
    columns: ddl.columns as SqlColumn[],
    primaryKey: ddl.primaryKey,
    uniqueConstraints: ddl.uniqueConstraints,
    ifNotExists: ddl.ifNotExists,
    temporary: ddl.temporary,
  };

  return serializeDDLBase(commonDDL, 'duckdb');
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
  columns: DuckDBColumn[]
): string[] {
  return generateIndexStatementsBase(tableName, schemaName, columns as SqlColumn[], 'duckdb');
}
