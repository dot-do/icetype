/**
 * GraphDL Iceberg Adapter
 *
 * Compiles @graphdl/core ParsedGraph schemas directly to Apache Iceberg
 * table metadata without intermediate IceType schema conversion.
 *
 * @example
 * ```typescript
 * import { Graph } from '@graphdl/core';
 * import { compileGraphToIceberg, compileEntityToIceberg } from '@icetype/iceberg';
 *
 * const graph = Graph({
 *   User: {
 *     $type: 'https://schema.org/Person',
 *     $partitionBy: ['tenantId'],
 *     id: 'uuid!',
 *     email: 'string#',
 *     tenantId: 'string',
 *   },
 * });
 *
 * // Compile entire graph
 * const metadata = compileGraphToIceberg(graph, {
 *   baseLocation: 's3://my-bucket/tables',
 * });
 *
 * // Or compile single entity
 * const userEntity = graph.entities.get('User')!;
 * const userMetadata = compileEntityToIceberg(userEntity, {
 *   location: 's3://my-bucket/tables/users',
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { ParsedGraph, ParsedEntity } from '@graphdl/core';
import { AdapterError, ErrorCodes, entityToIceType, graphToIceType } from '@icetype/core';
import { generateIcebergMetadata } from './metadata.js';
import type { IcebergTableMetadata } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for compiling a ParsedGraph to Iceberg metadata
 */
export interface CompileGraphOptions {
  /**
   * Base location for all tables.
   * Entity-specific locations will be appended: `{baseLocation}/{EntityName}`
   */
  baseLocation: string;

  /**
   * Optional per-entity location overrides.
   * Keys are entity names, values are full location paths.
   */
  locations?: Record<string, string>;

  /**
   * Additional Iceberg table properties to set on all tables.
   */
  properties?: Record<string, string>;
}

/**
 * Options for compiling a single ParsedEntity to Iceberg metadata
 */
export interface CompileEntityOptions {
  /**
   * The table location (required)
   */
  location: string;

  /**
   * Additional Iceberg table properties
   */
  properties?: Record<string, string>;
}

// =============================================================================
// Compiler Functions
// =============================================================================

/**
 * Compile a GraphDL ParsedGraph to Iceberg table metadata.
 *
 * Converts each entity in the graph to Iceberg table metadata,
 * handling directive passthrough for partition specs, indexes, etc.
 *
 * @param graph - The GraphDL parsed graph
 * @param options - Compilation options including base location
 * @returns Map of entity name to Iceberg table metadata
 *
 * @example
 * ```typescript
 * import { Graph } from '@graphdl/core';
 * import { compileGraphToIceberg } from '@icetype/iceberg';
 *
 * const graph = Graph({
 *   User: {
 *     $partitionBy: ['tenantId'],
 *     id: 'uuid!',
 *     name: 'string',
 *     tenantId: 'string',
 *   },
 *   Post: {
 *     id: 'uuid!',
 *     title: 'string',
 *     author: '->User',
 *   },
 * });
 *
 * const metadata = compileGraphToIceberg(graph, {
 *   baseLocation: 's3://my-bucket/tables',
 * });
 *
 * // Get metadata for each entity
 * const userMetadata = metadata.get('User');
 * const postMetadata = metadata.get('Post');
 * ```
 */
export function compileGraphToIceberg(
  graph: ParsedGraph,
  options: CompileGraphOptions
): Map<string, IcebergTableMetadata> {
  const result = new Map<string, IcebergTableMetadata>();

  // Convert GraphDL graph to IceType schemas
  const schemas = graphToIceType(graph);

  for (const [entityName, schema] of schemas) {
    // Determine location for this entity
    const location =
      options.locations?.[entityName] ?? `${options.baseLocation}/${entityName}`;

    // Generate Iceberg metadata
    const metadata = generateIcebergMetadata(schema, location, options.properties);
    result.set(entityName, metadata);
  }

  return result;
}

/**
 * Compile a single GraphDL ParsedEntity to Iceberg table metadata.
 *
 * @param entity - The GraphDL parsed entity
 * @param options - Compilation options including location
 * @returns Iceberg table metadata
 * @throws AdapterError if location is not provided
 *
 * @example
 * ```typescript
 * import { Graph, getEntity } from '@graphdl/core';
 * import { compileEntityToIceberg } from '@icetype/iceberg';
 *
 * const graph = Graph({
 *   User: {
 *     $partitionBy: ['createdAt'],
 *     id: 'uuid!',
 *     name: 'string',
 *   },
 * });
 *
 * const userEntity = getEntity(graph, 'User')!;
 * const metadata = compileEntityToIceberg(userEntity, {
 *   location: 's3://my-bucket/tables/users',
 *   properties: {
 *     'write.parquet.compression-codec': 'zstd',
 *   },
 * });
 * ```
 */
export function compileEntityToIceberg(
  entity: ParsedEntity,
  options: CompileEntityOptions
): IcebergTableMetadata {
  if (!options?.location) {
    throw new AdapterError('Missing required option: location', {
      adapterName: 'iceberg-graphdl',
      operation: 'compileEntityToIceberg',
      code: ErrorCodes.MISSING_ADAPTER_OPTION,
      context: {
        requiredOption: 'location',
        entity: entity.name,
      },
    });
  }

  // Convert GraphDL entity to IceType schema
  const schema = entityToIceType(entity);

  // Generate Iceberg metadata
  return generateIcebergMetadata(schema, options.location, options.properties);
}
