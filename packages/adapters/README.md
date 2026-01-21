# @icetype/adapters

Adapter abstraction layer for IceType schema transformations. This package provides a unified interface for transforming IceType schemas to various output formats like Apache Iceberg, Parquet, SQL, and more.

## Installation

```bash
npm install @icetype/adapters
# or
pnpm add @icetype/adapters
```

## Quick Start

```typescript
import { parseSchema } from '@icetype/core';
import { createAdapterRegistry, globalRegistry } from '@icetype/adapters';
import { IcebergAdapter, ParquetAdapter } from '@icetype/iceberg';

// Parse an IceType schema
const schema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
});

// Create a registry and register adapters
const registry = createAdapterRegistry();
registry.register(new IcebergAdapter());
registry.register(new ParquetAdapter());

// Use the Iceberg adapter
const icebergAdapter = registry.get('iceberg');
const metadata = icebergAdapter?.transform(schema, {
  location: 's3://my-bucket/tables/users',
});
```

## API Reference

### Registry Functions

#### `createAdapterRegistry()`

Creates a new, isolated adapter registry instance.

```typescript
import { createAdapterRegistry } from '@icetype/adapters';

const registry = createAdapterRegistry();
registry.register(myAdapter);
```

Use this when you need separate adapter configurations for different contexts (testing, multi-tenant apps, etc.).

#### `globalRegistry`

A singleton registry for application-wide adapter registration.

```typescript
import { globalRegistry } from '@icetype/adapters';

// Register at startup
globalRegistry.register(new IcebergAdapter());

// Use anywhere in your app
const adapter = globalRegistry.get('iceberg');
```

### Registry Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `register(adapter)` | Register an adapter | `void` (throws if duplicate) |
| `get(name)` | Get adapter by name | `SchemaAdapter \| undefined` |
| `has(name)` | Check if adapter exists | `boolean` |
| `list()` | List all adapter names | `string[]` |
| `unregister(name)` | Remove an adapter | `boolean` |
| `clear()` | Remove all adapters | `void` |

### Types

#### `SchemaAdapter<TOutput, TOptions>`

Interface for implementing custom adapters:

```typescript
interface SchemaAdapter<TOutput = unknown, TOptions = unknown> {
  readonly name: string;           // Unique adapter identifier
  readonly version: string;        // Semver version
  transform(schema: IceTypeSchema, options?: TOptions): TOutput;
  serialize(output: TOutput): string;
  serializeWithIndexes?(output: TOutput): string;  // Optional
}
```

#### `IcebergAdapterOptions`

Options for the Iceberg adapter:

```typescript
interface IcebergAdapterOptions {
  location: string;                      // Table location (required)
  tableUuid?: string;                    // Optional table UUID
  properties?: Record<string, string>;   // Iceberg table properties
}
```

#### `ParquetAdapterOptions`

Options for the Parquet adapter:

```typescript
interface ParquetAdapterOptions {
  format?: 'object' | 'string';  // Output format (default: 'object')
}
```

## Creating Custom Adapters

Implement the `SchemaAdapter` interface to create your own adapter:

```typescript
import type { SchemaAdapter, IceTypeSchema } from '@icetype/adapters';

interface JsonSchemaOutput {
  $schema: string;
  type: string;
  properties: Record<string, unknown>;
  required: string[];
}

interface JsonSchemaOptions {
  draft?: '2020-12' | '2019-09' | 'draft-07';
}

const jsonSchemaAdapter: SchemaAdapter<JsonSchemaOutput, JsonSchemaOptions> = {
  name: 'json-schema',
  version: '1.0.0',

  transform(schema: IceTypeSchema, options?: JsonSchemaOptions): JsonSchemaOutput {
    const draft = options?.draft ?? '2020-12';
    return {
      $schema: `https://json-schema.org/draft/${draft}/schema`,
      type: 'object',
      properties: mapFieldsToProperties(schema.fields),
      required: getRequiredFields(schema.fields),
    };
  },

  serialize(output: JsonSchemaOutput): string {
    return JSON.stringify(output, null, 2);
  },
};
```

## Error Handling

The registry throws `AdapterError` when attempting to register a duplicate adapter:

```typescript
import { isAdapterError, ErrorCodes } from '@icetype/core';
import { createAdapterRegistry } from '@icetype/adapters';

const registry = createAdapterRegistry();
registry.register(myAdapter);

try {
  registry.register(myAdapter); // Duplicate!
} catch (error) {
  if (isAdapterError(error)) {
    console.log(error.code);        // 'ADAPTER_ALREADY_REGISTERED'
    console.log(error.adapterName); // 'my-adapter'
    console.log(error.operation);   // 'register'
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `ADAPTER_ALREADY_REGISTERED` | Attempted to register an adapter with a name that already exists |

### Replacing an Adapter

To replace an existing adapter, unregister it first:

```typescript
registry.unregister('my-adapter');
registry.register(newVersionAdapter);
```

## Testing

When using `globalRegistry` in tests, clear it between tests to prevent pollution:

```typescript
import { globalRegistry } from '@icetype/adapters';

describe('MyTests', () => {
  beforeEach(() => {
    globalRegistry.clear();
  });

  it('should work with mock adapter', () => {
    globalRegistry.register(mockAdapter);
    // ... test code
  });
});
```

For isolated tests, use `createAdapterRegistry()` instead:

```typescript
it('should use custom adapter', () => {
  const registry = createAdapterRegistry();
  registry.register(testAdapter);
  // Changes don't affect other tests
});
```

## Adapter Name Conventions

Adapter names can be any string, but we recommend:

- Use lowercase letters
- Use hyphens for multi-word names
- Be descriptive

**Good examples:**
- `iceberg`
- `parquet`
- `json-schema`
- `sqlite-ddl`

**Supported but not recommended:**
- Names with special characters
- Unicode names
- Empty strings
- Names with whitespace

## Bundle Size Optimization

This package is designed for optimal bundle size through tree-shaking and code splitting.

### Tree-Shaking

The package is marked with `"sideEffects": false` in package.json, enabling bundlers to eliminate unused code. Only the functions you actually import will be included in your bundle.

### Separate Entry Points

For minimal bundle size, import only what you need from specific entry points:

```typescript
// Full package - includes everything
import { createAdapterRegistry, lazyLoadAdapter } from '@icetype/adapters';

// Minimal - just the lazy loading utilities (smallest)
import { lazyLoadAdapter, createLazyAdapterRegistry } from '@icetype/adapters/lazy';

// Registry only - no lazy loading
import { createAdapterRegistry, globalRegistry } from '@icetype/adapters/registry';

// Types only - zero runtime cost
import type { SchemaAdapter, AdapterRegistry } from '@icetype/adapters/types';
```

### Dynamic Adapter Loading

For the smallest possible initial bundle, use dynamic imports with lazy loading:

```typescript
import { lazyLoadAdapter } from '@icetype/adapters/lazy';

// Adapter code is only loaded when needed
async function generateSQL(schema, dbType: 'postgres' | 'mysql') {
  const adapter = await lazyLoadAdapter(dbType);
  return adapter.transform(schema);
}
```

Or use the lazy registry for on-demand loading:

```typescript
import { createLazyAdapterRegistry } from '@icetype/adapters/lazy';

const registry = createLazyAdapterRegistry();

// Register loaders - adapters aren't loaded yet
registry.registerLoader('postgres', async () => {
  const { createPostgresAdapter } = await import('@icetype/postgres');
  return createPostgresAdapter();
});

registry.registerLoader('mysql', async () => {
  const { createMySQLAdapter } = await import('@icetype/mysql');
  return createMySQLAdapter();
});

// Adapter is loaded only when first requested
const adapter = await registry.getAsync('postgres');
```

### Import Recommendations by Use Case

| Use Case | Recommended Import | Bundle Impact |
|----------|-------------------|---------------|
| Single adapter, known at build time | Direct import from adapter package | Minimal |
| Multiple adapters, selected at runtime | `@icetype/adapters/lazy` | Small base + on-demand |
| Application-wide adapter registry | `@icetype/adapters/registry` | Medium |
| Full functionality | `@icetype/adapters` | Full |
| Type definitions only | `@icetype/adapters/types` | Zero runtime |

### Adapter Package Imports

Each adapter is a separate package for maximum code splitting:

```typescript
// Only loads postgres-specific code
const { createPostgresAdapter } = await import('@icetype/postgres');

// Only loads mysql-specific code
const { createMySQLAdapter } = await import('@icetype/mysql');
```

This pattern works well with bundlers like Vite, esbuild, and webpack that support dynamic imports and code splitting.

## License

MIT
