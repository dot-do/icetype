/**
 * Prisma Schema Exporter
 *
 * Generates Prisma schema files from IceType schemas.
 *
 * @packageDocumentation
 */

import type { IceTypeSchema, FieldDefinition } from '@icetype/core';
import type { SchemaAdapter } from '@icetype/adapters';

import type {
  PrismaExportOptions,
  PrismaSchemaOutput,
  PrismaModelOutput,
  PrismaFieldOutput,
  PrismaEnumOutput,
} from './types.js';

import {
  ICETYPE_TO_PRISMA_MAP,
  ICETYPE_DEFAULT_GENERATORS,
} from './types.js';

import { VERSION } from './version.js';

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * Map an IceType primitive type to a Prisma type.
 *
 * @param iceType - The IceType type string
 * @param customMappings - Optional custom type mappings
 * @returns The Prisma type string
 */
export function mapIceTypeToPrisma(
  iceType: string,
  customMappings?: Record<string, string>
): string {
  const normalized = iceType.toLowerCase();

  // Check custom mappings first
  if (customMappings?.[normalized]) {
    return customMappings[normalized];
  }

  // Use default mapping
  return ICETYPE_TO_PRISMA_MAP[normalized] ?? 'String';
}

/**
 * Get the default generator for a Prisma type based on IceType.
 *
 * @param iceType - The IceType type string
 * @returns The default generator string or undefined
 */
export function getDefaultGenerator(iceType: string): string | undefined {
  const normalized = iceType.toLowerCase();
  return ICETYPE_DEFAULT_GENERATORS[normalized];
}

// =============================================================================
// Field Generation
// =============================================================================

/**
 * Convert an IceType field definition to a Prisma field output.
 *
 * @param fieldName - The field name
 * @param field - The IceType field definition
 * @param options - Export options
 * @returns The Prisma field output
 */
export function fieldToPrismaField(
  fieldName: string,
  field: FieldDefinition,
  options?: PrismaExportOptions
): PrismaFieldOutput {
  const prismaType = mapIceTypeToPrisma(field.type, options?.customTypeMappings);
  const attributes: string[] = [];

  // Handle required with default generator for uuid type
  if (field.type.toLowerCase() === 'uuid' && !field.isOptional) {
    const defaultGen = getDefaultGenerator(field.type);
    if (defaultGen) {
      attributes.push(`@default(${defaultGen})`);
    }
  }

  // Handle unique constraint
  if (field.isUnique || field.modifier === '#') {
    attributes.push('@unique');
  }

  // Handle default values
  if (field.defaultValue !== undefined) {
    const defaultStr = formatPrismaDefault(field.defaultValue, field.type);
    if (defaultStr) {
      attributes.push(`@default(${defaultStr})`);
    }
  }

  // Handle timestamp with auto-now for createdAt patterns
  if (
    field.type.toLowerCase() === 'timestamp' ||
    field.type.toLowerCase() === 'timestamptz'
  ) {
    if (
      fieldName.toLowerCase() === 'createdat' ||
      fieldName.toLowerCase() === 'created_at'
    ) {
      if (!attributes.some((a) => a.startsWith('@default'))) {
        attributes.push('@default(now())');
      }
    }
    if (
      fieldName.toLowerCase() === 'updatedat' ||
      fieldName.toLowerCase() === 'updated_at'
    ) {
      attributes.push('@updatedAt');
    }
  }

  return {
    name: fieldName,
    type: prismaType,
    isOptional: field.isOptional || field.modifier === '?',
    isArray: field.isArray,
    attributes,
  };
}

/**
 * Format a default value for Prisma schema.
 *
 * @param value - The default value
 * @param iceType - The IceType type
 * @returns The formatted default value string
 */
export function formatPrismaDefault(
  value: unknown,
  iceType: string
): string | null {
  if (value === null) {
    return null;
  }

  const normalized = iceType.toLowerCase();

  // Handle string values
  if (typeof value === 'string') {
    // Check for function calls like uuid(), now(), etc.
    if (
      value.endsWith('()') ||
      value === 'uuid()' ||
      value === 'now()' ||
      value === 'cuid()' ||
      value === 'autoincrement()'
    ) {
      return value;
    }
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  // Handle numbers
  if (typeof value === 'number') {
    return String(value);
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  // Handle objects (for Json type)
  if (typeof value === 'object' && normalized === 'json') {
    return `"${JSON.stringify(value).replace(/"/g, '\\"')}"`;
  }

  return null;
}

// =============================================================================
// Model Generation
// =============================================================================

/**
 * Convert an IceType schema to a Prisma model output.
 *
 * @param schema - The IceType schema
 * @param options - Export options
 * @returns The Prisma model output
 */
export function schemaToPrismaModel(
  schema: IceTypeSchema,
  options?: PrismaExportOptions
): PrismaModelOutput {
  const fields: PrismaFieldOutput[] = [];
  const blockAttributes: string[] = [];

  // Add primary key field if not present
  let hasPrimaryKey = false;

  // Process fields
  for (const [fieldName, field] of schema.fields.entries()) {
    // Skip system fields unless explicitly included
    if (fieldName.startsWith('$') && !options?.includeSystemFields) {
      continue;
    }

    // Skip relation fields (handled separately)
    if (field.relation) {
      continue;
    }

    const prismaField = fieldToPrismaField(fieldName, field, options);

    // Check if this field should be the primary key
    if (
      fieldName.toLowerCase() === 'id' &&
      (field.type.toLowerCase() === 'uuid' || field.type.toLowerCase() === 'string')
    ) {
      prismaField.attributes.unshift('@id');
      hasPrimaryKey = true;
    }

    fields.push(prismaField);
  }

  // If no primary key found, add a default id field
  if (!hasPrimaryKey) {
    const idField: PrismaFieldOutput = {
      name: 'id',
      type: 'String',
      isOptional: false,
      isArray: false,
      attributes: ['@id', '@default(uuid())'],
    };
    fields.unshift(idField);
  }

  // Add unique constraints from directives
  if (schema.directives.index) {
    for (const index of schema.directives.index) {
      if (index.unique && index.fields.length > 1) {
        const fieldList = index.fields.map((f) => f).join(', ');
        blockAttributes.push(`@@unique([${fieldList}])`);
      }
    }
  }

  // Add indexes from directives
  if (schema.directives.index) {
    for (const index of schema.directives.index) {
      if (!index.unique && index.fields.length > 0) {
        const fieldList = index.fields.map((f) => f).join(', ');
        blockAttributes.push(`@@index([${fieldList}])`);
      }
    }
  }

  // Add table name mapping if requested
  if (options?.generateTableMaps) {
    const tableName = toSnakeCase(schema.name);
    if (tableName !== schema.name) {
      blockAttributes.push(`@@map("${tableName}")`);
    }
  }

  return {
    name: schema.name,
    fields,
    blockAttributes: blockAttributes.length > 0 ? blockAttributes : undefined,
  };
}

/**
 * Convert a string to snake_case.
 *
 * @param str - The input string
 * @returns The snake_case string
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

// =============================================================================
// Schema Generation
// =============================================================================

/**
 * Generate the datasource block for a Prisma schema.
 *
 * @param options - Export options
 * @returns The datasource block string
 */
export function generateDatasourceBlock(options?: PrismaExportOptions): string {
  const name = options?.datasourceName ?? 'db';
  const provider = options?.provider ?? 'postgresql';
  const url = options?.databaseUrl ?? 'env("DATABASE_URL")';

  const lines: string[] = [
    `datasource ${name} {`,
    `  provider = "${provider}"`,
    `  url      = ${url}`,
    '}',
  ];

  return lines.join('\n');
}

/**
 * Generate the generator block for a Prisma schema.
 *
 * @param options - Export options
 * @returns The generator block string
 */
export function generateGeneratorBlock(options?: PrismaExportOptions): string {
  const name = options?.generatorName ?? 'client';
  const provider = options?.generatorProvider ?? 'prisma-client-js';

  const lines: string[] = [
    `generator ${name} {`,
    `  provider = "${provider}"`,
  ];

  if (options?.previewFeatures && options.previewFeatures.length > 0) {
    const features = options.previewFeatures.map((f) => `"${f}"`).join(', ');
    lines.push(`  previewFeatures = [${features}]`);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Serialize a Prisma field to schema format.
 *
 * @param field - The Prisma field output
 * @returns The serialized field string
 */
export function serializePrismaField(field: PrismaFieldOutput): string {
  let typeStr = field.type;

  if (field.isArray) {
    typeStr = `${typeStr}[]`;
  } else if (field.isOptional) {
    typeStr = `${typeStr}?`;
  }

  const parts = [field.name, typeStr];

  if (field.attributes.length > 0) {
    parts.push(...field.attributes);
  }

  return parts.join(' ');
}

/**
 * Serialize a Prisma model to schema format.
 *
 * @param model - The Prisma model output
 * @returns The serialized model string
 */
export function serializePrismaModel(model: PrismaModelOutput): string {
  const lines: string[] = [`model ${model.name} {`];

  for (const field of model.fields) {
    lines.push(`  ${serializePrismaField(field)}`);
  }

  if (model.blockAttributes && model.blockAttributes.length > 0) {
    lines.push('');
    for (const attr of model.blockAttributes) {
      lines.push(`  ${attr}`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Serialize a Prisma enum to schema format.
 *
 * @param prismaEnum - The Prisma enum output
 * @returns The serialized enum string
 */
export function serializePrismaEnum(prismaEnum: PrismaEnumOutput): string {
  const lines: string[] = [`enum ${prismaEnum.name} {`];

  for (const value of prismaEnum.values) {
    lines.push(`  ${value}`);
  }

  lines.push('}');

  return lines.join('\n');
}

// =============================================================================
// Main Export Functions
// =============================================================================

/**
 * Transform an IceType schema to a Prisma schema string.
 *
 * @param schema - The IceType schema to transform
 * @param options - Export options
 * @returns The Prisma model string (without datasource/generator blocks)
 */
export function transformToPrisma(
  schema: IceTypeSchema,
  options?: PrismaExportOptions
): string {
  const model = schemaToPrismaModel(schema, options);
  return serializePrismaModel(model);
}

/**
 * Generate a complete Prisma schema file from one or more IceType schemas.
 *
 * @param schemas - The IceType schemas to transform
 * @param options - Export options
 * @returns The complete Prisma schema string
 */
export function generatePrismaSchema(
  schemas: IceTypeSchema[],
  options?: PrismaExportOptions
): string {
  const parts: string[] = [];

  // Add datasource block
  parts.push(generateDatasourceBlock(options));
  parts.push('');

  // Add generator block
  parts.push(generateGeneratorBlock(options));
  parts.push('');

  // Add model definitions
  for (const schema of schemas) {
    const model = schemaToPrismaModel(schema, options);
    parts.push(serializePrismaModel(model));
    parts.push('');
  }

  return parts.join('\n').trimEnd() + '\n';
}

/**
 * Generate Prisma schema output with structured data.
 *
 * @param schemas - The IceType schemas to transform
 * @param options - Export options
 * @returns The Prisma schema output object
 */
export function generatePrismaSchemaOutput(
  schemas: IceTypeSchema[],
  options?: PrismaExportOptions
): PrismaSchemaOutput {
  const models: PrismaModelOutput[] = [];
  const enums: PrismaEnumOutput[] = [];

  for (const schema of schemas) {
    models.push(schemaToPrismaModel(schema, options));
  }

  const schemaString = generatePrismaSchema(schemas, options);

  return {
    schema: schemaString,
    models,
    enums,
  };
}

// =============================================================================
// Prisma Adapter Class
// =============================================================================

/**
 * Adapter for transforming IceType schemas to Prisma schema format.
 *
 * Implements the SchemaAdapter interface for consistency with other adapters.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { PrismaAdapter } from '@icetype/prisma';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 * });
 *
 * const adapter = new PrismaAdapter();
 *
 * // Get Prisma model output
 * const model = adapter.transform(schema);
 *
 * // Serialize to Prisma schema string
 * const schemaString = adapter.serialize(model);
 * ```
 */
export class PrismaAdapter
  implements SchemaAdapter<PrismaModelOutput, PrismaExportOptions>
{
  readonly name = 'prisma';
  readonly version = VERSION;

  /**
   * Transform an IceType schema to a Prisma model output.
   *
   * @param schema - The IceType schema to transform
   * @param options - Optional Prisma export options
   * @returns Prisma model output
   */
  transform(
    schema: IceTypeSchema,
    options?: PrismaExportOptions
  ): PrismaModelOutput {
    return schemaToPrismaModel(schema, options);
  }

  /**
   * Serialize Prisma model output to a schema string.
   *
   * @param output - The Prisma model output to serialize
   * @returns Prisma model schema string
   */
  serialize(output: PrismaModelOutput): string {
    return serializePrismaModel(output);
  }

  /**
   * Generate a complete Prisma schema file from multiple IceType schemas.
   *
   * @param schemas - The IceType schemas to transform
   * @param options - Optional Prisma export options
   * @returns Complete Prisma schema string with datasource and generator blocks
   */
  generateSchema(
    schemas: IceTypeSchema[],
    options?: PrismaExportOptions
  ): string {
    return generatePrismaSchema(schemas, options);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new Prisma adapter instance.
 *
 * @returns A new PrismaAdapter instance
 */
export function createPrismaAdapter(): PrismaAdapter {
  return new PrismaAdapter();
}
