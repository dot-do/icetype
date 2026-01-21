/**
 * Schema Migration and Diff Support for IceType
 *
 * This module provides functionality to:
 * - Compare two IceType schemas and detect differences
 * - Generate SQL migration plans for various database dialects
 *
 * @packageDocumentation
 */

import type { IceTypeSchema, FieldDefinition } from './types.js';
import { getPostgresType, getClickHouseType, getDuckDBType } from './type-mappings.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Types of changes that can occur to a field.
 */
export type FieldChangeType = 'type' | 'modifier' | 'indexed' | 'default' | 'array';

/**
 * Represents a change to a field between schema versions.
 */
export interface FieldChange {
  /** Field name */
  name: string;
  /** Types of changes detected */
  changes: FieldChangeType[];
  /** The field definition in the old schema */
  oldField: FieldDefinition;
  /** The field definition in the new schema */
  newField: FieldDefinition;
}

/**
 * Represents the difference between two schema versions.
 */
export interface SchemaDiff {
  /** Name of the schema being compared */
  schemaName: string;
  /** Fields that were added in the new schema */
  addedFields: FieldDefinition[];
  /** Fields that were removed from the new schema */
  removedFields: FieldDefinition[];
  /** Fields that were modified between schemas */
  modifiedFields: FieldChange[];
  /** Whether there are any changes */
  hasChanges: boolean;
}

/**
 * A migration plan containing up and down SQL statements.
 */
export interface MigrationPlan {
  /** SQL to apply the migration (upgrade) */
  up: string;
  /** SQL to reverse the migration (downgrade) */
  down: string;
}

/**
 * Supported SQL dialects for migration generation.
 */
export type SqlDialect = 'postgres' | 'clickhouse' | 'duckdb';

/**
 * Options for migration plan generation.
 */
export interface MigrationPlanOptions {
  /** Target SQL dialect */
  dialect: SqlDialect;
}

// =============================================================================
// Schema Diffing
// =============================================================================

/**
 * Compare two IceType schemas and return the differences.
 *
 * @param oldSchema - The original schema version
 * @param newSchema - The new schema version
 * @returns A SchemaDiff object describing all changes
 *
 * @example
 * ```typescript
 * const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
 * const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
 *
 * const diff = diffSchemas(oldSchema, newSchema);
 * console.log(diff.addedFields); // [{ name: 'name', type: 'string', ... }]
 * ```
 */
export function diffSchemas(oldSchema: IceTypeSchema, newSchema: IceTypeSchema): SchemaDiff {
  const addedFields: FieldDefinition[] = [];
  const removedFields: FieldDefinition[] = [];
  const modifiedFields: FieldChange[] = [];

  const oldFields = oldSchema.fields;
  const newFields = newSchema.fields;

  // Find added and modified fields
  for (const [fieldName, newField] of newFields) {
    const oldField = oldFields.get(fieldName);

    if (!oldField) {
      // Field was added
      addedFields.push(newField);
    } else {
      // Check for modifications
      const changes = detectFieldChanges(oldField, newField);
      if (changes.length > 0) {
        modifiedFields.push({
          name: fieldName,
          changes,
          oldField,
          newField,
        });
      }
    }
  }

  // Find removed fields
  for (const [fieldName, oldField] of oldFields) {
    if (!newFields.has(fieldName)) {
      removedFields.push(oldField);
    }
  }

  const hasChanges = addedFields.length > 0 || removedFields.length > 0 || modifiedFields.length > 0;

  return {
    schemaName: newSchema.name,
    addedFields,
    removedFields,
    modifiedFields,
    hasChanges,
  };
}

/**
 * Detect what changes occurred between two field definitions.
 */
function detectFieldChanges(oldField: FieldDefinition, newField: FieldDefinition): FieldChangeType[] {
  const changes: FieldChangeType[] = [];

  // Check type change
  if (oldField.type !== newField.type) {
    changes.push('type');
  }

  // Check modifier change (optional/required)
  if (oldField.isOptional !== newField.isOptional || oldField.isUnique !== newField.isUnique) {
    changes.push('modifier');
  }

  // Check indexed change
  if (oldField.isIndexed !== newField.isIndexed) {
    changes.push('indexed');
  }

  // Check array change
  if (oldField.isArray !== newField.isArray) {
    changes.push('array');
  }

  // Check default value change
  if (JSON.stringify(oldField.defaultValue) !== JSON.stringify(newField.defaultValue)) {
    changes.push('default');
  }

  return changes;
}

// =============================================================================
// Migration Plan Generation
// =============================================================================

/**
 * Generate a migration plan from a schema diff.
 *
 * @param diff - The schema diff to generate migrations from
 * @param options - Migration generation options including SQL dialect
 * @returns A MigrationPlan with up and down SQL statements
 *
 * @example
 * ```typescript
 * const diff = diffSchemas(oldSchema, newSchema);
 * const plan = generateMigrationPlan(diff, { dialect: 'postgres' });
 *
 * console.log(plan.up);   // ALTER TABLE users ADD COLUMN name TEXT;
 * console.log(plan.down); // ALTER TABLE users DROP COLUMN name;
 * ```
 */
export function generateMigrationPlan(diff: SchemaDiff, options: MigrationPlanOptions): MigrationPlan {
  const { dialect } = options;

  if (!diff.hasChanges) {
    return { up: '', down: '' };
  }

  const upStatements: string[] = [];
  const downStatements: string[] = [];
  const tableName = diff.schemaName;

  // Generate SQL for added fields
  for (const field of diff.addedFields) {
    const sqlType = getTypeForDialect(field.type, dialect);
    const notNull = !field.isOptional && field.modifier === '!' ? ' NOT NULL' : '';

    upStatements.push(`ALTER TABLE ${tableName} ADD COLUMN ${field.name} ${sqlType}${notNull};`);
    downStatements.push(`ALTER TABLE ${tableName} DROP COLUMN ${field.name};`);
  }

  // Generate SQL for removed fields
  for (const field of diff.removedFields) {
    const sqlType = getTypeForDialect(field.type, dialect);
    const notNull = !field.isOptional && field.modifier === '!' ? ' NOT NULL' : '';

    upStatements.push(`ALTER TABLE ${tableName} DROP COLUMN ${field.name};`);
    downStatements.push(`ALTER TABLE ${tableName} ADD COLUMN ${field.name} ${sqlType}${notNull};`);
  }

  // Generate SQL for modified fields
  for (const change of diff.modifiedFields) {
    const { name, newField, oldField, changes } = change;

    // Handle type changes
    if (changes.includes('type') || changes.includes('array')) {
      const newSqlType = getTypeForDialect(newField.type, dialect);
      const oldSqlType = getTypeForDialect(oldField.type, dialect);

      if (dialect === 'postgres') {
        upStatements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${name} TYPE ${newSqlType};`);
        downStatements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${name} TYPE ${oldSqlType};`);
      } else if (dialect === 'clickhouse') {
        upStatements.push(`ALTER TABLE ${tableName} MODIFY COLUMN ${name} ${newSqlType};`);
        downStatements.push(`ALTER TABLE ${tableName} MODIFY COLUMN ${name} ${oldSqlType};`);
      } else if (dialect === 'duckdb') {
        upStatements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${name} TYPE ${newSqlType};`);
        downStatements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${name} TYPE ${oldSqlType};`);
      }
    }

    // Handle modifier changes (nullable to not null or vice versa)
    if (changes.includes('modifier') && !changes.includes('type')) {
      if (dialect === 'postgres') {
        if (newField.isOptional && !oldField.isOptional) {
          upStatements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${name} DROP NOT NULL;`);
          downStatements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${name} SET NOT NULL;`);
        } else if (!newField.isOptional && oldField.isOptional) {
          upStatements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${name} SET NOT NULL;`);
          downStatements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${name} DROP NOT NULL;`);
        }
      }
    }
  }

  return {
    up: upStatements.join('\n'),
    down: downStatements.join('\n'),
  };
}

/**
 * Get the SQL type for a given IceType type and dialect.
 */
function getTypeForDialect(iceType: string, dialect: SqlDialect): string {
  switch (dialect) {
    case 'postgres':
      return getPostgresType(iceType);
    case 'clickhouse':
      return getClickHouseType(iceType);
    case 'duckdb':
      return getDuckDBType(iceType);
    default: {
      const _exhaustive: never = dialect;
      throw new Error(`Unhandled dialect: ${_exhaustive}`);
    }
  }
}
