# Drizzle Schema Generation Example

This example demonstrates how to generate [Drizzle ORM](https://orm.drizzle.team) schemas from IceType schema definitions.

## What This Example Shows

1. **Schema Definition** (`icetype-schema.ts`) - Define data models using IceType's concise syntax
2. **Code Generation** (`generate.ts`) - Transform IceType schemas to Drizzle ORM TypeScript code
3. **Multi-dialect Support** - Generate schemas for PostgreSQL, MySQL, or SQLite

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run the code generation
cd examples/drizzle
pnpm generate
```

## Generated Output

The generator creates `./generated/schema.ts` with Drizzle table definitions:

```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: uuid('id').primaryKey().notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('createdAt'),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export const post = pgTable('post', {
  id: uuid('id').primaryKey().notNull(),
  title: varchar('title', { length: 255 }),
  content: text('content'),
  authorId: uuid('authorId').notNull(),
  published: boolean('published'),
});

export type Post = typeof post.$inferSelect;
export type NewPost = typeof post.$inferInsert;
```

## Using the Generated Schema

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user, post, type User, type NewUser } from './generated/schema.js';

// Create database connection
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

// Query users
const users = await db.select().from(user);

// Insert a new user
const newUser: NewUser = {
  id: crypto.randomUUID(),
  email: 'user@example.com',
  name: 'John Doe',
  createdAt: new Date(),
};
await db.insert(user).values(newUser);

// Query with joins
const postsWithAuthors = await db
  .select()
  .from(post)
  .leftJoin(user, eq(post.authorId, user.id));
```

## Type Mapping

| IceType Type | PostgreSQL (Drizzle) | MySQL (Drizzle) | SQLite (Drizzle) |
|--------------|---------------------|-----------------|------------------|
| `uuid` | `uuid` | `varchar(36)` | `text` |
| `string` | `varchar(255)` | `varchar(255)` | `text` |
| `text` | `text` | `text` | `text` |
| `int` | `integer` | `int` | `integer` |
| `long` | `bigint` | `bigint` | `integer` |
| `float` | `real` | `float` | `real` |
| `double` | `doublePrecision` | `double` | `real` |
| `bool` | `boolean` | `boolean` | `integer` |
| `timestamp` | `timestamp` | `timestamp` | `text` |
| `json` | `json` | `json` | `text` |

## Bidirectional Conversion

The `@icetype/drizzle` package supports bidirectional conversion:

### IceType to Drizzle

```typescript
import { parseSchema } from '@icetype/core';
import { transformToDrizzle } from '@icetype/drizzle';

const schema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
});

const drizzleCode = transformToDrizzle(schema, { dialect: 'pg' });
```

### Drizzle to IceType

```typescript
import { parseDrizzleFile } from '@icetype/drizzle';

// Parse an existing Drizzle schema file
const iceTypeSchemas = parseDrizzleFile('./schema.ts');

// Each table becomes an IceType schema
for (const schema of iceTypeSchemas) {
  console.log(schema.name, schema.fields);
}
```

This bidirectional support enables:

- **Incremental adoption** - Import existing Drizzle schemas into IceType
- **Round-trip conversions** - Validate that conversions are lossless
- **Migration workflows** - Convert between schema formats as needed

## Dialect Support

Generate schemas for different databases:

```typescript
import { DrizzleAdapter } from '@icetype/drizzle';

const adapter = new DrizzleAdapter();

// PostgreSQL
const pgCode = adapter.serialize(adapter.transform(schema, { dialect: 'pg' }));

// MySQL
const mysqlCode = adapter.serialize(adapter.transform(schema, { dialect: 'mysql' }));

// SQLite
const sqliteCode = adapter.serialize(adapter.transform(schema, { dialect: 'sqlite' }));
```

## Next Steps

- Check out the [basic](../basic) example for IceType schema fundamentals
- Check out the [typescript-codegen](../typescript-codegen) example for TypeScript interface generation
- Check out the [postgres](../postgres) example for PostgreSQL DDL generation
