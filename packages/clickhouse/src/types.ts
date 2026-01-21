/**
 * ClickHouse Type Definitions
 *
 * Defines the types for ClickHouse DDL generation including
 * table engines, columns, and table options.
 *
 * Type mappings are now imported from @icetype/core for consistency
 * across all adapters.
 *
 * @packageDocumentation
 */

import { getUnifiedTypeMapping, type Dialect } from '@icetype/core';

// =============================================================================
// ClickHouse Engine Types
// =============================================================================

/**
 * ClickHouse table engine types.
 *
 * Each engine has different characteristics:
 * - `MergeTree` - Basic engine with sorting and partitioning
 * - `ReplacingMergeTree` - Deduplicates rows with same sorting key
 * - `SummingMergeTree` - Sums numeric columns for rows with same sorting key
 * - `AggregatingMergeTree` - Stores intermediate aggregation states
 * - `CollapsingMergeTree` - Collapses rows using sign column
 */
export type ClickHouseEngine =
  | 'MergeTree'
  | 'ReplacingMergeTree'
  | 'SummingMergeTree'
  | 'AggregatingMergeTree'
  | 'CollapsingMergeTree';

// =============================================================================
// Table Options
// =============================================================================

/**
 * Options for ClickHouse table creation.
 *
 * @example
 * ```typescript
 * const options: ClickHouseTableOptions = {
 *   engine: 'ReplacingMergeTree',
 *   orderBy: ['tenant_id', 'created_at'],
 *   partitionBy: 'toYYYYMM(created_at)',
 *   settings: {
 *     index_granularity: '8192',
 *   },
 * };
 * ```
 */
export interface ClickHouseTableOptions {
  /** The table engine to use (defaults to MergeTree) */
  engine?: ClickHouseEngine;
  /** Columns for ORDER BY clause (required for MergeTree family) */
  orderBy?: string[];
  /** Expression for PARTITION BY clause */
  partitionBy?: string;
  /** Additional table settings */
  settings?: Record<string, string | number | boolean>;
  /** Version column for ReplacingMergeTree */
  versionColumn?: string;
  /** Sign column for CollapsingMergeTree */
  signColumn?: string;
  /** Columns to sum for SummingMergeTree */
  sumColumns?: string[];
  /** Database name */
  database?: string;
  /** Create table if not exists */
  ifNotExists?: boolean;
  /** TTL expression for data expiration */
  ttl?: string;
  /** Primary key columns (defaults to orderBy if not specified) */
  primaryKey?: string[];
}

// =============================================================================
// Column Definition
// =============================================================================

/**
 * ClickHouse column definition.
 *
 * @example
 * ```typescript
 * const column: ClickHouseColumn = {
 *   name: 'created_at',
 *   type: 'DateTime64(3)',
 *   nullable: false,
 *   default: 'now()',
 * };
 * ```
 */
export interface ClickHouseColumn {
  /** Column name */
  name: string;
  /** ClickHouse data type */
  type: string;
  /** Whether the column is nullable */
  nullable: boolean;
  /** Default value expression */
  default?: string;
  /** Column comment */
  comment?: string;
  /** Codec for compression */
  codec?: string;
  /** TTL expression for this column */
  ttl?: string;
}

// =============================================================================
// DDL Structure
// =============================================================================

/**
 * Complete ClickHouse DDL structure for a table.
 *
 * This represents the parsed and transformed schema ready for
 * DDL generation.
 *
 * @example
 * ```typescript
 * const ddl: ClickHouseDDL = {
 *   tableName: 'users',
 *   database: 'analytics',
 *   columns: [
 *     { name: 'id', type: 'UUID', nullable: false },
 *     { name: 'email', type: 'String', nullable: false },
 *     { name: 'created_at', type: 'DateTime64(3)', nullable: false },
 *   ],
 *   engine: 'MergeTree',
 *   orderBy: ['id'],
 *   partitionBy: 'toYYYYMM(created_at)',
 * };
 * ```
 */
export interface ClickHouseDDL {
  /** Table name */
  tableName: string;
  /** Database name (optional) */
  database?: string;
  /** Column definitions */
  columns: ClickHouseColumn[];
  /** Table engine */
  engine: ClickHouseEngine;
  /** ORDER BY columns */
  orderBy: string[];
  /** PARTITION BY expression */
  partitionBy?: string;
  /** PRIMARY KEY columns (if different from orderBy) */
  primaryKey?: string[];
  /** Table settings */
  settings?: Record<string, string | number | boolean>;
  /** TTL expression */
  ttl?: string;
  /** Version column for ReplacingMergeTree */
  versionColumn?: string;
  /** Sign column for CollapsingMergeTree */
  signColumn?: string;
  /** Sum columns for SummingMergeTree */
  sumColumns?: string[];
  /** Create IF NOT EXISTS */
  ifNotExists?: boolean;
}

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * Get the ClickHouse type for an IceType.
 *
 * Uses the unified type mappings from @icetype/core for consistency.
 *
 * @param iceType - The IceType type string
 * @returns The ClickHouse type string
 */
export function getClickHouseTypeFromCore(iceType: string): string {
  return getUnifiedTypeMapping(iceType, 'clickhouse' as Dialect);
}

/**
 * Mapping from IceType types to ClickHouse types.
 *
 * @deprecated Use getClickHouseTypeFromCore() or getUnifiedTypeMapping() from @icetype/core instead.
 * This table is kept for backward compatibility but derives from the unified mappings.
 */
export const ICETYPE_TO_CLICKHOUSE: Record<string, string> = {
  // String types
  string: 'String',
  text: 'String',
  varchar: 'String',
  char: 'String',

  // Integer types
  int: 'Int32',
  long: 'Int64',
  bigint: 'Int64',

  // Floating point types
  float: 'Float32',
  double: 'Float64',

  // Boolean
  bool: 'Bool',
  boolean: 'Bool',

  // UUID
  uuid: 'UUID',

  // Date/Time types
  timestamp: 'DateTime64(3)',
  timestamptz: 'DateTime64(3)',
  date: 'Date',
  time: 'String', // ClickHouse doesn't have a native Time type

  // Complex types
  json: 'JSON',
  binary: 'String', // Base64 encoded

  // Decimal
  decimal: 'Decimal(38, 9)',

  // Array handling is done separately
};

/**
 * Get the ClickHouse type for an IceType type.
 *
 * @param iceType - The IceType type string
 * @param precision - Optional precision for decimal types
 * @param scale - Optional scale for decimal types
 * @returns The corresponding ClickHouse type
 */
export function getClickHouseType(
  iceType: string,
  precision?: number,
  scale?: number
): string {
  const normalizedType = iceType.toLowerCase();

  // Handle decimal with custom precision/scale
  if (normalizedType === 'decimal' && precision !== undefined) {
    const actualScale = scale ?? 0;
    return `Decimal(${precision}, ${actualScale})`;
  }

  // Look up in mapping
  const mappedType = ICETYPE_TO_CLICKHOUSE[normalizedType];
  if (mappedType) {
    return mappedType;
  }

  // Default to String for unknown types
  return 'String';
}

/**
 * Wrap a type in Nullable() if needed.
 *
 * @param type - The ClickHouse type
 * @param nullable - Whether the type should be nullable
 * @returns The type, wrapped in Nullable() if needed
 */
export function wrapNullable(type: string, nullable: boolean): string {
  if (!nullable) {
    return type;
  }
  // Don't double-wrap
  if (type.startsWith('Nullable(')) {
    return type;
  }
  return `Nullable(${type})`;
}

/**
 * Get the Array type for a given element type.
 *
 * @param elementType - The element type
 * @returns The Array type string
 */
export function getArrayType(elementType: string): string {
  return `Array(${elementType})`;
}
