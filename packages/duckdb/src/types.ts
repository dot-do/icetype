/**
 * DuckDB Type Definitions
 *
 * Defines the types and interfaces specific to DuckDB DDL generation.
 *
 * Type mappings are now imported from @icetype/core for consistency
 * across all adapters.
 *
 * @packageDocumentation
 */

import { getUnifiedTypeMapping, type Dialect } from '@icetype/core';

// =============================================================================
// DuckDB Column Types
// =============================================================================

/**
 * DuckDB native data types
 * @see https://duckdb.org/docs/sql/data_types/overview
 */
export type DuckDBType =
  | 'VARCHAR'
  | 'TEXT'
  | 'INTEGER'
  | 'BIGINT'
  | 'SMALLINT'
  | 'TINYINT'
  | 'REAL'
  | 'FLOAT'
  | 'DOUBLE'
  | 'BOOLEAN'
  | 'UUID'
  | 'TIMESTAMP'
  | 'TIMESTAMPTZ'
  | 'DATE'
  | 'TIME'
  | 'JSON'
  | 'BLOB'
  | 'DECIMAL'
  | 'HUGEINT'
  | 'INTERVAL';

// =============================================================================
// DuckDB Column Definition
// =============================================================================

/**
 * DuckDB column definition for DDL generation.
 */
export interface DuckDBColumn {
  /** Column name */
  name: string;
  /** DuckDB data type */
  type: string;
  /** Whether the column allows NULL values */
  nullable: boolean;
  /** Default value expression (as SQL string) */
  default?: string;
  /** Whether this column is part of the primary key */
  primaryKey?: boolean;
  /** Whether this column has a unique constraint */
  unique?: boolean;
  /** Precision for DECIMAL type */
  precision?: number;
  /** Scale for DECIMAL type */
  scale?: number;
}

// =============================================================================
// DuckDB Table Options
// =============================================================================

/**
 * Options for DuckDB table creation.
 */
export interface DuckDBTableOptions {
  /** Create as a temporary table */
  temporary?: boolean;
  /** Add IF NOT EXISTS clause */
  ifNotExists?: boolean;
  /** Schema name (defaults to 'main') */
  schema?: string;
  /** Include system fields ($id, $type, etc.) */
  includeSystemFields?: boolean;
}

// =============================================================================
// DuckDB DDL Structure
// =============================================================================

/**
 * DuckDB DDL representation.
 *
 * Contains all the information needed to generate a CREATE TABLE statement.
 */
export interface DuckDBDDL {
  /** Table name */
  tableName: string;
  /** Schema name (e.g., 'main') */
  schemaName?: string;
  /** Column definitions */
  columns: DuckDBColumn[];
  /** Primary key column names */
  primaryKey?: string[];
  /** Unique constraints (arrays of column names) */
  uniqueConstraints?: string[][];
  /** Whether the table is temporary */
  temporary?: boolean;
  /** Whether to use IF NOT EXISTS */
  ifNotExists?: boolean;
}

// =============================================================================
// Type Mapping Configuration
// =============================================================================

/**
 * Configuration for mapping IceType types to DuckDB types.
 */
export interface DuckDBTypeMapping {
  /** The DuckDB type name */
  duckdbType: string;
  /** Default precision for decimal types */
  precision?: number;
  /** Default scale for decimal types */
  scale?: number;
}

/**
 * Get the DuckDB type for an IceType.
 *
 * Uses the unified type mappings from @icetype/core for consistency.
 *
 * @param iceType - The IceType type string
 * @returns The DuckDB type string
 */
export function getDuckDBTypeFromCore(iceType: string): string {
  return getUnifiedTypeMapping(iceType, 'duckdb' as Dialect);
}

/**
 * IceType to DuckDB type mapping table.
 *
 * Maps IceType primitive types to their DuckDB equivalents.
 *
 * @deprecated Use getDuckDBTypeFromCore() or getUnifiedTypeMapping() from @icetype/core instead.
 * This table is kept for backward compatibility but derives from the unified mappings.
 */
export const ICETYPE_TO_DUCKDB: Record<string, DuckDBTypeMapping> = {
  // String types
  string: { duckdbType: 'VARCHAR' },
  text: { duckdbType: 'VARCHAR' },

  // Integer types
  int: { duckdbType: 'INTEGER' },
  long: { duckdbType: 'BIGINT' },
  bigint: { duckdbType: 'BIGINT' },

  // Floating point types
  float: { duckdbType: 'REAL' },
  double: { duckdbType: 'DOUBLE' },

  // Boolean
  bool: { duckdbType: 'BOOLEAN' },
  boolean: { duckdbType: 'BOOLEAN' },

  // UUID
  uuid: { duckdbType: 'UUID' },

  // Date/Time types
  timestamp: { duckdbType: 'TIMESTAMP' },
  timestamptz: { duckdbType: 'TIMESTAMPTZ' },
  date: { duckdbType: 'DATE' },
  time: { duckdbType: 'TIME' },

  // JSON
  json: { duckdbType: 'JSON' },

  // Binary
  binary: { duckdbType: 'BLOB' },

  // Decimal
  decimal: { duckdbType: 'DECIMAL', precision: 38, scale: 9 },
};

// =============================================================================
// Adapter Options
// =============================================================================

/**
 * Options for the DuckDB adapter.
 */
export interface DuckDBAdapterOptions extends DuckDBTableOptions {
  /** Override the table name (defaults to schema name) */
  tableName?: string;
}
