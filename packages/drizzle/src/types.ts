/**
 * Type Definitions for Drizzle Adapter
 *
 * Defines the interfaces and types for transforming IceType schemas
 * to Drizzle ORM schema files.
 *
 * @packageDocumentation
 */

// =============================================================================
// Dialect Types
// =============================================================================

/**
 * Supported Drizzle ORM dialects.
 */
export type DrizzleDialect = 'pg' | 'mysql' | 'sqlite';

// =============================================================================
// Column Types
// =============================================================================

/**
 * Represents a Drizzle column definition.
 */
export interface DrizzleColumn {
  /** Column name */
  name: string;
  /** Column type function (e.g., 'varchar', 'integer', 'uuid') */
  type: string;
  /** Type parameters (e.g., length for varchar) */
  typeParams?: Record<string, unknown>;
  /** Whether the column is nullable */
  nullable: boolean;
  /** Whether the column is a primary key */
  primaryKey: boolean;
  /** Whether the column has a unique constraint */
  unique: boolean;
  /** Default value expression (as code string) */
  defaultValue?: string;
  /** Whether this is an array column */
  isArray: boolean;
  /** Original IceType field name (for camelCase conversion) */
  originalName: string;
}

// =============================================================================
// Index Types
// =============================================================================

/**
 * Represents a Drizzle index definition.
 */
export interface DrizzleIndex {
  /** Index name */
  name: string;
  /** Column names in the index */
  columns: string[];
  /** Whether the index is unique */
  unique: boolean;
}

// =============================================================================
// Table Types
// =============================================================================

/**
 * Represents a complete Drizzle table definition.
 */
export interface DrizzleTable {
  /** Table name (snake_case) */
  tableName: string;
  /** Variable name for the table export (camelCase) */
  exportName: string;
  /** Column definitions */
  columns: DrizzleColumn[];
  /** Index definitions */
  indexes: DrizzleIndex[];
  /** Primary key column name(s) */
  primaryKey?: string[];
}

// =============================================================================
// Schema Output Types
// =============================================================================

/**
 * Output structure from the Drizzle adapter transform.
 */
export interface DrizzleSchema {
  /** The SQL dialect */
  dialect: DrizzleDialect;
  /** Table definitions */
  tables: DrizzleTable[];
  /** Required imports for the schema file */
  imports: DrizzleImport[];
}

/**
 * Represents an import statement for the Drizzle schema file.
 */
export interface DrizzleImport {
  /** Module path (e.g., 'drizzle-orm/pg-core') */
  from: string;
  /** Named imports */
  names: string[];
}

// =============================================================================
// Adapter Options
// =============================================================================

/**
 * Options for the Drizzle adapter.
 */
export interface DrizzleAdapterOptions {
  /**
   * SQL dialect to generate for.
   * @default 'pg'
   */
  dialect?: DrizzleDialect;

  /**
   * Whether to include system fields ($id, $type, $createdAt, $updatedAt).
   * @default false
   */
  includeSystemFields?: boolean;

  /**
   * Whether to use camelCase for column names in the generated code.
   * When true, column names like 'user_name' become 'userName' in the code,
   * but the actual database column remains 'user_name'.
   * @default true
   */
  camelCase?: boolean;

  /**
   * Custom table name (overrides schema name).
   */
  tableName?: string;

  /**
   * Database schema name (for PostgreSQL).
   */
  schema?: string;

  /**
   * Whether to add .notNull() by default for required fields.
   * @default true
   */
  enforceNotNull?: boolean;
}

// =============================================================================
// Type Mapping Types
// =============================================================================

/**
 * Type mapping for a specific IceType to Drizzle types.
 */
export interface DrizzleTypeMapping {
  /** PostgreSQL type function name */
  pg: string;
  /** MySQL type function name */
  mysql: string;
  /** SQLite type function name */
  sqlite: string;
  /** Type parameters template (optional) */
  params?: Record<string, unknown>;
}

/**
 * Collection of type mappings from IceType to Drizzle.
 */
export type DrizzleTypeMappings = Record<string, DrizzleTypeMapping>;
