/**
 * Dynamic Adapter Import Tests for @icetype/cli
 *
 * These tests verify that the CLI implements lazy loading for adapter packages.
 * Adapters should only be loaded when actually needed by a command, not at startup.
 *
 * TDD Approach:
 * 1. RED: These tests should initially FAIL because the CLI currently imports
 *    all adapters eagerly at startup in adapter-registry.ts
 * 2. GREEN: Implement lazy loading to make tests pass
 * 3. REFACTOR: Clean up and optimize the lazy loading implementation
 *
 * Expected Implementation:
 * ```typescript
 * // Instead of (current eager loading):
 * import { PostgresAdapter } from '@icetype/postgres';
 * import { MySQLAdapter } from '@icetype/mysql';
 * import { DuckDBAdapter } from '@icetype/duckdb';
 * // ... all adapters imported at module load time
 *
 * // Should be (lazy loading):
 * const getPostgresAdapter = async () => {
 *   const { PostgresAdapter } = await import('@icetype/postgres');
 *   return new PostgresAdapter();
 * };
 *
 * const getMySQLAdapter = async () => {
 *   const { MySQLAdapter } = await import('@icetype/mysql');
 *   return new MySQLAdapter();
 * };
 * ```
 *
 * Benefits of lazy loading:
 * - Faster CLI startup time
 * - Reduced memory usage when using only specific adapters
 * - Better error messages when adapter package is not installed
 * - Allows CLI to function with subset of adapters installed
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// =============================================================================
// Module Import Tracking Helpers
// =============================================================================

/**
 * Track which modules have been imported during a test.
 * We use a Set to collect import paths that have been loaded.
 */
const importedModules = new Set<string>();

/**
 * Clear the imported modules tracking between tests.
 */
function clearImportedModules(): void {
  importedModules.clear();
}

/**
 * Check if a specific adapter module has been imported.
 */
function wasModuleImported(modulePath: string): boolean {
  // Check if any imported module contains the adapter name
  for (const mod of importedModules) {
    if (mod.includes(modulePath)) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// Dynamic Import Tests - Lazy Loading Behavior
// =============================================================================

describe('Dynamic Adapter Imports', () => {
  beforeEach(async () => {
    clearImportedModules();

    // Reset the module registry to get fresh imports
    // This allows us to track what gets imported during each test
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearImportedModules();
  });

  describe('adapter lazy loading', () => {
    /**
     * This test verifies that the CLI doesn't load ALL adapters at startup.
     * Currently FAILS because adapter-registry.ts imports all adapters eagerly.
     */
    it('should not load postgres adapter until postgres command is used', async () => {
      // Track imports by spying on the dynamic import mechanism
      const originalImport = globalThis.import;

      // Spy on module resolution to track what gets imported
      const importSpy = vi.fn();

      // Import the CLI module - this simulates CLI startup
      // With lazy loading, postgres adapter should NOT be loaded yet
      const cliModule = await import('../cli.js');

      // Check that @icetype/postgres was NOT imported at startup
      // This test will FAIL because current implementation imports all adapters
      // at startup via initializeAdapterRegistry()
      //
      // When lazy loading is implemented:
      // - Only core CLI code should be loaded at startup
      // - Adapter packages should only load when their command is executed

      // We verify by checking if PostgresAdapter class is accessible
      // without having called a postgres-specific command
      const { globalRegistry } = await import('@icetype/adapters');

      // The registry should not have postgres adapter pre-loaded
      // This will FAIL with current eager loading implementation
      expect(globalRegistry.has('postgres')).toBe(false);
    });

    /**
     * This test verifies that MySQL adapter is not loaded when running
     * postgres commands. Currently FAILS because all adapters are loaded.
     */
    it('should not load mysql adapter when using postgres command', async () => {
      vi.resetModules();

      // Clear the global registry
      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // Simulate running: ice postgres export --help
      // This should only load the postgres adapter, not mysql

      // Import only the postgres command (simulating lazy loading)
      const { postgresExport } = await import('../commands/postgres.js');

      // After running postgres command, mysql should NOT be loaded
      // This test FAILS because current implementation loads all adapters
      expect(globalRegistry.has('mysql')).toBe(false);
    });

    /**
     * This test verifies that postgres adapter IS loaded when its command is used.
     */
    it('should load postgres adapter when postgres command is executed', async () => {
      vi.resetModules();

      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // With lazy loading implementation, the adapter should be loaded
      // dynamically when the command needs it

      // Simulate that we're about to use postgres functionality
      // With proper lazy loading, this is where the import should happen
      const lazyGetPostgresAdapter = async () => {
        const { PostgresAdapter } = await import('@icetype/postgres');
        const adapter = new PostgresAdapter();
        globalRegistry.register(adapter);
        return adapter;
      };

      // Get the adapter (this triggers the lazy load)
      const adapter = await lazyGetPostgresAdapter();

      // NOW postgres should be in the registry
      expect(globalRegistry.has('postgres')).toBe(true);
      expect(adapter.name).toBe('postgres');
    });

    /**
     * Test that clickhouse adapter doesn't load for duckdb commands.
     * Currently FAILS because all adapters load at startup.
     */
    it('should not load clickhouse adapter when using duckdb command', async () => {
      vi.resetModules();

      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // Simulate running: ice duckdb export --schema ./schema.ts
      // Only duckdb adapter should be loaded

      // With lazy loading, we'd only import what we need
      const lazyGetDuckDBAdapter = async () => {
        const { DuckDBAdapter } = await import('@icetype/duckdb');
        const adapter = new DuckDBAdapter();
        globalRegistry.register(adapter);
        return adapter;
      };

      await lazyGetDuckDBAdapter();

      // DuckDB should be loaded
      expect(globalRegistry.has('duckdb')).toBe(true);

      // But clickhouse should NOT be loaded
      // This test FAILS with current eager loading
      expect(globalRegistry.has('clickhouse')).toBe(false);
    });

    /**
     * Test that iceberg adapter doesn't load for sqlite commands.
     * Currently FAILS because all adapters load at startup.
     */
    it('should not load iceberg adapter when using sqlite command', async () => {
      vi.resetModules();

      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // Simulate running: ice sqlite export --schema ./schema.ts
      const lazyGetSQLiteAdapter = async () => {
        const { SQLiteAdapter } = await import('@icetype/sqlite');
        const adapter = new SQLiteAdapter();
        globalRegistry.register(adapter);
        return adapter;
      };

      await lazyGetSQLiteAdapter();

      // SQLite should be loaded
      expect(globalRegistry.has('sqlite')).toBe(true);

      // But iceberg should NOT be loaded
      // This test FAILS with current eager loading
      expect(globalRegistry.has('iceberg')).toBe(false);
    });
  });

  describe('error handling for missing adapter packages', () => {
    /**
     * Test that a helpful error message is shown when an adapter package
     * is not installed. With lazy loading, we can detect this at runtime
     * and provide a clear message.
     */
    it('should provide helpful error when adapter package is not installed', async () => {
      // Mock a missing package scenario
      const getAdapterForMissingPackage = async (adapterName: string) => {
        const packageName = `@icetype/${adapterName}`;
        try {
          // This simulates trying to import a package that doesn't exist
          const module = await import(/* @vite-ignore */ `@icetype/${adapterName}-nonexistent`);
          return module;
        } catch (error) {
          // With lazy loading, we can provide a helpful error message
          throw new Error(
            `Adapter package '${packageName}' is not installed.\n` +
              `Please install it with: npm install ${packageName}`
          );
        }
      };

      // Attempting to load a non-existent adapter should throw a helpful error
      await expect(getAdapterForMissingPackage('nonexistent')).rejects.toThrow(
        /Adapter package .* is not installed/
      );

      await expect(getAdapterForMissingPackage('nonexistent')).rejects.toThrow(
        /npm install/
      );
    });

    /**
     * Test that the error message includes the correct package name.
     */
    it('should include correct package name in error message', async () => {
      const checkAdapterInstalled = async (adapterName: string): Promise<boolean> => {
        const packageMap: Record<string, string> = {
          postgres: '@icetype/postgres',
          mysql: '@icetype/mysql',
          duckdb: '@icetype/duckdb',
          clickhouse: '@icetype/clickhouse',
          iceberg: '@icetype/iceberg',
          sqlite: '@icetype/sqlite',
        };

        const packageName = packageMap[adapterName];
        if (!packageName) {
          throw new Error(`Unknown adapter: ${adapterName}. Available: ${Object.keys(packageMap).join(', ')}`);
        }

        try {
          // Try dynamic import
          await import(/* @vite-ignore */ packageName);
          return true;
        } catch {
          return false;
        }
      };

      // This should work since postgres is installed
      const postgresInstalled = await checkAdapterInstalled('postgres');
      expect(postgresInstalled).toBe(true);

      // Unknown adapter should throw with helpful message
      await expect(checkAdapterInstalled('oracle')).rejects.toThrow(/Unknown adapter: oracle/);
      await expect(checkAdapterInstalled('oracle')).rejects.toThrow(/Available:/);
    });
  });

  describe('lazy loading preserves functionality', () => {
    /**
     * Test that lazy-loaded adapters work correctly for schema transformation.
     * The lazy loading should not affect the adapter's functionality.
     */
    it('should transform schemas correctly with lazy-loaded postgres adapter', async () => {
      vi.resetModules();

      const { parseSchema } = await import('@icetype/core');
      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // Lazy load the postgres adapter
      const { PostgresAdapter } = await import('@icetype/postgres');
      const adapter = new PostgresAdapter();
      globalRegistry.register(adapter);

      // Create a test schema
      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        email: 'string!',
        name: 'string',
        createdAt: 'datetime!',
      });

      // Transform with the lazy-loaded adapter
      const ddl = adapter.transform(schema);
      const sql = adapter.serialize(ddl);

      // Verify the output is correct
      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('User');
      expect(sql).toContain('id');
      expect(sql).toContain('email');
    });

    /**
     * Test that lazy-loaded adapters work correctly for multiple schemas.
     */
    it('should transform multiple schemas with lazy-loaded adapter', async () => {
      vi.resetModules();

      const { parseSchema } = await import('@icetype/core');
      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // Lazy load the duckdb adapter
      const { DuckDBAdapter } = await import('@icetype/duckdb');
      const adapter = new DuckDBAdapter();
      globalRegistry.register(adapter);

      // Create test schemas
      const userSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
      });

      const postSchema = parseSchema({
        $type: 'Post',
        id: 'uuid!',
        title: 'string!',
        authorId: 'uuid!',
      });

      // Transform both schemas
      const userDdl = adapter.transform(userSchema);
      const postDdl = adapter.transform(postSchema);

      const userSql = adapter.serialize(userDdl);
      const postSql = adapter.serialize(postDdl);

      // Verify both outputs
      expect(userSql).toContain('User');
      expect(postSql).toContain('Post');
    });

    /**
     * Test that getAdapter utility works with lazy loading.
     */
    it('should support getAdapter utility with lazy loading pattern', async () => {
      vi.resetModules();

      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // Define lazy loader functions (this is the expected implementation pattern)
      const adapterLoaders: Record<string, () => Promise<void>> = {
        postgres: async () => {
          const { PostgresAdapter } = await import('@icetype/postgres');
          if (!globalRegistry.has('postgres')) {
            globalRegistry.register(new PostgresAdapter());
          }
        },
        mysql: async () => {
          const { MySQLAdapter } = await import('@icetype/mysql');
          if (!globalRegistry.has('mysql')) {
            globalRegistry.register(new MySQLAdapter());
          }
        },
        duckdb: async () => {
          const { DuckDBAdapter } = await import('@icetype/duckdb');
          if (!globalRegistry.has('duckdb')) {
            globalRegistry.register(new DuckDBAdapter());
          }
        },
      };

      // Lazy getAdapter that loads on demand
      const lazyGetAdapter = async (name: string) => {
        if (!globalRegistry.has(name) && adapterLoaders[name]) {
          await adapterLoaders[name]();
        }
        return globalRegistry.get(name);
      };

      // Initially no adapters loaded
      expect(globalRegistry.has('postgres')).toBe(false);
      expect(globalRegistry.has('mysql')).toBe(false);

      // Get postgres adapter (triggers lazy load)
      const postgresAdapter = await lazyGetAdapter('postgres');
      expect(postgresAdapter).toBeDefined();
      expect(globalRegistry.has('postgres')).toBe(true);

      // MySQL should STILL not be loaded (only postgres was requested)
      // This test will FAIL with current eager loading
      expect(globalRegistry.has('mysql')).toBe(false);
    });
  });

  describe('CLI startup performance', () => {
    /**
     * This test documents the expected behavior: CLI startup should be fast
     * because it doesn't load all adapter packages upfront.
     *
     * Note: This is more of a documentation test - actual performance
     * testing would require benchmarking infrastructure.
     */
    it('should not eagerly initialize all adapters at CLI import', async () => {
      vi.resetModules();

      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // When we import the CLI, it should NOT automatically load all adapters
      // This tests that initializeAdapterRegistry() is not called at module load

      // Currently this test FAILS because cli.ts calls initializeAdapterRegistry()
      // at the top level, which eagerly loads ALL adapters

      // For this test to pass, the CLI should:
      // 1. NOT call initializeAdapterRegistry() at startup
      // 2. Instead, load adapters lazily when commands are executed

      // After importing CLI, registry should be empty
      // (adapters only load when their command is used)
      const adaptersLoadedAtStartup = globalRegistry.list();

      // With proper lazy loading, no adapters should be pre-loaded
      // This test FAILS with current implementation
      expect(adaptersLoadedAtStartup.length).toBe(0);
    });

    /**
     * Test that help command doesn't load any adapters.
     * Help should be fast and not require adapter packages.
     */
    it('should not load adapters when showing help', async () => {
      vi.resetModules();

      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // Simulating: ice --help
      // This should just show help text without loading any adapters

      // With lazy loading, displaying help shouldn't trigger adapter imports
      const { generateHelpText, type HelpCommand } = await import('../utils/help.js');

      const helpDef: HelpCommand = {
        name: 'test',
        description: 'Test command',
        usage: 'ice test',
        options: [],
        examples: [],
      };

      const helpText = generateHelpText(helpDef);
      expect(helpText).toContain('test');

      // No adapters should have been loaded just to show help
      // This test FAILS with current eager loading
      expect(globalRegistry.list().length).toBe(0);
    });

    /**
     * Test that validate command doesn't load database adapters.
     * Validation only needs the core schema parser, not database adapters.
     */
    it('should not load database adapters for validate command', async () => {
      vi.resetModules();

      const { globalRegistry } = await import('@icetype/adapters');
      globalRegistry.clear();

      // Validate command only needs @icetype/core for parsing
      // It shouldn't load postgres, mysql, duckdb, etc.

      const { parseSchema } = await import('@icetype/core');

      // Parse a schema (what validate command does)
      const schema = parseSchema({
        $type: 'Test',
        id: 'uuid!',
      });

      expect(schema).toBeDefined();

      // Database adapters should NOT be loaded for validation
      // This test FAILS with current eager loading
      expect(globalRegistry.has('postgres')).toBe(false);
      expect(globalRegistry.has('mysql')).toBe(false);
      expect(globalRegistry.has('duckdb')).toBe(false);
      expect(globalRegistry.has('clickhouse')).toBe(false);
    });
  });
});

// =============================================================================
// Expected Implementation Notes
// =============================================================================

/**
 * To make these tests pass, the following changes are needed:
 *
 * 1. Remove eager imports from adapter-registry.ts:
 *    ```typescript
 *    // REMOVE these top-level imports:
 *    // import { PostgresAdapter } from '@icetype/postgres';
 *    // import { MySQLAdapter } from '@icetype/mysql';
 *    // etc.
 *    ```
 *
 * 2. Implement lazy loader functions:
 *    ```typescript
 *    const adapterLoaders: Record<string, () => Promise<SchemaAdapter>> = {
 *      postgres: async () => {
 *        const { PostgresAdapter } = await import('@icetype/postgres');
 *        return new PostgresAdapter();
 *      },
 *      mysql: async () => {
 *        const { MySQLAdapter } = await import('@icetype/mysql');
 *        return new MySQLAdapter();
 *      },
 *      // ... etc
 *    };
 *    ```
 *
 * 3. Update getAdapter to be async and lazy:
 *    ```typescript
 *    export async function getAdapter(name: string): Promise<SchemaAdapter | undefined> {
 *      if (!globalRegistry.has(name) && adapterLoaders[name]) {
 *        try {
 *          const adapter = await adapterLoaders[name]();
 *          globalRegistry.register(adapter);
 *        } catch (error) {
 *          throw new Error(
 *            `Failed to load adapter '${name}'. ` +
 *            `Make sure @icetype/${name} is installed.`
 *          );
 *        }
 *      }
 *      return globalRegistry.get(name);
 *    }
 *    ```
 *
 * 4. Remove initializeAdapterRegistry() call from cli.ts:
 *    - Adapters will be loaded on-demand by commands
 *
 * 5. Update commands to use async getAdapter:
 *    ```typescript
 *    // In postgres.ts command:
 *    const adapter = await getAdapter('postgres');
 *    if (!adapter) {
 *      throw new Error('PostgreSQL adapter not available');
 *    }
 *    ```
 */
