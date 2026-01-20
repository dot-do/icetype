# Apache Iceberg Export Example

This example demonstrates how to export IceType schemas to Apache Iceberg table metadata and Parquet schema formats.

## What is Apache Iceberg?

Apache Iceberg is a high-performance table format for huge analytic datasets. It provides:

- **Schema evolution** - Add, drop, rename columns without rewriting data
- **Partition evolution** - Change partitioning scheme without rewriting data
- **Time travel** - Query data as of any snapshot
- **ACID transactions** - Concurrent reads and writes

## Files

- `schema.ts` - Event and Order schemas with partition directives
- `export.ts` - Generates Iceberg metadata and Parquet schemas

## Schema Design for Iceberg

### Partitioning

Use `$partitionBy` to define partition keys:

```typescript
const EventSchema: SchemaDefinition = {
  $type: 'Event',
  $partitionBy: ['tenantId', 'eventDate'],
  // ...
};
```

This creates a partition structure like:
```
s3://bucket/events/
  tenantId=acme/
    eventDate=2024-01-15/
      data-001.parquet
```

### Type Mapping

| IceType | Iceberg | Parquet |
|---------|---------|---------|
| `string` | `string` | `BYTE_ARRAY` (UTF8) |
| `int` | `int` | `INT32` |
| `long` | `long` | `INT64` |
| `float` | `float` | `FLOAT` |
| `double` | `double` | `DOUBLE` |
| `boolean` | `boolean` | `BOOLEAN` |
| `timestamp` | `timestamp` | `INT64` (TIMESTAMP_MICROS) |
| `date` | `date` | `INT32` (DATE) |
| `uuid` | `uuid` | `FIXED_LEN_BYTE_ARRAY[16]` |
| `decimal(p,s)` | `decimal(p,s)` | `FIXED_LEN_BYTE_ARRAY` |
| `json` | `string` | `BYTE_ARRAY` (UTF8) |

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run the export
cd examples/iceberg
npx tsx export.ts
```

## Expected Output

```
============================================================
IceType to Apache Iceberg Export
============================================================

--- Exporting Event Schema ---

Table: Event
Location: s3://my-data-lake/warehouse/event
Format Version: 2
Schema ID: 0

Iceberg Schema (12 fields):
  - id: uuid
  - eventType: string
  - eventName: string
  - tenantId: string
  - userId?: string
  ...

Partition Spec:
  - tenantId (identity)
  - eventDate (identity)

Parquet Schema: 12 columns
```

## Using the Generated Metadata

### Apache Spark

```sql
-- Create table from metadata
CREATE TABLE my_catalog.events
USING iceberg
LOCATION 's3://my-data-lake/warehouse/event'
```

### Trino/Presto

```sql
SELECT eventType, COUNT(*) as count
FROM iceberg.my_schema.events
WHERE eventDate >= DATE '2024-01-01'
GROUP BY eventType
```

### DuckDB

```sql
INSTALL iceberg;
LOAD iceberg;

SELECT * FROM iceberg_scan('s3://my-data-lake/warehouse/event');
```

## Next Steps

- See [clickhouse](../clickhouse/) for ClickHouse DDL generation
- See [duckdb](../duckdb/) for DuckDB DDL generation
- See [basic](../basic/) for basic schema definitions
