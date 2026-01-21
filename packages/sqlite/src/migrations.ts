/**
 * SQLite Migration Generator
 *
 * Generates SQLite-specific migration SQL with workarounds for SQLite's
 * limited ALTER TABLE support.
 *
 * SQLite ALTER TABLE Limitations:
 * - Supports: ADD COLUMN, RENAME COLUMN (3.25+)
 * - Does NOT directly support: DROP COLUMN, TYPE changes, constraint changes
 *
 * For unsupported operations, we use the table recreation pattern:
 * 1. CREATE TABLE temp_table AS SELECT ... FROM original
 * 2. DROP TABLE original
 * 3. CREATE TABLE original (...new schema...)
 * 4. INSERT INTO original SELECT ... FROM temp_table
 * 5. DROP TABLE temp_table
 *
 * @packageDocumentation
 */

import type { SchemaDiff, SchemaChange, FieldDefinition } from '@icetype/core';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for SQLite migration generation.
 */
export interface SQLiteMigrationOptions {
  /** Whether to quote identifiers (default: false) */
  quoteIdentifiers?: boolean;
  /** Whether to end statements with semicolons (default: true) */
  semicolons?: boolean;
  /** Custom type mappings override */
  typeMappings?: Partial<Record<string, string>>;
}

/**
 * Represents a column in the table schema.
 */
export interface TableColumn {
  /** Column name */
  name: string;
  /** SQLite type */
  type: string;
  /** Whether the column allows NULL */
  nullable: boolean;
  /** Default value (as SQL expression) */
  default?: string;
  /** Whether this is a primary key column */
  primaryKey?: boolean;
  /** Whether this column has a unique constraint */
  unique?: boolean;
}

/**
 * Represents the current table schema (needed for table recreation).
 */
export interface TableSchema {
  /** Table name */
  tableName: string;
  /** Column definitions */
  columns: TableColumn[];
  /** Primary key column names */
  primaryKey?: string[];
  /** Unique constraints */
  uniqueConstraints?: string[][];
}

/**
 * Interface for migration generators (from @icetype/migrations).
 */
export interface MigrationGenerator {
  /** The dialect this generator produces */
  readonly dialect: 'sqlite' | 'postgres' | 'mysql' | 'duckdb';

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

/**
 * Default IceType to SQLite type mappings.
 */
const ICETYPE_TO_SQLITE: Record<string, string> = {
  string: 'TEXT',
  text: 'TEXT',
  int: 'INTEGER',
  integer: 'INTEGER',
  bigint: 'INTEGER',
  long: 'INTEGER',
  float: 'REAL',
  double: 'REAL',
  boolean: 'INTEGER',
  bool: 'INTEGER',
  uuid: 'TEXT',
  timestamp: 'TEXT',
  timestamptz: 'TEXT',
  datetime: 'TEXT',
  date: 'TEXT',
  time: 'TEXT',
  json: 'TEXT',
  blob: 'BLOB',
  binary: 'BLOB',
  decimal: 'REAL',
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the SQLite type for a given IceType type.
 */
function getSqliteType(
  iceType: string,
  customMappings?: Partial<Record<string, string>>
): string {
  if (customMappings?.[iceType]) {
    return customMappings[iceType]!;
  }
  return ICETYPE_TO_SQLITE[iceType.toLowerCase()] ?? 'TEXT';
}

/**
 * Quote an identifier for SQLite (double quotes).
 */
function quoteIdentifier(name: string, quote: boolean): string {
  if (!quote) return name;
  // Escape any existing double quotes by doubling them
  return `"${name.replace(/"/g, '""')}"`;
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
function ending(options: SQLiteMigrationOptions): string {
  return options.semicolons !== false ? ';' : '';
}

/**
 * Format a default value as a SQL expression.
 */
function formatDefaultValue(value: unknown, _type: string): string {
  if (value === null) return 'NULL';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value);
}

/**
 * Check if a change requires table recreation.
 */
function requiresTableRecreation(change: SchemaChange): boolean {
  switch (change.type) {
    case 'remove_field':
    case 'change_type':
    case 'change_modifier':
      return true;
    default:
      return false;
  }
}

// =============================================================================
// SQLiteMigrationGenerator Class
// =============================================================================

/**
 * SQLite-specific migration generator with table recreation workarounds.
 *
 * @example
 * ```typescript
 * const generator = new SQLiteMigrationGenerator();
 *
 * // Simple ADD COLUMN
 * const diff = { schemaName: 'User', changes: [{ type: 'add_field', ... }] };
 * const statements = generator.generate(diff);
 *
 * // Complex DROP COLUMN (requires table schema)
 * const tableSchema = { tableName: 'User', columns: [...] };
 * const statements = generator.generateWithSchema(diff, tableSchema);
 * ```
 */
export class SQLiteMigrationGenerator implements MigrationGenerator {
  readonly dialect = 'sqlite' as const;
  private readonly options: SQLiteMigrationOptions;

  constructor(options: SQLiteMigrationOptions = {}) {
    this.options = {
      quoteIdentifiers: false,
      semicolons: true,
      ...options,
    };
  }

  /**
   * Generate SQL statements for a schema diff.
   *
   * Note: For operations that require table recreation (DROP COLUMN, TYPE change,
   * constraint changes), use `generateWithSchema()` instead as it needs the
   * current table schema to generate the recreation pattern.
   *
   * @param diff - The schema diff to generate migration for
   * @returns Array of SQL statements
   */
  generate(diff: SchemaDiff): string[] {
    const statements: string[] = [];
    const quote = !!this.options.quoteIdentifiers;
    const tableName = quoteIdentifier(diff.schemaName, quote);

    for (const change of diff.changes) {
      switch (change.type) {
        case 'add_field':
          statements.push(this.generateAddColumn(tableName, change, quote));
          break;

        case 'rename_field':
          statements.push(this.generateRenameColumn(tableName, change, quote));
          break;

        case 'remove_field':
        case 'change_type':
        case 'change_modifier':
          // These require table recreation - add a comment indicating this
          statements.push(
            `-- SQLite: ${change.type} requires table recreation. Use generateWithSchema() for full migration.${ending(this.options)}`
          );
          break;

        case 'change_directive':
          const indexStatements = this.generateDirectiveChange(tableName, change, quote);
          statements.push(...indexStatements);
          break;
      }
    }

    return statements;
  }

  /**
   * Generate SQL statements for a schema diff with full table schema.
   *
   * This method is required for operations that need table recreation:
   * - DROP COLUMN
   * - TYPE changes
   * - Constraint changes (NOT NULL, etc.)
   *
   * @param diff - The schema diff to generate migration for
   * @param tableSchema - The current table schema
   * @returns Array of SQL statements
   */
  generateWithSchema(diff: SchemaDiff, tableSchema: TableSchema): string[] {
    const statements: string[] = [];
    const quote = !!this.options.quoteIdentifiers;
    const tableName = quoteIdentifier(diff.schemaName, quote);

    // Separate simple and complex changes
    const simpleChanges: SchemaChange[] = [];
    const complexChanges: SchemaChange[] = [];

    for (const change of diff.changes) {
      if (requiresTableRecreation(change)) {
        complexChanges.push(change);
      } else {
        simpleChanges.push(change);
      }
    }

    // Generate simple changes first
    for (const change of simpleChanges) {
      switch (change.type) {
        case 'add_field':
          statements.push(this.generateAddColumn(tableName, change, quote));
          break;
        case 'rename_field':
          statements.push(this.generateRenameColumn(tableName, change, quote));
          break;
        case 'change_directive':
          const indexStatements = this.generateDirectiveChange(tableName, change, quote);
          statements.push(...indexStatements);
          break;
      }
    }

    // Batch complex changes into a single table recreation
    if (complexChanges.length > 0) {
      const recreationStatements = this.generateTableRecreation(
        tableSchema,
        complexChanges,
        quote
      );
      statements.push(...recreationStatements);
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
    const statements: string[] = [];
    const quote = !!this.options.quoteIdentifiers;
    const tableName = quoteIdentifier(diff.schemaName, quote);

    // Process changes in reverse order for rollback
    for (const change of [...diff.changes].reverse()) {
      switch (change.type) {
        case 'add_field':
          // Rollback ADD COLUMN requires table recreation in SQLite
          statements.push(
            `-- SQLite: Rollback ADD COLUMN requires table recreation. Use generateRollbackWithSchema().${ending(this.options)}`
          );
          break;

        case 'rename_field':
          // Rollback RENAME COLUMN by reversing the rename
          statements.push(
            this.generateRenameColumn(
              tableName,
              { type: 'rename_field', oldName: change.newName, newName: change.oldName },
              quote
            )
          );
          break;

        case 'remove_field':
          statements.push(
            `-- SQLite: Cannot rollback DROP COLUMN without original definition${ending(this.options)}`
          );
          break;

        case 'change_type':
          statements.push(
            `-- SQLite: Rollback TYPE change requires table recreation. Use generateRollbackWithSchema().${ending(this.options)}`
          );
          break;

        case 'change_modifier':
          statements.push(
            `-- SQLite: Rollback modifier change requires table recreation. Use generateRollbackWithSchema().${ending(this.options)}`
          );
          break;

        case 'change_directive':
          if (change.directive === '$index' && change.newValue) {
            // Rollback: drop the created indexes
            const indexes = change.newValue as string[][];
            for (const columns of indexes) {
              const indexName = `idx_${diff.schemaName}_${columns.join('_')}`;
              const quotedIndexName = quoteIdentifier(indexName, quote);
              statements.push(`DROP INDEX ${quotedIndexName}${ending(this.options)}`);
            }
          }
          break;
      }
    }

    return statements;
  }

  /**
   * Generate rollback SQL statements with full table schema.
   *
   * @param diff - The schema diff to generate rollback for
   * @param tableSchema - The table schema AFTER the migration was applied
   * @returns Array of SQL statements for rollback
   */
  generateRollbackWithSchema(diff: SchemaDiff, tableSchema: TableSchema): string[] {
    const statements: string[] = [];
    const quote = !!this.options.quoteIdentifiers;
    const tableName = quoteIdentifier(diff.schemaName, quote);

    // Separate simple and complex changes
    const simpleChanges: SchemaChange[] = [];
    const complexChanges: SchemaChange[] = [];

    for (const change of diff.changes) {
      if (change.type === 'add_field' || requiresTableRecreation(change)) {
        complexChanges.push(change);
      } else {
        simpleChanges.push(change);
      }
    }

    // Generate rollback for simple changes (in reverse order)
    for (const change of [...simpleChanges].reverse()) {
      switch (change.type) {
        case 'rename_field':
          statements.push(
            this.generateRenameColumn(
              tableName,
              { type: 'rename_field', oldName: change.newName, newName: change.oldName },
              quote
            )
          );
          break;
        case 'change_directive':
          if (change.directive === '$index' && change.newValue) {
            const indexes = change.newValue as string[][];
            for (const columns of indexes) {
              const indexName = `idx_${diff.schemaName}_${columns.join('_')}`;
              const quotedIndexName = quoteIdentifier(indexName, quote);
              statements.push(`DROP INDEX ${quotedIndexName}${ending(this.options)}`);
            }
          }
          break;
      }
    }

    // Batch complex rollbacks into a single table recreation
    if (complexChanges.length > 0) {
      // Build the rollback changes (inverse of original changes)
      const rollbackChanges: SchemaChange[] = [];
      for (const change of [...complexChanges].reverse()) {
        if (change.type === 'add_field') {
          rollbackChanges.push({ type: 'remove_field', field: change.field });
        }
        // Other rollbacks are more complex and need the original schema
      }

      if (rollbackChanges.length > 0) {
        const recreationStatements = this.generateTableRecreation(
          tableSchema,
          rollbackChanges,
          quote
        );
        statements.push(...recreationStatements);
      }
    }

    return statements;
  }

  // ===========================================================================
  // Private Statement Generators
  // ===========================================================================

  /**
   * Generate ADD COLUMN statement.
   */
  private generateAddColumn(
    tableName: string,
    change: SchemaChange & { type: 'add_field' },
    quote: boolean
  ): string {
    const column = quoteIdentifier(change.field, quote);
    const sqlType = getSqliteType(change.definition.type, this.options.typeMappings);
    const nullable = isNullable(change.definition);

    let sql = `ALTER TABLE ${tableName} ADD COLUMN ${column} ${sqlType}`;

    if (!nullable) {
      sql += ' NOT NULL';
    }

    if (change.definition.defaultValue !== undefined) {
      sql += ` DEFAULT ${formatDefaultValue(change.definition.defaultValue, sqlType)}`;
    }

    return sql + ending(this.options);
  }

  /**
   * Generate RENAME COLUMN statement.
   */
  private generateRenameColumn(
    tableName: string,
    change: SchemaChange & { type: 'rename_field' },
    quote: boolean
  ): string {
    const oldName = quoteIdentifier(change.oldName, quote);
    const newName = quoteIdentifier(change.newName, quote);

    return `ALTER TABLE ${tableName} RENAME COLUMN ${oldName} TO ${newName}${ending(this.options)}`;
  }

  /**
   * Generate statements for directive changes (indexes, etc.).
   */
  private generateDirectiveChange(
    tableName: string,
    change: SchemaChange & { type: 'change_directive' },
    quote: boolean
  ): string[] {
    const statements: string[] = [];

    if (change.directive === '$index' && change.newValue) {
      const indexes = change.newValue as string[][];
      for (const columns of indexes) {
        const indexName = `idx_${tableName.replace(/"/g, '')}_${columns.join('_')}`;
        const quotedIndexName = quoteIdentifier(indexName, quote);
        const quotedColumns = columns.map((c) => quoteIdentifier(c, quote)).join(', ');

        statements.push(
          `CREATE INDEX ${quotedIndexName} ON ${tableName} (${quotedColumns})${ending(this.options)}`
        );
      }
    }

    return statements;
  }

  /**
   * Generate table recreation pattern for complex changes.
   */
  private generateTableRecreation(
    tableSchema: TableSchema,
    changes: SchemaChange[],
    quote: boolean
  ): string[] {
    const statements: string[] = [];
    const rawTableName = tableSchema.tableName;
    const tableName = quoteIdentifier(rawTableName, quote);
    const tempTableName = quoteIdentifier(`__temp_${rawTableName}`, quote);

    // Build the new column list based on changes
    let newColumns = [...tableSchema.columns];
    const typeChanges = new Map<string, string>(); // field -> new SQLite type
    const modifierChanges = new Map<string, boolean>(); // field -> isNullable

    for (const change of changes) {
      switch (change.type) {
        case 'remove_field':
          newColumns = newColumns.filter((c) => c.name !== change.field);
          break;

        case 'change_type':
          typeChanges.set(
            change.field,
            getSqliteType(change.newType, this.options.typeMappings)
          );
          // Add warning for potential data loss
          statements.push(
            `-- WARNING: Changing type of ${change.field} from ${change.oldType} to ${change.newType}. Data may be lost or corrupted.`
          );
          break;

        case 'change_modifier':
          const setNotNull = change.newModifier === '!' || change.newModifier === '#';
          modifierChanges.set(change.field, !setNotNull);
          break;
      }
    }

    // Step 1: Create temp table with current data
    const selectColumns = newColumns.map((c) => quoteIdentifier(c.name, quote)).join(', ');
    statements.push(
      `CREATE TABLE ${tempTableName} AS SELECT ${selectColumns} FROM ${tableName}${ending(this.options)}`
    );

    // Step 2: Drop original table
    statements.push(`DROP TABLE ${tableName}${ending(this.options)}`);

    // Step 3: Create new table with updated schema
    const columnDefs = newColumns.map((col) => {
      const colName = quoteIdentifier(col.name, quote);
      const colType = typeChanges.get(col.name) ?? col.type;
      let nullable = modifierChanges.has(col.name)
        ? modifierChanges.get(col.name)!
        : col.nullable;

      let def = `${colName} ${colType}`;
      if (!nullable) {
        def += ' NOT NULL';
      }
      if (col.default !== undefined) {
        def += ` DEFAULT ${col.default}`;
      }
      return def;
    });

    // Add primary key constraint if exists
    if (tableSchema.primaryKey && tableSchema.primaryKey.length > 0) {
      const pkColumns = tableSchema.primaryKey
        .filter((pk) => newColumns.some((c) => c.name === pk))
        .map((pk) => quoteIdentifier(pk, quote))
        .join(', ');
      if (pkColumns) {
        columnDefs.push(`PRIMARY KEY (${pkColumns})`);
      }
    }

    statements.push(
      `CREATE TABLE ${tableName} (${columnDefs.join(', ')})${ending(this.options)}`
    );

    // Step 4: Copy data back with type casting if needed
    const insertColumns = newColumns.map((c) => quoteIdentifier(c.name, quote)).join(', ');
    const selectExprs = newColumns.map((col) => {
      const colName = quoteIdentifier(col.name, quote);
      if (typeChanges.has(col.name)) {
        const newType = typeChanges.get(col.name)!;
        return `CAST(${colName} AS ${newType})`;
      }
      return colName;
    }).join(', ');

    statements.push(
      `INSERT INTO ${tableName} (${insertColumns}) SELECT ${selectExprs} FROM ${tempTableName}${ending(this.options)}`
    );

    // Step 5: Drop temp table
    statements.push(`DROP TABLE ${tempTableName}${ending(this.options)}`);

    return statements;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a SQLiteMigrationGenerator instance.
 *
 * @param options - Optional configuration options
 * @returns A new SQLiteMigrationGenerator instance
 *
 * @example
 * ```typescript
 * const generator = createSQLiteMigrationGenerator();
 * const statements = generator.generate(diff);
 * ```
 */
export function createSQLiteMigrationGenerator(
  options: SQLiteMigrationOptions = {}
): SQLiteMigrationGenerator {
  return new SQLiteMigrationGenerator(options);
}
