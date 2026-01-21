/**
 * ClickHouse Adapter Implementation
 *
 * Transforms IceType schemas to ClickHouse DDL structures and
 * generates CREATE TABLE statements.
 *
 * @packageDocumentation
 */

import type { IceTypeSchema, FieldDefinition, SchemaAdapter } from '@icetype/core';

import type {
  ClickHouseDDL,
  ClickHouseColumn,
  ClickHouseTableOptions,
} from './types.js';

import {
  getClickHouseType,
  wrapNullable,
  getArrayType,
} from './types.js';

import {
  generateCreateTableDDL,
  inferOrderBy,
} from './ddl.js';

import { VERSION } from './version.js';

// =============================================================================
// ClickHouse Adapter
// =============================================================================

/**
 * Adapter for transforming IceType schemas to ClickHouse DDL.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { ClickHouseAdapter } from '@icetype/clickhouse';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   $partitionBy: ['created_at'],
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 *   created_at: 'timestamp!',
 * });
 *
 * const adapter = new ClickHouseAdapter();
 * const ddl = adapter.transform(schema, {
 *   engine: 'ReplacingMergeTree',
 *   orderBy: ['id'],
 *   partitionBy: 'toYYYYMM(created_at)',
 * });
 *
 * // Generate SQL
 * const sql = adapter.serialize(ddl);
 * console.log(sql);
 * // CREATE TABLE User
 * // (
 * //     id UUID,
 * //     email String,
 * //     ...
 * // )
 * // ENGINE = ReplacingMergeTree()
 * // PARTITION BY toYYYYMM(created_at)
 * // ORDER BY (id)
 * ```
 */
export class ClickHouseAdapter
  implements SchemaAdapter<ClickHouseDDL, ClickHouseTableOptions>
{
  readonly name = 'clickhouse';
  readonly version = VERSION;

  /**
   * Transform an IceType schema to ClickHouse DDL structure.
   *
   * @param schema - The IceType schema to transform
   * @param options - ClickHouse-specific options
   * @returns ClickHouse DDL structure
   */
  transform(
    schema: IceTypeSchema,
    options?: ClickHouseTableOptions
  ): ClickHouseDDL {
    const columns = this.transformFields(schema.fields);
    const tableName = this.toSnakeCase(schema.name);

    // Build the DDL structure
    const ddl: ClickHouseDDL = {
      tableName,
      columns,
      engine: options?.engine ?? 'MergeTree',
      orderBy: options?.orderBy ?? [],
      ifNotExists: options?.ifNotExists ?? true,
    };

    // Add optional properties from options
    if (options?.database) {
      ddl.database = options.database;
    }

    if (options?.partitionBy) {
      ddl.partitionBy = options.partitionBy;
    } else if (schema.directives.partitionBy && schema.directives.partitionBy.length > 0) {
      // Try to infer partition from schema directives
      ddl.partitionBy = this.inferPartitionBy(schema.directives.partitionBy, columns);
    }

    if (options?.primaryKey) {
      ddl.primaryKey = options.primaryKey;
    }

    if (options?.settings) {
      ddl.settings = options.settings;
    }

    if (options?.ttl) {
      ddl.ttl = options.ttl;
    }

    if (options?.versionColumn) {
      ddl.versionColumn = options.versionColumn;
    }

    if (options?.signColumn) {
      ddl.signColumn = options.signColumn;
    }

    if (options?.sumColumns) {
      ddl.sumColumns = options.sumColumns;
    }

    // Infer ORDER BY if not specified
    if (ddl.orderBy.length === 0) {
      ddl.orderBy = inferOrderBy(ddl);
    }

    return ddl;
  }

  /**
   * Serialize ClickHouse DDL to a CREATE TABLE statement.
   *
   * @param output - The DDL structure to serialize
   * @returns The CREATE TABLE DDL string
   */
  serialize(output: ClickHouseDDL): string {
    return generateCreateTableDDL(output);
  }

  /**
   * Transform IceType fields to ClickHouse columns.
   *
   * @param fields - Map of field definitions
   * @returns Array of ClickHouse column definitions
   */
  private transformFields(
    fields: Map<string, FieldDefinition>
  ): ClickHouseColumn[] {
    const columns: ClickHouseColumn[] = [];

    for (const [, field] of fields) {
      // Skip relation fields (they don't map to columns directly)
      if (field.relation) {
        continue;
      }

      const column = this.transformField(field);
      columns.push(column);
    }

    return columns;
  }

  /**
   * Transform a single IceType field to a ClickHouse column.
   *
   * @param field - The field definition
   * @returns The ClickHouse column definition
   */
  private transformField(field: FieldDefinition): ClickHouseColumn {
    const name = this.toSnakeCase(field.name);

    // Get the base ClickHouse type
    let clickHouseType = getClickHouseType(
      field.type,
      field.precision,
      field.scale
    );

    // Handle arrays
    if (field.isArray) {
      clickHouseType = getArrayType(clickHouseType);
    }

    // Determine nullability
    // In IceType:
    // - '!' means required (not nullable)
    // - '?' means optional (nullable)
    // - no modifier defaults to not nullable
    const nullable = field.isOptional;

    // Wrap in Nullable if needed
    if (nullable && !field.isArray) {
      // Arrays in ClickHouse can contain nulls but the array itself is not nullable
      clickHouseType = wrapNullable(clickHouseType, true);
    }

    const column: ClickHouseColumn = {
      name,
      type: clickHouseType,
      nullable,
    };

    // Handle default values
    if (field.defaultValue !== undefined) {
      column.default = this.serializeDefaultValue(field.defaultValue);
    }

    return column;
  }

  /**
   * Convert a camelCase or PascalCase string to snake_case.
   *
   * @param str - The string to convert
   * @returns The snake_case string
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .replace(/^_/, '')
      .toLowerCase();
  }

  /**
   * Serialize a default value for ClickHouse.
   *
   * @param value - The default value
   * @returns The serialized default value expression
   */
  private serializeDefaultValue(value: unknown): string {
    if (value === null) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }

    if (typeof value === 'object') {
      // Handle function defaults like { function: 'now' }
      const obj = value as Record<string, unknown>;
      if (obj['function'] && typeof obj['function'] === 'string') {
        const funcName = obj['function'];
        // Map common function names
        switch (funcName.toLowerCase()) {
          case 'now':
            return 'now()';
          case 'uuid':
          case 'gen_random_uuid':
            return 'generateUUIDv4()';
          default:
            return `${funcName}()`;
        }
      }

      // For arrays and objects, use JSON serialization
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }

    return String(value);
  }

  /**
   * Infer a PARTITION BY expression from schema directives.
   *
   * @param partitionFields - The partition field names from directives
   * @param columns - The column definitions
   * @returns A PARTITION BY expression or undefined
   */
  private inferPartitionBy(
    partitionFields: string[],
    columns: ClickHouseColumn[]
  ): string | undefined {
    if (partitionFields.length === 0) {
      return undefined;
    }

    // Get the first partition field
    const fieldName = partitionFields[0];
    if (!fieldName) {
      return undefined;
    }
    const snakeName = this.toSnakeCase(fieldName);

    // Find the column to determine type
    const column = columns.find((c) => c.name === snakeName);
    if (!column) {
      return snakeName;
    }

    // If it's a DateTime type, partition by month
    if (column.type.includes('DateTime')) {
      return `toYYYYMM(${snakeName})`;
    }

    // If it's a Date type, partition by month
    if (column.type === 'Date') {
      return `toYYYYMM(${snakeName})`;
    }

    // Otherwise, just use the field name
    return snakeName;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ClickHouse adapter instance.
 *
 * @returns A new ClickHouseAdapter instance
 */
export function createClickHouseAdapter(): ClickHouseAdapter {
  return new ClickHouseAdapter();
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Transform an IceType schema directly to a ClickHouse CREATE TABLE statement.
 *
 * This is a convenience function that combines the adapter transform
 * and serialize steps.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional ClickHouse-specific options
 * @returns SQL CREATE TABLE statement
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { transformToClickHouseDDL } from '@icetype/clickhouse';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 * });
 *
 * const sql = transformToClickHouseDDL(schema, {
 *   engine: 'ReplacingMergeTree',
 *   orderBy: ['id'],
 *   partitionBy: 'toYYYYMM(created_at)',
 * });
 * console.log(sql);
 * // CREATE TABLE IF NOT EXISTS user
 * // (
 * //     id UUID,
 * //     email String
 * // )
 * // ENGINE = ReplacingMergeTree()
 * // PARTITION BY toYYYYMM(created_at)
 * // ORDER BY (id)
 * ```
 */
export function transformToClickHouseDDL(
  schema: IceTypeSchema,
  options?: ClickHouseTableOptions
): string {
  const adapter = new ClickHouseAdapter();
  const ddl = adapter.transform(schema, options);
  return adapter.serialize(ddl);
}

/**
 * Transform an IceType schema to ClickHouse DDL structure.
 *
 * @param schema - The IceType schema to transform
 * @param options - Optional ClickHouse-specific options
 * @returns ClickHouse DDL structure
 */
export function generateClickHouseDDL(
  schema: IceTypeSchema,
  options?: ClickHouseTableOptions
): ClickHouseDDL {
  const adapter = new ClickHouseAdapter();
  return adapter.transform(schema, options);
}
