/**
 * System Columns for @icetype/core
 *
 * This module defines the system columns that IceType adds to every table.
 * These columns are used for internal tracking and should not be modified
 * directly by user code.
 *
 * System columns:
 * - $id: Primary key identifier (uuid)
 * - $type: Entity type name (string)
 * - $version: Row version for optimistic locking (int)
 * - $createdAt: Creation timestamp as epoch ms (bigint)
 * - $updatedAt: Last update timestamp as epoch ms (bigint)
 *
 * This module is the single source of truth for system column definitions,
 * replacing hardcoded values across adapters.
 *
 * @packageDocumentation
 */

/**
 * The IceType primitive types used for system columns.
 */
export type SystemColumnType = 'uuid' | 'string' | 'int' | 'bigint';

/**
 * Definition for a system column.
 */
export interface SystemColumnDefinition {
  /** The column name (including $ prefix) */
  readonly name: SystemColumnName;
  /** The IceType primitive type */
  readonly type: SystemColumnType;
  /** Whether the column can be null */
  readonly nullable: boolean;
  /** Whether this is a primary key column */
  readonly primaryKey?: boolean;
  /** Default value for the column */
  readonly defaultValue?: number;
}

/**
 * The names of all system columns.
 */
export type SystemColumnName = '$id' | '$type' | '$version' | '$createdAt' | '$updatedAt';

/**
 * The system columns object type.
 */
export type SystemColumnsMap = {
  readonly [K in SystemColumnName]: SystemColumnDefinition & { readonly name: K };
};

/**
 * System columns that IceType adds to every table.
 *
 * These columns are read-only and frozen to prevent accidental modification.
 *
 * @example
 * ```typescript
 * import { SYSTEM_COLUMNS } from '@icetype/core';
 *
 * // Access a specific column definition
 * const idColumn = SYSTEM_COLUMNS.$id;
 * console.log(idColumn.type); // 'uuid'
 *
 * // Check if a column is a primary key
 * if (SYSTEM_COLUMNS.$id.primaryKey) {
 *   console.log('$id is the primary key');
 * }
 * ```
 */
export const SYSTEM_COLUMNS: SystemColumnsMap = Object.freeze({
  $id: Object.freeze({
    name: '$id' as const,
    type: 'uuid' as const,
    nullable: false,
    primaryKey: true,
  }),
  $type: Object.freeze({
    name: '$type' as const,
    type: 'string' as const,
    nullable: false,
  }),
  $version: Object.freeze({
    name: '$version' as const,
    type: 'int' as const,
    nullable: false,
    defaultValue: 1,
  }),
  $createdAt: Object.freeze({
    name: '$createdAt' as const,
    type: 'bigint' as const,
    nullable: false,
  }),
  $updatedAt: Object.freeze({
    name: '$updatedAt' as const,
    type: 'bigint' as const,
    nullable: false,
  }),
});

/**
 * Array of all system column names.
 *
 * This is useful for iteration and validation.
 *
 * @example
 * ```typescript
 * import { SYSTEM_COLUMN_NAMES } from '@icetype/core';
 *
 * for (const name of SYSTEM_COLUMN_NAMES) {
 *   console.log(`System column: ${name}`);
 * }
 * ```
 */
export const SYSTEM_COLUMN_NAMES: readonly SystemColumnName[] = Object.freeze([
  '$id',
  '$type',
  '$version',
  '$createdAt',
  '$updatedAt',
] as const);

/**
 * Get a system column definition by name.
 *
 * @param name - The column name to look up
 * @returns The column definition if found, undefined otherwise
 *
 * @example
 * ```typescript
 * import { getSystemColumn } from '@icetype/core';
 *
 * const idColumn = getSystemColumn('$id');
 * if (idColumn) {
 *   console.log(idColumn.type); // 'uuid'
 * }
 *
 * const userColumn = getSystemColumn('name');
 * console.log(userColumn); // undefined (not a system column)
 * ```
 */
export function getSystemColumn(name: string): SystemColumnDefinition | undefined {
  if (isSystemColumn(name)) {
    return SYSTEM_COLUMNS[name];
  }
  return undefined;
}

/**
 * Check if a column name is a system column.
 *
 * @param name - The column name to check
 * @returns True if the name is a system column, false otherwise
 *
 * @example
 * ```typescript
 * import { isSystemColumn } from '@icetype/core';
 *
 * isSystemColumn('$id');       // true
 * isSystemColumn('$type');     // true
 * isSystemColumn('name');      // false
 * isSystemColumn('id');        // false (no $ prefix)
 * isSystemColumn('$invalid');  // false (not a known system column)
 * ```
 */
export function isSystemColumn(name: string): name is SystemColumnName {
  return SYSTEM_COLUMN_NAMES.includes(name as SystemColumnName);
}
