/**
 * Migration Types and Operations for IceType
 *
 * This module provides types and functions for representing database migrations:
 * - Migration type structure with versioning
 * - MigrationOperation discriminated union for all change types
 * - Functions to create, validate, and merge migrations
 *
 * @packageDocumentation
 */

import type { SchemaDiff, FieldChange } from './migrations.js';
import type { SchemaVersion } from './version.js';
import { compareVersions as compareSchemaVersions } from './version.js';

// Re-export SchemaVersion for convenience
export type { SchemaVersion } from './version.js';

// =============================================================================
// ColumnChanges Type
// =============================================================================

/**
 * Represents changes to a column's properties.
 */
export interface ColumnChanges {
  /** Type change */
  type?: { from: string; to: string };
  /** Nullable change */
  nullable?: { from: boolean; to: boolean };
  /** Default value change */
  default?: { from: unknown; to: unknown };
}

// =============================================================================
// Constraint Types
// =============================================================================

/**
 * Base constraint properties.
 */
interface BaseConstraint {
  /** Constraint name */
  name: string;
}

/**
 * Foreign key constraint definition.
 */
interface ForeignKeyConstraint extends BaseConstraint {
  type: 'foreignKey';
  columns: string[];
  references: { table: string; columns: string[] };
  onDelete?: 'cascade' | 'setNull' | 'restrict' | 'noAction';
  onUpdate?: 'cascade' | 'setNull' | 'restrict' | 'noAction';
}

/**
 * Unique constraint definition.
 */
interface UniqueConstraint extends BaseConstraint {
  type: 'unique';
  columns: string[];
}

/**
 * Check constraint definition.
 */
interface CheckConstraint extends BaseConstraint {
  type: 'check';
  expression: string;
}

/**
 * Primary key constraint definition.
 */
interface PrimaryKeyConstraint extends BaseConstraint {
  type: 'primaryKey';
  columns: string[];
}

/**
 * Union type for all constraint types.
 */
export type Constraint =
  | ForeignKeyConstraint
  | UniqueConstraint
  | CheckConstraint
  | PrimaryKeyConstraint;

// =============================================================================
// MigrationOperation Types
// =============================================================================

/**
 * Add a new column to a table.
 */
interface AddColumnOperation {
  op: 'addColumn';
  table: string;
  column: string;
  type: string;
  nullable: boolean;
  default?: unknown;
}

/**
 * Drop a column from a table.
 */
interface DropColumnOperation {
  op: 'dropColumn';
  table: string;
  column: string;
}

/**
 * Rename a column.
 */
interface RenameColumnOperation {
  op: 'renameColumn';
  table: string;
  oldName: string;
  newName: string;
}

/**
 * Alter a column's properties.
 */
interface AlterColumnOperation {
  op: 'alterColumn';
  table: string;
  column: string;
  changes: ColumnChanges;
}

/**
 * Add an index.
 */
interface AddIndexOperation {
  op: 'addIndex';
  table: string;
  columns: string[];
  unique: boolean;
  name?: string;
}

/**
 * Drop an index.
 */
interface DropIndexOperation {
  op: 'dropIndex';
  table: string;
  indexName: string;
}

/**
 * Add a constraint.
 */
interface AddConstraintOperation {
  op: 'addConstraint';
  table: string;
  constraint: Constraint;
}

/**
 * Drop a constraint.
 */
interface DropConstraintOperation {
  op: 'dropConstraint';
  table: string;
  constraintName: string;
}

/**
 * Union type for all migration operations.
 */
export type MigrationOperation =
  | AddColumnOperation
  | DropColumnOperation
  | RenameColumnOperation
  | AlterColumnOperation
  | AddIndexOperation
  | DropIndexOperation
  | AddConstraintOperation
  | DropConstraintOperation;

// =============================================================================
// Migration Type
// =============================================================================

/**
 * Represents a complete schema migration.
 */
export interface Migration {
  /** Unique migration identifier */
  id: string;
  /** Schema version before migration */
  fromVersion: SchemaVersion;
  /** Schema version after migration */
  toVersion: SchemaVersion;
  /** Timestamp of migration creation */
  timestamp: Date;
  /** Optional description of the migration */
  description?: string;
  /** List of operations to perform */
  operations: MigrationOperation[];
  /** Whether this migration contains breaking changes */
  isBreaking: boolean;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation error for migrations.
 */
export interface MigrationValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Path to the error (e.g., operation index) */
  path?: string;
}

/**
 * Validation result for migrations.
 */
export interface MigrationValidationResult {
  /** Whether the migration is valid */
  valid: boolean;
  /** List of validation errors */
  errors: MigrationValidationError[];
}

// =============================================================================
// Options Types
// =============================================================================

/**
 * Options for creating a migration from a diff.
 */
export interface CreateMigrationOptions {
  /** Optional description */
  description?: string;
  /** Optional custom ID */
  id?: string;
  /** Optional timestamp override */
  timestamp?: Date;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique migration ID.
 */
function generateMigrationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `migration_${timestamp}_${random}`;
}

/**
 * Check if two versions are equal.
 */
function versionsEqual(a: SchemaVersion, b: SchemaVersion): boolean {
  return a.major === b.major && a.minor === b.minor && a.patch === b.patch;
}

/**
 * Type widening map: from type -> types that are wider
 */
const TYPE_WIDENING: Record<string, string[]> = {
  int: ['long', 'bigint', 'float', 'double'],
  long: ['bigint', 'double'],
  float: ['double'],
  string: ['text'],
  varchar: ['text', 'string'],
  char: ['varchar', 'string', 'text'],
};

/**
 * Check if a type change is a widening (non-breaking).
 */
function isTypeWidening(fromType: string, toType: string): boolean {
  const wideningTypes = TYPE_WIDENING[fromType];
  return wideningTypes?.includes(toType) ?? false;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Create a Migration from a SchemaDiff.
 *
 * @param diff - The schema diff to convert
 * @param fromVersion - The source schema version
 * @param toVersion - The target schema version
 * @param options - Optional creation options
 * @returns A Migration object
 *
 * @example
 * ```typescript
 * const diff = diffSchemas(oldSchema, newSchema);
 * const migration = createMigrationFromDiff(
 *   diff,
 *   { major: 1, minor: 0, patch: 0 },
 *   { major: 1, minor: 1, patch: 0 },
 *   { description: 'Add user name field' }
 * );
 * ```
 */
export function createMigrationFromDiff(
  diff: SchemaDiff,
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion,
  options: CreateMigrationOptions = {}
): Migration {
  const operations: MigrationOperation[] = [];
  let hasBreakingChange = false;

  // Process added fields -> addColumn operations
  for (const field of diff.addedFields) {
    const isNullable = field.isOptional || field.modifier === '?';
    const op: AddColumnOperation = {
      op: 'addColumn',
      table: diff.schemaName,
      column: field.name,
      type: field.type,
      nullable: isNullable,
    };

    if (field.defaultValue !== undefined) {
      op.default = field.defaultValue;
    }

    operations.push(op);
  }

  // Process removed fields -> dropColumn operations
  for (const field of diff.removedFields) {
    operations.push({
      op: 'dropColumn',
      table: diff.schemaName,
      column: field.name,
    });
    hasBreakingChange = true;
  }

  // Process modified fields -> alterColumn, addIndex, dropIndex operations
  for (const change of diff.modifiedFields) {
    processFieldChange(diff.schemaName, change, operations, (breaking) => {
      if (breaking) hasBreakingChange = true;
    });
  }

  const migration: Migration = {
    id: options.id ?? generateMigrationId(),
    fromVersion,
    toVersion,
    timestamp: options.timestamp ?? new Date(),
    operations,
    isBreaking: hasBreakingChange,
  };

  if (options.description) {
    migration.description = options.description;
  }

  return migration;
}

/**
 * Process a field change and add appropriate operations.
 */
function processFieldChange(
  tableName: string,
  change: FieldChange,
  operations: MigrationOperation[],
  onBreaking: (breaking: boolean) => void
): void {
  const { name, oldField, newField, changes: changeTypes } = change;

  // Handle type and/or nullable changes -> alterColumn
  if (
    changeTypes.includes('type') ||
    changeTypes.includes('modifier') ||
    changeTypes.includes('array')
  ) {
    const columnChanges: ColumnChanges = {};

    if (changeTypes.includes('type') || changeTypes.includes('array')) {
      columnChanges.type = { from: oldField.type, to: newField.type };

      // Check if it's a narrowing type change (breaking)
      if (!isTypeWidening(oldField.type, newField.type)) {
        // If not widening, it might be narrowing or incompatible
        if (oldField.type !== newField.type) {
          onBreaking(true);
        }
      }
    }

    if (changeTypes.includes('modifier')) {
      const oldNullable = oldField.isOptional || oldField.modifier === '?';
      const newNullable = newField.isOptional || newField.modifier === '?';

      if (oldNullable !== newNullable) {
        columnChanges.nullable = { from: oldNullable, to: newNullable };

        // Making a nullable field required is breaking
        if (oldNullable && !newNullable) {
          onBreaking(true);
        }
      }
    }

    if (Object.keys(columnChanges).length > 0) {
      operations.push({
        op: 'alterColumn',
        table: tableName,
        column: name,
        changes: columnChanges,
      });
    }
  }

  // Handle index changes
  if (changeTypes.includes('indexed')) {
    const oldIndexed = oldField.isIndexed || oldField.isUnique || oldField.modifier === '#';
    const newIndexed = newField.isIndexed || newField.isUnique || newField.modifier === '#';

    if (!oldIndexed && newIndexed) {
      // Adding index
      operations.push({
        op: 'addIndex',
        table: tableName,
        columns: [name],
        unique: newField.isUnique || newField.modifier === '#',
      });
    } else if (oldIndexed && !newIndexed) {
      // Removing index
      operations.push({
        op: 'dropIndex',
        table: tableName,
        indexName: `idx_${tableName}_${name}`,
      });
    }
  }
}

/**
 * Check if a migration contains breaking changes.
 *
 * Breaking changes include:
 * - Dropping columns
 * - Making nullable columns required
 * - Narrowing type changes (e.g., long -> int)
 * - Dropping constraints
 *
 * @param migration - The migration to check
 * @returns true if the migration contains breaking changes
 *
 * @example
 * ```typescript
 * if (isBreakingMigration(migration)) {
 *   console.warn('This migration may cause data loss!');
 * }
 * ```
 */
export function isBreakingMigration(migration: Migration): boolean {
  for (const op of migration.operations) {
    switch (op.op) {
      case 'dropColumn':
        return true;

      case 'dropConstraint':
        return true;

      case 'alterColumn': {
        // Check for nullable -> required change
        if (op.changes.nullable) {
          const { from, to } = op.changes.nullable;
          if (from === true && to === false) {
            return true;
          }
        }

        // Check for type narrowing
        if (op.changes.type) {
          const { from, to } = op.changes.type;
          if (!isTypeWidening(from, to) && from !== to) {
            return true;
          }
        }
        break;
      }
    }
  }

  return false;
}

/**
 * Validate a migration for correctness.
 *
 * Checks for:
 * - Valid version ordering (fromVersion < toVersion)
 * - Non-empty table and column names
 * - Valid operation types
 * - Required properties in operations
 *
 * @param migration - The migration to validate
 * @returns Validation result with errors if any
 *
 * @example
 * ```typescript
 * const result = validateMigration(migration);
 * if (!result.valid) {
 *   console.error('Invalid migration:', result.errors);
 * }
 * ```
 */
export function validateMigration(migration: Migration): MigrationValidationResult {
  const errors: MigrationValidationError[] = [];

  // Validate version ordering
  if (compareSchemaVersions(migration.fromVersion, migration.toVersion) >= 0) {
    errors.push({
      code: 'INVALID_VERSION_ORDER',
      message: 'fromVersion must be less than toVersion',
    });
  }

  // Validate each operation
  const validOps = [
    'addColumn',
    'dropColumn',
    'renameColumn',
    'alterColumn',
    'addIndex',
    'dropIndex',
    'addConstraint',
    'dropConstraint',
  ];

  for (let i = 0; i < migration.operations.length; i++) {
    const op = migration.operations[i]!;
    const path = `operations[${i}]`;

    // Check valid operation type
    if (!validOps.includes(op.op)) {
      errors.push({
        code: 'INVALID_OPERATION',
        message: `Unknown operation type: ${op.op}`,
        path,
      });
      continue;
    }

    // Check table name
    if ('table' in op && (!op.table || op.table.trim() === '')) {
      errors.push({
        code: 'EMPTY_TABLE_NAME',
        message: 'Table name cannot be empty',
        path,
      });
    }

    // Check column name for operations that have it
    if ('column' in op && (!op.column || op.column.trim() === '')) {
      errors.push({
        code: 'EMPTY_COLUMN_NAME',
        message: 'Column name cannot be empty',
        path,
      });
    }

    // Validate addColumn has type and nullable
    if (op.op === 'addColumn') {
      if (!('type' in op) || op.type === undefined) {
        errors.push({
          code: 'MISSING_TYPE',
          message: 'addColumn operation requires a type',
          path,
        });
      }
      if (!('nullable' in op) || op.nullable === undefined) {
        errors.push({
          code: 'MISSING_NULLABLE',
          message: 'addColumn operation requires nullable flag',
          path,
        });
      }
    }

    // Validate renameColumn has oldName and newName
    if (op.op === 'renameColumn') {
      if (!op.oldName || op.oldName.trim() === '') {
        errors.push({
          code: 'EMPTY_OLD_NAME',
          message: 'renameColumn operation requires oldName',
          path,
        });
      }
      if (!op.newName || op.newName.trim() === '') {
        errors.push({
          code: 'EMPTY_NEW_NAME',
          message: 'renameColumn operation requires newName',
          path,
        });
      }
    }

    // Validate alterColumn has changes
    if (op.op === 'alterColumn') {
      if (!op.changes || Object.keys(op.changes).length === 0) {
        errors.push({
          code: 'EMPTY_CHANGES',
          message: 'alterColumn operation requires at least one change',
          path,
        });
      }
    }

    // Validate addIndex has columns
    if (op.op === 'addIndex') {
      if (!op.columns || op.columns.length === 0) {
        errors.push({
          code: 'EMPTY_COLUMNS',
          message: 'addIndex operation requires at least one column',
          path,
        });
      }
    }

    // Validate dropIndex has indexName
    if (op.op === 'dropIndex') {
      if (!op.indexName || op.indexName.trim() === '') {
        errors.push({
          code: 'EMPTY_INDEX_NAME',
          message: 'dropIndex operation requires indexName',
          path,
        });
      }
    }

    // Validate addConstraint has constraint
    if (op.op === 'addConstraint') {
      if (!op.constraint) {
        errors.push({
          code: 'MISSING_CONSTRAINT',
          message: 'addConstraint operation requires constraint definition',
          path,
        });
      }
    }

    // Validate dropConstraint has constraintName
    if (op.op === 'dropConstraint') {
      if (!op.constraintName || op.constraintName.trim() === '') {
        errors.push({
          code: 'EMPTY_CONSTRAINT_NAME',
          message: 'dropConstraint operation requires constraintName',
          path,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge multiple sequential migrations into a single migration.
 *
 * This function combines migrations that form a sequence (each migration's
 * toVersion matches the next migration's fromVersion). It optimizes by
 * removing redundant operations (e.g., add then drop of the same column).
 *
 * @param migrations - Array of migrations to merge (must be sequential)
 * @returns A single merged migration
 * @throws Error if migrations array is empty or not sequential
 *
 * @example
 * ```typescript
 * const merged = mergeMigrations([migration1, migration2, migration3]);
 * // merged.fromVersion equals migration1.fromVersion
 * // merged.toVersion equals migration3.toVersion
 * ```
 */
export function mergeMigrations(migrations: Migration[]): Migration {
  if (migrations.length === 0) {
    throw new Error('Cannot merge empty array of migrations');
  }

  if (migrations.length === 1) {
    const m = migrations[0]!;
    return {
      id: generateMigrationId(),
      fromVersion: { ...m.fromVersion },
      toVersion: { ...m.toVersion },
      timestamp: new Date(m.timestamp),
      description: m.description,
      operations: [...m.operations],
      isBreaking: m.isBreaking,
    };
  }

  // Validate sequential order
  for (let i = 1; i < migrations.length; i++) {
    const prev = migrations[i - 1]!;
    const curr = migrations[i]!;

    if (!versionsEqual(prev.toVersion, curr.fromVersion)) {
      throw new Error(
        `Migrations are not sequential: migration ${i - 1} ends at ${formatVersion(
          prev.toVersion
        )} but migration ${i} starts at ${formatVersion(curr.fromVersion)}`
      );
    }
  }

  // Collect all operations
  const allOperations: MigrationOperation[] = [];
  for (const m of migrations) {
    allOperations.push(...m.operations);
  }

  // Optimize by removing redundant operations
  const optimizedOperations = optimizeOperations(allOperations);

  // Determine if any migration was breaking
  const isBreaking = migrations.some((m) => m.isBreaking);

  // Use latest timestamp
  const latestTimestamp = migrations.reduce(
    (latest, m) => (m.timestamp > latest ? m.timestamp : latest),
    migrations[0]!.timestamp
  );

  return {
    id: generateMigrationId(),
    fromVersion: { ...migrations[0]!.fromVersion },
    toVersion: { ...migrations[migrations.length - 1]!.toVersion },
    timestamp: latestTimestamp,
    operations: optimizedOperations,
    isBreaking,
  };
}

/**
 * Format a version as a string.
 */
function formatVersion(v: SchemaVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/**
 * Optimize operations by removing redundant pairs.
 */
function optimizeOperations(operations: MigrationOperation[]): MigrationOperation[] {
  const result: MigrationOperation[] = [];

  // Track add/drop pairs to cancel out
  const addedColumns = new Map<string, number>(); // key -> index in result
  const droppedColumns = new Set<string>();

  for (const op of operations) {
    const key = getOperationKey(op);

    if (op.op === 'addColumn') {
      // Check if this column was dropped later
      if (!droppedColumns.has(key)) {
        addedColumns.set(key, result.length);
        result.push(op);
      }
    } else if (op.op === 'dropColumn') {
      // Check if this column was added earlier
      const addIndex = addedColumns.get(key);
      if (addIndex !== undefined) {
        // Remove the add operation - they cancel out
        result.splice(addIndex, 1);
        // Update indices in addedColumns for operations after the removed one
        for (const [k, idx] of addedColumns.entries()) {
          if (idx > addIndex) {
            addedColumns.set(k, idx - 1);
          }
        }
        addedColumns.delete(key);
      } else {
        droppedColumns.add(key);
        result.push(op);
      }
    } else {
      result.push(op);
    }
  }

  return result;
}

/**
 * Get a unique key for an operation (for deduplication).
 */
function getOperationKey(op: MigrationOperation): string {
  switch (op.op) {
    case 'addColumn':
    case 'dropColumn':
      return `${op.table}.${op.column}`;
    case 'renameColumn':
      return `${op.table}.${op.oldName}->${op.newName}`;
    case 'alterColumn':
      return `${op.table}.${op.column}.alter`;
    case 'addIndex':
      return `${op.table}.idx.${op.columns.join(',')}`;
    case 'dropIndex':
      return `${op.table}.idx.${op.indexName}`;
    case 'addConstraint':
      return `${op.table}.constraint.${op.constraint.name}`;
    case 'dropConstraint':
      return `${op.table}.constraint.${op.constraintName}`;
  }
}
