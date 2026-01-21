# @icetype/sqlite

SQLite adapter for IceType schema transformations. This package generates SQLite DDL (Data Definition Language) statements from IceType schemas.

## Installation

```bash
npm install @icetype/sqlite
# or
pnpm add @icetype/sqlite
```

## Usage

```typescript
import { parseSchema } from '@icetype/core';
import { SQLiteAdapter, transformToSQLiteDDL } from '@icetype/sqlite';

// Parse an IceType schema
const schema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  age: 'int?',
  balance: 'decimal',
  createdAt: 'timestamp',
});

// Option 1: Use the adapter directly
const adapter = new SQLiteAdapter();
const ddl = adapter.transform(schema, { ifNotExists: true });
const sql = adapter.serialize(ddl);

// Option 2: Use the convenience function
const sql2 = transformToSQLiteDDL(schema, {
  ifNotExists: true,
  strict: true,
});

console.log(sql2);
// CREATE TABLE IF NOT EXISTS User (
//   "$id" TEXT NOT NULL,
//   "$type" TEXT NOT NULL,
//   "$version" INTEGER NOT NULL DEFAULT 1,
//   "$createdAt" INTEGER NOT NULL,
//   "$updatedAt" INTEGER NOT NULL,
//   id TEXT NOT NULL,
//   email TEXT UNIQUE,
//   name TEXT,
//   age INTEGER,
//   balance REAL,
//   createdAt TEXT,
//   PRIMARY KEY ("$id"),
//   UNIQUE (email)
// ) STRICT;
```

## API

### Main Exports

| Export | Description |
|--------|-------------|
| `SQLiteAdapter` | Adapter class for SQLite DDL generation |
| `createSQLiteAdapter()` | Factory function to create adapter |
| `transformToSQLiteDDL(schema, options)` | Transform schema to DDL string |
| `generateSQLiteDDL(schema, options)` | Generate DDL object |

### DDL Helpers

| Export | Description |
|--------|-------------|
| `mapIceTypeToSQLite(type)` | Map IceType to SQLite type |
| `getSQLiteTypeString(mapping)` | Get SQLite type as string |
| `fieldToSQLiteColumn(field)` | Convert field to column definition |
| `serializeDDL(ddl)` | Serialize DDL object to SQL string |
| `generateIndexStatements(table, columns)` | Generate CREATE INDEX statements |
| `escapeIdentifier(name)` | Escape identifier for SQLite |

### Migration Exports

| Export | Description |
|--------|-------------|
| `SQLiteMigrationGenerator` | Class for generating migration SQL |
| `createSQLiteMigrationGenerator()` | Factory function for migrations |

### Types

| Type | Description |
|------|-------------|
| `SQLiteType` | SQLite data types |
| `SQLiteColumn` | Column definition for SQLite |
| `SQLiteDDL` | Complete DDL structure |
| `SQLiteAdapterOptions` | Options for DDL generation |

## Examples

### Basic Table Generation

```typescript
import { parseSchema } from '@icetype/core';
import { transformToSQLiteDDL } from '@icetype/sqlite';

const schema = parseSchema({
  $type: 'Product',
  id: 'uuid!',
  name: 'string!',
  price: 'decimal!',
  stock: 'int!',
  active: 'boolean!',
});

const sql = transformToSQLiteDDL(schema);
console.log(sql);
```

### With Strict Mode

```typescript
const sql = transformToSQLiteDDL(schema, {
  strict: true,        // Enable SQLite STRICT mode
  ifNotExists: true,   // Add IF NOT EXISTS clause
});
```

### Generate Multiple Tables

```typescript
import { SQLiteAdapter } from '@icetype/sqlite';

const adapter = new SQLiteAdapter();
const schemas = [userSchema, postSchema, commentSchema];

const ddlStatements = schemas.map(schema => {
  const ddl = adapter.transform(schema, { ifNotExists: true });
  return adapter.serialize(ddl);
});

const fullSQL = ddlStatements.join('\n\n');
```

### Using with Adapter Registry

```typescript
import { createAdapterRegistry } from '@icetype/adapters';
import { SQLiteAdapter } from '@icetype/sqlite';

const registry = createAdapterRegistry();
registry.register(new SQLiteAdapter());

const adapter = registry.get('sqlite');
const ddl = adapter?.transform(schema, { strict: true });
const sql = adapter?.serialize(ddl);
```

### Generate Migrations

```typescript
import { diffSchemas, parseSchema } from '@icetype/core';
import { createSQLiteMigrationGenerator } from '@icetype/sqlite';

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
});

const diff = diffSchemas(oldSchema, newSchema);
const generator = createSQLiteMigrationGenerator();
const statements = generator.generate(diff);

// Note: SQLite has limited ALTER TABLE support
// Complex migrations may require table recreation
```

### Generate Index Statements

```typescript
import { generateIndexStatements } from '@icetype/sqlite';

const indexes = generateIndexStatements('User', undefined, [
  { name: 'email', type: 'TEXT', nullable: false, unique: true },
  { name: 'createdAt', type: 'INTEGER', nullable: false },
]);

// CREATE INDEX IF NOT EXISTS idx_User_email ON User (email);
// CREATE INDEX IF NOT EXISTS idx_User_createdAt ON User (createdAt);
```

### Custom Column Mapping

```typescript
import { mapIceTypeToSQLite, getSQLiteTypeString } from '@icetype/sqlite';

const mapping = mapIceTypeToSQLite('decimal');
console.log(getSQLiteTypeString(mapping)); // 'REAL'

const uuidMapping = mapIceTypeToSQLite('uuid');
console.log(getSQLiteTypeString(uuidMapping)); // 'TEXT'
```

## Type Mappings

| IceType | SQLite Type | Notes |
|---------|-------------|-------|
| `string` | `TEXT` | |
| `text` | `TEXT` | |
| `int` | `INTEGER` | |
| `long` | `INTEGER` | |
| `bigint` | `INTEGER` | |
| `float` | `REAL` | |
| `double` | `REAL` | |
| `boolean` | `INTEGER` | 0/1 values |
| `uuid` | `TEXT` | Stored as string |
| `timestamp` | `TEXT` | ISO 8601 format |
| `date` | `TEXT` | ISO 8601 date |
| `time` | `TEXT` | ISO 8601 time |
| `binary` | `BLOB` | |
| `json` | `TEXT` | JSON string |
| `decimal` | `REAL` | |

## SQLite-Specific Notes

- **STRICT mode**: When enabled, enforces type checking on columns
- **No native arrays**: Array types are stored as JSON strings
- **Limited ALTER TABLE**: Complex migrations may require table recreation
- **No UUID type**: UUIDs are stored as TEXT
- **Timestamps**: Stored as TEXT in ISO 8601 format

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/sqlite).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`@icetype/sql-common`](../sql-common) - Shared SQL utilities
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter
- [`@icetype/mysql`](../mysql) - MySQL adapter

## License

MIT
