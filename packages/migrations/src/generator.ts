/**
 * Migration Generator Module for @icetype/migrations
 *
 * Provides interfaces and functions for generating SQL migration statements
 * from schema diffs.
 *
 * @packageDocumentation
 */

import type { SchemaDiff, SchemaChange, FieldDefinition } from '@icetype/core';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported SQL dialects for migration generation.
 */
export type Dialect = 'sqlite' | 'postgres' | 'mysql' | 'duckdb';

/**
 * Options for migration generators.
 */
export interface GeneratorOptions {
  /** Whether to quote identifiers (default: false) */
  quoteIdentifiers?: boolean;
  /** Whether to end statements with semicolons (default: true) */
  semicolons?: boolean;
  /** Custom type mappings override */
  typeMappings?: Partial<Record<string, string>>;
}

/**
 * Interface that dialect-specific adapters implement for generating SQL.
 */
export interface MigrationGenerator {
  /** The dialect this generator produces */
  readonly dialect: Dialect;

  /**
   * Generate SQL statements for a schema diff.
   * @param diff - The schema diff to generate migration for
   * @returns Array of SQL statements
   */
  generate(diff: SchemaDiff): string[];

  /**
   * Generate rollback SQL statements for a schema diff.
   * @param diff - The schema diff to generate rollback for
   * @returns Array of SQL statements for rollback
   */
  generateRollback(diff: SchemaDiff): string[];
}

// =============================================================================
// Type Mappings
// =============================================================================

const SQLITE_TYPE_MAP: Record<string, string> = {
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
  blob: 'BLOB',
};

const POSTGRES_TYPE_MAP: Record<string, string> = {
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
  blob: 'BYTEA',
};

const MYSQL_TYPE_MAP: Record<string, string> = {
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
  blob: 'BLOB',
};

const DUCKDB_TYPE_MAP: Record<string, string> = {
  string: 'VARCHAR',
  text: 'VARCHAR',
  int: 'INTEGER',
  integer: 'INTEGER',
  bigint: 'BIGINT',
  float: 'FLOAT',
  double: 'DOUBLE',
  boolean: 'BOOLEAN',
  bool: 'BOOLEAN',
  uuid: 'UUID',
  timestamp: 'TIMESTAMP',
  datetime: 'TIMESTAMP',
  date: 'DATE',
  json: 'JSON',
  blob: 'BLOB',
};

const TYPE_MAPS: Record<Dialect, Record<string, string>> = {
  sqlite: SQLITE_TYPE_MAP,
  postgres: POSTGRES_TYPE_MAP,
  mysql: MYSQL_TYPE_MAP,
  duckdb: DUCKDB_TYPE_MAP,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the SQL type for a given IceType type in a specific dialect.
 */
function getSqlType(type: string, dialect: Dialect, customMappings?: Partial<Record<string, string>>): string {
  if (customMappings?.[type]) {
    return customMappings[type]!;
  }
  const typeMap = TYPE_MAPS[dialect];
  return typeMap[type.toLowerCase()] ?? 'TEXT';
}

/**
 * Quote an identifier based on dialect.
 */
function quoteIdentifier(name: string, dialect: Dialect, quote: boolean): string {
  if (!quote) return name;
  switch (dialect) {
    case 'mysql':
      return `\`${name}\``;
    case 'postgres':
    case 'duckdb':
      return `"${name}"`;
    case 'sqlite':
    default:
      return `"${name}"`;
  }
}

/**
 * Check if a field definition is nullable.
 */
function isNullable(definition: FieldDefinition): boolean {
  return definition.isOptional || definition.modifier === '?';
}

/**
 * Generate statement ending based on options.
 */
function ending(options: GeneratorOptions): string {
  return options.semicolons !== false ? ';' : '';
}

// =============================================================================
// Statement Generators
// =============================================================================

function generateAddColumn(
  tableName: string,
  change: SchemaChange & { type: 'add_field' },
  dialect: Dialect,
  options: GeneratorOptions
): string {
  const table = quoteIdentifier(tableName, dialect, !!options.quoteIdentifiers);
  const column = quoteIdentifier(change.field, dialect, !!options.quoteIdentifiers);
  const sqlType = getSqlType(change.definition.type, dialect, options.typeMappings);
  const nullable = isNullable(change.definition) ? '' : ' NOT NULL';

  return `ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}${nullable}${ending(options)}`;
}

function generateDropColumn(
  tableName: string,
  change: SchemaChange & { type: 'remove_field' },
  dialect: Dialect,
  options: GeneratorOptions
): string {
  const table = quoteIdentifier(tableName, dialect, !!options.quoteIdentifiers);
  const column = quoteIdentifier(change.field, dialect, !!options.quoteIdentifiers);

  return `ALTER TABLE ${table} DROP COLUMN ${column}${ending(options)}`;
}

function generateRenameColumn(
  tableName: string,
  change: SchemaChange & { type: 'rename_field' },
  dialect: Dialect,
  options: GeneratorOptions
): string {
  const table = quoteIdentifier(tableName, dialect, !!options.quoteIdentifiers);
  const oldName = quoteIdentifier(change.oldName, dialect, !!options.quoteIdentifiers);
  const newName = quoteIdentifier(change.newName, dialect, !!options.quoteIdentifiers);

  switch (dialect) {
    case 'mysql':
      // MySQL requires the type in RENAME COLUMN, but we don't have it here
      // Use the newer RENAME COLUMN syntax (MySQL 8.0+)
      return `ALTER TABLE ${table} RENAME COLUMN ${oldName} TO ${newName}${ending(options)}`;
    default:
      return `ALTER TABLE ${table} RENAME COLUMN ${oldName} TO ${newName}${ending(options)}`;
  }
}

function generateAlterType(
  tableName: string,
  change: SchemaChange & { type: 'change_type' },
  dialect: Dialect,
  options: GeneratorOptions
): string {
  const table = quoteIdentifier(tableName, dialect, !!options.quoteIdentifiers);
  const column = quoteIdentifier(change.field, dialect, !!options.quoteIdentifiers);
  const newType = getSqlType(change.newType, dialect, options.typeMappings);

  switch (dialect) {
    case 'postgres':
      return `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${newType}${ending(options)}`;
    case 'mysql':
      return `ALTER TABLE ${table} MODIFY COLUMN ${column} ${newType}${ending(options)}`;
    case 'sqlite':
      // SQLite doesn't support ALTER COLUMN TYPE directly - requires table recreation
      // Return a comment indicating manual intervention needed
      return `-- SQLite: Cannot alter column type. Recreate table with: ${column} ${newType}${ending(options)}`;
    case 'duckdb':
      return `ALTER TABLE ${table} ALTER ${column} TYPE ${newType}${ending(options)}`;
    default:
      return `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${newType}${ending(options)}`;
  }
}

function generateAlterModifier(
  tableName: string,
  change: SchemaChange & { type: 'change_modifier' },
  dialect: Dialect,
  options: GeneratorOptions
): string {
  const table = quoteIdentifier(tableName, dialect, !!options.quoteIdentifiers);
  const column = quoteIdentifier(change.field, dialect, !!options.quoteIdentifiers);
  const setNotNull = change.newModifier === '!' || change.newModifier === '#';

  switch (dialect) {
    case 'postgres':
      return setNotNull
        ? `ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL${ending(options)}`
        : `ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL${ending(options)}`;
    case 'mysql':
      // MySQL requires full column definition - simplified version
      return setNotNull
        ? `ALTER TABLE ${table} MODIFY ${column} SET NOT NULL${ending(options)}`
        : `ALTER TABLE ${table} MODIFY ${column} DROP NOT NULL${ending(options)}`;
    case 'sqlite':
      return `-- SQLite: Cannot alter column nullability. Recreate table for ${column}${ending(options)}`;
    case 'duckdb':
      return setNotNull
        ? `ALTER TABLE ${table} ALTER ${column} SET NOT NULL${ending(options)}`
        : `ALTER TABLE ${table} ALTER ${column} DROP NOT NULL${ending(options)}`;
    default:
      return `ALTER TABLE ${table} ALTER COLUMN ${column} ${setNotNull ? 'SET' : 'DROP'} NOT NULL${ending(options)}`;
  }
}

function generateCreateIndex(
  tableName: string,
  change: SchemaChange & { type: 'change_directive' },
  dialect: Dialect,
  options: GeneratorOptions
): string[] {
  const statements: string[] = [];
  const table = quoteIdentifier(tableName, dialect, !!options.quoteIdentifiers);

  if (change.directive === '$index' && change.newValue) {
    const indexes = change.newValue as string[][];
    for (const columns of indexes) {
      const indexName = `idx_${tableName}_${columns.join('_')}`;
      const quotedIndexName = quoteIdentifier(indexName, dialect, !!options.quoteIdentifiers);
      const quotedColumns = columns
        .map((c) => quoteIdentifier(c, dialect, !!options.quoteIdentifiers))
        .join(', ');

      statements.push(`CREATE INDEX ${quotedIndexName} ON ${table} (${quotedColumns})${ending(options)}`);
    }
  }

  return statements;
}

// =============================================================================
// Main Generator Implementation
// =============================================================================

class DefaultMigrationGenerator implements MigrationGenerator {
  constructor(
    public readonly dialect: Dialect,
    private readonly options: GeneratorOptions = {}
  ) {}

  generate(diff: SchemaDiff): string[] {
    const statements: string[] = [];

    for (const change of diff.changes) {
      switch (change.type) {
        case 'add_field':
          statements.push(generateAddColumn(diff.schemaName, change, this.dialect, this.options));
          break;

        case 'remove_field':
          statements.push(generateDropColumn(diff.schemaName, change, this.dialect, this.options));
          break;

        case 'rename_field':
          statements.push(generateRenameColumn(diff.schemaName, change, this.dialect, this.options));
          break;

        case 'change_type':
          statements.push(generateAlterType(diff.schemaName, change, this.dialect, this.options));
          break;

        case 'change_modifier':
          statements.push(generateAlterModifier(diff.schemaName, change, this.dialect, this.options));
          break;

        case 'change_directive':
          const indexStatements = generateCreateIndex(diff.schemaName, change, this.dialect, this.options);
          statements.push(...indexStatements);
          break;
      }
    }

    return statements;
  }

  generateRollback(diff: SchemaDiff): string[] {
    const statements: string[] = [];

    // Process changes in reverse order for rollback
    for (const change of [...diff.changes].reverse()) {
      switch (change.type) {
        case 'add_field':
          // Rollback: drop the added column
          statements.push(
            generateDropColumn(
              diff.schemaName,
              { type: 'remove_field', field: change.field },
              this.dialect,
              this.options
            )
          );
          break;

        case 'remove_field':
          // Rollback: we can't restore a dropped column without knowing its definition
          statements.push(
            `-- Cannot rollback DROP COLUMN ${change.field}: original definition unknown`
          );
          break;

        case 'rename_field':
          // Rollback: rename back
          statements.push(
            generateRenameColumn(
              diff.schemaName,
              { type: 'rename_field', oldName: change.newName, newName: change.oldName },
              this.dialect,
              this.options
            )
          );
          break;

        case 'change_type':
          // Rollback: change type back
          statements.push(
            generateAlterType(
              diff.schemaName,
              { type: 'change_type', field: change.field, oldType: change.newType, newType: change.oldType },
              this.dialect,
              this.options
            )
          );
          break;

        case 'change_modifier':
          // Rollback: change modifier back
          statements.push(
            generateAlterModifier(
              diff.schemaName,
              { type: 'change_modifier', field: change.field, oldModifier: change.newModifier, newModifier: change.oldModifier },
              this.dialect,
              this.options
            )
          );
          break;

        case 'change_directive':
          if (change.directive === '$index' && change.newValue) {
            // Rollback: drop the created indexes
            const indexes = change.newValue as string[][];
            for (const columns of indexes) {
              const indexName = `idx_${diff.schemaName}_${columns.join('_')}`;
              const quotedIndexName = quoteIdentifier(indexName, this.dialect, !!this.options.quoteIdentifiers);
              statements.push(`DROP INDEX ${quotedIndexName}${ending(this.options)}`);
            }
          }
          break;
      }
    }

    return statements;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a MigrationGenerator for a specific dialect.
 *
 * @param dialect - The SQL dialect to generate for
 * @param options - Optional configuration options
 * @returns A MigrationGenerator instance
 * @throws Error if the dialect is not supported
 *
 * @example
 * ```typescript
 * const generator = createMigrationGenerator('postgres');
 * const statements = generator.generate(diff);
 * ```
 */
export function createMigrationGenerator(dialect: Dialect, options: GeneratorOptions = {}): MigrationGenerator {
  const validDialects: Dialect[] = ['sqlite', 'postgres', 'mysql', 'duckdb'];
  if (!validDialects.includes(dialect)) {
    throw new Error(`Unsupported dialect: ${dialect}. Supported: ${validDialects.join(', ')}`);
  }

  return new DefaultMigrationGenerator(dialect, options);
}

/**
 * Generate migration SQL statements for a schema diff.
 *
 * This is a convenience function that creates a generator and generates statements
 * in one call.
 *
 * @param diff - The schema diff to generate migration for
 * @param dialect - The SQL dialect to generate for
 * @param options - Optional configuration options
 * @returns Array of SQL statements
 *
 * @example
 * ```typescript
 * const statements = generateMigration(diff, 'sqlite');
 * for (const stmt of statements) {
 *   await db.execute(stmt);
 * }
 * ```
 */
export function generateMigration(
  diff: SchemaDiff,
  dialect: Dialect,
  options: GeneratorOptions = {}
): string[] {
  const generator = createMigrationGenerator(dialect, options);
  return generator.generate(diff);
}
