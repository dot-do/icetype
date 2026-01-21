/**
 * MySQL Adapter Implementation
 *
 * Transforms IceType schemas to MySQL DDL (Data Definition Language).
 *
 * @packageDocumentation
 */

import type { IceTypeSchema } from '@icetype/core';
import type { SchemaAdapter } from '@icetype/adapters';

import type {
  MySQLDDL,
  MySQLColumn,
  MySQLAdapterOptions,
} from './types.js';

import {
  fieldToMySQLColumn,
  generateSystemColumns,
  serializeDDL,
  generateIndexStatements,
} from './ddl.js';

// =============================================================================
// MySQL Adapter
// =============================================================================

/**
 * Adapter for transforming IceType schemas to MySQL DDL.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { MySQLAdapter } from '@icetype/mysql';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 * });
 *
 * const adapter = new MySQLAdapter();
 *
 * // Get DDL structure
 * const ddl = adapter.transform(schema);
 *
 * // Serialize to CREATE TABLE statement
 * const sql = adapter.serialize(ddl);
 * console.log(sql);
 * // CREATE TABLE User (
 * //   `$id` VARCHAR(255) NOT NULL,
 * //   `$type` VARCHAR(255) NOT NULL,
 * //   ...
 * //   id CHAR(36) NOT NULL,
 * //   email VARCHAR(255) UNIQUE,
 * //   name VARCHAR(255),
 * //   age INT,
 * //   PRIMARY KEY (`$id`)
 * // ) ENGINE=InnoDB;
 * ```
 */
export class MySQLAdapter
  implements SchemaAdapter<MySQLDDL, MySQLAdapterOptions>
{
  readonly name = 'mysql';
  readonly version = '0.1.0';

  /**
   * Transform an IceType schema to a MySQL DDL structure.
   *
   * @param schema - The IceType schema to transform
   * @param options - Optional MySQL-specific options
   * @returns MySQL DDL structure
   */
  transform(
    schema: IceTypeSchema,
    options?: MySQLAdapterOptions
  ): MySQLDDL {
    const columns: MySQLColumn[] = [];
    const primaryKey: string[] = [];

    // Add system fields if requested (default: true)
    const includeSystemFields = options?.includeSystemFields ?? true;
    if (includeSystemFields) {
      const systemColumns = generateSystemColumns();
      for (const col of systemColumns) {
        if (col.primaryKey) {
          primaryKey.push(col.name);
        }
        columns.push(col);
      }
    }

    // Process schema fields
    for (const [fieldName, fieldDef] of schema.fields) {
      // Skip directive fields
      if (fieldName.startsWith('$')) continue;

      const column = fieldToMySQLColumn(fieldName, fieldDef);
      columns.push(column);
    }

    // Build DDL structure
    const ddl: MySQLDDL = {
      tableName: options?.tableName ?? schema.name,
      columns,
      primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
      ifNotExists: options?.ifNotExists,
      engine: options?.engine ?? 'InnoDB',
      charset: options?.charset,
      collation: options?.collation,
      comment: options?.comment,
    };

    // Collect unique constraints from unique indexed fields
    const uniqueColumns = columns.filter(c => c.unique && !c.primaryKey);
    if (uniqueColumns.length > 0) {
      // Individual unique constraints for each unique column
      ddl.uniqueConstraints = uniqueColumns.map(c => [c.name]);
    }

    return ddl;
  }

  /**
   * Serialize MySQL DDL to a CREATE TABLE SQL statement.
   *
   * @param output - The DDL structure to serialize
   * @returns SQL CREATE TABLE statement
   */
  serialize(output: MySQLDDL): string {
    return serializeDDL(output);
  }

  /**
   * Generate DDL including index statements.
   *
   * @param ddl - The DDL structure
   * @returns Full DDL including CREATE INDEX statements
   */
  serializeWithIndexes(ddl: MySQLDDL): string {
    const createTable = this.serialize(ddl);
    const indexStatements = generateIndexStatements(
      ddl.tableName,
      ddl.columns
    );

    if (indexStatements.length === 0) {
      return createTable;
    }

    return [createTable, '', ...indexStatements].join('\n');
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new MySQL adapter instance.
 *
 * @returns A new MySQLAdapter instance
 */
export function createMySQLAdapter(): MySQLAdapter {
  return new MySQLAdapter();
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Transform an IceType schema directly to a MySQL CREATE TABLE statement.
 *
 * This is a convenience function that combines the adapter transform
 * and serialize steps.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional MySQL-specific options
 * @returns SQL CREATE TABLE statement
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { transformToMySQLDDL } from '@icetype/mysql';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 * });
 *
 * const sql = transformToMySQLDDL(schema, { ifNotExists: true });
 * console.log(sql);
 * // CREATE TABLE IF NOT EXISTS User (
 * //   ...
 * // ) ENGINE=InnoDB;
 * ```
 */
export function transformToMySQLDDL(
  schema: IceTypeSchema,
  options?: MySQLAdapterOptions
): string {
  const adapter = new MySQLAdapter();
  const ddl = adapter.transform(schema, options);
  return adapter.serialize(ddl);
}

/**
 * Transform an IceType schema to MySQL DDL structure.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional MySQL-specific options
 * @returns MySQL DDL structure
 */
export function generateMySQLDDL(
  schema: IceTypeSchema,
  options?: MySQLAdapterOptions
): MySQLDDL {
  const adapter = new MySQLAdapter();
  return adapter.transform(schema, options);
}
