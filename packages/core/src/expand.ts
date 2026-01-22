/**
 * IceType Relation Expansion
 *
 * Expands (denormalizes) relations in schemas for OLAP projections.
 * This allows creating flattened views of related data for analytics workloads.
 *
 * @example
 * ```typescript
 * const orderSchema = parseSchema({
 *   $type: 'Order',
 *   id: 'uuid!',
 *   customer: '-> Customer',
 * });
 *
 * const customerSchema = parseSchema({
 *   $type: 'Customer',
 *   id: 'uuid!',
 *   name: 'string!',
 * });
 *
 * const schemas = new Map([['Order', orderSchema], ['Customer', customerSchema]]);
 * const expanded = expandRelations(orderSchema, ['customer'], schemas);
 *
 * // Result has fields: id, customer_id, customer_name
 * ```
 *
 * @packageDocumentation
 */

import { IceTypeError } from './errors.js';
import type {
  IceTypeSchema,
  FieldDefinition,
  RelationDefinition,
  SchemaDirectives,
} from './types.js';

// =============================================================================
// Error Codes
// =============================================================================

export const ExpandErrorCodes = {
  EXPAND_MISSING_SCHEMA: 'EXPAND_MISSING_SCHEMA',
  EXPAND_UNKNOWN_PATH: 'EXPAND_UNKNOWN_PATH',
  EXPAND_NOT_A_RELATION: 'EXPAND_NOT_A_RELATION',
  EXPAND_CIRCULAR_REFERENCE: 'EXPAND_CIRCULAR_REFERENCE',
} as const;

export type ExpandErrorCode = typeof ExpandErrorCodes[keyof typeof ExpandErrorCodes];

// =============================================================================
// ExpandError Class
// =============================================================================

/**
 * Options for ExpandError.
 */
export interface ExpandErrorOptions {
  /** Error code for programmatic handling */
  code?: ExpandErrorCode;
  /** Original error that caused this error */
  cause?: Error;
  /** The expansion path that caused the error */
  path?: string;
  /** The schema name involved */
  schemaName?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Error thrown when relation expansion fails.
 *
 * @example
 * ```typescript
 * throw new ExpandError('Target schema not found', {
 *   code: ExpandErrorCodes.EXPAND_MISSING_SCHEMA,
 *   schemaName: 'Customer',
 *   path: 'customer',
 * });
 * ```
 */
export class ExpandError extends IceTypeError {
  /** The expansion path that caused the error */
  public readonly path?: string;
  /** The schema name involved */
  public readonly schemaName?: string;

  constructor(message: string, options: ExpandErrorOptions = {}) {
    const { code, cause, path, schemaName, context } = options;

    let fullMessage = message;
    if (path) {
      fullMessage = `Expansion path '${path}': ${message}`;
    }

    const superOptions: {
      code: ExpandErrorCode;
      cause?: Error;
      context: Record<string, unknown>;
    } = {
      code: code ?? ExpandErrorCodes.EXPAND_UNKNOWN_PATH,
      context: { ...context },
    };
    if (cause !== undefined) {
      superOptions.cause = cause;
    }
    if (path !== undefined) {
      superOptions.context.path = path;
    }
    if (schemaName !== undefined) {
      superOptions.context.schemaName = schemaName;
    }
    super(fullMessage, superOptions);

    this.name = 'ExpandError';
    if (path !== undefined) {
      this.path = path;
    }
    if (schemaName !== undefined) {
      this.schemaName = schemaName;
    }

    Object.setPrototypeOf(this, ExpandError.prototype);
  }
}

/**
 * Type guard to check if an error is an ExpandError.
 *
 * @param error - The error to check
 * @returns True if the error is an ExpandError
 */
export function isExpandError(error: unknown): error is ExpandError {
  return error instanceof ExpandError;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Result of relation expansion - an IceTypeSchema with expanded/flattened fields.
 */
export type ExpandedSchema = IceTypeSchema;

/**
 * Internal context for tracking expansion state.
 */
interface ExpansionContext {
  /** All available schemas */
  allSchemas: Map<string, IceTypeSchema>;
  /** Schemas visited in current expansion path (for circular detection) */
  visitedPath: Set<string>;
  /** Whether the current path includes an optional relation */
  isOptionalPath: boolean;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Expand relations in a schema to create a denormalized/flattened schema.
 *
 * This function takes a schema with relations and expands specified relations
 * into inline fields, creating a flattened schema suitable for OLAP workloads.
 *
 * @param schema - The source schema to expand
 * @param expansions - Array of relation paths to expand (e.g., ['customer', 'items.product'])
 * @param allSchemas - Map of all available schemas by name
 * @returns A new schema with expanded relation fields
 * @throws ExpandError if expansion fails (missing schema, circular reference, etc.)
 *
 * @example
 * ```typescript
 * const expanded = expandRelations(orderSchema, ['customer', 'items.product'], schemaMap);
 * // Original Order: { id, customer (-> Customer), items (<- OrderItem[]) }
 * // Expanded: { id, customer_id, customer_name, items (array), items_product_id, ... }
 * ```
 */
export function expandRelations(
  schema: IceTypeSchema,
  expansions: string[],
  allSchemas: Map<string, IceTypeSchema>
): ExpandedSchema {
  // Create the expanded schema with a new name
  const expandedFields = new Map<string, FieldDefinition>();
  const expandedRelations = new Map<string, RelationDefinition>();

  // Track which relation fields are being expanded (to exclude them from direct copy)
  // Only relations that are actually expanded should be excluded from the result
  const expandedRelationNames = new Set<string>();

  // Deduplicate and sort expansions (shorter paths first for proper handling)
  const uniqueExpansions = [...new Set(expansions)].sort((a, b) => {
    const depthA = a.split('.').length;
    const depthB = b.split('.').length;
    return depthA - depthB;
  });

  // Check for circular references in expansion paths
  detectCircularReferences(schema, uniqueExpansions, allSchemas);

  // Process each expansion
  for (const expansionPath of uniqueExpansions) {
    const parts = expansionPath.split('.');
    const rootFieldName = parts[0]!;

    // Check if the root field is a relation - only relations should be "expanded"
    const rootRelation = schema.relations.get(rootFieldName);
    if (rootRelation) {
      // Mark only relation fields as being expanded
      expandedRelationNames.add(rootFieldName);
    }

    // Process the expansion
    const context: ExpansionContext = {
      allSchemas,
      visitedPath: new Set([schema.name]),
      isOptionalPath: false,
    };

    processExpansion(
      schema,
      parts,
      '',
      expandedFields,
      context
    );
  }

  // Copy non-expanded fields from original schema
  for (const [fieldName, field] of schema.fields) {
    if (!expandedRelationNames.has(fieldName)) {
      expandedFields.set(fieldName, { ...field });
    }
  }

  // Copy relations that weren't expanded
  for (const [relName, relation] of schema.relations) {
    if (!expandedRelationNames.has(relName)) {
      expandedRelations.set(relName, { ...relation });
    }
  }

  const now = Date.now();

  return {
    name: `${schema.name}_expanded`,
    fields: expandedFields,
    directives: { ...schema.directives } as SchemaDirectives,
    relations: expandedRelations,
    version: schema.version,
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Strip modifiers (!, ?, #) from a type name.
 * This handles cases where target type is stored with modifiers like "Customer!".
 */
function stripModifiers(typeName: string): string {
  return typeName.replace(/[!?#]+$/, '');
}

/**
 * Detect circular references in the expansion paths before processing.
 */
function detectCircularReferences(
  schema: IceTypeSchema,
  expansions: string[],
  allSchemas: Map<string, IceTypeSchema>
): void {
  for (const expansionPath of expansions) {
    const parts = expansionPath.split('.');
    const visitedTypes = new Set<string>([schema.name]);
    let currentSchema = schema;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const relation = currentSchema.relations.get(part);

      if (relation) {
        // Strip modifiers from target type for schema lookup
        const targetType = stripModifiers(relation.targetType);

        // Check if we've already visited this type in this path
        if (visitedTypes.has(targetType)) {
          throw new ExpandError(
            `Circular reference detected: expansion path '${expansionPath}' leads back to '${targetType}'`,
            {
              code: ExpandErrorCodes.EXPAND_CIRCULAR_REFERENCE,
              path: expansionPath,
              schemaName: targetType,
            }
          );
        }

        visitedTypes.add(targetType);

        // Get target schema for next iteration
        const targetSchema = allSchemas.get(targetType);
        if (targetSchema) {
          currentSchema = targetSchema;
        }
      }
    }
  }
}

/**
 * Process a single expansion path and add expanded fields to the result.
 */
function processExpansion(
  schema: IceTypeSchema,
  pathParts: string[],
  prefix: string,
  expandedFields: Map<string, FieldDefinition>,
  context: ExpansionContext
): void {
  if (pathParts.length === 0) {
    return;
  }

  const [currentPart, ...remainingParts] = pathParts;
  if (!currentPart) return;

  const field = schema.fields.get(currentPart);
  const relation = schema.relations.get(currentPart);

  // Check if the field/relation exists
  if (!field && !relation) {
    throw new ExpandError(
      `Field or relation '${currentPart}' does not exist in schema '${schema.name}'`,
      {
        code: ExpandErrorCodes.EXPAND_UNKNOWN_PATH,
        path: prefix ? `${prefix}.${currentPart}` : currentPart,
        schemaName: schema.name,
      }
    );
  }

  // Build the prefix for expanded fields
  const fieldPrefix = prefix ? `${prefix}_${currentPart}` : currentPart;

  // If it's a relation, expand it
  if (relation) {
    // Strip modifiers from target type for schema lookup
    const targetTypeName = stripModifiers(relation.targetType);
    const targetSchema = context.allSchemas.get(targetTypeName);

    if (!targetSchema) {
      throw new ExpandError(
        `Target schema '${targetTypeName}' not found for relation '${currentPart}'`,
        {
          code: ExpandErrorCodes.EXPAND_MISSING_SCHEMA,
          path: prefix ? `${prefix}.${currentPart}` : currentPart,
          schemaName: targetTypeName,
        }
      );
    }

    // Check if this is an optional relation
    const isOptional = context.isOptionalPath || field?.isOptional || false;
    const isArrayRelation = field?.isArray || false;

    // If there are remaining path parts, continue traversing
    if (remainingParts.length > 0) {
      // Check if remaining path is a relation that needs to be nested
      const nestedContext: ExpansionContext = {
        ...context,
        visitedPath: new Set([...context.visitedPath, targetTypeName]),
        isOptionalPath: isOptional,
      };

      processExpansion(
        targetSchema,
        remainingParts,
        fieldPrefix,
        expandedFields,
        nestedContext
      );
    } else {
      // Expand all fields from the target schema
      expandTargetSchema(
        targetSchema,
        fieldPrefix,
        expandedFields,
        isOptional,
        isArrayRelation
      );
    }

    // For array relations, also add a field representing the array
    if (isArrayRelation && remainingParts.length === 0) {
      const arrayField: FieldDefinition = {
        name: fieldPrefix,
        type: 'json',
        modifier: isOptional ? '?' : '',
        isArray: true,
        isOptional: isOptional,
        isUnique: false,
        isIndexed: false,
      };
      expandedFields.set(fieldPrefix, arrayField);
    }
  } else if (field) {
    // It's a regular field, not a relation
    if (remainingParts.length > 0) {
      // Can't traverse nested path on a non-relation field
      throw new ExpandError(
        `Field '${currentPart}' is not a relation and cannot have nested expansion`,
        {
          code: ExpandErrorCodes.EXPAND_NOT_A_RELATION,
          path: prefix ? `${prefix}.${currentPart}` : currentPart,
          schemaName: schema.name,
        }
      );
    }

    // Just copy the field (it will be included in the final schema)
    // This handles the case where someone includes a non-relation field in expansions
  }
}

/**
 * Expand all fields from a target schema into the result with a prefix.
 */
function expandTargetSchema(
  targetSchema: IceTypeSchema,
  prefix: string,
  expandedFields: Map<string, FieldDefinition>,
  isOptionalRelation: boolean,
  isArrayRelation: boolean
): void {
  for (const [fieldName, field] of targetSchema.fields) {
    // Skip relation fields - they would need their own expansion
    if (field.relation) {
      continue;
    }

    const expandedFieldName = `${prefix}_${fieldName}`;

    // Determine if the expanded field should be optional
    // If the relation is optional, all expanded fields become optional
    // If the source field is optional, the expanded field is optional
    const isOptional = isOptionalRelation || field.isOptional;

    const expandedField: FieldDefinition = {
      name: expandedFieldName,
      type: field.type,
      modifier: isOptional ? '?' : field.modifier,
      isArray: isArrayRelation ? true : field.isArray,
      isOptional: isOptional,
      isUnique: false, // Expanded fields lose uniqueness constraints
      isIndexed: false, // Indexes don't carry over to expanded views
    };

    // Only assign optional properties if they are defined
    if (field.defaultValue !== undefined) {
      expandedField.defaultValue = field.defaultValue;
    }
    if (field.precision !== undefined) {
      expandedField.precision = field.precision;
    }
    if (field.scale !== undefined) {
      expandedField.scale = field.scale;
    }
    if (field.length !== undefined) {
      expandedField.length = field.length;
    }

    expandedFields.set(expandedFieldName, expandedField);
  }
}
