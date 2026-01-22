/**
 * Adapter Registry Integration Tests for @icetype/cli
 *
 * Tests verifying that the CLI properly integrates with the adapter registry
 * pattern from @icetype/adapters.
 *
 * TDD Approach:
 * 1. RED: These tests should initially fail as the CLI doesn't use the registry yet
 * 2. GREEN: Implement adapter registration in CLI to make tests pass
 * 3. REFACTOR: Remove direct adapter imports from commands
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Adapter Registry Registration Tests
// =============================================================================

describe('CLI Adapter Registry Integration', () => {
  beforeEach(async () => {
    // Reset the adapter registry before each test to ensure isolation
    // This clears both the global registry and the initialized flag
    const { resetAdapterRegistry } = await import('../utils/adapter-registry.js');
    resetAdapterRegistry();
  });

  afterEach(async () => {
    // Clean up the adapter registry after each test
    const { resetAdapterRegistry } = await import('../utils/adapter-registry.js');
    resetAdapterRegistry();
  });

  describe('adapter registration at CLI startup', () => {
    it('should register all adapters when initializeAdapterRegistry is called', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      // Call the initialization function
      initializeAdapterRegistry();

      // Verify all expected adapters are registered
      expect(globalRegistry.has('postgres')).toBe(true);
      expect(globalRegistry.has('duckdb')).toBe(true);
      expect(globalRegistry.has('clickhouse')).toBe(true);
      expect(globalRegistry.has('iceberg')).toBe(true);
    });

    it('should return the list of registered adapter names', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      initializeAdapterRegistry();

      const adapterNames = globalRegistry.list();

      expect(adapterNames).toContain('postgres');
      expect(adapterNames).toContain('duckdb');
      expect(adapterNames).toContain('clickhouse');
      expect(adapterNames).toContain('iceberg');
    });

    it('should not throw when called multiple times (idempotent)', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');

      // Should not throw when called multiple times
      expect(() => {
        initializeAdapterRegistry();
        initializeAdapterRegistry();
      }).not.toThrow();
    });
  });

  describe('adapter retrieval from registry', () => {
    it('should retrieve postgres adapter from registry', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const adapter = getAdapter('postgres');

      expect(adapter).toBeDefined();
      expect(adapter?.name).toBe('postgres');
    });

    it('should retrieve duckdb adapter from registry', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const adapter = getAdapter('duckdb');

      expect(adapter).toBeDefined();
      expect(adapter?.name).toBe('duckdb');
    });

    it('should retrieve clickhouse adapter from registry', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const adapter = getAdapter('clickhouse');

      expect(adapter).toBeDefined();
      expect(adapter?.name).toBe('clickhouse');
    });

    it('should retrieve iceberg adapter from registry', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const adapter = getAdapter('iceberg');

      expect(adapter).toBeDefined();
      expect(adapter?.name).toBe('iceberg');
    });

    it('should return undefined for unknown adapter names', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const adapter = getAdapter('unknown');

      expect(adapter).toBeUndefined();
    });
  });

  describe('registry.has() verification', () => {
    it('should return true for postgres adapter', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      initializeAdapterRegistry();

      expect(globalRegistry.has('postgres')).toBe(true);
    });

    it('should return true for duckdb adapter', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      initializeAdapterRegistry();

      expect(globalRegistry.has('duckdb')).toBe(true);
    });

    it('should return true for clickhouse adapter', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      initializeAdapterRegistry();

      expect(globalRegistry.has('clickhouse')).toBe(true);
    });

    it('should return true for iceberg adapter', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      initializeAdapterRegistry();

      expect(globalRegistry.has('iceberg')).toBe(true);
    });

    it('should return false for non-existent adapters', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      initializeAdapterRegistry();

      expect(globalRegistry.has('oracle')).toBe(false);
      expect(globalRegistry.has('mongodb')).toBe(false);
    });
  });

  describe('adapter functionality verification', () => {
    it('should be able to transform schemas with retrieved postgres adapter', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');
      const { parseSchema } = await import('@icetype/core');

      initializeAdapterRegistry();

      const adapter = getAdapter('postgres');
      expect(adapter).toBeDefined();

      // Create a simple test schema
      const schema = parseSchema({
        $type: 'TestTable',
        id: 'uuid!',
        name: 'string',
      });

      // Verify the adapter can transform the schema
      const output = adapter!.transform(schema);
      expect(output).toBeDefined();
    });

    it('should be able to transform schemas with retrieved duckdb adapter', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');
      const { parseSchema } = await import('@icetype/core');

      initializeAdapterRegistry();

      const adapter = getAdapter('duckdb');
      expect(adapter).toBeDefined();

      const schema = parseSchema({
        $type: 'TestTable',
        id: 'uuid!',
        name: 'string',
      });

      const output = adapter!.transform(schema);
      expect(output).toBeDefined();
    });

    it('should be able to transform schemas with retrieved clickhouse adapter', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');
      const { parseSchema } = await import('@icetype/core');

      initializeAdapterRegistry();

      const adapter = getAdapter('clickhouse');
      expect(adapter).toBeDefined();

      const schema = parseSchema({
        $type: 'TestTable',
        id: 'uuid!',
        name: 'string',
      });

      const output = adapter!.transform(schema);
      expect(output).toBeDefined();
    });

    it('should be able to serialize transformed output', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');
      const { parseSchema } = await import('@icetype/core');

      initializeAdapterRegistry();

      const adapter = getAdapter('postgres');
      expect(adapter).toBeDefined();

      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        email: 'string#',
      });

      const ddl = adapter!.transform(schema);
      const sql = adapter!.serialize(ddl);

      expect(typeof sql).toBe('string');
      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('User');
    });
  });
});
