# Branded Types in IceType

This document describes the **branded type** patterns used in `@icetype/core` to provide compile-time type safety for structurally identical types.

## What are Branded Types?

Branded types (also known as nominal types or tagged types) are a TypeScript pattern that prevents accidental interchange of values that have the same underlying structure but represent different concepts.

For example, both `UserId` and `OrderId` might be strings, but you wouldn't want to accidentally pass an `OrderId` where a `UserId` is expected. Branded types make this a compile-time error.

## The Brand Type Utility

IceType provides a reusable `Brand<T, B>` type utility for creating branded types:

```typescript
import type { Brand } from '@icetype/core';

// The Brand type adds a phantom property that distinguishes types
type Brand<T, B extends string> = T & { readonly [__brand]: B };
```

The brand is implemented using a unique symbol (`__brand`) that:
- Exists only at the type level (no runtime overhead)
- Cannot be accidentally satisfied by regular objects
- Is unique across packages (using `unique symbol`)

## Built-in Branded Types

### Core Identifiers

| Type | Base Type | Purpose |
|------|-----------|---------|
| `SchemaId` | `string` | Identifies schema definitions |
| `FieldId` | `number` | Identifies field positions (index) |
| `RelationId` | `string` | Identifies relation definitions |

### Schema Versioning

| Type | Base Type | Purpose |
|------|-----------|---------|
| `SchemaVersion` | `{ major, minor, patch }` | Semantic version for schemas |

### SQLite-specific Types

| Type | Base Type | Purpose |
|------|-----------|---------|
| `ArrayTypeString` | `string` | Strings ending with `[]` (array types) |

## Creating Branded Values

### Using Factory Functions (Recommended)

The recommended way to create branded values is through validated factory functions:

```typescript
import {
  createSchemaId,
  createFieldId,
  createRelationId,
  createSchemaVersion,
} from '@icetype/core';

// Factory functions validate input and throw on invalid data
const schemaId = createSchemaId('UserSchema');   // SchemaId
const fieldId = createFieldId(0);                 // FieldId
const relationId = createRelationId('user-posts'); // RelationId
const version = createSchemaVersion(1, 2, 3);    // SchemaVersion
```

### Factory Function Validation

Each factory function performs runtime validation:

**`createSchemaId(id: string): SchemaId`**
- Rejects empty or whitespace-only strings
- Rejects identifiers starting with a number
- Returns a valid `SchemaId`

```typescript
createSchemaId('User');      // OK: SchemaId
createSchemaId('');          // Throws: "identifier cannot be empty"
createSchemaId('123schema'); // Throws: "cannot start with a number"
```

**`createFieldId(id: number): FieldId`**
- Rejects negative numbers
- Rejects non-integers (floats)
- Rejects `NaN` and `Infinity`
- Returns a valid `FieldId`

```typescript
createFieldId(0);         // OK: FieldId
createFieldId(42);        // OK: FieldId
createFieldId(-1);        // Throws: "must be non-negative"
createFieldId(3.14);      // Throws: "must be an integer"
createFieldId(NaN);       // Throws: "cannot be NaN"
```

**`createRelationId(id: string): RelationId`**
- Rejects empty or whitespace-only strings
- Returns a valid `RelationId`

```typescript
createRelationId('user->posts'); // OK: RelationId
createRelationId('');            // Throws: "identifier cannot be empty"
```

**`createSchemaVersion(major, minor, patch): SchemaVersion`**
- Validates each component is a non-negative integer
- Rejects `NaN`, `Infinity`, floats, and negative numbers
- Returns a valid `SchemaVersion`

```typescript
createSchemaVersion(1, 2, 3);    // OK: SchemaVersion
createSchemaVersion(-1, 0, 0);   // Throws: "major must be non-negative"
createSchemaVersion(1.5, 0, 0);  // Throws: "major must be an integer"
```

### Using Type Assertions (Advanced)

For advanced use cases where you've already validated the data, you can use type assertions:

```typescript
import type { SchemaId } from '@icetype/core';

// Only use when you're certain the value is valid
const id = 'my-schema' as SchemaId;
```

**Warning:** Type assertions bypass runtime validation. Only use them when:
- The value comes from a trusted source (e.g., database)
- You've already validated the value elsewhere
- Performance is critical and validation overhead is unacceptable

## Creating Custom Branded Types

You can create your own branded types using the `Brand` utility:

```typescript
import type { Brand } from '@icetype/core';

// Define custom branded types
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;
type Timestamp = Brand<number, 'Timestamp'>;

// TypeScript prevents mixing these up
function getUser(id: UserId): User { /* ... */ }

const userId = 'user-123' as UserId;
const orderId = 'order-456' as OrderId;

getUser(userId);   // OK
getUser(orderId);  // TypeScript error!
```

### Best Practices for Custom Branded Types

1. **Create factory functions** that validate input:

```typescript
function createUserId(id: string): UserId {
  if (!id.startsWith('user-')) {
    throw new Error('UserId must start with "user-"');
  }
  return id as UserId;
}
```

2. **Use descriptive brand names** that reflect the domain concept:

```typescript
// Good: Clear, domain-specific names
type TenantId = Brand<string, 'TenantId'>;
type AccountBalance = Brand<number, 'AccountBalance'>;

// Avoid: Generic or unclear names
type MyString = Brand<string, 'MyString'>;
```

3. **Document the constraints** that the branded type represents:

```typescript
/**
 * A positive integer representing cents (not dollars).
 * Use createMoneyAmount() to ensure the value is valid.
 */
type MoneyAmount = Brand<number, 'MoneyAmount'>;
```

## Type Guards for Branded Types

You can create type guards to narrow types at runtime:

```typescript
import type { Brand } from '@icetype/core';

type ArrayTypeString = Brand<string, 'ArrayTypeString'>;

// Type guard narrows string to ArrayTypeString
function isArrayType(type: string): type is ArrayTypeString {
  return type.length > 2 && type.endsWith('[]');
}

// Usage
const fieldType = 'string[]';
if (isArrayType(fieldType)) {
  // TypeScript knows fieldType is ArrayTypeString here
  const elementType = fieldType.slice(0, -2);
}
```

## Working with Branded Types

### Branded types preserve base type operations

```typescript
type Version = Brand<number, 'Version'>;

const v1 = 1 as Version;
const v2 = 2 as Version;

// All number operations still work
v1 < v2          // true
v1 + v2          // 3 (returns number, not Version)
Math.max(v1, v2) // 2
```

### Branded string operations

```typescript
type UserId = Brand<string, 'UserId'>;

const userId = 'user-abc-123' as UserId;

// All string operations still work
userId.startsWith('user-')  // true
userId.split('-')           // ['user', 'abc', '123']
userId.toUpperCase()        // 'USER-ABC-123' (returns string, not UserId)
```

**Note:** Operations that return new values typically return the base type, not the branded type. You may need to re-brand the result if needed.

## Why Use Branded Types?

### 1. Prevent Logic Errors at Compile Time

```typescript
function processOrder(orderId: OrderId, userId: UserId) { /* ... */ }

// Without branded types, this compiles but is wrong:
processOrder(userId, orderId); // Swapped arguments!

// With branded types, TypeScript catches this error
```

### 2. Self-Documenting Code

```typescript
// Without branded types - what are these parameters?
function transfer(from: string, to: string, amount: number) { /* ... */ }

// With branded types - clear intent
function transfer(from: AccountId, to: AccountId, amount: MoneyAmount) { /* ... */ }
```

### 3. Enforce Validation at Boundaries

```typescript
// API endpoint validates and brands incoming data
app.post('/orders', (req) => {
  const orderId = createOrderId(req.body.orderId); // Validates
  const userId = createUserId(req.body.userId);    // Validates

  // All downstream code knows these are valid
  processOrder(orderId, userId);
});
```

## Related Resources

- [Types API Reference](/api/core#types) - Full type documentation
- [Error Handling](/errors) - How validation errors are thrown
- [Schema Language](/schema-language) - IceType schema syntax

## Files Implementing Branded Types

- `/packages/core/src/types.ts` - Brand utility and core branded types
- `/packages/core/src/version.ts` - SchemaVersion branded type
- `/packages/sqlite/src/ddl.ts` - ArrayTypeString branded type
- `/packages/core/test/branded-types.test.ts` - Comprehensive test suite
- `/packages/core/test/types.test.ts` - Brand utility tests
