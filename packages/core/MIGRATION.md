# Migration Guide: Adapter to Plugin System

This guide helps you migrate from the legacy `@icetype/adapters` adapter system to the new unified plugin system in `@icetype/core`.

## Overview

The new plugin system provides:

- **Unified interface** for both adapters and plugins
- **Lifecycle hooks** (init, validate, transform, generate, dispose)
- **Dependency management** between plugins
- **Lazy loading** with auto-discovery
- **Type-safe generics** for full type inference

## Quick Comparison

| Feature | Adapter System | Plugin System |
|---------|---------------|---------------|
| Package | `@icetype/adapters` | `@icetype/core` |
| Interface | `SchemaAdapter` | `Plugin` / `TypedPlugin` |
| Transform | Synchronous | Asynchronous (Promise) |
| Lifecycle | None | init, validate, transform, generate, dispose |
| Dependencies | None | Declarative with version constraints |
| Discovery | Manual | Auto-discovery from node_modules |
| Type Safety | Basic generics | Full generic support with `TypedPlugin` |

## Migration Steps

### Step 1: Update Imports

**Before (Adapter System):**

```typescript
import { createAdapterRegistry, globalRegistry } from '@icetype/adapters';
import type { SchemaAdapter, AdapterRegistry } from '@icetype/adapters';
```

**After (Plugin System):**

```typescript
import { createPluginManager } from '@icetype/core';
import type { Plugin, TypedPlugin, PluginManager, SchemaAdapterCompat } from '@icetype/core';
```

### Step 2: Convert Adapter to Plugin

#### Basic Adapter

**Before:**

```typescript
import type { SchemaAdapter, IceTypeSchema } from '@icetype/adapters';

interface MyOutput {
  sql: string;
  tableName: string;
}

interface MyOptions {
  schemaName?: string;
}

const myAdapter: SchemaAdapter<MyOutput, MyOptions> = {
  name: 'my-adapter',
  version: '1.0.0',

  transform(schema: IceTypeSchema, options?: MyOptions): MyOutput {
    const schemaName = options?.schemaName ?? 'public';
    return {
      sql: `CREATE TABLE ${schemaName}.${schema.name} (...)`,
      tableName: schema.name,
    };
  },

  serialize(output: MyOutput): string {
    return output.sql;
  },
};
```

**After (Plugin):**

```typescript
import type { TypedPlugin, IceTypeSchema } from '@icetype/core';

interface MyContext {
  // Optional initialization context
}

interface MyOutput {
  sql: string;
  tableName: string;
}

interface MyOptions {
  schemaName?: string;
}

const myPlugin: TypedPlugin<MyContext, IceTypeSchema, MyOptions, MyOutput> = {
  name: 'my-adapter',
  version: '1.0.0',

  hooks: {
    // Transform is now async
    transform: async (schema, options) => {
      const schemaName = options?.schemaName ?? 'public';
      return {
        sql: `CREATE TABLE ${schemaName}.${schema.name} (...)`,
        tableName: schema.name,
      };
    },
  },
};
```

#### Adapter with Lifecycle Methods

**Before:**

```typescript
const myAdapter: SchemaAdapter<MyOutput, MyOptions> = {
  name: 'my-adapter',
  version: '1.0.0',

  transform(schema, options) {
    return { sql: '...', tableName: schema.name };
  },

  serialize(output) {
    return output.sql;
  },

  // Not part of SchemaAdapter interface - custom extension
  init() {
    console.log('Initializing...');
  },

  dispose() {
    console.log('Disposing...');
  },
};
```

**After (Plugin with Lifecycle):**

```typescript
const myPlugin: TypedPlugin<MyContext, IceTypeSchema, MyOptions, MyOutput> = {
  name: 'my-adapter',
  version: '1.0.0',

  hooks: {
    init: async (context) => {
      console.log('Initializing...');
    },

    transform: async (schema, options) => {
      return { sql: '...', tableName: schema.name };
    },

    // generate replaces serialize for string output
    generate: async (schema, options) => {
      const result = await myPlugin.hooks.transform(schema, options);
      return result.sql;
    },

    dispose: async () => {
      console.log('Disposing...');
    },
  },
};
```

### Step 3: Update Registry Usage

#### Creating a Registry

**Before:**

```typescript
import { createAdapterRegistry, globalRegistry } from '@icetype/adapters';

const registry = createAdapterRegistry();
registry.register(myAdapter);

const adapter = registry.get('my-adapter');
if (adapter) {
  const output = adapter.transform(schema, options);
  const sql = adapter.serialize(output);
}
```

**After:**

```typescript
import { createPluginManager } from '@icetype/core';

const manager = createPluginManager();
manager.register(myPlugin);

// Execute via plugin interface (async)
const output = await manager.execute('my-adapter', 'transform', schema, options);

// Or get the plugin directly
const plugin = manager.get('my-adapter');
if (plugin) {
  const output = await plugin.hooks.transform(schema, options);
}
```

#### Using Existing Adapters (Compatibility Mode)

If you have existing adapters you want to use with the plugin system, use `registerAdapter()`:

```typescript
import { createPluginManager } from '@icetype/core';
import { createPostgresAdapter } from '@icetype/postgres';

const manager = createPluginManager();

// Register existing adapter - it's wrapped automatically
manager.registerAdapter(createPostgresAdapter());

// Use via plugin interface
const output = await manager.execute('postgres', 'transform', schema, options);

// Or access the original adapter directly for sync methods
const adapter = manager.getAdapter('postgres');
if (adapter) {
  const output = adapter.transform(schema, options);  // Sync!
  const sql = adapter.serialize(output);
}
```

### Step 4: Add Validation (Optional)

The plugin system includes a validation hook that wasn't part of the adapter interface.

**After:**

```typescript
const myPlugin: TypedPlugin<MyContext, IceTypeSchema, MyOptions, MyOutput> = {
  name: 'my-adapter',
  version: '1.0.0',

  hooks: {
    validate: async (schema) => {
      const errors: Array<{ path: string; message: string; code: string }> = [];

      if (!schema.name) {
        errors.push({
          path: '$type',
          message: 'Schema must have a name',
          code: 'MISSING_NAME',
        });
      }

      return { valid: errors.length === 0, errors };
    },

    transform: async (schema, options) => {
      // Transform implementation
      return { sql: '...', tableName: schema.name };
    },
  },
};
```

### Step 5: Add Dependencies (Optional)

The plugin system supports declarative dependencies with version constraints.

```typescript
const extendedPlugin: TypedPlugin<MyContext, IceTypeSchema, MyOptions, MyOutput> = {
  name: 'extended-adapter',
  version: '1.0.0',

  // Declare dependencies
  dependencies: [
    { name: 'base-adapter', version: '^1.0.0' },           // Compatible with 1.x
    { name: 'utility-plugin', version: '~2.1.0' },         // Approximate 2.1.x
    { name: 'optional-plugin', version: '^1.0.0', optional: true },
  ],

  hooks: {
    transform: async (schema, options, deps) => {
      // Access dependency plugins
      const basePlugin = deps?.get('base-adapter');
      if (basePlugin) {
        // Use base plugin functionality
        const baseOutput = await basePlugin.hooks.transform(schema);
        // Extend it...
      }
      return { sql: '...', tableName: schema.name };
    },
  },
};
```

Initialize with dependencies:

```typescript
const manager = createPluginManager();
manager.register(basePlugin);
manager.register(extendedPlugin);

// Initialize plugin and all its dependencies
await manager.initializeWithDependencies('extended-adapter', context);

// Execute with dependency injection
const result = await manager.executeWithDependencies('extended-adapter', 'transform', schema);
```

## API Mapping Reference

### Registry Methods

| Adapter Registry | Plugin Manager | Notes |
|-----------------|----------------|-------|
| `register(adapter)` | `register(plugin)` | Same signature |
| `register(adapter)` | `registerAdapter(adapter)` | For adapter compat |
| `get(name)` | `get(name)` | Same, returns Plugin |
| `get(name)` | `getAdapter(name)` | Returns original adapter |
| `has(name)` | `has(name)` | Same |
| `list()` | `list()` | Same |
| `unregister(name)` | `unregister(name)` | Same |
| `clear()` | `clear()` | Same |
| - | `listPlugins()` | Plugins only |
| - | `listAdapters()` | Adapters only |

### Lazy Loading

| Adapter System | Plugin System | Notes |
|---------------|---------------|-------|
| `createLazyAdapterRegistry()` | `createPluginManager()` | Built-in |
| `registerLoader(name, fn)` | `registerLazy(name, fn)` | Same concept |
| `getAsync(name)` | `load(name)` | Returns Plugin |
| `hasLoader(name)` | `has(name)` | Checks both |
| - | `isLoaded(name)` | Check if loaded |
| - | `preload(names)` | Parallel loading |
| - | `unload(name)` | Remove from cache |

### Transform Execution

| Adapter System | Plugin System | Notes |
|---------------|---------------|-------|
| `adapter.transform(schema, opts)` | `manager.execute(name, 'transform', schema, opts)` | Async |
| `adapter.transform(schema, opts)` | `plugin.hooks.transform(schema, opts)` | Direct async |
| `adapter.transform(schema, opts)` | `adapter.transform(schema, opts)` | Via getAdapter() |
| `adapter.serialize(output)` | `manager.execute(name, 'generate', schema)` | Via generate hook |

## Configuration

### PluginManager Options

```typescript
const manager = createPluginManager({
  // Auto-discover adapters from node_modules
  autoDiscover: true,

  // Enable strict validation (throws instead of warns)
  strictMode: true,

  // Cache loaded plugins
  cacheEnabled: true,

  // Custom discovery patterns
  discoverPatterns: [
    'icetype-adapter-*',
    '@icetype/*',
    '@myorg/icetype-*',
  ],
});

// Wait for auto-discovery to complete
await manager.ready();
```

### Package.json Configuration

Adapters can be discovered automatically if they have the `icetype` field:

```json
{
  "name": "icetype-adapter-mydb",
  "version": "1.0.0",
  "icetype": {
    "adapter": true,
    "minCoreVersion": "1.0.0",
    "displayName": "MyDB Adapter",
    "capabilities": ["transform", "validate"]
  }
}
```

## Complete Migration Example

### Before: Legacy Adapter System

```typescript
// my-adapter.ts
import type { SchemaAdapter, IceTypeSchema } from '@icetype/adapters';

interface DDLOutput {
  createTable: string;
  indexes: string[];
}

export const myAdapter: SchemaAdapter<DDLOutput> = {
  name: 'mydb',
  version: '1.0.0',

  transform(schema: IceTypeSchema): DDLOutput {
    return {
      createTable: `CREATE TABLE ${schema.name} (...)`,
      indexes: [],
    };
  },

  serialize(output: DDLOutput): string {
    return output.createTable;
  },

  serializeWithIndexes(output: DDLOutput): string {
    return [output.createTable, ...output.indexes].join('\n');
  },
};

// usage.ts
import { createAdapterRegistry } from '@icetype/adapters';
import { myAdapter } from './my-adapter';

const registry = createAdapterRegistry();
registry.register(myAdapter);

const adapter = registry.get('mydb')!;
const output = adapter.transform(schema);
const sql = adapter.serialize(output);
```

### After: Plugin System

```typescript
// my-plugin.ts
import type { TypedPlugin, IceTypeSchema } from '@icetype/core';

interface DDLOutput {
  createTable: string;
  indexes: string[];
}

interface MyContext {
  logger?: { info: (msg: string) => void };
}

export const myPlugin: TypedPlugin<MyContext, IceTypeSchema, {}, DDLOutput> = {
  name: 'mydb',
  version: '1.0.0',

  hooks: {
    init: async (context) => {
      context.logger?.info('MyDB adapter initialized');
    },

    validate: async (schema) => {
      const errors = [];
      if (!schema.name) {
        errors.push({ path: '$type', message: 'Name required', code: 'E001' });
      }
      return { valid: errors.length === 0, errors };
    },

    transform: async (schema) => {
      return {
        createTable: `CREATE TABLE ${schema.name} (...)`,
        indexes: [],
      };
    },

    dispose: async () => {
      // Cleanup resources
    },
  },
};

// For backward compatibility, also export as adapter
export const myAdapter = {
  name: 'mydb',
  version: '1.0.0',
  transform: (schema: IceTypeSchema) => ({
    createTable: `CREATE TABLE ${schema.name} (...)`,
    indexes: [],
  }),
  serialize: (output: DDLOutput) => output.createTable,
  serializeWithIndexes: (output: DDLOutput) =>
    [output.createTable, ...output.indexes].join('\n'),
};

// usage.ts
import { createPluginManager } from '@icetype/core';
import { myPlugin, myAdapter } from './my-plugin';

const manager = createPluginManager();

// Option 1: Register as plugin (recommended)
manager.register(myPlugin);

await manager.initialize('mydb', { logger: console });
const output = await manager.execute('mydb', 'transform', schema);

// Option 2: Register legacy adapter for sync access
manager.registerAdapter(myAdapter);
const adapter = manager.getAdapter('mydb')!;
const sql = adapter.serialize(adapter.transform(schema));

// Cleanup
await manager.shutdown();
```

## Troubleshooting

### "Plugin must have a transform hook"

Ensure your plugin has a `transform` function in the `hooks` object:

```typescript
const plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  hooks: {
    transform: async (schema) => schema,  // Required!
  },
};
```

### "Hook 'xxx' not found on plugin"

Make sure you're calling a valid hook name: `init`, `validate`, `transform`, `generate`, or `dispose`.

### Adapter sync methods not working

Use `getAdapter()` instead of `get()` to access the original adapter with sync methods:

```typescript
// Wrong - get() returns Plugin with async hooks
const plugin = manager.get('postgres');
// plugin.transform is undefined!

// Correct - getAdapter() returns original adapter
const adapter = manager.getAdapter('postgres');
const output = adapter.transform(schema);  // Sync works!
```

### Dependencies not injected

Make sure to use `executeWithDependencies()` instead of `execute()`:

```typescript
// Wrong - deps will be undefined
const result = await manager.execute('my-plugin', 'transform', schema);

// Correct - deps Map is passed to transform hook
const result = await manager.executeWithDependencies('my-plugin', 'transform', schema);
```

## Need Help?

- Check the [Plugin System Documentation](./src/plugin-system.ts) for detailed API docs
- See [packages/adapters](../adapters/README.md) for legacy adapter documentation
- File an issue on GitHub if you encounter migration problems
