# @icetype/sql-common

Shared SQL DDL utilities for IceType database adapters. This package provides common functionality for escaping identifiers, formatting values, validating inputs, and generating DDL statements across DuckDB, PostgreSQL, ClickHouse, SQLite, and MySQL.

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
  serializeDDL,
  generateSystemColumns,
  validateSchemaName,
  formatDefaultValue,
} from '@icetype/sql-common';

// Escape an identifier for a specific dialect
const pgColumn = escapeIdentifier('user', 'postgres');    // "user" (reserved keyword)
const mysqlColumn = escapeIdentifier('user', 'mysql');    // `user` (backtick style)

// Generate system columns for IceType tables
const systemCols = generateSystemColumns('postgres');
// Returns: [$id, $type, $version, $createdAt, $updatedAt] columns

// Serialize a complete DDL structure
const ddl = serializeDDL({
  tableName: 'User',
  schemaName: 'public',
  columns: [
    { name: 'id', type: 'UUID', nullable: false, primaryKey: true },
    { name: 'email', type: 'TEXT', nullable: false, unique: true },
    { name: 'name', type: 'TEXT', nullable: true },
  ],
  primaryKey: ['id'],
  ifNotExists: true,
}, 'postgres');

console.log(ddl);
// CREATE TABLE IF NOT EXISTS "public"."User" (
//   "id" UUID NOT NULL,
//   "email" TEXT NOT NULL UNIQUE,
//   "name" TEXT,
//   PRIMARY KEY ("id")
// );
```

## API

### Identifier Escaping

| Export | Description |
|--------|-------------|
| `escapeIdentifier(name, dialect)` | Escape an identifier for the given SQL dialect |
| `isReservedKeyword(name)` | Check if a name is a SQL reserved keyword |

### Validation Functions

| Export | Description |
|--------|-------------|
| `validateSchemaName(name)` | Validate a schema name (throws on invalid) |
| `validateIdentifier(name, dialect)` | Validate an identifier and get details |
| `InvalidSchemaNameError` | Error class for invalid schema names |
| `InvalidIdentifierError` | Error class for invalid identifiers |
| `IdentifierTooLongError` | Error class for identifiers exceeding length limits |

### Column Utilities

| Export | Description |
|--------|-------------|
| `serializeColumn(column, dialect)` | Serialize a column definition to DDL |
| `formatDefaultValue(value, type, dialect)` | Format a default value for SQL |
| `generateSystemColumns(dialect)` | Generate IceType system columns |
| `generateIndexStatements(table, schema, columns, dialect)` | Generate CREATE INDEX statements |

### Foreign Key Utilities

| Export | Description |
|--------|-------------|
| `extractForeignKeys(schema, allSchemas, options)` | Extract foreign keys from IceType schema |
| `serializeForeignKey(fk, dialect)` | Serialize a foreign key to DDL |

### DDL Serialization

| Export | Description |
|--------|-------------|
| `serializeDDL(ddl, dialect)` | Serialize a DDL structure to CREATE TABLE statement |

### Types

| Type | Description |
|------|-------------|
| `SqlDialect` | Supported dialects: 'postgres', 'mysql', 'sqlite', 'duckdb', 'clickhouse' |
| `SqlColumn` | Column definition interface |
| `DDLStructure` | Complete DDL structure for serialization |
| `ForeignKey` | Foreign key constraint definition |
| `ForeignKeyDefinition` | Foreign key definition from schema extraction |
| `ReferentialAction` | ON DELETE/UPDATE actions: CASCADE, SET NULL, etc. |
| `IdentifierValidationResult` | Result of identifier validation |

## Examples

### Escape Identifiers for Different Dialects

```typescript
import { escapeIdentifier, isReservedKeyword } from '@icetype/sql-common';

// Reserved keywords are always quoted
escapeIdentifier('user', 'postgres');     // "user"
escapeIdentifier('user', 'mysql');        // `user`
escapeIdentifier('select', 'sqlite');     // "select"

// Regular identifiers are not quoted
escapeIdentifier('email', 'postgres');    // email
escapeIdentifier('created_at', 'mysql');  // created_at

// System columns (starting with $) are quoted
escapeIdentifier('$id', 'postgres');      // "$id"
escapeIdentifier('$version', 'mysql');    // `$version`

// Check if a word is reserved
isReservedKeyword('select');  // true
isReservedKeyword('user');    // true
isReservedKeyword('email');   // false
```

### Validate Identifiers

```typescript
import {
  validateIdentifier,
  validateSchemaName,
  InvalidSchemaNameError,
  InvalidIdentifierError,
  IdentifierTooLongError,
} from '@icetype/sql-common';

// Validate an identifier for a dialect
const result = validateIdentifier('my_column', 'postgres');
console.log(result);
// {
//   valid: true,
//   identifier: 'my_column',
//   dialect: 'postgres',
//   needsQuoting: false,
//   isReservedKeyword: false,
//   byteLength: 9,
//   charLength: 9
// }

// Validate a schema name
validateSchemaName('public');  // OK
validateSchemaName('my_schema');  // OK
validateSchemaName('catalog.schema');  // OK (qualified name)

// These throw errors
try {
  validateSchemaName("invalid schema name!");
} catch (error) {
  if (error instanceof InvalidSchemaNameError) {
    console.log('Invalid schema name detected');
  }
}

// Identifier too long for PostgreSQL (63 bytes max)
try {
  validateIdentifier('a'.repeat(100), 'postgres');
} catch (error) {
  if (error instanceof IdentifierTooLongError) {
    console.log('Identifier exceeds PostgreSQL limit');
  }
}
```

### Generate System Columns

```typescript
import { generateSystemColumns } from '@icetype/sql-common';

// Generate IceType system columns for PostgreSQL
const pgSystemCols = generateSystemColumns('postgres');
// Returns:
// [
//   { name: '$id', type: 'TEXT', nullable: false, primaryKey: true },
//   { name: '$type', type: 'TEXT', nullable: false },
//   { name: '$version', type: 'INTEGER', nullable: false, default: '1' },
//   { name: '$createdAt', type: 'BIGINT', nullable: false },
//   { name: '$updatedAt', type: 'BIGINT', nullable: false },
// ]

// Generate for ClickHouse (different types)
const chSystemCols = generateSystemColumns('clickhouse');
// Returns columns with ClickHouse types: String, Int32, Int64
```

### Serialize DDL Structures

```typescript
import { serializeDDL, type DDLStructure } from '@icetype/sql-common';

// PostgreSQL with schema namespace
const pgDDL: DDLStructure = {
  tableName: 'Product',
  schemaName: 'inventory',
  columns: [
    { name: 'id', type: 'UUID', nullable: false },
    { name: 'name', type: 'TEXT', nullable: false },
    { name: 'price', type: 'DECIMAL(10,2)', nullable: false },
    { name: 'stock', type: 'INTEGER', nullable: false, default: '0' },
  ],
  primaryKey: ['id'],
  ifNotExists: true,
  unlogged: false,  // PostgreSQL-specific
};

const pgSQL = serializeDDL(pgDDL, 'postgres');

// MySQL with engine and charset
const mysqlDDL: DDLStructure = {
  tableName: 'Product',
  columns: [
    { name: 'id', type: 'CHAR(36)', nullable: false },
    { name: 'name', type: 'VARCHAR(255)', nullable: false },
    { name: 'price', type: 'DECIMAL(10,2)', nullable: false },
  ],
  primaryKey: ['id'],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
  comment: 'Product catalog',
};

const mysqlSQL = serializeDDL(mysqlDDL, 'mysql');

// SQLite with STRICT mode
const sqliteDDL: DDLStructure = {
  tableName: 'Product',
  columns: [
    { name: 'id', type: 'TEXT', nullable: false },
    { name: 'name', type: 'TEXT', nullable: false },
  ],
  primaryKey: ['id'],
  strict: true,
  withoutRowid: false,
};

const sqliteSQL = serializeDDL(sqliteDDL, 'sqlite');
```

### Format Default Values

```typescript
import { formatDefaultValue } from '@icetype/sql-common';

// String values are escaped and quoted
formatDefaultValue('active', 'TEXT');           // 'active'
formatDefaultValue("O'Brien", 'TEXT');          // 'O''Brien'

// Numbers are returned as-is
formatDefaultValue(42, 'INTEGER');              // '42'
formatDefaultValue(3.14, 'REAL');               // '3.14'

// Booleans are dialect-aware
formatDefaultValue(true, 'BOOLEAN', 'postgres');  // 'TRUE'
formatDefaultValue(true, 'INTEGER', 'sqlite');    // '1'

// Dates are formatted appropriately
formatDefaultValue(new Date('2024-01-15'), 'DATE');        // '2024-01-15'
formatDefaultValue(new Date('2024-01-15T10:30:00Z'), 'TIMESTAMP');  // ISO string

// JSON values are serialized
formatDefaultValue({ key: 'value' }, 'JSON');   // '{"key":"value"}'
formatDefaultValue(['a', 'b'], 'JSON');         // '["a","b"]'
```

### Extract and Serialize Foreign Keys

```typescript
import {
  extractForeignKeys,
  serializeForeignKey,
  type ForeignKeyDefinition,
} from '@icetype/sql-common';
import { parseSchema } from '@icetype/core';

// Parse schemas
const userSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string!',
});

const postSchema = parseSchema({
  $type: 'Post',
  id: 'uuid!',
  title: 'string!',
  author: '-> User',  // Forward relation creates FK
});

// Build schema map
const schemas = new Map([
  ['User', userSchema],
  ['Post', postSchema],
]);

// Extract foreign keys
const foreignKeys = extractForeignKeys(postSchema, schemas, {
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});

// Serialize for PostgreSQL
for (const fk of foreignKeys) {
  const ddl = serializeForeignKey(fk, 'postgres');
  console.log(ddl);
  // CONSTRAINT "fk_Post_author_User" FOREIGN KEY ("author_id")
  // REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
}

// Note: ClickHouse doesn't support foreign keys
const chDDL = serializeForeignKey(foreignKeys[0], 'clickhouse');
// Returns empty string
```

### Generate Index Statements

```typescript
import { generateIndexStatements, type SqlColumn } from '@icetype/sql-common';

const columns: SqlColumn[] = [
  { name: 'id', type: 'UUID', nullable: false },
  { name: 'email', type: 'TEXT', nullable: false, unique: true },
  { name: 'name', type: 'TEXT', nullable: true },
];

// Generate indexes for unique columns
const indexes = generateIndexStatements('User', 'public', columns, 'postgres');
console.log(indexes);
// ['CREATE INDEX IF NOT EXISTS "idx_User_email" ON "public"."User" ("email");']

// ClickHouse uses different indexing (ORDER BY), returns empty
const chIndexes = generateIndexStatements('User', undefined, columns, 'clickhouse');
// []
```

## Supported Dialects

| Dialect | Quote Character | Array Support | FK Support |
|---------|-----------------|---------------|------------|
| `postgres` | `"double quotes"` | Native | Yes |
| `mysql` | `` `backticks` `` | JSON | Yes |
| `sqlite` | `"double quotes"` | JSON | Yes |
| `duckdb` | `"double quotes"` | Native | Yes |
| `clickhouse` | `` `backticks` `` | Native | No |

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter
- [`@icetype/mysql`](../mysql) - MySQL adapter
- [`@icetype/sqlite`](../sqlite) - SQLite adapter
- [`@icetype/duckdb`](../duckdb) - DuckDB adapter
- [`@icetype/clickhouse`](../clickhouse) - ClickHouse adapter

## License

MIT
