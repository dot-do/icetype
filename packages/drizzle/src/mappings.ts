/**
 * Type Mappings for Drizzle ORM
 *
 * Maps IceType primitive types to Drizzle ORM type functions
 * for PostgreSQL, MySQL, and SQLite.
 *
 * @packageDocumentation
 */

import { assertNever } from '@icetype/core';
import type { DrizzleTypeMappings, DrizzleDialect } from './types.js';

// =============================================================================
// Drizzle Type Mappings
// =============================================================================

/**
 * Centralized type mappings from IceType to Drizzle ORM types.
 *
 * Each IceType maps to the appropriate Drizzle type function for each dialect.
 */
export const DRIZZLE_TYPE_MAPPINGS: DrizzleTypeMappings = {
  // ===========================================================================
  // String Types
  // ===========================================================================

  /** Standard string type - uses varchar with length or text */
  string: {
    pg: 'varchar',
    mysql: 'varchar',
    sqlite: 'text',
  },

  /** Text type - unlimited length text */
  text: {
    pg: 'text',
    mysql: 'text',
    sqlite: 'text',
  },

  /** VARCHAR type - variable length with explicit length */
  varchar: {
    pg: 'varchar',
    mysql: 'varchar',
    sqlite: 'text',
  },

  /** CHAR type - fixed length */
  char: {
    pg: 'char',
    mysql: 'char',
    sqlite: 'text',
  },

  // ===========================================================================
  // Integer Types
  // ===========================================================================

  /** 32-bit signed integer */
  int: {
    pg: 'integer',
    mysql: 'int',
    sqlite: 'integer',
  },

  /** 64-bit signed integer */
  long: {
    pg: 'bigint',
    mysql: 'bigint',
    sqlite: 'integer',
  },

  /** BigInt - alias for long */
  bigint: {
    pg: 'bigint',
    mysql: 'bigint',
    sqlite: 'integer',
  },

  /** Small integer (16-bit) */
  smallint: {
    pg: 'smallint',
    mysql: 'smallint',
    sqlite: 'integer',
  },

  // ===========================================================================
  // Floating Point Types
  // ===========================================================================

  /** 32-bit IEEE 754 floating point */
  float: {
    pg: 'real',
    mysql: 'float',
    sqlite: 'real',
  },

  /** 64-bit IEEE 754 floating point */
  double: {
    pg: 'doublePrecision',
    mysql: 'double',
    sqlite: 'real',
  },

  /** Decimal - arbitrary precision */
  decimal: {
    pg: 'decimal',
    mysql: 'decimal',
    sqlite: 'real',
  },

  /** Numeric - alias for decimal */
  numeric: {
    pg: 'numeric',
    mysql: 'decimal',
    sqlite: 'real',
  },

  // ===========================================================================
  // Boolean Type
  // ===========================================================================

  /** Boolean type (short form) */
  bool: {
    pg: 'boolean',
    mysql: 'boolean',
    sqlite: 'integer',
  },

  /** Boolean type (long form) */
  boolean: {
    pg: 'boolean',
    mysql: 'boolean',
    sqlite: 'integer',
  },

  // ===========================================================================
  // Identifier Types
  // ===========================================================================

  /** UUID - 128-bit identifier */
  uuid: {
    pg: 'uuid',
    mysql: 'varchar',
    sqlite: 'text',
  },

  /** Serial - auto-incrementing integer */
  serial: {
    pg: 'serial',
    mysql: 'serial',
    sqlite: 'integer',
  },

  /** Big serial - auto-incrementing bigint */
  bigserial: {
    pg: 'bigserial',
    mysql: 'bigint',
    sqlite: 'integer',
  },

  // ===========================================================================
  // Date/Time Types
  // ===========================================================================

  /** Timestamp without timezone */
  timestamp: {
    pg: 'timestamp',
    mysql: 'timestamp',
    sqlite: 'text',
  },

  /** Timestamp with timezone */
  timestamptz: {
    pg: 'timestamp',
    mysql: 'timestamp',
    sqlite: 'text',
  },

  /** Calendar date */
  date: {
    pg: 'date',
    mysql: 'date',
    sqlite: 'text',
  },

  /** Time of day */
  time: {
    pg: 'time',
    mysql: 'time',
    sqlite: 'text',
  },

  /** Interval (duration) */
  interval: {
    pg: 'interval',
    mysql: 'varchar',
    sqlite: 'text',
  },

  // ===========================================================================
  // Complex Types
  // ===========================================================================

  /** JSON data */
  json: {
    pg: 'json',
    mysql: 'json',
    sqlite: 'text',
  },

  /** JSONB (PostgreSQL binary JSON) */
  jsonb: {
    pg: 'jsonb',
    mysql: 'json',
    sqlite: 'text',
  },

  /** Binary data */
  binary: {
    pg: 'bytea',
    mysql: 'blob',
    sqlite: 'blob',
  },

  /** Bytea - PostgreSQL binary */
  bytea: {
    pg: 'bytea',
    mysql: 'blob',
    sqlite: 'blob',
  },

  /** Blob - binary large object */
  blob: {
    pg: 'bytea',
    mysql: 'blob',
    sqlite: 'blob',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the Drizzle type function name for an IceType.
 *
 * @param iceType - The IceType type string
 * @param dialect - The target dialect
 * @returns The Drizzle type function name
 */
export function getDrizzleType(iceType: string, dialect: DrizzleDialect): string {
  const normalized = iceType.toLowerCase();
  const mapping = DRIZZLE_TYPE_MAPPINGS[normalized];

  if (!mapping) {
    // Default to text for unknown types
    return dialect === 'pg' ? 'text' : dialect === 'mysql' ? 'text' : 'text';
  }

  return mapping[dialect];
}

/**
 * Get the import path for a Drizzle dialect.
 *
 * @param dialect - The target dialect
 * @returns The import path for Drizzle ORM
 */
export function getDrizzleImportPath(dialect: DrizzleDialect): string {
  switch (dialect) {
    case 'pg':
      return 'drizzle-orm/pg-core';
    case 'mysql':
      return 'drizzle-orm/mysql-core';
    case 'sqlite':
      return 'drizzle-orm/sqlite-core';
    default:
      return assertNever(dialect);
  }
}

/**
 * Get the table function name for a dialect.
 *
 * @param dialect - The target dialect
 * @returns The table function name
 */
export function getTableFunction(dialect: DrizzleDialect): string {
  switch (dialect) {
    case 'pg':
      return 'pgTable';
    case 'mysql':
      return 'mysqlTable';
    case 'sqlite':
      return 'sqliteTable';
    default:
      return assertNever(dialect);
  }
}

/**
 * Check if a type is a known IceType.
 *
 * @param iceType - The type string to check
 * @returns true if the type is known
 */
export function isKnownDrizzleType(iceType: string): boolean {
  return iceType.toLowerCase() in DRIZZLE_TYPE_MAPPINGS;
}

/**
 * Get all unique type functions needed for a dialect.
 *
 * @param types - Array of IceType type strings
 * @param dialect - The target dialect
 * @returns Array of unique Drizzle type function names
 */
export function getRequiredTypeImports(
  types: string[],
  dialect: DrizzleDialect
): string[] {
  const typeSet = new Set<string>();

  for (const type of types) {
    const drizzleType = getDrizzleType(type, dialect);
    typeSet.add(drizzleType);
  }

  return Array.from(typeSet).sort();
}
