# ClickHouse DDL Example

This example demonstrates how to generate ClickHouse DDL (CREATE TABLE statements) from IceType schemas.

## What is ClickHouse?

ClickHouse is a fast open-source column-oriented OLAP database. It's designed for:

- **Real-time analytics** - Sub-second queries on billions of rows
- **High write throughput** - Millions of rows per second
- **Efficient compression** - Often 10x compression ratios
- **SQL interface** - Standard SQL with extensions

## Files

- `schema.ts` - Analytics schemas (Pageview, Metric, UserEvent)
- `generate-ddl.ts` - Generates ClickHouse CREATE TABLE statements

## ClickHouse Engine Types

### MergeTree

The base engine for all MergeTree family tables:

```sql
CREATE TABLE events
ENGINE = MergeTree()
ORDER BY (site_id, timestamp)
PARTITION BY toYYYYMM(timestamp)
```

### ReplacingMergeTree

Deduplicates rows by ORDER BY columns, keeping the latest version:

```sql
CREATE TABLE events
ENGINE = ReplacingMergeTree(version)  -- version column for ordering
ORDER BY (user_id, event_id)
```

### SummingMergeTree

Automatically sums numeric columns for rows with the same ORDER BY:

```sql
CREATE TABLE metrics
ENGINE = SummingMergeTree((count, sum_duration))  -- columns to sum
ORDER BY (service, metric, date)
```

## Type Mapping

| IceType | ClickHouse |
|---------|------------|
| `string` | `String` |
| `int` | `Int32` |
| `long` | `Int64` |
| `float` | `Float32` |
| `double` | `Float64` |
| `boolean` | `UInt8` |
| `timestamp` | `DateTime64(3)` |
| `date` | `Date` |
| `uuid` | `UUID` |
| `decimal(p,s)` | `Decimal(p,s)` |
| `json` | `String` |
| `string[]` | `Array(String)` |
| `string?` | `Nullable(String)` |

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Generate ClickHouse DDL
cd examples/clickhouse
npx tsx generate-ddl.ts
```

## Expected Output

```sql
============================================================
-- Pageview Table
============================================================

CREATE TABLE IF NOT EXISTS analytics.pageview
(
    id UUID,
    site_id String,
    page_url String,
    page_title Nullable(String),
    user_id Nullable(String),
    session_id String,
    visitor_id String,
    timestamp DateTime64(3),
    referrer Nullable(String),
    user_agent Nullable(String),
    country Nullable(String),
    region Nullable(String),
    city Nullable(String),
    device_type Nullable(String),
    browser Nullable(String),
    os Nullable(String),
    load_time Nullable(Int32),
    ttfb Nullable(Int32)
)
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (site_id, visitor_id, timestamp, id)
```

## Best Practices

### Partitioning

- Partition by month for most time-series data
- Don't over-partition (avoid daily partitions for small tables)
- Use partition pruning in queries

### ORDER BY

- Put high-cardinality columns first
- Include all filtering columns
- End with unique identifier for deterministic ordering

### Data Types

- Use `LowCardinality(String)` for columns with < 10,000 unique values
- Use `Nullable` only when necessary (has overhead)
- Use `DateTime64(3)` for millisecond precision

## Next Steps

- See [duckdb](../duckdb/) for DuckDB DDL generation
- See [iceberg](../iceberg/) for Iceberg metadata export
- See [basic](../basic/) for basic schema definitions
