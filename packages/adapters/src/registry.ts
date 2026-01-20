/**
 * Adapter Registry Implementation
 *
 * Provides a registry for managing schema adapters.
 *
 * @packageDocumentation
 */

import { AdapterError, ErrorCodes } from '@icetype/core';
import type { SchemaAdapter, AdapterRegistry } from './types.js';

// =============================================================================
// Registry Implementation
// =============================================================================

/**
 * Default implementation of the AdapterRegistry interface.
 */
class AdapterRegistryImpl implements AdapterRegistry {
  private adapters = new Map<string, SchemaAdapter>();

  /**
   * Register an adapter with the registry.
   *
   * @param adapter - The adapter to register
   * @throws AdapterError if an adapter with the same name is already registered
   */
  register(adapter: SchemaAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new AdapterError(`Adapter is already registered`, {
        adapterName: adapter.name,
        operation: 'register',
        code: ErrorCodes.ADAPTER_ALREADY_REGISTERED,
      });
    }
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Get an adapter by name.
   *
   * @param name - The adapter name
   * @returns The adapter if found, undefined otherwise
   */
  get(name: string): SchemaAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * List all registered adapter names.
   *
   * @returns Array of registered adapter names
   */
  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if an adapter is registered.
   *
   * @param name - The adapter name to check
   * @returns True if the adapter is registered
   */
  has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * Unregister an adapter by name.
   *
   * @param name - The adapter name to unregister
   * @returns True if the adapter was unregistered, false if it wasn't registered
   */
  unregister(name: string): boolean {
    return this.adapters.delete(name);
  }

  /**
   * Clear all registered adapters.
   */
  clear(): void {
    this.adapters.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new adapter registry.
 *
 * @example
 * ```typescript
 * import { createAdapterRegistry, IcebergAdapter, ParquetAdapter } from '@icetype/adapters';
 *
 * const registry = createAdapterRegistry();
 *
 * // Register adapters
 * registry.register(new IcebergAdapter());
 * registry.register(new ParquetAdapter());
 *
 * // Use an adapter
 * const adapter = registry.get('iceberg');
 * if (adapter) {
 *   const output = adapter.transform(schema, { location: 's3://...' });
 * }
 * ```
 *
 * @returns A new AdapterRegistry instance
 */
export function createAdapterRegistry(): AdapterRegistry {
  return new AdapterRegistryImpl();
}

// =============================================================================
// Global Registry
// =============================================================================

/**
 * Global adapter registry instance.
 *
 * Provides a singleton registry that can be used throughout an application.
 *
 * @example
 * ```typescript
 * import { globalRegistry, IcebergAdapter } from '@icetype/adapters';
 *
 * // Register an adapter globally
 * globalRegistry.register(new IcebergAdapter());
 *
 * // Later, use the adapter
 * const adapter = globalRegistry.get('iceberg');
 * ```
 */
export const globalRegistry: AdapterRegistry = new AdapterRegistryImpl();
