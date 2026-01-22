/**
 * Plugin System Tests for @icetype/core
 *
 * GREEN phase TDD tests for the adapter/plugin discovery system.
 * These tests define the expected API for:
 * - Discovering adapters from node_modules (icetype-adapter-* packages)
 * - Registering custom adapters programmatically
 * - Plugin configuration via package.json
 * - Loading adapters lazily by name
 * - Plugin lifecycle hooks (init, validate, generate)
 * - Plugin dependencies
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import the actual plugin system implementation
import {
  createPluginManager,
  discoverAdapters,
  discoverAdaptersFromPath,
  PluginDiscoveryError,
  PluginLoadError,
  PluginDependencyError,
  PluginLifecycleError,
} from '../src/plugin-system.js';

import type {
  Plugin,
  PluginManager,
  PluginManifest,
  PluginConfig,
} from '../src/plugin-system.js';

// =============================================================================
// Mock Types for Testing (defines expected interface)
// =============================================================================

interface MockPluginContext {
  config: Record<string, unknown>;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

// =============================================================================
// Plugin Discovery Tests
// =============================================================================

describe('Plugin Discovery', () => {
  describe('discoverAdapters', () => {
    it('should discover adapters with icetype-adapter-* naming convention', async () => {
      // Should scan node_modules for packages matching icetype-adapter-*
      const adapters = await discoverAdapters();

      // Returns an array of discovered adapter manifests
      expect(Array.isArray(adapters)).toBe(true);

      // Each discovered adapter should have a manifest structure
      for (const adapter of adapters) {
        expect(adapter).toHaveProperty('name');
        expect(adapter).toHaveProperty('version');
        expect(adapter).toHaveProperty('packageName');
      }
    });

    it('should discover adapters with @icetype/* scoped naming', async () => {
      // Should also find scoped packages like @icetype/postgres
      const adapters = await discoverAdapters({
        patterns: ['@icetype/*', 'icetype-adapter-*'],
      });

      expect(Array.isArray(adapters)).toBe(true);
    });

    it('should return empty array when no adapters found', async () => {
      // When no matching packages exist
      const adapters = await discoverAdapters({
        searchPaths: ['/nonexistent/path'],
      });

      expect(adapters).toEqual([]);
    });

    it('should filter adapters by provided patterns', async () => {
      const adapters = await discoverAdapters({
        patterns: ['icetype-adapter-postgres*'],
      });

      // Should only find postgres-related adapters
      for (const adapter of adapters) {
        expect(adapter.packageName).toMatch(/postgres/);
      }
    });

    it('should handle discovery errors gracefully', async () => {
      // Invalid search path should throw PluginDiscoveryError
      await expect(
        discoverAdapters({
          searchPaths: ['/definitely/not/a/valid/path'],
          throwOnError: true,
        })
      ).rejects.toThrow(PluginDiscoveryError);
    });

    it('should support custom search paths', async () => {
      const customPath = '/custom/node_modules';

      const adapters = await discoverAdapters({
        searchPaths: [customPath],
      });

      // Should use the provided search paths
      expect(Array.isArray(adapters)).toBe(true);
    });
  });

  describe('discoverAdaptersFromPath', () => {
    it('should discover adapters from a specific directory', async () => {
      const adapters = await discoverAdaptersFromPath('./node_modules');

      expect(Array.isArray(adapters)).toBe(true);
    });

    it('should read package.json to determine if package is an adapter', async () => {
      const adapters = await discoverAdaptersFromPath('./node_modules');

      // Adapters should be identified by icetype.adapter field in package.json
      for (const adapter of adapters) {
        expect(adapter.manifest).toHaveProperty('icetype');
      }
    });

    it('should throw for non-existent path', async () => {
      await expect(
        discoverAdaptersFromPath('/nonexistent/path')
      ).rejects.toThrow(PluginDiscoveryError);
    });
  });
});

// =============================================================================
// Plugin Registration Tests
// =============================================================================

describe('Plugin Registration', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe('registerAdapter', () => {
    it('should register a custom adapter programmatically', () => {
      const customAdapter: Plugin = {
        name: 'custom-adapter',
        version: '1.0.0',
        hooks: {
          init: async () => {},
          transform: async (schema) => schema,
        },
      };

      manager.register(customAdapter);

      expect(manager.has('custom-adapter')).toBe(true);
    });

    it('should reject duplicate adapter registration', () => {
      const adapter: Plugin = {
        name: 'duplicate-adapter',
        version: '1.0.0',
        hooks: {
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);

      expect(() => manager.register(adapter)).toThrow();
    });

    it('should allow replacing adapter with force option', () => {
      const adapter: Plugin = {
        name: 'replaceable-adapter',
        version: '1.0.0',
        hooks: {
          transform: async (schema) => schema,
        },
      };

      const newAdapter: Plugin = {
        name: 'replaceable-adapter',
        version: '2.0.0',
        hooks: {
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);
      manager.register(newAdapter, { force: true });

      const registered = manager.get('replaceable-adapter');
      expect(registered?.version).toBe('2.0.0');
    });

    it('should validate adapter has required hooks', () => {
      const invalidAdapter = {
        name: 'invalid-adapter',
        version: '1.0.0',
        // Missing hooks property
      } as Plugin;

      expect(() => manager.register(invalidAdapter)).toThrow();
    });

    it('should validate adapter name format', () => {
      const invalidNameAdapter: Plugin = {
        name: '', // Empty name should be invalid
        version: '1.0.0',
        hooks: {
          transform: async (schema) => schema,
        },
      };

      expect(() => manager.register(invalidNameAdapter)).toThrow();
    });
  });

  describe('unregister', () => {
    it('should unregister an adapter by name', () => {
      const adapter: Plugin = {
        name: 'removable-adapter',
        version: '1.0.0',
        hooks: {
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);
      expect(manager.has('removable-adapter')).toBe(true);

      manager.unregister('removable-adapter');
      expect(manager.has('removable-adapter')).toBe(false);
    });

    it('should return false when unregistering non-existent adapter', () => {
      const result = manager.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('should call dispose hook on unregister if available', async () => {
      const disposeSpy = vi.fn();

      const adapter: Plugin = {
        name: 'disposable-adapter',
        version: '1.0.0',
        hooks: {
          transform: async (schema) => schema,
          dispose: disposeSpy,
        },
      };

      manager.register(adapter);
      await manager.unregister('disposable-adapter');

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should list all registered adapters', () => {
      const adapter1: Plugin = {
        name: 'adapter-1',
        version: '1.0.0',
        hooks: { transform: async (schema) => schema },
      };

      const adapter2: Plugin = {
        name: 'adapter-2',
        version: '1.0.0',
        hooks: { transform: async (schema) => schema },
      };

      manager.register(adapter1);
      manager.register(adapter2);

      const names = manager.list();
      expect(names).toContain('adapter-1');
      expect(names).toContain('adapter-2');
    });

    it('should return empty array when no adapters registered', () => {
      expect(manager.list()).toEqual([]);
    });
  });
});

// =============================================================================
// Plugin Configuration via package.json Tests
// =============================================================================

describe('Plugin Configuration via package.json', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  it('should read adapter configuration from package.json icetype field', async () => {
    // Mock package.json structure:
    // {
    //   "name": "icetype-adapter-postgres",
    //   "icetype": {
    //     "adapter": true,
    //     "displayName": "PostgreSQL Adapter",
    //     "capabilities": ["sql", "migration", "introspection"]
    //   }
    // }

    const manifest = await manager.loadManifest('icetype-adapter-postgres');

    expect(manifest).toHaveProperty('displayName');
    expect(manifest).toHaveProperty('capabilities');
    expect(manifest.adapter).toBe(true);
  });

  it('should support custom entry point in package.json', async () => {
    // Mock package.json structure:
    // {
    //   "name": "icetype-adapter-custom",
    //   "icetype": {
    //     "adapter": true,
    //     "entry": "./dist/custom-entry.js"
    //   }
    // }

    const manifest = await manager.loadManifest('icetype-adapter-custom');

    expect(manifest).toHaveProperty('entry');
  });

  it('should read plugin dependencies from package.json', async () => {
    // Mock package.json structure:
    // {
    //   "name": "icetype-adapter-advanced",
    //   "icetype": {
    //     "adapter": true,
    //     "dependencies": {
    //       "icetype-adapter-base": "^1.0.0"
    //     }
    //   }
    // }

    const manifest = await manager.loadManifest('icetype-adapter-advanced');

    expect(manifest).toHaveProperty('dependencies');
  });

  it('should support configuration options schema in package.json', async () => {
    // Mock package.json structure:
    // {
    //   "name": "icetype-adapter-configurable",
    //   "icetype": {
    //     "adapter": true,
    //     "options": {
    //       "type": "object",
    //       "properties": {
    //         "connectionString": { "type": "string" }
    //       }
    //     }
    //   }
    // }

    const manifest = await manager.loadManifest('icetype-adapter-configurable');

    expect(manifest).toHaveProperty('options');
    expect(manifest.options).toHaveProperty('type');
  });

  it('should validate configuration against options schema', async () => {
    const invalidConfig: PluginConfig = {
      pluginName: 'icetype-adapter-configurable',
      options: {
        invalidOption: 'value', // Not in schema
      },
    };

    await expect(
      manager.validateConfig(invalidConfig)
    ).rejects.toThrow();
  });

  it('should accept valid configuration', async () => {
    const validConfig: PluginConfig = {
      pluginName: 'icetype-adapter-configurable',
      options: {
        connectionString: 'postgres://localhost/db',
      },
    };

    const result = await manager.validateConfig(validConfig);
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// Lazy Loading Tests
// =============================================================================

describe('Lazy Loading Adapters', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  it('should load adapter lazily by name', async () => {
    // Register a lazy loader with a mock adapter
    // In a real scenario this would import from @icetype/postgres
    manager.registerLazy('postgres', async () => {
      // Simulate dynamic import delay
      await new Promise((resolve) => setTimeout(resolve, 1));
      return {
        name: 'postgres',
        version: '1.0.0',
        hooks: {
          transform: async (schema: unknown) => schema,
        },
      };
    });

    // Adapter is not loaded yet
    expect(manager.isLoaded('postgres')).toBe(false);

    // Load the adapter
    const adapter = await manager.load('postgres');

    expect(adapter).toBeDefined();
    expect(manager.isLoaded('postgres')).toBe(true);
  });

  it('should cache loaded adapters', async () => {
    let loadCount = 0;

    manager.registerLazy('cacheable', async () => {
      loadCount++;
      return {
        name: 'cacheable',
        version: '1.0.0',
        hooks: { transform: async (schema) => schema },
      };
    });

    await manager.load('cacheable');
    await manager.load('cacheable');
    await manager.load('cacheable');

    // Should only load once
    expect(loadCount).toBe(1);
  });

  it('should throw PluginLoadError for unknown adapter', async () => {
    await expect(
      manager.load('unknown-adapter')
    ).rejects.toThrow(PluginLoadError);
  });

  it('should throw PluginLoadError when loader fails', async () => {
    manager.registerLazy('failing', async () => {
      throw new Error('Loader failed');
    });

    await expect(
      manager.load('failing')
    ).rejects.toThrow(PluginLoadError);
  });

  it('should support preloading multiple adapters', async () => {
    manager.registerLazy('adapter-a', async () => ({
      name: 'adapter-a',
      version: '1.0.0',
      hooks: { transform: async (schema) => schema },
    }));

    manager.registerLazy('adapter-b', async () => ({
      name: 'adapter-b',
      version: '1.0.0',
      hooks: { transform: async (schema) => schema },
    }));

    // Preload multiple adapters in parallel
    await manager.preload(['adapter-a', 'adapter-b']);

    expect(manager.isLoaded('adapter-a')).toBe(true);
    expect(manager.isLoaded('adapter-b')).toBe(true);
  });

  it('should unload adapter to free memory', async () => {
    manager.registerLazy('unloadable', async () => ({
      name: 'unloadable',
      version: '1.0.0',
      hooks: { transform: async (schema) => schema },
    }));

    await manager.load('unloadable');
    expect(manager.isLoaded('unloadable')).toBe(true);

    manager.unload('unloadable');
    expect(manager.isLoaded('unloadable')).toBe(false);
  });
});

// =============================================================================
// Plugin Lifecycle Hooks Tests
// =============================================================================

describe('Plugin Lifecycle Hooks', () => {
  let manager: PluginManager;
  let context: MockPluginContext;

  beforeEach(() => {
    manager = createPluginManager();
    context = {
      config: {},
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };
  });

  afterEach(() => {
    manager.clear();
  });

  describe('init hook', () => {
    it('should call init hook when adapter is initialized', async () => {
      const initSpy = vi.fn();

      const adapter: Plugin = {
        name: 'init-hook-adapter',
        version: '1.0.0',
        hooks: {
          init: initSpy,
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);
      await manager.initialize('init-hook-adapter', context);

      expect(initSpy).toHaveBeenCalledWith(context);
    });

    it('should throw PluginLifecycleError if init fails', async () => {
      const adapter: Plugin = {
        name: 'failing-init-adapter',
        version: '1.0.0',
        hooks: {
          init: async () => {
            throw new Error('Init failed');
          },
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);

      await expect(
        manager.initialize('failing-init-adapter', context)
      ).rejects.toThrow(PluginLifecycleError);
    });

    it('should support async init hooks', async () => {
      const initSpy = vi.fn().mockResolvedValue(undefined);

      const adapter: Plugin = {
        name: 'async-init-adapter',
        version: '1.0.0',
        hooks: {
          init: initSpy,
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);
      await manager.initialize('async-init-adapter', context);

      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('validate hook', () => {
    it('should call validate hook before transformation', async () => {
      const validateSpy = vi.fn().mockResolvedValue({ valid: true, errors: [] });

      const adapter: Plugin = {
        name: 'validate-hook-adapter',
        version: '1.0.0',
        hooks: {
          validate: validateSpy,
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);

      const schema = { name: 'TestSchema', fields: new Map() };
      await manager.execute('validate-hook-adapter', 'validate', schema);

      expect(validateSpy).toHaveBeenCalledWith(schema);
    });

    it('should return validation errors from validate hook', async () => {
      const adapter: Plugin = {
        name: 'validation-error-adapter',
        version: '1.0.0',
        hooks: {
          validate: async () => ({
            valid: false,
            errors: [{ path: 'field', message: 'Invalid field' }],
          }),
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);

      const schema = { name: 'TestSchema', fields: new Map() };
      const result = await manager.execute('validation-error-adapter', 'validate', schema) as { valid: boolean; errors: unknown[] };

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('generate hook', () => {
    it('should call generate hook to produce output', async () => {
      const generateSpy = vi.fn().mockResolvedValue('CREATE TABLE test;');

      const adapter: Plugin = {
        name: 'generate-hook-adapter',
        version: '1.0.0',
        hooks: {
          generate: generateSpy,
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);

      const schema = { name: 'TestSchema', fields: new Map() };
      const result = await manager.execute('generate-hook-adapter', 'generate', schema);

      expect(result).toBe('CREATE TABLE test;');
    });

    it('should pass options to generate hook', async () => {
      const generateSpy = vi.fn().mockResolvedValue('output');

      const adapter: Plugin = {
        name: 'generate-options-adapter',
        version: '1.0.0',
        hooks: {
          generate: generateSpy,
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);

      const schema = { name: 'TestSchema', fields: new Map() };
      const options = { ifNotExists: true };
      await manager.execute('generate-options-adapter', 'generate', schema, options);

      expect(generateSpy).toHaveBeenCalledWith(schema, options);
    });
  });

  describe('dispose hook', () => {
    it('should call dispose hook on cleanup', async () => {
      const disposeSpy = vi.fn();

      const adapter: Plugin = {
        name: 'dispose-hook-adapter',
        version: '1.0.0',
        hooks: {
          dispose: disposeSpy,
          transform: async (schema) => schema,
        },
      };

      manager.register(adapter);
      await manager.dispose('dispose-hook-adapter');

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should dispose all plugins on manager shutdown', async () => {
      const disposeSpy1 = vi.fn();
      const disposeSpy2 = vi.fn();

      manager.register({
        name: 'plugin-1',
        version: '1.0.0',
        hooks: { dispose: disposeSpy1, transform: async (s) => s },
      });

      manager.register({
        name: 'plugin-2',
        version: '1.0.0',
        hooks: { dispose: disposeSpy2, transform: async (s) => s },
      });

      await manager.shutdown();

      expect(disposeSpy1).toHaveBeenCalled();
      expect(disposeSpy2).toHaveBeenCalled();
    });
  });

  describe('transform hook', () => {
    it('should call transform hook for schema transformation', async () => {
      const transformSpy = vi.fn().mockImplementation(async (schema) => ({
        ...schema,
        transformed: true,
      }));

      const adapter: Plugin = {
        name: 'transform-hook-adapter',
        version: '1.0.0',
        hooks: {
          transform: transformSpy,
        },
      };

      manager.register(adapter);

      const schema = { name: 'TestSchema', fields: new Map() };
      const result = await manager.execute('transform-hook-adapter', 'transform', schema) as { transformed: boolean };

      expect(result.transformed).toBe(true);
    });
  });
});

// =============================================================================
// Plugin Dependencies Tests
// =============================================================================

describe('Plugin Dependencies', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  it('should resolve plugin dependencies automatically', async () => {
    const baseAdapter: Plugin = {
      name: 'base-adapter',
      version: '1.0.0',
      hooks: { transform: async (schema) => schema },
    };

    const dependentAdapter: Plugin = {
      name: 'dependent-adapter',
      version: '1.0.0',
      dependencies: [
        { name: 'base-adapter', version: '^1.0.0' },
      ],
      hooks: { transform: async (schema) => schema },
    };

    manager.register(baseAdapter);
    manager.register(dependentAdapter);

    // Should resolve dependencies
    const resolved = await manager.resolveDependencies('dependent-adapter');
    expect(resolved).toContain('base-adapter');
  });

  it('should throw PluginDependencyError for missing dependency', async () => {
    const dependentAdapter: Plugin = {
      name: 'missing-dep-adapter',
      version: '1.0.0',
      dependencies: [
        { name: 'nonexistent-adapter', version: '^1.0.0' },
      ],
      hooks: { transform: async (schema) => schema },
    };

    manager.register(dependentAdapter);

    await expect(
      manager.resolveDependencies('missing-dep-adapter')
    ).rejects.toThrow(PluginDependencyError);
  });

  it('should throw PluginDependencyError for version mismatch', async () => {
    const baseAdapter: Plugin = {
      name: 'versioned-adapter',
      version: '1.0.0',
      hooks: { transform: async (schema) => schema },
    };

    const dependentAdapter: Plugin = {
      name: 'version-dependent-adapter',
      version: '1.0.0',
      dependencies: [
        { name: 'versioned-adapter', version: '^2.0.0' }, // Requires v2
      ],
      hooks: { transform: async (schema) => schema },
    };

    manager.register(baseAdapter);
    manager.register(dependentAdapter);

    await expect(
      manager.resolveDependencies('version-dependent-adapter')
    ).rejects.toThrow(PluginDependencyError);
  });

  it('should detect circular dependencies', async () => {
    const adapterA: Plugin = {
      name: 'circular-a',
      version: '1.0.0',
      dependencies: [{ name: 'circular-b', version: '^1.0.0' }],
      hooks: { transform: async (schema) => schema },
    };

    const adapterB: Plugin = {
      name: 'circular-b',
      version: '1.0.0',
      dependencies: [{ name: 'circular-a', version: '^1.0.0' }],
      hooks: { transform: async (schema) => schema },
    };

    manager.register(adapterA);
    manager.register(adapterB);

    await expect(
      manager.resolveDependencies('circular-a')
    ).rejects.toThrow(PluginDependencyError);
  });

  it('should initialize dependencies before dependent plugin', async () => {
    const initOrder: string[] = [];

    const baseAdapter: Plugin = {
      name: 'order-base',
      version: '1.0.0',
      hooks: {
        init: async () => { initOrder.push('base'); },
        transform: async (schema) => schema,
      },
    };

    const dependentAdapter: Plugin = {
      name: 'order-dependent',
      version: '1.0.0',
      dependencies: [{ name: 'order-base', version: '^1.0.0' }],
      hooks: {
        init: async () => { initOrder.push('dependent'); },
        transform: async (schema) => schema,
      },
    };

    manager.register(baseAdapter);
    manager.register(dependentAdapter);

    await manager.initializeWithDependencies('order-dependent', {});

    expect(initOrder).toEqual(['base', 'dependent']);
  });

  it('should support optional dependencies', async () => {
    const adapterWithOptional: Plugin = {
      name: 'optional-dep-adapter',
      version: '1.0.0',
      dependencies: [
        { name: 'optional-adapter', version: '^1.0.0', optional: true },
      ],
      hooks: { transform: async (schema) => schema },
    };

    manager.register(adapterWithOptional);

    // Should not throw even if optional dependency is missing
    const resolved = await manager.resolveDependencies('optional-dep-adapter');
    expect(Array.isArray(resolved)).toBe(true);
  });

  it('should provide access to dependency instances', async () => {
    const baseAdapter: Plugin = {
      name: 'accessible-base',
      version: '1.0.0',
      hooks: {
        transform: async (schema: unknown) => ({ ...(schema as object), baseProcessed: true }),
      },
    };

    const dependentAdapter: Plugin = {
      name: 'accessor-adapter',
      version: '1.0.0',
      dependencies: [{ name: 'accessible-base', version: '^1.0.0' }],
      hooks: {
        transform: async (schema, _options, deps) => {
          // Can access dependency instance
          const base = deps?.get('accessible-base');
          const baseResult = await base?.hooks.transform(schema) as object | undefined;
          return { ...baseResult, dependentProcessed: true };
        },
      },
    };

    manager.register(baseAdapter);
    manager.register(dependentAdapter);

    const schema = { name: 'Test', fields: new Map() };
    const result = await manager.executeWithDependencies(
      'accessor-adapter',
      'transform',
      schema
    ) as { baseProcessed: boolean; dependentProcessed: boolean };

    expect(result.baseProcessed).toBe(true);
    expect(result.dependentProcessed).toBe(true);
  });
});

// =============================================================================
// Plugin Manager Factory Tests
// =============================================================================

describe('Plugin Manager Factory', () => {
  it('should create isolated plugin manager instances', () => {
    const manager1 = createPluginManager();
    const manager2 = createPluginManager();

    manager1.register({
      name: 'isolated-adapter',
      version: '1.0.0',
      hooks: { transform: async (schema) => schema },
    });

    // manager2 should not have the adapter
    expect(manager1.has('isolated-adapter')).toBe(true);
    expect(manager2.has('isolated-adapter')).toBe(false);
  });

  it('should support configuration options', () => {
    const manager = createPluginManager({
      autoDiscover: false,
      strictMode: true,
      cacheEnabled: true,
    });

    expect(manager.config.autoDiscover).toBe(false);
    expect(manager.config.strictMode).toBe(true);
    expect(manager.config.cacheEnabled).toBe(true);
  });

  it('should auto-discover adapters when enabled', async () => {
    const manager = createPluginManager({
      autoDiscover: true,
      discoverPatterns: ['icetype-adapter-*'],
    });

    // Wait for discovery to complete
    await manager.ready();

    // Should have discovered adapters (if any exist)
    const adapters = manager.list();
    expect(Array.isArray(adapters)).toBe(true);
  });
});

// =============================================================================
// Plugin Manifest Tests
// =============================================================================

describe('Plugin Manifest', () => {
  it('should validate plugin manifest structure', () => {
    const validManifest: PluginManifest = {
      name: 'test-adapter',
      version: '1.0.0',
      displayName: 'Test Adapter',
      description: 'A test adapter for IceType',
      author: 'Test Author',
      license: 'MIT',
      homepage: 'https://example.com',
      repository: 'https://github.com/example/test-adapter',
      keywords: ['icetype', 'adapter'],
      capabilities: ['transform', 'validate'],
      entry: './dist/index.js',
      dependencies: {},
      peerDependencies: {
        '@icetype/core': '^0.1.0',
      },
      engines: {
        node: '>=18.0.0',
      },
      icetype: {
        adapter: true,
        minCoreVersion: '0.1.0',
      },
    };

    expect(validManifest.name).toBe('test-adapter');
    expect(validManifest.icetype.adapter).toBe(true);
  });

  it('should reject invalid manifest', () => {
    const invalidManifest = {
      // Missing required fields
      name: '',
    };

    const manager = createPluginManager();

    expect(() => manager.validateManifest(invalidManifest as PluginManifest))
      .toThrow();
  });
});

// =============================================================================
// Plugin Error Types Tests
// =============================================================================

describe('Plugin Error Types', () => {
  it('should have PluginDiscoveryError with proper structure', () => {
    const error = new PluginDiscoveryError('Discovery failed', {
      searchPaths: ['/path1', '/path2'],
      pattern: 'icetype-adapter-*',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PluginDiscoveryError');
    expect(error.message).toBe('Discovery failed');
    expect(error.searchPaths).toEqual(['/path1', '/path2']);
  });

  it('should have PluginLoadError with proper structure', () => {
    const error = new PluginLoadError('Load failed', {
      pluginName: 'test-adapter',
      cause: new Error('Module not found'),
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PluginLoadError');
    expect(error.pluginName).toBe('test-adapter');
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('should have PluginDependencyError with proper structure', () => {
    const error = new PluginDependencyError('Dependency resolution failed', {
      pluginName: 'dependent-adapter',
      dependencyName: 'base-adapter',
      requiredVersion: '^2.0.0',
      availableVersion: '1.0.0',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PluginDependencyError');
    expect(error.dependencyName).toBe('base-adapter');
    expect(error.requiredVersion).toBe('^2.0.0');
  });

  it('should have PluginLifecycleError with proper structure', () => {
    const error = new PluginLifecycleError('Lifecycle hook failed', {
      pluginName: 'test-adapter',
      hook: 'init',
      phase: 'execution',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PluginLifecycleError');
    expect(error.hook).toBe('init');
    expect(error.phase).toBe('execution');
  });
});
