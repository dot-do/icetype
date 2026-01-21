/**
 * Prisma schema parser and IceType converter
 *
 * This module provides functionality to parse Prisma schema files (.prisma)
 * and convert them to IceType schema definitions.
 *
 * @example
 * ```typescript
 * import { parsePrismaSchema, parsePrismaFile } from '@icetype/prisma';
 *
 * // Parse a Prisma schema string
 * const schemas = parsePrismaSchema(`
 *   model User {
 *     id    String @id @default(uuid())
 *     email String @unique
 *     posts Post[]
 *   }
 * `);
 *
 * // Parse a Prisma schema file
 * const fileSchemas = await parsePrismaFile('./schema.prisma');
 * ```
 *
 * @packageDocumentation
 */

import { readFile } from 'node:fs/promises';
import type {
  PrismaField,
  PrismaModel,
  PrismaEnum,
  PrismaAttribute,
  ParsedPrismaSchema,
  IceTypeSchemaDefinition,
  PrismaImportOptions,
} from './types.js';
import { PRISMA_TO_ICETYPE_MAP } from './types.js';

// =============================================================================
// Regular Expressions for Parsing
// =============================================================================

/**
 * Regex to match a Prisma model definition
 * Captures: model name, model body
 */
const MODEL_REGEX = /model\s+(\w+)\s*\{([^}]*)\}/gs;

/**
 * Regex to match a Prisma enum definition
 * Captures: enum name, enum body
 */
const ENUM_REGEX = /enum\s+(\w+)\s*\{([^}]*)\}/gs;

/**
 * Regex to match a single Prisma field line
 * Captures: field name, type, array marker, optional marker, attributes
 */
const FIELD_REGEX = /^\s*(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*?)\s*$/;

// =============================================================================
// Prisma Schema Parsing
// =============================================================================

/**
 * Parse a single Prisma attribute string
 *
 * @param name - Attribute name
 * @param argsStr - Attribute arguments string
 * @returns Parsed attribute object
 */
function parseAttribute(name: string, argsStr?: string): PrismaAttribute {
  const attr: PrismaAttribute = { name };

  if (argsStr) {
    // Parse attribute arguments
    // Handle complex cases like: @relation(fields: [userId], references: [id])
    const args: string[] = [];

    // Simple case: single argument like @default(uuid()) or @default("active")
    if (!argsStr.includes(':')) {
      args.push(argsStr.trim());
    } else {
      // Complex case: named arguments
      // For now, store the entire string as a single arg
      args.push(argsStr.trim());
    }

    if (args.length > 0) {
      attr.args = args;
    }
  }

  return attr;
}

/**
 * Find the matching closing parenthesis for a given opening parenthesis
 *
 * @param str - String to search
 * @param startIdx - Index of the opening parenthesis
 * @returns Index of the matching closing parenthesis, or -1 if not found
 */
function findMatchingParen(str: string, startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '(') {
      depth++;
    } else if (str[i] === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Parse attributes from a field line
 *
 * Handles nested parentheses like @default(uuid()) correctly.
 *
 * @param attributeStr - String containing attributes (e.g., "@id @default(uuid())")
 * @returns Array of parsed attributes
 */
function parseAttributes(attributeStr: string): PrismaAttribute[] {
  const attributes: PrismaAttribute[] = [];
  let i = 0;

  while (i < attributeStr.length) {
    // Find next @
    const atIdx = attributeStr.indexOf('@', i);
    if (atIdx === -1) {
      break;
    }

    // Find the attribute name (word characters after @)
    let nameEnd = atIdx + 1;
    while (nameEnd < attributeStr.length && /\w/.test(attributeStr[nameEnd]!)) {
      nameEnd++;
    }

    const name = attributeStr.slice(atIdx + 1, nameEnd);
    if (!name) {
      i = nameEnd;
      continue;
    }

    // Check if there are arguments
    let args: string | undefined;
    if (attributeStr[nameEnd] === '(') {
      const closeIdx = findMatchingParen(attributeStr, nameEnd);
      if (closeIdx !== -1) {
        args = attributeStr.slice(nameEnd + 1, closeIdx);
        i = closeIdx + 1;
      } else {
        i = nameEnd;
      }
    } else {
      i = nameEnd;
    }

    attributes.push(parseAttribute(name, args));
  }

  return attributes;
}

/**
 * Parse a single Prisma field definition line
 *
 * @param line - Field definition line
 * @returns Parsed field object or null if line is not a valid field
 */
function parseField(line: string): PrismaField | null {
  const trimmed = line.trim();

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) {
    return null;
  }

  const match = FIELD_REGEX.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, name, type, arrayMarker, optionalMarker, attributesStr] = match;

  if (!name || !type) {
    return null;
  }

  return {
    name,
    type,
    isArray: arrayMarker === '[]',
    isOptional: optionalMarker === '?',
    attributes: parseAttributes(attributesStr ?? ''),
  };
}

/**
 * Parse a Prisma model body into fields
 *
 * @param body - Model body string (content between braces)
 * @returns Array of parsed fields
 */
function parseModelBody(body: string): PrismaField[] {
  const lines = body.split('\n');
  const fields: PrismaField[] = [];

  for (const line of lines) {
    const field = parseField(line);
    if (field) {
      fields.push(field);
    }
  }

  return fields;
}

/**
 * Parse a Prisma enum body into values
 *
 * @param body - Enum body string (content between braces)
 * @returns Array of enum values
 */
function parseEnumBody(body: string): string[] {
  const lines = body.split('\n');
  const values: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (trimmed && !trimmed.startsWith('//')) {
      values.push(trimmed);
    }
  }

  return values;
}

/**
 * Parse all models from a Prisma schema string
 *
 * @param content - Prisma schema content
 * @returns Array of parsed models
 */
function parseModels(content: string): PrismaModel[] {
  const models: PrismaModel[] = [];

  // Reset regex lastIndex
  MODEL_REGEX.lastIndex = 0;

  let match;
  while ((match = MODEL_REGEX.exec(content)) !== null) {
    const [, name, body] = match;
    if (name && body) {
      models.push({
        name,
        fields: parseModelBody(body),
      });
    }
  }

  return models;
}

/**
 * Parse all enums from a Prisma schema string
 *
 * @param content - Prisma schema content
 * @returns Array of parsed enums
 */
function parseEnums(content: string): PrismaEnum[] {
  const enums: PrismaEnum[] = [];

  // Reset regex lastIndex
  ENUM_REGEX.lastIndex = 0;

  let match;
  while ((match = ENUM_REGEX.exec(content)) !== null) {
    const [, name, body] = match;
    if (name && body) {
      enums.push({
        name,
        values: parseEnumBody(body),
      });
    }
  }

  return enums;
}

/**
 * Parse a complete Prisma schema string
 *
 * @param content - Prisma schema content
 * @returns Parsed schema with models and enums
 */
export function parsePrismaSchemaRaw(content: string): ParsedPrismaSchema {
  return {
    models: parseModels(content),
    enums: parseEnums(content),
  };
}

// =============================================================================
// IceType Conversion
// =============================================================================

/**
 * Check if a field has a specific attribute
 *
 * @param field - Prisma field
 * @param attrName - Attribute name to check
 * @returns True if field has the attribute
 */
function hasAttribute(field: PrismaField, attrName: string): boolean {
  return field.attributes.some(attr => attr.name === attrName);
}

/**
 * Get the argument of a specific attribute
 *
 * @param field - Prisma field
 * @param attrName - Attribute name
 * @returns Attribute arguments or undefined
 */
function getAttributeArgs(field: PrismaField, attrName: string): string[] | undefined {
  const attr = field.attributes.find(a => a.name === attrName);
  return attr?.args;
}

/** Prisma scalar type names that can be converted to IceType */
type PrismaScalarType = keyof typeof PRISMA_TO_ICETYPE_MAP;

/**
 * Check if a type is a Prisma scalar type
 *
 * This is a type guard that narrows the type to PrismaScalarType.
 *
 * @param type - Type name
 * @returns True if type is a scalar
 */
function isScalarType(type: string): type is PrismaScalarType {
  return type in PRISMA_TO_ICETYPE_MAP;
}

/**
 * Convert a Prisma type to IceType
 *
 * @param type - Prisma type name
 * @param customMappings - Optional custom type mappings
 * @returns IceType type name
 */
function convertType(type: string, customMappings?: Record<string, string>): string {
  // Check custom mappings first
  if (customMappings && type in customMappings) {
    return customMappings[type]!;
  }

  // Check default mappings
  if (type in PRISMA_TO_ICETYPE_MAP) {
    return PRISMA_TO_ICETYPE_MAP[type]!;
  }

  // Return as-is for model references (relations)
  return type;
}

/**
 * Determine the default value expression for IceType
 *
 * @param args - Default attribute arguments
 * @returns IceType default value string or undefined
 */
function convertDefaultValue(args: string[] | undefined): string | undefined {
  if (!args || args.length === 0) {
    return undefined;
  }

  const arg = args[0];
  if (!arg) {
    return undefined;
  }

  // Handle common Prisma default functions
  if (arg === 'uuid()') {
    return 'uuid()';
  }
  if (arg === 'cuid()') {
    return 'cuid()';
  }
  if (arg === 'now()') {
    return 'now()';
  }
  if (arg === 'autoincrement()') {
    return 'autoincrement()';
  }
  if (arg === 'true' || arg === 'false') {
    return arg;
  }

  // Handle string literals
  if (arg.startsWith('"') && arg.endsWith('"')) {
    return arg;
  }

  // Handle number literals
  if (!isNaN(Number(arg))) {
    return arg;
  }

  // Return as-is for other cases
  return arg;
}

/**
 * Convert a Prisma field to IceType field definition string
 *
 * @param field - Prisma field
 * @param options - Import options
 * @param parsedSchema - Full parsed schema for relation resolution
 * @returns IceType field type string or null if field should be skipped
 */
function convertField(
  field: PrismaField,
  options: PrismaImportOptions,
  parsedSchema: ParsedPrismaSchema
): string | null {
  const isId = hasAttribute(field, 'id');
  const isUnique = hasAttribute(field, 'unique');
  const defaultArgs = getAttributeArgs(field, 'default');
  // Note: hasRelation attribute is used to detect explicit @relation but we detect
  // relations by non-scalar type, so we don't need to check it explicitly

  // Check if this is a relation field (non-scalar type or has @relation)
  const isRelationType = !isScalarType(field.type);
  const enumDef = parsedSchema.enums.find(e => e.name === field.type);

  // Handle relations
  if (isRelationType && !enumDef) {
    if (!options.includeRelations) {
      return null;
    }

    // Convert to IceType relation syntax
    if (field.isArray) {
      // Array relation: Post[] -> [Post]
      return `[${field.type}]`;
    } else if (field.isOptional) {
      // Optional single relation: User? -> User?
      return `${field.type}?`;
    } else {
      // Required single relation: User -> User!
      return `${field.type}!`;
    }
  }

  // Handle enums
  if (enumDef) {
    // For now, treat enums as strings with the enum type name
    const baseType = `enum<${field.type}>`;
    return buildTypeString(baseType, field, isId, isUnique, options, defaultArgs);
  }

  // Get the base IceType type
  const baseType = convertType(field.type, options.customTypeMappings);

  return buildTypeString(baseType, field, isId, isUnique, options, defaultArgs);
}

/**
 * Build the complete IceType type string with modifiers
 *
 * @param baseType - Base type name
 * @param field - Original Prisma field
 * @param isId - Whether field is @id
 * @param isUnique - Whether field is @unique
 * @param options - Import options
 * @param defaultArgs - Default value arguments
 * @returns Complete IceType type string
 */
function buildTypeString(
  baseType: string,
  field: PrismaField,
  isId: boolean,
  isUnique: boolean,
  options: PrismaImportOptions,
  defaultArgs?: string[]
): string {
  let result = baseType;

  // Handle array types
  if (field.isArray) {
    result = `[${result}]`;
  }

  // Add modifiers
  if (isId) {
    // ID fields are required and typically unique
    // For IceType, we use ! for required and # for unique/indexed
    result += '!';
    if (options.convertUniqueToIndexed !== false) {
      result += '#';
    }
  } else if (isUnique) {
    // Unique but not ID - required unless optional
    if (!field.isOptional) {
      result += '!';
    }
    if (options.convertUniqueToIndexed !== false) {
      result += '#';
    }
  } else if (field.isOptional) {
    // Optional field
    result += '?';
  } else {
    // Required field (no ? in Prisma means required)
    result += '!';
  }

  // Handle default values
  const defaultValue = convertDefaultValue(defaultArgs);
  if (defaultValue) {
    result += ` = ${defaultValue}`;
  }

  return result;
}

/**
 * Convert a Prisma model to IceType schema definition
 *
 * @param model - Prisma model
 * @param options - Import options
 * @param parsedSchema - Full parsed schema for relation resolution
 * @returns IceType schema definition object
 */
function convertModel(
  model: PrismaModel,
  options: PrismaImportOptions,
  parsedSchema: ParsedPrismaSchema
): IceTypeSchemaDefinition {
  const schema: IceTypeSchemaDefinition = {
    $type: model.name,
  };

  // Track unique fields for potential $index directive
  const uniqueFields: string[] = [];
  const idFields: string[] = [];

  for (const field of model.fields) {
    const typeStr = convertField(field, options, parsedSchema);

    if (typeStr !== null) {
      schema[field.name] = typeStr;

      // Track special fields
      if (hasAttribute(field, 'id')) {
        idFields.push(field.name);
      }
      if (hasAttribute(field, 'unique')) {
        uniqueFields.push(field.name);
      }
    }
  }

  // Add indexes if we have unique fields (optional)
  // Note: IceType uses # in type strings for unique, so we may not need $index
  // But we can add composite indexes from @@unique() if present

  return schema;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse a Prisma schema string and convert to IceType schema definitions
 *
 * @param prismaContent - Prisma schema content string
 * @param options - Import options
 * @returns Array of IceType schema definitions
 *
 * @example
 * ```typescript
 * const schemas = parsePrismaSchema(`
 *   model User {
 *     id    String @id @default(uuid())
 *     email String @unique
 *     name  String?
 *     posts Post[]
 *   }
 *
 *   model Post {
 *     id       String @id @default(uuid())
 *     title    String
 *     content  String?
 *     author   User   @relation(fields: [authorId], references: [id])
 *     authorId String
 *   }
 * `);
 *
 * // Result:
 * // [
 * //   { $type: 'User', id: 'uuid!#', email: 'string!#', name: 'string?', posts: '[Post]' },
 * //   { $type: 'Post', id: 'uuid!#', title: 'string!', content: 'string?', author: 'User!', authorId: 'string!' }
 * // ]
 * ```
 */
export function parsePrismaSchema(
  prismaContent: string,
  options: PrismaImportOptions = {}
): IceTypeSchemaDefinition[] {
  // Set default options
  const opts: PrismaImportOptions = {
    includeRelations: true,
    convertUniqueToIndexed: true,
    includeNativeTypeComments: false,
    ...options,
  };

  // Parse the Prisma schema
  const parsed = parsePrismaSchemaRaw(prismaContent);

  // Convert each model to IceType
  const schemas: IceTypeSchemaDefinition[] = [];

  for (const model of parsed.models) {
    schemas.push(convertModel(model, opts, parsed));
  }

  return schemas;
}

/**
 * Parse a Prisma schema file and convert to IceType schema definitions
 *
 * @param filePath - Path to the Prisma schema file
 * @param options - Import options
 * @returns Promise resolving to array of IceType schema definitions
 *
 * @example
 * ```typescript
 * const schemas = await parsePrismaFile('./prisma/schema.prisma');
 * ```
 */
export async function parsePrismaFile(
  filePath: string,
  options: PrismaImportOptions = {}
): Promise<IceTypeSchemaDefinition[]> {
  const content = await readFile(filePath, 'utf-8');
  return parsePrismaSchema(content, options);
}

/**
 * Get the raw parsed Prisma schema without IceType conversion
 *
 * Useful for inspection or custom conversion logic.
 *
 * @param prismaContent - Prisma schema content string
 * @returns Parsed Prisma schema with models and enums
 */
export function parsePrismaSchemaToAst(prismaContent: string): ParsedPrismaSchema {
  return parsePrismaSchemaRaw(prismaContent);
}

/**
 * Convert a single Prisma model string to IceType
 *
 * @param modelString - Single model definition string
 * @param options - Import options
 * @returns IceType schema definition or null if parsing fails
 */
export function convertPrismaModel(
  modelString: string,
  options: PrismaImportOptions = {}
): IceTypeSchemaDefinition | null {
  const schemas = parsePrismaSchema(modelString, options);
  return schemas[0] ?? null;
}
