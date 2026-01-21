/**
 * IceType Projection Directives
 *
 * Projections allow defining denormalized/materialized views of source entities
 * for OLAP workloads, with automatic flattening of relations.
 *
 * Directives:
 * - $projection: 'oltp' | 'olap' | 'both' - Type of projection
 * - $from: string - Source entity name to project from
 * - $expand: string[] - Relations to flatten (e.g., ['user', 'items.product'])
 * - $flatten: Record<string, string> - Explicit field mappings (e.g., { user_email: 'user.email' })
 *
 * @packageDocumentation
 */

import { ParseError } from './errors.js';
import type { IceTypeSchema, SchemaDefinition, ValidationResult, ValidationError } from './types.js';

// =============================================================================
// Types
// =============================================================================

/** Valid projection types */
export type ProjectionType = 'oltp' | 'olap' | 'both';

/** Projection directive configuration */
export interface ProjectionDirectives {
  /** Type of projection: oltp (low-latency), olap (analytics), or both */
  projection: ProjectionType;
  /** Source entity name to project from */
  from?: string;
  /** Relations to flatten: ['user', 'items.product'] */
  expand?: string[];
  /** Explicit field mappings: { user_email: 'user.email' } */
  flatten?: Record<string, string>;
}

/** Extended schema definition with projection directives */
export interface ProjectionSchemaDefinition extends SchemaDefinition {
  $projection?: ProjectionType | string;
  $from?: string;
  $expand?: string[];
  $flatten?: Record<string, string>;
}

// =============================================================================
// Constants
// =============================================================================

/** Valid projection type values */
const VALID_PROJECTION_TYPES: ProjectionType[] = ['oltp', 'olap', 'both'];

// =============================================================================
// Parsing Functions
// =============================================================================

/**
 * Parse projection directives from a schema definition.
 *
 * @param definition - The schema definition object
 * @returns The parsed projection directives, or null if not a projection
 * @throws ParseError if projection directives are invalid
 *
 * @example
 * ```typescript
 * const directives = parseProjectionDirectives({
 *   $type: 'OrderView',
 *   $projection: 'olap',
 *   $from: 'Order',
 *   $expand: ['user', 'items.product'],
 *   $flatten: { user_email: 'user.email' },
 * });
 * // { projection: 'olap', from: 'Order', expand: ['user', ...], flatten: {...} }
 * ```
 */
export function parseProjectionDirectives(
  definition: ProjectionSchemaDefinition
): ProjectionDirectives | null {
  const projectionValue = definition.$projection;

  // Not a projection if $projection is not present
  if (projectionValue === undefined) {
    return null;
  }

  // Validate $projection type
  if (typeof projectionValue !== 'string') {
    throw new ParseError('$projection must be a string', {
      path: '$projection',
      code: 'INVALID_PROJECTION_TYPE',
    });
  }

  if (!VALID_PROJECTION_TYPES.includes(projectionValue as ProjectionType)) {
    throw new ParseError(
      `Invalid $projection value: '${projectionValue}'. Must be one of: ${VALID_PROJECTION_TYPES.join(', ')}`,
      {
        path: '$projection',
        code: 'INVALID_PROJECTION_VALUE',
      }
    );
  }

  const result: ProjectionDirectives = {
    projection: projectionValue as ProjectionType,
  };

  // Parse $from
  if (definition.$from !== undefined) {
    if (typeof definition.$from !== 'string') {
      throw new ParseError('$from must be a string (source entity name)', {
        path: '$from',
        code: 'INVALID_FROM_TYPE',
      });
    }
    result.from = definition.$from;
  }

  // Parse $expand
  if (definition.$expand !== undefined) {
    if (!Array.isArray(definition.$expand)) {
      throw new ParseError('$expand must be an array of relation paths', {
        path: '$expand',
        code: 'INVALID_EXPAND_TYPE',
      });
    }

    for (let i = 0; i < definition.$expand.length; i++) {
      const path = definition.$expand[i];
      if (typeof path !== 'string') {
        throw new ParseError(`$expand[${i}] must be a string (relation path)`, {
          path: `$expand[${i}]`,
          code: 'INVALID_EXPAND_ELEMENT',
        });
      }
    }

    result.expand = definition.$expand;
  }

  // Parse $flatten
  if (definition.$flatten !== undefined) {
    if (
      typeof definition.$flatten !== 'object' ||
      definition.$flatten === null ||
      Array.isArray(definition.$flatten)
    ) {
      throw new ParseError('$flatten must be an object mapping field names to paths', {
        path: '$flatten',
        code: 'INVALID_FLATTEN_TYPE',
      });
    }

    for (const [key, value] of Object.entries(definition.$flatten)) {
      if (typeof value !== 'string') {
        throw new ParseError(`$flatten.${key} must be a string (source path)`, {
          path: `$flatten.${key}`,
          code: 'INVALID_FLATTEN_VALUE',
        });
      }
    }

    result.flatten = definition.$flatten;
  }

  return result;
}

// =============================================================================
// Type Guards
// =============================================================================

/** IceType schema with projection directives */
export interface ProjectionSchema extends IceTypeSchema {
  directives: SchemaDirectivesWithProjection;
}

/**
 * Check if a schema is a projection (has $projection directive).
 *
 * This is a type guard that narrows the schema to ProjectionSchema,
 * giving access to projection-specific directives.
 *
 * @param schema - The IceType schema to check
 * @returns True if the schema is a projection
 *
 * @example
 * ```typescript
 * const schema = parseSchema({
 *   $type: 'UserView',
 *   $projection: 'olap',
 *   $from: 'User',
 * });
 *
 * if (isProjection(schema)) {
 *   // TypeScript now knows schema is ProjectionSchema
 *   console.log('Projection type:', schema.directives.projection);
 * }
 * ```
 */
export function isProjection(schema: IceTypeSchema): schema is ProjectionSchema {
  // Check if the schema has projection directives stored
  const directives = schema.directives as SchemaDirectivesWithProjection | undefined;
  return directives?.projection !== undefined;
}

/**
 * Get the source entity name for a projection schema.
 *
 * @param schema - The IceType schema
 * @returns The source entity name, or undefined if not a projection or no source
 *
 * @example
 * ```typescript
 * const source = getProjectionSource(schema);
 * if (source) {
 *   console.log(`Projection is based on: ${source}`);
 * }
 * ```
 */
export function getProjectionSource(schema: IceTypeSchema): string | undefined {
  const directives = schema.directives as SchemaDirectivesWithProjection | undefined;
  return directives?.from;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a projection schema against the full schema registry.
 *
 * Validates:
 * - Source entity ($from) exists in the registry
 * - Expand paths ($expand) exist as fields/relations in the source schema
 *
 * @param schema - The projection schema to validate
 * @param allSchemas - Map of all schemas by name
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateProjection(viewSchema, schemaMap);
 * if (!result.valid) {
 *   console.error('Projection validation failed:', result.errors);
 * }
 * ```
 */
export function validateProjection(
  schema: IceTypeSchema,
  allSchemas: Map<string, IceTypeSchema>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check if this is a projection schema
  if (!isProjection(schema)) {
    // Not a projection, nothing to validate
    return { valid: true, errors: [], warnings: [] };
  }

  const directives = schema.directives as SchemaDirectivesWithProjection;
  const sourceEntityName = directives.from;

  // Validate source entity exists
  if (sourceEntityName !== undefined) {
    const sourceSchema = allSchemas.get(sourceEntityName);
    if (!sourceSchema) {
      errors.push({
        path: '$from',
        message: `Source entity '${sourceEntityName}' does not exist`,
        code: 'UNKNOWN_SOURCE_ENTITY',
      });
    } else {
      // Validate expand paths if source exists
      const expandPaths = directives.expand;
      if (expandPaths) {
        for (const path of expandPaths) {
          const validationError = validateExpandPath(path, sourceSchema, allSchemas);
          if (validationError) {
            errors.push(validationError);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a single expand path against the source schema.
 *
 * @param path - The expand path (e.g., 'user' or 'items.product.category')
 * @param sourceSchema - The source schema to validate against
 * @param allSchemas - Map of all schemas for following relations
 * @returns ValidationError if invalid, null if valid
 */
function validateExpandPath(
  path: string,
  sourceSchema: IceTypeSchema,
  allSchemas: Map<string, IceTypeSchema>
): ValidationError | null {
  const parts = path.split('.');
  let currentSchema = sourceSchema;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const field = currentSchema.fields.get(part);
    const relation = currentSchema.relations.get(part);

    if (!field && !relation) {
      return {
        path: `$expand.${path}`,
        message: `Expand path '${path}' is invalid: field '${part}' does not exist in '${currentSchema.name}'`,
        code: 'UNKNOWN_EXPAND_PATH',
      };
    }

    // If this is not the last part, follow the relation
    if (i < parts.length - 1) {
      if (!relation) {
        return {
          path: `$expand.${path}`,
          message: `Expand path '${path}' is invalid: '${part}' is not a relation in '${currentSchema.name}'`,
          code: 'UNKNOWN_EXPAND_PATH',
        };
      }

      const targetSchema = allSchemas.get(relation.targetType);
      if (!targetSchema) {
        return {
          path: `$expand.${path}`,
          message: `Expand path '${path}' is invalid: target entity '${relation.targetType}' does not exist`,
          code: 'UNKNOWN_EXPAND_PATH',
        };
      }

      currentSchema = targetSchema;
    }
  }

  return null;
}

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Extended schema directives with projection fields.
 * Used internally to access projection-specific directives.
 */
interface SchemaDirectivesWithProjection {
  projection?: ProjectionType;
  from?: string;
  expand?: string[];
  flatten?: Record<string, string>;
  // Include standard directives
  partitionBy?: string[];
  index?: Array<{ fields: string[]; unique?: boolean; name?: string }>;
  fts?: string[];
  vector?: Array<{ field: string; dimensions: number; metric?: 'cosine' | 'euclidean' | 'dot' }>;
}
