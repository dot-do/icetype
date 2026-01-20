/**
 * DuckDB DDL Generation Helpers
 *
 * Provides utilities for generating DuckDB DDL statements from
 * IceType schemas.
 *
 * @packageDocumentation
 */

import type { FieldDefinition } from '@icetype/core';

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
    if (type.includes('DATE')) {
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
 * Generate system field columns for DuckDB tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table.
 *
 * @returns Array of system column definitions
 */
export function generateSystemColumns(): DuckDBColumn[] {
  return [
    {
      name: '$id',
      type: 'VARCHAR',
      nullable: false,
      primaryKey: true,
    },
    {
      name: '$type',
      type: 'VARCHAR',
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
 * Escape an identifier for DuckDB SQL.
 *
 * @param identifier - The identifier to escape
 * @returns The escaped identifier
 */
export function escapeIdentifier(identifier: string): string {
  // DuckDB uses double quotes for identifiers with special characters
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier) && !identifier.startsWith('$')) {
    return identifier;
  }
  // Escape double quotes within the identifier
  const escaped = identifier.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Serialize a column definition to a DDL fragment.
 *
 * @param column - The column definition
 * @returns The DDL column fragment
 */
export function serializeColumn(column: DuckDBColumn): string {
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

  if (column.default !== undefined) {
    parts.push(`DEFAULT ${column.default}`);
  }

  return parts.join(' ');
}

/**
 * Serialize a DuckDB DDL structure to a CREATE TABLE statement.
 *
 * @param ddl - The DDL structure
 * @returns The CREATE TABLE SQL statement
 */
export function serializeDDL(ddl: DuckDBDDL): string {
  const lines: string[] = [];

  // CREATE TABLE header
  let header = 'CREATE';
  if (ddl.temporary) {
    header += ' TEMPORARY';
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
  columns: DuckDBColumn[]
): string[] {
  const statements: string[] = [];
  const fullTableName = schemaName
    ? `${escapeIdentifier(schemaName)}.${escapeIdentifier(tableName)}`
    : escapeIdentifier(tableName);

  for (const column of columns) {
    // Create indexes for unique columns (separate from UNIQUE constraint)
    // In practice, UNIQUE already creates an index, but explicit indexes
    // might be wanted for non-unique indexed fields
    if (column.unique) {
      const indexName = `idx_${tableName}_${column.name}`.replace(/\$/g, '_');
      statements.push(
        `CREATE INDEX IF NOT EXISTS ${escapeIdentifier(indexName)} ON ${fullTableName} (${escapeIdentifier(column.name)});`
      );
    }
  }

  return statements;
}
