/**
 * @icetype/postgres
 *
 * PostgreSQL adapter for IceType schema transformations.
 * Compatible with postgres.do (https://postgres.do) and Drizzle ORM.
 *
 * This package provides an adapter for transforming IceType schemas
 * to PostgreSQL DDL (Data Definition Language) statements.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { PostgresAdapter, transformToPostgresDDL } from '@icetype/postgres';
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
 * const adapter = new PostgresAdapter();
 * const ddl = adapter.transform(schema, { ifNotExists: true });
 * const sql = adapter.serialize(ddl);
 *
 * // Option 2: Use the convenience function
 * const sql2 = transformToPostgresDDL(schema, {
 *   ifNotExists: true,
 *   schema: 'public',
 * });
 *
 * console.log(sql2);
 * // CREATE TABLE IF NOT EXISTS "public"."User" (
 * //   "$id" TEXT NOT NULL,
 * //   "$type" TEXT NOT NULL,
 * //   "$version" INTEGER NOT NULL DEFAULT 1,
 * //   "$createdAt" BIGINT NOT NULL,
 * //   "$updatedAt" BIGINT NOT NULL,
 * //   "id" UUID NOT NULL,
 * //   "email" TEXT UNIQUE,
 * //   "name" TEXT,
 * //   "age" INTEGER,
 * //   "balance" DECIMAL(38, 9),
 * //   "tags" TEXT[],
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
  PostgresType,
  PostgresColumn,
  PostgresTableOptions,
  PostgresDDL,
  PostgresTypeMapping,
  PostgresAdapterOptions,
} from './types.js';

export { ICETYPE_TO_POSTGRES } from './types.js';

// =============================================================================
// DDL Helpers
// =============================================================================

export {
  mapIceTypeToPostgres,
  getPostgresTypeString,
  toArrayType,
  fieldToPostgresColumn,
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
  PostgresAdapter,
  createPostgresAdapter,
  transformToPostgresDDL,
  generatePostgresDDL,
} from './adapter.js';
