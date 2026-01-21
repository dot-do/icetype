/**
 * @icetype/mysql
 *
 * MySQL adapter for IceType schema transformations.
 *
 * This package provides an adapter for transforming IceType schemas
 * to MySQL DDL (Data Definition Language) statements.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { MySQLAdapter, transformToMySQLDDL } from '@icetype/mysql';
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
 * const adapter = new MySQLAdapter();
 * const ddl = adapter.transform(schema, { ifNotExists: true });
 * const sql = adapter.serialize(ddl);
 *
 * // Option 2: Use the convenience function
 * const sql2 = transformToMySQLDDL(schema, {
 *   ifNotExists: true,
 *   charset: 'utf8mb4',
 *   collation: 'utf8mb4_unicode_ci',
 * });
 *
 * console.log(sql2);
 * // CREATE TABLE IF NOT EXISTS User (
 * //   `$id` VARCHAR(255) NOT NULL,
 * //   `$type` VARCHAR(255) NOT NULL,
 * //   `$version` INT NOT NULL DEFAULT 1,
 * //   `$createdAt` BIGINT NOT NULL,
 * //   `$updatedAt` BIGINT NOT NULL,
 * //   id CHAR(36) NOT NULL,
 * //   email VARCHAR(255) UNIQUE,
 * //   name VARCHAR(255),
 * //   age INT,
 * //   balance DECIMAL(38, 9),
 * //   createdAt DATETIME,
 * //   PRIMARY KEY (`$id`),
 * //   UNIQUE (email)
 * // ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

export type {
  MySQLType,
  MySQLColumn,
  MySQLTableOptions,
  MySQLDDL,
  MySQLTypeMapping,
  MySQLAdapterOptions,
} from './types.js';

export { ICETYPE_TO_MYSQL } from './types.js';

// =============================================================================
// DDL Helpers
// =============================================================================

export {
  mapIceTypeToMySQL,
  getMySQLTypeString,
  fieldToMySQLColumn,
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
  MySQLAdapter,
  createMySQLAdapter,
  transformToMySQLDDL,
  generateMySQLDDL,
} from './adapter.js';
