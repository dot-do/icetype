/**
 * Adapter Registry Tests for @icetype/adapters
 *
 * Tests for the AdapterRegistry implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAdapterRegistry, globalRegistry } from '../registry.js';
import type { SchemaAdapter, AdapterRegistry } from '../types.js';
import { AdapterError, ErrorCodes, isAdapterError } from '@icetype/core';
import type { IceTypeSchema } from '@icetype/core';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock adapter for testing.
 */
function createMockAdapter(name: string, version = '1.0.0'): SchemaAdapter<string> {
  return {
    name,
    version,
    transform(schema: IceTypeSchema): string {
      return `transformed:${schema.$type}`;
    },
    serialize(output: string): string {
      return output;
    },
  };
}

// =============================================================================
// createAdapterRegistry Tests
// =============================================================================

describe('createAdapterRegistry', () => {
  it('should create an empty registry', () => {
    const registry = createAdapterRegistry();
    expect(registry.list()).toEqual([]);
  });

  it('should create independent registries', () => {
    const registry1 = createAdapterRegistry();
    const registry2 = createAdapterRegistry();

    registry1.register(createMockAdapter('test-adapter'));

    expect(registry1.list()).toContain('test-adapter');
    expect(registry2.list()).not.toContain('test-adapter');
  });
});

// =============================================================================
// register() Tests
// =============================================================================

describe('register()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should add adapter to registry', () => {
    const adapter = createMockAdapter('test-adapter');
    registry.register(adapter);

    expect(registry.has('test-adapter')).toBe(true);
  });

  it('should allow registering multiple adapters', () => {
    registry.register(createMockAdapter('adapter-1'));
    registry.register(createMockAdapter('adapter-2'));
    registry.register(createMockAdapter('adapter-3'));

    expect(registry.list()).toHaveLength(3);
    expect(registry.list()).toContain('adapter-1');
    expect(registry.list()).toContain('adapter-2');
    expect(registry.list()).toContain('adapter-3');
  });

  it('should throw on duplicate name', () => {
    const adapter1 = createMockAdapter('duplicate-adapter');
    const adapter2 = createMockAdapter('duplicate-adapter');

    registry.register(adapter1);

    expect(() => registry.register(adapter2)).toThrow();
  });

  it('should throw AdapterError with correct code on duplicate', () => {
    const adapter = createMockAdapter('duplicate');
    registry.register(adapter);

    try {
      registry.register(createMockAdapter('duplicate'));
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('already registered');
    }
  });

  it('should throw AdapterError instance on duplicate registration', () => {
    const adapter = createMockAdapter('test-dup');
    registry.register(adapter);

    expect(() => registry.register(createMockAdapter('test-dup'))).toThrow(AdapterError);
  });

  it('should throw AdapterError with ADAPTER_ALREADY_REGISTERED code', () => {
    const adapter = createMockAdapter('code-test');
    registry.register(adapter);

    try {
      registry.register(createMockAdapter('code-test'));
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(isAdapterError(error)).toBe(true);
      if (isAdapterError(error)) {
        expect(error.code).toBe(ErrorCodes.ADAPTER_ALREADY_REGISTERED);
        expect(error.adapterName).toBe('code-test');
        expect(error.operation).toBe('register');
      }
    }
  });

  it('should preserve adapter reference identity', () => {
    const adapter = createMockAdapter('identity-test');
    registry.register(adapter);

    const retrieved = registry.get('identity-test');
    expect(retrieved).toBe(adapter);
  });
});

// =============================================================================
// get() Tests
// =============================================================================

describe('get()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should retrieve adapter by name', () => {
    const adapter = createMockAdapter('my-adapter', '2.0.0');
    registry.register(adapter);

    const retrieved = registry.get('my-adapter');
    expect(retrieved).toBe(adapter);
    expect(retrieved?.name).toBe('my-adapter');
    expect(retrieved?.version).toBe('2.0.0');
  });

  it('should return undefined for unknown name', () => {
    const result = registry.get('non-existent');
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty string name', () => {
    const result = registry.get('');
    expect(result).toBeUndefined();
  });

  it('should return the correct adapter when multiple exist', () => {
    const adapter1 = createMockAdapter('adapter-1', '1.0.0');
    const adapter2 = createMockAdapter('adapter-2', '2.0.0');
    const adapter3 = createMockAdapter('adapter-3', '3.0.0');

    registry.register(adapter1);
    registry.register(adapter2);
    registry.register(adapter3);

    expect(registry.get('adapter-2')?.version).toBe('2.0.0');
  });
});

// =============================================================================
// has() Tests
// =============================================================================

describe('has()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should return true for registered adapter', () => {
    registry.register(createMockAdapter('exists'));
    expect(registry.has('exists')).toBe(true);
  });

  it('should return false for unregistered adapter', () => {
    expect(registry.has('does-not-exist')).toBe(false);
  });

  it('should return false for empty registry', () => {
    expect(registry.has('anything')).toBe(false);
  });

  it('should return correct boolean after unregister', () => {
    registry.register(createMockAdapter('temp'));
    expect(registry.has('temp')).toBe(true);

    registry.unregister('temp');
    expect(registry.has('temp')).toBe(false);
  });
});

// =============================================================================
// list() Tests
// =============================================================================

describe('list()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should return empty array for empty registry', () => {
    expect(registry.list()).toEqual([]);
  });

  it('should return all registered names', () => {
    registry.register(createMockAdapter('alpha'));
    registry.register(createMockAdapter('beta'));
    registry.register(createMockAdapter('gamma'));

    const names = registry.list();
    expect(names).toHaveLength(3);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
    expect(names).toContain('gamma');
  });

  it('should return array that does not mutate registry', () => {
    registry.register(createMockAdapter('original'));

    const names = registry.list();
    names.push('fake');

    expect(registry.has('fake')).toBe(false);
    expect(registry.list()).not.toContain('fake');
  });
});

// =============================================================================
// unregister() Tests
// =============================================================================

describe('unregister()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should remove adapter from registry', () => {
    registry.register(createMockAdapter('removable'));
    expect(registry.has('removable')).toBe(true);

    registry.unregister('removable');
    expect(registry.has('removable')).toBe(false);
  });

  it('should return true when adapter was removed', () => {
    registry.register(createMockAdapter('to-remove'));
    const result = registry.unregister('to-remove');
    expect(result).toBe(true);
  });

  it('should return false when adapter was not registered', () => {
    const result = registry.unregister('never-existed');
    expect(result).toBe(false);
  });

  it('should not affect other adapters', () => {
    registry.register(createMockAdapter('keep-1'));
    registry.register(createMockAdapter('remove'));
    registry.register(createMockAdapter('keep-2'));

    registry.unregister('remove');

    expect(registry.has('keep-1')).toBe(true);
    expect(registry.has('keep-2')).toBe(true);
    expect(registry.list()).toHaveLength(2);
  });

  it('should allow re-registering after unregister', () => {
    const adapter = createMockAdapter('recycled', '1.0.0');
    registry.register(adapter);
    registry.unregister('recycled');

    const newAdapter = createMockAdapter('recycled', '2.0.0');
    registry.register(newAdapter);

    expect(registry.get('recycled')?.version).toBe('2.0.0');
  });
});

// =============================================================================
// clear() Tests
// =============================================================================

describe('clear()', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should remove all adapters', () => {
    registry.register(createMockAdapter('a'));
    registry.register(createMockAdapter('b'));
    registry.register(createMockAdapter('c'));

    expect(registry.list()).toHaveLength(3);

    registry.clear();

    expect(registry.list()).toHaveLength(0);
    expect(registry.has('a')).toBe(false);
    expect(registry.has('b')).toBe(false);
    expect(registry.has('c')).toBe(false);
  });

  it('should work on empty registry', () => {
    expect(() => registry.clear()).not.toThrow();
    expect(registry.list()).toEqual([]);
  });

  it('should allow registering after clear', () => {
    registry.register(createMockAdapter('before'));
    registry.clear();
    registry.register(createMockAdapter('after'));

    expect(registry.list()).toEqual(['after']);
  });
});

// =============================================================================
// globalRegistry Tests
// =============================================================================

describe('globalRegistry', () => {
  beforeEach(() => {
    // Clear global registry before each test
    globalRegistry.clear();
  });

  it('should be a valid AdapterRegistry', () => {
    expect(globalRegistry).toBeDefined();
    expect(typeof globalRegistry.register).toBe('function');
    expect(typeof globalRegistry.get).toBe('function');
    expect(typeof globalRegistry.list).toBe('function');
    expect(typeof globalRegistry.has).toBe('function');
    expect(typeof globalRegistry.unregister).toBe('function');
    expect(typeof globalRegistry.clear).toBe('function');
  });

  it('should persist across calls', () => {
    globalRegistry.register(createMockAdapter('global-test'));
    expect(globalRegistry.has('global-test')).toBe(true);
  });

  it('should be separate from created registries', () => {
    const localRegistry = createAdapterRegistry();
    globalRegistry.register(createMockAdapter('global-only'));

    expect(globalRegistry.has('global-only')).toBe(true);
    expect(localRegistry.has('global-only')).toBe(false);
  });
});

// =============================================================================
// Edge Cases: Adapter Name Handling
// =============================================================================

describe('edge cases: adapter name handling', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  describe('empty adapter name', () => {
    it('should allow registering adapter with empty string name', () => {
      const adapter = createMockAdapter('');
      registry.register(adapter);
      expect(registry.has('')).toBe(true);
    });

    it('should retrieve adapter with empty string name', () => {
      const adapter = createMockAdapter('');
      registry.register(adapter);
      expect(registry.get('')).toBe(adapter);
    });

    it('should list adapter with empty string name', () => {
      registry.register(createMockAdapter(''));
      expect(registry.list()).toContain('');
    });

    it('should unregister adapter with empty string name', () => {
      registry.register(createMockAdapter(''));
      expect(registry.unregister('')).toBe(true);
      expect(registry.has('')).toBe(false);
    });
  });

  describe('very long adapter names', () => {
    it('should handle adapter name with 1000 characters', () => {
      const longName = 'a'.repeat(1000);
      const adapter = createMockAdapter(longName);
      registry.register(adapter);

      expect(registry.has(longName)).toBe(true);
      expect(registry.get(longName)).toBe(adapter);
    });

    it('should handle adapter name with 10000 characters', () => {
      const veryLongName = 'x'.repeat(10000);
      const adapter = createMockAdapter(veryLongName);
      registry.register(adapter);

      expect(registry.has(veryLongName)).toBe(true);
      expect(registry.list()).toContain(veryLongName);
    });

    it('should distinguish between different long names', () => {
      const name1 = 'a'.repeat(500) + 'b'.repeat(500);
      const name2 = 'a'.repeat(500) + 'c'.repeat(500);

      registry.register(createMockAdapter(name1, '1.0.0'));
      registry.register(createMockAdapter(name2, '2.0.0'));

      expect(registry.get(name1)?.version).toBe('1.0.0');
      expect(registry.get(name2)?.version).toBe('2.0.0');
    });
  });

  describe('special characters in adapter names', () => {
    it('should handle Unicode characters', () => {
      const unicodeName = 'adapter-\u4E2D\u6587-\u65E5\u672C\u8A9E-\uD83D\uDE80';
      const adapter = createMockAdapter(unicodeName);
      registry.register(adapter);

      expect(registry.has(unicodeName)).toBe(true);
      expect(registry.get(unicodeName)).toBe(adapter);
    });

    it('should handle emoji in names', () => {
      const emojiName = 'rocket-adapter-\uD83D\uDE80\uD83D\uDCA5';
      const adapter = createMockAdapter(emojiName);
      registry.register(adapter);

      expect(registry.has(emojiName)).toBe(true);
    });

    it('should handle whitespace in names', () => {
      const nameWithSpaces = 'adapter with spaces';
      const nameWithTabs = 'adapter\twith\ttabs';
      const nameWithNewlines = 'adapter\nwith\nnewlines';

      registry.register(createMockAdapter(nameWithSpaces, '1.0.0'));
      registry.register(createMockAdapter(nameWithTabs, '2.0.0'));
      registry.register(createMockAdapter(nameWithNewlines, '3.0.0'));

      expect(registry.has(nameWithSpaces)).toBe(true);
      expect(registry.has(nameWithTabs)).toBe(true);
      expect(registry.has(nameWithNewlines)).toBe(true);
    });

    it('should handle special regex characters', () => {
      const regexChars = 'adapter[.*+?^${}()|\\]';
      const adapter = createMockAdapter(regexChars);
      registry.register(adapter);

      expect(registry.has(regexChars)).toBe(true);
      expect(registry.get(regexChars)).toBe(adapter);
    });

    it('should handle null characters', () => {
      const nameWithNull = 'adapter\0name';
      const adapter = createMockAdapter(nameWithNull);
      registry.register(adapter);

      expect(registry.has(nameWithNull)).toBe(true);
    });

    it('should handle names with leading/trailing whitespace', () => {
      const nameWithLeading = '  leading-space';
      const nameWithTrailing = 'trailing-space  ';
      const nameWithBoth = '  both  ';

      registry.register(createMockAdapter(nameWithLeading));
      registry.register(createMockAdapter(nameWithTrailing));
      registry.register(createMockAdapter(nameWithBoth));

      // These should be treated as different names
      expect(registry.list()).toHaveLength(3);
      expect(registry.has(nameWithLeading)).toBe(true);
      expect(registry.has(nameWithTrailing)).toBe(true);
      expect(registry.has(nameWithBoth)).toBe(true);
    });

    it('should handle names with only special characters', () => {
      const specialOnly = '!@#$%^&*()';
      const adapter = createMockAdapter(specialOnly);
      registry.register(adapter);

      expect(registry.has(specialOnly)).toBe(true);
      expect(registry.get(specialOnly)).toBe(adapter);
    });
  });
});

// =============================================================================
// Edge Cases: Re-registration After Unregister
// =============================================================================

describe('edge cases: re-registration after unregister', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should allow re-registering with same adapter instance', () => {
    const adapter = createMockAdapter('reuse-instance', '1.0.0');

    registry.register(adapter);
    registry.unregister('reuse-instance');
    registry.register(adapter);

    expect(registry.get('reuse-instance')).toBe(adapter);
  });

  it('should allow re-registering with different version', () => {
    registry.register(createMockAdapter('version-change', '1.0.0'));
    registry.unregister('version-change');
    registry.register(createMockAdapter('version-change', '2.0.0'));

    expect(registry.get('version-change')?.version).toBe('2.0.0');
  });

  it('should allow multiple register/unregister cycles', () => {
    for (let i = 0; i < 10; i++) {
      registry.register(createMockAdapter('cycling', `${i}.0.0`));
      expect(registry.has('cycling')).toBe(true);
      registry.unregister('cycling');
      expect(registry.has('cycling')).toBe(false);
    }

    registry.register(createMockAdapter('cycling', 'final'));
    expect(registry.get('cycling')?.version).toBe('final');
  });

  it('should not affect other adapters during re-registration', () => {
    registry.register(createMockAdapter('stable', '1.0.0'));
    registry.register(createMockAdapter('changing', '1.0.0'));
    registry.register(createMockAdapter('also-stable', '1.0.0'));

    registry.unregister('changing');
    registry.register(createMockAdapter('changing', '2.0.0'));

    expect(registry.get('stable')?.version).toBe('1.0.0');
    expect(registry.get('also-stable')?.version).toBe('1.0.0');
    expect(registry.get('changing')?.version).toBe('2.0.0');
  });

  it('should work with clear() followed by re-registration', () => {
    registry.register(createMockAdapter('before-clear', '1.0.0'));
    registry.clear();
    registry.register(createMockAdapter('after-clear', '1.0.0'));
    registry.register(createMockAdapter('before-clear', '2.0.0')); // Re-register same name

    expect(registry.list()).toHaveLength(2);
    expect(registry.get('before-clear')?.version).toBe('2.0.0');
    expect(registry.has('after-clear')).toBe(true);
  });
});

// =============================================================================
// Edge Cases: Concurrent-like Registry Operations
// =============================================================================

describe('edge cases: concurrent-like registry operations', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  it('should handle rapid sequential registrations', () => {
    const adapters: SchemaAdapter[] = [];
    for (let i = 0; i < 100; i++) {
      adapters.push(createMockAdapter(`rapid-${i}`));
    }

    adapters.forEach((adapter) => registry.register(adapter));

    expect(registry.list()).toHaveLength(100);
    for (let i = 0; i < 100; i++) {
      expect(registry.has(`rapid-${i}`)).toBe(true);
    }
  });

  it('should handle interleaved register/get operations', () => {
    for (let i = 0; i < 50; i++) {
      registry.register(createMockAdapter(`interleaved-${i}`, `${i}.0.0`));

      // Get a previously registered adapter
      if (i > 0) {
        const prevAdapter = registry.get(`interleaved-${i - 1}`);
        expect(prevAdapter?.version).toBe(`${i - 1}.0.0`);
      }
    }

    expect(registry.list()).toHaveLength(50);
  });

  it('should handle interleaved register/unregister operations', () => {
    // Register 10 adapters
    for (let i = 0; i < 10; i++) {
      registry.register(createMockAdapter(`batch-${i}`));
    }

    // Unregister every other one and register new ones
    for (let i = 0; i < 10; i += 2) {
      registry.unregister(`batch-${i}`);
      registry.register(createMockAdapter(`new-${i}`));
    }

    // Should have 5 original (odd indices) + 5 new (even indices replacement)
    expect(registry.list()).toHaveLength(10);
    expect(registry.has('batch-1')).toBe(true);
    expect(registry.has('batch-0')).toBe(false);
    expect(registry.has('new-0')).toBe(true);
  });

  it('should handle list() during modifications', () => {
    registry.register(createMockAdapter('a'));
    const list1 = registry.list();

    registry.register(createMockAdapter('b'));
    const list2 = registry.list();

    registry.unregister('a');
    const list3 = registry.list();

    // Lists should be independent snapshots
    expect(list1).toEqual(['a']);
    expect(list2).toEqual(['a', 'b']);
    expect(list3).toEqual(['b']);
  });

  it('should handle has() checks during modifications', () => {
    registry.register(createMockAdapter('check-me'));

    const hasBeforeUnregister = registry.has('check-me');
    registry.unregister('check-me');
    const hasAfterUnregister = registry.has('check-me');
    registry.register(createMockAdapter('check-me'));
    const hasAfterReregister = registry.has('check-me');

    expect(hasBeforeUnregister).toBe(true);
    expect(hasAfterUnregister).toBe(false);
    expect(hasAfterReregister).toBe(true);
  });

  it('should handle async simulation with Promise.all-like pattern', async () => {
    // Simulate concurrent-like operations using promises
    const operations = [
      Promise.resolve().then(() => registry.register(createMockAdapter('async-1'))),
      Promise.resolve().then(() => registry.register(createMockAdapter('async-2'))),
      Promise.resolve().then(() => registry.register(createMockAdapter('async-3'))),
    ];

    await Promise.all(operations);

    expect(registry.list()).toHaveLength(3);
    expect(registry.has('async-1')).toBe(true);
    expect(registry.has('async-2')).toBe(true);
    expect(registry.has('async-3')).toBe(true);
  });

  it('should handle mixed async operations', async () => {
    registry.register(createMockAdapter('pre-existing'));

    const operations = [
      Promise.resolve().then(() => {
        registry.register(createMockAdapter('added-1'));
        return registry.get('added-1');
      }),
      Promise.resolve().then(() => {
        registry.register(createMockAdapter('added-2'));
        return registry.list();
      }),
      Promise.resolve().then(() => {
        return registry.has('pre-existing');
      }),
    ];

    const results = await Promise.all(operations);

    expect(results[0]?.name).toBe('added-1');
    expect(results[2]).toBe(true);
    expect(registry.list().length).toBeGreaterThanOrEqual(3);
  });
});
