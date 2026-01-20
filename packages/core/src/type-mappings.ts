/**
 * Centralized Type Mappings for IceType
 *
 * This module provides a single source of truth for type mappings
 * between IceType primitive types and various backend storage systems.
 *
 * Supported backends:
 * - Apache Iceberg (data lakehouse format)
 * - Apache Parquet (columnar storage)
 * - DuckDB (analytical database)
 * - ClickHouse (OLAP database)
 * - PostgreSQL (relational database)
 *
 * @packageDocumentation
 */

// =============================================================================
// Type Mapping Interface
// =============================================================================

/**
 * Represents a type mapping from IceType to various backend systems.
 *
 * Each IceType primitive type maps to equivalent types in each supported
 * backend system.
 *
 * @example
 * ```typescript
 * const stringMapping: TypeMapping = {
 *   iceberg: 'string',
 *   parquet: 'BYTE_ARRAY',
 *   duckdb: 'VARCHAR',
 *   clickhouse: 'String',
 *   postgres: 'TEXT',
 * };
 * ```
 */
export interface TypeMapping {
  /** Apache Iceberg type name */
  iceberg: string;
  /** Apache Parquet primitive type */
  parquet: string;
  /** DuckDB SQL type */
  duckdb: string;
  /** ClickHouse type */
  clickhouse: string;
  /** PostgreSQL type */
  postgres: string;
}

// =============================================================================
// Centralized Type Mappings
// =============================================================================

/**
 * Centralized type mapping table.
 *
 * Maps all IceType primitive types to their equivalents in each
 * supported backend system.
 *
 * Type categories:
 * - String types: string, text, varchar
 * - Integer types: int, long, bigint
 * - Floating point: float, double
 * - Boolean: bool, boolean
 * - Identifiers: uuid
 * - Date/Time: timestamp, timestamptz, date, time
 * - Complex: json, binary, decimal
 *
 * @example
 * ```typescript
 * // Get the DuckDB type for 'string'
 * const duckdbType = TYPE_MAPPINGS.string.duckdb; // 'VARCHAR'
 *
 * // Get the ClickHouse type for 'timestamp'
 * const chType = TYPE_MAPPINGS.timestamp.clickhouse; // 'DateTime64(3)'
 * ```
 */
export const TYPE_MAPPINGS: Record<string, TypeMapping> = {
  // ===========================================================================
  // String Types
  // ===========================================================================

  /** Standard string type - variable length text */
  string: {
    iceberg: 'string',
    parquet: 'BYTE_ARRAY',
    duckdb: 'VARCHAR',
    clickhouse: 'String',
    postgres: 'TEXT',
  },

  /** Text type - alias for string, typically for longer content */
  text: {
    iceberg: 'string',
    parquet: 'BYTE_ARRAY',
    duckdb: 'VARCHAR',
    clickhouse: 'String',
    postgres: 'TEXT',
  },

  /** VARCHAR type - variable length character string */
  varchar: {
    iceberg: 'string',
    parquet: 'BYTE_ARRAY',
    duckdb: 'VARCHAR',
    clickhouse: 'String',
    postgres: 'VARCHAR',
  },

  // ===========================================================================
  // Integer Types
  // ===========================================================================

  /** 32-bit signed integer */
  int: {
    iceberg: 'int',
    parquet: 'INT32',
    duckdb: 'INTEGER',
    clickhouse: 'Int32',
    postgres: 'INTEGER',
  },

  /** 64-bit signed integer */
  long: {
    iceberg: 'long',
    parquet: 'INT64',
    duckdb: 'BIGINT',
    clickhouse: 'Int64',
    postgres: 'BIGINT',
  },

  /** BigInt - alias for long (64-bit signed integer) */
  bigint: {
    iceberg: 'long',
    parquet: 'INT64',
    duckdb: 'BIGINT',
    clickhouse: 'Int64',
    postgres: 'BIGINT',
  },

  // ===========================================================================
  // Floating Point Types
  // ===========================================================================

  /** 32-bit IEEE 754 floating point */
  float: {
    iceberg: 'float',
    parquet: 'FLOAT',
    duckdb: 'REAL',
    clickhouse: 'Float32',
    postgres: 'REAL',
  },

  /** 64-bit IEEE 754 floating point */
  double: {
    iceberg: 'double',
    parquet: 'DOUBLE',
    duckdb: 'DOUBLE',
    clickhouse: 'Float64',
    postgres: 'DOUBLE PRECISION',
  },

  // ===========================================================================
  // Boolean Type
  // ===========================================================================

  /** Boolean type (short form) */
  bool: {
    iceberg: 'boolean',
    parquet: 'BOOLEAN',
    duckdb: 'BOOLEAN',
    clickhouse: 'Bool',
    postgres: 'BOOLEAN',
  },

  /** Boolean type (long form) - alias for bool */
  boolean: {
    iceberg: 'boolean',
    parquet: 'BOOLEAN',
    duckdb: 'BOOLEAN',
    clickhouse: 'Bool',
    postgres: 'BOOLEAN',
  },

  // ===========================================================================
  // Identifier Types
  // ===========================================================================

  /** UUID (Universally Unique Identifier) - 128-bit identifier */
  uuid: {
    iceberg: 'uuid',
    parquet: 'FIXED_LEN_BYTE_ARRAY',
    duckdb: 'UUID',
    clickhouse: 'UUID',
    postgres: 'UUID',
  },

  // ===========================================================================
  // Date/Time Types
  // ===========================================================================

  /** Timestamp without timezone - millisecond precision */
  timestamp: {
    iceberg: 'timestamp',
    parquet: 'INT64',
    duckdb: 'TIMESTAMP',
    clickhouse: 'DateTime64(3)',
    postgres: 'TIMESTAMP',
  },

  /** Timestamp with timezone - millisecond precision, UTC adjusted */
  timestamptz: {
    iceberg: 'timestamptz',
    parquet: 'INT64',
    duckdb: 'TIMESTAMPTZ',
    clickhouse: 'DateTime64(3)',
    postgres: 'TIMESTAMPTZ',
  },

  /** Calendar date (year, month, day) */
  date: {
    iceberg: 'date',
    parquet: 'INT32',
    duckdb: 'DATE',
    clickhouse: 'Date',
    postgres: 'DATE',
  },

  /** Time of day without timezone */
  time: {
    iceberg: 'time',
    parquet: 'INT32',
    duckdb: 'TIME',
    clickhouse: 'String', // ClickHouse doesn't have native Time type
    postgres: 'TIME',
  },

  // ===========================================================================
  // Complex Types
  // ===========================================================================

  /** JSON data - stored as string in Iceberg/Parquet */
  json: {
    iceberg: 'string', // Iceberg stores JSON as string
    parquet: 'BYTE_ARRAY',
    duckdb: 'JSON',
    clickhouse: 'JSON',
    postgres: 'JSONB',
  },

  /** Binary data - arbitrary bytes */
  binary: {
    iceberg: 'binary',
    parquet: 'BYTE_ARRAY',
    duckdb: 'BLOB',
    clickhouse: 'String', // Base64 encoded
    postgres: 'BYTEA',
  },

  /** Decimal - arbitrary precision decimal number */
  decimal: {
    iceberg: 'decimal',
    parquet: 'BYTE_ARRAY',
    duckdb: 'DECIMAL',
    clickhouse: 'Decimal(38, 9)',
    postgres: 'DECIMAL',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the Apache Iceberg type for an IceType primitive type.
 *
 * @param iceType - The IceType type string (e.g., 'string', 'int', 'uuid')
 * @returns The corresponding Iceberg type, or 'string' for unknown types
 *
 * @example
 * ```typescript
 * getIcebergType('int')       // 'int'
 * getIcebergType('boolean')   // 'boolean'
 * getIcebergType('unknown')   // 'string' (default)
 * ```
 */
export function getIcebergType(iceType: string): string {
  const normalized = iceType.toLowerCase();
  const mapping = TYPE_MAPPINGS[normalized];
  return mapping?.iceberg ?? 'string';
}

/**
 * Get the DuckDB SQL type for an IceType primitive type.
 *
 * @param iceType - The IceType type string (e.g., 'string', 'int', 'uuid')
 * @returns The corresponding DuckDB type, or 'VARCHAR' for unknown types
 *
 * @example
 * ```typescript
 * getDuckDBType('string')     // 'VARCHAR'
 * getDuckDBType('int')        // 'INTEGER'
 * getDuckDBType('uuid')       // 'UUID'
 * getDuckDBType('unknown')    // 'VARCHAR' (default)
 * ```
 */
export function getDuckDBType(iceType: string): string {
  const normalized = iceType.toLowerCase();
  const mapping = TYPE_MAPPINGS[normalized];
  return mapping?.duckdb ?? 'VARCHAR';
}

/**
 * Get the ClickHouse type for an IceType primitive type.
 *
 * @param iceType - The IceType type string (e.g., 'string', 'int', 'uuid')
 * @returns The corresponding ClickHouse type, or 'String' for unknown types
 *
 * @example
 * ```typescript
 * getClickHouseType('string')     // 'String'
 * getClickHouseType('int')        // 'Int32'
 * getClickHouseType('timestamp')  // 'DateTime64(3)'
 * getClickHouseType('unknown')    // 'String' (default)
 * ```
 */
export function getClickHouseType(iceType: string): string {
  const normalized = iceType.toLowerCase();
  const mapping = TYPE_MAPPINGS[normalized];
  return mapping?.clickhouse ?? 'String';
}

/**
 * Get the PostgreSQL type for an IceType primitive type.
 *
 * @param iceType - The IceType type string (e.g., 'string', 'int', 'uuid')
 * @returns The corresponding PostgreSQL type, or 'TEXT' for unknown types
 *
 * @example
 * ```typescript
 * getPostgresType('string')   // 'TEXT'
 * getPostgresType('int')      // 'INTEGER'
 * getPostgresType('json')     // 'JSONB'
 * getPostgresType('unknown')  // 'TEXT' (default)
 * ```
 */
export function getPostgresType(iceType: string): string {
  const normalized = iceType.toLowerCase();
  const mapping = TYPE_MAPPINGS[normalized];
  return mapping?.postgres ?? 'TEXT';
}

/**
 * Get the Apache Parquet type for an IceType primitive type.
 *
 * @param iceType - The IceType type string (e.g., 'string', 'int', 'uuid')
 * @returns The corresponding Parquet primitive type, or 'BYTE_ARRAY' for unknown types
 *
 * @example
 * ```typescript
 * getParquetType('string')    // 'BYTE_ARRAY'
 * getParquetType('int')       // 'INT32'
 * getParquetType('boolean')   // 'BOOLEAN'
 * getParquetType('unknown')   // 'BYTE_ARRAY' (default)
 * ```
 */
export function getParquetType(iceType: string): string {
  const normalized = iceType.toLowerCase();
  const mapping = TYPE_MAPPINGS[normalized];
  return mapping?.parquet ?? 'BYTE_ARRAY';
}

/**
 * Get the complete type mapping for an IceType primitive type.
 *
 * @param iceType - The IceType type string
 * @returns The TypeMapping object or undefined if not found
 *
 * @example
 * ```typescript
 * const mapping = getTypeMapping('uuid');
 * if (mapping) {
 *   console.log(mapping.postgres); // 'UUID'
 * }
 * ```
 */
export function getTypeMapping(iceType: string): TypeMapping | undefined {
  const normalized = iceType.toLowerCase();
  return TYPE_MAPPINGS[normalized];
}

/**
 * Check if an IceType is a known primitive type.
 *
 * @param iceType - The type string to check
 * @returns true if the type has a mapping, false otherwise
 *
 * @example
 * ```typescript
 * isKnownType('string')   // true
 * isKnownType('uuid')     // true
 * isKnownType('custom')   // false
 * ```
 */
export function isKnownType(iceType: string): boolean {
  const normalized = iceType.toLowerCase();
  return normalized in TYPE_MAPPINGS;
}

/**
 * Get all supported IceType primitive types.
 *
 * @returns Array of all supported type names
 *
 * @example
 * ```typescript
 * const types = getSupportedTypes();
 * // ['string', 'text', 'varchar', 'int', 'long', ...]
 * ```
 */
export function getSupportedTypes(): string[] {
  return Object.keys(TYPE_MAPPINGS);
}
