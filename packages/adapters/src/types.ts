/**
 * Adapter Type Definitions
 *
 * Re-exports adapter types from @icetype/core where they are defined
 * to avoid cyclic dependencies between @icetype/adapters and individual
 * adapter packages.
 *
 * @module types
 * @packageDocumentation
 */

// Re-export all adapter types from @icetype/core
export type {
  SchemaAdapter,
  AdapterRegistry,
  IcebergAdapterOptions,
  ParquetAdapterOptions,
} from '@icetype/core';
