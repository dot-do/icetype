/**
 * Dynamic Adapter Imports Tests for @icetype/adapters
 *
 * Tests for lazy loading/dynamic importing of adapters to reduce bundle size.
 *
 * NOTE: These tests have been updated to work without individual adapter packages
 * as devDependencies. The actual dynamic import tests that require @icetype/postgres,
 * @icetype/mysql, etc. have been moved to @icetype/integration-tests to avoid
 * cyclic dependencies.
 *
 * The tests here verify the lazy loading infrastructure works correctly with
 * mock adapters.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SchemaAdapter } from '@icetype/core';
import {
  lazyLoadAdapter,
  createLazyAdapterRegistry,
  createAdapterRegistry,
} from '../index.js';

// =============================================================================
// Lazy Adapter Loader Tests
// =============================================================================

describe('Lazy Adapter Loader', () => {
  it('should export lazyLoadAdapter function', async () => {
    expect(lazyLoadAdapter).toBeDefined();
    expect(typeof lazyLoadAdapter).toBe('function');
  });

  it('should throw error for unknown adapter name', async () => {
    await expect(lazyLoadAdapter('unknown-adapter')).rejects.toThrow(
      "Unknown adapter: 'unknown-adapter'"
    );
  });

  it('should list known adapters in error message', async () => {
    try {
      await lazyLoadAdapter('unknown-adapter');
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('postgres');
      expect((error as Error).message).toContain('mysql');
      expect((error as Error).message).toContain('sqlite');
    }
  });
});

// =============================================================================
// Lazy Adapter Registry Tests
// =============================================================================

describe('Lazy Adapter Registry', () => {
  it('should export createLazyAdapterRegistry function', () => {
    expect(createLazyAdapterRegistry).toBeDefined();
    expect(typeof createLazyAdapterRegistry).toBe('function');
  });

  it('should create a registry instance', () => {
    const registry = createLazyAdapterRegistry();

    expect(registry).toBeDefined();
    expect(typeof registry.registerLoader).toBe('function');
    expect(typeof registry.hasLoader).toBe('function');
    expect(typeof registry.getAsync).toBe('function');
    expect(typeof registry.list).toBe('function');
    expect(typeof registry.unregisterLoader).toBe('function');
    expect(typeof registry.clear).toBe('function');
  });

  it('should register and retrieve adapter loaders', async () => {
    const registry = createLazyAdapterRegistry();

    const mockAdapter: SchemaAdapter = {
      name: 'mock',
      version: '1.0.0',
      transform: () => ({ test: true }),
      serialize: (output) => JSON.stringify(output),
    };

    registry.registerLoader('mock', async () => mockAdapter);

    expect(registry.hasLoader('mock')).toBe(true);
    expect(registry.list()).toContain('mock');

    const adapter = await registry.getAsync('mock');
    expect(adapter).toBe(mockAdapter);
  });

  it('should return undefined for unregistered adapter', async () => {
    const registry = createLazyAdapterRegistry();

    const adapter = await registry.getAsync('nonexistent');
    expect(adapter).toBeUndefined();
  });

  it('should cache loaded adapters', async () => {
    const registry = createLazyAdapterRegistry();

    let loadCount = 0;
    const mockAdapter: SchemaAdapter = {
      name: 'mock',
      version: '1.0.0',
      transform: () => ({ test: true }),
      serialize: (output) => JSON.stringify(output),
    };

    registry.registerLoader('mock', async () => {
      loadCount++;
      return mockAdapter;
    });

    // Load twice
    await registry.getAsync('mock');
    await registry.getAsync('mock');

    // Loader should only be called once due to caching
    expect(loadCount).toBe(1);
  });

  it('should clear registered loaders', async () => {
    const registry = createLazyAdapterRegistry();

    const mockAdapter: SchemaAdapter = {
      name: 'mock',
      version: '1.0.0',
      transform: () => ({ test: true }),
      serialize: (output) => JSON.stringify(output),
    };

    registry.registerLoader('mock', async () => mockAdapter);
    expect(registry.hasLoader('mock')).toBe(true);

    registry.clear();
    expect(registry.hasLoader('mock')).toBe(false);
    expect(registry.list()).toHaveLength(0);
  });

  it('should unregister specific loaders', async () => {
    const registry = createLazyAdapterRegistry();

    const mockAdapter1: SchemaAdapter = {
      name: 'mock1',
      version: '1.0.0',
      transform: () => ({ test: 1 }),
      serialize: (output) => JSON.stringify(output),
    };

    const mockAdapter2: SchemaAdapter = {
      name: 'mock2',
      version: '1.0.0',
      transform: () => ({ test: 2 }),
      serialize: (output) => JSON.stringify(output),
    };

    registry.registerLoader('mock1', async () => mockAdapter1);
    registry.registerLoader('mock2', async () => mockAdapter2);

    expect(registry.list()).toHaveLength(2);

    const removed = registry.unregisterLoader('mock1');
    expect(removed).toBe(true);
    expect(registry.hasLoader('mock1')).toBe(false);
    expect(registry.hasLoader('mock2')).toBe(true);
  });
});

// =============================================================================
// Integration with Standard Registry
// =============================================================================

describe('Integration with Standard Registry', () => {
  it('should allow mixing lazy and standard registries', async () => {
    const standardRegistry = createAdapterRegistry();
    const lazyRegistry = createLazyAdapterRegistry();

    const mockAdapter: SchemaAdapter = {
      name: 'mock',
      version: '1.0.0',
      transform: () => ({ test: true }),
      serialize: (output) => JSON.stringify(output),
    };

    // Register in lazy registry
    lazyRegistry.registerLoader('mock', async () => mockAdapter);

    // Load from lazy registry
    const adapter = await lazyRegistry.getAsync('mock');

    // Register in standard registry
    if (adapter) {
      standardRegistry.register(adapter);
    }

    expect(standardRegistry.has('mock')).toBe(true);
    expect(standardRegistry.get('mock')).toBe(mockAdapter);
  });
});
