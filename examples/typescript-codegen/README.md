# TypeScript Code Generation Example

This example demonstrates how to generate TypeScript interfaces from IceType schemas, providing full type safety for your application code.

## What This Example Shows

1. **Schema Definition** (`schema.ts`) - Comprehensive schemas showcasing various IceType features
2. **Code Generation** (`generate.ts`) - Generate TypeScript interfaces programmatically

## Why Generate TypeScript Types?

IceType schemas define your data model once. From there, you can:

- **Type-safe CRUD operations** - TypeScript catches errors at compile time
- **Autocomplete in IDEs** - Your editor knows the shape of your data
- **Refactoring confidence** - Rename fields and TypeScript shows all usages
- **Documentation** - Generated types serve as living documentation

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run the code generation
cd examples/typescript-codegen
pnpm generate
```

## Generated Output

The generator creates `./generated/types.ts` with:

### Entity Interfaces

```typescript
export interface User {
  /** Unique document identifier */
  $id: string;
  /** Document type */
  $type: 'User';
  /** Document version */
  $version: number;
  /** Creation timestamp (epoch ms) */
  $createdAt: number;
  /** Last update timestamp (epoch ms) */
  $updatedAt: number;

  // User fields
  email: string;
  name: string;
  bio?: string;
  age?: number;
  isActive: boolean;
  // ... more fields
}
```

### Input Types

```typescript
/** Input type for creating User */
export interface UserInput {
  email: string;
  name: string;
  bio?: string;
  age?: number;
  isActive?: boolean;  // Has default, so optional in input
  // ... more fields
}
```

### Type Registry

```typescript
/** Map of all entity types by name */
export interface EntityTypeMap {
  User: User;
  Organization: Organization;
  Post: Post;
  Comment: Comment;
  Category: Category;
}

/** Union of all entity type names */
export type EntityTypeName = 'User' | 'Organization' | 'Post' | 'Comment' | 'Category';

/** Union of all entity types */
export type AnyEntity = User | Organization | Post | Comment | Category;
```

## Type Mapping

| IceType | TypeScript | Notes |
|---------|------------|-------|
| `string`, `text`, `uuid` | `string` | |
| `int`, `long`, `float`, `double`, `decimal` | `number` | |
| `boolean`, `bool` | `boolean` | |
| `timestamp`, `timestamptz`, `date`, `time` | `number` | Epoch milliseconds |
| `json` | `unknown` | Flexible JSON data |
| `binary` | `Uint8Array` | Binary data |
| `string[]` | `string[]` | Array types |
| `-> User` | `string` | Relation stored as ID |
| `<- Post.author[]` | `string[]` | Backward relation as ID array |

## Usage Patterns

### Type-safe Entity Creation

```typescript
import type { UserInput, User } from './generated/types';

async function createUser(input: UserInput): Promise<User> {
  // TypeScript ensures input has required fields
  const response = await api.post('/users', input);
  return response.data;
}

// This works - all required fields present
createUser({
  email: 'user@example.com',
  name: 'John Doe',
  organizationId: 'org_123',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// This fails at compile time - missing 'name'
createUser({
  email: 'user@example.com',
  organizationId: 'org_123',
});
```

### Generic Entity Operations

```typescript
import type { EntityTypeMap, EntityTypeName } from './generated/types';

// Type-safe generic repository
class Repository<T extends EntityTypeName> {
  constructor(private type: T) {}

  async get(id: string): Promise<EntityTypeMap[T]> {
    return api.get(`/${this.type}/${id}`);
  }

  async create(data: Partial<EntityTypeMap[T]>): Promise<EntityTypeMap[T]> {
    return api.post(`/${this.type}`, data);
  }
}

// Usage
const userRepo = new Repository('User');
const user = await userRepo.get('user_123');
// TypeScript knows 'user' is of type 'User'
console.log(user.email);
```

### Type Guards

```typescript
import type { AnyEntity, User, Post } from './generated/types';

function isUser(entity: AnyEntity): entity is User {
  return entity.$type === 'User';
}

function isPost(entity: AnyEntity): entity is Post {
  return entity.$type === 'Post';
}

// Usage
function processEntity(entity: AnyEntity) {
  if (isUser(entity)) {
    // TypeScript knows entity is User
    console.log(entity.email);
  } else if (isPost(entity)) {
    // TypeScript knows entity is Post
    console.log(entity.title);
  }
}
```

### Partial Updates

```typescript
import type { User, PartialUpdate } from './generated/types';

async function updateUser(
  id: string,
  changes: PartialUpdate<User>
): Promise<User> {
  // Only updatable fields are allowed
  return api.patch(`/users/${id}`, changes);
}

// This works
updateUser('user_123', { name: 'New Name', bio: 'Updated bio' });

// This fails - can't update system fields
updateUser('user_123', { $version: 5 });
```

## CLI Integration

You can also use the CLI directly:

```bash
# Generate types using the CLI
npx ice generate --schema ./schema.ts --output ./types.generated.ts
```

## Next Steps

- Check out the [basic](../basic) example for schema fundamentals
- Check out the [iceberg](../iceberg) example for data lake integration
