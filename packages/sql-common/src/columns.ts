/**
 * SQL Column Utilities
 *
 * This module contains column-related utilities that are shared across
 * sql-common modules to avoid circular dependencies.
 *
 * @packageDocumentation
 */

import type { SqlDialect, SqlColumn } from './types.js';
import { escapeIdentifier } from './escape.js';

/**
 * Serialize a column definition to a DDL fragment.
 *
 * Generates a column definition string like:
 * "column_name TYPE NOT NULL UNIQUE DEFAULT value"
 *
 * @param column - The column definition
 * @param dialect - The SQL dialect to use
 * @returns The DDL column fragment
 */
export function serializeColumn(column: SqlColumn, dialect: SqlDialect): string {
  const parts: string[] = [
    escapeIdentifier(column.name, dialect),
    column.type,
  ];

  if (!column.nullable) {
    parts.push('NOT NULL');
  }

  if (column.unique) {
    parts.push('UNIQUE');
  }

  if (column.default !== undefined) {
    parts.push(`DEFAULT ${column.default}`);
  }

  return parts.join(' ');
}

/**
 * Format a default value as a SQL expression.
 *
 * Handles the following value types:
 * - null: Returns 'NULL'
 * - string: Escapes single quotes and wraps in single quotes
 * - number: Returns the number as a string
 * - boolean: Returns 'TRUE'/'FALSE' (or '1'/'0' for SQLite)
 * - Date: Returns ISO string for TIMESTAMP, date-only for DATE types
 * - Array/Object: JSON serializes and wraps in single quotes
 *
 * @param value - The default value
 * @param type - The SQL type (used for Date formatting)
 * @param dialect - Optional SQL dialect (defaults to 'postgres' behavior)
 * @returns The SQL expression string
 */
export function formatDefaultValue(value: unknown, type: string, dialect?: SqlDialect): string {
  if (value === null) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    // Escape single quotes
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    // SQLite uses 0/1 for booleans
    if (dialect === 'sqlite') {
      return value ? '1' : '0';
    }
    return value ? 'TRUE' : 'FALSE';
  }

  if (value instanceof Date) {
    // For DATE types (not TIMESTAMP), return only the date portion
    if (type.toUpperCase().includes('DATE') && !type.toUpperCase().includes('TIMESTAMP')) {
      return `'${value.toISOString().split('T')[0]}'`;
    }
    return `'${value.toISOString()}'`;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    // JSON serialize for complex types
    const escaped = JSON.stringify(value).replace(/'/g, "''");
    return `'${escaped}'`;
  }

  return String(value);
}
