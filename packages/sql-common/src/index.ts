/**
 * @icetype/sql-common
 *
 * Shared SQL DDL utilities for IceType database adapters.
 * Provides common functionality for escaping identifiers, formatting values,
 * and generating DDL statements across DuckDB, PostgreSQL, ClickHouse, SQLite, and MySQL.
 *
 * @packageDocumentation
 */

import { SYSTEM_COLUMNS } from '@icetype/core';

// =============================================================================
// Types Re-exports
// =============================================================================

export type { SqlDialect, SqlColumn } from './types.js';

// =============================================================================
// Escape and Keyword Re-exports
// =============================================================================

export { escapeIdentifier, isReservedKeyword } from './escape.js';

// =============================================================================
// Validation Re-exports
// =============================================================================

export {
  validateSchemaName,
  validateIdentifier,
  InvalidSchemaNameError,
  InvalidIdentifierError,
  IdentifierTooLongError,
  type IdentifierValidationResult,
} from './validation.js';

// =============================================================================
// Column Re-exports
// =============================================================================

export { serializeColumn, formatDefaultValue } from './columns.js';

// =============================================================================
// System Columns
// =============================================================================

/**
 * Type configurations for system columns across dialects.
 */
import type { SqlDialect } from './types.js';
import type { SqlColumn } from './types.js';

const SYSTEM_COLUMN_TYPES: Record<SqlDialect, {
  stringType: string;
  intType: string;
  bigintType: string;
}> = {
  duckdb: {
    stringType: 'VARCHAR',
    intType: 'INTEGER',
    bigintType: 'BIGINT',
  },
  postgres: {
    stringType: 'TEXT',
    intType: 'INTEGER',
    bigintType: 'BIGINT',
  },
  clickhouse: {
    stringType: 'String',
    intType: 'Int32',
    bigintType: 'Int64',
  },
  sqlite: {
    stringType: 'TEXT',
    intType: 'INTEGER',
    bigintType: 'INTEGER',
  },
  mysql: {
    stringType: 'VARCHAR(255)',
    intType: 'INT',
    bigintType: 'BIGINT',
  },
};

/**
 * Generate system field columns for SQL tables.
 *
 * These are the standard IceType system fields that should be included
 * in every table:
 * - $id: Primary key identifier
 * - $type: Entity type name
 * - $version: Row version for optimistic locking
 * - $createdAt: Creation timestamp (as BIGINT epoch ms)
 * - $updatedAt: Last update timestamp (as BIGINT epoch ms)
 *
 * @param dialect - The SQL dialect to use
 * @returns Array of system column definitions
 */
export function generateSystemColumns(dialect: SqlDialect): SqlColumn[] {
  const types = SYSTEM_COLUMN_TYPES[dialect];

  return [
    {
      name: SYSTEM_COLUMNS.$id.name,
      type: types.stringType,
      nullable: SYSTEM_COLUMNS.$id.nullable,
      ...(SYSTEM_COLUMNS.$id.primaryKey ? { primaryKey: true } : {}),
    },
    {
      name: SYSTEM_COLUMNS.$type.name,
      type: types.stringType,
      nullable: SYSTEM_COLUMNS.$type.nullable,
    },
    {
      name: SYSTEM_COLUMNS.$version.name,
      type: types.intType,
      nullable: SYSTEM_COLUMNS.$version.nullable,
      default: String(SYSTEM_COLUMNS.$version.defaultValue),
    },
    {
      name: SYSTEM_COLUMNS.$createdAt.name,
      type: types.bigintType,
      nullable: SYSTEM_COLUMNS.$createdAt.nullable,
    },
    {
      name: SYSTEM_COLUMNS.$updatedAt.name,
      type: types.bigintType,
      nullable: SYSTEM_COLUMNS.$updatedAt.nullable,
    },
  ];
}

// =============================================================================
// Index Statements
// =============================================================================

import { escapeIdentifier } from './escape.js';

/**
 * Generate index DDL statements for indexed fields.
 *
 * Creates CREATE INDEX statements for columns marked as unique.
 * Note: UNIQUE constraints already create indexes in most databases,
 * but explicit indexes might be wanted for non-unique indexed fields.
 *
 * ClickHouse handles indexes differently (ORDER BY, materialized indexes),
 * so this returns an empty array for ClickHouse dialect.
 *
 * @param tableName - The table name
 * @param schemaName - Optional schema name
 * @param columns - The columns to potentially index
 * @param dialect - The SQL dialect to use
 * @returns Array of CREATE INDEX statements
 */
export function generateIndexStatements(
  tableName: string,
  schemaName: string | undefined,
  columns: SqlColumn[],
  dialect: SqlDialect
): string[] {
  // ClickHouse handles indexes differently - it uses ORDER BY and
  // specialized index types (skip indexes, projections)
  if (dialect === 'clickhouse') {
    return [];
  }

  const statements: string[] = [];
  const fullTableName = schemaName
    ? `${escapeIdentifier(schemaName, dialect)}.${escapeIdentifier(tableName, dialect)}`
    : escapeIdentifier(tableName, dialect);

  for (const column of columns) {
    // Create indexes for unique columns
    if (column.unique) {
      // Replace $ with _ in index name to avoid issues
      const indexName = `idx_${tableName}_${column.name}`.replace(/\$/g, '_');
      statements.push(
        `CREATE INDEX IF NOT EXISTS ${escapeIdentifier(indexName, dialect)} ON ${fullTableName} (${escapeIdentifier(column.name, dialect)});`
      );
    }
  }

  return statements;
}

// =============================================================================
// Foreign Key Re-exports
// =============================================================================

export {
  extractForeignKeys,
  serializeForeignKey,
  type ForeignKeyDefinition,
  type ReferentialAction,
  type ExtractForeignKeysOptions,
} from './foreign-keys.js';

// =============================================================================
// DDL Serialization Re-exports
// =============================================================================

export {
  serializeDDL,
  type DDLStructure,
  type ForeignKey,
  type ForeignKeyAction,
  type CheckConstraint,
} from './serialize.js';
