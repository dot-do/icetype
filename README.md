# IceType

[![npm version](https://img.shields.io/npm/v/icetype.svg)](https://www.npmjs.com/package/icetype)
[![license](https://img.shields.io/npm/l/icetype.svg)](https://github.com/dot-do/icetype/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A type-safe, concise schema language that compiles to multiple backends including Apache Iceberg, Parquet, ClickHouse, DuckDB, and more.

## Installation

```bash
npm install icetype
# or
pnpm add icetype
```

## Quick Start

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
  console.error('Schema errors:', result.errors);
}
```

## IceType Syntax

### Field Modifiers

| Modifier | Description | Example |
|----------|-------------|---------|
| `!` | Required/unique | `uuid!` |
| `#` | Indexed | `string#` |
| `?` | Optional/nullable | `int?` |
| `[]` | Array type | `string[]` |

### Primitive Types

- `string`, `text` - String values
- `int`, `long`, `bigint` - Integer values
- `float`, `double` - Floating point values
- `bool`, `boolean` - Boolean values
- `uuid` - UUID strings
- `timestamp`, `date`, `time` - Temporal values
- `json` - Arbitrary JSON
- `binary` - Binary data
- `decimal(precision,scale)` - Decimal numbers

### Relation Operators

| Operator | Type | Description |
|----------|------|-------------|
| `->` | Forward | Direct foreign key reference |
| `~>` | Fuzzy Forward | AI-powered semantic matching |
| `<-` | Backward | Reverse reference (one-to-many) |
| `<~` | Fuzzy Backward | AI-powered reverse lookup |

```typescript
const postSchema = parseSchema({
  $type: 'Post',

  author: '-> User!',           // Forward relation to User
  tags: '~> Tag[]',             // Fuzzy relation to Tags
});

const userSchema = parseSchema({
  $type: 'User',

  posts: '<- Post.author[]',    // Backward relation from Post
});
```

### Directives

| Directive | Description |
|-----------|-------------|
| `$type` | Schema/entity name |
| `$partitionBy` | Partition key fields |
| `$index` | Secondary indexes |
| `$fts` | Full-text search fields |
| `$vector` | Vector index fields |

## Type Inference

```typescript
import { inferType } from 'icetype';

inferType('hello')                    // 'string'
inferType(42)                         // 'int'
inferType(3.14)                       // 'float'
inferType(true)                       // 'bool'
inferType('2024-01-15')               // 'date'
inferType('2024-01-15T10:30:00Z')     // 'timestamp'
inferType('550e8400-e29b-41d4-a716-446655440000') // 'uuid'
inferType([1, 2, 3])                  // 'int[]'
inferType({ foo: 'bar' })             // 'json'
```

## Iceberg Metadata Generation

```typescript
import { parseSchema } from 'icetype';
import { generateIcebergMetadata } from 'icetype';

const schema = parseSchema({
  $type: 'User',
  $partitionBy: ['tenantId'],
  id: 'uuid!',
  email: 'string#',
  tenantId: 'string!',
});

const metadata = generateIcebergMetadata(
  schema,
  's3://my-bucket/tables/users',
  { 'write.parquet.compression-codec': 'zstd' }
);

// Write metadata to storage
await r2.put('metadata/v1.metadata.json', JSON.stringify(metadata, null, 2));
```

## Parquet Schema Generation

```typescript
import { generateParquetSchema, generateParquetSchemaString } from 'icetype';

const parquetSchema = generateParquetSchema(schema);
const schemaString = generateParquetSchemaString(schema);

console.log(schemaString);
// Output:
// message User {
//   REQUIRED BYTE_ARRAY $id (UTF8);
//   REQUIRED BYTE_ARRAY $type (UTF8);
//   ...
// }
```

## CLI

```bash
# Initialize a project
ice init

# Generate TypeScript types
ice generate --schema ./schema.ts --output ./types.ts

# Validate schema syntax
ice validate --schema ./schema.ts

# Export to Iceberg metadata
ice iceberg export --schema ./schema.ts --output ./metadata.json
```

## Packages

| Package | Description |
|---------|-------------|
| [`icetype`](./packages/icetype) | Main entry point - re-exports all packages |
| [`@icetype/core`](./packages/core) | Parser, types, and validation |
| [`@icetype/iceberg`](./packages/iceberg) | Iceberg metadata & Parquet schema gen |
| [`@icetype/cli`](./packages/cli) | CLI tools |

## License

MIT
