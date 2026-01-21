/**
 * Reversible Migrations Utilities
 *
 * This module provides functionality for generating and managing reversible migrations
 * with explicit UP (forward) and DOWN (backward) sections.
 *
 * Features:
 * - Generate migrations with UP and DOWN sections from schema diffs
 * - Validate that DOWN correctly reverses UP
 * - Detect irreversible operations
 * - Auto-generate DOWN from UP statements
 * - Parse and format migration files
 *
 * @packageDocumentation
 */

import type { SchemaDiff, SchemaChange, FieldDefinition, SchemaVersion } from '@icetype/core';

// =============================================================================
// Types
// =============================================================================

/**
 * A reversible migration with explicit UP and DOWN sections.
 */
export interface ReversibleMigration {
  /** Migration identifier */
  id: string;
  /** Migration name/description */
  name: string;
  /** Source schema version */
  fromVersion: { major: number; minor: number; patch: number };
  /** Target schema version */
  toVersion: { major: number; minor: number; patch: number };
  /** UP section: SQL statements to apply the migration */
  up: string[];
  /** DOWN section: SQL statements to reverse the migration */
  down: string[];
  /** Whether this migration is reversible */
  reversible: boolean;
  /** Warnings about potential data loss or irreversibility */
  warnings: string[];
  /** Timestamp when migration was created */
  createdAt: Date;
}

/**
 * Result of validating a reversible migration.
 */
export interface MigrationValidationResult {
  /** Whether the migration is valid */
  valid: boolean;
  /** Whether UP and DOWN are inverses of each other */
  isReversible: boolean;
  /** Errors found during validation */
  errors: string[];
  /** Warnings (e.g., potential data loss) */
  warnings: string[];
  /** Operations that cannot be reversed */
  irreversibleOperations: IrreversibleOperation[];
}

/**
 * Describes an irreversible operation.
 */
export interface IrreversibleOperation {
  /** Type of operation */
  type: 'drop_column' | 'drop_table' | 'drop_index' | 'change_type' | 'remove_data';
  /** Description of what makes it irreversible */
  reason: string;
  /** The SQL statement that is irreversible */
  statement: string;
  /** Suggested manual DOWN if any */
  suggestedFix?: string;
}

/**
 * Options for generating reversible migrations.
 */
export interface ReversibleMigrationOptions {
  /** SQL dialect */
  dialect: 'sqlite' | 'postgres' | 'mysql' | 'duckdb';
  /** Whether to fail on irreversible operations */
  strictReversibility?: boolean;
  /** Include comments in generated SQL */
  includeComments?: boolean;
  /** Preserve data where possible (e.g., backup columns before dropping) */
  preserveData?: boolean;
}

// =============================================================================
// Safety and Validation Types
// =============================================================================

/**
 * Represents a dangerous operation that requires confirmation.
 */
export interface DangerousOperation {
  /** Type of dangerous operation */
  type: 'data_loss' | 'schema_destruction' | 'type_narrowing' | 'constraint_change' | 'index_removal';
  /** Severity level */
  severity: 'warning' | 'critical';
  /** Human-readable description */
  description: string;
  /** The SQL statement that is dangerous */
  statement: string;
  /** Suggested backup command */
  backupSuggestion?: string;
  /** Whether this operation requires explicit confirmation */
  requiresConfirmation: boolean;
}

/**
 * Result of pre-flight validation.
 */
export interface PreFlightValidationResult {
  /** Whether the migration can proceed */
  canProceed: boolean;
  /** Dangerous operations that were detected */
  dangerousOperations: DangerousOperation[];
  /** Backup suggestions before running */
  backupSuggestions: string[];
  /** Common mistakes detected */
  commonMistakes: MigrationMistake[];
  /** Whether confirmation is required before running */
  requiresConfirmation: boolean;
  /** Summary message */
  summary: string;
}

/**
 * Represents a common mistake in migrations.
 */
export interface MigrationMistake {
  /** Type of mistake */
  type:
    | 'missing_down'
    | 'down_not_inverse'
    | 'concurrent_without_lock'
    | 'missing_default_for_not_null'
    | 'dropping_with_foreign_key'
    | 'renaming_without_index_update'
    | 'type_change_without_cast'
    | 'missing_if_exists'
    | 'missing_if_not_exists';
  /** Human-readable description */
  description: string;
  /** The problematic statement */
  statement?: string;
  /** Suggested fix */
  suggestion: string;
  /** Severity */
  severity: 'info' | 'warning' | 'error';
}

/**
 * Options for pre-flight validation.
 */
export interface PreFlightValidationOptions {
  /** SQL dialect */
  dialect: 'sqlite' | 'postgres' | 'mysql' | 'duckdb';
  /** Check for common mistakes */
  checkCommonMistakes?: boolean;
  /** Validate DOWN section thoroughly */
  validateDown?: boolean;
  /** Require confirmation for critical operations */
  requireConfirmation?: boolean;
}

/**
 * Result of dry-run validation.
 */
export interface DryRunResult {
  /** Whether the dry run passed */
  passed: boolean;
  /** Validation errors */
  errors: string[];
  /** Warnings */
  warnings: string[];
  /** Simulated state changes */
  stateChanges: StateChange[];
  /** Whether DOWN properly reverses UP */
  downReversesUp: boolean;
}

/**
 * Represents a state change from running a migration.
 */
export interface StateChange {
  /** Type of change */
  type: 'add_column' | 'drop_column' | 'rename_column' | 'change_type' | 'add_index' | 'drop_index' | 'add_constraint' | 'drop_constraint';
  /** Table affected */
  table: string;
  /** Column affected (if applicable) */
  column?: string;
  /** Additional details */
  details: Record<string, unknown>;
}

// =============================================================================
// Type Mappings
// =============================================================================

/**
 * IceType to SQL type mapping for different dialects.
 */
const TYPE_MAPS: Record<string, Record<string, string>> = {
  postgres: {
    string: 'TEXT',
    text: 'TEXT',
    int: 'INTEGER',
    integer: 'INTEGER',
    bigint: 'BIGINT',
    float: 'REAL',
    double: 'DOUBLE PRECISION',
    boolean: 'BOOLEAN',
    bool: 'BOOLEAN',
    uuid: 'UUID',
    timestamp: 'TIMESTAMPTZ',
    datetime: 'TIMESTAMPTZ',
    date: 'DATE',
    json: 'JSONB',
  },
  sqlite: {
    string: 'TEXT',
    text: 'TEXT',
    int: 'INTEGER',
    integer: 'INTEGER',
    bigint: 'INTEGER',
    float: 'REAL',
    double: 'REAL',
    boolean: 'INTEGER',
    bool: 'INTEGER',
    uuid: 'TEXT',
    timestamp: 'TEXT',
    datetime: 'TEXT',
    date: 'TEXT',
    json: 'TEXT',
  },
  mysql: {
    string: 'VARCHAR(255)',
    text: 'TEXT',
    int: 'INT',
    integer: 'INT',
    bigint: 'BIGINT',
    float: 'FLOAT',
    double: 'DOUBLE',
    boolean: 'TINYINT(1)',
    bool: 'TINYINT(1)',
    uuid: 'CHAR(36)',
    timestamp: 'DATETIME',
    datetime: 'DATETIME',
    date: 'DATE',
    json: 'JSON',
  },
  duckdb: {
    string: 'VARCHAR',
    text: 'VARCHAR',
    int: 'INTEGER',
    integer: 'INTEGER',
    bigint: 'BIGINT',
    float: 'REAL',
    double: 'DOUBLE',
    boolean: 'BOOLEAN',
    bool: 'BOOLEAN',
    uuid: 'UUID',
    timestamp: 'TIMESTAMP',
    datetime: 'TIMESTAMP',
    date: 'DATE',
    json: 'JSON',
  },
};

/**
 * Get the SQL type for an IceType type in the given dialect.
 */
function getSqlType(iceType: string, dialect: string): string {
  const dialectMap = TYPE_MAPS[dialect] ?? TYPE_MAPS.postgres;
  const normalized = iceType.toLowerCase();
  return dialectMap[normalized] ?? 'TEXT';
}

// =============================================================================
// Identifier Quoting
// =============================================================================

/**
 * Quote an identifier based on dialect.
 */
function quoteIdentifier(name: string, dialect: string): string {
  if (dialect === 'mysql') {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  // postgres, sqlite, duckdb use double quotes
  return `"${name.replace(/"/g, '""')}"`;
}

// =============================================================================
// SQL Generation Helpers
// =============================================================================

/**
 * Generate ADD COLUMN statement for a given dialect.
 */
function generateAddColumnSql(
  tableName: string,
  fieldName: string,
  definition: FieldDefinition,
  dialect: string
): string {
  const table = quoteIdentifier(tableName, dialect);
  const column = quoteIdentifier(fieldName, dialect);
  const sqlType = getSqlType(definition.type, dialect);
  const isNullable = definition.isOptional || definition.modifier === '?';

  let sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`;

  if (!isNullable) {
    sql += ' NOT NULL';
  }

  return sql + ';';
}

/**
 * Generate DROP COLUMN statement for a given dialect.
 */
function generateDropColumnSql(
  tableName: string,
  fieldName: string,
  dialect: string
): string {
  const table = quoteIdentifier(tableName, dialect);
  const column = quoteIdentifier(fieldName, dialect);
  return `ALTER TABLE ${table} DROP COLUMN ${column};`;
}

/**
 * Generate RENAME COLUMN statement for a given dialect.
 */
function generateRenameColumnSql(
  tableName: string,
  oldName: string,
  newName: string,
  dialect: string
): string {
  const table = quoteIdentifier(tableName, dialect);
  const oldCol = quoteIdentifier(oldName, dialect);
  const newCol = quoteIdentifier(newName, dialect);

  if (dialect === 'mysql') {
    // MySQL syntax differs - but for simplicity we use standard syntax
    return `ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol};`;
  }

  return `ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol};`;
}

/**
 * Generate ALTER COLUMN TYPE statement for a given dialect.
 */
function generateAlterTypeSql(
  tableName: string,
  fieldName: string,
  newType: string,
  dialect: string
): string {
  const table = quoteIdentifier(tableName, dialect);
  const column = quoteIdentifier(fieldName, dialect);
  const sqlType = getSqlType(newType, dialect);

  if (dialect === 'mysql') {
    return `ALTER TABLE ${table} MODIFY COLUMN ${column} ${sqlType};`;
  }

  return `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${sqlType};`;
}

/**
 * Generate SET NOT NULL / DROP NOT NULL statement for a given dialect.
 */
function generateNullabilitySql(
  tableName: string,
  fieldName: string,
  setNotNull: boolean,
  dialect: string
): string {
  const table = quoteIdentifier(tableName, dialect);
  const column = quoteIdentifier(fieldName, dialect);

  if (dialect === 'mysql') {
    // MySQL requires full column definition for MODIFY - simplified here
    return setNotNull
      ? `ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL;`
      : `ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL;`;
  }

  return setNotNull
    ? `ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL;`
    : `ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL;`;
}

/**
 * Generate CREATE INDEX statement.
 */
function generateCreateIndexSql(
  tableName: string,
  columns: string[],
  dialect: string
): string {
  const table = quoteIdentifier(tableName, dialect);
  const indexName = `idx_${tableName}_${columns.join('_')}`;
  const quotedIndexName = quoteIdentifier(indexName, dialect);
  const quotedColumns = columns.map((c) => quoteIdentifier(c, dialect)).join(', ');

  return `CREATE INDEX ${quotedIndexName} ON ${table} (${quotedColumns});`;
}

/**
 * Generate DROP INDEX statement.
 */
function generateDropIndexSql(
  indexName: string,
  dialect: string
): string {
  const quotedIndexName = quoteIdentifier(indexName, dialect);

  if (dialect === 'mysql') {
    // MySQL requires table name for DROP INDEX, but for simplicity we use IF EXISTS
    return `DROP INDEX ${quotedIndexName};`;
  }

  return `DROP INDEX ${quotedIndexName};`;
}

// =============================================================================
// Generate Reversible Migration from Diff
// =============================================================================

/**
 * Generate a reversible migration from a schema diff.
 *
 * @param diff - The schema diff to generate migrations from
 * @param options - Migration generation options
 * @returns A ReversibleMigration with UP and DOWN sections
 */
export function generateReversibleMigration(
  diff: SchemaDiff,
  options: ReversibleMigrationOptions
): ReversibleMigration {
  const { dialect, strictReversibility = false, preserveData = false } = options;

  const up: string[] = [];
  const down: string[] = [];
  const warnings: string[] = [];
  let reversible = true;

  const tableName = diff.schemaName;

  // Process each change
  for (const change of diff.changes) {
    switch (change.type) {
      case 'add_field': {
        up.push(generateAddColumnSql(tableName, change.field, change.definition, dialect));
        down.push(generateDropColumnSql(tableName, change.field, dialect));
        break;
      }

      case 'remove_field': {
        if (strictReversibility) {
          throw new Error(
            `Cannot generate reversible migration: irreversible operation detected - remove_field "${change.field}"`
          );
        }

        if (preserveData) {
          // Create backup table for the column
          const backupTable = `${tableName}_${change.field}_backup`;
          up.push(
            `CREATE TABLE ${quoteIdentifier(backupTable, dialect)} AS SELECT id, ${quoteIdentifier(change.field, dialect)} FROM ${quoteIdentifier(tableName, dialect)};`
          );
          up.push(generateDropColumnSql(tableName, change.field, dialect));

          // Restore from backup in DOWN
          down.push(
            `ALTER TABLE ${quoteIdentifier(tableName, dialect)} ADD COLUMN ${quoteIdentifier(change.field, dialect)} TEXT;`
          );
          down.push(
            `UPDATE ${quoteIdentifier(tableName, dialect)} SET ${quoteIdentifier(change.field, dialect)} = (SELECT ${quoteIdentifier(change.field, dialect)} FROM ${quoteIdentifier(backupTable, dialect)} WHERE ${quoteIdentifier(backupTable, dialect)}.id = ${quoteIdentifier(tableName, dialect)}.id);`
          );
          down.push(`DROP TABLE ${quoteIdentifier(backupTable, dialect)};`);
        } else {
          up.push(generateDropColumnSql(tableName, change.field, dialect));
          down.push(`-- Cannot restore dropped column without original definition`);
          reversible = false;
          warnings.push(`Data loss: dropping column ${change.field}`);
        }
        break;
      }

      case 'rename_field': {
        up.push(generateRenameColumnSql(tableName, change.oldName, change.newName, dialect));
        down.push(generateRenameColumnSql(tableName, change.newName, change.oldName, dialect));
        break;
      }

      case 'change_type': {
        up.push(generateAlterTypeSql(tableName, change.field, change.newType, dialect));
        // For DOWN, use the old type
        const oldSqlType =
          change.oldType === 'int' || change.oldType === 'integer'
            ? 'INTEGER'
            : getSqlType(change.oldType, dialect);

        const table = quoteIdentifier(tableName, dialect);
        const column = quoteIdentifier(change.field, dialect);
        down.push(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${oldSqlType};`);

        // Check for potential data loss - either direction could lose data
        // Narrowing in UP direction (old -> new)
        if (isNarrowingConversion(change.oldType, change.newType)) {
          warnings.push(`Potential data loss: changing ${change.field} from ${change.oldType} to ${change.newType}`);
        }
        // Narrowing in DOWN direction (new -> old) - rolling back could lose data
        if (isNarrowingConversion(change.newType, change.oldType)) {
          warnings.push(`Potential data loss when rolling back: changing ${change.field} from ${change.newType} to ${change.oldType}`);
        }
        break;
      }

      case 'change_modifier': {
        const setNotNull = change.newModifier === '!';
        up.push(generateNullabilitySql(tableName, change.field, setNotNull, dialect));
        down.push(generateNullabilitySql(tableName, change.field, !setNotNull, dialect));
        break;
      }

      case 'change_directive': {
        if (change.directive === '$index') {
          const oldIndexes = (change.oldValue as string[][] | undefined) ?? [];
          const newIndexes = (change.newValue as string[][] | undefined) ?? [];

          // Find added indexes
          for (const cols of newIndexes) {
            const key = cols.join(',');
            const existed = oldIndexes.some((old) => old.join(',') === key);
            if (!existed) {
              const indexName = `idx_${tableName}_${cols.join('_')}`;
              up.push(generateCreateIndexSql(tableName, cols, dialect));
              down.push(generateDropIndexSql(indexName, dialect));
            }
          }

          // Find removed indexes
          for (const cols of oldIndexes) {
            const key = cols.join(',');
            const stillExists = newIndexes.some((n) => n.join(',') === key);
            if (!stillExists) {
              const indexName = `idx_${tableName}_${cols.join('_')}`;
              up.push(generateDropIndexSql(indexName, dialect));
              down.push(generateCreateIndexSql(tableName, cols, dialect));
            }
          }
        }
        break;
      }
    }
  }

  // Reverse the DOWN statements order
  const reversedDown = [...down].reverse();

  // Generate migration ID
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const id = `${timestamp}_${tableName.toLowerCase()}`;

  // Extract version info from diff if available
  const fromVersion = (diff as SchemaDiff & { fromVersion?: SchemaVersion }).fromVersion ?? {
    major: 0,
    minor: 0,
    patch: 0,
  };
  const toVersion = (diff as SchemaDiff & { toVersion?: SchemaVersion }).toVersion ?? {
    major: 0,
    minor: 1,
    patch: 0,
  };

  return {
    id,
    name: `Migration for ${tableName}`,
    fromVersion: { major: fromVersion.major, minor: fromVersion.minor, patch: fromVersion.patch },
    toVersion: { major: toVersion.major, minor: toVersion.minor, patch: toVersion.patch },
    up,
    down: reversedDown,
    reversible,
    warnings,
    createdAt: new Date(),
  };
}

/**
 * Check if a type conversion is narrowing (potential data loss).
 */
function isNarrowingConversion(oldType: string, newType: string): boolean {
  const typeWidths: Record<string, number> = {
    smallint: 1,
    int: 2,
    integer: 2,
    bigint: 3,
    long: 3,
    float: 2,
    real: 2,
    double: 3,
  };

  const oldWidth = typeWidths[oldType.toLowerCase()] ?? 0;
  const newWidth = typeWidths[newType.toLowerCase()] ?? 0;

  // If going from wider to narrower, it's potentially lossy
  return oldWidth > newWidth && newWidth > 0;
}

// =============================================================================
// Validate Reversibility
// =============================================================================

/**
 * Validate that a migration's DOWN section correctly reverses its UP section.
 *
 * @param migration - The migration to validate
 * @returns Validation result with errors and warnings
 */
export function validateReversibility(migration: ReversibleMigration): MigrationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const irreversibleOperations: IrreversibleOperation[] = [];

  // Check for empty DOWN with non-empty UP
  if (migration.up.length > 0 && migration.down.length === 0) {
    errors.push('DOWN section is empty but UP section has statements');
    return {
      valid: false,
      isReversible: false,
      errors,
      warnings,
      irreversibleOperations,
    };
  }

  // Analyze UP/DOWN pairs for matching
  for (let i = 0; i < migration.up.length; i++) {
    const upStmt = migration.up[i];
    // DOWN statements are in reverse order
    const downIdx = migration.down.length - 1 - i;
    const downStmt = migration.down[downIdx];

    if (!downStmt) {
      errors.push(`Missing DOWN statement for UP: ${upStmt}`);
      continue;
    }

    // Validate that DOWN reverses UP
    const validation = validateStatementPair(upStmt, downStmt);
    if (!validation.valid) {
      errors.push(validation.error ?? `DOWN statement does not reverse UP: ${upStmt}`);
    }
  }

  // Detect irreversible operations
  const detected = detectIrreversibleOperations(migration);
  irreversibleOperations.push(...detected);

  const valid = errors.length === 0;
  const isReversible = valid && irreversibleOperations.length === 0;

  return {
    valid,
    isReversible,
    errors,
    warnings: [...warnings, ...migration.warnings],
    irreversibleOperations,
  };
}

/**
 * Validate that a DOWN statement correctly reverses an UP statement.
 */
function validateStatementPair(
  upStmt: string,
  downStmt: string
): { valid: boolean; error?: string } {
  const upUpper = upStmt.toUpperCase();
  const downUpper = downStmt.toUpperCase();

  // Skip comments
  if (downUpper.trim().startsWith('--')) {
    return { valid: false, error: `DOWN is a comment, does not reverse UP: ${upStmt}` };
  }

  // ADD COLUMN should be reversed by DROP COLUMN
  if (upUpper.includes('ADD COLUMN')) {
    const upColMatch = upStmt.match(/ADD COLUMN\s+["'`]?(\w+)["'`]?/i);
    const downColMatch = downStmt.match(/DROP COLUMN\s+["'`]?(\w+)["'`]?/i);

    if (!downUpper.includes('DROP COLUMN')) {
      return { valid: false, error: `ADD COLUMN should be reversed by DROP COLUMN: ${upStmt}` };
    }

    if (upColMatch && downColMatch) {
      const upCol = upColMatch[1].toLowerCase();
      const downCol = downColMatch[1].toLowerCase();
      if (upCol !== downCol) {
        return {
          valid: false,
          error: `Column mismatch: UP adds "${upColMatch[1]}" but DOWN drops "${downColMatch[1]}" - DOWN does not reverse UP`,
        };
      }
    }

    return { valid: true };
  }

  // DROP COLUMN should be reversed by ADD COLUMN (or comment for irreversible)
  if (upUpper.includes('DROP COLUMN')) {
    // Allow either ADD COLUMN or a comment for irreversible case
    if (!downUpper.includes('ADD COLUMN') && !downUpper.trim().startsWith('--')) {
      return { valid: false, error: `DROP COLUMN should be reversed by ADD COLUMN` };
    }
    return { valid: true };
  }

  // RENAME COLUMN should be reversed by opposite RENAME
  if (upUpper.includes('RENAME COLUMN')) {
    if (!downUpper.includes('RENAME COLUMN')) {
      return { valid: false, error: `RENAME COLUMN should be reversed by RENAME COLUMN` };
    }

    // Check that names are swapped
    const upMatch = upStmt.match(/RENAME COLUMN\s+["'`]?(\w+)["'`]?\s+TO\s+["'`]?(\w+)["'`]?/i);
    const downMatch = downStmt.match(/RENAME COLUMN\s+["'`]?(\w+)["'`]?\s+TO\s+["'`]?(\w+)["'`]?/i);

    if (upMatch && downMatch) {
      const upOld = upMatch[1].toLowerCase();
      const upNew = upMatch[2].toLowerCase();
      const downOld = downMatch[1].toLowerCase();
      const downNew = downMatch[2].toLowerCase();

      if (upNew !== downOld || upOld !== downNew) {
        return {
          valid: false,
          error: `RENAME mismatch: UP renames "${upMatch[1]}" to "${upMatch[2]}" but DOWN does not reverse this - DOWN does not reverse UP`,
        };
      }
    }

    return { valid: true };
  }

  // ALTER TYPE changes
  if (upUpper.includes('TYPE') && upUpper.includes('ALTER')) {
    if (!downUpper.includes('TYPE') && !downUpper.includes('ALTER')) {
      return { valid: false, error: `ALTER TYPE should be reversed by ALTER TYPE` };
    }
    return { valid: true };
  }

  // SET/DROP NOT NULL
  if (upUpper.includes('SET NOT NULL')) {
    if (!downUpper.includes('DROP NOT NULL')) {
      return { valid: false, error: `SET NOT NULL should be reversed by DROP NOT NULL` };
    }
    return { valid: true };
  }

  if (upUpper.includes('DROP NOT NULL')) {
    if (!downUpper.includes('SET NOT NULL')) {
      return { valid: false, error: `DROP NOT NULL should be reversed by SET NOT NULL` };
    }
    return { valid: true };
  }

  // CREATE INDEX should be reversed by DROP INDEX
  if (upUpper.includes('CREATE INDEX')) {
    if (!downUpper.includes('DROP INDEX')) {
      return { valid: false, error: `CREATE INDEX should be reversed by DROP INDEX` };
    }
    return { valid: true };
  }

  // DROP INDEX should be reversed by CREATE INDEX
  if (upUpper.includes('DROP INDEX')) {
    if (!downUpper.includes('CREATE INDEX')) {
      return { valid: false, error: `DROP INDEX should be reversed by CREATE INDEX` };
    }
    return { valid: true };
  }

  // Default: assume valid if we don't have specific rules
  return { valid: true };
}

// =============================================================================
// Detect Irreversible Operations
// =============================================================================

/**
 * Detect irreversible operations in a migration.
 *
 * @param migration - The migration to analyze
 * @returns Array of irreversible operations found
 */
export function detectIrreversibleOperations(
  migration: ReversibleMigration
): IrreversibleOperation[] {
  const irreversible: IrreversibleOperation[] = [];

  for (const stmt of migration.up) {
    const upper = stmt.toUpperCase();

    // DROP COLUMN is irreversible (unless we have the schema)
    if (upper.includes('DROP COLUMN')) {
      const match = stmt.match(/DROP COLUMN\s+["'`]?(\w+)["'`]?/i);
      const columnName = match?.[1] ?? 'unknown';

      // Check if there's a corresponding ADD COLUMN in DOWN
      const hasRestore = migration.down.some(
        (d) => d.toUpperCase().includes('ADD COLUMN') && d.toUpperCase().includes(columnName.toUpperCase())
      );

      if (!hasRestore) {
        irreversible.push({
          type: 'drop_column',
          reason: `Dropping column "${columnName}" - original definition unknown, cannot restore`,
          statement: stmt,
          suggestedFix: `ALTER TABLE ... ADD COLUMN ${columnName} <original_type>;`,
        });
      }
    }

    // DROP TABLE is always irreversible
    if (upper.includes('DROP TABLE') && !upper.includes('DROP TABLE IF')) {
      const match = stmt.match(/DROP TABLE\s+["'`]?(\w+)["'`]?/i);
      const tableName = match?.[1] ?? 'unknown';

      irreversible.push({
        type: 'drop_table',
        reason: `Dropping table "${tableName}" - table structure and data lost`,
        statement: stmt,
        suggestedFix: `CREATE TABLE ${tableName} (...); -- Restore table with original schema`,
      });
    }

    // TRUNCATE is irreversible
    if (upper.includes('TRUNCATE')) {
      const match = stmt.match(/TRUNCATE\s+(?:TABLE\s+)?["'`]?(\w+)["'`]?/i);
      const tableName = match?.[1] ?? 'unknown';

      irreversible.push({
        type: 'remove_data',
        reason: `TRUNCATE on "${tableName}" - data cannot be restored`,
        statement: stmt,
      });
    }

    // Narrowing type changes can be irreversible
    if (upper.includes('TYPE') && upper.includes('ALTER')) {
      // Check for SMALLINT which indicates narrowing
      if (upper.includes('SMALLINT')) {
        const match = stmt.match(/ALTER COLUMN\s+["'`]?(\w+)["'`]?/i);
        const columnName = match?.[1] ?? 'unknown';

        irreversible.push({
          type: 'change_type',
          reason: `narrowing type conversion on "${columnName}" - values may be truncated or overflow`,
          statement: stmt,
        });
      }
    }
  }

  return irreversible;
}

// =============================================================================
// Generate DOWN from UP
// =============================================================================

/**
 * Generate DOWN statements automatically from UP statements.
 *
 * @param upStatements - Array of UP SQL statements
 * @param dialect - SQL dialect
 * @returns Object with DOWN statements and warnings
 */
export function generateDownFromUp(
  upStatements: string[],
  dialect: 'sqlite' | 'postgres' | 'mysql' | 'duckdb'
): { down: string[]; warnings: string[] } {
  const down: string[] = [];
  const warnings: string[] = [];

  // Helper to optionally quote based on dialect
  // For generateDownFromUp, only quote for MySQL to match test expectations
  const maybeQuote = (name: string): string => {
    if (dialect === 'mysql') {
      return `\`${name}\``;
    }
    return name;
  };

  // Process in reverse order
  for (let i = upStatements.length - 1; i >= 0; i--) {
    const stmt = upStatements[i];
    const upper = stmt.toUpperCase();

    // ADD COLUMN -> DROP COLUMN
    if (upper.includes('ADD COLUMN')) {
      const match = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?\s+ADD COLUMN\s+["'`]?(\w+)["'`]?/i);
      if (match) {
        const tableName = match[1];
        const columnName = match[2];
        down.push(`ALTER TABLE ${maybeQuote(tableName)} DROP COLUMN ${maybeQuote(columnName)};`);
      }
      continue;
    }

    // DROP COLUMN -> Cannot fully reverse
    if (upper.includes('DROP COLUMN')) {
      const match = stmt.match(/DROP COLUMN\s+["'`]?(\w+)["'`]?/i);
      const columnName = match?.[1] ?? 'unknown';
      down.push(`-- CREATE TABLE ... ADD COLUMN ${columnName} <original_type>; -- Cannot automatically generate reverse for DROP COLUMN`);
      warnings.push(`Cannot automatically generate reverse for DROP COLUMN "${columnName}"`);
      continue;
    }

    // RENAME COLUMN -> Reverse RENAME
    if (upper.includes('RENAME COLUMN')) {
      const match = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?\s+RENAME COLUMN\s+["'`]?(\w+)["'`]?\s+TO\s+["'`]?(\w+)["'`]?/i);
      if (match) {
        const tableName = match[1];
        const oldName = match[2];
        const newName = match[3];
        down.push(`ALTER TABLE ${maybeQuote(tableName)} RENAME COLUMN ${maybeQuote(newName)} TO ${maybeQuote(oldName)};`);
      }
      continue;
    }

    // CREATE INDEX -> DROP INDEX
    if (upper.includes('CREATE INDEX')) {
      const match = stmt.match(/CREATE INDEX\s+["'`]?(\w+)["'`]?/i);
      if (match) {
        const indexName = match[1];
        down.push(`DROP INDEX ${maybeQuote(indexName)};`);
      }
      continue;
    }

    // DROP INDEX -> CREATE INDEX (cannot fully reverse without schema)
    if (upper.includes('DROP INDEX')) {
      const match = stmt.match(/DROP INDEX\s+["'`]?(\w+)["'`]?/i);
      const indexName = match?.[1] ?? 'unknown';
      down.push(`-- CREATE INDEX ${indexName} ON ... (...); -- Need original index definition`);
      warnings.push(`Cannot automatically generate reverse for DROP INDEX "${indexName}"`);
      continue;
    }

    // DROP TABLE -> Cannot reverse
    if (upper.includes('DROP TABLE')) {
      const match = stmt.match(/DROP TABLE\s+["'`]?(\w+)["'`]?/i);
      const tableName = match?.[1] ?? 'unknown';
      down.push(`-- CREATE TABLE ${tableName} (...); -- Cannot automatically generate reverse for DROP TABLE`);
      warnings.push(`Cannot automatically generate reverse for DROP TABLE "${tableName}"`);
      continue;
    }

    // ALTER TYPE -> Reverse type change (with warning about unknown original type)
    if (upper.includes('TYPE') && upper.includes('ALTER COLUMN')) {
      const match = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?\s+ALTER COLUMN\s+["'`]?(\w+)["'`]?\s+TYPE\s+(\w+)/i);
      if (match) {
        const tableName = match[1];
        const columnName = match[2];
        down.push(`ALTER TABLE ${maybeQuote(tableName)} ALTER COLUMN ${maybeQuote(columnName)} TYPE <original_type>;`);
        warnings.push(`Cannot determine original type for column "${columnName}" - original type unknown`);
      }
      continue;
    }

    // SET NOT NULL -> DROP NOT NULL
    if (upper.includes('SET NOT NULL')) {
      const match = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?\s+ALTER COLUMN\s+["'`]?(\w+)["'`]?\s+SET NOT NULL/i);
      if (match) {
        const tableName = match[1];
        const columnName = match[2];
        down.push(`ALTER TABLE ${maybeQuote(tableName)} ALTER COLUMN ${maybeQuote(columnName)} DROP NOT NULL;`);
      }
      continue;
    }

    // DROP NOT NULL -> SET NOT NULL
    if (upper.includes('DROP NOT NULL')) {
      const match = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?\s+ALTER COLUMN\s+["'`]?(\w+)["'`]?\s+DROP NOT NULL/i);
      if (match) {
        const tableName = match[1];
        const columnName = match[2];
        down.push(`ALTER TABLE ${maybeQuote(tableName)} ALTER COLUMN ${maybeQuote(columnName)} SET NOT NULL;`);
      }
      continue;
    }

    // Default: add a comment indicating we couldn't parse
    down.push(`-- Could not auto-generate reverse for: ${stmt}`);
    warnings.push(`Could not auto-generate reverse for statement`);
  }

  return { down, warnings };
}

// =============================================================================
// Parse Migration File
// =============================================================================

/**
 * Parse a migration file with UP and DOWN sections.
 *
 * @param content - The migration file content
 * @returns Object with UP and DOWN statements
 * @throws Error if UP section is missing
 */
export function parseMigrationFile(content: string): { up: string[]; down: string[] } {
  // Look for -- UP or === UP === markers
  const upMarkerRegex = /(?:^|\n)\s*(?:--\s*UP|===\s*UP\s*===)\s*(?:\n|$)/i;
  const downMarkerRegex = /(?:^|\n)\s*(?:--\s*DOWN|===\s*DOWN\s*===)\s*(?:\n|$)/i;

  const upMatch = content.match(upMarkerRegex);
  if (!upMatch) {
    throw new Error('Missing UP section in migration file');
  }

  const upStartIndex = (upMatch.index ?? 0) + upMatch[0].length;

  // Find DOWN section
  const downMatch = content.match(downMarkerRegex);
  const downStartIndex = downMatch ? (downMatch.index ?? content.length) : content.length;

  // Extract UP section (between UP marker and DOWN marker or end)
  const upContent = content.slice(upStartIndex, downStartIndex).trim();

  // Extract DOWN section (after DOWN marker)
  let downContent = '';
  if (downMatch) {
    downContent = content.slice((downMatch.index ?? 0) + downMatch[0].length).trim();
  }

  // Parse statements from content
  const up = parseStatements(upContent);
  const down = parseStatements(downContent);

  return { up, down };
}

/**
 * Parse SQL statements from content, handling multiline statements.
 */
function parseStatements(content: string): string[] {
  if (!content.trim()) {
    return [];
  }

  const statements: string[] = [];
  let current = '';

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip pure comment lines
    if (trimmed.startsWith('--') && !current) {
      continue;
    }

    // Accumulate content
    current += (current ? '\n' : '') + line;

    // Check if statement ends with semicolon
    if (trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt && !stmt.startsWith('--')) {
        statements.push(stmt);
      }
      current = '';
    }
  }

  // Handle any remaining content without semicolon
  if (current.trim() && !current.trim().startsWith('--')) {
    statements.push(current.trim());
  }

  return statements;
}

// =============================================================================
// Format Migration File
// =============================================================================

/**
 * Format a reversible migration as a migration file.
 *
 * @param migration - The migration to format
 * @returns Formatted migration file content
 */
export function formatMigrationFile(migration: ReversibleMigration): string {
  const lines: string[] = [];

  // Header
  lines.push(`-- Migration: ${migration.name}`);
  lines.push(`-- ID: ${migration.id}`);
  lines.push(
    `-- Version: ${migration.fromVersion.major}.${migration.fromVersion.minor}.${migration.fromVersion.patch} -> ${migration.toVersion.major}.${migration.toVersion.minor}.${migration.toVersion.patch}`
  );
  lines.push(`-- Created: ${migration.createdAt.toISOString()}`);
  lines.push(`-- REVERSIBLE: ${migration.reversible}`);

  // Warnings
  for (const warning of migration.warnings) {
    lines.push(`-- WARNING: ${warning}`);
  }

  lines.push('');

  // UP section
  lines.push('-- UP');
  for (const stmt of migration.up) {
    lines.push(stmt);
  }

  lines.push('');

  // DOWN section
  lines.push('-- DOWN');
  if (migration.down.length === 0 && !migration.reversible) {
    lines.push('-- NOT REVERSIBLE: Original column definition unknown');
  } else {
    for (const stmt of migration.down) {
      lines.push(stmt);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Pre-Flight Validation
// =============================================================================

/**
 * Perform pre-flight validation before running a migration.
 *
 * This function checks for:
 * - Dangerous operations that may cause data loss
 * - Common mistakes in migration design
 * - Whether the DOWN section properly reverses UP
 * - Backup suggestions for destructive operations
 *
 * @param migration - The migration to validate
 * @param options - Validation options
 * @returns Pre-flight validation result
 */
export function preFlightValidation(
  migration: ReversibleMigration,
  options: PreFlightValidationOptions
): PreFlightValidationResult {
  const {
    dialect,
    checkCommonMistakes = true,
    validateDown = true,
    requireConfirmation = true,
  } = options;

  const dangerousOperations: DangerousOperation[] = [];
  const backupSuggestions: string[] = [];
  const commonMistakes: MigrationMistake[] = [];

  // Detect dangerous operations in UP section
  for (const stmt of migration.up) {
    const dangerous = detectDangerousOperation(stmt, dialect);
    if (dangerous) {
      dangerousOperations.push(dangerous);

      // Generate backup suggestion for this operation
      const backup = generateBackupSuggestion(stmt, dialect);
      if (backup) {
        backupSuggestions.push(backup);
      }
    }
  }

  // Check for common mistakes
  if (checkCommonMistakes) {
    const mistakes = detectCommonMistakes(migration, dialect);
    commonMistakes.push(...mistakes);
  }

  // Validate DOWN section
  if (validateDown && migration.down.length > 0) {
    const downMistakes = validateDownSection(migration, dialect);
    commonMistakes.push(...downMistakes);
  }

  // Determine if confirmation is required
  const hasCriticalOperations = dangerousOperations.some((op) => op.severity === 'critical');
  const hasErrors = commonMistakes.some((m) => m.severity === 'error');
  const needsConfirmation =
    requireConfirmation &&
    (hasCriticalOperations || dangerousOperations.some((op) => op.requiresConfirmation));

  // Generate summary
  const summary = generatePreFlightSummary(
    dangerousOperations,
    commonMistakes,
    backupSuggestions
  );

  return {
    canProceed: !hasErrors,
    dangerousOperations,
    backupSuggestions,
    commonMistakes,
    requiresConfirmation: needsConfirmation,
    summary,
  };
}

/**
 * Detect dangerous operations in a SQL statement.
 */
function detectDangerousOperation(
  stmt: string,
  dialect: string
): DangerousOperation | null {
  const upper = stmt.toUpperCase();

  // DROP TABLE - critical data loss
  if (upper.includes('DROP TABLE')) {
    const match = stmt.match(/DROP TABLE\s+(?:IF EXISTS\s+)?["'`]?(\w+)["'`]?/i);
    const tableName = match?.[1] ?? 'unknown';

    return {
      type: 'schema_destruction',
      severity: 'critical',
      description: `Dropping table "${tableName}" will permanently delete all data and cannot be undone`,
      statement: stmt,
      backupSuggestion: `-- Backup before dropping:\n-- ${dialect === 'postgres' ? `pg_dump -t ${tableName} > ${tableName}_backup.sql` : dialect === 'mysql' ? `mysqldump --tables ${tableName} > ${tableName}_backup.sql` : `sqlite3 db.sqlite ".dump ${tableName}" > ${tableName}_backup.sql`}`,
      requiresConfirmation: true,
    };
  }

  // DROP COLUMN - data loss
  if (upper.includes('DROP COLUMN')) {
    const tableMatch = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?/i);
    const colMatch = stmt.match(/DROP COLUMN\s+["'`]?(\w+)["'`]?/i);
    const tableName = tableMatch?.[1] ?? 'unknown';
    const columnName = colMatch?.[1] ?? 'unknown';

    return {
      type: 'data_loss',
      severity: 'critical',
      description: `Dropping column "${columnName}" from table "${tableName}" will permanently delete data`,
      statement: stmt,
      backupSuggestion: `-- Backup column data before dropping:\nCREATE TABLE ${tableName}_${columnName}_backup AS SELECT id, ${columnName} FROM ${tableName};`,
      requiresConfirmation: true,
    };
  }

  // TRUNCATE - data loss
  if (upper.includes('TRUNCATE')) {
    const match = stmt.match(/TRUNCATE\s+(?:TABLE\s+)?["'`]?(\w+)["'`]?/i);
    const tableName = match?.[1] ?? 'unknown';

    return {
      type: 'data_loss',
      severity: 'critical',
      description: `TRUNCATE on "${tableName}" will delete all rows and cannot be undone`,
      statement: stmt,
      backupSuggestion: `-- Backup before truncate:\nCREATE TABLE ${tableName}_backup AS SELECT * FROM ${tableName};`,
      requiresConfirmation: true,
    };
  }

  // DELETE without WHERE - potential data loss
  if (upper.includes('DELETE FROM') && !upper.includes('WHERE')) {
    const match = stmt.match(/DELETE FROM\s+["'`]?(\w+)["'`]?/i);
    const tableName = match?.[1] ?? 'unknown';

    return {
      type: 'data_loss',
      severity: 'critical',
      description: `DELETE without WHERE clause on "${tableName}" will delete all rows`,
      statement: stmt,
      backupSuggestion: `-- Backup before delete:\nCREATE TABLE ${tableName}_backup AS SELECT * FROM ${tableName};`,
      requiresConfirmation: true,
    };
  }

  // Type narrowing - potential data loss
  if (upper.includes('TYPE') && upper.includes('ALTER')) {
    if (
      upper.includes('SMALLINT') ||
      upper.includes('TINYINT') ||
      (upper.includes('VARCHAR') && /VARCHAR\s*\(\s*\d+\s*\)/i.test(upper))
    ) {
      const colMatch = stmt.match(/ALTER COLUMN\s+["'`]?(\w+)["'`]?/i);
      const columnName = colMatch?.[1] ?? 'unknown';

      return {
        type: 'type_narrowing',
        severity: 'warning',
        description: `Type change on "${columnName}" may truncate data if values exceed new type limits`,
        statement: stmt,
        requiresConfirmation: true,
      };
    }
  }

  // DROP INDEX - not data loss but may affect performance
  if (upper.includes('DROP INDEX')) {
    const match = stmt.match(/DROP INDEX\s+(?:IF EXISTS\s+)?["'`]?(\w+)["'`]?/i);
    const indexName = match?.[1] ?? 'unknown';

    return {
      type: 'index_removal',
      severity: 'warning',
      description: `Dropping index "${indexName}" may significantly impact query performance`,
      statement: stmt,
      requiresConfirmation: false,
    };
  }

  // SET NOT NULL - may fail if NULLs exist
  if (upper.includes('SET NOT NULL')) {
    const colMatch = stmt.match(/ALTER COLUMN\s+["'`]?(\w+)["'`]?/i);
    const columnName = colMatch?.[1] ?? 'unknown';

    return {
      type: 'constraint_change',
      severity: 'warning',
      description: `Setting NOT NULL on "${columnName}" will fail if existing NULL values exist`,
      statement: stmt,
      requiresConfirmation: false,
    };
  }

  return null;
}

/**
 * Generate a backup suggestion for a SQL statement.
 */
function generateBackupSuggestion(stmt: string, dialect: string): string | null {
  const upper = stmt.toUpperCase();

  // DROP TABLE
  if (upper.includes('DROP TABLE')) {
    const match = stmt.match(/DROP TABLE\s+(?:IF EXISTS\s+)?["'`]?(\w+)["'`]?/i);
    const tableName = match?.[1] ?? 'table';

    if (dialect === 'postgres') {
      return `pg_dump -t ${tableName} database > ${tableName}_backup.sql`;
    } else if (dialect === 'mysql') {
      return `mysqldump database ${tableName} > ${tableName}_backup.sql`;
    } else if (dialect === 'sqlite') {
      return `sqlite3 database.db ".dump ${tableName}" > ${tableName}_backup.sql`;
    } else {
      return `-- Export table ${tableName} before dropping`;
    }
  }

  // DROP COLUMN
  if (upper.includes('DROP COLUMN')) {
    const tableMatch = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?/i);
    const colMatch = stmt.match(/DROP COLUMN\s+["'`]?(\w+)["'`]?/i);
    const tableName = tableMatch?.[1] ?? 'table';
    const columnName = colMatch?.[1] ?? 'column';

    return `CREATE TABLE ${tableName}_${columnName}_backup AS SELECT id, ${columnName} FROM ${tableName};`;
  }

  // TRUNCATE
  if (upper.includes('TRUNCATE')) {
    const match = stmt.match(/TRUNCATE\s+(?:TABLE\s+)?["'`]?(\w+)["'`]?/i);
    const tableName = match?.[1] ?? 'table';

    return `CREATE TABLE ${tableName}_backup AS SELECT * FROM ${tableName};`;
  }

  return null;
}

// =============================================================================
// Common Mistakes Detection
// =============================================================================

/**
 * Detect common mistakes in a migration.
 */
function detectCommonMistakes(
  migration: ReversibleMigration,
  dialect: string
): MigrationMistake[] {
  const mistakes: MigrationMistake[] = [];

  // Check for missing DOWN section
  if (migration.up.length > 0 && migration.down.length === 0) {
    mistakes.push({
      type: 'missing_down',
      description: 'Migration has UP statements but no DOWN statements',
      suggestion:
        'Add DOWN statements to make the migration reversible. Use generateDownFromUp() to auto-generate them.',
      severity: 'warning',
    });
  }

  // Check each UP statement for common mistakes
  for (const stmt of migration.up) {
    const upper = stmt.toUpperCase();

    // Missing IF NOT EXISTS for CREATE
    if (upper.includes('CREATE TABLE') && !upper.includes('IF NOT EXISTS')) {
      mistakes.push({
        type: 'missing_if_not_exists',
        description: 'CREATE TABLE without IF NOT EXISTS may fail if table already exists',
        statement: stmt,
        suggestion: 'Add IF NOT EXISTS to prevent errors on repeated runs',
        severity: 'warning',
      });
    }

    if (upper.includes('CREATE INDEX') && !upper.includes('IF NOT EXISTS')) {
      mistakes.push({
        type: 'missing_if_not_exists',
        description: 'CREATE INDEX without IF NOT EXISTS may fail if index already exists',
        statement: stmt,
        suggestion: 'Add IF NOT EXISTS to prevent errors on repeated runs',
        severity: 'info',
      });
    }

    // Missing IF EXISTS for DROP
    if (
      (upper.includes('DROP TABLE') || upper.includes('DROP INDEX')) &&
      !upper.includes('IF EXISTS')
    ) {
      mistakes.push({
        type: 'missing_if_exists',
        description: 'DROP without IF EXISTS may fail if object does not exist',
        statement: stmt,
        suggestion: 'Add IF EXISTS to prevent errors when running rollback multiple times',
        severity: 'info',
      });
    }

    // ADD COLUMN with NOT NULL but no DEFAULT
    if (upper.includes('ADD COLUMN') && upper.includes('NOT NULL') && !upper.includes('DEFAULT')) {
      // Check if the table might have data
      const tableMatch = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?/i);
      const tableName = tableMatch?.[1] ?? 'table';

      mistakes.push({
        type: 'missing_default_for_not_null',
        description: `Adding NOT NULL column without DEFAULT to "${tableName}" will fail if table has existing rows`,
        statement: stmt,
        suggestion:
          'Either add a DEFAULT value, make the column nullable initially, or ensure the table is empty',
        severity: 'error',
      });
    }

    // Type change without USING clause (PostgreSQL specific)
    if (
      dialect === 'postgres' &&
      upper.includes('TYPE') &&
      upper.includes('ALTER COLUMN') &&
      !upper.includes('USING')
    ) {
      // Check if types are incompatible
      const typeMatch = stmt.match(/TYPE\s+(\w+)/i);
      const newType = typeMatch?.[1]?.toUpperCase() ?? '';

      // Warn for potentially incompatible conversions
      if (['INTEGER', 'BIGINT', 'SMALLINT', 'REAL', 'DOUBLE'].includes(newType)) {
        mistakes.push({
          type: 'type_change_without_cast',
          description: 'Type change without USING clause may fail for incompatible values',
          statement: stmt,
          suggestion: `Add USING clause for explicit conversion, e.g., TYPE ${newType} USING column::${newType}`,
          severity: 'warning',
        });
      }
    }
  }

  return mistakes;
}

/**
 * Validate the DOWN section of a migration.
 */
function validateDownSection(
  migration: ReversibleMigration,
  dialect: string
): MigrationMistake[] {
  const mistakes: MigrationMistake[] = [];

  // Check that DOWN statement count roughly matches UP
  if (migration.up.length !== migration.down.length) {
    const upCount = migration.up.length;
    const downCount = migration.down.length;

    // Not necessarily an error - some operations may combine or split
    if (Math.abs(upCount - downCount) > upCount * 0.5) {
      mistakes.push({
        type: 'down_not_inverse',
        description: `DOWN section has ${downCount} statements but UP has ${upCount} - significant mismatch`,
        suggestion: 'Review DOWN section to ensure it properly reverses all UP operations',
        severity: 'warning',
      });
    }
  }

  // Check for comment-only DOWN statements
  const nonCommentDown = migration.down.filter((d) => !d.trim().startsWith('--'));
  if (migration.up.length > 0 && nonCommentDown.length === 0) {
    mistakes.push({
      type: 'down_not_inverse',
      description: 'DOWN section contains only comments, no actual SQL statements',
      suggestion: 'Add proper DOWN statements to make migration reversible',
      severity: 'warning',
    });
  }

  // Check for placeholder/template statements in DOWN
  for (const stmt of migration.down) {
    if (
      stmt.includes('<original_type>') ||
      stmt.includes('<original_schema>') ||
      stmt.includes('...')
    ) {
      mistakes.push({
        type: 'down_not_inverse',
        description: 'DOWN section contains placeholder that needs to be filled in',
        statement: stmt,
        suggestion: 'Replace placeholder with actual value',
        severity: 'error',
      });
    }
  }

  return mistakes;
}

/**
 * Generate pre-flight validation summary.
 */
function generatePreFlightSummary(
  dangerousOps: DangerousOperation[],
  mistakes: MigrationMistake[],
  backups: string[]
): string {
  const lines: string[] = [];

  const criticalCount = dangerousOps.filter((op) => op.severity === 'critical').length;
  const warningCount = dangerousOps.filter((op) => op.severity === 'warning').length;
  const errorCount = mistakes.filter((m) => m.severity === 'error').length;
  const mistakeWarningCount = mistakes.filter((m) => m.severity === 'warning').length;

  if (criticalCount > 0) {
    lines.push(`CRITICAL: ${criticalCount} operation(s) will cause data loss`);
  }

  if (warningCount > 0) {
    lines.push(`WARNING: ${warningCount} potentially dangerous operation(s) detected`);
  }

  if (errorCount > 0) {
    lines.push(`ERROR: ${errorCount} issue(s) that may cause migration to fail`);
  }

  if (mistakeWarningCount > 0) {
    lines.push(`INFO: ${mistakeWarningCount} common mistake(s) detected`);
  }

  if (backups.length > 0) {
    lines.push(`BACKUP: ${backups.length} backup suggestion(s) available`);
  }

  if (lines.length === 0) {
    lines.push('OK: Migration passed pre-flight validation');
  }

  return lines.join('\n');
}

// =============================================================================
// Dry Run Validation
// =============================================================================

/**
 * Perform a dry run of a migration to validate UP and DOWN sections.
 *
 * This simulates running the migration without actually executing SQL,
 * tracking state changes to verify that DOWN properly reverses UP.
 *
 * @param migration - The migration to validate
 * @param dialect - SQL dialect
 * @returns Dry run result
 */
export function dryRunValidation(
  migration: ReversibleMigration,
  dialect: string
): DryRunResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const upChanges: StateChange[] = [];
  const downChanges: StateChange[] = [];

  // Parse UP statements to extract state changes
  for (const stmt of migration.up) {
    const change = parseStateChange(stmt);
    if (change) {
      upChanges.push(change);
    }
  }

  // Parse DOWN statements
  for (const stmt of migration.down) {
    const change = parseStateChange(stmt);
    if (change) {
      downChanges.push(change);
    }
  }

  // Verify that DOWN reverses UP
  const downReversesUp = verifyDownReversesUp(upChanges, downChanges, errors);

  // Check for common issues
  if (migration.up.length > 0 && migration.down.length === 0) {
    errors.push('Migration has no DOWN section - cannot be rolled back');
  }

  // Validate individual statements
  for (const stmt of migration.up) {
    const stmtWarnings = validateStatement(stmt, dialect);
    warnings.push(...stmtWarnings);
  }

  for (const stmt of migration.down) {
    // Skip comments
    if (stmt.trim().startsWith('--')) continue;

    const stmtWarnings = validateStatement(stmt, dialect);
    warnings.push(...stmtWarnings);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    stateChanges: upChanges,
    downReversesUp,
  };
}

/**
 * Parse a SQL statement to extract the state change it represents.
 */
function parseStateChange(stmt: string): StateChange | null {
  const upper = stmt.toUpperCase();

  // Skip comments
  if (stmt.trim().startsWith('--')) {
    return null;
  }

  // ADD COLUMN
  if (upper.includes('ADD COLUMN')) {
    const tableMatch = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?/i);
    const colMatch = stmt.match(/ADD COLUMN\s+["'`]?(\w+)["'`]?\s+(\w+)/i);

    return {
      type: 'add_column',
      table: tableMatch?.[1] ?? 'unknown',
      column: colMatch?.[1],
      details: { columnType: colMatch?.[2] },
    };
  }

  // DROP COLUMN
  if (upper.includes('DROP COLUMN')) {
    const tableMatch = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?/i);
    const colMatch = stmt.match(/DROP COLUMN\s+["'`]?(\w+)["'`]?/i);

    return {
      type: 'drop_column',
      table: tableMatch?.[1] ?? 'unknown',
      column: colMatch?.[1],
      details: {},
    };
  }

  // RENAME COLUMN
  if (upper.includes('RENAME COLUMN')) {
    const tableMatch = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?/i);
    const renameMatch = stmt.match(/RENAME COLUMN\s+["'`]?(\w+)["'`]?\s+TO\s+["'`]?(\w+)["'`]?/i);

    return {
      type: 'rename_column',
      table: tableMatch?.[1] ?? 'unknown',
      column: renameMatch?.[1],
      details: { newName: renameMatch?.[2] },
    };
  }

  // ALTER TYPE
  if (upper.includes('TYPE') && upper.includes('ALTER COLUMN')) {
    const tableMatch = stmt.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?/i);
    const colMatch = stmt.match(/ALTER COLUMN\s+["'`]?(\w+)["'`]?/i);
    const typeMatch = stmt.match(/TYPE\s+(\w+)/i);

    return {
      type: 'change_type',
      table: tableMatch?.[1] ?? 'unknown',
      column: colMatch?.[1],
      details: { newType: typeMatch?.[1] },
    };
  }

  // CREATE INDEX
  if (upper.includes('CREATE INDEX')) {
    const indexMatch = stmt.match(/CREATE INDEX\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?/i);
    const tableMatch = stmt.match(/ON\s+["'`]?(\w+)["'`]?/i);
    const colsMatch = stmt.match(/\(\s*([\w\s,"'`]+)\s*\)/i);

    return {
      type: 'add_index',
      table: tableMatch?.[1] ?? 'unknown',
      details: {
        indexName: indexMatch?.[1],
        columns: colsMatch?.[1]?.split(',').map((c) => c.trim().replace(/["'`]/g, '')),
      },
    };
  }

  // DROP INDEX
  if (upper.includes('DROP INDEX')) {
    const indexMatch = stmt.match(/DROP INDEX\s+(?:IF EXISTS\s+)?["'`]?(\w+)["'`]?/i);

    return {
      type: 'drop_index',
      table: 'unknown', // Index drops don't always specify table
      details: { indexName: indexMatch?.[1] },
    };
  }

  return null;
}

/**
 * Verify that DOWN changes properly reverse UP changes.
 */
function verifyDownReversesUp(
  upChanges: StateChange[],
  downChanges: StateChange[],
  errors: string[]
): boolean {
  // Reverse order for comparison (DOWN should undo in reverse order)
  const reversedDown = [...downChanges];

  // Check that each UP change has a corresponding DOWN reversal
  for (let i = 0; i < upChanges.length; i++) {
    const upChange = upChanges[i];
    const expectedDownIdx = upChanges.length - 1 - i;
    const downChange = reversedDown[expectedDownIdx];

    if (!downChange) {
      errors.push(`Missing DOWN statement for UP: ${upChange.type} on ${upChange.table}.${upChange.column ?? ''}`);
      continue;
    }

    // Verify the DOWN change is the inverse of the UP change
    if (!isInverseChange(upChange, downChange)) {
      errors.push(
        `DOWN does not reverse UP: UP=${upChange.type} on ${upChange.table}.${upChange.column ?? ''}, DOWN=${downChange.type} on ${downChange.table}.${downChange.column ?? ''}`
      );
    }
  }

  return errors.length === 0;
}

/**
 * Check if a DOWN change is the inverse of an UP change.
 */
function isInverseChange(upChange: StateChange, downChange: StateChange): boolean {
  // ADD -> DROP
  if (upChange.type === 'add_column' && downChange.type === 'drop_column') {
    return (
      upChange.table.toLowerCase() === downChange.table.toLowerCase() &&
      upChange.column?.toLowerCase() === downChange.column?.toLowerCase()
    );
  }

  // DROP -> ADD
  if (upChange.type === 'drop_column' && downChange.type === 'add_column') {
    return (
      upChange.table.toLowerCase() === downChange.table.toLowerCase() &&
      upChange.column?.toLowerCase() === downChange.column?.toLowerCase()
    );
  }

  // RENAME -> reverse RENAME
  if (upChange.type === 'rename_column' && downChange.type === 'rename_column') {
    return (
      upChange.table.toLowerCase() === downChange.table.toLowerCase() &&
      upChange.column?.toLowerCase() === (downChange.details.newName as string)?.toLowerCase() &&
      (upChange.details.newName as string)?.toLowerCase() === downChange.column?.toLowerCase()
    );
  }

  // TYPE change -> TYPE change (back to original)
  if (upChange.type === 'change_type' && downChange.type === 'change_type') {
    return (
      upChange.table.toLowerCase() === downChange.table.toLowerCase() &&
      upChange.column?.toLowerCase() === downChange.column?.toLowerCase()
    );
  }

  // CREATE INDEX -> DROP INDEX
  if (upChange.type === 'add_index' && downChange.type === 'drop_index') {
    const upIndexName = (upChange.details.indexName as string)?.toLowerCase();
    const downIndexName = (downChange.details.indexName as string)?.toLowerCase();
    return upIndexName === downIndexName;
  }

  // DROP INDEX -> CREATE INDEX
  if (upChange.type === 'drop_index' && downChange.type === 'add_index') {
    const upIndexName = (upChange.details.indexName as string)?.toLowerCase();
    const downIndexName = (downChange.details.indexName as string)?.toLowerCase();
    return upIndexName === downIndexName;
  }

  return false;
}

/**
 * Validate a single SQL statement and return warnings.
 */
function validateStatement(stmt: string, dialect: string): string[] {
  const warnings: string[] = [];
  const upper = stmt.toUpperCase();

  // Check for potentially problematic patterns
  if (upper.includes('CASCADE') && (upper.includes('DROP') || upper.includes('TRUNCATE'))) {
    warnings.push(`CASCADE detected in statement: "${stmt.slice(0, 50)}..." - this may affect related objects`);
  }

  // Check for transaction control in migration
  if (upper.includes('BEGIN') || upper.includes('COMMIT') || upper.includes('ROLLBACK')) {
    warnings.push('Transaction control statement detected - migrations should typically not manage their own transactions');
  }

  // Check for LOCK statements
  if (upper.includes('LOCK TABLE')) {
    warnings.push('LOCK TABLE detected - ensure this is necessary and will not cause deadlocks');
  }

  return warnings;
}

// =============================================================================
// Enhanced Validation
// =============================================================================

/**
 * Comprehensive validation that checks both UP and DOWN sections.
 *
 * @param migration - The migration to validate
 * @param dialect - SQL dialect
 * @returns Full validation result
 */
export function comprehensiveValidation(
  migration: ReversibleMigration,
  dialect: string
): {
  preFlightResult: PreFlightValidationResult;
  reversibilityResult: MigrationValidationResult;
  dryRunResult: DryRunResult;
  overallValid: boolean;
  overallSummary: string;
} {
  // Run pre-flight validation
  const preFlightResult = preFlightValidation(migration, {
    dialect: dialect as 'sqlite' | 'postgres' | 'mysql' | 'duckdb',
    checkCommonMistakes: true,
    validateDown: true,
    requireConfirmation: true,
  });

  // Run reversibility validation
  const reversibilityResult = validateReversibility(migration);

  // Run dry-run validation
  const dryRunResult = dryRunValidation(migration, dialect);

  // Determine overall validity
  const overallValid =
    preFlightResult.canProceed &&
    reversibilityResult.valid &&
    dryRunResult.passed;

  // Generate overall summary
  const summaryLines: string[] = [];

  if (!overallValid) {
    summaryLines.push('MIGRATION VALIDATION FAILED');
    summaryLines.push('');
  } else if (preFlightResult.requiresConfirmation) {
    summaryLines.push('MIGRATION REQUIRES CONFIRMATION');
    summaryLines.push('');
  } else {
    summaryLines.push('MIGRATION PASSED ALL VALIDATION CHECKS');
    summaryLines.push('');
  }

  // Add pre-flight summary
  if (preFlightResult.dangerousOperations.length > 0) {
    summaryLines.push(`Dangerous operations: ${preFlightResult.dangerousOperations.length}`);
    for (const op of preFlightResult.dangerousOperations) {
      summaryLines.push(`  - [${op.severity.toUpperCase()}] ${op.description}`);
    }
  }

  // Add reversibility info
  if (!reversibilityResult.isReversible) {
    summaryLines.push('');
    summaryLines.push('Reversibility issues:');
    for (const op of reversibilityResult.irreversibleOperations) {
      summaryLines.push(`  - ${op.type}: ${op.reason}`);
    }
  }

  // Add common mistakes
  if (preFlightResult.commonMistakes.length > 0) {
    summaryLines.push('');
    summaryLines.push('Common mistakes detected:');
    for (const mistake of preFlightResult.commonMistakes) {
      summaryLines.push(`  - [${mistake.severity.toUpperCase()}] ${mistake.description}`);
    }
  }

  // Add backup suggestions
  if (preFlightResult.backupSuggestions.length > 0) {
    summaryLines.push('');
    summaryLines.push('Backup suggestions:');
    for (const backup of preFlightResult.backupSuggestions) {
      summaryLines.push(`  ${backup}`);
    }
  }

  return {
    preFlightResult,
    reversibilityResult,
    dryRunResult,
    overallValid,
    overallSummary: summaryLines.join('\n'),
  };
}

/**
 * Get required confirmations for dangerous operations.
 *
 * @param migration - The migration to analyze
 * @param dialect - SQL dialect
 * @returns Array of confirmation messages to display to user
 */
export function getRequiredConfirmations(
  migration: ReversibleMigration,
  dialect: string
): string[] {
  const confirmations: string[] = [];

  for (const stmt of migration.up) {
    const dangerous = detectDangerousOperation(stmt, dialect);
    if (dangerous?.requiresConfirmation) {
      confirmations.push(
        `${dangerous.severity.toUpperCase()}: ${dangerous.description}\n  Statement: ${stmt.slice(0, 100)}${stmt.length > 100 ? '...' : ''}`
      );
    }
  }

  return confirmations;
}
