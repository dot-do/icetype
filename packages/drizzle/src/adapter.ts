/**
 * Drizzle Adapter Implementation
 *
 * Transforms IceType schemas to Drizzle ORM schema files.
 *
 * @packageDocumentation
 */

import type { IceTypeSchema, FieldDefinition } from '@icetype/core';
import type { SchemaAdapter } from '@icetype/adapters';

import type {
  DrizzleSchema,
  DrizzleTable,
  DrizzleColumn,
  DrizzleIndex,
  DrizzleAdapterOptions,
  DrizzleDialect,
} from './types.js';

import { getDrizzleType } from './mappings.js';
import {
  generateSchemaCode,
  collectImports,
  toCamelCase,
  toSnakeCase,
  formatDefaultValue,
  validateTableName,
  validateColumnName,
} from './generator.js';

import { VERSION } from './version.js';

// =============================================================================
// System Fields
// =============================================================================

/**
 * System field definitions for IceType.
 */
const SYSTEM_FIELDS = [
  { name: '$id', type: 'text', nullable: false, primaryKey: true },
  { name: '$type', type: 'text', nullable: false, primaryKey: false },
  { name: '$createdAt', type: 'timestamp', nullable: false, primaryKey: false },
  { name: '$updatedAt', type: 'timestamp', nullable: false, primaryKey: false },
];

// =============================================================================
// Field to Column Conversion
// =============================================================================

/**
 * Convert an IceType field definition to a Drizzle column.
 *
 * @param fieldName - The field name
 * @param fieldDef - The field definition
 * @param dialect - Target dialect
 * @param options - Adapter options
 * @returns Drizzle column definition
 */
function fieldToColumn(
  fieldName: string,
  fieldDef: FieldDefinition,
  dialect: DrizzleDialect,
  options: DrizzleAdapterOptions
): DrizzleColumn {
  const useCamelCase = options.camelCase ?? true;
  const enforceNotNull = options.enforceNotNull ?? true;

  // Get the Drizzle type
  let drizzleType = getDrizzleType(fieldDef.type, dialect);

  // Handle special type mappings
  if (fieldDef.type === 'uuid' && dialect === 'mysql') {
    drizzleType = 'varchar';
  } else if (fieldDef.type === 'uuid' && dialect === 'sqlite') {
    drizzleType = 'text';
  }

  // Determine nullability
  const isRequired = fieldDef.modifier === '!' || !fieldDef.isOptional;
  const nullable = !isRequired || !enforceNotNull;

  // Build type parameters
  const typeParams: Record<string, unknown> = {};

  // Handle varchar/char length
  if (fieldDef.length !== undefined) {
    typeParams['length'] = fieldDef.length;
  } else if (fieldDef.type === 'string' && dialect !== 'sqlite') {
    // Default varchar length
    typeParams['length'] = 255;
  } else if (fieldDef.type === 'uuid' && dialect === 'mysql') {
    // UUID needs 36 characters in MySQL
    typeParams['length'] = 36;
  }

  // Handle decimal precision/scale
  if (fieldDef.precision !== undefined) {
    typeParams['precision'] = fieldDef.precision;
    typeParams['scale'] = fieldDef.scale ?? 0;
  }

  // Handle timestamp with timezone
  if (fieldDef.type === 'timestamptz' && dialect === 'pg') {
    typeParams['withTimezone'] = true;
  }

  // Format default value
  const defaultValue = formatDefaultValue(fieldDef.defaultValue, fieldDef.type);

  // Determine column name (in code) vs original name (in DB)
  const columnName = useCamelCase ? toCamelCase(fieldName) : fieldName;
  const originalName = fieldName;

  return {
    name: validateColumnName(columnName),
    type: drizzleType,
    typeParams: Object.keys(typeParams).length > 0 ? typeParams : undefined,
    nullable,
    primaryKey: false,
    unique: fieldDef.isUnique,
    defaultValue,
    isArray: fieldDef.isArray,
    originalName,
  };
}

/**
 * Generate system columns for the table.
 *
 * @param dialect - Target dialect
 * @param options - Adapter options
 * @returns Array of system column definitions
 */
function generateSystemColumns(
  dialect: DrizzleDialect,
  options: DrizzleAdapterOptions
): DrizzleColumn[] {
  const useCamelCase = options.camelCase ?? true;

  return SYSTEM_FIELDS.map(field => ({
    name: useCamelCase ? toCamelCase(field.name.replace('$', '')) : field.name,
    type: getDrizzleType(field.type, dialect),
    typeParams: undefined,
    nullable: field.nullable,
    primaryKey: field.primaryKey,
    unique: false,
    defaultValue: undefined,
    isArray: false,
    originalName: field.name,
  }));
}

// =============================================================================
// Drizzle Adapter
// =============================================================================

/**
 * Adapter for transforming IceType schemas to Drizzle ORM schema files.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { DrizzleAdapter } from '@icetype/drizzle';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 * });
 *
 * const adapter = new DrizzleAdapter();
 *
 * // Get Drizzle schema structure
 * const drizzleSchema = adapter.transform(schema, { dialect: 'pg' });
 *
 * // Generate TypeScript code
 * const code = adapter.serialize(drizzleSchema);
 * console.log(code);
 * // import { pgTable, varchar, uuid, integer } from 'drizzle-orm/pg-core';
 * //
 * // export const users = pgTable('users', {
 * //   id: uuid('id').primaryKey().notNull(),
 * //   email: varchar('email', { length: 255 }).notNull().unique(),
 * //   name: varchar('name', { length: 255 }),
 * //   age: integer('age'),
 * // });
 * ```
 */
export class DrizzleAdapter
  implements SchemaAdapter<DrizzleSchema, DrizzleAdapterOptions>
{
  readonly name = 'drizzle';
  readonly version = VERSION;

  /**
   * Transform an IceType schema to a Drizzle schema structure.
   *
   * @param schema - The IceType schema to transform
   * @param options - Drizzle-specific options
   * @returns Drizzle schema structure
   */
  transform(
    schema: IceTypeSchema,
    options?: DrizzleAdapterOptions
  ): DrizzleSchema {
    const opts: DrizzleAdapterOptions = {
      dialect: 'pg',
      includeSystemFields: false,
      camelCase: true,
      enforceNotNull: true,
      ...options,
    };

    const dialect = opts.dialect!;
    const columns: DrizzleColumn[] = [];
    const indexes: DrizzleIndex[] = [];

    // Add system fields if requested
    if (opts.includeSystemFields) {
      const systemColumns = generateSystemColumns(dialect, opts);
      columns.push(...systemColumns);
    }

    // Process schema fields
    for (const [fieldName, fieldDef] of schema.fields) {
      // Skip directive fields
      if (fieldName.startsWith('$')) continue;

      const column = fieldToColumn(fieldName, fieldDef, dialect, opts);

      // Check if this is a primary key candidate (required uuid named 'id')
      if (
        fieldName === 'id' &&
        fieldDef.type === 'uuid' &&
        fieldDef.modifier === '!' &&
        !opts.includeSystemFields
      ) {
        column.primaryKey = true;
      }

      columns.push(column);
    }

    // Process indexes from directives
    if (schema.directives.index) {
      for (const indexDef of schema.directives.index) {
        const indexName = indexDef.name || `${toSnakeCase(schema.name)}_${indexDef.fields.join('_')}_idx`;
        indexes.push({
          name: indexName,
          columns: indexDef.fields.map(f => opts.camelCase ? toCamelCase(f) : f),
          unique: indexDef.unique ?? false,
        });
      }
    }

    // Build table definition
    const tableName = opts.tableName ?? toSnakeCase(schema.name);
    const exportName = toCamelCase(schema.name);

    const table: DrizzleTable = {
      tableName: validateTableName(tableName),
      exportName,
      columns,
      indexes,
      primaryKey: columns.filter(c => c.primaryKey).map(c => c.name),
    };

    // Collect imports
    const imports = collectImports([table], dialect);

    return {
      dialect,
      tables: [table],
      imports,
    };
  }

  /**
   * Serialize a Drizzle schema to TypeScript code.
   *
   * @param output - The Drizzle schema to serialize
   * @returns Generated TypeScript code
   */
  serialize(output: DrizzleSchema): string {
    return generateSchemaCode(output);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new Drizzle adapter instance.
 *
 * @returns A new DrizzleAdapter instance
 */
export function createDrizzleAdapter(): DrizzleAdapter {
  return new DrizzleAdapter();
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Transform an IceType schema directly to Drizzle TypeScript code.
 *
 * @param schema - The IceType schema to transform
 * @param options - Drizzle-specific options
 * @returns Generated TypeScript code
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { transformToDrizzle } from '@icetype/drizzle';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 * });
 *
 * const code = transformToDrizzle(schema, { dialect: 'pg' });
 * console.log(code);
 * ```
 */
export function transformToDrizzle(
  schema: IceTypeSchema,
  options?: DrizzleAdapterOptions
): string {
  const adapter = new DrizzleAdapter();
  const drizzleSchema = adapter.transform(schema, options);
  return adapter.serialize(drizzleSchema);
}

/**
 * Transform an IceType schema to a Drizzle schema structure.
 *
 * @param schema - The IceType schema to transform
 * @param options - Drizzle-specific options
 * @returns Drizzle schema structure
 */
export function generateDrizzleSchema(
  schema: IceTypeSchema,
  options?: DrizzleAdapterOptions
): DrizzleSchema {
  const adapter = new DrizzleAdapter();
  return adapter.transform(schema, options);
}

/**
 * Transform multiple IceType schemas to a single Drizzle schema file.
 *
 * @param schemas - Array of IceType schemas
 * @param options - Drizzle-specific options
 * @returns Generated TypeScript code
 */
export function transformSchemasToDrizzle(
  schemas: IceTypeSchema[],
  options?: DrizzleAdapterOptions
): string {
  const adapter = new DrizzleAdapter();
  const opts = { dialect: 'pg' as DrizzleDialect, ...options };

  // Transform all schemas
  const tables: DrizzleTable[] = [];
  for (const schema of schemas) {
    const drizzleSchema = adapter.transform(schema, opts);
    tables.push(...drizzleSchema.tables);
  }

  // Collect imports for all tables
  const imports = collectImports(tables, opts.dialect!);

  const combinedSchema: DrizzleSchema = {
    dialect: opts.dialect!,
    tables,
    imports,
  };

  return generateSchemaCode(combinedSchema);
}
