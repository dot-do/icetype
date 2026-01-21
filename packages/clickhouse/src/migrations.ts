/**
 * ClickHouse Migration Generator
 *
 * Generates ClickHouse-specific ALTER TABLE migration statements
 * from IceType schema diffs.
 *
 * ClickHouse has unique ALTER TABLE syntax:
 * - `ALTER TABLE ... ADD COLUMN col Type [AFTER existing]`
 * - `ALTER TABLE ... DROP COLUMN col`
 * - `ALTER TABLE ... RENAME COLUMN old TO new`
 * - `ALTER TABLE ... MODIFY COLUMN col Type`
 * - `ALTER TABLE ... COMMENT COLUMN col 'comment'`
 *
 * Also supports ClickHouse-specific features:
 * - Nullable() wrapper for optional fields
 * - LowCardinality() for low-cardinality string columns
 * - Array() for array types
 * - CODEC() for compression
 * - MATERIALIZED and ALIAS columns
 *
 * @packageDocumentation
 */

import type { SchemaDiff, SchemaChange, FieldDefinition } from '@icetype/core';
import { validateSchemaName } from '@icetype/sql-common';
import {
  getClickHouseType,
  wrapNullable,
  getArrayType,
  escapeIdentifier,
  escapeString,
} from './index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for ClickHouse migration generation.
 */
export interface ClickHouseMigrationOptions {
  /** Database name to prefix tables with */
  database?: string;
  /** Whether to end statements with semicolons (default: true) */
  semicolons?: boolean;
  /** Whether to always quote identifiers (default: false) */
  quoteIdentifiers?: boolean;
  /** Column to add new columns after */
  afterColumn?: string;
  /** Fields to wrap with LowCardinality */
  useLowCardinality?: string[];
  /** Codec specifications per column */
  codecs?: Record<string, string>;
  /** Custom type mappings override */
  typeMappings?: Record<string, string>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get ClickHouse type for an IceType field definition.
 */
function getTypeForField(
  definition: FieldDefinition,
  options: ClickHouseMigrationOptions = {}
): string {
  const { useLowCardinality = [], typeMappings = {} } = options;

  // Check for custom type mapping first
  const customType = typeMappings[definition.type];
  if (customType) {
    let type = customType;

    // Handle array
    if (definition.isArray) {
      type = getArrayType(type);
    }

    // Handle nullable
    if (definition.isOptional || definition.modifier === '?') {
      type = wrapNullable(type, true);
    }

    return type;
  }

  // Get the base type
  let baseType: string;
  if (definition.type === 'decimal' && definition.precision !== undefined) {
    baseType = `Decimal(${definition.precision}, ${definition.scale ?? 0})`;
  } else {
    baseType = getClickHouseType(definition.type);
  }

  // Check if we need LowCardinality
  const useLowCard = useLowCardinality.includes(definition.name);

  // Build the final type
  let type = baseType;

  // Handle array first
  if (definition.isArray) {
    type = getArrayType(type);
  }

  // Handle nullable
  if (definition.isOptional || definition.modifier === '?') {
    type = wrapNullable(type, true);
  }

  // Wrap with LowCardinality if needed
  if (useLowCard) {
    type = `LowCardinality(${type})`;
  }

  return type;
}

/**
 * Format identifier, escaping if necessary.
 */
function formatIdentifier(name: string, forceQuote: boolean): string {
  if (forceQuote) {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  return escapeIdentifier(name);
}

/**
 * Format table name with optional database prefix.
 */
function formatTableName(
  tableName: string,
  database: string | undefined,
  forceQuote: boolean
): string {
  const parts: string[] = [];
  if (database) {
    parts.push(formatIdentifier(database, forceQuote));
  }
  parts.push(formatIdentifier(tableName, forceQuote));
  return parts.join('.');
}

/**
 * Get statement ending based on options.
 */
function getEnding(options: ClickHouseMigrationOptions): string {
  return options.semicolons !== false ? ';' : '';
}

/**
 * Format default value for SQL.
 */
function formatDefault(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return escapeString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return escapeString(String(value));
}

// =============================================================================
// ClickHouseMigrationGenerator Class
// =============================================================================

/**
 * Generator for ClickHouse-specific migration statements.
 *
 * @example
 * ```typescript
 * const generator = new ClickHouseMigrationGenerator({ database: 'analytics' });
 * const statements = generator.generate(diff);
 * ```
 */
export class ClickHouseMigrationGenerator {
  private readonly options: ClickHouseMigrationOptions;

  constructor(options: ClickHouseMigrationOptions = {}) {
    // Validate database name if provided
    if (options.database) {
      validateSchemaName(options.database);
    }
    this.options = options;
  }

  /**
   * Generate migration SQL statements from a schema diff.
   *
   * @param diff - The schema diff to generate migrations for
   * @returns Array of SQL statements
   */
  generate(diff: SchemaDiff): string[] {
    const statements: string[] = [];

    for (const change of diff.changes) {
      const stmt = this.generateStatement(diff.schemaName, change);
      if (stmt) {
        statements.push(stmt);
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
    const statements: string[] = [];

    // Process in reverse order
    for (const change of [...diff.changes].reverse()) {
      const stmt = this.generateRollbackStatement(diff.schemaName, change);
      if (stmt) {
        statements.push(stmt);
      }
    }

    return statements;
  }

  /**
   * Generate COMMENT COLUMN statement.
   *
   * @param tableName - The table name
   * @param columnName - The column name
   * @param comment - The comment text
   * @returns The SQL statement
   */
  generateCommentColumn(
    tableName: string,
    columnName: string,
    comment: string
  ): string {
    const table = formatTableName(tableName, this.options.database, !!this.options.quoteIdentifiers);
    const column = formatIdentifier(columnName, !!this.options.quoteIdentifiers);
    const escapedComment = escapeString(comment);
    return `ALTER TABLE ${table} COMMENT COLUMN ${column} ${escapedComment}${getEnding(this.options)}`;
  }

  /**
   * Generate MATERIALIZED column statement.
   *
   * @param tableName - The table name
   * @param columnName - The column name
   * @param type - The ClickHouse type
   * @param expression - The materialized expression
   * @returns The SQL statement
   */
  generateMaterializedColumn(
    tableName: string,
    columnName: string,
    type: string,
    expression: string
  ): string {
    const table = formatTableName(tableName, this.options.database, !!this.options.quoteIdentifiers);
    const column = formatIdentifier(columnName, !!this.options.quoteIdentifiers);
    return `ALTER TABLE ${table} ADD COLUMN ${column} ${type} MATERIALIZED ${expression}${getEnding(this.options)}`;
  }

  /**
   * Generate ALIAS column statement.
   *
   * @param tableName - The table name
   * @param columnName - The column name
   * @param type - The ClickHouse type
   * @param expression - The alias expression
   * @returns The SQL statement
   */
  generateAliasColumn(
    tableName: string,
    columnName: string,
    type: string,
    expression: string
  ): string {
    const table = formatTableName(tableName, this.options.database, !!this.options.quoteIdentifiers);
    const column = formatIdentifier(columnName, !!this.options.quoteIdentifiers);
    return `ALTER TABLE ${table} ADD COLUMN ${column} ${type} ALIAS ${expression}${getEnding(this.options)}`;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private generateStatement(tableName: string, change: SchemaChange): string | null {
    switch (change.type) {
      case 'add_field':
        return this.generateAddColumn(tableName, change.field, change.definition);

      case 'remove_field':
        return this.generateDropColumn(tableName, change.field);

      case 'rename_field':
        return this.generateRenameColumn(tableName, change.oldName, change.newName);

      case 'change_type':
        return this.generateModifyColumnType(tableName, change.field, change.newType);

      case 'change_modifier':
        return this.generateModifyColumnModifier(
          tableName,
          change.field,
          change.oldModifier,
          change.newModifier
        );

      case 'change_directive':
        // Directive changes don't generate ALTER TABLE statements
        return null;

      default:
        return null;
    }
  }

  private generateRollbackStatement(
    tableName: string,
    change: SchemaChange
  ): string | null {
    switch (change.type) {
      case 'add_field':
        // Rollback ADD COLUMN = DROP COLUMN
        return this.generateDropColumn(tableName, change.field);

      case 'remove_field':
        // Can't automatically rollback DROP COLUMN
        return `-- Cannot rollback DROP COLUMN ${change.field}: original definition unknown`;

      case 'rename_field':
        // Rollback RENAME = reverse rename
        return this.generateRenameColumn(tableName, change.newName, change.oldName);

      case 'change_type':
        // Rollback type change = change back to old type
        return this.generateModifyColumnType(tableName, change.field, change.oldType);

      case 'change_modifier':
        // Rollback modifier change
        return this.generateModifyColumnModifier(
          tableName,
          change.field,
          change.newModifier,
          change.oldModifier
        );

      case 'change_directive':
        return null;

      default:
        return null;
    }
  }

  private generateAddColumn(
    tableName: string,
    fieldName: string,
    definition: FieldDefinition
  ): string {
    const table = formatTableName(tableName, this.options.database, !!this.options.quoteIdentifiers);
    const column = formatIdentifier(fieldName, !!this.options.quoteIdentifiers);
    const type = getTypeForField(definition, {
      ...this.options,
      // Pass field name for LowCardinality check
    });

    const parts: string[] = [`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`];

    // Add DEFAULT if specified
    if (definition.defaultValue !== undefined) {
      parts.push(`DEFAULT ${formatDefault(definition.defaultValue)}`);
    }

    // Add CODEC if specified
    if (this.options.codecs?.[fieldName]) {
      parts.push(`CODEC(${this.options.codecs[fieldName]})`);
    }

    // Add AFTER clause if specified
    if (this.options.afterColumn) {
      parts.push(`AFTER ${formatIdentifier(this.options.afterColumn, !!this.options.quoteIdentifiers)}`);
    }

    return parts.join(' ') + getEnding(this.options);
  }

  private generateDropColumn(tableName: string, fieldName: string): string {
    const table = formatTableName(tableName, this.options.database, !!this.options.quoteIdentifiers);
    const column = formatIdentifier(fieldName, !!this.options.quoteIdentifiers);
    return `ALTER TABLE ${table} DROP COLUMN ${column}${getEnding(this.options)}`;
  }

  private generateRenameColumn(
    tableName: string,
    oldName: string,
    newName: string
  ): string {
    const table = formatTableName(tableName, this.options.database, !!this.options.quoteIdentifiers);
    const oldCol = formatIdentifier(oldName, !!this.options.quoteIdentifiers);
    const newCol = formatIdentifier(newName, !!this.options.quoteIdentifiers);
    return `ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}${getEnding(this.options)}`;
  }

  private generateModifyColumnType(
    tableName: string,
    fieldName: string,
    newType: string
  ): string {
    const table = formatTableName(tableName, this.options.database, !!this.options.quoteIdentifiers);
    const column = formatIdentifier(fieldName, !!this.options.quoteIdentifiers);
    const clickHouseType = getClickHouseType(newType);
    return `ALTER TABLE ${table} MODIFY COLUMN ${column} ${clickHouseType}${getEnding(this.options)}`;
  }

  private generateModifyColumnModifier(
    tableName: string,
    fieldName: string,
    _oldModifier: string,
    _newModifier: string
  ): string {
    const table = formatTableName(tableName, this.options.database, !!this.options.quoteIdentifiers);
    const column = formatIdentifier(fieldName, !!this.options.quoteIdentifiers);
    // Note: In ClickHouse, changing nullability requires knowing the full column type
    // This is a simplified version that generates a comment about the change
    return `ALTER TABLE ${table} MODIFY COLUMN ${column} -- Modifier change: requires full column type specification${getEnding(this.options)}`;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a ClickHouse migration generator.
 *
 * @param options - Configuration options
 * @returns A new ClickHouseMigrationGenerator instance
 *
 * @example
 * ```typescript
 * const generator = createClickHouseMigrationGenerator({
 *   database: 'analytics',
 *   semicolons: true,
 * });
 * const statements = generator.generate(diff);
 * ```
 */
export function createClickHouseMigrationGenerator(
  options: ClickHouseMigrationOptions = {}
): ClickHouseMigrationGenerator {
  return new ClickHouseMigrationGenerator(options);
}
