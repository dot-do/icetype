/**
 * Unified Type Mappings for IceType
 *
 * This module consolidates all type mappings into a single source of truth
 * for mapping IceType primitive types to various SQL dialects and storage formats.
 *
 * Supported dialects:
 * - PostgreSQL
 * - MySQL
 * - SQLite
 * - ClickHouse
 * - DuckDB
 * - Apache Iceberg
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Supported SQL dialects for type mapping.
 */
export type Dialect = 'postgres' | 'mysql' | 'sqlite' | 'clickhouse' | 'duckdb' | 'iceberg';

/**
 * Unified type mapping interface.
 * Contains the IceType and mappings for all supported dialects.
 */
export interface UnifiedTypeMapping {
  /** The IceType primitive name */
  iceType: string;
  /** PostgreSQL type */
  postgres: string;
  /** MySQL type */
  mysql: string;
  /** SQLite type (storage class) */
  sqlite: string;
  /** ClickHouse type */
  clickhouse: string;
  /** DuckDB type */
  duckdb: string;
  /** Apache Iceberg type */
  iceberg: string;
}

/**
 * Error thrown when an unknown IceType is encountered.
 */
export class UnknownTypeError extends Error {
  constructor(iceType: string) {
    super(`Unknown IceType: '${iceType}'. Valid types are: ${Object.keys(UNIFIED_TYPE_MAPPINGS).join(', ')}`);
    this.name = 'UnknownTypeError';
  }
}

/**
 * Error thrown when an invalid dialect is specified.
 */
export class InvalidDialectError extends Error {
  constructor(dialect: string) {
    super(`Invalid dialect: '${dialect}'. Valid dialects are: ${ALL_DIALECTS.join(', ')}`);
    this.name = 'InvalidDialectError';
  }
}

// =============================================================================
// Constants
// =============================================================================

/**
 * All supported SQL dialects.
 */
const ALL_DIALECTS: Dialect[] = [
  'postgres',
  'mysql',
  'sqlite',
  'clickhouse',
  'duckdb',
  'iceberg',
];

/**
 * Dialects that support native array types.
 */
const ARRAY_SUPPORTING_DIALECTS: Dialect[] = ['postgres', 'clickhouse', 'duckdb'];

// =============================================================================
// Unified Type Mapping Table
// =============================================================================

/**
 * Centralized type mapping table for all IceType primitives to all dialects.
 *
 * This is the single source of truth for type mappings.
 */
const UNIFIED_TYPE_MAPPINGS: Record<string, Record<Dialect, string>> = {
  // ===========================================================================
  // String Types
  // ===========================================================================

  string: {
    postgres: 'TEXT',
    mysql: 'VARCHAR(255)',
    sqlite: 'TEXT',
    clickhouse: 'String',
    duckdb: 'VARCHAR',
    iceberg: 'string',
  },

  text: {
    postgres: 'TEXT',
    mysql: 'TEXT',
    sqlite: 'TEXT',
    clickhouse: 'String',
    duckdb: 'VARCHAR',
    iceberg: 'string',
  },

  varchar: {
    postgres: 'VARCHAR',
    mysql: 'VARCHAR(255)',
    sqlite: 'TEXT',
    clickhouse: 'String',
    duckdb: 'VARCHAR',
    iceberg: 'string',
  },

  char: {
    postgres: 'CHAR',
    mysql: 'CHAR(255)',
    sqlite: 'TEXT',
    clickhouse: 'String',
    duckdb: 'VARCHAR',
    iceberg: 'string',
  },

  // ===========================================================================
  // Integer Types
  // ===========================================================================

  int: {
    postgres: 'INTEGER',
    mysql: 'INT',
    sqlite: 'INTEGER',
    clickhouse: 'Int32',
    duckdb: 'INTEGER',
    iceberg: 'int',
  },

  long: {
    postgres: 'BIGINT',
    mysql: 'BIGINT',
    sqlite: 'INTEGER',
    clickhouse: 'Int64',
    duckdb: 'BIGINT',
    iceberg: 'long',
  },

  bigint: {
    postgres: 'BIGINT',
    mysql: 'BIGINT',
    sqlite: 'INTEGER',
    clickhouse: 'Int64',
    duckdb: 'BIGINT',
    iceberg: 'long',
  },

  // ===========================================================================
  // Floating Point Types
  // ===========================================================================

  float: {
    postgres: 'REAL',
    mysql: 'FLOAT',
    sqlite: 'REAL',
    clickhouse: 'Float32',
    duckdb: 'REAL',
    iceberg: 'float',
  },

  double: {
    postgres: 'DOUBLE PRECISION',
    mysql: 'DOUBLE',
    sqlite: 'REAL',
    clickhouse: 'Float64',
    duckdb: 'DOUBLE',
    iceberg: 'double',
  },

  // ===========================================================================
  // Boolean Type
  // ===========================================================================

  bool: {
    postgres: 'BOOLEAN',
    mysql: 'TINYINT(1)',
    sqlite: 'INTEGER',
    clickhouse: 'Bool',
    duckdb: 'BOOLEAN',
    iceberg: 'boolean',
  },

  boolean: {
    postgres: 'BOOLEAN',
    mysql: 'TINYINT(1)',
    sqlite: 'INTEGER',
    clickhouse: 'Bool',
    duckdb: 'BOOLEAN',
    iceberg: 'boolean',
  },

  // ===========================================================================
  // Identifier Types
  // ===========================================================================

  uuid: {
    postgres: 'UUID',
    mysql: 'CHAR(36)',
    sqlite: 'TEXT',
    clickhouse: 'UUID',
    duckdb: 'UUID',
    iceberg: 'uuid',
  },

  // ===========================================================================
  // Date/Time Types
  // ===========================================================================

  timestamp: {
    postgres: 'TIMESTAMP',
    mysql: 'DATETIME',
    sqlite: 'TEXT',
    clickhouse: 'DateTime64(3)',
    duckdb: 'TIMESTAMP',
    iceberg: 'timestamp',
  },

  timestamptz: {
    postgres: 'TIMESTAMPTZ',
    mysql: 'DATETIME',
    sqlite: 'TEXT',
    clickhouse: 'DateTime64(3)',
    duckdb: 'TIMESTAMPTZ',
    iceberg: 'timestamptz',
  },

  date: {
    postgres: 'DATE',
    mysql: 'DATE',
    sqlite: 'TEXT',
    clickhouse: 'Date',
    duckdb: 'DATE',
    iceberg: 'date',
  },

  time: {
    postgres: 'TIME',
    mysql: 'TIME',
    sqlite: 'TEXT',
    clickhouse: 'String', // ClickHouse has no native TIME type
    duckdb: 'TIME',
    iceberg: 'time',
  },

  // ===========================================================================
  // Complex Types
  // ===========================================================================

  json: {
    postgres: 'JSONB',
    mysql: 'JSON',
    sqlite: 'TEXT',
    clickhouse: 'JSON',
    duckdb: 'JSON',
    iceberg: 'string', // Iceberg stores JSON as string
  },

  binary: {
    postgres: 'BYTEA',
    mysql: 'BLOB',
    sqlite: 'BLOB',
    clickhouse: 'String', // Base64 encoded
    duckdb: 'BLOB',
    iceberg: 'binary',
  },

  decimal: {
    postgres: 'DECIMAL',
    mysql: 'DECIMAL(38, 9)',
    sqlite: 'REAL',
    clickhouse: 'Decimal(38, 9)',
    duckdb: 'DECIMAL',
    iceberg: 'decimal',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if the given string is a valid dialect.
 */
function isValidDialect(dialect: string): dialect is Dialect {
  return ALL_DIALECTS.includes(dialect as Dialect);
}

/**
 * Parse a parametric type string to extract base type and parameters.
 *
 * @example
 * parseParametricType('decimal(10, 2)') => { baseType: 'decimal', params: [10, 2] }
 * parseParametricType('varchar(100)') => { baseType: 'varchar', params: [100] }
 * parseParametricType('string') => { baseType: 'string', params: [] }
 */
function parseParametricType(iceType: string): { baseType: string; params: number[] } {
  const match = iceType.match(/^(\w+)\s*\(\s*(.+?)\s*\)$/);
  if (!match) {
    return { baseType: iceType, params: [] };
  }

  const baseType = match[1]!;
  const paramsStr = match[2]!;
  const params = paramsStr.split(/\s*,\s*/).map(p => parseInt(p.trim(), 10));

  return { baseType: baseType, params };
}

/**
 * Parse an array type string to extract the element type.
 *
 * @example
 * parseArrayType('string[]') => { isArray: true, elementType: 'string' }
 * parseArrayType('int') => { isArray: false, elementType: 'int' }
 */
function parseArrayType(iceType: string): { isArray: boolean; elementType: string } {
  if (iceType.endsWith('[]')) {
    return { isArray: true, elementType: iceType.slice(0, -2) };
  }
  return { isArray: false, elementType: iceType };
}

/**
 * Format a parametric type for a specific dialect.
 */
function formatParametricType(
  baseType: string,
  params: number[],
  dialect: Dialect
): string {
  const baseMapping = UNIFIED_TYPE_MAPPINGS[baseType]?.[dialect];
  if (!baseMapping) {
    throw new UnknownTypeError(baseType);
  }

  // Handle decimal with precision and scale
  if (baseType === 'decimal' && params.length >= 1) {
    const precision = params[0];
    const scale = params[1] ?? 0;

    switch (dialect) {
      case 'sqlite':
        // SQLite doesn't support decimal, always use REAL
        return 'REAL';
      case 'iceberg':
        // Iceberg preserves the full parametric type
        return `decimal(${precision}, ${scale})`;
      case 'clickhouse':
        return `Decimal(${precision}, ${scale})`;
      case 'postgres':
      case 'mysql':
      case 'duckdb':
        return `DECIMAL(${precision}, ${scale})`;
    }
  }

  // Handle varchar with length
  if ((baseType === 'varchar' || baseType === 'char') && params.length >= 1) {
    const length = params[0];

    switch (dialect) {
      case 'sqlite':
        // SQLite ignores length for TEXT affinity
        return 'TEXT';
      case 'clickhouse':
        // ClickHouse uses String for all character types
        return 'String';
      case 'iceberg':
        // Iceberg uses string for all character types
        return 'string';
      case 'postgres':
        return `${baseType.toUpperCase()}(${length})`;
      case 'mysql':
        return `${baseType.toUpperCase()}(${length})`;
      case 'duckdb':
        return `VARCHAR(${length})`;
    }
  }

  return baseMapping;
}

/**
 * Format an array type for a specific dialect.
 */
function formatArrayType(elementType: string, dialect: Dialect): string {
  // Get the base type mapping for the element
  const elementMapping = getUnifiedTypeMapping(elementType, dialect);

  switch (dialect) {
    case 'postgres':
      return `${elementMapping}[]`;
    case 'clickhouse':
      return `Array(${elementMapping})`;
    case 'duckdb':
      return `${elementMapping}[]`;
    case 'mysql':
    case 'sqlite':
    case 'iceberg':
      throw new Error(
        `Array types are not supported in ${dialect}. Cannot map '${elementType}[]' to ${dialect}.`
      );
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the unified type mapping for an IceType to a specific dialect.
 *
 * @param iceType - The IceType type string (e.g., 'string', 'int', 'decimal(10, 2)')
 * @param dialect - The target SQL dialect
 * @returns The corresponding type for the dialect
 * @throws UnknownTypeError if the IceType is not recognized
 * @throws InvalidDialectError if the dialect is not supported
 * @throws Error if array types are used with unsupported dialects
 *
 * @example
 * ```typescript
 * getUnifiedTypeMapping('uuid', 'postgres')       // 'UUID'
 * getUnifiedTypeMapping('uuid', 'mysql')          // 'CHAR(36)'
 * getUnifiedTypeMapping('decimal(10, 2)', 'postgres') // 'DECIMAL(10, 2)'
 * getUnifiedTypeMapping('string[]', 'postgres')   // 'TEXT[]'
 * ```
 */
export function getUnifiedTypeMapping(iceType: string, dialect: Dialect): string {
  // Validate dialect
  if (!isValidDialect(dialect)) {
    throw new InvalidDialectError(dialect);
  }

  // Trim and normalize the input
  const trimmed = iceType.trim();
  if (trimmed === '') {
    throw new UnknownTypeError('');
  }

  // Check for array types first
  const { isArray, elementType } = parseArrayType(trimmed);
  if (isArray) {
    if (!ARRAY_SUPPORTING_DIALECTS.includes(dialect)) {
      throw new Error(
        `Array types are not supported in ${dialect}. Cannot map '${trimmed}' to ${dialect}.`
      );
    }
    return formatArrayType(elementType, dialect);
  }

  // Parse parametric types
  const { baseType, params } = parseParametricType(trimmed);
  const normalizedBase = baseType.toLowerCase();

  // Check if base type exists
  if (!(normalizedBase in UNIFIED_TYPE_MAPPINGS)) {
    throw new UnknownTypeError(trimmed);
  }

  // Handle parametric types
  if (params.length > 0) {
    return formatParametricType(normalizedBase, params, dialect);
  }

  // Return the standard mapping
  const mapping = UNIFIED_TYPE_MAPPINGS[normalizedBase];
  // mapping is guaranteed to exist at this point due to the check above
  return mapping![dialect];
}

/**
 * Get all supported SQL dialects.
 *
 * @returns Array of all supported dialect names
 *
 * @example
 * ```typescript
 * const dialects = getAllDialects();
 * // ['postgres', 'mysql', 'sqlite', 'clickhouse', 'duckdb', 'iceberg']
 * ```
 */
export function getAllDialects(): Dialect[] {
  return [...ALL_DIALECTS];
}

/**
 * Get all type mappings for a specific dialect.
 *
 * @param dialect - The target SQL dialect
 * @returns Record mapping IceType names to dialect-specific types
 * @throws InvalidDialectError if the dialect is not supported
 *
 * @example
 * ```typescript
 * const postgresMappings = getDialectMappings('postgres');
 * console.log(postgresMappings['string']); // 'TEXT'
 * console.log(postgresMappings['json']);   // 'JSONB'
 * ```
 */
export function getDialectMappings(dialect: Dialect): Record<string, string> {
  if (!isValidDialect(dialect)) {
    throw new InvalidDialectError(dialect);
  }

  const result: Record<string, string> = {};
  for (const [iceType, mappings] of Object.entries(UNIFIED_TYPE_MAPPINGS)) {
    result[iceType] = mappings[dialect];
  }
  return result;
}

/**
 * Get the complete unified type mapping for an IceType.
 *
 * @param iceType - The IceType type string
 * @returns The UnifiedTypeMapping object with all dialect mappings
 * @throws UnknownTypeError if the IceType is not recognized
 *
 * @example
 * ```typescript
 * const mapping = getUnifiedMapping('uuid');
 * // {
 * //   iceType: 'uuid',
 * //   postgres: 'UUID',
 * //   mysql: 'CHAR(36)',
 * //   sqlite: 'TEXT',
 * //   ...
 * // }
 * ```
 */
export function getUnifiedMapping(iceType: string): UnifiedTypeMapping {
  const normalized = iceType.trim().toLowerCase();
  const mappings = UNIFIED_TYPE_MAPPINGS[normalized];

  if (!mappings) {
    throw new UnknownTypeError(iceType);
  }

  return {
    iceType: normalized,
    ...mappings,
  };
}

/**
 * Check if an IceType is a known primitive type.
 *
 * @param iceType - The type string to check
 * @returns true if the type is recognized, false otherwise
 *
 * @example
 * ```typescript
 * isKnownUnifiedType('string')  // true
 * isKnownUnifiedType('custom')  // false
 * ```
 */
export function isKnownUnifiedType(iceType: string): boolean {
  const { baseType } = parseParametricType(iceType.trim());
  const { elementType } = parseArrayType(baseType);
  return elementType.toLowerCase() in UNIFIED_TYPE_MAPPINGS;
}

/**
 * Get all supported IceType primitive types.
 *
 * @returns Array of all supported type names
 *
 * @example
 * ```typescript
 * const types = getSupportedUnifiedTypes();
 * // ['string', 'text', 'varchar', 'int', 'long', ...]
 * ```
 */
export function getSupportedUnifiedTypes(): string[] {
  return Object.keys(UNIFIED_TYPE_MAPPINGS);
}
