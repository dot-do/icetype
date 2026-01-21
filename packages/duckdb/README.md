# @icetype/duckdb

DuckDB adapter for IceType schema transformations. This package generates DuckDB DDL (Data Definition Language) statements from IceType schemas, optimized for analytical workloads.

## Installation

```bash
npm install @icetype/duckdb
# or
pnpm add @icetype/duckdb
```

## Usage

```typescript
import { parseSchema } from '@icetype/core';
import { DuckDBAdapter, transformToDuckDBDDL } from '@icetype/duckdb';

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
const adapter = new DuckDBAdapter();
const ddl = adapter.transform(schema, { ifNotExists: true });
const sql = adapter.serialize(ddl);

// Option 2: Use the convenience function
const sql2 = transformToDuckDBDDL(schema, {
  ifNotExists: true,
  schema: 'analytics',
});

console.log(sql2);
// CREATE TABLE IF NOT EXISTS "analytics"."User" (
//   "$id" VARCHAR NOT NULL,
//   "$type" VARCHAR NOT NULL,
//   "$version" INTEGER NOT NULL DEFAULT 1,
//   "$createdAt" BIGINT NOT NULL,
//   "$updatedAt" BIGINT NOT NULL,
//   "id" UUID NOT NULL,
//   "email" VARCHAR UNIQUE,
//   "name" VARCHAR,
//   "age" INTEGER,
//   "balance" DECIMAL(38, 9),
//   "tags" VARCHAR[],
//   "createdAt" TIMESTAMP,
//   PRIMARY KEY ("$id"),
//   UNIQUE ("email")
// );
```

## API

### Main Exports

| Export | Description |
|--------|-------------|
| `DuckDBAdapter` | Adapter class for DuckDB DDL generation |
| `createDuckDBAdapter()` | Factory function to create adapter |
| `transformToDuckDBDDL(schema, options)` | Transform schema to DDL string |
| `generateDuckDBDDL(schema, options)` | Generate DDL object |

### DDL Helpers

| Export | Description |
|--------|-------------|
| `mapIceTypeToDuckDB(type)` | Map IceType to DuckDB type |
| `getDuckDBTypeString(mapping)` | Get DuckDB type as string |
| `fieldToDuckDBColumn(field)` | Convert field to column definition |
| `toArrayType(type)` | Convert type to array type |
| `serializeDDL(ddl)` | Serialize DDL object to SQL string |
| `generateIndexStatements(table, schema, columns)` | Generate CREATE INDEX statements |
| `escapeIdentifier(name)` | Escape identifier for DuckDB |

### Validation

| Export | Description |
|--------|-------------|
| `validateSchemaName(name)` | Validate schema name for SQL injection |
| `InvalidSchemaNameError` | Error for invalid schema names |

### Types

| Type | Description |
|------|-------------|
| `DuckDBType` | DuckDB data types |
| `DuckDBColumn` | Column definition for DuckDB |
| `DuckDBDDL` | Complete DDL structure |
| `DuckDBAdapterOptions` | Options for DDL generation |

## Examples

### Basic Table Generation

```typescript
import { parseSchema } from '@icetype/core';
import { transformToDuckDBDDL } from '@icetype/duckdb';

const schema = parseSchema({
  $type: 'Events',
  id: 'uuid!',
  eventType: 'string!',
  timestamp: 'timestamp!',
  payload: 'json',
  tags: 'string[]',
});

const sql = transformToDuckDBDDL(schema, {
  schema: 'analytics',
  ifNotExists: true,
});
```

### With Schema Namespace

```typescript
const sql = transformToDuckDBDDL(schema, {
  schema: 'my_schema',
  ifNotExists: true,
});
// Creates table in "my_schema" namespace
```

### Generate Multiple Tables

```typescript
import { DuckDBAdapter } from '@icetype/duckdb';

const adapter = new DuckDBAdapter();
const schemas = [eventsSchema, metricsSchema, sessionsSchema];

const ddlStatements = schemas.map(schema => {
  const ddl = adapter.transform(schema, { schema: 'analytics' });
  return adapter.serialize(ddl);
});

const fullSQL = ddlStatements.join('\n\n');
```

### Using with Adapter Registry

```typescript
import { createAdapterRegistry } from '@icetype/adapters';
import { DuckDBAdapter } from '@icetype/duckdb';

const registry = createAdapterRegistry();
registry.register(new DuckDBAdapter());

const adapter = registry.get('duckdb');
const ddl = adapter?.transform(schema, { schema: 'analytics' });
const sql = adapter?.serialize(ddl);
```

### Array Types for Analytics

```typescript
const schema = parseSchema({
  $type: 'UserActivity',
  userId: 'uuid!',
  sessionIds: 'string[]',     // VARCHAR[]
  pageViews: 'int[]',         // INTEGER[]
  timestamps: 'timestamp[]',  // TIMESTAMP[]
  metrics: 'float[]',         // DOUBLE[]
});

const sql = transformToDuckDBDDL(schema);
```

### Analytical Queries Setup

```typescript
// Create tables optimized for analytics
const eventsSchema = parseSchema({
  $type: 'Events',
  eventId: 'uuid!',
  eventType: 'string!',
  userId: 'string?',
  timestamp: 'timestamp!',
  properties: 'json',
});

const sql = transformToDuckDBDDL(eventsSchema, {
  schema: 'raw',
  ifNotExists: true,
});

// DuckDB excels at analytical queries like:
// SELECT eventType, COUNT(*) FROM raw.Events
// GROUP BY eventType ORDER BY COUNT(*) DESC
```

### Generate Index Statements

```typescript
import { generateIndexStatements } from '@icetype/duckdb';

const indexes = generateIndexStatements('Events', 'analytics', [
  { name: 'userId', type: 'VARCHAR', nullable: true, unique: false },
  { name: 'timestamp', type: 'TIMESTAMP', nullable: false },
]);
```

## Type Mappings

| IceType | DuckDB Type | Notes |
|---------|-------------|-------|
| `string` | `VARCHAR` | Variable length |
| `text` | `VARCHAR` | Same as string |
| `int` | `INTEGER` | 32-bit integer |
| `long` | `BIGINT` | 64-bit integer |
| `bigint` | `BIGINT` | 64-bit integer |
| `float` | `REAL` | 32-bit float |
| `double` | `DOUBLE` | 64-bit float |
| `boolean` | `BOOLEAN` | Native boolean |
| `uuid` | `UUID` | Native UUID type |
| `timestamp` | `TIMESTAMP` | |
| `date` | `DATE` | |
| `time` | `TIME` | |
| `binary` | `BLOB` | |
| `json` | `JSON` | Native JSON type |
| `decimal(p,s)` | `DECIMAL(p,s)` | Arbitrary precision |
| `string[]` | `VARCHAR[]` | Native arrays |

## DuckDB-Specific Features

- **Native UUID type**: Full UUID support with efficient storage
- **Native JSON type**: Efficient JSON operations and querying
- **Array types**: Native array support for all types
- **Columnar storage**: Optimized for analytical queries
- **In-process database**: No server required
- **Parquet integration**: Direct reading/writing of Parquet files

## Use Cases

DuckDB is ideal for:
- Analytical queries and aggregations
- OLAP workloads
- Data transformation pipelines
- Embedded analytics in applications
- Local data exploration
- Working with Parquet and CSV files

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/duckdb).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`@icetype/sql-common`](../sql-common) - Shared SQL utilities
- [`@icetype/iceberg`](../iceberg) - Apache Iceberg integration
- [`@icetype/clickhouse`](../clickhouse) - ClickHouse adapter

## License

MIT
