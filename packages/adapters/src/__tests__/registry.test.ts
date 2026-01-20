/**
 * Tests for AdapterRegistry implementation
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAdapterRegistry,
  globalRegistry,
} from '../registry.js';
import type { SchemaAdapter, AdapterRegistry } from '../types.js';
import { AdapterError, type IceTypeSchema } from '@icetype/core';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock adapter for testing
 */
function createMockAdapter(name: string, version = '1.0.0'): SchemaAdapter<string, unknown> {
  return {
    name,
    version,
    transform(_schema: IceTypeSchema, _options?: unknown): string {
      return `transformed-${name}`;
    },
    serialize(output: string): string {
      return output;
    },
  };
}

// =============================================================================
// createAdapterRegistry() Tests
// =============================================================================

describe('createAdapterRegistry()', () => {
  it('should create a new AdapterRegistry instance', () => {
    const registry = createAdapterRegistry();

    expect(registry).toBeDefined();
    expect(typeof registry.register).toBe('function');
    expect(typeof registry.get).toBe('function');
    expect(typeof registry.list).toBe('function');
    expect(typeof registry.has).toBe('function');
    expect(typeof registry.unregister).toBe('function');
    expect(typeof registry.clear).toBe('function');
  });

  it('should create independent registry instances', () => {
    const registry1 = createAdapterRegistry();
    const registry2 = createAdapterRegistry();

    const adapter = createMockAdapter('test-adapter');
    registry1.register(adapter);

    expect(registry1.has('test-adapter')).toBe(true);
    expect(registry2.has('test-adapter')).toBe(false);
  });

  it('should return an empty registry', () => {
    const registry = createAdapterRegistry();

    expect(registry.list()).toEqual([]);
    expect(registry.has('any')).toBe(false);
    expect(registry.get('any')).toBeUndefined();
  });
});

// =============================================================================
// register() Tests
// =============================================================================

describe('AdapterRegistry.register()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should register an adapter successfully', () => {
    const adapter = createMockAdapter('my-adapter');

    registry.register(adapter);

    expect(registry.has('my-adapter')).toBe(true);
    expect(registry.get('my-adapter')).toBe(adapter);
  });

  it('should register multiple adapters', () => {
    const adapter1 = createMockAdapter('adapter-1');
    const adapter2 = createMockAdapter('adapter-2');
    const adapter3 = createMockAdapter('adapter-3');

    registry.register(adapter1);
    registry.register(adapter2);
    registry.register(adapter3);

    expect(registry.has('adapter-1')).toBe(true);
    expect(registry.has('adapter-2')).toBe(true);
    expect(registry.has('adapter-3')).toBe(true);
    expect(registry.list()).toHaveLength(3);
  });

  it('should throw AdapterError when registering an adapter with a duplicate name', () => {
    const adapter1 = createMockAdapter('duplicate-name');
    const adapter2 = createMockAdapter('duplicate-name', '2.0.0');

    registry.register(adapter1);

    expect(() => registry.register(adapter2)).toThrow(AdapterError);
    expect(() => registry.register(adapter2)).toThrow(/already registered/);
  });

  it('should preserve the exact adapter reference', () => {
    const adapter = createMockAdapter('ref-test');

    registry.register(adapter);

    const retrieved = registry.get('ref-test');
    expect(retrieved).toBe(adapter);
  });
});

// =============================================================================
// get() Tests
// =============================================================================

describe('AdapterRegistry.get()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should return the adapter by name', () => {
    const adapter = createMockAdapter('get-test');
    registry.register(adapter);

    const result = registry.get('get-test');

    expect(result).toBe(adapter);
    expect(result?.name).toBe('get-test');
  });

  it('should return undefined for non-existent adapter', () => {
    const result = registry.get('non-existent');

    expect(result).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    const result = registry.get('');

    expect(result).toBeUndefined();
  });

  it('should be case-sensitive', () => {
    const adapter = createMockAdapter('CaseSensitive');
    registry.register(adapter);

    expect(registry.get('CaseSensitive')).toBe(adapter);
    expect(registry.get('casesensitive')).toBeUndefined();
    expect(registry.get('CASESENSITIVE')).toBeUndefined();
  });
});

// =============================================================================
// list() Tests
// =============================================================================

describe('AdapterRegistry.list()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should return an empty array when no adapters are registered', () => {
    const result = registry.list();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all registered adapter names', () => {
    registry.register(createMockAdapter('alpha'));
    registry.register(createMockAdapter('beta'));
    registry.register(createMockAdapter('gamma'));

    const result = registry.list();

    expect(result).toHaveLength(3);
    expect(result).toContain('alpha');
    expect(result).toContain('beta');
    expect(result).toContain('gamma');
  });

  it('should return a new array instance on each call', () => {
    registry.register(createMockAdapter('test'));

    const list1 = registry.list();
    const list2 = registry.list();

    expect(list1).not.toBe(list2);
    expect(list1).toEqual(list2);
  });

  it('should reflect changes after register/unregister', () => {
    registry.register(createMockAdapter('first'));
    expect(registry.list()).toEqual(['first']);

    registry.register(createMockAdapter('second'));
    expect(registry.list()).toHaveLength(2);
    expect(registry.list()).toContain('second');

    registry.unregister('first');
    expect(registry.list()).toEqual(['second']);
  });
});

// =============================================================================
// has() Tests
// =============================================================================

describe('AdapterRegistry.has()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should return true for registered adapter', () => {
    registry.register(createMockAdapter('exists'));

    expect(registry.has('exists')).toBe(true);
  });

  it('should return false for non-existent adapter', () => {
    expect(registry.has('not-registered')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(registry.has('')).toBe(false);
  });

  it('should be case-sensitive', () => {
    registry.register(createMockAdapter('MyAdapter'));

    expect(registry.has('MyAdapter')).toBe(true);
    expect(registry.has('myadapter')).toBe(false);
    expect(registry.has('MYADAPTER')).toBe(false);
  });

  it('should reflect unregistration', () => {
    registry.register(createMockAdapter('temp'));

    expect(registry.has('temp')).toBe(true);

    registry.unregister('temp');

    expect(registry.has('temp')).toBe(false);
  });
});

// =============================================================================
// unregister() Tests
// =============================================================================

describe('AdapterRegistry.unregister()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should unregister an existing adapter and return true', () => {
    registry.register(createMockAdapter('to-remove'));

    const result = registry.unregister('to-remove');

    expect(result).toBe(true);
    expect(registry.has('to-remove')).toBe(false);
    expect(registry.get('to-remove')).toBeUndefined();
  });

  it('should return false for non-existent adapter', () => {
    const result = registry.unregister('never-registered');

    expect(result).toBe(false);
  });

  it('should return false when unregistering empty string', () => {
    const result = registry.unregister('');

    expect(result).toBe(false);
  });

  it('should only remove the specified adapter', () => {
    registry.register(createMockAdapter('keep-1'));
    registry.register(createMockAdapter('remove'));
    registry.register(createMockAdapter('keep-2'));

    registry.unregister('remove');

    expect(registry.has('keep-1')).toBe(true);
    expect(registry.has('remove')).toBe(false);
    expect(registry.has('keep-2')).toBe(true);
    expect(registry.list()).toHaveLength(2);
  });

  it('should allow re-registration after unregister', () => {
    const adapter1 = createMockAdapter('reuse', '1.0.0');
    const adapter2 = createMockAdapter('reuse', '2.0.0');

    registry.register(adapter1);
    registry.unregister('reuse');
    registry.register(adapter2);

    expect(registry.get('reuse')).toBe(adapter2);
    expect(registry.get('reuse')?.version).toBe('2.0.0');
  });
});

// =============================================================================
// clear() Tests
// =============================================================================

describe('AdapterRegistry.clear()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should remove all registered adapters', () => {
    registry.register(createMockAdapter('a'));
    registry.register(createMockAdapter('b'));
    registry.register(createMockAdapter('c'));

    registry.clear();

    expect(registry.list()).toEqual([]);
    expect(registry.has('a')).toBe(false);
    expect(registry.has('b')).toBe(false);
    expect(registry.has('c')).toBe(false);
  });

  it('should work on empty registry', () => {
    // Should not throw
    expect(() => registry.clear()).not.toThrow();
    expect(registry.list()).toEqual([]);
  });

  it('should allow registering after clear', () => {
    registry.register(createMockAdapter('old'));
    registry.clear();
    registry.register(createMockAdapter('new'));

    expect(registry.has('old')).toBe(false);
    expect(registry.has('new')).toBe(true);
    expect(registry.list()).toEqual(['new']);
  });
});

// =============================================================================
// globalRegistry Tests
// =============================================================================

describe('globalRegistry', () => {
  beforeEach(() => {
    // Clear global registry before each test to ensure isolation
    globalRegistry.clear();
  });

  it('should be an AdapterRegistry instance', () => {
    expect(globalRegistry).toBeDefined();
    expect(typeof globalRegistry.register).toBe('function');
    expect(typeof globalRegistry.get).toBe('function');
    expect(typeof globalRegistry.list).toBe('function');
    expect(typeof globalRegistry.has).toBe('function');
    expect(typeof globalRegistry.unregister).toBe('function');
    expect(typeof globalRegistry.clear).toBe('function');
  });

  it('should be a singleton', () => {
    // Register an adapter
    globalRegistry.register(createMockAdapter('singleton-test'));

    // Import again to verify it's the same instance
    // (We're testing that it persists across test assertions)
    expect(globalRegistry.has('singleton-test')).toBe(true);
  });

  it('should support all registry operations', () => {
    const adapter = createMockAdapter('global-adapter');

    // Register
    globalRegistry.register(adapter);
    expect(globalRegistry.has('global-adapter')).toBe(true);

    // Get
    expect(globalRegistry.get('global-adapter')).toBe(adapter);

    // List
    expect(globalRegistry.list()).toContain('global-adapter');

    // Unregister
    expect(globalRegistry.unregister('global-adapter')).toBe(true);
    expect(globalRegistry.has('global-adapter')).toBe(false);
  });

  it('should be independent from newly created registries', () => {
    const localRegistry = createAdapterRegistry();

    globalRegistry.register(createMockAdapter('global-only'));
    localRegistry.register(createMockAdapter('local-only'));

    expect(globalRegistry.has('global-only')).toBe(true);
    expect(globalRegistry.has('local-only')).toBe(false);
    expect(localRegistry.has('global-only')).toBe(false);
    expect(localRegistry.has('local-only')).toBe(true);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('AdapterRegistry Integration', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should support adapters with complex transform behavior', () => {
    const complexAdapter: SchemaAdapter<{ processed: boolean }, { option: string }> = {
      name: 'complex',
      version: '1.0.0',
      transform(_schema, options) {
        return { processed: options?.option === 'enabled' };
      },
      serialize(output) {
        return JSON.stringify(output);
      },
    };

    registry.register(complexAdapter);

    const retrieved = registry.get('complex');
    expect(retrieved).toBe(complexAdapter);
    expect(retrieved?.name).toBe('complex');
    expect(retrieved?.version).toBe('1.0.0');
  });

  it('should handle adapters with different output types', () => {
    const stringAdapter = createMockAdapter('string-out');
    const objectAdapter: SchemaAdapter<{ data: number }, void> = {
      name: 'object-out',
      version: '1.0.0',
      transform() {
        return { data: 42 };
      },
      serialize(output) {
        return JSON.stringify(output);
      },
    };

    registry.register(stringAdapter);
    registry.register(objectAdapter);

    expect(registry.get('string-out')).toBe(stringAdapter);
    expect(registry.get('object-out')).toBe(objectAdapter);
  });

  it('should maintain adapter order in list() based on registration order', () => {
    registry.register(createMockAdapter('first'));
    registry.register(createMockAdapter('second'));
    registry.register(createMockAdapter('third'));

    const list = registry.list();

    // Map preserves insertion order
    expect(list[0]).toBe('first');
    expect(list[1]).toBe('second');
    expect(list[2]).toBe('third');
  });
});
