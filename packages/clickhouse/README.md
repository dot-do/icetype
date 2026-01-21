# @icetype/clickhouse

ClickHouse adapter for IceType schema transformations. This package generates ClickHouse DDL (CREATE TABLE statements) from IceType schemas, with support for various MergeTree engine types and ClickHouse-specific features.

## Installation

```bash
npm install @icetype/clickhouse
# or
pnpm add @icetype/clickhouse
```

## Usage

```typescript
import { parseSchema } from '@icetype/core';
import { ClickHouseAdapter, transformToClickHouseDDL } from '@icetype/clickhouse';

// Parse an IceType schema
const schema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  age: 'int?',
  balance: 'decimal',
  tags: 'string[]',
  createdAt: 'timestamp',
});

// Option 1: Use the adapter directly
const adapter = new ClickHouseAdapter();
const ddl = adapter.transform(schema, {
  engine: 'ReplacingMergeTree',
  orderBy: ['id'],
  partitionBy: 'toYYYYMM(createdAt)',
  database: 'analytics',
});
const sql = adapter.serialize(ddl);

// Option 2: Use the convenience function
const sql2 = transformToClickHouseDDL(schema, {
  engine: 'MergeTree',
  orderBy: ['id'],
  database: 'default',
});

console.log(sql2);
// CREATE TABLE IF NOT EXISTS default.user
// (
//     "$id" String,
//     "$type" String,
//     "$version" Int32 DEFAULT 1,
//     "$createdAt" Int64,
//     "$updatedAt" Int64,
//     "id" UUID,
//     "email" String,
//     "name" String,
//     "age" Nullable(Int32),
//     "balance" Decimal(38, 9),
//     "tags" Array(String),
//     "createdAt" DateTime64(3)
// )
// ENGINE = MergeTree()
// ORDER BY (id)
```

## API

### Main Exports

| Export | Description |
|--------|-------------|
| `ClickHouseAdapter` | Adapter class for ClickHouse DDL generation |
| `createClickHouseAdapter()` | Factory function to create adapter |
| `transformToClickHouseDDL(schema, options)` | Transform schema to DDL string |
| `generateClickHouseDDL(schema, options)` | Generate DDL object |

### Types

| Type | Description |
|------|-------------|
| `ClickHouseEngine` | Engine types (MergeTree, ReplacingMergeTree, etc.) |
| `ClickHouseTableOptions` | Options for table generation |
| `ClickHouseColumn` | Column definition for ClickHouse |
| `ClickHouseDDL` | Complete DDL structure |

### Type Mapping Utilities

| Export | Description |
|--------|-------------|
| `ICETYPE_TO_CLICKHOUSE` | Type mapping constant |
| `getClickHouseType(iceType)` | Get ClickHouse type for IceType |
| `wrapNullable(type)` | Wrap type in Nullable() |
| `getArrayType(type)` | Get Array(type) representation |

### DDL Helpers

| Export | Description |
|--------|-------------|
| `escapeIdentifier(name)` | Escape identifier for ClickHouse |
| `escapeString(value)` | Escape string value |
| `escapeSettingKey(key)` | Escape setting key |
| `escapeSettingValue(value)` | Escape setting value |
| `formatDefaultValue(value)` | Format default value expression |
| `generateSystemColumns()` | Generate IceType system columns |
| `serializeColumn(column)` | Serialize column to DDL |
| `generateColumnDDL(columns)` | Generate column definitions |
| `generateEngineDDL(options)` | Generate ENGINE clause |
| `generateCreateTableDDL(table, options)` | Generate CREATE TABLE statement |
| `generateDropTableDDL(table, options)` | Generate DROP TABLE statement |
| `generateAddColumnDDL(table, column)` | Generate ALTER TABLE ADD COLUMN |
| `generateDropColumnDDL(table, column)` | Generate ALTER TABLE DROP COLUMN |
| `isValidEngine(engine)` | Validate engine name |
| `inferOrderBy(schema)` | Infer ORDER BY from schema |

### Migration Exports

| Export | Description |
|--------|-------------|
| `ClickHouseMigrationGenerator` | Class for generating migration SQL |
| `createClickHouseMigrationGenerator()` | Factory function for migrations |
| `ClickHouseMigrationOptions` | Options for migration generation |

### Validation

| Export | Description |
|--------|-------------|
| `validateSchemaName(name)` | Validate schema name for SQL injection |
| `InvalidSchemaNameError` | Error for invalid schema names |
| `InvalidSettingKeyError` | Error for invalid setting keys |
| `InvalidSettingValueError` | Error for invalid setting values |

## Examples

### Basic Table Generation

```typescript
import { parseSchema } from '@icetype/core';
import { transformToClickHouseDDL } from '@icetype/clickhouse';

const schema = parseSchema({
  $type: 'Event',
  id: 'uuid!',
  eventType: 'string!',
  userId: 'string?',
  timestamp: 'timestamp!',
  properties: 'json?',
});

const sql = transformToClickHouseDDL(schema, {
  engine: 'MergeTree',
  orderBy: ['timestamp', 'eventType'],
  partitionBy: 'toYYYYMM(timestamp)',
  database: 'analytics',
});
```

### Using ReplacingMergeTree

```typescript
const sql = transformToClickHouseDDL(schema, {
  engine: 'ReplacingMergeTree',
  orderBy: ['id'],
  partitionBy: 'toYYYYMM(createdAt)',
  // Use $version column for deduplication
});
```

### With TTL (Time-To-Live)

```typescript
const sql = transformToClickHouseDDL(schema, {
  engine: 'MergeTree',
  orderBy: ['timestamp'],
  ttl: 'timestamp + INTERVAL 90 DAY',
  database: 'logs',
});
```

### Using with Adapter Registry

```typescript
import { createAdapterRegistry } from '@icetype/adapters';
import { ClickHouseAdapter } from '@icetype/clickhouse';

const registry = createAdapterRegistry();
registry.register(new ClickHouseAdapter());

const adapter = registry.get('clickhouse');
const ddl = adapter?.transform(schema, {
  engine: 'MergeTree',
  orderBy: ['id'],
});
const sql = adapter?.serialize(ddl);
```

### Generate Migrations

```typescript
import { diffSchemas, parseSchema } from '@icetype/core';
import { createClickHouseMigrationGenerator } from '@icetype/clickhouse';

const oldSchema = parseSchema({
  $type: 'Event',
  id: 'uuid!',
  timestamp: 'timestamp!',
});

const newSchema = parseSchema({
  $type: 'Event',
  id: 'uuid!',
  timestamp: 'timestamp!',
  userId: 'string?',
  eventType: 'string!',
});

const diff = diffSchemas(oldSchema, newSchema);
const generator = createClickHouseMigrationGenerator();
const statements = generator.generate(diff);

console.log(statements);
// ['ALTER TABLE "Event" ADD COLUMN "userId" Nullable(String);',
//  'ALTER TABLE "Event" ADD COLUMN "eventType" String;']
```

## Type Mappings

| IceType | ClickHouse Type | Notes |
|---------|-----------------|-------|
| `string` | `String` | |
| `text` | `String` | |
| `int` | `Int32` | |
| `long` | `Int64` | |
| `bigint` | `Int64` | |
| `float` | `Float32` | |
| `double` | `Float64` | |
| `boolean` | `Bool` | |
| `uuid` | `UUID` | Native UUID type |
| `timestamp` | `DateTime64(3)` | Millisecond precision |
| `date` | `Date` | |
| `time` | `String` | Stored as string |
| `binary` | `String` | Base64 encoded |
| `json` | `String` | JSON as string |
| `decimal(p,s)` | `Decimal(p,s)` | |
| `string[]` | `Array(String)` | Native arrays |

## ClickHouse-Specific Features

- **MergeTree Engines**: Full support for MergeTree, ReplacingMergeTree, SummingMergeTree, AggregatingMergeTree
- **Partitioning**: Support for PARTITION BY expressions
- **Primary Key**: ORDER BY defines the primary key/sorting key
- **TTL**: Support for data expiration with TTL clauses
- **Nullable types**: Automatic wrapping in Nullable() for optional fields
- **Array types**: Native ClickHouse array support
- **UUID type**: Native UUID support

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/clickhouse).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`@icetype/sql-common`](../sql-common) - Shared SQL utilities
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter
- [`@icetype/duckdb`](../duckdb) - DuckDB adapter

## License

MIT
