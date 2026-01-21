/**
 * PostgreSQL Adapter Implementation
 *
 * Transforms IceType schemas to PostgreSQL DDL (Data Definition Language).
 * Compatible with postgres.do and Drizzle ORM.
 *
 * @packageDocumentation
 */

import type { IceTypeSchema } from '@icetype/core';
import type { SchemaAdapter } from '@icetype/adapters';

import type {
  PostgresDDL,
  PostgresColumn,
  PostgresAdapterOptions,
} from './types.js';

import {
  fieldToPostgresColumn,
  generateSystemColumns,
  serializeDDL,
  generateIndexStatements,
} from './ddl.js';

import { VERSION } from './version.js';

// =============================================================================
// PostgreSQL Adapter
// =============================================================================

/**
 * Adapter for transforming IceType schemas to PostgreSQL DDL.
 *
 * Compatible with postgres.do (https://postgres.do) and Drizzle ORM.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { PostgresAdapter } from '@icetype/postgres';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 * });
 *
 * const adapter = new PostgresAdapter();
 *
 * // Get DDL structure
 * const ddl = adapter.transform(schema);
 *
 * // Serialize to CREATE TABLE statement
 * const sql = adapter.serialize(ddl);
 * console.log(sql);
 * // CREATE TABLE "User" (
 * //   "$id" TEXT NOT NULL,
 * //   "$type" TEXT NOT NULL,
 * //   ...
 * //   "id" UUID NOT NULL,
 * //   "email" TEXT UNIQUE,
 * //   "name" TEXT,
 * //   "age" INTEGER,
 * //   PRIMARY KEY ("$id")
 * // );
 * ```
 */
export class PostgresAdapter
  implements SchemaAdapter<PostgresDDL, PostgresAdapterOptions>
{
  readonly name = 'postgres';
  readonly version = VERSION;

  /**
   * Transform an IceType schema to a PostgreSQL DDL structure.
   *
   * @param schema - The IceType schema to transform
   * @param options - Optional PostgreSQL-specific options
   * @returns PostgreSQL DDL structure
   */
  transform(
    schema: IceTypeSchema,
    options?: PostgresAdapterOptions
  ): PostgresDDL {
    const columns: PostgresColumn[] = [];
    const primaryKey: string[] = [];

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

      const column = fieldToPostgresColumn(fieldName, fieldDef);
      columns.push(column);
    }

    // Build DDL structure
    const ddl: PostgresDDL = {
      tableName: options?.tableName ?? schema.name,
      schemaName: options?.schema,
      columns,
      primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
      ifNotExists: options?.ifNotExists,
      unlogged: options?.unlogged,
    };

    // Collect unique constraints from unique indexed fields
    const uniqueColumns = columns.filter(c => c.unique && !c.primaryKey);
    if (uniqueColumns.length > 0) {
      // Individual unique constraints for each unique column
      ddl.uniqueConstraints = uniqueColumns.map(c => [c.name]);
    }

    return ddl;
  }

  /**
   * Serialize PostgreSQL DDL to a CREATE TABLE SQL statement.
   *
   * @param output - The DDL structure to serialize
   * @returns SQL CREATE TABLE statement
   */
  serialize(output: PostgresDDL): string {
    return serializeDDL(output);
  }

  /**
   * Generate DDL including index statements.
   *
   * @param ddl - The DDL structure
   * @returns Full DDL including CREATE INDEX statements
   */
  serializeWithIndexes(ddl: PostgresDDL): string {
    const createTable = this.serialize(ddl);
    const indexStatements = generateIndexStatements(
      ddl.tableName,
      ddl.schemaName,
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
 * Create a new PostgreSQL adapter instance.
 *
 * @returns A new PostgresAdapter instance
 */
export function createPostgresAdapter(): PostgresAdapter {
  return new PostgresAdapter();
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Transform an IceType schema directly to a PostgreSQL CREATE TABLE statement.
 *
 * This is a convenience function that combines the adapter transform
 * and serialize steps.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional PostgreSQL-specific options
 * @returns SQL CREATE TABLE statement
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { transformToPostgresDDL } from '@icetype/postgres';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 * });
 *
 * const sql = transformToPostgresDDL(schema, { ifNotExists: true });
 * console.log(sql);
 * // CREATE TABLE IF NOT EXISTS "User" (
 * //   ...
 * // );
 * ```
 */
export function transformToPostgresDDL(
  schema: IceTypeSchema,
  options?: PostgresAdapterOptions
): string {
  const adapter = new PostgresAdapter();
  const ddl = adapter.transform(schema, options);
  return adapter.serialize(ddl);
}

/**
 * Transform an IceType schema to PostgreSQL DDL structure.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional PostgreSQL-specific options
 * @returns PostgreSQL DDL structure
 */
export function generatePostgresDDL(
  schema: IceTypeSchema,
  options?: PostgresAdapterOptions
): PostgresDDL {
  const adapter = new PostgresAdapter();
  return adapter.transform(schema, options);
}
