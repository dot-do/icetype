/**
 * Schema Factory Functions
 *
 * Provides utility functions for creating IceType schemas in tests.
 * These factories simplify test setup and ensure consistency across test suites.
 *
 * @packageDocumentation
 */

import { parseSchema, type IceTypeSchema } from '@icetype/core';

/**
 * Field type definition for schema factories
 */
export type FieldDefinition = string;

/**
 * Schema definition object (excluding $type)
 */
export interface SchemaFields {
  [key: string]: FieldDefinition;
}

/**
 * Options for schema creation
 */
export interface CreateSchemaOptions {
  /** Partition fields for the schema */
  partitionBy?: string[];
  /** Index definitions */
  index?: string[][];
  /** Full-text search fields */
  fts?: string[];
  /** Vector field configurations */
  vector?: Record<string, number>;
}

/**
 * Creates a simple schema with minimal configuration.
 *
 * @param name - The schema/entity name (will be used as $type)
 * @param fields - Object mapping field names to IceType type strings
 * @returns Parsed IceType schema
 *
 * @example
 * ```ts
 * const schema = createSimpleSchema('User', {
 *   id: 'uuid!',
 *   name: 'string',
 *   email: 'string#'
 * });
 * ```
 */
export function createSimpleSchema(
  name: string,
  fields: SchemaFields
): IceTypeSchema {
  return parseSchema({
    $type: name,
    ...fields,
  });
}

/**
 * Creates a schema with specific types for each field.
 * Useful when testing type mappings across different backends.
 *
 * @param name - The schema/entity name
 * @param fieldTypes - Object mapping field names to IceType type strings
 * @param options - Optional schema directives
 * @returns Parsed IceType schema
 *
 * @example
 * ```ts
 * const schema = createTypedSchema('Product', {
 *   id: 'uuid!',
 *   price: 'decimal(10,2)',
 *   tags: 'string[]'
 * }, { partitionBy: ['id'] });
 * ```
 */
export function createTypedSchema(
  name: string,
  fieldTypes: SchemaFields,
  options?: CreateSchemaOptions
): IceTypeSchema {
  const schemaDefinition: Record<string, unknown> = {
    $type: name,
    ...fieldTypes,
  };

  if (options?.partitionBy) {
    schemaDefinition['$partitionBy'] = options.partitionBy;
  }
  if (options?.index) {
    schemaDefinition['$index'] = options.index;
  }
  if (options?.fts) {
    schemaDefinition['$fts'] = options.fts;
  }
  if (options?.vector) {
    schemaDefinition['$vector'] = options.vector;
  }

  return parseSchema(schemaDefinition);
}

/**
 * Creates a schema with all primitive types supported by IceType.
 * Useful for comprehensive type mapping tests.
 *
 * @param name - The schema/entity name (defaults to 'AllTypes')
 * @returns Parsed IceType schema with all primitive types
 *
 * @example
 * ```ts
 * const schema = createAllTypesSchema();
 * // Contains: stringField, textField, intField, longField, etc.
 * ```
 */
export function createAllTypesSchema(name = 'AllTypes'): IceTypeSchema {
  return parseSchema({
    $type: name,
    stringField: 'string',
    textField: 'text',
    intField: 'int',
    longField: 'long',
    bigintField: 'bigint',
    floatField: 'float',
    doubleField: 'double',
    boolField: 'bool',
    booleanField: 'boolean',
    uuidField: 'uuid',
    timestampField: 'timestamp',
    timestamptzField: 'timestamptz',
    dateField: 'date',
    timeField: 'time',
    jsonField: 'json',
    binaryField: 'binary',
    decimalField: 'decimal',
  });
}

/**
 * Creates a schema with array type fields.
 *
 * @param name - The schema/entity name (defaults to 'ArrayTypes')
 * @returns Parsed IceType schema with array fields
 *
 * @example
 * ```ts
 * const schema = createArraySchema('Tags');
 * // Contains: id, tags (string[]), scores (int[])
 * ```
 */
export function createArraySchema(name = 'ArrayTypes'): IceTypeSchema {
  return parseSchema({
    $type: name,
    id: 'uuid!',
    tags: 'string[]',
    scores: 'int[]',
    metadata: 'json[]?',
  });
}

/**
 * Creates a schema with various field modifiers.
 *
 * @param name - The schema/entity name (defaults to 'Modifiers')
 * @returns Parsed IceType schema demonstrating all modifiers
 *
 * @example
 * ```ts
 * const schema = createModifierSchema();
 * // Contains: required (!), optional (?), unique (#) fields
 * ```
 */
export function createModifierSchema(name = 'Modifiers'): IceTypeSchema {
  return parseSchema({
    $type: name,
    requiredField: 'string!',
    optionalField: 'int?',
    uniqueField: 'string#',
    requiredUniqueField: 'uuid!',
    optionalArrayField: 'string[]?',
  });
}

/**
 * Creates a schema with relation fields.
 *
 * @param name - The schema/entity name (defaults to 'Relations')
 * @returns Parsed IceType schema with relation fields
 *
 * @example
 * ```ts
 * const schema = createRelationSchema('Post');
 * // Contains: forward (->), backward (<-), fuzzy (~>) relations
 * ```
 */
export function createRelationSchema(name = 'Relations'): IceTypeSchema {
  return parseSchema({
    $type: name,
    id: 'uuid!',
    title: 'string',
    author: '-> User',
    comments: '<- Comment.post',
    relatedItems: '~> Product',
  });
}

/**
 * Creates a schema with decimal/numeric types and precision.
 *
 * @param name - The schema/entity name (defaults to 'Numerics')
 * @returns Parsed IceType schema with various numeric types
 *
 * @example
 * ```ts
 * const schema = createNumericSchema('Financial');
 * // Contains: decimal with precision, float, double fields
 * ```
 */
export function createNumericSchema(name = 'Numerics'): IceTypeSchema {
  return parseSchema({
    $type: name,
    id: 'uuid!',
    amount: 'decimal(18,2)',
    price: 'decimal(10,4)',
    rate: 'float',
    total: 'double',
    quantity: 'int',
    bigNumber: 'bigint',
  });
}

/**
 * Creates a schema with default values.
 *
 * @param name - The schema/entity name (defaults to 'Defaults')
 * @returns Parsed IceType schema with default values
 *
 * @example
 * ```ts
 * const schema = createDefaultsSchema();
 * // Contains: fields with various default values
 * ```
 */
export function createDefaultsSchema(name = 'Defaults'): IceTypeSchema {
  return parseSchema({
    $type: name,
    id: 'uuid = uuid()',
    status: 'string = "active"',
    count: 'int = 0',
    enabled: 'bool = true',
    createdAt: 'timestamp = now()',
    metadata: 'json = {}',
  });
}

/**
 * Creates an empty schema with only the type name.
 * Useful for edge case testing.
 *
 * @param name - The schema/entity name
 * @returns Parsed IceType schema with no user fields
 */
export function createEmptySchema(name: string): IceTypeSchema {
  return parseSchema({
    $type: name,
  });
}
