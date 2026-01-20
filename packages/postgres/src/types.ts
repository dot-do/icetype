/**
 * PostgreSQL Type Definitions
 *
 * Defines the types and interfaces specific to PostgreSQL DDL generation.
 * Compatible with postgres.do and Drizzle ORM.
 *
 * @packageDocumentation
 */

// =============================================================================
// PostgreSQL Column Types
// =============================================================================

/**
 * PostgreSQL native data types
 * @see https://www.postgresql.org/docs/current/datatype.html
 */
export type PostgresType =
  | 'TEXT'
  | 'VARCHAR'
  | 'CHAR'
  | 'INTEGER'
  | 'BIGINT'
  | 'SMALLINT'
  | 'SERIAL'
  | 'BIGSERIAL'
  | 'REAL'
  | 'DOUBLE PRECISION'
  | 'BOOLEAN'
  | 'UUID'
  | 'TIMESTAMP'
  | 'TIMESTAMPTZ'
  | 'DATE'
  | 'TIME'
  | 'INTERVAL'
  | 'JSON'
  | 'JSONB'
  | 'BYTEA'
  | 'DECIMAL'
  | 'NUMERIC'
  | 'INET'
  | 'CIDR'
  | 'MACADDR';

// =============================================================================
// PostgreSQL Column Definition
// =============================================================================

/**
 * PostgreSQL column definition for DDL generation.
 */
export interface PostgresColumn {
  /** Column name */
  name: string;
  /** PostgreSQL data type */
  type: string;
  /** Whether the column allows NULL values */
  nullable: boolean;
  /** Default value expression (as SQL string) */
  default?: string;
  /** Whether this column is part of the primary key */
  primaryKey?: boolean;
  /** Whether this column has a unique constraint */
  unique?: boolean;
  /** Precision for DECIMAL/NUMERIC type */
  precision?: number;
  /** Scale for DECIMAL/NUMERIC type */
  scale?: number;
  /** Length for VARCHAR/CHAR types */
  length?: number;
  /** Whether this is an array type */
  isArray?: boolean;
}

// =============================================================================
// PostgreSQL Table Options
// =============================================================================

/**
 * Options for PostgreSQL table creation.
 */
export interface PostgresTableOptions {
  /** Add IF NOT EXISTS clause */
  ifNotExists?: boolean;
  /** Schema name (defaults to 'public') */
  schema?: string;
  /** Include system fields ($id, $type, etc.) */
  includeSystemFields?: boolean;
  /** Use UNLOGGED table for better write performance (no crash recovery) */
  unlogged?: boolean;
}

// =============================================================================
// PostgreSQL DDL Structure
// =============================================================================

/**
 * PostgreSQL DDL representation.
 *
 * Contains all the information needed to generate a CREATE TABLE statement.
 */
export interface PostgresDDL {
  /** Table name */
  tableName: string;
  /** Schema name (e.g., 'public') */
  schemaName?: string;
  /** Column definitions */
  columns: PostgresColumn[];
  /** Primary key column names */
  primaryKey?: string[];
  /** Unique constraints (arrays of column names) */
  uniqueConstraints?: string[][];
  /** Whether to use IF NOT EXISTS */
  ifNotExists?: boolean;
  /** Whether to use UNLOGGED table */
  unlogged?: boolean;
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
 * Configuration for mapping IceType types to PostgreSQL types.
 */
export interface PostgresTypeMapping {
  /** The PostgreSQL type name */
  postgresType: string;
  /** Default precision for decimal types */
  precision?: number;
  /** Default scale for decimal types */
  scale?: number;
  /** Default length for character types */
  length?: number;
}

/**
 * IceType to PostgreSQL type mapping table.
 *
 * Maps IceType primitive types to their PostgreSQL equivalents.
 * Compatible with postgres.do Drizzle schema generation.
 */
export const ICETYPE_TO_POSTGRES: Record<string, PostgresTypeMapping> = {
  // String types
  string: { postgresType: 'TEXT' },
  text: { postgresType: 'TEXT' },
  varchar: { postgresType: 'VARCHAR' },

  // Integer types
  int: { postgresType: 'INTEGER' },
  long: { postgresType: 'BIGINT' },
  bigint: { postgresType: 'BIGINT' },

  // Floating point types
  float: { postgresType: 'REAL' },
  double: { postgresType: 'DOUBLE PRECISION' },

  // Boolean
  bool: { postgresType: 'BOOLEAN' },
  boolean: { postgresType: 'BOOLEAN' },

  // UUID
  uuid: { postgresType: 'UUID' },

  // Date/Time types
  timestamp: { postgresType: 'TIMESTAMP' },
  timestamptz: { postgresType: 'TIMESTAMPTZ' },
  date: { postgresType: 'DATE' },
  time: { postgresType: 'TIME' },

  // JSON - use JSONB for better performance (postgres.do preference)
  json: { postgresType: 'JSONB' },

  // Binary
  binary: { postgresType: 'BYTEA' },

  // Decimal
  decimal: { postgresType: 'DECIMAL', precision: 38, scale: 9 },
};

// =============================================================================
// Adapter Options
// =============================================================================

/**
 * Options for the PostgreSQL adapter.
 */
export interface PostgresAdapterOptions extends PostgresTableOptions {
  /** Override the table name (defaults to schema name) */
  tableName?: string;
}
