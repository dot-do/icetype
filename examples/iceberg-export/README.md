# Iceberg Export Example

This example demonstrates how to export IceType schemas to Apache Iceberg table metadata format for use with data lake and data warehouse systems.

## What This Example Shows

1. **Schema Definition** (`schema.ts`) - Schemas optimized for Iceberg table design with proper partitioning
2. **Iceberg Export** (`export.ts`) - Generate Iceberg metadata JSON and Parquet schemas

## Apache Iceberg Overview

[Apache Iceberg](https://iceberg.apache.org/) is an open table format for large analytic datasets. IceType can export schemas to Iceberg format, enabling:

- **Schema Evolution** - Add, rename, or drop columns without rewriting data
- **Partition Evolution** - Change partitioning schemes without data migration
- **Time Travel** - Query historical snapshots of your data
- **ACID Transactions** - Serializable isolation for concurrent writes

## Partitioning Strategies

The example schemas demonstrate different partitioning approaches:

### Time-based Partitioning (Events)

```typescript
$partitionBy: ['tenantId', 'eventDate']
```

Creates partition directories like:
```
/tenantId=acme/eventDate=2024-01-15/
```

Best for:
- Time-series data
- Analytics queries with date filters
- Data retention policies

### Entity-based Partitioning (Orders)

```typescript
$partitionBy: ['customerId']
```

Creates partition directories like:
```
/customerId=cust_123/
```

Best for:
- Customer-specific queries
- Data isolation requirements
- Localized updates

### Location-based Partitioning (Inventory)

```typescript
$partitionBy: ['warehouseId']
```

Best for:
- Geographic data isolation
- Regional query patterns
- Distributed systems

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run the export
cd examples/iceberg-export
pnpm export
```

## Output Files

The export generates the following files in `./output/`:

| File | Description |
|------|-------------|
| `events-metadata.json` | Iceberg table metadata for events |
| `events-parquet-schema.json` | Parquet schema for events |
| `orders-metadata.json` | Iceberg table metadata for orders |
| `orders-parquet-schema.json` | Parquet schema for orders |
| `inventory-metadata.json` | Iceberg table metadata for inventory |
| `inventory-parquet-schema.json` | Parquet schema for inventory |
| `catalog.json` | Combined catalog of all tables |

## Iceberg Metadata Structure

The generated metadata follows Iceberg's v2 format:

```json
{
  "formatVersion": 2,
  "tableUuid": "...",
  "location": "s3://bucket/table",
  "schemas": [...],
  "partitionSpecs": [...],
  "sortOrders": [...],
  "properties": {...}
}
```

### Key Components

1. **Schema** - Field definitions with types and nullability
2. **Partition Spec** - How data is partitioned (identity, day, month, etc.)
3. **Sort Order** - Default row ordering within files
4. **Properties** - Table configuration (compression, file sizes, etc.)

## Type Mapping

| IceType | Iceberg | Parquet |
|---------|---------|---------|
| `string` | `string` | `BYTE_ARRAY` (UTF8) |
| `text` | `string` | `BYTE_ARRAY` (UTF8) |
| `int` | `int` | `INT32` |
| `long` | `long` | `INT64` |
| `float` | `float` | `FLOAT` |
| `double` | `double` | `DOUBLE` |
| `boolean` | `boolean` | `BOOLEAN` |
| `uuid` | `uuid` | `FIXED_LEN_BYTE_ARRAY[16]` |
| `timestamp` | `timestamp` | `INT64` (TIMESTAMP_MILLIS) |
| `timestamptz` | `timestamptz` | `INT64` (TIMESTAMP_MILLIS) |
| `date` | `date` | `INT32` (DATE) |
| `decimal(p,s)` | `decimal(p,s)` | `FIXED_LEN_BYTE_ARRAY` |
| `json` | `string` | `BYTE_ARRAY` (JSON) |
| `binary` | `binary` | `BYTE_ARRAY` |

## Integration Examples

### Apache Spark

```scala
// Read the metadata and register the table
spark.sql("""
  CALL system.register_table(
    'my_catalog.my_database.events',
    's3://data-lake/warehouse/events/metadata/v1.metadata.json'
  )
""")

// Query the table
spark.sql("SELECT * FROM events WHERE eventDate = '2024-01-15'")
```

### Trino/Presto

```sql
-- Query with partition pruning
SELECT eventType, COUNT(*) as event_count
FROM events
WHERE tenantId = 'acme'
  AND eventDate BETWEEN DATE '2024-01-01' AND DATE '2024-01-31'
GROUP BY eventType;
```

### AWS Athena

```sql
-- Create table from Iceberg metadata
CREATE TABLE events
LOCATION 's3://data-lake/warehouse/events'
TBLPROPERTIES ('table_type' = 'ICEBERG');
```

## Next Steps

- Check out the [basic-usage](../basic-usage) example for schema fundamentals
- Check out the [typescript-codegen](../typescript-codegen) example for generating TypeScript interfaces
