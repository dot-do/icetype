# @icetype/sql-common

Shared SQL DDL utilities for IceType database adapters. This package provides common functionality for escaping identifiers, formatting values, and generating DDL statements across DuckDB, PostgreSQL, ClickHouse, SQLite, and MySQL.

## Installation

```bash
npm install @icetype/sql-common
# or
pnpm add @icetype/sql-common
```

## Usage

```typescript
import {
  escapeIdentifier,
  validateSchemaName,
  formatDefaultValue,
  serializeColumn,
  generateSystemColumns,
} from '@icetype/sql-common';

// Escape identifiers for specific dialects
const pgColumn = escapeIdentifier('user_name', 'postgres');  // "user_name"
const mysqlColumn = escapeIdentifier('user_name', 'mysql');  // `user_name`
const chColumn = escapeIdentifier('user_name', 'clickhouse'); // `user_name`

// Validate schema names (prevents SQL injection)
validateSchemaName('public');           // OK
validateSchemaName('my.schema');        // OK (qualified name)
validateSchemaName("'; DROP TABLE x"); // Throws InvalidSchemaNameError

// Format default values
const stringDefault = formatDefaultValue('hello', 'string', 'postgres');
const boolDefault = formatDefaultValue(true, 'boolean', 'mysql');
const intDefault = formatDefaultValue(42, 'int', 'sqlite');
```

## API

### Identifier Functions

| Export | Description |
|--------|-------------|
| `escapeIdentifier(name, dialect)` | Escape identifier for specific SQL dialect |
| `validateIdentifier(name, dialect)` | Validate identifier and return details |
| `isReservedKeyword(name)` | Check if name is a SQL reserved keyword |

### Validation Functions

| Export | Description |
|--------|-------------|
| `validateSchemaName(name)` | Validate schema name (throws on invalid) |

### Formatting Functions

| Export | Description |
|--------|-------------|
| `formatDefaultValue(value, type, dialect)` | Format default value for SQL |
| `serializeColumn(column, dialect)` | Serialize column definition to SQL |

### Generation Functions

| Export | Description |
|--------|-------------|
| `generateSystemColumns(dialect)` | Generate IceType system columns |
| `generateIndexStatements(table, schema, columns)` | Generate CREATE INDEX statements |

### Error Classes

| Export | Description |
|------|-------------|
| `InvalidSchemaNameError` | Schema name contains invalid characters |
| `InvalidIdentifierError` | Identifier is invalid |
| `IdentifierTooLongError` | Identifier exceeds dialect limit |

### Types

| Type | Description |
|------|-------------|
| `SqlDialect` | Supported dialects: 'duckdb', 'postgres', 'clickhouse', 'sqlite', 'mysql' |
| `SqlColumn` | Common column definition interface |
| `IdentifierValidationResult` | Result of identifier validation |

## Examples

### Escaping Identifiers

```typescript
import { escapeIdentifier } from '@icetype/sql-common';

// PostgreSQL uses double quotes
escapeIdentifier('User', 'postgres');     // "User"
escapeIdentifier('order', 'postgres');    // "order" (reserved keyword)

// MySQL uses backticks
escapeIdentifier('User', 'mysql');        // `User`
escapeIdentifier('order', 'mysql');       // `order`

// DuckDB uses double quotes
escapeIdentifier('User', 'duckdb');       // "User"

// ClickHouse uses backticks
escapeIdentifier('User', 'clickhouse');   // `User`

// SQLite uses double quotes
escapeIdentifier('User', 'sqlite');       // "User"
```

### Validating Schema Names

```typescript
import { validateSchemaName, InvalidSchemaNameError } from '@icetype/sql-common';

try {
  validateSchemaName('public');           // OK
  validateSchemaName('my_schema');        // OK
  validateSchemaName('catalog.schema');   // OK (qualified)
  validateSchemaName("test'; --");        // Throws!
} catch (error) {
  if (error instanceof InvalidSchemaNameError) {
    console.error('Invalid schema name:', error.message);
  }
}
```

### Generating System Columns

```typescript
import { generateSystemColumns } from '@icetype/sql-common';

const pgColumns = generateSystemColumns('postgres');
// Returns IceType system columns ($id, $type, $version, $createdAt, $updatedAt)
// with PostgreSQL-specific types

const mysqlColumns = generateSystemColumns('mysql');
// Same columns with MySQL-specific types
```

### Serializing Columns

```typescript
import { serializeColumn, SqlColumn } from '@icetype/sql-common';

const column: SqlColumn = {
  name: 'email',
  type: 'TEXT',
  nullable: false,
  unique: true,
};

const pgSQL = serializeColumn(column, 'postgres');
// "email" TEXT NOT NULL UNIQUE

const mysqlSQL = serializeColumn(column, 'mysql');
// `email` TEXT NOT NULL UNIQUE
```

### Checking Reserved Keywords

```typescript
import { isReservedKeyword } from '@icetype/sql-common';

isReservedKeyword('select');  // true
isReservedKeyword('order');   // true
isReservedKeyword('user');    // true (in some dialects)
isReservedKeyword('myfield'); // false
```

## Supported Dialects

| Dialect | Quote Style | Max Identifier Length |
|---------|-------------|----------------------|
| `postgres` | `"double"` | 63 bytes |
| `mysql` | `` `backtick` `` | 64 bytes |
| `sqlite` | `"double"` | 128 characters |
| `duckdb` | `"double"` | 255 bytes |
| `clickhouse` | `` `backtick` `` | 255 bytes |

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/sql-common).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter
- [`@icetype/mysql`](../mysql) - MySQL adapter
- [`@icetype/sqlite`](../sqlite) - SQLite adapter
- [`@icetype/duckdb`](../duckdb) - DuckDB adapter
- [`@icetype/clickhouse`](../clickhouse) - ClickHouse adapter

## License

MIT
