/**
 * Iceberg Projection Schema Generation
 *
 * Generates denormalized Iceberg/Parquet schemas from OLAP projection definitions.
 * Uses expandRelations() from @icetype/core to denormalize source schemas based on
 * $expand directives, then applies $flatten directives for field renaming.
 *
 * @example
 * ```typescript
 * import { generateProjectionSchema } from '@icetype/iceberg';
 *
 * const projection = {
 *   $type: 'OrdersFlat',
 *   $projection: 'olap',
 *   $from: 'Order',
 *   $expand: ['customer', 'items.product'],
 *   $flatten: { 'customer.address': 'shipping' }
 * };
 *
 * const icebergSchema = generateProjectionSchema(projection, allSchemas);
 * ```
 *
 * @packageDocumentation
 */

import type { IceTypeSchema, FieldDefinition, ProjectionType } from '@icetype/core';
import { expandRelations } from '@icetype/core';

import type { IcebergSchema, IcebergField, IcebergType } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Projection definition input for schema generation
 */
export interface ProjectionDefinition {
  /** Name of the projection schema */
  $type: string;
  /** Type of projection: 'oltp', 'olap', or 'both' */
  $projection: ProjectionType;
  /** Source entity name to project from */
  $from: string;
  /** Relations to expand/flatten */
  $expand?: string[];
  /** Field path renaming: { 'original.path': 'newPrefix' } */
  $flatten?: Record<string, string>;
}

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * Map IceType primitive to Iceberg type
 */
function mapPrimitiveType(iceType: string): IcebergType {
  const normalized = iceType.toLowerCase();

  switch (normalized) {
    case 'string':
    case 'text':
      return { type: 'string' };
    case 'int':
      return { type: 'int' };
    case 'long':
    case 'bigint':
      return { type: 'long' };
    case 'float':
      return { type: 'float' };
    case 'double':
      return { type: 'double' };
    case 'bool':
    case 'boolean':
      return { type: 'boolean' };
    case 'uuid':
      return { type: 'uuid' };
    case 'timestamp':
      return { type: 'timestamp' };
    case 'timestamptz':
      return { type: 'timestamptz' };
    case 'date':
      return { type: 'date' };
    case 'time':
      return { type: 'time' };
    case 'binary':
      return { type: 'binary' };
    case 'json':
      return { type: 'string' };
    case 'decimal':
      return { type: 'decimal', precision: 38, scale: 9 };
    default:
      // Handle decimal with precision
      if (normalized.startsWith('decimal')) {
        return { type: 'decimal', precision: 38, scale: 9 };
      }
      return { type: 'string' };
  }
}

/**
 * Convert a field definition to an Iceberg field
 */
function fieldToIcebergField(
  field: FieldDefinition,
  fieldId: number
): IcebergField {
  let icebergType: IcebergType;

  // Skip relation fields - they'll be expanded separately
  if (field.relation) {
    if (field.isArray) {
      icebergType = {
        type: 'list',
        elementType: { type: 'string' },
      };
    } else {
      icebergType = { type: 'string' };
    }
  } else if (field.isArray) {
    const elementType = mapPrimitiveType(field.type);
    icebergType = {
      type: 'list',
      elementType,
    };
  } else {
    icebergType = mapPrimitiveType(field.type);

    // Preserve decimal precision/scale
    if (field.precision !== undefined && icebergType.type === 'decimal') {
      icebergType.precision = field.precision;
      icebergType.scale = field.scale ?? 0;
    }
  }

  return {
    id: fieldId,
    name: field.name,
    required: !field.isOptional && field.modifier !== '?',
    type: icebergType,
    doc: field.name,
    initialDefault: field.defaultValue,
  };
}

// =============================================================================
// Projection Schema Generator
// =============================================================================

/**
 * Generator for Iceberg schemas from OLAP projections.
 *
 * Transforms IceType projection definitions into denormalized Iceberg schemas
 * suitable for analytics workloads.
 */
export class ProjectionSchemaGenerator {
  private nextFieldId = 1;

  /**
   * Generate an Iceberg schema from an OLAP projection definition.
   *
   * @param projection - The projection definition with $from, $expand, and $flatten
   * @param allSchemas - Map of all available schemas by name
   * @returns The generated Iceberg schema
   * @throws Error if source entity doesn't exist or expand paths are invalid
   */
  generateProjectionSchema(
    projection: ProjectionDefinition,
    allSchemas: Map<string, IceTypeSchema>
  ): IcebergSchema {
    this.nextFieldId = 1;

    const sourceSchema = allSchemas.get(projection.$from);
    if (!sourceSchema) {
      throw new Error(
        `Projection error: source entity '${projection.$from}' does not exist`
      );
    }

    const fields: IcebergField[] = [];
    const identifierFieldIds: number[] = [];

    // Add system fields
    const systemFields = this.generateSystemFields();
    for (const field of systemFields) {
      field.id = this.nextFieldId++;
      fields.push(field);
      if (field.name === '$id') {
        identifierFieldIds.push(field.id);
      }
    }

    // Get expand paths and flatten mappings
    const expandPaths = projection.$expand ?? [];
    const flattenMappings = projection.$flatten ?? {};

    // Use expandRelations if there are expansions
    let expandedSchema: IceTypeSchema;
    if (expandPaths.length > 0) {
      try {
        expandedSchema = expandRelations(sourceSchema, expandPaths, allSchemas);
      } catch (error) {
        // Re-throw with clearer message
        if (error instanceof Error) {
          throw new Error(`Projection expansion error: ${error.message}`);
        }
        throw error;
      }
    } else {
      expandedSchema = sourceSchema;
    }

    // Build field rename map from flatten directives
    const renameMap = this.buildRenameMap(flattenMappings, expandPaths);

    // Track which fields have been added to avoid duplicates
    const addedFields = new Set<string>();

    // Add all fields from expanded schema, applying renames
    for (const [fieldName, fieldDef] of expandedSchema.fields) {
      // Skip directive fields
      if (fieldName.startsWith('$')) continue;

      // Skip relation placeholder fields (they have relation defined)
      if (fieldDef.relation) continue;

      // Apply rename if applicable
      const renamedName = this.applyRename(fieldName, renameMap);

      // Skip duplicates
      if (addedFields.has(renamedName)) continue;
      addedFields.add(renamedName);

      const icebergField = fieldToIcebergField(
        { ...fieldDef, name: renamedName },
        this.nextFieldId++
      );
      fields.push(icebergField);
    }

    return {
      type: 'struct',
      schemaId: 1,
      identifierFieldIds,
      fields,
    };
  }

  /**
   * Generate system fields for the Iceberg schema.
   */
  private generateSystemFields(): IcebergField[] {
    return [
      {
        id: 0,
        name: '$id',
        required: true,
        type: { type: 'string' },
        doc: 'Document unique identifier',
      },
      {
        id: 0,
        name: '$type',
        required: true,
        type: { type: 'string' },
        doc: 'Document type/collection',
      },
      {
        id: 0,
        name: '$version',
        required: true,
        type: { type: 'int' },
        doc: 'Document version for optimistic concurrency',
      },
      {
        id: 0,
        name: '$createdAt',
        required: true,
        type: { type: 'long' },
        doc: 'Document creation timestamp (epoch ms)',
      },
      {
        id: 0,
        name: '$updatedAt',
        required: true,
        type: { type: 'long' },
        doc: 'Document last update timestamp (epoch ms)',
      },
    ];
  }

  /**
   * Build a rename map from flatten mappings.
   *
   * Converts flatten directive paths to prefixes that will match
   * the expanded field names.
   *
   * @example
   * // Input: { 'customer.address': 'shipping' }
   * // Output: { 'customer_address_': 'shipping_' }
   */
  private buildRenameMap(
    flattenMappings: Record<string, string>,
    _expandPaths: string[]
  ): Map<string, string> {
    const renameMap = new Map<string, string>();

    for (const [sourcePath, targetPrefix] of Object.entries(flattenMappings)) {
      // Convert dot path to underscore prefix format
      const sourcePrefix = sourcePath.replace(/\./g, '_') + '_';
      const targetPrefixNormalized = targetPrefix + '_';
      renameMap.set(sourcePrefix, targetPrefixNormalized);
    }

    // Sort by prefix length descending to match longest prefixes first
    const sortedEntries = [...renameMap.entries()].sort(
      (a, b) => b[0].length - a[0].length
    );

    return new Map(sortedEntries);
  }

  /**
   * Apply rename mapping to a field name.
   *
   * Matches the longest prefix in the rename map and replaces it.
   */
  private applyRename(fieldName: string, renameMap: Map<string, string>): string {
    for (const [sourcePrefix, targetPrefix] of renameMap) {
      if (fieldName.startsWith(sourcePrefix)) {
        return targetPrefix + fieldName.slice(sourcePrefix.length);
      }
    }
    return fieldName;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new ProjectionSchemaGenerator instance.
 */
export function createProjectionSchemaGenerator(): ProjectionSchemaGenerator {
  return new ProjectionSchemaGenerator();
}

/**
 * Generate an Iceberg schema from an OLAP projection definition.
 *
 * This is a convenience function that creates a generator internally.
 *
 * @param projection - The projection definition with $from, $expand, and $flatten
 * @param allSchemas - Map of all available schemas by name
 * @returns The generated Iceberg schema
 *
 * @example
 * ```typescript
 * const projection = {
 *   $type: 'OrdersFlat',
 *   $projection: 'olap',
 *   $from: 'Order',
 *   $expand: ['customer', 'items.product'],
 *   $flatten: { 'customer.address': 'shipping' }
 * };
 *
 * const schema = generateProjectionSchema(projection, schemaMap);
 * // Result: Iceberg schema with flattened order, customer, and product fields
 * ```
 */
export function generateProjectionSchema(
  projection: ProjectionDefinition,
  allSchemas: Map<string, IceTypeSchema>
): IcebergSchema {
  const generator = new ProjectionSchemaGenerator();
  return generator.generateProjectionSchema(projection, allSchemas);
}
