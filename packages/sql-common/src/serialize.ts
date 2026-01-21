/**
 * Shared DDL Serialization for SQL Dialects
 *
 * Provides a unified `serializeDDL` function that generates CREATE TABLE
 * statements for all supported SQL dialects: PostgreSQL, MySQL, SQLite,
 * DuckDB, and ClickHouse.
 *
 * @packageDocumentation
 */

import {
  escapeIdentifier,
  serializeColumn as serializeColumnBase,
  validateSchemaName,
  type SqlDialect,
  type SqlColumn,
} from './index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Foreign key reference action types.
 */
export type ForeignKeyAction = 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';

/**
 * Foreign key constraint definition.
 */
export interface ForeignKey {
  /** Column names in this table that form the foreign key */
  columns: string[];
  /** Reference to the target table and columns */
  references: {
    table: string;
    columns: string[];
  };
  /** Action to take when referenced row is deleted */
  onDelete?: ForeignKeyAction;
  /** Action to take when referenced row is updated */
  onUpdate?: ForeignKeyAction;
}

/**
 * Check constraint definition.
 */
export interface CheckConstraint {
  /** Optional constraint name */
  name?: string;
  /** The SQL expression for the check */
  expression: string;
}

/**
 * Unified DDL structure for all SQL dialects.
 *
 * Contains all the information needed to generate a CREATE TABLE statement
 * across PostgreSQL, MySQL, SQLite, DuckDB, and ClickHouse.
 */
export interface DDLStructure {
  /** Table name */
  tableName: string;
  /** Schema name (e.g., 'public' for PostgreSQL) */
  schemaName?: string;
  /** Column definitions */
  columns: SqlColumn[];
  /** Primary key column names */
  primaryKey?: string[];
  /** Unique constraints (arrays of column names) */
  uniqueConstraints?: string[][];
  /** Check constraints */
  checkConstraints?: CheckConstraint[];
  /** Foreign key constraints */
  foreignKeys?: ForeignKey[];
  /** Whether to use IF NOT EXISTS clause */
  ifNotExists?: boolean;

  // SQLite-specific options
  /** Use STRICT mode for SQLite (SQLite 3.37+) */
  strict?: boolean;
  /** Use WITHOUT ROWID for SQLite */
  withoutRowid?: boolean;

  // MySQL-specific options
  /** Storage engine for MySQL (e.g., 'InnoDB') */
  engine?: string;
  /** Character set for MySQL (e.g., 'utf8mb4') */
  charset?: string;
  /** Collation for MySQL */
  collation?: string;
  /** Table comment for MySQL */
  comment?: string;

  // PostgreSQL-specific options
  /** Use UNLOGGED table for PostgreSQL */
  unlogged?: boolean;

  // DuckDB-specific options
  /** Use TEMPORARY table for DuckDB */
  temporary?: boolean;
}

// Re-export SqlDialect for convenience
export type { SqlDialect };

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Serialize a single column for DDL generation.
 *
 * @param column - The column definition
 * @param dialect - The SQL dialect
 * @returns The serialized column DDL fragment
 */
function serializeColumn(column: SqlColumn, dialect: SqlDialect): string {
  return serializeColumnBase(column, dialect);
}

/**
 * Generate the PRIMARY KEY constraint clause.
 *
 * @param primaryKey - Array of column names
 * @param dialect - The SQL dialect
 * @returns The PRIMARY KEY clause string
 */
function serializePrimaryKey(primaryKey: string[], dialect: SqlDialect): string {
  const pkCols = primaryKey.map(col => escapeIdentifier(col, dialect)).join(', ');
  return `PRIMARY KEY (${pkCols})`;
}

/**
 * Generate a UNIQUE constraint clause.
 *
 * @param columns - Array of column names
 * @param dialect - The SQL dialect
 * @returns The UNIQUE clause string
 */
function serializeUniqueConstraint(columns: string[], dialect: SqlDialect): string {
  const cols = columns.map(col => escapeIdentifier(col, dialect)).join(', ');
  return `UNIQUE (${cols})`;
}

/**
 * Generate a CHECK constraint clause.
 *
 * @param check - The check constraint definition
 * @param dialect - The SQL dialect
 * @returns The CHECK clause string
 */
function serializeCheckConstraint(check: CheckConstraint, dialect: SqlDialect): string {
  if (check.name) {
    return `CONSTRAINT ${escapeIdentifier(check.name, dialect)} CHECK (${check.expression})`;
  }
  return `CHECK (${check.expression})`;
}

/**
 * Generate a FOREIGN KEY constraint clause.
 *
 * @param fk - The foreign key definition
 * @param dialect - The SQL dialect
 * @returns The FOREIGN KEY clause string
 */
function serializeForeignKey(fk: ForeignKey, dialect: SqlDialect): string {
  const fkCols = fk.columns.map(col => escapeIdentifier(col, dialect)).join(', ');
  const refTable = escapeIdentifier(fk.references.table, dialect);
  const refCols = fk.references.columns.map(col => escapeIdentifier(col, dialect)).join(', ');

  let fkDef = `FOREIGN KEY (${fkCols}) REFERENCES ${refTable} (${refCols})`;

  if (fk.onDelete) {
    fkDef += ` ON DELETE ${fk.onDelete}`;
  }
  if (fk.onUpdate) {
    fkDef += ` ON UPDATE ${fk.onUpdate}`;
  }

  return fkDef;
}

/**
 * Generate the full table name with optional schema.
 *
 * @param tableName - The table name
 * @param schemaName - Optional schema name
 * @param dialect - The SQL dialect
 * @returns The fully qualified table name
 */
function getFullTableName(tableName: string, schemaName: string | undefined, dialect: SqlDialect): string {
  if (schemaName) {
    // Validate schema name to prevent SQL injection
    validateSchemaName(schemaName);
    return `${escapeIdentifier(schemaName, dialect)}.${escapeIdentifier(tableName, dialect)}`;
  }
  return escapeIdentifier(tableName, dialect);
}

// =============================================================================
// Main serializeDDL Function
// =============================================================================

/**
 * Serialize a DDL structure to a CREATE TABLE statement.
 *
 * Supports all SQL dialects with dialect-specific options:
 * - PostgreSQL: UNLOGGED tables, schema names
 * - MySQL: ENGINE, CHARACTER SET, COLLATE, COMMENT
 * - SQLite: STRICT, WITHOUT ROWID
 * - DuckDB: TEMPORARY tables, schema names
 * - ClickHouse: Basic table creation (CHECK and FK not supported)
 *
 * @param ddl - The DDL structure
 * @param dialect - The SQL dialect to use
 * @returns The CREATE TABLE SQL statement
 */
export function serializeDDL(ddl: DDLStructure, dialect: SqlDialect): string {
  const lines: string[] = [];

  // Build CREATE TABLE header
  let header = 'CREATE';

  // PostgreSQL UNLOGGED
  if (dialect === 'postgres' && ddl.unlogged) {
    header += ' UNLOGGED';
  }

  // DuckDB TEMPORARY
  if (dialect === 'duckdb' && ddl.temporary) {
    header += ' TEMPORARY';
  }

  header += ' TABLE';

  // IF NOT EXISTS
  if (ddl.ifNotExists) {
    header += ' IF NOT EXISTS';
  }

  // Table name with optional schema
  const fullTableName = getFullTableName(ddl.tableName, ddl.schemaName, dialect);
  header += ` ${fullTableName} (`;
  lines.push(header);

  // Column definitions
  const columnDefs: string[] = ddl.columns.map(col => `  ${serializeColumn(col, dialect)}`);

  // Primary key constraint
  // For SQLite, check if there's an inline primary key already
  const hasInlinePrimaryKey = dialect === 'sqlite' && ddl.columns.some(col => col.primaryKey);
  if (ddl.primaryKey && ddl.primaryKey.length > 0 && !hasInlinePrimaryKey) {
    columnDefs.push(`  ${serializePrimaryKey(ddl.primaryKey, dialect)}`);
  }

  // Unique constraints
  if (ddl.uniqueConstraints) {
    for (const uniqueCols of ddl.uniqueConstraints) {
      columnDefs.push(`  ${serializeUniqueConstraint(uniqueCols, dialect)}`);
    }
  }

  // Check constraints (not supported in ClickHouse)
  if (ddl.checkConstraints && dialect !== 'clickhouse') {
    for (const check of ddl.checkConstraints) {
      columnDefs.push(`  ${serializeCheckConstraint(check, dialect)}`);
    }
  }

  // Foreign key constraints (not supported in ClickHouse)
  if (ddl.foreignKeys && dialect !== 'clickhouse') {
    for (const fk of ddl.foreignKeys) {
      columnDefs.push(`  ${serializeForeignKey(fk, dialect)}`);
    }
  }

  lines.push(columnDefs.join(',\n'));
  lines.push(')');

  // Dialect-specific table options
  if (dialect === 'sqlite') {
    // SQLite table options
    const tableOptions: string[] = [];

    if (ddl.withoutRowid) {
      tableOptions.push('WITHOUT ROWID');
    }

    if (ddl.strict) {
      tableOptions.push('STRICT');
    }

    if (tableOptions.length > 0) {
      lines[lines.length - 1] += ' ' + tableOptions.join(', ');
    }

    lines[lines.length - 1] += ';';
  } else if (dialect === 'mysql') {
    // MySQL table options
    const tableOptions: string[] = [];

    if (ddl.engine) {
      tableOptions.push(`ENGINE=${ddl.engine}`);
    }

    if (ddl.charset) {
      tableOptions.push(`CHARACTER SET ${ddl.charset}`);
    }

    if (ddl.collation) {
      tableOptions.push(`COLLATE ${ddl.collation}`);
    }

    if (ddl.comment) {
      const escapedComment = ddl.comment.replace(/'/g, "''");
      tableOptions.push(`COMMENT='${escapedComment}'`);
    }

    if (tableOptions.length > 0) {
      lines[lines.length - 1] += ' ' + tableOptions.join(' ');
    }

    lines[lines.length - 1] += ';';
  } else {
    // PostgreSQL, DuckDB, ClickHouse
    lines[lines.length - 1] += ';';
  }

  return lines.join('\n');
}
