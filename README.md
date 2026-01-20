# IceType

[![npm version](https://img.shields.io/npm/v/icetype.svg)](https://www.npmjs.com/package/icetype)
[![license](https://img.shields.io/npm/l/icetype.svg)](https://github.com/dot-do/icetype/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A type-safe, concise schema language with Apache Iceberg and Parquet schema generation.

## Current Status

**Version:** 0.1.0

### Implemented

- Schema parsing with IceType syntax (field modifiers, relations, directives)
- Schema validation
- TypeScript type generation from schemas
- Apache Iceberg metadata generation
- Parquet schema generation
- CLI tools (`ice init`, `ice generate`, `ice validate`, `ice iceberg export`)

### Planned (Not Yet Implemented)

- Multi-backend adapters (ClickHouse, DuckDB, etc.)
- Database runtime/query engine
- Full-text search and vector index execution
- AI-powered fuzzy relations (`~>`, `<~`)

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

| Operator | Type | Description | Status |
|----------|------|-------------|--------|
| `->` | Forward | Direct foreign key reference | Parsed |
| `<-` | Backward | Reverse reference (one-to-many) | Parsed |
| `~>` | Fuzzy Forward | AI-powered semantic matching | Planned |
| `<~` | Fuzzy Backward | AI-powered reverse lookup | Planned |

> **Note:** All relation operators are parsed and stored in schemas. The `->` and `<-` operators represent standard foreign key relationships. The fuzzy operators (`~>`, `<~`) are reserved for future AI-powered semantic matching functionality.

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

The CLI is available via the `ice` command after installing `icetype`.

### TypeScript Schema Files

TypeScript schema files (`.ts`) require a TypeScript runtime to execute. Use one of these approaches:

```bash
# Option 1: Use tsx (recommended)
npx tsx node_modules/.bin/ice validate --schema ./schema.ts

# Option 2: Compile to JavaScript first
npx tsc schema.ts
ice validate --schema ./schema.js

# Option 3: Use pre-compiled .js or .json schema files
ice validate --schema ./schema.js
ice validate --schema ./schema.json
```

### Commands

```bash
# Initialize a project (creates schema.ts template)
ice init
ice init --dir ./my-project    # Create in specific directory
ice init --force               # Overwrite existing files

# Generate TypeScript types from schema
ice generate --schema ./schema.js --output ./types.ts
ice generate -s ./schema.js -o ./types.ts  # Short form

# Validate schema syntax
ice validate --schema ./schema.js
ice validate -s ./schema.js  # Short form

# Export to Iceberg metadata
ice iceberg export --schema ./schema.js --output ./metadata.json
ice iceberg export -s ./schema.js -o ./metadata.json --location s3://bucket/table
```

### Supported Schema File Formats

| Extension | Description | Notes |
|-----------|-------------|-------|
| `.ts` | TypeScript | Requires `tsx` or pre-compilation |
| `.js`, `.mjs` | JavaScript (ESM) | Native support |
| `.json` | JSON | Native support |

## Packages

| Package | Version | Description | Status |
|---------|---------|-------------|--------|
| [`icetype`](./packages/icetype) | 0.1.0 | Main entry point - re-exports all packages + CLI | Implemented |
| [`@icetype/core`](./packages/core) | 0.1.0 | Parser, types, and validation | Implemented |
| [`@icetype/iceberg`](./packages/iceberg) | 0.1.0 | Iceberg metadata & Parquet schema gen | Implemented |
| [`@icetype/cli`](./packages/cli) | 0.1.0 | CLI tools | Implemented |

## License

MIT
