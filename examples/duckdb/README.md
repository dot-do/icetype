# DuckDB DDL Example

This example demonstrates how to generate DuckDB DDL (CREATE TABLE statements) from IceType schemas.

## What is DuckDB?

DuckDB is an in-process SQL OLAP database management system. It's designed for:

- **Embedded analytics** - Run inside your application
- **Fast OLAP queries** - Columnar storage and vectorized execution
- **Easy data access** - Read Parquet, CSV, JSON directly
- **Zero configuration** - No server setup required

## Files

- `schema.ts` - Business schemas (Customer, Product, Order, AnalyticsEvent)
- `generate-ddl.ts` - Generates DuckDB CREATE TABLE statements

## Type Mapping

| IceType | DuckDB |
|---------|--------|
| `string` | `VARCHAR` |
| `text` | `VARCHAR` |
| `int` | `INTEGER` |
| `long` | `BIGINT` |
| `float` | `REAL` |
| `double` | `DOUBLE` |
| `boolean` | `BOOLEAN` |
| `timestamp` | `TIMESTAMP` |
| `date` | `DATE` |
| `uuid` | `UUID` |
| `decimal(p,s)` | `DECIMAL(p,s)` |
| `json` | `JSON` |
| `string[]` | `VARCHAR[]` |
| `string?` | `VARCHAR` (nullable) |

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Generate DuckDB DDL
cd examples/duckdb
npx tsx generate-ddl.ts
```

## Expected Output

```sql
============================================================
-- Customer Table
============================================================

CREATE TABLE IF NOT EXISTS "main"."Customer" (
  "$id" VARCHAR NOT NULL,
  "$type" VARCHAR NOT NULL,
  "$version" INTEGER NOT NULL DEFAULT 1,
  "$createdAt" BIGINT NOT NULL,
  "$updatedAt" BIGINT NOT NULL,
  "id" UUID NOT NULL,
  "email" VARCHAR UNIQUE,
  "name" VARCHAR NOT NULL,
  "company" VARCHAR,
  "address" VARCHAR,
  "city" VARCHAR,
  "state" VARCHAR,
  "country" VARCHAR,
  "postalCode" VARCHAR,
  "status" VARCHAR DEFAULT 'active',
  "tier" VARCHAR DEFAULT 'free',
  "totalOrders" INTEGER DEFAULT 0,
  "totalSpent" DECIMAL(10, 2) DEFAULT 0,
  "lastOrderAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  PRIMARY KEY ("$id"),
  UNIQUE ("email")
);

CREATE INDEX IF NOT EXISTS "idx_Customer_email" ON "main"."Customer" ("email");
CREATE INDEX IF NOT EXISTS "idx_Customer_createdAt" ON "main"."Customer" ("createdAt");
```

## System Fields

The DuckDB adapter adds system fields to each table:

| Field | Type | Description |
|-------|------|-------------|
| `$id` | VARCHAR | Unique document identifier (primary key) |
| `$type` | VARCHAR | Document type name |
| `$version` | INTEGER | Version for optimistic concurrency |
| `$createdAt` | BIGINT | Creation timestamp (epoch ms) |
| `$updatedAt` | BIGINT | Last update timestamp (epoch ms) |

You can disable system fields with `includeSystemFields: false`.

## DuckDB Features

### Reading External Files

```sql
-- Read Parquet directly
SELECT * FROM read_parquet('data/*.parquet');

-- Read CSV with options
SELECT * FROM read_csv('data.csv', header=true, auto_detect=true);

-- Read JSON
SELECT * FROM read_json_auto('data.json');
```

### Exporting Data

```sql
-- Export to Parquet
COPY customers TO 'customers.parquet' (FORMAT PARQUET);

-- Export to CSV
COPY orders TO 'orders.csv' (HEADER, DELIMITER ',');
```

### Useful Functions

```sql
-- Generate UUID
SELECT gen_random_uuid();

-- Current timestamp as epoch milliseconds
SELECT epoch_ms(now());

-- JSON operations
SELECT json_extract(properties, '$.key') FROM events;
```

## Best Practices

1. **Use Parquet** for persistent storage - Better compression and faster reads
2. **Avoid system fields** if you don't need them - Simpler schema
3. **Use JSON type** for flexible nested data - DuckDB has excellent JSON support
4. **Leverage array types** - DuckDB handles arrays natively

## Next Steps

- See [clickhouse](../clickhouse/) for ClickHouse DDL generation
- See [iceberg](../iceberg/) for Iceberg metadata export
- See [basic](../basic/) for basic schema definitions
