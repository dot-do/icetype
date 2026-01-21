# @icetype/core

IceType schema language - parser, types, and validation. This is the core package that provides the foundation for defining type-safe schemas with a concise, expressive syntax.

## Installation

```bash
npm install @icetype/core
# or
pnpm add @icetype/core
```

## Usage

```typescript
import { parseSchema, validateSchema, inferType } from '@icetype/core';

// Define a schema using IceType syntax
const userSchema = parseSchema({
  $type: 'User',
  $partitionBy: ['id'],
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

// Infer types from values
inferType('hello');                  // 'string'
inferType(42);                       // 'int'
inferType('2024-01-15T10:30:00Z');   // 'timestamp'
```

## API

### Parsing Functions

| Export | Description |
|--------|-------------|
| `parseSchema(definition)` | Parse a schema definition object into an IceTypeSchema |
| `parseField(fieldString)` | Parse a single field definition string |
| `parseRelation(relationString)` | Parse a relation definition string |
| `parseDirectives(directives)` | Parse schema directives ($partitionBy, $index, etc.) |
| `validateSchema(schema)` | Validate a parsed schema and return errors |
| `tokenize(input)` | Tokenize a field definition string |
| `inferType(value)` | Infer the IceType from a JavaScript value |

### Type Guards

| Export | Description |
|--------|-------------|
| `isValidPrimitiveType(type)` | Check if a string is a valid primitive type |
| `isValidModifier(char)` | Check if a character is a valid field modifier |
| `isValidRelationOperator(op)` | Check if a string is a valid relation operator |
| `isIceTypeError(error)` | Check if an error is an IceTypeError |
| `isParseError(error)` | Check if an error is a ParseError |

### Error Classes

| Export | Description |
|--------|-------------|
| `IceTypeError` | Base error class for all IceType errors |
| `ParseError` | Error thrown during schema parsing |
| `SchemaValidationError` | Error thrown during schema validation |
| `AdapterError` | Error thrown by adapters |

### Types

| Type | Description |
|------|-------------|
| `IceTypeSchema` | Parsed schema representation |
| `FieldDefinition` | Parsed field with type, modifiers, and metadata |
| `RelationDefinition` | Parsed relation with operator and target |
| `ValidationResult` | Result of schema validation |
| `ParsedType` | Parsed type information |

## Examples

### Basic Schema Definition

```typescript
import { parseSchema } from '@icetype/core';

const schema = parseSchema({
  $type: 'Product',
  id: 'uuid!',
  name: 'string!',
  price: 'decimal(10,2)!',
  description: 'text?',
  tags: 'string[]',
  createdAt: 'timestamp!',
});
```

### Schema with Relations

```typescript
const postSchema = parseSchema({
  $type: 'Post',
  id: 'uuid!',
  title: 'string!',
  content: 'text!',
  author: 'User! <- posts',        // Belongs to User
  comments: '[Comment] -> post',   // Has many Comments
  tags: '[Tag] ~> content',        // Fuzzy match based on content
});
```

### Schema Diffing and Migrations

```typescript
import { diffSchemas, createMigrationFromDiff } from '@icetype/core';

const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!', email: 'string!' });

const diff = diffSchemas(oldSchema, newSchema);
const migration = createMigrationFromDiff(diff, { generateTimestamp: true });

console.log(migration.operations);
// [{ type: 'addColumn', table: 'User', column: 'email', ... }]
```

### Plugin System

```typescript
import { createPluginManager, loadConfig } from '@icetype/core';

const config = await loadConfig('./icetype.config.ts');
const manager = createPluginManager(config);

// Register and use plugins
await manager.loadPlugins();
```

## IceType Syntax Reference

### Field Modifiers

- `!` - Required (NOT NULL)
- `?` - Optional (nullable)
- `#` - Indexed
- `[]` - Array type

### Primitive Types

`string`, `text`, `int`, `long`, `bigint`, `float`, `double`, `bool`, `boolean`, `uuid`, `timestamp`, `date`, `time`, `json`, `binary`, `decimal(precision,scale)`

### Relation Operators

- `->` - Forward relation (has many)
- `<-` - Backward relation (belongs to)
- `~>` - Fuzzy forward (AI-powered matching)
- `<~` - Fuzzy backward

### Directives

- `$type` - Schema/table name
- `$partitionBy` - Partition fields
- `$index` - Composite indexes
- `$fts` - Full-text search fields
- `$vector` - Vector index fields

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs).

## Related Packages

- [`icetype`](../icetype) - Main entry point with all adapters
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`@icetype/cli`](../cli) - Command-line interface

## License

MIT
