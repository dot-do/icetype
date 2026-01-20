# Basic Usage Example

This example demonstrates how to define and validate schemas using IceType's core library.

## What This Example Shows

1. **Schema Definition** (`schema.ts`) - How to define data models using IceType's concise schema language
2. **Schema Validation** (`validate.ts`) - How to parse and validate schemas for correctness

## IceType Syntax Overview

IceType uses a simple, expressive syntax for defining schemas:

### Field Modifiers

| Modifier | Meaning | Example |
|----------|---------|---------|
| `!` | Required field | `name: 'string!'` |
| `?` | Optional field | `bio: 'text?'` |
| `#` | Indexed field | `email: 'string!#'` |
| `[]` | Array type | `tags: 'string[]'` |

### Primitive Types

- `string` - Short text
- `text` - Long-form text
- `int` - 32-bit integer
- `long` / `bigint` - 64-bit integer
- `float` - 32-bit floating point
- `double` - 64-bit floating point
- `boolean` / `bool` - True/false
- `uuid` - UUID string
- `timestamp` - Unix timestamp
- `date` - Date only
- `time` - Time only
- `json` - Arbitrary JSON
- `binary` - Binary data

### Relations

| Operator | Direction | Example |
|----------|-----------|---------|
| `->` | Forward | `author: '-> User'` |
| `<-` | Backward | `posts: '<- Post.author[]'` |
| `~>` | Fuzzy forward | For AI-powered semantic relations |
| `<~` | Fuzzy backward | Inverse of fuzzy relation |

### Directives

- `$type` - Schema/entity name
- `$partitionBy` - Partition key fields for distributed storage
- `$index` - Secondary indexes (array of field arrays)
- `$fts` - Fields to enable full-text search
- `$vector` - Vector embedding configuration

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run the validation example
cd examples/basic-usage
pnpm validate
```

## Expected Output

```
============================================================
IceType Schema Validation Example
============================================================

--- Validating User Schema ---

Schema name: User
Version: 1
Fields: 10
Relations: 1

Fields:
  - id: uuid (unique)
  - email: string (unique, indexed)
  - name: string
  - tenantId: string
  - bio: text (optional)
  - age: int (optional)
  - avatarUrl: string (optional)
  - status: string (default="active")
  - lastLoginAt: timestamp (optional)
  - posts: Post (array)

Partition by: tenantId
Indexes: email; createdAt
Full-text search: name, bio

Validation: PASSED

...

============================================================
All schemas validated successfully!
============================================================
```

## Next Steps

- Check out the [iceberg-export](../iceberg-export) example to see how to export schemas to Apache Iceberg format
- Check out the [typescript-codegen](../typescript-codegen) example to generate TypeScript interfaces from schemas
