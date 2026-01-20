/**
 * PostgreSQL DDL Generation Helpers
 *
 * Provides utilities for generating PostgreSQL DDL statements from
 * IceType schemas. Compatible with postgres.do and Drizzle ORM.
 *
 * @packageDocumentation
 */

import type { FieldDefinition } from '@icetype/core';

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
    if (type.includes('DATE') && !type.includes('TIMESTAMP')) {
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
 * Generate system field columns for PostgreSQL tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table.
 *
 * @returns Array of system column definitions
 */
export function generateSystemColumns(): PostgresColumn[] {
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
 * Escape an identifier for PostgreSQL SQL.
 *
 * @param identifier - The identifier to escape
 * @returns The escaped identifier
 */
export function escapeIdentifier(identifier: string): string {
  // PostgreSQL uses double quotes for identifiers with special characters
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
export function serializeColumn(column: PostgresColumn): string {
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
