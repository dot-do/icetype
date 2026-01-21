/**
 * @icetype/duckdb
 *
 * DuckDB adapter for IceType schema transformations.
 *
 * This package provides an adapter for transforming IceType schemas
 * to DuckDB DDL (Data Definition Language) statements.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { DuckDBAdapter, transformToDuckDBDDL } from '@icetype/duckdb';
 *
 * // Parse an IceType schema
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 *   balance: 'decimal',
 *   tags: 'string[]',
 *   createdAt: 'timestamp',
 * });
 *
 * // Option 1: Use the adapter directly
 * const adapter = new DuckDBAdapter();
 * const ddl = adapter.transform(schema, { ifNotExists: true });
 * const sql = adapter.serialize(ddl);
 *
 * // Option 2: Use the convenience function
 * const sql2 = transformToDuckDBDDL(schema, {
 *   ifNotExists: true,
 *   schema: 'analytics',
 * });
 *
 * console.log(sql2);
 * // CREATE TABLE IF NOT EXISTS "analytics"."User" (
 * //   "$id" VARCHAR NOT NULL,
 * //   "$type" VARCHAR NOT NULL,
 * //   "$version" INTEGER NOT NULL DEFAULT 1,
 * //   "$createdAt" BIGINT NOT NULL,
 * //   "$updatedAt" BIGINT NOT NULL,
 * //   "id" UUID NOT NULL,
 * //   "email" VARCHAR UNIQUE,
 * //   "name" VARCHAR,
 * //   "age" INTEGER,
 * //   "balance" DECIMAL(38, 9),
 * //   "tags" VARCHAR[],
 * //   "createdAt" TIMESTAMP,
 * //   PRIMARY KEY ("$id"),
 * //   UNIQUE ("email")
 * // );
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

export type {
  DuckDBType,
  DuckDBColumn,
  DuckDBTableOptions,
  DuckDBDDL,
  DuckDBTypeMapping,
  DuckDBAdapterOptions,
} from './types.js';

export { ICETYPE_TO_DUCKDB } from './types.js';

// =============================================================================
// DDL Helpers
// =============================================================================

export {
  mapIceTypeToDuckDB,
  getDuckDBTypeString,
  toArrayType,
  fieldToDuckDBColumn,
  formatDefaultValue,
  generateSystemColumns,
  escapeIdentifier,
  serializeColumn,
  serializeDDL,
  generateIndexStatements,
} from './ddl.js';

// Re-export schema validation from sql-common
export {
  validateSchemaName,
  InvalidSchemaNameError,
} from '@icetype/sql-common';

// =============================================================================
// Adapter
// =============================================================================

export {
  DuckDBAdapter,
  createDuckDBAdapter,
  transformToDuckDBDDL,
  generateDuckDBDDL,
} from './adapter.js';
