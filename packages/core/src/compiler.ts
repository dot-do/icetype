/**
 * GraphDL-based Compiler
 *
 * Compiles @graphdl/core ParsedGraph schemas to various backend formats.
 * This is the new entry point for IceType compilation using GraphDL as the
 * schema definition layer.
 *
 * @example
 * ```typescript
 * import { Graph } from '@graphdl/core';
 * import { compile, graphToIceType } from '@icetype/core';
 *
 * const graph = Graph({
 *   User: {
 *     $type: 'https://schema.org/Person',
 *     $partitionBy: ['tenantId'],
 *     name: 'string',
 *     email: 'string!',
 *     tenantId: 'string',
 *   },
 * });
 *
 * // Convert to IceType schemas
 * const schemas = graphToIceType(graph);
 *
 * // Or compile to a specific target
 * const result = compile(graph, 'iceberg', {
 *   location: 's3://bucket/tables/users',
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { ParsedGraph, ParsedEntity, ParsedField, EntityDirectives } from '@graphdl/core';
import type {
  IceTypeSchema,
  FieldDefinition,
  FieldModifier,
  RelationDefinition,
  RelationOperator,
  SchemaDirectives,
  IndexDirective,
  VectorDirective,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported compilation targets
 */
export type CompileTarget = 'iceberg' | 'parquet' | 'clickhouse' | 'duckdb' | 'postgres' | 'mysql' | 'sqlite';

/**
 * Options for compilation
 */
export interface CompileOptions {
  /** Target-specific options */
  [key: string]: unknown;

  /** Location for Iceberg tables (required for iceberg target) */
  location?: string;

  /** Additional table properties */
  properties?: Record<string, string>;
}

/**
 * Result of compiling a ParsedGraph
 */
export interface CompileResult {
  /** The compilation target */
  target: CompileTarget;

  /** Converted IceType schemas */
  schemas: Map<string, IceTypeSchema>;

  /** Target-specific output (e.g., SQL statements, metadata objects) */
  output?: Map<string, unknown>;
}

/**
 * Result of compiling a single ParsedEntity
 */
export interface CompileEntityResult {
  /** The compilation target */
  target: CompileTarget;

  /** Converted IceType schema */
  schema: IceTypeSchema;

  /** Target-specific output */
  output?: unknown;
}

// =============================================================================
// Type Aliases
// =============================================================================

/**
 * Type aliases for GraphDL to IceType mapping.
 *
 * GraphDL uses some types that need to be mapped to IceType equivalents:
 * - `datetime` -> `timestamp` (IceType uses timestamp for date+time)
 * - `markdown` -> `text` (IceType stores markdown as text)
 */
export const GRAPHDL_TYPE_ALIASES: Record<string, string> = {
  datetime: 'timestamp',
  markdown: 'text',
  number: 'double', // GraphDL's `number` maps to double precision
  url: 'string',
  email: 'string',
};

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert a GraphDL type to an IceType type string.
 *
 * @param graphdlType - The GraphDL type string
 * @returns The equivalent IceType type string
 */
function convertType(graphdlType: string): string {
  const normalized = graphdlType.toLowerCase();
  return GRAPHDL_TYPE_ALIASES[normalized] ?? normalized;
}

/**
 * Parse modifiers from a type string.
 *
 * This handles cases where GraphDL hasn't stripped the modifiers from the type.
 * Modifiers are parsed from the end: !, #, ?, []
 *
 * @param typeStr - The type string potentially with modifiers
 * @returns Object with cleaned type and modifier flags
 */
function parseTypeModifiers(typeStr: string): {
  type: string;
  isRequired: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  isOptional: boolean;
  isArray: boolean;
} {
  let type = typeStr;
  let isRequired = false;
  let isUnique = false;
  let isIndexed = false;
  let isOptional = false;
  let isArray = false;

  // Parse modifiers from the end in any order
  let parsing = true;
  while (parsing && type.length > 0) {
    if (type.endsWith('#')) {
      isIndexed = true;
      type = type.slice(0, -1);
    } else if (type.endsWith('!')) {
      isRequired = true;
      isUnique = true;
      type = type.slice(0, -1);
    } else if (type.endsWith('?')) {
      isOptional = true;
      type = type.slice(0, -1);
    } else if (type.endsWith('[]')) {
      isArray = true;
      type = type.slice(0, -2);
    } else {
      parsing = false;
    }
  }

  return { type, isRequired, isUnique, isIndexed, isOptional, isArray };
}

/**
 * Convert a ParsedField to a FieldDefinition.
 *
 * @param field - The GraphDL parsed field
 * @returns The IceType field definition
 */
function fieldToDefinition(field: ParsedField): FieldDefinition {
  // Parse modifiers from the type string (handles both old and new GraphDL versions)
  const parsed = parseTypeModifiers(field.type);

  // Merge parsed modifiers with field flags (field flags take precedence if set)
  const isRequired = field.isRequired ?? parsed.isRequired;
  const isUnique = field.isUnique ?? parsed.isUnique;
  const isIndexed = field.isIndexed ?? parsed.isIndexed;
  const isOptional = field.isOptional || parsed.isOptional;
  const isArray = field.isArray || parsed.isArray;

  // Convert the type, using the cleaned version
  const type = convertType(parsed.type);

  let modifier: FieldModifier = '';
  if (isRequired) {
    modifier = '!';
  } else if (isIndexed) {
    modifier = '#';
  } else if (isOptional) {
    modifier = '?';
  }

  const definition: FieldDefinition = {
    name: field.name,
    type,
    modifier,
    isArray,
    isOptional,
    isUnique,
    isIndexed,
  };

  // Extract extended fields from ParsedField.
  // GraphDL may not yet declare these in its type definition, so we access
  // them via a Record cast for forward-compatibility.
  const ext = field as unknown as Record<string, unknown>;

  // Parametric type fields
  if (ext.precision != null) definition.precision = ext.precision as number;
  if (ext.scale != null) definition.scale = ext.scale as number;
  if (ext.length != null) definition.length = ext.length as number;

  // Generic type fields
  if (ext.keyType != null) definition.keyType = ext.keyType as string;
  if (ext.valueType != null) definition.valueType = ext.valueType as string;
  if (ext.structName != null) definition.structName = ext.structName as string;
  if (ext.enumName != null) definition.enumName = ext.enumName as string;
  if (ext.refTarget != null) definition.refTarget = ext.refTarget as string;
  if (ext.elementType != null) definition.elementType = ext.elementType as string;

  // Default value (field.default -> definition.defaultValue)
  if ('default' in ext && ext.default !== undefined) {
    definition.defaultValue = ext.default;
  }

  // Handle relations
  if (field.isRelation && field.relatedType) {
    const operator = field.operator ?? '->';
    const relation: RelationDefinition = {
      operator: operator as RelationOperator,
      targetType: field.relatedType,
    };
    if (field.backref) {
      relation.inverse = field.backref;
    }
    definition.relation = relation;
  }

  return definition;
}

/**
 * Get a directive value from EntityDirectives, trying both with and without $ prefix.
 */
function getDirective<T>(directives: EntityDirectives, name: string): T | undefined {
  // Try with $ prefix first (standard GraphDL format)
  if (`$${name}` in directives) {
    return directives[`$${name}`] as T;
  }
  // Also try without prefix for flexibility
  if (name in directives) {
    return directives[name] as T;
  }
  return undefined;
}

/**
 * Convert EntityDirectives to SchemaDirectives.
 *
 * @param directives - The GraphDL entity directives
 * @returns The IceType schema directives
 */
function convertDirectives(directives?: EntityDirectives): SchemaDirectives {
  if (!directives) {
    return {};
  }

  const result: SchemaDirectives = {};

  // $partitionBy
  const partitionBy = getDirective<unknown>(directives, 'partitionBy');
  if (partitionBy) {
    if (Array.isArray(partitionBy) && partitionBy.every((v): v is string => typeof v === 'string')) {
      result.partitionBy = partitionBy;
    }
  }

  // $index
  const index = getDirective<unknown>(directives, 'index');
  if (index) {
    if (
      Array.isArray(index) &&
      index.every((v): v is string[] => Array.isArray(v) && v.every((s): s is string => typeof s === 'string'))
    ) {
      result.index = index.map(
        (fields): IndexDirective => ({
          fields,
          unique: false,
        })
      );
    }
  }

  // $fts
  const fts = getDirective<unknown>(directives, 'fts');
  if (fts) {
    if (Array.isArray(fts) && fts.every((v): v is string => typeof v === 'string')) {
      result.fts = fts;
    }
  }

  // $vector
  const vector = getDirective<unknown>(directives, 'vector');
  if (vector) {
    if (typeof vector === 'object' && vector !== null && !Array.isArray(vector)) {
      const vectorDirs: VectorDirective[] = [];
      for (const [field, dims] of Object.entries(vector)) {
        if (typeof dims === 'number') {
          vectorDirs.push({
            field,
            dimensions: dims,
          });
        }
      }
      if (vectorDirs.length > 0) {
        result.vector = vectorDirs;
      }
    }
  }

  return result;
}

/**
 * Convert a ParsedEntity to an IceTypeSchema.
 *
 * @param entity - The GraphDL parsed entity
 * @returns The IceType schema
 */
export function entityToIceType(entity: ParsedEntity): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  const relations = new Map<string, RelationDefinition>();

  for (const [fieldName, field] of entity.fields) {
    const definition = fieldToDefinition(field);
    fields.set(fieldName, definition);

    if (definition.relation) {
      relations.set(fieldName, definition.relation);
    }
  }

  const directives = convertDirectives(entity.directives);
  const now = Date.now();

  return {
    name: entity.name,
    fields,
    directives,
    relations,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert a ParsedGraph to a map of IceTypeSchemas.
 *
 * This is the main conversion function for transforming GraphDL schemas
 * to IceType schemas.
 *
 * @param graph - The GraphDL parsed graph
 * @returns Map of entity name to IceType schema
 *
 * @example
 * ```typescript
 * import { Graph } from '@graphdl/core';
 * import { graphToIceType } from '@icetype/core';
 *
 * const graph = Graph({
 *   User: {
 *     name: 'string',
 *     email: 'string!',
 *   },
 * });
 *
 * const schemas = graphToIceType(graph);
 * const userSchema = schemas.get('User');
 * ```
 */
export function graphToIceType(graph: ParsedGraph): Map<string, IceTypeSchema> {
  const schemas = new Map<string, IceTypeSchema>();

  for (const [entityName, entity] of graph.entities) {
    schemas.set(entityName, entityToIceType(entity));
  }

  return schemas;
}

// =============================================================================
// Compiler Functions
// =============================================================================

/**
 * Compile a ParsedGraph to a specific target format.
 *
 * This function converts a GraphDL ParsedGraph to IceType schemas and
 * then routes to the appropriate adapter for the target format.
 *
 * @param graph - The GraphDL parsed graph
 * @param target - The compilation target (iceberg, parquet, etc.)
 * @param options - Target-specific options
 * @returns Compilation result with schemas and target-specific output
 *
 * @example
 * ```typescript
 * import { Graph } from '@graphdl/core';
 * import { compile } from '@icetype/core';
 *
 * const graph = Graph({
 *   User: {
 *     $partitionBy: ['tenantId'],
 *     name: 'string',
 *     tenantId: 'string',
 *   },
 * });
 *
 * const result = compile(graph, 'iceberg', {
 *   location: 's3://bucket/tables/users',
 * });
 * ```
 */
export function compile(graph: ParsedGraph, target: CompileTarget, _options?: CompileOptions): CompileResult {
  // Convert GraphDL to IceType schemas
  const schemas = graphToIceType(graph);

  // Return the result with converted schemas
  // Target-specific compilation will be handled by adapters
  return {
    target,
    schemas,
    // Output will be populated by target-specific adapters when needed
    output: new Map(),
  };
}

/**
 * Compile a single ParsedEntity to a specific target format.
 *
 * @param entity - The GraphDL parsed entity
 * @param target - The compilation target
 * @param options - Target-specific options
 * @returns Compilation result with schema and target-specific output
 *
 * @example
 * ```typescript
 * import { Graph, getEntity } from '@graphdl/core';
 * import { compileEntity } from '@icetype/core';
 *
 * const graph = Graph({
 *   User: { name: 'string' },
 * });
 *
 * const userEntity = getEntity(graph, 'User')!;
 * const result = compileEntity(userEntity, 'postgres');
 * ```
 */
export function compileEntity(
  entity: ParsedEntity,
  target: CompileTarget,
  _options?: CompileOptions
): CompileEntityResult {
  const schema = entityToIceType(entity);

  return {
    target,
    schema,
    // Output will be populated by target-specific adapters when needed
  };
}
