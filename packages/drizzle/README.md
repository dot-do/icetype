# @icetype/drizzle

Drizzle ORM adapter for IceType schema transformations. This package generates Drizzle ORM schema files from IceType schemas, supporting PostgreSQL, MySQL, and SQLite dialects. It also supports importing existing Drizzle schemas into IceType format.

## Installation

```bash
npm install @icetype/drizzle
# or
pnpm add @icetype/drizzle
```

## Usage

```typescript
import { parseSchema } from '@icetype/core';
import { DrizzleAdapter, transformToDrizzle } from '@icetype/drizzle';

// Parse an IceType schema
const schema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  age: 'int?',
  createdAt: 'timestamp',
});

// Option 1: Use the adapter directly
const adapter = new DrizzleAdapter();
const drizzleSchema = adapter.transform(schema, { dialect: 'pg' });
const code = adapter.serialize(drizzleSchema);

// Option 2: Use the convenience function
const code2 = transformToDrizzle(schema, { dialect: 'pg' });

console.log(code2);
// Output:
// import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
//
// export const users = pgTable('users', {
//   id: uuid('id').primaryKey().notNull(),
//   email: varchar('email', { length: 255 }).notNull().unique(),
//   name: varchar('name', { length: 255 }),
//   age: integer('age'),
//   createdAt: timestamp('createdAt'),
// });
//
// export type Users = typeof users.$inferSelect;
// export type NewUsers = typeof users.$inferInsert;
```

## API

### Main Exports

| Export | Description |
|--------|-------------|
| `DrizzleAdapter` | Adapter class for Drizzle schema generation |
| `createDrizzleAdapter()` | Factory function to create adapter |
| `transformToDrizzle(schema, options)` | Transform schema to Drizzle code string |
| `generateDrizzleSchema(schema, options)` | Generate Drizzle schema object |
| `transformSchemasToDrizzle(schemas, options)` | Transform multiple schemas |

### Types

| Type | Description |
|------|-------------|
| `DrizzleDialect` | Dialect type ('pg', 'mysql', 'sqlite') |
| `DrizzleColumn` | Column definition for Drizzle |
| `DrizzleIndex` | Index definition |
| `DrizzleTable` | Table definition |
| `DrizzleSchema` | Complete schema structure |
| `DrizzleImport` | Import statement structure |
| `DrizzleAdapterOptions` | Options for schema generation |
| `DrizzleTypeMapping` | Type mapping configuration |
| `DrizzleTypeMappings` | All type mappings by dialect |

### Type Mapping Utilities

| Export | Description |
|--------|-------------|
| `DRIZZLE_TYPE_MAPPINGS` | Type mappings for all dialects |
| `getDrizzleType(iceType, dialect)` | Get Drizzle type for IceType |
| `getDrizzleImportPath(dialect)` | Get import path for dialect |
| `getTableFunction(dialect)` | Get table function name (pgTable, etc.) |
| `isKnownDrizzleType(type)` | Check if type is known |
| `getRequiredTypeImports(columns)` | Get required imports for columns |

### Code Generation Utilities

| Export | Description |
|--------|-------------|
| `toCamelCase(str)` | Convert to camelCase |
| `toSnakeCase(str)` | Convert to snake_case |
| `toPascalCase(str)` | Convert to PascalCase |
| `escapeString(str)` | Escape string for code |
| `generateImports(schema)` | Generate import statements |
| `collectImports(tables)` | Collect all required imports |
| `generateColumn(column)` | Generate column definition code |
| `generateTable(table)` | Generate table definition code |
| `generateSchemaCode(schema)` | Generate complete schema code |
| `formatDefaultValue(value)` | Format default value |
| `validateTableName(name)` | Validate table name |
| `validateColumnName(name)` | Validate column name |

### Importer (Drizzle to IceType)

| Export | Description |
|--------|-------------|
| `parseDrizzleSchema(code)` | Parse Drizzle code to IceType schemas |
| `parseDrizzleFile(path)` | Parse Drizzle file to IceType schemas |
| `parseRawTables(code)` | Parse raw table definitions |
| `getIceTypeFromDrizzle(drizzleType)` | Convert Drizzle type to IceType |
| `detectDialect(code)` | Detect dialect from code |
| `parseColumn(code)` | Parse single column definition |
| `columnToFieldDefinition(column)` | Convert column to IceType field |
| `tableToIceTypeSchema(table)` | Convert table to IceType schema |

### Importer Types

| Type | Description |
|------|-------------|
| `DrizzleImportOptions` | Options for importing |
| `ParsedDrizzleColumn` | Parsed column structure |
| `ParsedDrizzleTable` | Parsed table structure |

## Examples

### PostgreSQL Schema

```typescript
import { parseSchema } from '@icetype/core';
import { transformToDrizzle } from '@icetype/drizzle';

const schema = parseSchema({
  $type: 'Product',
  id: 'uuid!',
  name: 'string!',
  price: 'decimal(10,2)!',
  stock: 'int!',
  tags: 'string[]',
  metadata: 'json?',
});

const code = transformToDrizzle(schema, { dialect: 'pg' });
```

### MySQL Schema

```typescript
const code = transformToDrizzle(schema, { dialect: 'mysql' });
// Uses mysqlTable, varchar, int, etc.
```

### SQLite Schema

```typescript
const code = transformToDrizzle(schema, { dialect: 'sqlite' });
// Uses sqliteTable, text, integer, etc.
```

### Multiple Schemas

```typescript
import { parseSchema } from '@icetype/core';
import { transformSchemasToDrizzle } from '@icetype/drizzle';

const userSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string!',
  name: 'string',
});

const postSchema = parseSchema({
  $type: 'Post',
  id: 'uuid!',
  title: 'string!',
  authorId: 'uuid!',
});

const code = transformSchemasToDrizzle([userSchema, postSchema], {
  dialect: 'pg',
});
```

### Import Existing Drizzle Schema

```typescript
import { parseDrizzleSchema, parseDrizzleFile } from '@icetype/drizzle';

// Parse from string
const schemas = parseDrizzleSchema(`
  import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

  export const users = pgTable('users', {
    id: uuid('id').primaryKey().notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }),
  });
`);

// Parse from file
const fileSchemas = await parseDrizzleFile('./drizzle/schema.ts');

console.log(schemas);
// [{ $type: 'users', id: 'uuid!', email: 'string!#', name: 'string?' }]
```

### Using with Adapter Registry

```typescript
import { createAdapterRegistry } from '@icetype/adapters';
import { DrizzleAdapter } from '@icetype/drizzle';

const registry = createAdapterRegistry();
registry.register(new DrizzleAdapter());

const adapter = registry.get('drizzle');
const drizzleSchema = adapter?.transform(schema, { dialect: 'pg' });
const code = adapter?.serialize(drizzleSchema);
```

## Type Mappings by Dialect

### PostgreSQL (pg)

| IceType | Drizzle Type |
|---------|--------------|
| `string` | `varchar` |
| `text` | `text` |
| `int` | `integer` |
| `bigint` | `bigint` |
| `float` | `real` |
| `double` | `doublePrecision` |
| `boolean` | `boolean` |
| `uuid` | `uuid` |
| `timestamp` | `timestamp` |
| `date` | `date` |
| `json` | `jsonb` |
| `decimal` | `decimal` |

### MySQL

| IceType | Drizzle Type |
|---------|--------------|
| `string` | `varchar` |
| `text` | `text` |
| `int` | `int` |
| `bigint` | `bigint` |
| `float` | `float` |
| `double` | `double` |
| `boolean` | `boolean` |
| `uuid` | `varchar(36)` |
| `timestamp` | `timestamp` |
| `date` | `date` |
| `json` | `json` |
| `decimal` | `decimal` |

### SQLite

| IceType | Drizzle Type |
|---------|--------------|
| `string` | `text` |
| `text` | `text` |
| `int` | `integer` |
| `bigint` | `integer` |
| `float` | `real` |
| `double` | `real` |
| `boolean` | `integer` |
| `uuid` | `text` |
| `timestamp` | `integer` |
| `date` | `text` |
| `json` | `text` |

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/drizzle).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`@icetype/postgres`](../postgres) - PostgreSQL DDL adapter
- [`@icetype/mysql`](../mysql) - MySQL DDL adapter
- [`@icetype/sqlite`](../sqlite) - SQLite DDL adapter
- [`@icetype/prisma`](../prisma) - Prisma adapter

## License

MIT
