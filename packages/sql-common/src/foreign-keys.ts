/**
 * Foreign Key DDL Generation
 *
 * Extracts foreign key definitions from IceType schemas and generates
 * DDL statements for various SQL dialects.
 *
 * @packageDocumentation
 */

import type { IceTypeSchema } from '@icetype/core';

// =============================================================================
// Types (duplicated to avoid circular dependency)
// =============================================================================

/**
 * Supported SQL dialects.
 */
export type SqlDialect = 'duckdb' | 'postgres' | 'clickhouse' | 'sqlite' | 'mysql';

// =============================================================================
// Identifier Escaping (duplicated to avoid circular dependency)
// =============================================================================

/**
 * Escape an identifier for the given SQL dialect.
 */
function escapeIdentifier(identifier: string, dialect: SqlDialect): string {
  const isSimpleIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
  const startsWithDollar = identifier.startsWith('$');

  if (isSimpleIdentifier && !startsWithDollar) {
    return identifier;
  }

  if (dialect === 'clickhouse' || dialect === 'mysql') {
    const escaped = identifier.replace(/`/g, '``');
    return `\`${escaped}\``;
  } else {
    const escaped = identifier.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Referential action for ON DELETE and ON UPDATE clauses.
 */
export type ReferentialAction = 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';

/**
 * Foreign key definition for DDL generation.
 */
export interface ForeignKeyDefinition {
  /** Column(s) in the source table */
  columns: string[];
  /** Name of the referenced table */
  referencedTable: string;
  /** Column(s) in the referenced table */
  referencedColumns: string[];
  /** Action on delete of referenced row */
  onDelete?: ReferentialAction;
  /** Action on update of referenced row */
  onUpdate?: ReferentialAction;
  /** Optional constraint name */
  constraintName?: string;
}

/**
 * Options for foreign key extraction.
 */
export interface ExtractForeignKeysOptions {
  /** Default ON DELETE action */
  onDelete?: ReferentialAction | string;
  /** Default ON UPDATE action */
  onUpdate?: ReferentialAction | string;
}

// =============================================================================
// Foreign Key Extraction
// =============================================================================

/**
 * Convert field name to foreign key column name.
 * Uses snake_case with _id suffix.
 *
 * @param fieldName - The relation field name
 * @returns The FK column name
 */
function toFkColumnName(fieldName: string): string {
  // Convert camelCase to snake_case and add _id suffix
  const snakeCase = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
  return `${snakeCase}_id`.replace(/^_/, '');
}

/**
 * Generate a constraint name for a foreign key.
 *
 * @param tableName - The source table name
 * @param fieldName - The relation field name
 * @param referencedTable - The referenced table name
 * @returns A constraint name
 */
function generateConstraintName(
  tableName: string,
  fieldName: string,
  referencedTable: string
): string {
  return `fk_${tableName}_${fieldName}_${referencedTable}`;
}

/**
 * Extract foreign key definitions from an IceType schema.
 *
 * Identifies forward relations (->) and generates FK definitions.
 * Skips fuzzy relations (~>) as they are semantic, not referential.
 * Skips backward relations (<-) as the FK is on the other table.
 *
 * @param schema - The IceType schema to extract FKs from
 * @param allSchemas - Map of all schemas (for validation)
 * @param options - Extraction options
 * @returns Array of foreign key definitions
 */
export function extractForeignKeys(
  schema: IceTypeSchema,
  allSchemas: Map<string, IceTypeSchema>,
  options: ExtractForeignKeysOptions = {}
): ForeignKeyDefinition[] {
  const foreignKeys: ForeignKeyDefinition[] = [];
  const { onDelete, onUpdate } = options;

  // Iterate through all fields looking for relations
  for (const [fieldName, field] of schema.fields) {
    // Skip non-relation fields
    if (!field.relation) {
      continue;
    }

    const { operator, targetType } = field.relation;

    // Skip fuzzy relations (~> and <~) - these are semantic, not referential
    if (operator === '~>' || operator === '<~') {
      continue;
    }

    // Skip backward relations (<-) - the FK is on the other side
    if (operator === '<-') {
      continue;
    }

    // Only process forward relations (->)
    if (operator !== '->') {
      continue;
    }

    // Validate that the referenced table exists
    if (!allSchemas.has(targetType)) {
      continue;
    }

    // Create the FK definition
    const fk: ForeignKeyDefinition = {
      columns: [toFkColumnName(fieldName)],
      referencedTable: targetType,
      referencedColumns: ['id'],
      constraintName: generateConstraintName(schema.name, fieldName, targetType),
    };

    // Add referential actions if specified
    if (onDelete) {
      fk.onDelete = onDelete as ReferentialAction;
    }
    if (onUpdate) {
      fk.onUpdate = onUpdate as ReferentialAction;
    }

    foreignKeys.push(fk);
  }

  return foreignKeys;
}

// =============================================================================
// Foreign Key Serialization
// =============================================================================

/**
 * Serialize a foreign key definition to a SQL DDL fragment.
 *
 * Generates a FOREIGN KEY clause suitable for use in CREATE TABLE
 * or ALTER TABLE statements.
 *
 * @param fk - The foreign key definition
 * @param dialect - The SQL dialect to use
 * @returns The DDL fragment (empty string for ClickHouse)
 */
export function serializeForeignKey(fk: ForeignKeyDefinition, dialect: SqlDialect): string {
  // ClickHouse does not support foreign keys
  if (dialect === 'clickhouse') {
    return '';
  }

  const parts: string[] = [];

  // Add constraint name if provided
  if (fk.constraintName) {
    parts.push(`CONSTRAINT ${escapeIdentifier(fk.constraintName, dialect)}`);
  }

  // Build the FOREIGN KEY clause
  const sourceColumns = fk.columns
    .map((col) => escapeIdentifier(col, dialect))
    .join(', ');

  const refColumns = fk.referencedColumns
    .map((col) => escapeIdentifier(col, dialect))
    .join(', ');

  parts.push(`FOREIGN KEY (${sourceColumns})`);
  parts.push(`REFERENCES ${escapeIdentifier(fk.referencedTable, dialect)} (${refColumns})`);

  // Add ON DELETE clause
  if (fk.onDelete) {
    parts.push(`ON DELETE ${fk.onDelete}`);
  }

  // Add ON UPDATE clause
  if (fk.onUpdate) {
    parts.push(`ON UPDATE ${fk.onUpdate}`);
  }

  return parts.join(' ');
}
