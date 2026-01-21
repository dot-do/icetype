/**
 * Adapter Registry Implementation
 *
 * Provides a registry for managing schema adapters. The registry allows
 * registering, retrieving, and unregistering adapters by name.
 *
 * @module registry
 * @packageDocumentation
 */

import { AdapterError, ErrorCodes } from '@icetype/core';
import type { SchemaAdapter, AdapterRegistry } from './types.js';

// =============================================================================
// Registry Implementation
// =============================================================================

/**
 * Default implementation of the AdapterRegistry interface.
 *
 * This class provides a Map-based storage for adapters, ensuring O(1) lookup
 * and preventing duplicate registrations. Adapter names can be any string,
 * including empty strings, Unicode characters, and special characters.
 *
 * @internal
 */
class AdapterRegistryImpl implements AdapterRegistry {
  private adapters = new Map<string, SchemaAdapter>();

  /**
   * Register an adapter with the registry.
   *
   * The adapter's `name` property is used as the registration key. Each adapter
   * name must be unique within the registry. To replace an existing adapter,
   * first call `unregister()` then register the new adapter.
   *
   * @param adapter - The adapter to register. Must have a unique `name` property.
   * @throws {AdapterError} If an adapter with the same name is already registered.
   *   The error will have code `ErrorCodes.ADAPTER_ALREADY_REGISTERED`.
   *
   * @example
   * ```typescript
   * const registry = createAdapterRegistry();
   *
   * // Register an adapter
   * registry.register({
   *   name: 'my-adapter',
   *   version: '1.0.0',
   *   transform: (schema) => ({ type: schema.$type }),
   *   serialize: (output) => JSON.stringify(output),
   * });
   *
   * // Attempting to register duplicate throws
   * try {
   *   registry.register({ name: 'my-adapter', ... });
   * } catch (error) {
   *   if (isAdapterError(error)) {
   *     console.log(error.code); // 'ADAPTER_ALREADY_REGISTERED'
   *   }
   * }
   * ```
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
   * Retrieves a previously registered adapter by its name. If no adapter
   * with the given name exists, returns `undefined`.
   *
   * @param name - The adapter name to look up
   * @returns The adapter if found, `undefined` otherwise
   *
   * @example
   * ```typescript
   * const adapter = registry.get('iceberg');
   * if (adapter) {
   *   const output = adapter.transform(schema, options);
   * } else {
   *   console.log('Adapter not found');
   * }
   * ```
   */
  get(name: string): SchemaAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * List all registered adapter names.
   *
   * Returns a new array containing all registered adapter names. The returned
   * array is a snapshot and modifications to it do not affect the registry.
   *
   * @returns Array of registered adapter names. Returns empty array if no adapters registered.
   *
   * @example
   * ```typescript
   * registry.register(icebergAdapter);
   * registry.register(parquetAdapter);
   *
   * const names = registry.list();
   * console.log(names); // ['iceberg', 'parquet']
   * ```
   */
  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if an adapter is registered.
   *
   * @param name - The adapter name to check
   * @returns `true` if an adapter with the given name is registered, `false` otherwise
   *
   * @example
   * ```typescript
   * if (registry.has('iceberg')) {
   *   // Safe to get without undefined check
   *   const adapter = registry.get('iceberg')!;
   * }
   * ```
   */
  has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * Unregister an adapter by name.
   *
   * Removes an adapter from the registry. After unregistering, the same name
   * can be used to register a new adapter (useful for replacing adapters).
   *
   * @param name - The adapter name to unregister
   * @returns `true` if the adapter was unregistered, `false` if it wasn't registered
   *
   * @example
   * ```typescript
   * // Replace an adapter with a new version
   * registry.unregister('my-adapter');
   * registry.register(newAdapterVersion);
   * ```
   */
  unregister(name: string): boolean {
    return this.adapters.delete(name);
  }

  /**
   * Clear all registered adapters.
   *
   * Removes all adapters from the registry. This is useful for testing
   * or when reinitializing the application.
   *
   * @example
   * ```typescript
   * // In test setup
   * beforeEach(() => {
   *   globalRegistry.clear();
   * });
   * ```
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
 * Creates an isolated registry instance that is independent of other registries.
 * Use this when you need separate adapter configurations for different contexts
 * (e.g., testing, multi-tenant applications, or scoped configurations).
 *
 * For a shared, application-wide registry, use {@link globalRegistry} instead.
 *
 * @returns A new, empty AdapterRegistry instance
 *
 * @example Basic usage
 * ```typescript
 * import { createAdapterRegistry } from '@icetype/adapters';
 * import { IcebergAdapter, ParquetAdapter } from '@icetype/iceberg';
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
 * @example Independent registries
 * ```typescript
 * const testRegistry = createAdapterRegistry();
 * const prodRegistry = createAdapterRegistry();
 *
 * testRegistry.register(mockAdapter);
 * prodRegistry.register(realAdapter);
 *
 * // Changes to one don't affect the other
 * testRegistry.clear(); // prodRegistry still has realAdapter
 * ```
 *
 * @example Error handling
 * ```typescript
 * import { isAdapterError, ErrorCodes } from '@icetype/core';
 *
 * const registry = createAdapterRegistry();
 * registry.register(myAdapter);
 *
 * try {
 *   registry.register(myAdapter); // Duplicate!
 * } catch (error) {
 *   if (isAdapterError(error) && error.code === ErrorCodes.ADAPTER_ALREADY_REGISTERED) {
 *     console.log(`Adapter '${error.adapterName}' is already registered`);
 *   }
 * }
 * ```
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
 * A singleton registry that provides a shared adapter configuration for an
 * entire application. This is the recommended approach for most applications
 * where a single set of adapters is used throughout.
 *
 * For isolated registries (e.g., testing), use {@link createAdapterRegistry} instead.
 *
 * **Note:** In test environments, remember to call `globalRegistry.clear()`
 * in your setup/teardown to prevent test pollution.
 *
 * @example Application setup
 * ```typescript
 * // app/adapters.ts - Register adapters at startup
 * import { globalRegistry } from '@icetype/adapters';
 * import { IcebergAdapter, ParquetAdapter } from '@icetype/iceberg';
 *
 * globalRegistry.register(new IcebergAdapter());
 * globalRegistry.register(new ParquetAdapter());
 * ```
 *
 * @example Using registered adapters
 * ```typescript
 * // Elsewhere in your application
 * import { globalRegistry } from '@icetype/adapters';
 * import { parseSchema } from '@icetype/core';
 *
 * const schema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string' });
 * const adapter = globalRegistry.get('iceberg');
 *
 * if (adapter) {
 *   const icebergMetadata = adapter.transform(schema, {
 *     location: 's3://my-bucket/tables/users',
 *   });
 * }
 * ```
 *
 * @example Test cleanup
 * ```typescript
 * import { globalRegistry } from '@icetype/adapters';
 *
 * describe('MyTests', () => {
 *   beforeEach(() => {
 *     globalRegistry.clear();
 *   });
 *
 *   it('should work with mock adapter', () => {
 *     globalRegistry.register(mockAdapter);
 *     // ... test code
 *   });
 * });
 * ```
 */
export const globalRegistry: AdapterRegistry = new AdapterRegistryImpl();
