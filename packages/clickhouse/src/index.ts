/**
 * @icetype/clickhouse
 *
 * ClickHouse adapter for IceType schema transformations.
 *
 * This package provides an adapter that transforms IceType schemas
 * into ClickHouse DDL (CREATE TABLE statements) with support for
 * various MergeTree engine types.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { ClickHouseAdapter } from '@icetype/clickhouse';
 *
 * // Parse an IceType schema
 * const schema = parseSchema({
 *   $type: 'User',
 *   $partitionBy: ['created_at'],
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 *   created_at: 'timestamp!',
 *   tags: 'string[]',
 * });
 *
 * // Create the adapter
 * const adapter = new ClickHouseAdapter();
 *
 * // Transform to ClickHouse DDL structure
 * const ddl = adapter.transform(schema, {
 *   engine: 'ReplacingMergeTree',
 *   orderBy: ['id'],
 *   partitionBy: 'toYYYYMM(created_at)',
 *   database: 'analytics',
 * });
 *
 * // Generate CREATE TABLE SQL
 * const sql = adapter.serialize(ddl);
 * console.log(sql);
 * // CREATE TABLE IF NOT EXISTS analytics.user
 * // (
 * //     id UUID,
 * //     email String,
 * //     name String,
 * //     age Nullable(Int32),
 * //     created_at DateTime64(3),
 * //     tags Array(String)
 * // )
 * // ENGINE = ReplacingMergeTree()
 * // PARTITION BY toYYYYMM(created_at)
 * // ORDER BY (id)
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

export type {
  ClickHouseEngine,
  ClickHouseTableOptions,
  ClickHouseColumn,
  ClickHouseDDL,
} from './types.js';

export {
  ICETYPE_TO_CLICKHOUSE,
  getClickHouseType,
  wrapNullable,
  getArrayType,
} from './types.js';

// =============================================================================
// DDL Helpers
// =============================================================================

export {
  escapeIdentifier,
  escapeString,
  escapeSettingKey,
  escapeSettingValue,
  InvalidSettingKeyError,
  InvalidSettingValueError,
  generateColumnDDL,
  generateEngineDDL,
  generateCreateTableDDL,
  generateDropTableDDL,
  generateAddColumnDDL,
  generateDropColumnDDL,
  isValidEngine,
  inferOrderBy,
} from './ddl.js';

// =============================================================================
// Adapter
// =============================================================================

export {
  ClickHouseAdapter,
  createClickHouseAdapter,
  transformToClickHouseDDL,
  generateClickHouseDDL,
} from './adapter.js';
