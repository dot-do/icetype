/**
 * PostgreSQL Migration Generator
 *
 * Generates PostgreSQL-specific ALTER TABLE statements from IceType schema diffs.
 * Implements the MigrationGenerator interface from @icetype/migrations.
 *
 * Features:
 * - Proper PostgreSQL ALTER TABLE statements
 * - CREATE INDEX CONCURRENTLY for production safety
 * - USING clause for type conversions
 * - Proper identifier quoting with double quotes
 *
 * @packageDocumentation
 */

import type { SchemaDiff, SchemaChange } from '@icetype/core';
import type { Dialect, MigrationGenerator } from '@icetype/migrations';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for PostgreSQL migration generation.
 */
export interface PostgresMigrationOptions {
  /** Use CONCURRENTLY for index operations (default: true) */
  concurrentIndexes?: boolean;
}

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * IceType to PostgreSQL type mapping.
 */
const POSTGRES_TYPE_MAP: Record<string, string> = {
  string: 'TEXT',
  text: 'TEXT',
  int: 'INTEGER',
  integer: 'INTEGER',
  bigint: 'BIGINT',
  long: 'BIGINT',
  float: 'REAL',
  double: 'DOUBLE PRECISION',
  boolean: 'BOOLEAN',
  bool: 'BOOLEAN',
  uuid: 'UUID',
  timestamp: 'TIMESTAMPTZ',
  timestamptz: 'TIMESTAMPTZ',
  datetime: 'TIMESTAMPTZ',
  date: 'DATE',
  time: 'TIME',
  json: 'JSONB',
  jsonb: 'JSONB',
  blob: 'BYTEA',
  binary: 'BYTEA',
  bytea: 'BYTEA',
  decimal: 'DECIMAL',
  numeric: 'NUMERIC',
};

/**
 * Get the PostgreSQL type for an IceType type.
 */
function getPostgresType(iceType: string): string {
  const normalized = iceType.toLowerCase();
  return POSTGRES_TYPE_MAP[normalized] ?? 'TEXT';
}

// =============================================================================
// Identifier Quoting
// =============================================================================

/**
 * Quote a PostgreSQL identifier with double quotes.
 */
function quoteIdentifier(name: string): string {
  // Always quote for safety and consistency
  return `"${name.replace(/"/g, '""')}"`;
}

// =============================================================================
// Default Value Formatting
// =============================================================================

/**
 * Format a default value for PostgreSQL.
 */
function formatDefault(value: unknown): string {
  if (value === null) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    // Escape single quotes
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  if (typeof value === 'object') {
    // JSON value
    const escaped = JSON.stringify(value).replace(/'/g, "''");
    return `'${escaped}'::jsonb`;
  }

  return String(value);
}

// =============================================================================
// Type Conversion USING Clauses
// =============================================================================

/**
 * Check if a type conversion needs a USING clause.
 */
function needsUsingClause(fromType: string, toType: string): boolean {
  const from = fromType.toLowerCase();
  const to = toType.toLowerCase();

  // Compatible conversions that don't need USING
  const compatiblePairs: Array<[string, string]> = [
    ['int', 'bigint'],
    ['integer', 'bigint'],
    ['int', 'long'],
    ['float', 'double'],
    ['real', 'double precision'],
    ['varchar', 'text'],
    ['string', 'text'],
    ['char', 'text'],
    ['timestamp', 'timestamptz'],
  ];

  for (const [a, b] of compatiblePairs) {
    if ((from === a && to === b) || (from === b && to === a)) {
      // Widening is always compatible without USING
      if (from === a && to === b) return false;
    }
  }

  // If types are different, likely need USING for explicit cast
  return from !== to;
}

/**
 * Generate USING clause for type conversion.
 */
function generateUsingClause(column: string, toType: string): string {
  const pgType = getPostgresType(toType);
  return ` USING ${quoteIdentifier(column)}::${pgType}`;
}

// =============================================================================
// Statement Generators
// =============================================================================

function generateAddColumn(
  tableName: string,
  change: SchemaChange & { type: 'add_field' }
): string {
  const table = quoteIdentifier(tableName);
  const column = quoteIdentifier(change.field);
  const pgType = getPostgresType(change.definition.type);
  const isNullable = change.definition.isOptional || change.definition.modifier === '?';

  let sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${pgType}`;

  if (!isNullable) {
    sql += ' NOT NULL';
  }

  if (change.definition.defaultValue !== undefined) {
    sql += ` DEFAULT ${formatDefault(change.definition.defaultValue)}`;
  }

  return sql + ';';
}

function generateDropColumn(tableName: string, change: SchemaChange & { type: 'remove_field' }): string {
  const table = quoteIdentifier(tableName);
  const column = quoteIdentifier(change.field);
  return `ALTER TABLE ${table} DROP COLUMN ${column};`;
}

function generateRenameColumn(
  tableName: string,
  change: SchemaChange & { type: 'rename_field' }
): string {
  const table = quoteIdentifier(tableName);
  const oldName = quoteIdentifier(change.oldName);
  const newName = quoteIdentifier(change.newName);
  return `ALTER TABLE ${table} RENAME COLUMN ${oldName} TO ${newName};`;
}

function generateAlterType(
  tableName: string,
  change: SchemaChange & { type: 'change_type' }
): string {
  const table = quoteIdentifier(tableName);
  const column = quoteIdentifier(change.field);
  const newPgType = getPostgresType(change.newType);

  let sql = `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${newPgType}`;

  if (needsUsingClause(change.oldType, change.newType)) {
    sql += generateUsingClause(change.field, change.newType);
  }

  return sql + ';';
}

function generateAlterModifier(
  tableName: string,
  change: SchemaChange & { type: 'change_modifier' }
): string {
  const table = quoteIdentifier(tableName);
  const column = quoteIdentifier(change.field);

  // newModifier === '!' means required, '?' means optional, '' means default (not null)
  const setNotNull = change.newModifier === '!' || change.newModifier === '#';

  return setNotNull
    ? `ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL;`
    : `ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL;`;
}

function generateCreateIndex(
  tableName: string,
  change: SchemaChange & { type: 'change_directive' },
  concurrently: boolean
): string[] {
  const statements: string[] = [];
  const table = quoteIdentifier(tableName);

  if (change.directive === '$index' && change.newValue) {
    const indexes = change.newValue as string[][];
    for (const columns of indexes) {
      const indexName = `idx_${tableName}_${columns.join('_')}`;
      const quotedIndexName = quoteIdentifier(indexName);
      const quotedColumns = columns.map(quoteIdentifier).join(', ');
      const concurrent = concurrently ? 'CONCURRENTLY ' : '';

      statements.push(
        `CREATE INDEX ${concurrent}${quotedIndexName} ON ${table} (${quotedColumns});`
      );
    }
  }

  return statements;
}

function generateDropIndex(indexName: string, concurrently: boolean): string {
  const quotedIndexName = quoteIdentifier(indexName);
  const concurrent = concurrently ? 'CONCURRENTLY ' : '';
  return `DROP INDEX ${concurrent}IF EXISTS ${quotedIndexName};`;
}

// =============================================================================
// PostgresMigrationGenerator Class
// =============================================================================

/**
 * PostgreSQL-specific migration generator.
 *
 * Generates proper PostgreSQL ALTER TABLE statements from IceType schema diffs.
 *
 * @example
 * ```typescript
 * import { PostgresMigrationGenerator } from '@icetype/postgres';
 * import { diffSchemas } from '@icetype/core';
 *
 * const diff = diffSchemas(oldSchema, newSchema);
 * const generator = new PostgresMigrationGenerator();
 * const statements = generator.generate(diff);
 *
 * for (const sql of statements) {
 *   await client.query(sql);
 * }
 * ```
 */
export class PostgresMigrationGenerator implements MigrationGenerator {
  readonly dialect: Dialect = 'postgres';
  private readonly options: PostgresMigrationOptions;

  constructor(options: PostgresMigrationOptions = {}) {
    this.options = {
      concurrentIndexes: true,
      ...options,
    };
  }

  /**
   * Generate SQL statements for a schema diff.
   *
   * @param diff - The schema diff to generate migration for
   * @returns Array of SQL statements
   */
  generate(diff: SchemaDiff): string[] {
    if (diff.changes.length === 0) {
      return [];
    }

    const statements: string[] = [];
    const { concurrentIndexes = true } = this.options;

    for (const change of diff.changes) {
      switch (change.type) {
        case 'add_field':
          statements.push(generateAddColumn(diff.schemaName, change));
          break;

        case 'remove_field':
          statements.push(generateDropColumn(diff.schemaName, change));
          break;

        case 'rename_field':
          statements.push(generateRenameColumn(diff.schemaName, change));
          break;

        case 'change_type':
          statements.push(generateAlterType(diff.schemaName, change));
          break;

        case 'change_modifier':
          statements.push(generateAlterModifier(diff.schemaName, change));
          break;

        case 'change_directive':
          const indexStatements = generateCreateIndex(
            diff.schemaName,
            change,
            concurrentIndexes
          );
          statements.push(...indexStatements);
          break;
      }
    }

    return statements;
  }

  /**
   * Generate rollback SQL statements for a schema diff.
   *
   * @param diff - The schema diff to generate rollback for
   * @returns Array of SQL statements for rollback
   */
  generateRollback(diff: SchemaDiff): string[] {
    if (diff.changes.length === 0) {
      return [];
    }

    const statements: string[] = [];
    const { concurrentIndexes = true } = this.options;

    // Process changes in reverse order for rollback
    for (const change of [...diff.changes].reverse()) {
      switch (change.type) {
        case 'add_field':
          // Rollback: drop the added column
          statements.push(
            generateDropColumn(diff.schemaName, { type: 'remove_field', field: change.field })
          );
          break;

        case 'remove_field':
          // Cannot fully rollback without knowing original column definition
          statements.push(
            `-- Cannot rollback DROP COLUMN ${change.field}: original definition unknown`
          );
          break;

        case 'rename_field':
          // Rollback: rename back
          statements.push(
            generateRenameColumn(diff.schemaName, {
              type: 'rename_field',
              oldName: change.newName,
              newName: change.oldName,
            })
          );
          break;

        case 'change_type':
          // Rollback: change type back
          statements.push(
            generateAlterType(diff.schemaName, {
              type: 'change_type',
              field: change.field,
              oldType: change.newType,
              newType: change.oldType,
            })
          );
          break;

        case 'change_modifier':
          // Rollback: change modifier back
          statements.push(
            generateAlterModifier(diff.schemaName, {
              type: 'change_modifier',
              field: change.field,
              oldModifier: change.newModifier,
              newModifier: change.oldModifier,
            })
          );
          break;

        case 'change_directive':
          if (change.directive === '$index' && change.newValue) {
            // Rollback: drop the created indexes
            const indexes = change.newValue as string[][];
            for (const columns of indexes) {
              const indexName = `idx_${diff.schemaName}_${columns.join('_')}`;
              statements.push(generateDropIndex(indexName, concurrentIndexes));
            }
          }
          break;
      }
    }

    return statements;
  }
}

/**
 * Create a PostgresMigrationGenerator instance.
 *
 * @param options - Optional configuration
 * @returns A new PostgresMigrationGenerator
 */
export function createPostgresMigrationGenerator(
  options?: PostgresMigrationOptions
): PostgresMigrationGenerator {
  return new PostgresMigrationGenerator(options);
}
