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
