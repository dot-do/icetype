# icetype

The main entry point for IceType - a type-safe schema language for data lakes and databases. This package re-exports all functionality from the IceType ecosystem, providing a unified API for schema parsing, validation, and transformation to multiple backend formats.

## Installation

```bash
npm install icetype
# or
pnpm add icetype
```

## Usage

```typescript
import { parseSchema, validateSchema, inferType } from 'icetype';

// Define a schema using IceType syntax
const userSchema = parseSchema({
  $type: 'User',
  $partitionBy: ['tenantId'],
  $index: [['email'], ['createdAt']],

  id: 'uuid!',           // Required UUID
  email: 'string#',      // Indexed string
  name: 'string',        // Regular string
  age: 'int?',           // Optional integer
  status: 'string = "active"',  // Default value
  posts: '<- Post.author[]',    // Backward relation
});

// Validate the schema
const result = validateSchema(userSchema);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## API

### Core Exports (from @icetype/core)

| Export | Description |
|--------|-------------|
| `parseSchema(input)` | Parse IceType schema definition |
| `validateSchema(schema)` | Validate a parsed schema |
| `diffSchemas(old, new)` | Compute diff between schemas |
| `inferType(value)` | Infer IceType from JavaScript value |
| `DB(schemas)` | Create database schema object |

### Iceberg Exports (from @icetype/iceberg)

| Export | Description |
|--------|-------------|
| `IcebergMetadataGenerator` | Generate Iceberg metadata |
| `generateIcebergMetadata(schema, options)` | Generate metadata directly |
| `ParquetSchemaGenerator` | Generate Parquet schemas |
| `generateParquetSchema(schema)` | Generate Parquet schema |
| `documentToParquetRow(doc, schema)` | Convert document to Parquet row |

### PostgreSQL Exports (from @icetype/postgres)

| Export | Description |
|--------|-------------|
| `PostgresAdapter` | PostgreSQL DDL adapter |
| `transformToPostgresDDL(schema, options)` | Generate PostgreSQL DDL |
| `mapIceTypeToPostgres(type)` | Map IceType to PostgreSQL type |

### MySQL Exports (from @icetype/mysql)

| Export | Description |
|--------|-------------|
| `MySQLAdapter` | MySQL DDL adapter |
| `transformToMySQLDDL(schema, options)` | Generate MySQL DDL |
| `mapIceTypeToMySQL(type)` | Map IceType to MySQL type |

### SQLite Exports (from @icetype/sqlite)

| Export | Description |
|--------|-------------|
| `SQLiteAdapter` | SQLite DDL adapter |
| `transformToSQLiteDDL(schema, options)` | Generate SQLite DDL |
| `mapIceTypeToSQLite(type)` | Map IceType to SQLite type |

### Drizzle Exports (from @icetype/drizzle)

| Export | Description |
|--------|-------------|
| `DrizzleAdapter` | Drizzle ORM adapter |
| `transformToDrizzle(schema, options)` | Generate Drizzle schema |
| `parseDrizzleSchema(code)` | Import Drizzle to IceType |

### Prisma Exports (from @icetype/prisma)

| Export | Description |
|--------|-------------|
| `PrismaAdapter` | Prisma adapter |
| `transformToPrisma(schema, options)` | Generate Prisma schema |
| `parsePrismaSchema(code)` | Import Prisma to IceType |

### Sub-Path Exports

You can also import from specific sub-paths for smaller bundles:

```typescript
// Core only
import { parseSchema } from 'icetype/core';

// Iceberg only
import { generateIcebergMetadata } from 'icetype/iceberg';

// PostgreSQL only
import { PostgresAdapter } from 'icetype/postgres';

// MySQL only
import { MySQLAdapter } from 'icetype/mysql';

// SQLite only
import { SQLiteAdapter } from 'icetype/sqlite';

// Drizzle only
import { DrizzleAdapter } from 'icetype/drizzle';

// Prisma only
import { PrismaAdapter } from 'icetype/prisma';

// ClickHouse only
import { ClickHouseAdapter } from 'icetype/clickhouse';

// DuckDB only
import { DuckDBAdapter } from 'icetype/duckdb';

// Adapters registry
import { createAdapterRegistry } from 'icetype/adapters';
```

## CLI

IceType includes a CLI for common tasks:

```bash
# Generate DDL from schema file
ice generate schema.ts --adapter postgres

# Diff two schema versions
ice diff schema-v1.ts schema-v2.ts

# Validate a schema file
ice validate schema.ts
```

## Examples

### Generate PostgreSQL DDL

```typescript
import { parseSchema, transformToPostgresDDL } from 'icetype';

const schema = parseSchema({
  $type: 'Product',
  id: 'uuid!',
  name: 'string!',
  price: 'decimal(10,2)!',
  stock: 'int!',
  createdAt: 'timestamp!',
});

const ddl = transformToPostgresDDL(schema, {
  schema: 'public',
  ifNotExists: true,
});

console.log(ddl);
// CREATE TABLE IF NOT EXISTS "public"."Product" (
//   "id" UUID NOT NULL,
//   "name" TEXT NOT NULL,
//   "price" DECIMAL(10,2) NOT NULL,
//   "stock" INTEGER NOT NULL,
//   "createdAt" TIMESTAMP NOT NULL,
//   PRIMARY KEY ("id")
// );
```

### Generate Apache Iceberg Metadata

```typescript
import { parseSchema, generateIcebergMetadata } from 'icetype';

const schema = parseSchema({
  $type: 'Event',
  id: 'uuid!',
  eventType: 'string!',
  timestamp: 'timestamp!',
  properties: 'json?',
});

const metadata = generateIcebergMetadata(schema, {
  location: 's3://my-bucket/tables/events',
});

console.log(JSON.stringify(metadata, null, 2));
```

### Generate Drizzle ORM Schema

```typescript
import { parseSchema, transformToDrizzle } from 'icetype';

const schema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string!#',
  name: 'string?',
});

const drizzleCode = transformToDrizzle(schema, { dialect: 'pg' });
console.log(drizzleCode);
// import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
//
// export const users = pgTable('users', {
//   id: uuid('id').primaryKey().notNull(),
//   email: varchar('email', { length: 255 }).notNull().unique(),
//   name: varchar('name', { length: 255 }),
// });
```

### Import from Prisma Schema

```typescript
import { parsePrismaSchema } from 'icetype';

const schemas = parsePrismaSchema(`
  model User {
    id    String @id @default(uuid())
    email String @unique
    name  String?
    posts Post[]
  }

  model Post {
    id       String @id @default(uuid())
    title    String
    author   User   @relation(fields: [authorId], references: [id])
    authorId String
  }
`);

console.log(schemas);
// [
//   { $type: 'User', id: 'uuid!', email: 'string!#', name: 'string?', posts: '[Post]' },
//   { $type: 'Post', id: 'uuid!', title: 'string!', author: 'User!', authorId: 'string!' }
// ]
```

### Schema Diffing for Migrations

```typescript
import { parseSchema, diffSchemas } from 'icetype';

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
console.log(diff);
// {
//   added: ['email', 'createdAt'],
//   removed: [],
//   modified: []
// }
```

## IceType Syntax Reference

### Field Modifiers

| Modifier | Description | Example |
|----------|-------------|---------|
| `!` | Required/unique | `uuid!` |
| `#` | Indexed | `string#` |
| `?` | Optional/nullable | `int?` |
| `[]` | Array type | `string[]` |

### Primitive Types

| Type | Description |
|------|-------------|
| `string`, `text` | String values |
| `int`, `long`, `bigint` | Integer values |
| `float`, `double` | Floating point values |
| `bool`, `boolean` | Boolean values |
| `uuid` | UUID strings |
| `timestamp`, `date`, `time` | Temporal values |
| `json` | Arbitrary JSON |
| `binary` | Binary data |
| `decimal(p,s)` | Decimal numbers |

### Relation Operators

| Operator | Description |
|----------|-------------|
| `->` | Forward relation (has many/has one) |
| `~>` | Fuzzy forward (AI-powered matching) |
| `<-` | Backward relation (belongs to) |
| `<~` | Fuzzy backward |

### Directives

| Directive | Description |
|-----------|-------------|
| `$type` | Schema/entity name |
| `$partitionBy` | Partition fields |
| `$index` | Composite indexes |
| `$fts` | Full-text search fields |
| `$vector` | Vector index fields |

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`@icetype/iceberg`](../iceberg) - Apache Iceberg adapter
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter
- [`@icetype/mysql`](../mysql) - MySQL adapter
- [`@icetype/sqlite`](../sqlite) - SQLite adapter
- [`@icetype/drizzle`](../drizzle) - Drizzle ORM adapter
- [`@icetype/prisma`](../prisma) - Prisma adapter
- [`@icetype/clickhouse`](../clickhouse) - ClickHouse adapter
- [`@icetype/duckdb`](../duckdb) - DuckDB adapter
- [`@icetype/cli`](../cli) - Command line interface
- [`create-icetype`](../create-icetype) - Project scaffolding

## License

MIT
