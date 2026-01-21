# @icetype/cli

IceType CLI - schema management and code generation. This package provides command-line tools for working with IceType schemas, including validation, code generation, and database migrations.

## Installation

```bash
npm install @icetype/cli
# or
pnpm add @icetype/cli

# Or install globally
npm install -g @icetype/cli
```

## Usage

### Command Line

```bash
# Initialize a new IceType project
ice init

# Generate code from schemas
ice generate

# Validate schemas
ice validate ./schema.ts

# Export to PostgreSQL DDL
ice postgres ./schema.ts --output ./migrations

# Export to ClickHouse DDL
ice clickhouse ./schema.ts

# Export to DuckDB DDL
ice duckdb ./schema.ts

# Export to Iceberg metadata
ice iceberg ./schema.ts --location s3://bucket/warehouse

# Export to Prisma schema
ice prisma ./schema.ts --output ./prisma/schema.prisma

# Export to Drizzle schema
ice drizzle ./schema.ts --output ./drizzle/schema.ts

# Import from Prisma
ice prisma:import ./prisma/schema.prisma

# Import from Drizzle
ice drizzle:import ./drizzle/schema.ts
```

### Programmatic API

```typescript
import {
  generate,
  validate,
  loadAllSchemas,
  postgresExport,
  drizzleExport,
  prismaImport,
} from '@icetype/cli';

// Load and validate schemas
const schemas = await loadAllSchemas('./schemas');
const validation = await validate('./schemas');

// Generate TypeScript interfaces
await generate({
  input: './schema.ts',
  output: './generated',
  format: 'typescript',
});

// Export to PostgreSQL
const ddl = await postgresExport('./schema.ts', {
  schema: 'public',
  ifNotExists: true,
});
```

## API

### Commands

| Export | Description |
|--------|-------------|
| `init()` | Initialize a new IceType project |
| `generate(options)` | Generate code from schemas |
| `validate(path)` | Validate schema files |
| `postgresExport(input, options)` | Export to PostgreSQL DDL |
| `clickhouseExport(input, options)` | Export to ClickHouse DDL |
| `duckdbExport(input, options)` | Export to DuckDB DDL |
| `icebergExport(input, options)` | Export to Iceberg metadata |
| `prismaExport(input, options)` | Export to Prisma schema |
| `prismaImport(input)` | Import from Prisma schema |
| `drizzleExport(input, options)` | Export to Drizzle schema |
| `drizzleImport(input)` | Import from Drizzle schema |

### Schema Loader

| Export | Description |
|--------|-------------|
| `loadSchemaFile(path)` | Load a single schema file |
| `loadAllSchemas(dir)` | Load all schemas from a directory |
| `loadSingleSchema(path)` | Load and parse a single schema |

### Utilities

| Export | Description |
|--------|-------------|
| `createLogger(options)` | Create a logger instance |
| `createWatcher(options)` | Create a file watcher for development |
| `watchGenerate(options)` | Watch files and regenerate on changes |
| `initializeAdapterRegistry()` | Initialize the global adapter registry |

### Configuration

| Export | Description |
|--------|-------------|
| `defineConfig(config)` | Define an IceType configuration |
| `loadConfig(path)` | Load configuration from file |
| `resolveConfig(config)` | Resolve and validate configuration |

## Examples

### Generate TypeScript Types

```typescript
import { generate, loadAllSchemas } from '@icetype/cli';

// Load schemas
const schemas = await loadAllSchemas('./schemas');

// Generate TypeScript interfaces
await generate({
  input: './schemas',
  output: './generated/types.ts',
  format: 'typescript',
});
```

### Export to Multiple Databases

```typescript
import {
  postgresExport,
  mysqlExport,
  sqliteExport,
} from '@icetype/cli';

const schemaPath = './schema.ts';

// Generate DDL for each database
const pgDDL = await postgresExport(schemaPath, { schema: 'public' });
const mysqlDDL = await mysqlExport(schemaPath, { charset: 'utf8mb4' });
const sqliteDDL = await sqliteExport(schemaPath, { strict: true });
```

### Watch Mode for Development

```typescript
import { watchGenerate, createLogger } from '@icetype/cli';

const logger = createLogger({ level: 'info' });

await watchGenerate({
  input: './schemas',
  output: './generated',
  format: 'typescript',
  logger,
  onChange: (files) => {
    logger.info(`Changed: ${files.join(', ')}`);
  },
});
```

### Configuration File (icetype.config.ts)

```typescript
import { defineConfig } from '@icetype/cli';

export default defineConfig({
  schemas: './schemas/**/*.ts',
  output: {
    types: './generated/types.ts',
    postgres: './migrations/postgres.sql',
    drizzle: './drizzle/schema.ts',
  },
  adapters: {
    postgres: {
      schema: 'public',
      ifNotExists: true,
    },
    drizzle: {
      dialect: 'pg',
    },
  },
  watch: {
    enabled: true,
    debounce: 100,
  },
});
```

### Import and Convert Schemas

```typescript
import { prismaImport, drizzleImport } from '@icetype/cli';

// Import from Prisma
const iceTypeSchemas = await prismaImport('./prisma/schema.prisma');
console.log(iceTypeSchemas);
// [{ $type: 'User', id: 'uuid!', email: 'string!#', ... }]

// Import from Drizzle
const schemas = await drizzleImport('./drizzle/schema.ts');
```

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/cli).

## Related Packages

- [`icetype`](../icetype) - Main entry point
- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter
- [`@icetype/drizzle`](../drizzle) - Drizzle ORM adapter
- [`@icetype/prisma`](../prisma) - Prisma adapter

## License

MIT
