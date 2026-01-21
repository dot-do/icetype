/**
 * @icetype/sqlite
 *
 * SQLite adapter for IceType schema transformations.
 *
 * This package provides an adapter for transforming IceType schemas
 * to SQLite DDL (Data Definition Language) statements.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { SQLiteAdapter, transformToSQLiteDDL } from '@icetype/sqlite';
 *
 * // Parse an IceType schema
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 *   balance: 'decimal',
 *   createdAt: 'timestamp',
 * });
 *
 * // Option 1: Use the adapter directly
 * const adapter = new SQLiteAdapter();
 * const ddl = adapter.transform(schema, { ifNotExists: true });
 * const sql = adapter.serialize(ddl);
 *
 * // Option 2: Use the convenience function
 * const sql2 = transformToSQLiteDDL(schema, {
 *   ifNotExists: true,
 *   strict: true,
 * });
 *
 * console.log(sql2);
 * // CREATE TABLE IF NOT EXISTS User (
 * //   "$id" TEXT NOT NULL,
 * //   "$type" TEXT NOT NULL,
 * //   "$version" INTEGER NOT NULL DEFAULT 1,
 * //   "$createdAt" INTEGER NOT NULL,
 * //   "$updatedAt" INTEGER NOT NULL,
 * //   id TEXT NOT NULL,
 * //   email TEXT UNIQUE,
 * //   name TEXT,
 * //   age INTEGER,
 * //   balance REAL,
 * //   createdAt TEXT,
 * //   PRIMARY KEY ("$id"),
 * //   UNIQUE (email)
 * // ) STRICT;
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

export type {
  SQLiteType,
  SQLiteColumn,
  SQLiteTableOptions,
  SQLiteDDL,
  SQLiteTypeMapping,
  SQLiteAdapterOptions,
} from './types.js';

export { ICETYPE_TO_SQLITE } from './types.js';

// =============================================================================
// DDL Helpers
// =============================================================================

export {
  mapIceTypeToSQLite,
  getSQLiteTypeString,
  fieldToSQLiteColumn,
  formatDefaultValue,
  generateSystemColumns,
  escapeIdentifier,
  serializeColumn,
  serializeDDL,
  generateIndexStatements,
} from './ddl.js';

// =============================================================================
// Adapter
// =============================================================================

export {
  SQLiteAdapter,
  createSQLiteAdapter,
  transformToSQLiteDDL,
  generateSQLiteDDL,
} from './adapter.js';
