/**
 * Adapter Type Definitions
 *
 * Defines the interfaces for schema adapters that transform IceType schemas
 * to various output formats.
 *
 * @packageDocumentation
 */

import type { IceTypeSchema } from '@icetype/core';

// =============================================================================
// Adapter Interface
// =============================================================================

/**
 * Schema adapter interface for transforming IceType schemas to various output formats.
 *
 * @typeParam TOutput - The output type produced by the adapter
 * @typeParam TOptions - The options type accepted by the transform method
 *
 * @example
 * ```typescript
 * import type { SchemaAdapter } from '@icetype/adapters';
 *
 * const myAdapter: SchemaAdapter<MyOutput, MyOptions> = {
 *   name: 'my-adapter',
 *   version: '1.0.0',
 *   transform(schema, options) {
 *     // Transform logic here
 *     return myOutput;
 *   },
 *   serialize(output) {
 *     return JSON.stringify(output);
 *   },
 * };
 * ```
 */
export interface SchemaAdapter<TOutput = unknown, TOptions = unknown> {
  /** Unique name identifying this adapter */
  readonly name: string;

  /** Adapter version (semver) */
  readonly version: string;

  /**
   * Transform an IceType schema to the adapter's output format.
   *
   * @param schema - The IceType schema to transform
   * @param options - Optional adapter-specific options
   * @returns The transformed output
   */
  transform(schema: IceTypeSchema, options?: TOptions): TOutput;

  /**
   * Serialize the output to a string representation.
   *
   * @param output - The output to serialize
   * @returns String representation of the output
   */
  serialize(output: TOutput): string;

  /**
   * Serialize the output including index creation statements.
   *
   * This optional method generates a complete DDL string that includes both
   * the primary schema definition (e.g., CREATE TABLE) and any associated
   * index statements (e.g., CREATE INDEX). This is useful for SQL adapters
   * that need to create indexes separately from the table definition.
   *
   * @param output - The output to serialize
   * @returns String representation including index statements
   */
  serializeWithIndexes?(output: TOutput): string;
}

// =============================================================================
// Registry Interface
// =============================================================================

/**
 * Registry for managing schema adapters.
 *
 * @example
 * ```typescript
 * import { createAdapterRegistry } from '@icetype/adapters';
 *
 * const registry = createAdapterRegistry();
 * registry.register(myAdapter);
 *
 * const adapter = registry.get('my-adapter');
 * if (adapter) {
 *   const output = adapter.transform(schema);
 * }
 * ```
 */
export interface AdapterRegistry {
  /**
   * Register an adapter with the registry.
   *
   * @param adapter - The adapter to register
   * @throws Error if an adapter with the same name is already registered
   */
  register(adapter: SchemaAdapter): void;

  /**
   * Get an adapter by name.
   *
   * @param name - The adapter name
   * @returns The adapter if found, undefined otherwise
   */
  get(name: string): SchemaAdapter | undefined;

  /**
   * List all registered adapter names.
   *
   * @returns Array of registered adapter names
   */
  list(): string[];

  /**
   * Check if an adapter is registered.
   *
   * @param name - The adapter name to check
   * @returns True if the adapter is registered
   */
  has(name: string): boolean;

  /**
   * Unregister an adapter by name.
   *
   * @param name - The adapter name to unregister
   * @returns True if the adapter was unregistered, false if it wasn't registered
   */
  unregister(name: string): boolean;

  /**
   * Clear all registered adapters.
   */
  clear(): void;
}

// =============================================================================
// Adapter Options Types
// =============================================================================

/**
 * Options for the Iceberg adapter.
 */
export interface IcebergAdapterOptions {
  /** Base location for the table (e.g., 's3://bucket/tables/name') */
  location: string;
  /** Optional table UUID (generated if not provided) */
  tableUuid?: string;
  /** Additional table properties */
  properties?: Record<string, string>;
}

/**
 * Options for the Parquet adapter.
 */
export interface ParquetAdapterOptions {
  /** Output format: 'object' returns ParquetSchema, 'string' returns schema string */
  format?: 'object' | 'string';
}
