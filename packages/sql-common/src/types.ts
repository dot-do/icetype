/**
 * Shared types for SQL utilities.
 *
 * This module contains types that are shared across all sql-common modules
 * to avoid circular dependencies.
 *
 * @packageDocumentation
 */

/**
 * Supported SQL dialects.
 */
export type SqlDialect = 'duckdb' | 'postgres' | 'clickhouse' | 'sqlite' | 'mysql';

/**
 * Common column definition interface used across all SQL dialects.
 */
export interface SqlColumn {
  /** Column name */
  name: string;
  /** SQL data type */
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
