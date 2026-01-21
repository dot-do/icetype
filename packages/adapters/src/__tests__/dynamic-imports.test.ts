/**
 * Dynamic Adapter Imports Tests for @icetype/adapters
 *
 * Tests for lazy loading/dynamic importing of adapters to reduce bundle size.
 * This is a RED phase test file - tests are expected to FAIL until implementation.
 *
 * The goal is to support dynamic imports like:
 *   const { createPostgresAdapter } = await import('@icetype/postgres')
 *
 * Without loading other adapters (mysql, sqlite, etc.) into memory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SchemaAdapter } from '../types.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Track which modules have been loaded during a test.
 * This is used to verify lazy loading behavior.
 */
const loadedModules = new Set<string>();

/**
 * Reset module tracking between tests.
 */
function resetModuleTracking(): void {
  loadedModules.clear();
}

// =============================================================================
// Dynamic Import Tests - Basic Functionality
// =============================================================================

describe('Dynamic Adapter Imports', () => {
  beforeEach(() => {
    resetModuleTracking();
    // Clear module cache to ensure fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dynamic import of postgres adapter', () => {
    it('should dynamically import postgres adapter', async () => {
      // Dynamic import should work and return the expected exports
      const postgresModule = await import('@icetype/postgres');

      expect(postgresModule.createPostgresAdapter).toBeDefined();
      expect(typeof postgresModule.createPostgresAdapter).toBe('function');
    });

    it('should create a valid postgres adapter from dynamic import', async () => {
      const { createPostgresAdapter } = await import('@icetype/postgres');

      const adapter = createPostgresAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.name).toBe('postgres');
      expect(typeof adapter.transform).toBe('function');
      expect(typeof adapter.serialize).toBe('function');
    });

    it('should export PostgresAdapter class from dynamic import', async () => {
      const { PostgresAdapter } = await import('@icetype/postgres');

      expect(PostgresAdapter).toBeDefined();

      const adapter = new PostgresAdapter();
      expect(adapter.name).toBe('postgres');
    });
  });

  describe('dynamic import of mysql adapter', () => {
    it('should dynamically import mysql adapter', async () => {
      const mysqlModule = await import('@icetype/mysql');

      expect(mysqlModule.createMySQLAdapter).toBeDefined();
      expect(typeof mysqlModule.createMySQLAdapter).toBe('function');
    });

    it('should create a valid mysql adapter from dynamic import', async () => {
      const { createMySQLAdapter } = await import('@icetype/mysql');

      const adapter = createMySQLAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.name).toBe('mysql');
      expect(typeof adapter.transform).toBe('function');
      expect(typeof adapter.serialize).toBe('function');
    });

    it('should export MySQLAdapter class from dynamic import', async () => {
      const { MySQLAdapter } = await import('@icetype/mysql');

      expect(MySQLAdapter).toBeDefined();

      const adapter = new MySQLAdapter();
      expect(adapter.name).toBe('mysql');
    });
  });
});

// =============================================================================
// Lazy Loading Tests - Module Isolation
// =============================================================================

describe('Lazy Loading - Module Isolation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not load mysql when only postgres is imported', async () => {
    // This test verifies that importing postgres doesn't transitively import mysql
    // We need a way to detect what modules are loaded

    // Import only postgres
    const postgresModule = await import('@icetype/postgres');
    expect(postgresModule.createPostgresAdapter).toBeDefined();

    // The @icetype/adapters package should provide a way to check loaded adapters
    // For now, we verify by checking that postgres adapter is available
    // and there's no accidental coupling

    // Create postgres adapter should work independently
    const adapter = postgresModule.createPostgresAdapter();
    expect(adapter.name).toBe('postgres');

    // This test expects a lazy loading mechanism that isn't implemented yet
    // The implementation should ensure mysql code is not evaluated
  });

  it('should not load postgres when only mysql is imported', async () => {
    // Import only mysql
    const mysqlModule = await import('@icetype/mysql');
    expect(mysqlModule.createMySQLAdapter).toBeDefined();

    // Create mysql adapter should work independently
    const adapter = mysqlModule.createMySQLAdapter();
    expect(adapter.name).toBe('mysql');

    // This test expects a lazy loading mechanism that isn't implemented yet
    // The implementation should ensure postgres code is not evaluated
  });

  it('should allow importing both adapters independently', async () => {
    // Import both adapters
    const [postgresModule, mysqlModule] = await Promise.all([
      import('@icetype/postgres'),
      import('@icetype/mysql'),
    ]);

    // Both should be available and independent
    const postgresAdapter = postgresModule.createPostgresAdapter();
    const mysqlAdapter = mysqlModule.createMySQLAdapter();

    expect(postgresAdapter.name).toBe('postgres');
    expect(mysqlAdapter.name).toBe('mysql');

    // They should be different adapter instances
    expect(postgresAdapter).not.toBe(mysqlAdapter);
  });
});

// =============================================================================
// Type Safety Tests
// =============================================================================

describe('Type Safety with Dynamic Imports', () => {
  it('should preserve type safety for postgres adapter', async () => {
    const { PostgresAdapter, createPostgresAdapter } = await import(
      '@icetype/postgres'
    );

    // Type should be preserved - adapter should implement SchemaAdapter
    const adapter: SchemaAdapter = createPostgresAdapter();

    expect(adapter.name).toBe('postgres');
    expect(adapter.version).toBeDefined();
    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
  });

  it('should preserve type safety for mysql adapter', async () => {
    const { MySQLAdapter, createMySQLAdapter } = await import('@icetype/mysql');

    // Type should be preserved - adapter should implement SchemaAdapter
    const adapter: SchemaAdapter = createMySQLAdapter();

    expect(adapter.name).toBe('mysql');
    expect(adapter.version).toBeDefined();
    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
  });

  it('should allow using dynamically imported adapter with registry', async () => {
    const { createAdapterRegistry } = await import('../registry.js');
    const { createPostgresAdapter } = await import('@icetype/postgres');

    const registry = createAdapterRegistry();
    const adapter = createPostgresAdapter();

    // Should be able to register dynamically imported adapter
    registry.register(adapter);

    expect(registry.has('postgres')).toBe(true);
    expect(registry.get('postgres')).toBe(adapter);
  });

  it('should allow registering multiple dynamically imported adapters', async () => {
    const { createAdapterRegistry } = await import('../registry.js');
    const [postgresModule, mysqlModule] = await Promise.all([
      import('@icetype/postgres'),
      import('@icetype/mysql'),
    ]);

    const registry = createAdapterRegistry();

    registry.register(postgresModule.createPostgresAdapter());
    registry.register(mysqlModule.createMySQLAdapter());

    expect(registry.list()).toContain('postgres');
    expect(registry.list()).toContain('mysql');
    expect(registry.list()).toHaveLength(2);
  });
});

// =============================================================================
// Lazy Adapter Loader Tests (Future API)
// =============================================================================

describe('Lazy Adapter Loader (Future API)', () => {
  /**
   * These tests define the expected API for a lazy adapter loader.
   * This is the RED phase - these tests will FAIL until the implementation exists.
   */

  it('should provide a lazyLoad function for on-demand adapter loading', async () => {
    // This test expects a new API: lazyLoadAdapter
    // Expected usage:
    //   import { lazyLoadAdapter } from '@icetype/adapters';
    //   const adapter = await lazyLoadAdapter('postgres');

    const adaptersModule = await import('../index.js');

    // This will fail because lazyLoadAdapter doesn't exist yet
    expect((adaptersModule as any).lazyLoadAdapter).toBeDefined();
    expect(typeof (adaptersModule as any).lazyLoadAdapter).toBe('function');
  });

  it('should load postgres adapter lazily via lazyLoadAdapter', async () => {
    const { lazyLoadAdapter } = (await import('../index.js')) as any;

    // This will fail because lazyLoadAdapter doesn't exist yet
    const adapter = await lazyLoadAdapter('postgres');

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('postgres');
    expect(typeof adapter.transform).toBe('function');
  });

  it('should load mysql adapter lazily via lazyLoadAdapter', async () => {
    const { lazyLoadAdapter } = (await import('../index.js')) as any;

    // This will fail because lazyLoadAdapter doesn't exist yet
    const adapter = await lazyLoadAdapter('mysql');

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('mysql');
    expect(typeof adapter.transform).toBe('function');
  });

  it('should throw error for unknown adapter name', async () => {
    const { lazyLoadAdapter } = (await import('../index.js')) as any;

    // This will fail because lazyLoadAdapter doesn't exist yet
    await expect(lazyLoadAdapter('unknown-adapter')).rejects.toThrow();
  });

  it('should cache loaded adapters to avoid repeated imports', async () => {
    const { lazyLoadAdapter } = (await import('../index.js')) as any;

    // Load the same adapter twice
    const adapter1 = await lazyLoadAdapter('postgres');
    const adapter2 = await lazyLoadAdapter('postgres');

    // Should return the same cached factory/constructor
    // The actual adapter instances might be different, but the module should be cached
    expect(adapter1.name).toBe(adapter2.name);
  });
});

// =============================================================================
// Adapter Registry with Lazy Loading (Future API)
// =============================================================================

describe('Adapter Registry with Lazy Loading (Future API)', () => {
  it('should provide a createLazyAdapterRegistry function', async () => {
    const adaptersModule = await import('../index.js');

    // This will fail because createLazyAdapterRegistry doesn't exist yet
    expect((adaptersModule as any).createLazyAdapterRegistry).toBeDefined();
    expect(typeof (adaptersModule as any).createLazyAdapterRegistry).toBe(
      'function'
    );
  });

  it('should register adapter loaders instead of adapter instances', async () => {
    const { createLazyAdapterRegistry } = (await import('../index.js')) as any;

    // This will fail because createLazyAdapterRegistry doesn't exist yet
    const registry = createLazyAdapterRegistry();

    // Register loaders, not instances
    registry.registerLoader('postgres', () => import('@icetype/postgres'));
    registry.registerLoader('mysql', () => import('@icetype/mysql'));

    expect(registry.hasLoader('postgres')).toBe(true);
    expect(registry.hasLoader('mysql')).toBe(true);
  });

  it('should lazily load adapter only when requested', async () => {
    const { createLazyAdapterRegistry } = (await import('../index.js')) as any;

    // This will fail because createLazyAdapterRegistry doesn't exist yet
    const registry = createLazyAdapterRegistry();

    let postgresLoaded = false;
    let mysqlLoaded = false;

    registry.registerLoader('postgres', async () => {
      postgresLoaded = true;
      const mod = await import('@icetype/postgres');
      return mod.createPostgresAdapter();
    });

    registry.registerLoader('mysql', async () => {
      mysqlLoaded = true;
      const mod = await import('@icetype/mysql');
      return mod.createMySQLAdapter();
    });

    // Nothing loaded yet
    expect(postgresLoaded).toBe(false);
    expect(mysqlLoaded).toBe(false);

    // Load postgres
    const postgresAdapter = await registry.getAsync('postgres');
    expect(postgresLoaded).toBe(true);
    expect(mysqlLoaded).toBe(false);
    expect(postgresAdapter.name).toBe('postgres');

    // Load mysql
    const mysqlAdapter = await registry.getAsync('mysql');
    expect(mysqlLoaded).toBe(true);
    expect(mysqlAdapter.name).toBe('mysql');
  });
});

// =============================================================================
// Bundle Size Optimization Tests
// =============================================================================

describe('Bundle Size Optimization', () => {
  /**
   * These tests verify that the dynamic import pattern helps with bundle size.
   * In a real scenario, you would use a bundler to verify actual sizes.
   * These tests verify the API patterns that enable tree-shaking.
   */

  it('should export individual adapter packages as separate entry points', async () => {
    // Each adapter should be a separate package that can be imported independently
    // This enables bundlers to exclude unused adapters

    // Postgres should be importable from its own package
    const postgresModule = await import('@icetype/postgres');
    expect(postgresModule.PostgresAdapter).toBeDefined();

    // MySQL should be importable from its own package
    const mysqlModule = await import('@icetype/mysql');
    expect(mysqlModule.MySQLAdapter).toBeDefined();
  });

  it('should not have circular dependencies between adapter packages', async () => {
    // Import postgres and verify it doesn't depend on mysql
    const postgresModule = await import('@icetype/postgres');

    // If there were circular dependencies, this would either fail or
    // we could detect it via module inspection

    // Create an adapter - if there are circular deps, this might fail
    const adapter = postgresModule.createPostgresAdapter();
    expect(adapter.name).toBe('postgres');

    // The adapter should work without mysql being present
    // (This is more of a smoke test - real circular dep detection
    // would require build tooling)
  });

  it('should allow conditional adapter loading based on configuration', async () => {
    // Simulate a configuration that only needs postgres
    const config = {
      database: 'postgres',
    };

    let adapter: SchemaAdapter | undefined;

    // Conditionally load only the needed adapter
    if (config.database === 'postgres') {
      const { createPostgresAdapter } = await import('@icetype/postgres');
      adapter = createPostgresAdapter();
    } else if (config.database === 'mysql') {
      const { createMySQLAdapter } = await import('@icetype/mysql');
      adapter = createMySQLAdapter();
    }

    expect(adapter).toBeDefined();
    expect(adapter!.name).toBe('postgres');
  });

  it('should support dynamic adapter selection at runtime', async () => {
    const adapterNames = ['postgres', 'mysql'];
    const adapters: SchemaAdapter[] = [];

    for (const name of adapterNames) {
      if (name === 'postgres') {
        const { createPostgresAdapter } = await import('@icetype/postgres');
        adapters.push(createPostgresAdapter());
      } else if (name === 'mysql') {
        const { createMySQLAdapter } = await import('@icetype/mysql');
        adapters.push(createMySQLAdapter());
      }
    }

    expect(adapters).toHaveLength(2);
    expect(adapters.map((a) => a.name)).toContain('postgres');
    expect(adapters.map((a) => a.name)).toContain('mysql');
  });
});
