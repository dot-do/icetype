/**
 * SQL Identifier and Schema Name Validation
 *
 * This module contains validation functions for SQL identifiers and schema names
 * to prevent SQL injection and ensure compliance with database constraints.
 *
 * @packageDocumentation
 */

import type { SqlDialect } from './types.js';
import { isReservedKeyword, needsQuoting } from './escape.js';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when a schema name is invalid.
 */
export class InvalidSchemaNameError extends Error {
  constructor(name: string) {
    super(`Invalid schema name: "${name}". Schema names must contain only alphanumeric characters, underscores, and dots (for qualified names), and must start with a letter or underscore.`);
    this.name = 'InvalidSchemaNameError';
  }
}

/**
 * Error thrown when an identifier is invalid (e.g., empty, whitespace-only, contains control characters).
 */
export class InvalidIdentifierError extends Error {
  constructor(identifier: string, reason: string) {
    super(`Invalid identifier: "${identifier.slice(0, 20)}${identifier.length > 20 ? '...' : ''}". ${reason}`);
    this.name = 'InvalidIdentifierError';
  }
}

/**
 * Error thrown when an identifier exceeds the maximum length for a dialect.
 */
export class IdentifierTooLongError extends Error {
  constructor(identifier: string, dialect: SqlDialect, maxLength: number, actualLength: number, unit: 'bytes' | 'characters') {
    super(`Identifier too long for ${dialect}: "${identifier.slice(0, 20)}${identifier.length > 20 ? '...' : ''}". Maximum is ${maxLength} ${unit}, got ${actualLength}.`);
    this.name = 'IdentifierTooLongError';
  }
}

// =============================================================================
// Schema Name Validation
// =============================================================================

/**
 * Validate a SQL schema name to prevent SQL injection.
 *
 * Schema names must:
 * - Be non-empty
 * - Contain only alphanumeric characters, underscores, and optionally dots (for qualified names like "catalog.schema")
 * - Start with a letter or underscore (not a number or dot)
 * - Each segment (split by dots) must start with a letter or underscore
 *
 * This validation is intentionally strict to prevent any SQL injection vectors.
 *
 * @param name - The schema name to validate
 * @throws InvalidSchemaNameError if the name contains dangerous characters
 */
export function validateSchemaName(name: string): void {
  if (!name || name.length === 0) {
    throw new InvalidSchemaNameError(name);
  }

  // Check for common SQL injection patterns first
  if (name.includes(';') || name.includes('--') || name.includes('/*') || name.includes("'") || name.includes('"')) {
    throw new InvalidSchemaNameError(name);
  }

  // Split by dots to handle qualified names like "catalog.schema"
  const segments = name.split('.');

  for (const segment of segments) {
    // Each segment must be non-empty
    if (!segment || segment.length === 0) {
      throw new InvalidSchemaNameError(name);
    }

    // Each segment must match: starts with letter or underscore, followed by alphanumeric or underscore
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)) {
      throw new InvalidSchemaNameError(name);
    }
  }
}

// =============================================================================
// Identifier Validation
// =============================================================================

/**
 * Maximum identifier lengths by dialect.
 * - PostgreSQL: 63 bytes (NAMEDATALEN - 1)
 * - MySQL: 64 characters
 * - SQLite: No documented limit (we use 1000 as a practical limit)
 * - ClickHouse: No documented limit (we use 1000 as a practical limit)
 * - DuckDB: No documented limit (we use 1000 as a practical limit)
 */
const MAX_IDENTIFIER_LENGTH: Record<SqlDialect, { max: number; unit: 'bytes' | 'characters' }> = {
  postgres: { max: 63, unit: 'bytes' },
  mysql: { max: 64, unit: 'characters' },
  sqlite: { max: 1000, unit: 'characters' },
  clickhouse: { max: 1000, unit: 'characters' },
  duckdb: { max: 1000, unit: 'characters' },
};

/**
 * Dangerous control characters that should be rejected in identifiers.
 * Includes:
 * - NULL byte (0x00)
 * - Control characters (0x01-0x1F, 0x7F)
 * - Bidirectional text override characters (security risk)
 */
// eslint-disable-next-line no-control-regex
const DANGEROUS_CHAR_PATTERN = /[\x00-\x1F\x7F\u202A-\u202E\u2066-\u2069]/;

/**
 * Result of identifier validation.
 */
export interface IdentifierValidationResult {
  /** Whether the identifier is valid */
  valid: boolean;
  /** The identifier that was validated */
  identifier: string;
  /** The dialect used for validation */
  dialect: SqlDialect;
  /** Whether the identifier needs quoting */
  needsQuoting: boolean;
  /** Whether the identifier is a reserved keyword */
  isReservedKeyword: boolean;
  /** Byte length of the identifier (UTF-8) */
  byteLength: number;
  /** Character length of the identifier */
  charLength: number;
}

/**
 * Validate an identifier for the given SQL dialect.
 *
 * Validates:
 * - Not empty or whitespace-only
 * - Does not exceed maximum length for the dialect
 * - Does not contain dangerous control characters
 * - Does not contain bidirectional override characters (security risk)
 *
 * @param identifier - The identifier to validate
 * @param dialect - The SQL dialect to validate against
 * @returns Validation result with details
 * @throws InvalidIdentifierError if the identifier is empty, whitespace-only, or contains dangerous characters
 * @throws IdentifierTooLongError if the identifier exceeds the maximum length for the dialect
 */
export function validateIdentifier(identifier: string, dialect: SqlDialect): IdentifierValidationResult {
  // Check for empty identifier
  if (!identifier || identifier.length === 0) {
    throw new InvalidIdentifierError(identifier, 'Identifier cannot be empty.');
  }

  // Check for whitespace-only identifier
  if (identifier.trim() === '') {
    throw new InvalidIdentifierError(identifier, 'Identifier cannot be whitespace-only.');
  }

  // Check for dangerous control characters (including null bytes and bidi overrides)
  if (DANGEROUS_CHAR_PATTERN.test(identifier)) {
    throw new InvalidIdentifierError(identifier, 'Identifier contains dangerous control characters.');
  }

  // Calculate lengths
  // Use Buffer.byteLength for UTF-8 byte count
  const byteLength = Buffer.byteLength(identifier, 'utf8');
  // Use spread operator to properly count Unicode code points (not UTF-16 code units)
  const charLength = [...identifier].length;

  // Check length limits by dialect
  const lengthConfig = MAX_IDENTIFIER_LENGTH[dialect];
  const actualLength = lengthConfig.unit === 'bytes' ? byteLength : charLength;

  if (actualLength > lengthConfig.max) {
    throw new IdentifierTooLongError(identifier, dialect, lengthConfig.max, actualLength, lengthConfig.unit);
  }

  // Determine if it needs quoting and if it's a keyword
  const isKeyword = isReservedKeyword(identifier);
  const requiresQuoting = needsQuoting(identifier);

  return {
    valid: true,
    identifier,
    dialect,
    needsQuoting: requiresQuoting,
    isReservedKeyword: isKeyword,
    byteLength,
    charLength,
  };
}
