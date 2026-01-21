/**
 * MySQL Migration Generator
 *
 * Generates MySQL-specific ALTER TABLE statements from schema diffs.
 *
 * @packageDocumentation
 */

import type { SchemaDiff, SchemaChange, FieldDefinition } from '@icetype/core';
import type { MigrationGenerator, GeneratorOptions, Dialect } from '@icetype/migrations';
import { ICETYPE_TO_MYSQL } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * MySQL-specific options for migration generation.
 */
export interface MySQLGeneratorOptions extends GeneratorOptions {
  /** Character set for string columns */
  charset?: string;
  /** Collation for string columns */
  collation?: string;
  /** Storage engine (default: InnoDB) */
  engine?: 'InnoDB' | 'MyISAM' | 'MEMORY' | 'CSV' | 'ARCHIVE' | string;
}

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * Get the MySQL type for an IceType type.
 */
function getMySQLType(iceType: string, field?: FieldDefinition): string {
  const normalized = iceType.toLowerCase();
  const mapping = ICETYPE_TO_MYSQL[normalized];

  if (mapping) {
    // Handle decimal with custom precision/scale
    if (normalized === 'decimal' && field) {
      const precision = field.precision ?? mapping.precision ?? 38;
      const scale = field.scale ?? mapping.scale ?? 9;
      return `DECIMAL(${precision}, ${scale})`;
    }

    // Handle types with length
    if (mapping.length !== undefined) {
      return `${mapping.mysqlType}(${mapping.length})`;
    }

    return mapping.mysqlType;
  }

  // Default to VARCHAR(255) for unknown types
  return 'VARCHAR(255)';
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Quote an identifier using backticks (MySQL style).
 */
function quoteIdentifier(name: string, quote: boolean): string {
  if (!quote) return name;
  return `\`${name}\``;
}

/**
 * Generate statement ending based on options.
 */
function ending(options: MySQLGeneratorOptions): string {
  return options.semicolons !== false ? ';' : '';
}

/**
 * Check if a field definition is nullable.
 */
function isNullable(definition: FieldDefinition): boolean {
  return definition.isOptional || definition.modifier === '?';
}

/**
 * Build charset/collation clause if options are provided.
 */
function buildCharsetClause(options: MySQLGeneratorOptions, type: string): string {
  // Only add charset/collation for string/text types
  const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
  const isStringType = stringTypes.some((t) => type.toUpperCase().startsWith(t));

  if (!isStringType) return '';

  const parts: string[] = [];
  if (options.charset) {
    parts.push(`CHARACTER SET ${options.charset}`);
  }
  if (options.collation) {
    parts.push(`COLLATE ${options.collation}`);
  }

  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

// =============================================================================
// MySQLMigrationGenerator Class
// =============================================================================

/**
 * MySQL-specific migration generator.
 *
 * Generates MySQL ALTER TABLE statements from schema diffs.
 *
 * @example
 * ```typescript
 * import { MySQLMigrationGenerator } from '@icetype/mysql';
 * import { diffSchemas } from '@icetype/core';
 *
 * const diff = diffSchemas(oldSchema, newSchema);
 * const generator = new MySQLMigrationGenerator();
 * const statements = generator.generate(diff);
 *
 * for (const stmt of statements) {
 *   await connection.execute(stmt);
 * }
 * ```
 */
export class MySQLMigrationGenerator implements MigrationGenerator {
  readonly dialect: Dialect = 'mysql';
  readonly engine: string;

  private readonly options: MySQLGeneratorOptions;

  constructor(options: MySQLGeneratorOptions = {}) {
    this.options = options;
    this.engine = options.engine ?? 'InnoDB';
  }

  /**
   * Generate SQL statements for a schema diff.
   */
  generate(diff: SchemaDiff): string[] {
    const statements: string[] = [];

    for (const change of diff.changes) {
      switch (change.type) {
        case 'add_field':
          statements.push(this.generateAddColumn(diff.schemaName, change));
          break;

        case 'remove_field':
          statements.push(this.generateDropColumn(diff.schemaName, change));
          break;

        case 'rename_field':
          statements.push(this.generateRenameColumn(diff.schemaName, change));
          break;

        case 'change_type':
          statements.push(this.generateModifyColumn(diff.schemaName, change));
          break;

        case 'change_modifier':
          statements.push(this.generateAlterModifier(diff.schemaName, change));
          break;

        case 'change_directive':
          const indexStatements = this.generateCreateIndex(diff.schemaName, change);
          statements.push(...indexStatements);
          break;
      }
    }

    return statements;
  }

  /**
   * Generate rollback SQL statements for a schema diff.
   */
  generateRollback(diff: SchemaDiff): string[] {
    const statements: string[] = [];

    // Process changes in reverse order for rollback
    for (const change of [...diff.changes].reverse()) {
      switch (change.type) {
        case 'add_field':
          // Rollback: drop the added column
          statements.push(
            this.generateDropColumn(diff.schemaName, {
              type: 'remove_field',
              field: change.field,
            })
          );
          break;

        case 'remove_field':
          // Rollback: we can't restore without knowing the definition
          statements.push(
            `-- Cannot rollback DROP COLUMN ${change.field}: original definition unknown`
          );
          break;

        case 'rename_field':
          // Rollback: rename back
          statements.push(
            this.generateRenameColumn(diff.schemaName, {
              type: 'rename_field',
              oldName: change.newName,
              newName: change.oldName,
            })
          );
          break;

        case 'change_type':
          // Rollback: change type back
          statements.push(
            this.generateModifyColumn(diff.schemaName, {
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
            this.generateAlterModifier(diff.schemaName, {
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
              const quotedIndexName = quoteIdentifier(indexName, !!this.options.quoteIdentifiers);
              statements.push(`DROP INDEX ${quotedIndexName} ON ${quoteIdentifier(diff.schemaName, !!this.options.quoteIdentifiers)}${ending(this.options)}`);
            }
          }
          break;
      }
    }

    return statements;
  }

  /**
   * Generate MySQL CHANGE COLUMN statement for combined rename + type change.
   *
   * MySQL syntax: ALTER TABLE t CHANGE COLUMN old_col new_col new_type
   */
  generateChangeColumn(
    tableName: string,
    oldColumnName: string,
    newColumnName: string,
    newType: string
  ): string {
    const quote = !!this.options.quoteIdentifiers;
    const table = quoteIdentifier(tableName, quote);
    const oldCol = quoteIdentifier(oldColumnName, quote);
    const newCol = quoteIdentifier(newColumnName, quote);
    const sqlType = getMySQLType(newType);

    return `ALTER TABLE ${table} CHANGE COLUMN ${oldCol} ${newCol} ${sqlType}${ending(this.options)}`;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private generateAddColumn(
    tableName: string,
    change: SchemaChange & { type: 'add_field' }
  ): string {
    const quote = !!this.options.quoteIdentifiers;
    const table = quoteIdentifier(tableName, quote);
    const column = quoteIdentifier(change.field, quote);
    const sqlType = getMySQLType(change.definition.type, change.definition);
    const nullable = isNullable(change.definition) ? '' : ' NOT NULL';
    const charsetClause = buildCharsetClause(this.options, sqlType);

    return `ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}${charsetClause}${nullable}${ending(this.options)}`;
  }

  private generateDropColumn(
    tableName: string,
    change: SchemaChange & { type: 'remove_field' }
  ): string {
    const quote = !!this.options.quoteIdentifiers;
    const table = quoteIdentifier(tableName, quote);
    const column = quoteIdentifier(change.field, quote);

    return `ALTER TABLE ${table} DROP COLUMN ${column}${ending(this.options)}`;
  }

  private generateRenameColumn(
    tableName: string,
    change: SchemaChange & { type: 'rename_field' }
  ): string {
    const quote = !!this.options.quoteIdentifiers;
    const table = quoteIdentifier(tableName, quote);
    const oldName = quoteIdentifier(change.oldName, quote);
    const newName = quoteIdentifier(change.newName, quote);

    // MySQL 8.0+ supports RENAME COLUMN syntax
    return `ALTER TABLE ${table} RENAME COLUMN ${oldName} TO ${newName}${ending(this.options)}`;
  }

  private generateModifyColumn(
    tableName: string,
    change: SchemaChange & { type: 'change_type' }
  ): string {
    const quote = !!this.options.quoteIdentifiers;
    const table = quoteIdentifier(tableName, quote);
    const column = quoteIdentifier(change.field, quote);
    const newType = getMySQLType(change.newType);

    // MySQL uses MODIFY COLUMN for type changes without rename
    return `ALTER TABLE ${table} MODIFY COLUMN ${column} ${newType}${ending(this.options)}`;
  }

  private generateAlterModifier(
    tableName: string,
    change: SchemaChange & { type: 'change_modifier' }
  ): string {
    const quote = !!this.options.quoteIdentifiers;
    const table = quoteIdentifier(tableName, quote);
    const column = quoteIdentifier(change.field, quote);
    const setNotNull = change.newModifier === '!' || change.newModifier === '#';

    // Note: In real MySQL, you'd need the full column type for MODIFY
    // This is a simplified version that works with the migration system
    if (setNotNull) {
      return `ALTER TABLE ${table} MODIFY ${column} SET NOT NULL${ending(this.options)}`;
    } else {
      return `ALTER TABLE ${table} MODIFY ${column} DROP NOT NULL${ending(this.options)}`;
    }
  }

  private generateCreateIndex(
    tableName: string,
    change: SchemaChange & { type: 'change_directive' }
  ): string[] {
    const statements: string[] = [];
    const quote = !!this.options.quoteIdentifiers;
    const table = quoteIdentifier(tableName, quote);

    if (change.directive === '$index' && change.newValue) {
      const indexes = change.newValue as string[][];
      for (const columns of indexes) {
        const indexName = `idx_${tableName}_${columns.join('_')}`;
        const quotedIndexName = quoteIdentifier(indexName, quote);
        const quotedColumns = columns
          .map((c) => quoteIdentifier(c, quote))
          .join(', ');

        statements.push(
          `CREATE INDEX ${quotedIndexName} ON ${table} (${quotedColumns})${ending(this.options)}`
        );
      }
    }

    return statements;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a MySQL migration generator.
 *
 * @param options - Generator options
 * @returns A MySQLMigrationGenerator instance
 */
export function createMySQLMigrationGenerator(
  options: MySQLGeneratorOptions = {}
): MySQLMigrationGenerator {
  return new MySQLMigrationGenerator(options);
}
