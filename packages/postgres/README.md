# @icetype/postgres

PostgreSQL adapter for IceType schema transformations. This package generates PostgreSQL DDL (Data Definition Language) statements from IceType schemas, with support for advanced PostgreSQL features.

## Installation

```bash
npm install @icetype/postgres
# or
pnpm add @icetype/postgres
```

## Usage

```typescript
import { parseSchema } from '@icetype/core';
import { PostgresAdapter, transformToPostgresDDL } from '@icetype/postgres';

// Parse an IceType schema
const schema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  age: 'int?',
  balance: 'decimal',
  tags: 'string[]',
  createdAt: 'timestamp',
});

// Option 1: Use the adapter directly
const adapter = new PostgresAdapter();
const ddl = adapter.transform(schema, { ifNotExists: true });
const sql = adapter.serialize(ddl);

// Option 2: Use the convenience function
const sql2 = transformToPostgresDDL(schema, {
  ifNotExists: true,
  schema: 'public',
});

console.log(sql2);
// CREATE TABLE IF NOT EXISTS "public"."User" (
//   "$id" TEXT NOT NULL,
//   "$type" TEXT NOT NULL,
//   "$version" INTEGER NOT NULL DEFAULT 1,
//   "$createdAt" BIGINT NOT NULL,
//   "$updatedAt" BIGINT NOT NULL,
//   "id" UUID NOT NULL,
//   "email" TEXT UNIQUE,
//   "name" TEXT,
//   "age" INTEGER,
//   "balance" DECIMAL(38, 9),
//   "tags" TEXT[],
//   "createdAt" TIMESTAMP,
//   PRIMARY KEY ("$id"),
//   UNIQUE ("email")
// );
```

## API

### Main Exports

| Export | Description |
|--------|-------------|
| `PostgresAdapter` | Adapter class for PostgreSQL DDL generation |
| `createPostgresAdapter()` | Factory function to create adapter |
| `transformToPostgresDDL(schema, options)` | Transform schema to DDL string |
| `generatePostgresDDL(schema, options)` | Generate DDL object |

### DDL Helpers

| Export | Description |
|--------|-------------|
| `mapIceTypeToPostgres(type)` | Map IceType to PostgreSQL type |
| `getPostgresTypeString(mapping)` | Get PostgreSQL type as string |
| `fieldToPostgresColumn(field)` | Convert field to column definition |
| `toArrayType(type)` | Convert type to array type |
| `serializeDDL(ddl)` | Serialize DDL object to SQL string |
| `generateIndexStatements(table, schema, columns)` | Generate CREATE INDEX statements |
| `escapeIdentifier(name)` | Escape identifier for PostgreSQL |

### Migration Exports

| Export | Description |
|--------|-------------|
| `PostgresMigrationGenerator` | Class for generating migration SQL |
| `createPostgresMigrationGenerator()` | Factory function for migrations |

### Validation

| Export | Description |
|--------|-------------|
| `validateSchemaName(name)` | Validate schema name for SQL injection |
| `InvalidSchemaNameError` | Error for invalid schema names |

### Types

| Type | Description |
|------|-------------|
| `PostgresType` | PostgreSQL data types |
| `PostgresColumn` | Column definition for PostgreSQL |
| `PostgresDDL` | Complete DDL structure |
| `PostgresAdapterOptions` | Options for DDL generation |

## Examples

### Basic Table Generation

```typescript
import { parseSchema } from '@icetype/core';
import { transformToPostgresDDL } from '@icetype/postgres';

const schema = parseSchema({
  $type: 'Product',
  id: 'uuid!',
  name: 'string!',
  price: 'decimal(10,2)!',
  stock: 'int!',
  tags: 'string[]',
  metadata: 'json?',
});

const sql = transformToPostgresDDL(schema, {
  schema: 'inventory',
  ifNotExists: true,
});
```

### With Schema Namespace

```typescript
const sql = transformToPostgresDDL(schema, {
  schema: 'my_schema',
  ifNotExists: true,
});
// Creates table in "my_schema" namespace
```

### Generate Multiple Tables

```typescript
import { PostgresAdapter } from '@icetype/postgres';

const adapter = new PostgresAdapter();
const schemas = [userSchema, postSchema, commentSchema];

const ddlStatements = schemas.map(schema => {
  const ddl = adapter.transform(schema, { schema: 'public' });
  return adapter.serialize(ddl);
});

// Combine with foreign keys at the end
const fullSQL = ddlStatements.join('\n\n');
```

### Using with Adapter Registry

```typescript
import { createAdapterRegistry } from '@icetype/adapters';
import { PostgresAdapter } from '@icetype/postgres';

const registry = createAdapterRegistry();
registry.register(new PostgresAdapter());

const adapter = registry.get('postgres');
const ddl = adapter?.transform(schema, { schema: 'public' });
const sql = adapter?.serialize(ddl);
```

### Generate Migrations

```typescript
import { diffSchemas, parseSchema } from '@icetype/core';
import { createPostgresMigrationGenerator } from '@icetype/postgres';

const oldSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string!',
});

const newSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string!',
  email: 'string!',
  createdAt: 'timestamp!',
});

const diff = diffSchemas(oldSchema, newSchema);
const generator = createPostgresMigrationGenerator();
const statements = generator.generate(diff);

console.log(statements);
// ['ALTER TABLE "User" ADD COLUMN "email" TEXT NOT NULL;',
//  'ALTER TABLE "User" ADD COLUMN "createdAt" TIMESTAMP NOT NULL;']
```

### Array Types

```typescript
const schema = parseSchema({
  $type: 'Document',
  id: 'uuid!',
  tags: 'string[]',          // TEXT[]
  scores: 'int[]',           // INTEGER[]
  embeddings: 'float[]',     // DOUBLE PRECISION[]
});

const sql = transformToPostgresDDL(schema);
// ... "tags" TEXT[], "scores" INTEGER[], "embeddings" DOUBLE PRECISION[] ...
```

### Generate Index Statements

```typescript
import { generateIndexStatements } from '@icetype/postgres';

const indexes = generateIndexStatements('User', 'public', [
  { name: 'email', type: 'TEXT', nullable: false, unique: true },
  { name: 'createdAt', type: 'TIMESTAMP', nullable: false },
]);
```

## Type Mappings

| IceType | PostgreSQL Type | Notes |
|---------|-----------------|-------|
| `string` | `TEXT` | |
| `text` | `TEXT` | |
| `int` | `INTEGER` | |
| `long` | `BIGINT` | |
| `bigint` | `BIGINT` | |
| `float` | `REAL` | |
| `double` | `DOUBLE PRECISION` | |
| `boolean` | `BOOLEAN` | |
| `uuid` | `UUID` | Native UUID type |
| `timestamp` | `TIMESTAMP` | |
| `date` | `DATE` | |
| `time` | `TIME` | |
| `binary` | `BYTEA` | |
| `json` | `JSONB` | Binary JSON |
| `decimal(p,s)` | `DECIMAL(p,s)` | |
| `string[]` | `TEXT[]` | Native arrays |

## PostgreSQL-Specific Features

- **Native UUID type**: Uses PostgreSQL's built-in UUID type
- **JSONB support**: JSON fields use JSONB for efficient querying
- **Array types**: Native PostgreSQL array support
- **Schema namespaces**: Full support for PostgreSQL schemas
- **Advanced indexes**: Support for unique, partial, and expression indexes

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/postgres).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`@icetype/sql-common`](../sql-common) - Shared SQL utilities
- [`@icetype/migrations`](../migrations) - Migration infrastructure
- [`@icetype/drizzle`](../drizzle) - Drizzle ORM adapter

## License

MIT
