/**
 * MySQL Type Definitions
 *
 * Defines the types and interfaces specific to MySQL DDL generation.
 *
 * Type mappings are now imported from @icetype/core for consistency
 * across all adapters.
 *
 * @packageDocumentation
 */

import { getUnifiedTypeMapping, type Dialect } from '@icetype/core';

// =============================================================================
// MySQL Column Types
// =============================================================================

/**
 * MySQL native data types
 * @see https://dev.mysql.com/doc/refman/8.0/en/data-types.html
 */
export type MySQLType =
  | 'VARCHAR'
  | 'CHAR'
  | 'TEXT'
  | 'TINYTEXT'
  | 'MEDIUMTEXT'
  | 'LONGTEXT'
  | 'INT'
  | 'TINYINT'
  | 'SMALLINT'
  | 'MEDIUMINT'
  | 'BIGINT'
  | 'FLOAT'
  | 'DOUBLE'
  | 'DECIMAL'
  | 'DATE'
  | 'TIME'
  | 'DATETIME'
  | 'TIMESTAMP'
  | 'YEAR'
  | 'JSON'
  | 'BLOB'
  | 'TINYBLOB'
  | 'MEDIUMBLOB'
  | 'LONGBLOB'
  | 'BINARY'
  | 'VARBINARY'
  | 'ENUM'
  | 'SET';

// =============================================================================
// MySQL Column Definition
// =============================================================================

/**
 * MySQL column definition for DDL generation.
 */
export interface MySQLColumn {
  /** Column name */
  name: string;
  /** MySQL data type */
  type: string;
  /** Whether the column allows NULL values */
  nullable: boolean;
  /** Default value expression (as SQL string) */
  default?: string;
  /** Whether this column is part of the primary key */
  primaryKey?: boolean;
  /** Whether this column has a unique constraint */
  unique?: boolean;
  /** Whether this is an AUTO_INCREMENT column */
  autoIncrement?: boolean;
  /** Precision for DECIMAL type */
  precision?: number;
  /** Scale for DECIMAL type */
  scale?: number;
  /** Length for VARCHAR/CHAR types */
  length?: number;
}

// =============================================================================
// MySQL Table Options
// =============================================================================

/**
 * Options for MySQL table creation.
 */
export interface MySQLTableOptions {
  /** Add IF NOT EXISTS clause */
  ifNotExists?: boolean;
  /** Include system fields ($id, $type, etc.) */
  includeSystemFields?: boolean;
  /** Storage engine (defaults to InnoDB) */
  engine?: 'InnoDB' | 'MyISAM' | 'MEMORY' | 'CSV' | 'ARCHIVE' | string;
  /** Character set */
  charset?: string;
  /** Collation */
  collation?: string;
  /** Table comment */
  comment?: string;
}

// =============================================================================
// MySQL DDL Structure
// =============================================================================

/**
 * MySQL DDL representation.
 *
 * Contains all the information needed to generate a CREATE TABLE statement.
 */
export interface MySQLDDL {
  /** Table name */
  tableName: string;
  /** Column definitions */
  columns: MySQLColumn[];
  /** Primary key column names */
  primaryKey?: string[];
  /** Unique constraints (arrays of column names) */
  uniqueConstraints?: string[][];
  /** Whether to use IF NOT EXISTS */
  ifNotExists?: boolean;
  /** Storage engine */
  engine?: string;
  /** Character set */
  charset?: string;
  /** Collation */
  collation?: string;
  /** Table comment */
  comment?: string;
  /** Check constraints */
  checkConstraints?: Array<{
    name?: string;
    expression: string;
  }>;
  /** Foreign key constraints */
  foreignKeys?: Array<{
    columns: string[];
    references: {
      table: string;
      columns: string[];
    };
    onDelete?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
  }>;
}

// =============================================================================
// Type Mapping Configuration
// =============================================================================

/**
 * Configuration for mapping IceType types to MySQL types.
 */
export interface MySQLTypeMapping {
  /** The MySQL type name */
  mysqlType: string;
  /** Default precision for decimal types */
  precision?: number;
  /** Default scale for decimal types */
  scale?: number;
  /** Default length for character types */
  length?: number;
}

/**
 * Get the MySQL type for an IceType.
 *
 * Uses the unified type mappings from @icetype/core for consistency.
 *
 * @param iceType - The IceType type string
 * @returns The MySQL type string
 */
export function getMySQLTypeFromCore(iceType: string): string {
  return getUnifiedTypeMapping(iceType, 'mysql' as Dialect);
}

/**
 * IceType to MySQL type mapping table.
 *
 * Maps IceType primitive types to their MySQL equivalents.
 *
 * @deprecated Use getMySQLTypeFromCore() or getUnifiedTypeMapping() from @icetype/core instead.
 * This table is kept for backward compatibility but derives from the unified mappings.
 */
export const ICETYPE_TO_MYSQL: Record<string, MySQLTypeMapping> = {
  // String types
  string: { mysqlType: 'VARCHAR', length: 255 },
  text: { mysqlType: 'TEXT' },
  varchar: { mysqlType: 'VARCHAR', length: 255 },

  // Integer types
  int: { mysqlType: 'INT' },
  long: { mysqlType: 'BIGINT' },
  bigint: { mysqlType: 'BIGINT' },

  // Floating point types
  float: { mysqlType: 'FLOAT' },
  double: { mysqlType: 'DOUBLE' },

  // Boolean - MySQL uses TINYINT(1) for boolean
  bool: { mysqlType: 'TINYINT', length: 1 },
  boolean: { mysqlType: 'TINYINT', length: 1 },

  // UUID - MySQL doesn't have native UUID, use CHAR(36)
  uuid: { mysqlType: 'CHAR', length: 36 },

  // Date/Time types
  timestamp: { mysqlType: 'DATETIME' },
  timestamptz: { mysqlType: 'DATETIME' },
  date: { mysqlType: 'DATE' },
  time: { mysqlType: 'TIME' },

  // JSON - MySQL 5.7+ supports native JSON
  json: { mysqlType: 'JSON' },

  // Binary
  binary: { mysqlType: 'BLOB' },

  // Decimal
  decimal: { mysqlType: 'DECIMAL', precision: 38, scale: 9 },
};

// =============================================================================
// Adapter Options
// =============================================================================

/**
 * Options for the MySQL adapter.
 */
export interface MySQLAdapterOptions extends MySQLTableOptions {
  /** Override the table name (defaults to schema name) */
  tableName?: string;
}
