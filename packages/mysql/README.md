# @icetype/mysql

MySQL adapter for IceType schema transformations. This package generates MySQL DDL (Data Definition Language) statements from IceType schemas.

## Installation

```bash
npm install @icetype/mysql
# or
pnpm add @icetype/mysql
```

## Usage

```typescript
import { parseSchema } from '@icetype/core';
import { MySQLAdapter, transformToMySQLDDL } from '@icetype/mysql';

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
const adapter = new MySQLAdapter();
const ddl = adapter.transform(schema, { ifNotExists: true });
const sql = adapter.serialize(ddl);

// Option 2: Use the convenience function
const sql2 = transformToMySQLDDL(schema, {
  ifNotExists: true,
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
});

console.log(sql2);
// CREATE TABLE IF NOT EXISTS User (
//   `$id` VARCHAR(255) NOT NULL,
//   `$type` VARCHAR(255) NOT NULL,
//   `$version` INT NOT NULL DEFAULT 1,
//   `$createdAt` BIGINT NOT NULL,
//   `$updatedAt` BIGINT NOT NULL,
//   id CHAR(36) NOT NULL,
//   email VARCHAR(255) UNIQUE,
//   name VARCHAR(255),
//   age INT,
//   balance DECIMAL(38, 9),
//   createdAt DATETIME,
//   PRIMARY KEY (`$id`),
//   UNIQUE (email)
// ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## API

### Main Exports

| Export | Description |
|--------|-------------|
| `MySQLAdapter` | Adapter class for MySQL DDL generation |
| `createMySQLAdapter()` | Factory function to create adapter |
| `transformToMySQLDDL(schema, options)` | Transform schema to DDL string |
| `generateMySQLDDL(schema, options)` | Generate DDL object |

### DDL Helpers

| Export | Description |
|--------|-------------|
| `mapIceTypeToMySQL(type)` | Map IceType to MySQL type |
| `getMySQLTypeString(mapping)` | Get MySQL type as string |
| `fieldToMySQLColumn(field)` | Convert field to column definition |
| `serializeDDL(ddl)` | Serialize DDL object to SQL string |
| `generateIndexStatements(table, columns)` | Generate CREATE INDEX statements |
| `escapeIdentifier(name)` | Escape identifier for MySQL (backticks) |
| `formatDefaultValue(value, type)` | Format default value for MySQL |

### Migration Exports

| Export | Description |
|--------|-------------|
| `MySQLMigrationGenerator` | Class for generating migration SQL |
| `createMySQLMigrationGenerator()` | Factory function for migrations |

### Types

| Type | Description |
|------|-------------|
| `MySQLType` | MySQL data types |
| `MySQLColumn` | Column definition for MySQL |
| `MySQLDDL` | Complete DDL structure |
| `MySQLAdapterOptions` | Options for DDL generation |

## Examples

### Basic Table Generation

```typescript
import { parseSchema } from '@icetype/core';
import { transformToMySQLDDL } from '@icetype/mysql';

const schema = parseSchema({
  $type: 'Product',
  id: 'uuid!',
  name: 'string!',
  price: 'decimal(10,2)!',
  stock: 'int!',
  description: 'text?',
});

const sql = transformToMySQLDDL(schema, {
  engine: 'InnoDB',
  charset: 'utf8mb4',
});
```

### With Engine and Character Set

```typescript
const sql = transformToMySQLDDL(schema, {
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
  ifNotExists: true,
});
```

### Generate Multiple Tables

```typescript
import { MySQLAdapter } from '@icetype/mysql';

const adapter = new MySQLAdapter();
const schemas = [userSchema, postSchema, commentSchema];

const ddlStatements = schemas.map(schema => {
  const ddl = adapter.transform(schema, {
    engine: 'InnoDB',
    charset: 'utf8mb4',
  });
  return adapter.serialize(ddl);
});

const fullSQL = ddlStatements.join('\n\n');
```

### Using with Adapter Registry

```typescript
import { createAdapterRegistry } from '@icetype/adapters';
import { MySQLAdapter } from '@icetype/mysql';

const registry = createAdapterRegistry();
registry.register(new MySQLAdapter());

const adapter = registry.get('mysql');
const ddl = adapter?.transform(schema, { engine: 'InnoDB' });
const sql = adapter?.serialize(ddl);
```

### Generate Migrations

```typescript
import { diffSchemas, parseSchema } from '@icetype/core';
import { createMySQLMigrationGenerator } from '@icetype/mysql';

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
  createdAt: 'timestamp!',
});

const diff = diffSchemas(oldSchema, newSchema);
const generator = createMySQLMigrationGenerator();
const statements = generator.generate(diff);

console.log(statements);
// ['ALTER TABLE `User` ADD COLUMN `email` VARCHAR(255) NOT NULL;',
//  'ALTER TABLE `User` ADD COLUMN `createdAt` DATETIME NOT NULL;']
```

### Generate Index Statements

```typescript
import { generateIndexStatements } from '@icetype/mysql';

const indexes = generateIndexStatements('User', undefined, [
  { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true },
  { name: 'createdAt', type: 'DATETIME', nullable: false },
]);
```

### Text Fields with Length

```typescript
const schema = parseSchema({
  $type: 'Article',
  id: 'uuid!',
  title: 'string!',        // VARCHAR(255)
  summary: 'text!',        // TEXT
  content: 'text!',        // TEXT
});
```

## Type Mappings

| IceType | MySQL Type | Notes |
|---------|------------|-------|
| `string` | `VARCHAR(255)` | Default length 255 |
| `text` | `TEXT` | For longer strings |
| `int` | `INT` | |
| `long` | `BIGINT` | |
| `bigint` | `BIGINT` | |
| `float` | `FLOAT` | |
| `double` | `DOUBLE` | |
| `boolean` | `TINYINT(1)` | 0/1 values |
| `uuid` | `CHAR(36)` | Fixed-length string |
| `timestamp` | `DATETIME` | |
| `date` | `DATE` | |
| `time` | `TIME` | |
| `binary` | `BLOB` | |
| `json` | `JSON` | MySQL 5.7+ native JSON |
| `decimal(p,s)` | `DECIMAL(p,s)` | |

## MySQL-Specific Notes

- **No native UUID type**: UUIDs stored as CHAR(36)
- **No native arrays**: Array types stored as JSON
- **VARCHAR limit**: Default 255, use TEXT for longer strings
- **Engine selection**: InnoDB recommended for transactions and foreign keys
- **Character set**: Use utf8mb4 for full Unicode support
- **Collation**: utf8mb4_unicode_ci recommended for case-insensitive sorting

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/mysql).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`@icetype/sql-common`](../sql-common) - Shared SQL utilities
- [`@icetype/migrations`](../migrations) - Migration infrastructure
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter
- [`@icetype/drizzle`](../drizzle) - Drizzle ORM adapter

## License

MIT
