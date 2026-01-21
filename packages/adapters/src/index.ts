/**
 * @icetype/adapters
 *
 * Adapter abstraction layer for IceType schema transformations.
 *
 * This package provides a unified interface for transforming IceType schemas
 * to various output formats. Specific adapter implementations (like IcebergAdapter
 * and ParquetAdapter) are provided by their respective packages.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { createAdapterRegistry, globalRegistry } from '@icetype/adapters';
 * import { IcebergAdapter, ParquetAdapter } from '@icetype/iceberg';
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
// Lazy Loading
// =============================================================================

export {
  lazyLoadAdapter,
  createLazyAdapterRegistry,
  type LazyAdapterRegistry,
  type AdapterLoader,
} from './lazy.js';
