# Basic IceType Example

This example demonstrates the fundamentals of IceType schema definition and TypeScript code generation.

## Files

- `schema.ts` - Defines User and Post schemas using IceType syntax
- `generate.ts` - Parses schemas and generates TypeScript interfaces

## IceType Syntax Quick Reference

### Field Modifiers

| Modifier | Meaning | Example |
|----------|---------|---------|
| `!` | Required field | `name: 'string!'` |
| `?` | Optional field | `bio: 'text?'` |
| `#` | Unique/indexed | `email: 'string!#'` |
| `[]` | Array type | `tags: 'string[]'` |

### Common Types

- `string` - Short text
- `text` - Long-form text
- `int` - 32-bit integer
- `float` - Floating point
- `boolean` - True/false
- `uuid` - UUID string
- `timestamp` - Unix timestamp
- `json` - Arbitrary JSON

### Relations

| Operator | Direction | Example |
|----------|-----------|---------|
| `->` | Forward | `author: '-> User'` |
| `<-` | Backward | `posts: '<- Post.author[]'` |

### Directives

- `$type` - Entity name
- `$partitionBy` - Partition key fields
- `$index` - Secondary indexes

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run TypeScript generation
cd examples/basic
npx tsx generate.ts
```

## Expected Output

The generate script will output TypeScript interfaces like:

```typescript
export interface User {
  $id: string;
  $type: 'User';
  $version: number;
  $createdAt: number;
  $updatedAt: number;
  id: string;
  email: string;
  name: string;
  bio?: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  posts: string[];
}

export interface UserInput {
  id: string;
  email: string;
  name: string;
  bio?: string;
  status?: string;
  createdAt: number;
  updatedAt: number;
  posts?: string[];
}
```

## Next Steps

- See [iceberg](../iceberg/) for Apache Iceberg metadata generation
- See [clickhouse](../clickhouse/) for ClickHouse DDL generation
- See [duckdb](../duckdb/) for DuckDB DDL generation
