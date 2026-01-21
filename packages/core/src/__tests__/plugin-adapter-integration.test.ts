/**
 * Plugin-Adapter Integration Tests for @icetype/core
 *
 * RED phase TDD tests for integrating the plugin system with the adapter system.
 * These tests define the expected API for:
 * - Adapters can be registered as plugins
 * - Plugin lifecycle hooks work with adapters
 * - Unified discovery for both plugins and adapters
 * - Type compatibility between Plugin and SchemaAdapter
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  createPluginManager,
  type Plugin,
  type PluginManager,
  type PluginHooks,
} from '../plugin-system.js';

// Type imports for SchemaAdapter - these should be compatible with Plugin
import type { SchemaAdapter, AdapterRegistry } from '@icetype/adapters';
import type { IceTypeSchema } from '../types.js';

// =============================================================================
// Type Compatibility Tests
// =============================================================================

describe('Plugin-Adapter Type Compatibility', () => {
  /**
   * The SchemaAdapter interface should be usable as a Plugin.
   * This requires the adapter system to expose a compatible interface
   * or provide a wrapper/conversion utility.
   */
  describe('SchemaAdapter as Plugin', () => {
    it('should allow a SchemaAdapter to be wrapped as a Plugin', () => {
      // A minimal SchemaAdapter implementation
      const adapter: SchemaAdapter = {
        name: 'test-adapter',
        version: '1.0.0',
        transform: (schema: IceTypeSchema) => ({ transformed: schema }),
        serialize: (output) => JSON.stringify(output),
      };

      // We need a utility function to wrap SchemaAdapter as Plugin
      // This function should exist but doesn't yet - this test should FAIL
      const wrapAdapterAsPlugin = (adapter: SchemaAdapter): Plugin => {
        // Expected implementation would wrap the sync transform as async
        // and provide the required hooks interface
        return {
          name: adapter.name,
          version: adapter.version,
          hooks: {
            transform: async (schema: unknown, options?: unknown) => {
              return adapter.transform(schema as IceTypeSchema, options);
            },
          },
        };
      };

      const plugin = wrapAdapterAsPlugin(adapter);

      expect(plugin.name).toBe('test-adapter');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.hooks).toBeDefined();
      expect(typeof plugin.hooks.transform).toBe('function');
    });

    it('should preserve adapter serialize method when wrapping', async () => {
      const adapter: SchemaAdapter = {
        name: 'serializable-adapter',
        version: '1.0.0',
        transform: (schema: IceTypeSchema) => ({ data: schema }),
        serialize: (output) => JSON.stringify(output, null, 2),
      };

      // The wrapped plugin should preserve access to serialize
      // This requires an extended Plugin type or a wrapper that stores the original
      interface PluginWithAdapter extends Plugin {
        adapter?: SchemaAdapter;
      }

      const wrapAdapterAsPluginWithAccess = (adapter: SchemaAdapter): PluginWithAdapter => {
        return {
          name: adapter.name,
          version: adapter.version,
          adapter, // Preserve the original adapter
          hooks: {
            transform: async (schema: unknown, options?: unknown) => {
              return adapter.transform(schema as IceTypeSchema, options);
            },
          },
        };
      };

      const plugin = wrapAdapterAsPluginWithAccess(adapter);

      // Should still have access to serialize via the stored adapter
      expect(plugin.adapter?.serialize).toBeDefined();

      const result = await plugin.hooks.transform({ name: 'Test', fields: new Map() });
      const serialized = plugin.adapter?.serialize(result);
      expect(serialized).toContain('data');
    });

    it('should ensure Plugin transform signature is compatible with SchemaAdapter', async () => {
      // Plugin.hooks.transform has signature:
      // (schema: unknown, options?: unknown, deps?: Map<string, Plugin>) => Promise<unknown>

      // SchemaAdapter.transform has signature:
      // (schema: IceTypeSchema, options?: TOptions) => TOutput

      // We need to verify that adapters can be called through the plugin interface
      const manager = createPluginManager();

      const mockAdapter: SchemaAdapter<{ sql: string }, { tableName: string }> = {
        name: 'sql-adapter',
        version: '1.0.0',
        transform: (schema: IceTypeSchema, options?: { tableName: string }) => {
          const name = options?.tableName || schema.name;
          return { sql: `CREATE TABLE ${name} ();` };
        },
        serialize: (output) => output.sql,
      };

      // Wrap and register - this should work after implementation
      const wrappedPlugin: Plugin = {
        name: mockAdapter.name,
        version: mockAdapter.version,
        hooks: {
          transform: async (schema: unknown, options?: unknown) => {
            return mockAdapter.transform(
              schema as IceTypeSchema,
              options as { tableName: string } | undefined
            );
          },
        },
      };

      manager.register(wrappedPlugin);

      const schema: IceTypeSchema = {
        name: 'User',
        fields: new Map([['id', { type: 'uuid', required: true }]]),
      };

      const result = await manager.execute('sql-adapter', 'transform', schema, { tableName: 'users' });
      expect(result).toEqual({ sql: 'CREATE TABLE users ();' });
    });
  });
});

// =============================================================================
// Adapter Registration as Plugin Tests
// =============================================================================

describe('Adapter Registration as Plugin', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  /**
   * The PluginManager should have a method to directly register adapters.
   * This method should handle the conversion automatically.
   */
  it('should have registerAdapter method on PluginManager', () => {
    // This test will FAIL because registerAdapter doesn't exist yet
    expect((manager as unknown as { registerAdapter: unknown }).registerAdapter).toBeDefined();
    expect(typeof (manager as unknown as { registerAdapter: unknown }).registerAdapter).toBe('function');
  });

  it('should register a SchemaAdapter directly via registerAdapter', () => {
    const adapter: SchemaAdapter = {
      name: 'direct-register-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema) => schema,
      serialize: (output) => JSON.stringify(output),
    };

    // This will FAIL - registerAdapter doesn't exist
    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(adapter);

    expect(manager.has('direct-register-adapter')).toBe(true);
  });

  it('should auto-wrap adapter transform as async hook when registering', async () => {
    // Adapters have sync transform, plugins have async transform
    // The registration should handle this automatically
    let transformCalled = false;

    const syncAdapter: SchemaAdapter = {
      name: 'sync-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema) => {
        transformCalled = true;
        return { processed: schema };
      },
      serialize: (output) => JSON.stringify(output),
    };

    // Register via registerAdapter (should auto-wrap)
    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(syncAdapter);

    // Execute through plugin interface (async)
    await manager.execute('sync-adapter', 'transform', { name: 'Test', fields: new Map() });

    expect(transformCalled).toBe(true);
  });

  it('should preserve adapter metadata when registered as plugin', () => {
    const adapter: SchemaAdapter = {
      name: 'metadata-adapter',
      version: '2.1.0',
      transform: (schema: IceTypeSchema) => schema,
      serialize: (output) => JSON.stringify(output),
    };

    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(adapter);

    const plugin = manager.get('metadata-adapter');
    expect(plugin?.name).toBe('metadata-adapter');
    expect(plugin?.version).toBe('2.1.0');
  });

  it('should allow accessing original adapter from registered plugin', () => {
    const adapter: SchemaAdapter = {
      name: 'accessible-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema) => ({ converted: true }),
      serialize: (output) => JSON.stringify(output),
      serializeWithIndexes: (output) => JSON.stringify(output) + '\n-- indexes',
    };

    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(adapter);

    // Should be able to get the original adapter back
    const originalAdapter = (manager as unknown as { getAdapter: (name: string) => SchemaAdapter | undefined }).getAdapter('accessible-adapter');

    expect(originalAdapter).toBeDefined();
    expect(originalAdapter?.serialize({ converted: true })).toBe('{"converted":true}');
    expect(originalAdapter?.serializeWithIndexes?.({ converted: true })).toContain('-- indexes');
  });
});

// =============================================================================
// Plugin Lifecycle Hooks with Adapters Tests
// =============================================================================

describe('Plugin Lifecycle Hooks with Adapters', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  it('should call init hook on adapter if adapter has init method', async () => {
    const initSpy = vi.fn();

    // Extended adapter with lifecycle hooks
    interface AdapterWithLifecycle extends SchemaAdapter {
      init?: (context: unknown) => Promise<void>;
      dispose?: () => Promise<void>;
    }

    const adapterWithInit: AdapterWithLifecycle = {
      name: 'init-capable-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema) => schema,
      serialize: (output) => JSON.stringify(output),
      init: initSpy,
    };

    // When registered, the init method should be recognized
    (manager as unknown as { registerAdapter: (adapter: AdapterWithLifecycle) => void }).registerAdapter(adapterWithInit);

    await manager.initialize('init-capable-adapter', { config: {} });

    expect(initSpy).toHaveBeenCalled();
  });

  it('should call dispose hook on adapter if adapter has dispose method', async () => {
    const disposeSpy = vi.fn();

    interface AdapterWithLifecycle extends SchemaAdapter {
      dispose?: () => Promise<void>;
    }

    const adapterWithDispose: AdapterWithLifecycle = {
      name: 'dispose-capable-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema) => schema,
      serialize: (output) => JSON.stringify(output),
      dispose: disposeSpy,
    };

    (manager as unknown as { registerAdapter: (adapter: AdapterWithLifecycle) => void }).registerAdapter(adapterWithDispose);

    await manager.dispose('dispose-capable-adapter');

    expect(disposeSpy).toHaveBeenCalled();
  });

  it('should create validate hook from adapter if adapter has validate method', async () => {
    interface AdapterWithValidate extends SchemaAdapter {
      validate?: (schema: IceTypeSchema) => { valid: boolean; errors: string[] };
    }

    const adapterWithValidate: AdapterWithValidate = {
      name: 'validate-capable-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema) => schema,
      serialize: (output) => JSON.stringify(output),
      validate: (schema: IceTypeSchema) => {
        if (!schema.name) {
          return { valid: false, errors: ['Schema must have a name'] };
        }
        return { valid: true, errors: [] };
      },
    };

    (manager as unknown as { registerAdapter: (adapter: AdapterWithValidate) => void }).registerAdapter(adapterWithValidate);

    // The validate hook should be available through execute
    const result = await manager.execute('validate-capable-adapter', 'validate', { fields: new Map() });

    expect((result as { valid: boolean }).valid).toBe(false);
  });

  it('should support generate hook mapped from adapter serialize', async () => {
    const adapter: SchemaAdapter = {
      name: 'generate-capable-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema) => ({ ddl: `CREATE TABLE ${schema.name}` }),
      serialize: (output) => (output as { ddl: string }).ddl,
    };

    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(adapter);

    // After transform, should be able to call a generate hook that uses serialize
    const schema: IceTypeSchema = { name: 'users', fields: new Map() };
    const transformed = await manager.execute('generate-capable-adapter', 'transform', schema);

    // Generate hook should call serialize on the transformed result
    const generated = await manager.execute('generate-capable-adapter', 'generate', transformed);

    expect(generated).toBe('CREATE TABLE users');
  });
});

// =============================================================================
// Unified Discovery Tests
// =============================================================================

describe('Unified Discovery for Plugins and Adapters', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager({ autoDiscover: false });
  });

  afterEach(() => {
    manager.clear();
  });

  /**
   * The plugin system should be able to discover both:
   * - Traditional plugins (with hooks interface)
   * - Schema adapters (with transform/serialize interface)
   */
  it('should have unified discover method for both plugins and adapters', async () => {
    // This method should exist on PluginManager
    const discoverAll = (manager as unknown as { discoverAll: () => Promise<string[]> }).discoverAll;

    expect(discoverAll).toBeDefined();
    expect(typeof discoverAll).toBe('function');
  });

  it('should discover adapters with icetype-adapter-* pattern', async () => {
    // The unified discovery should find packages matching icetype-adapter-*
    const discovered = await (manager as unknown as {
      discoverAll: (options?: { patterns?: string[] }) => Promise<Array<{ name: string; type: 'plugin' | 'adapter' }>>
    }).discoverAll({
      patterns: ['icetype-adapter-*'],
    });

    // Result should indicate the type of each discovered item
    for (const item of discovered) {
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('type');
      expect(['plugin', 'adapter']).toContain(item.type);
    }
  });

  it('should discover plugins with icetype-plugin-* pattern', async () => {
    const discovered = await (manager as unknown as {
      discoverAll: (options?: { patterns?: string[] }) => Promise<Array<{ name: string; type: 'plugin' | 'adapter' }>>
    }).discoverAll({
      patterns: ['icetype-plugin-*'],
    });

    for (const item of discovered) {
      if (item.name.includes('plugin')) {
        expect(item.type).toBe('plugin');
      }
    }
  });

  it('should auto-register discovered adapters as plugins', async () => {
    // Create manager with auto-discovery enabled
    const autoManager = createPluginManager({
      autoDiscover: true,
      discoverPatterns: ['icetype-adapter-*', 'icetype-plugin-*'],
    });

    await autoManager.ready();

    // All discovered items should be available via manager.has()
    const discovered = autoManager.list();

    for (const name of discovered) {
      expect(autoManager.has(name)).toBe(true);
    }

    autoManager.clear();
  });

  it('should distinguish between plugin and adapter in manifest', async () => {
    // Adapters have icetype.adapter = true in package.json
    // Plugins have icetype.plugin = true in package.json

    const manifest = await manager.loadManifest('icetype-adapter-test');

    // Should have a way to check if it's an adapter or plugin
    expect(manifest.icetype).toBeDefined();
    expect(manifest.icetype).toHaveProperty('adapter');
  });

  it('should load adapter or plugin appropriately based on manifest', async () => {
    // When loading, should check manifest to determine if it's an adapter
    // and wrap appropriately

    manager.registerLazy('lazy-adapter', async () => {
      // Simulate loading a package that is an adapter
      return {
        name: 'lazy-adapter',
        version: '1.0.0',
        // This simulates what an adapter module might export
        hooks: {
          transform: async (schema: unknown) => schema,
        },
      };
    });

    const loaded = await manager.load('lazy-adapter');

    // Should have been properly wrapped/loaded
    expect(loaded.hooks.transform).toBeDefined();
  });
});

// =============================================================================
// Adapter Registry Integration Tests
// =============================================================================

describe('AdapterRegistry Integration with PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  /**
   * The PluginManager should be able to work alongside or incorporate
   * the AdapterRegistry functionality.
   */
  it('should export createUnifiedRegistry that combines both interfaces', () => {
    // We need a factory that creates a registry supporting both interfaces
    // This should be exported from the plugin system or a shared module

    // This test will FAIL - createUnifiedRegistry doesn't exist
    const createUnifiedRegistry = (manager as unknown as {
      createUnifiedRegistry?: () => AdapterRegistry & PluginManager
    }).createUnifiedRegistry;

    // Or it might be a standalone export
    // import { createUnifiedRegistry } from '../plugin-system.js';

    expect(createUnifiedRegistry).toBeDefined();
  });

  it('should allow iterating over all registered items regardless of type', () => {
    // Register a plugin
    manager.register({
      name: 'pure-plugin',
      version: '1.0.0',
      hooks: { transform: async (s) => s },
    });

    // Register an adapter (via the new method)
    const adapter: SchemaAdapter = {
      name: 'pure-adapter',
      version: '1.0.0',
      transform: (s: IceTypeSchema) => s,
      serialize: (o) => JSON.stringify(o),
    };

    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(adapter);

    // List should include both
    const all = manager.list();

    expect(all).toContain('pure-plugin');
    expect(all).toContain('pure-adapter');
  });

  it('should maintain separate namespaces if needed', () => {
    // Some use cases may want plugins and adapters in separate namespaces
    // e.g., plugins/my-plugin vs adapters/my-adapter

    // This could be done via prefixing or separate storage
    const listPlugins = (manager as unknown as { listPlugins?: () => string[] }).listPlugins;
    const listAdapters = (manager as unknown as { listAdapters?: () => string[] }).listAdapters;

    // If namespace separation is supported, these methods should exist
    // If not, this test documents that requirement
    expect(listPlugins || listAdapters).toBeDefined();
  });

  it('should support getting adapter-specific interface from registered adapter', () => {
    const adapter: SchemaAdapter<{ sql: string }, { dialect: string }> = {
      name: 'typed-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema, options?: { dialect: string }) => {
        return { sql: `-- ${options?.dialect || 'generic'}\nCREATE TABLE ${schema.name}` };
      },
      serialize: (output) => output.sql,
    };

    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(adapter);

    // Should be able to get back a typed adapter interface
    const retrieved = (manager as unknown as {
      getAdapter: <T, O>(name: string) => SchemaAdapter<T, O> | undefined
    }).getAdapter<{ sql: string }, { dialect: string }>('typed-adapter');

    expect(retrieved).toBeDefined();

    // Should be able to use adapter-specific methods
    const result = retrieved?.transform({ name: 'users', fields: new Map() }, { dialect: 'postgresql' });
    expect(result?.sql).toContain('postgresql');

    const serialized = retrieved?.serialize(result!);
    expect(serialized).toContain('CREATE TABLE users');
  });
});

// =============================================================================
// Edge Cases and Error Handling Tests
// =============================================================================

describe('Plugin-Adapter Integration Error Handling', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  it('should throw clear error when adapter transform fails', async () => {
    const failingAdapter: SchemaAdapter = {
      name: 'failing-transform-adapter',
      version: '1.0.0',
      transform: () => {
        throw new Error('Transform failed: invalid schema');
      },
      serialize: (o) => JSON.stringify(o),
    };

    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(failingAdapter);

    await expect(
      manager.execute('failing-transform-adapter', 'transform', {})
    ).rejects.toThrow(/transform/i);
  });

  it('should throw clear error when adapter serialize fails', async () => {
    const failingSerializeAdapter: SchemaAdapter = {
      name: 'failing-serialize-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema) => ({ circular: schema }),
      serialize: () => {
        throw new Error('Serialize failed: circular reference');
      },
    };

    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(failingSerializeAdapter);

    // After getting the adapter and calling serialize
    const adapter = (manager as unknown as {
      getAdapter: (name: string) => SchemaAdapter | undefined
    }).getAdapter('failing-serialize-adapter');

    expect(() => adapter?.serialize({ circular: {} })).toThrow(/serialize/i);
  });

  it('should handle adapter without optional methods gracefully', async () => {
    // Minimal adapter - no serializeWithIndexes
    const minimalAdapter: SchemaAdapter = {
      name: 'minimal-adapter',
      version: '1.0.0',
      transform: (schema: IceTypeSchema) => schema,
      serialize: (o) => JSON.stringify(o),
    };

    (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(minimalAdapter);

    // Should not throw when optional methods are missing
    const adapter = (manager as unknown as {
      getAdapter: (name: string) => SchemaAdapter | undefined
    }).getAdapter('minimal-adapter');

    expect(adapter?.serializeWithIndexes).toBeUndefined();

    // Should work fine with just required methods
    const result = adapter?.transform({ name: 'Test', fields: new Map() });
    expect(result).toBeDefined();
  });

  it('should prevent name collision between plugin and adapter', () => {
    // Register a plugin
    manager.register({
      name: 'collision-test',
      version: '1.0.0',
      hooks: { transform: async (s) => s },
    });

    // Try to register adapter with same name
    const adapter: SchemaAdapter = {
      name: 'collision-test',
      version: '1.0.0',
      transform: (s: IceTypeSchema) => s,
      serialize: (o) => JSON.stringify(o),
    };

    // Should throw or require force option
    expect(() => {
      (manager as unknown as { registerAdapter: (adapter: SchemaAdapter) => void }).registerAdapter(adapter);
    }).toThrow();
  });
});
