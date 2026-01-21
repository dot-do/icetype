/**
 * Lazy Adapter Loading
 *
 * Provides utilities for dynamically loading adapters to reduce bundle size.
 * Adapters are only loaded when requested, enabling tree-shaking and code splitting.
 *
 * @module lazy
 * @packageDocumentation
 */

import type { SchemaAdapter } from '@icetype/core';

// =============================================================================
// Types
// =============================================================================

/**
 * Function type for adapter loaders.
 * Returns a Promise that resolves to a SchemaAdapter.
 */
export type AdapterLoader = () => Promise<SchemaAdapter>;

/**
 * Configuration for known adapter packages.
 * Maps adapter names to their package import paths and factory function names.
 */
interface AdapterConfig {
  packageName: string;
  factoryName: string;
}

// =============================================================================
// Adapter Registry Configuration
// =============================================================================

/**
 * Known adapter configurations.
 * Maps adapter names to their package and factory function.
 */
const KNOWN_ADAPTERS: Record<string, AdapterConfig> = {
  postgres: {
    packageName: '@icetype/postgres',
    factoryName: 'createPostgresAdapter',
  },
  mysql: {
    packageName: '@icetype/mysql',
    factoryName: 'createMySQLAdapter',
  },
  sqlite: {
    packageName: '@icetype/sqlite',
    factoryName: 'createSQLiteAdapter',
  },
  clickhouse: {
    packageName: '@icetype/clickhouse',
    factoryName: 'createClickHouseAdapter',
  },
  duckdb: {
    packageName: '@icetype/duckdb',
    factoryName: 'createDuckDBAdapter',
  },
  iceberg: {
    packageName: '@icetype/iceberg',
    factoryName: 'createIcebergAdapter',
  },
  parquet: {
    packageName: '@icetype/iceberg',
    factoryName: 'createParquetAdapter',
  },
  drizzle: {
    packageName: '@icetype/drizzle',
    factoryName: 'createDrizzleAdapter',
  },
  prisma: {
    packageName: '@icetype/prisma',
    factoryName: 'createPrismaAdapter',
  },
};

// =============================================================================
// Adapter Cache
// =============================================================================

/**
 * Cache for loaded adapters to avoid repeated dynamic imports.
 */
const adapterCache = new Map<string, SchemaAdapter>();

// =============================================================================
// Lazy Load Adapter
// =============================================================================

/**
 * Dynamically loads an adapter by name.
 *
 * This function enables lazy loading of adapters, reducing initial bundle size.
 * The adapter is loaded via dynamic import only when requested, and the result
 * is cached for subsequent calls.
 *
 * @param name - The name of the adapter to load (e.g., 'postgres', 'mysql')
 * @returns A Promise that resolves to the loaded SchemaAdapter instance
 * @throws {Error} If the adapter name is unknown or loading fails
 *
 * @example
 * ```typescript
 * import { lazyLoadAdapter } from '@icetype/adapters';
 *
 * // Load adapter only when needed
 * const adapter = await lazyLoadAdapter('postgres');
 * const ddl = adapter.transform(schema, { ifNotExists: true });
 * ```
 *
 * @example Conditional loading based on configuration
 * ```typescript
 * const dbType = config.database; // 'postgres' or 'mysql'
 * const adapter = await lazyLoadAdapter(dbType);
 * ```
 */
export async function lazyLoadAdapter(name: string): Promise<SchemaAdapter> {
  // Check cache first
  const cached = adapterCache.get(name);
  if (cached) {
    return cached;
  }

  // Look up adapter configuration
  const config = KNOWN_ADAPTERS[name];
  if (!config) {
    throw new Error(
      `Unknown adapter: '${name}'. Known adapters: ${Object.keys(KNOWN_ADAPTERS).join(', ')}`
    );
  }

  // Dynamically import the adapter package using the package name from config
  // We use a variable to avoid TypeScript checking the module existence at compile time
  let module: Record<string, unknown>;
  try {
    // Use generic dynamic import with package name from config
    // This allows the adapters to be optional peer dependencies
    module = await import(/* @vite-ignore */ config.packageName);
  } catch (error) {
    throw new Error(
      `Failed to load adapter '${name}': ${error instanceof Error ? error.message : String(error)}. ` +
      `Make sure '${config.packageName}' is installed.`
    );
  }

  // Get the factory function and create the adapter
  const factory = module[config.factoryName];
  if (typeof factory !== 'function') {
    throw new Error(
      `Adapter package '${config.packageName}' does not export '${config.factoryName}'`
    );
  }

  const adapter = factory() as SchemaAdapter;

  // Cache the adapter
  adapterCache.set(name, adapter);

  return adapter;
}

// =============================================================================
// Lazy Adapter Registry
// =============================================================================

/**
 * Interface for a lazy adapter registry.
 *
 * Unlike the standard AdapterRegistry which stores adapter instances,
 * this registry stores loader functions that create adapters on demand.
 */
export interface LazyAdapterRegistry {
  /**
   * Register a loader function for an adapter.
   *
   * @param name - The adapter name
   * @param loader - A function that returns a Promise resolving to the adapter
   */
  registerLoader(name: string, loader: AdapterLoader): void;

  /**
   * Check if a loader is registered for the given name.
   *
   * @param name - The adapter name to check
   * @returns true if a loader is registered
   */
  hasLoader(name: string): boolean;

  /**
   * Get an adapter asynchronously, loading it if necessary.
   *
   * @param name - The adapter name
   * @returns A Promise that resolves to the adapter, or undefined if not registered
   */
  getAsync(name: string): Promise<SchemaAdapter | undefined>;

  /**
   * List all registered adapter names.
   *
   * @returns Array of registered adapter names
   */
  list(): string[];

  /**
   * Unregister a loader by name.
   *
   * @param name - The adapter name to unregister
   * @returns true if the loader was removed
   */
  unregisterLoader(name: string): boolean;

  /**
   * Clear all registered loaders and cached adapters.
   */
  clear(): void;
}

/**
 * Implementation of LazyAdapterRegistry.
 * @internal
 */
class LazyAdapterRegistryImpl implements LazyAdapterRegistry {
  private loaders = new Map<string, AdapterLoader>();
  private cache = new Map<string, SchemaAdapter>();

  registerLoader(name: string, loader: AdapterLoader): void {
    this.loaders.set(name, loader);
  }

  hasLoader(name: string): boolean {
    return this.loaders.has(name);
  }

  async getAsync(name: string): Promise<SchemaAdapter | undefined> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached) {
      return cached;
    }

    // Get loader
    const loader = this.loaders.get(name);
    if (!loader) {
      return undefined;
    }

    // Load and cache the adapter
    const adapter = await loader();
    this.cache.set(name, adapter);
    return adapter;
  }

  list(): string[] {
    return Array.from(this.loaders.keys());
  }

  unregisterLoader(name: string): boolean {
    this.cache.delete(name);
    return this.loaders.delete(name);
  }

  clear(): void {
    this.loaders.clear();
    this.cache.clear();
  }
}

/**
 * Create a new lazy adapter registry.
 *
 * A lazy adapter registry stores loader functions instead of adapter instances.
 * Adapters are only instantiated when requested via `getAsync()`, enabling
 * deferred loading and reduced initial bundle size.
 *
 * @returns A new LazyAdapterRegistry instance
 *
 * @example
 * ```typescript
 * import { createLazyAdapterRegistry } from '@icetype/adapters';
 *
 * const registry = createLazyAdapterRegistry();
 *
 * // Register loaders - adapters aren't loaded yet
 * registry.registerLoader('postgres', async () => {
 *   const { createPostgresAdapter } = await import('@icetype/postgres');
 *   return createPostgresAdapter();
 * });
 *
 * registry.registerLoader('mysql', async () => {
 *   const { createMySQLAdapter } = await import('@icetype/mysql');
 *   return createMySQLAdapter();
 * });
 *
 * // Adapter is loaded only when requested
 * const adapter = await registry.getAsync('postgres');
 * ```
 */
export function createLazyAdapterRegistry(): LazyAdapterRegistry {
  return new LazyAdapterRegistryImpl();
}
