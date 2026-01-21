/**
 * SQLite Adapter Implementation
 *
 * Transforms IceType schemas to SQLite DDL (Data Definition Language).
 *
 * @packageDocumentation
 */

import type { IceTypeSchema, SchemaAdapter } from '@icetype/core';

import type {
  SQLiteDDL,
  SQLiteColumn,
  SQLiteAdapterOptions,
  SQLiteDDLWarning,
} from './types.js';

import {
  fieldToSQLiteColumn,
  generateSystemColumns,
  serializeDDL,
  generateIndexStatements,
} from './ddl.js';

import { VERSION } from './version.js';

// =============================================================================
// SQLite Adapter
// =============================================================================

/**
 * Adapter for transforming IceType schemas to SQLite DDL.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { SQLiteAdapter } from '@icetype/sqlite';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 * });
 *
 * const adapter = new SQLiteAdapter();
 *
 * // Get DDL structure
 * const ddl = adapter.transform(schema);
 *
 * // Serialize to CREATE TABLE statement
 * const sql = adapter.serialize(ddl);
 * console.log(sql);
 * // CREATE TABLE User (
 * //   "$id" TEXT NOT NULL,
 * //   "$type" TEXT NOT NULL,
 * //   ...
 * //   id TEXT NOT NULL,
 * //   email TEXT UNIQUE,
 * //   name TEXT,
 * //   age INTEGER,
 * //   PRIMARY KEY ("$id")
 * // );
 * ```
 */
export class SQLiteAdapter
  implements SchemaAdapter<SQLiteDDL, SQLiteAdapterOptions>
{
  readonly name = 'sqlite';
  readonly version = VERSION;

  /**
   * Transform an IceType schema to a SQLite DDL structure.
   *
   * @param schema - The IceType schema to transform
   * @param options - Optional SQLite-specific options
   * @returns SQLite DDL structure
   */
  transform(
    schema: IceTypeSchema,
    options?: SQLiteAdapterOptions
  ): SQLiteDDL {
    const columns: SQLiteColumn[] = [];
    const primaryKey: string[] = [];
    const warnings: SQLiteDDLWarning[] = [];

    // Add system fields if requested (default: true)
    const includeSystemFields = options?.includeSystemFields ?? true;
    if (includeSystemFields) {
      const systemColumns = generateSystemColumns();
      for (const col of systemColumns) {
        if (col.primaryKey) {
          primaryKey.push(col.name);
        }
        columns.push(col);
      }
    }

    // Process schema fields
    for (const [fieldName, fieldDef] of schema.fields) {
      // Skip directive fields
      if (fieldName.startsWith('$')) continue;

      const result = fieldToSQLiteColumn(fieldName, fieldDef);
      columns.push(result.column);
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    // Build DDL structure
    const ddl: SQLiteDDL = {
      tableName: options?.tableName ?? schema.name,
      columns,
      primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
      ifNotExists: options?.ifNotExists,
      withoutRowid: options?.withoutRowid,
      strict: options?.strict,
    };

    // Add warnings if any were generated
    if (warnings.length > 0) {
      ddl.warnings = warnings;
    }

    // Collect unique constraints from unique indexed fields
    const uniqueColumns = columns.filter(c => c.unique && !c.primaryKey);
    if (uniqueColumns.length > 0) {
      // Individual unique constraints for each unique column
      ddl.uniqueConstraints = uniqueColumns.map(c => [c.name]);
    }

    return ddl;
  }

  /**
   * Serialize SQLite DDL to a CREATE TABLE SQL statement.
   *
   * @param output - The DDL structure to serialize
   * @returns SQL CREATE TABLE statement
   */
  serialize(output: SQLiteDDL): string {
    return serializeDDL(output);
  }

  /**
   * Generate DDL including index statements.
   *
   * @param ddl - The DDL structure
   * @returns Full DDL including CREATE INDEX statements
   */
  serializeWithIndexes(ddl: SQLiteDDL): string {
    const createTable = this.serialize(ddl);
    const indexStatements = generateIndexStatements(
      ddl.tableName,
      ddl.columns
    );

    if (indexStatements.length === 0) {
      return createTable;
    }

    return [createTable, '', ...indexStatements].join('\n');
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new SQLite adapter instance.
 *
 * @returns A new SQLiteAdapter instance
 */
export function createSQLiteAdapter(): SQLiteAdapter {
  return new SQLiteAdapter();
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Transform an IceType schema directly to a SQLite CREATE TABLE statement.
 *
 * This is a convenience function that combines the adapter transform
 * and serialize steps.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional SQLite-specific options
 * @returns SQL CREATE TABLE statement
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { transformToSQLiteDDL } from '@icetype/sqlite';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 * });
 *
 * const sql = transformToSQLiteDDL(schema, { ifNotExists: true });
 * console.log(sql);
 * // CREATE TABLE IF NOT EXISTS User (
 * //   ...
 * // );
 * ```
 */
export function transformToSQLiteDDL(
  schema: IceTypeSchema,
  options?: SQLiteAdapterOptions
): string {
  const adapter = new SQLiteAdapter();
  const ddl = adapter.transform(schema, options);
  return adapter.serialize(ddl);
}

/**
 * Transform an IceType schema to SQLite DDL structure.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional SQLite-specific options
 * @returns SQLite DDL structure
 */
export function generateSQLiteDDL(
  schema: IceTypeSchema,
  options?: SQLiteAdapterOptions
): SQLiteDDL {
  const adapter = new SQLiteAdapter();
  return adapter.transform(schema, options);
}
