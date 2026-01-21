/**
 * SQLite Type Definitions
 *
 * Defines the types and interfaces specific to SQLite DDL generation.
 *
 * @packageDocumentation
 */

// =============================================================================
// SQLite Column Types
// =============================================================================

/**
 * SQLite native storage classes
 *
 * SQLite uses a dynamic type system with only five storage classes:
 * NULL, INTEGER, REAL, TEXT, and BLOB.
 *
 * @see https://www.sqlite.org/datatype3.html
 */
export type SQLiteType = 'INTEGER' | 'REAL' | 'TEXT' | 'BLOB';

// =============================================================================
// SQLite Column Definition
// =============================================================================

/**
 * SQLite column definition for DDL generation.
 */
export interface SQLiteColumn {
  /** Column name */
  name: string;
  /** SQLite data type (storage class) */
  type: string;
  /** Whether the column allows NULL values */
  nullable: boolean;
  /** Default value expression (as SQL string) */
  default?: string;
  /** Whether this column is part of the primary key */
  primaryKey?: boolean;
  /** Whether this column has a unique constraint */
  unique?: boolean;
  /** Whether this is an AUTOINCREMENT column (only valid for INTEGER PRIMARY KEY) */
  autoIncrement?: boolean;
}

// =============================================================================
// SQLite Table Options
// =============================================================================

/**
 * Options for SQLite table creation.
 */
export interface SQLiteTableOptions {
  /** Add IF NOT EXISTS clause */
  ifNotExists?: boolean;
  /** Include system fields ($id, $type, etc.) */
  includeSystemFields?: boolean;
  /** Use WITHOUT ROWID optimization (table must have PRIMARY KEY) */
  withoutRowid?: boolean;
  /** Use STRICT mode for type enforcement (SQLite 3.37+) */
  strict?: boolean;
}

// =============================================================================
// SQLite DDL Structure
// =============================================================================

/**
 * SQLite DDL representation.
 *
 * Contains all the information needed to generate a CREATE TABLE statement.
 */
export interface SQLiteDDL {
  /** Table name */
  tableName: string;
  /** Column definitions */
  columns: SQLiteColumn[];
  /** Primary key column names */
  primaryKey?: string[];
  /** Unique constraints (arrays of column names) */
  uniqueConstraints?: string[][];
  /** Whether to use IF NOT EXISTS */
  ifNotExists?: boolean;
  /** Whether to use WITHOUT ROWID */
  withoutRowid?: boolean;
  /** Whether to use STRICT mode */
  strict?: boolean;
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
 * Configuration for mapping IceType types to SQLite types.
 */
export interface SQLiteTypeMapping {
  /** The SQLite type name (storage class) */
  sqliteType: string;
}

/**
 * IceType to SQLite type mapping table.
 *
 * Maps IceType primitive types to their SQLite equivalents.
 *
 * SQLite has a simplified type system with only four storage classes:
 * - INTEGER: Signed integer (1, 2, 3, 4, 6, or 8 bytes)
 * - REAL: 8-byte IEEE floating point
 * - TEXT: UTF-8, UTF-16BE or UTF-16LE string
 * - BLOB: Binary data
 *
 * Note: SQLite stores booleans as INTEGER (0 or 1)
 * Note: SQLite stores timestamps as TEXT (ISO8601) or INTEGER (Unix epoch)
 * Note: SQLite stores JSON as TEXT (use json() functions for manipulation)
 *
 * @see https://www.sqlite.org/datatype3.html
 */
export const ICETYPE_TO_SQLITE: Record<string, SQLiteTypeMapping> = {
  // String types -> TEXT
  string: { sqliteType: 'TEXT' },
  text: { sqliteType: 'TEXT' },
  varchar: { sqliteType: 'TEXT' },

  // Integer types -> INTEGER
  int: { sqliteType: 'INTEGER' },
  long: { sqliteType: 'INTEGER' },
  bigint: { sqliteType: 'INTEGER' },

  // Floating point types -> REAL
  float: { sqliteType: 'REAL' },
  double: { sqliteType: 'REAL' },

  // Boolean -> INTEGER (0 or 1)
  bool: { sqliteType: 'INTEGER' },
  boolean: { sqliteType: 'INTEGER' },

  // UUID -> TEXT (no native UUID type in SQLite)
  uuid: { sqliteType: 'TEXT' },

  // Date/Time types -> TEXT (ISO8601 format)
  timestamp: { sqliteType: 'TEXT' },
  timestamptz: { sqliteType: 'TEXT' },
  date: { sqliteType: 'TEXT' },
  time: { sqliteType: 'TEXT' },

  // JSON -> TEXT (use json1 extension for operations)
  json: { sqliteType: 'TEXT' },

  // Binary -> BLOB
  binary: { sqliteType: 'BLOB' },

  // Decimal -> REAL (SQLite has no native decimal type)
  decimal: { sqliteType: 'REAL' },
};

// =============================================================================
// Adapter Options
// =============================================================================

/**
 * Options for the SQLite adapter.
 */
export interface SQLiteAdapterOptions extends SQLiteTableOptions {
  /** Override the table name (defaults to schema name) */
  tableName?: string;
}
