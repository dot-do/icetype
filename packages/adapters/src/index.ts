/**
 * @icetype/adapters
 *
 * Adapter abstraction layer for IceType schema transformations.
 *
 * This package provides a unified interface for transforming IceType schemas
 * to various output formats like Apache Iceberg metadata and Parquet schemas.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import {
 *   createAdapterRegistry,
 *   IcebergAdapter,
 *   ParquetAdapter,
 * } from '@icetype/adapters';
 *
 * // Parse an IceType schema
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 * });
 *
 * // Create a registry and register adapters
 * const registry = createAdapterRegistry();
 * registry.register(new IcebergAdapter());
 * registry.register(new ParquetAdapter());
 *
 * // Use the Iceberg adapter
 * const icebergAdapter = registry.get('iceberg');
 * const metadata = icebergAdapter?.transform(schema, {
 *   location: 's3://my-bucket/tables/users',
 * });
 *
 * // Use the Parquet adapter
 * const parquetAdapter = registry.get('parquet');
 * const parquetSchema = parquetAdapter?.transform(schema);
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

export type {
  SchemaAdapter,
  AdapterRegistry,
  IcebergAdapterOptions,
  ParquetAdapterOptions,
} from './types.js';

// =============================================================================
// Registry
// =============================================================================

export { createAdapterRegistry, globalRegistry } from './registry.js';

// =============================================================================
// Iceberg Adapter
// =============================================================================

export { IcebergAdapter, createIcebergAdapter } from './iceberg.js';

// =============================================================================
// Parquet Adapter
// =============================================================================

export {
  ParquetAdapter,
  createParquetAdapter,
  transformToParquetString,
} from './parquet.js';

// =============================================================================
// Re-export relevant types from @icetype/iceberg for convenience
// =============================================================================

export type {
  IcebergTableMetadata,
  IcebergSchema,
  IcebergField,
  ParquetSchema,
  ParquetField,
} from '@icetype/iceberg';
