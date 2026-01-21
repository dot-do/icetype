/**
 * DuckDB Adapter Implementation
 *
 * Transforms IceType schemas to DuckDB DDL (Data Definition Language).
 *
 * @packageDocumentation
 */

import type { IceTypeSchema, SchemaAdapter } from '@icetype/core';

import type {
  DuckDBDDL,
  DuckDBColumn,
  DuckDBAdapterOptions,
} from './types.js';

import {
  fieldToDuckDBColumn,
  generateSystemColumns,
  serializeDDL,
  generateIndexStatements,
} from './ddl.js';

import { VERSION } from './version.js';

// =============================================================================
// DuckDB Adapter
// =============================================================================

/**
 * Adapter for transforming IceType schemas to DuckDB DDL.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { DuckDBAdapter } from '@icetype/duckdb';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 * });
 *
 * const adapter = new DuckDBAdapter();
 *
 * // Get DDL structure
 * const ddl = adapter.transform(schema);
 *
 * // Serialize to CREATE TABLE statement
 * const sql = adapter.serialize(ddl);
 * console.log(sql);
 * // CREATE TABLE "User" (
 * //   "$id" VARCHAR NOT NULL,
 * //   "$type" VARCHAR NOT NULL,
 * //   ...
 * //   "id" UUID NOT NULL,
 * //   "email" VARCHAR UNIQUE,
 * //   "name" VARCHAR,
 * //   "age" INTEGER,
 * //   PRIMARY KEY ("$id")
 * // );
 * ```
 */
export class DuckDBAdapter
  implements SchemaAdapter<DuckDBDDL, DuckDBAdapterOptions>
{
  readonly name = 'duckdb';
  readonly version = VERSION;

  /**
   * Transform an IceType schema to a DuckDB DDL structure.
   *
   * @param schema - The IceType schema to transform
   * @param options - Optional DuckDB-specific options
   * @returns DuckDB DDL structure
   */
  transform(
    schema: IceTypeSchema,
    options?: DuckDBAdapterOptions
  ): DuckDBDDL {
    const columns: DuckDBColumn[] = [];
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

      const column = fieldToDuckDBColumn(fieldName, fieldDef);
      columns.push(column);
    }

    // Build DDL structure
    const ddl: DuckDBDDL = {
      tableName: options?.tableName ?? schema.name,
      schemaName: options?.schema,
      columns,
      primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
      temporary: options?.temporary,
      ifNotExists: options?.ifNotExists,
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
   * Serialize DuckDB DDL to a CREATE TABLE SQL statement.
   *
   * @param output - The DDL structure to serialize
   * @returns SQL CREATE TABLE statement
   */
  serialize(output: DuckDBDDL): string {
    return serializeDDL(output);
  }

  /**
   * Generate DDL including index statements.
   *
   * @param ddl - The DDL structure
   * @returns Full DDL including CREATE INDEX statements
   */
  serializeWithIndexes(ddl: DuckDBDDL): string {
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
 * Create a new DuckDB adapter instance.
 *
 * @returns A new DuckDBAdapter instance
 */
export function createDuckDBAdapter(): DuckDBAdapter {
  return new DuckDBAdapter();
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Transform an IceType schema directly to a DuckDB CREATE TABLE statement.
 *
 * This is a convenience function that combines the adapter transform
 * and serialize steps.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional DuckDB-specific options
 * @returns SQL CREATE TABLE statement
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { transformToDuckDBDDL } from '@icetype/duckdb';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 * });
 *
 * const sql = transformToDuckDBDDL(schema, { ifNotExists: true });
 * console.log(sql);
 * // CREATE TABLE IF NOT EXISTS "User" (
 * //   ...
 * // );
 * ```
 */
export function transformToDuckDBDDL(
  schema: IceTypeSchema,
  options?: DuckDBAdapterOptions
): string {
  const adapter = new DuckDBAdapter();
  const ddl = adapter.transform(schema, options);
  return adapter.serialize(ddl);
}

/**
 * Transform an IceType schema to DuckDB DDL structure.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional DuckDB-specific options
 * @returns DuckDB DDL structure
 */
export function generateDuckDBDDL(
  schema: IceTypeSchema,
  options?: DuckDBAdapterOptions
): DuckDBDDL {
  const adapter = new DuckDBAdapter();
  return adapter.transform(schema, options);
}
