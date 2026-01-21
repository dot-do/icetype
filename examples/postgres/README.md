# PostgreSQL DDL Example

This example demonstrates how to generate PostgreSQL DDL (CREATE TABLE statements) from IceType schemas.

## What is PostgreSQL?

PostgreSQL is a powerful, open-source object-relational database system. It's designed for:

- **ACID compliance** - Full transaction support with data integrity
- **Extensibility** - Custom data types, functions, and operators
- **SQL standards** - Most SQL-compliant open source database
- **Robust features** - JSON, arrays, full-text search, and more

## Files

- `schema.ts` - Business schemas (Customer, Order, OrderItem, Product)
- `generate-ddl.ts` - Generates PostgreSQL CREATE TABLE statements

## Type Mapping

| IceType | PostgreSQL |
|---------|------------|
| `string` | `TEXT` |
| `text` | `TEXT` |
| `varchar` | `VARCHAR` |
| `int` | `INTEGER` |
| `long` | `BIGINT` |
| `float` | `REAL` |
| `double` | `DOUBLE PRECISION` |
| `boolean` | `BOOLEAN` |
| `timestamp` | `TIMESTAMP` |
| `timestamptz` | `TIMESTAMPTZ` |
| `date` | `DATE` |
| `time` | `TIME` |
| `uuid` | `UUID` |
| `decimal(p,s)` | `DECIMAL(p,s)` |
| `json` | `JSONB` |
| `binary` | `BYTEA` |
| `string[]` | `TEXT[]` |
| `string?` | `TEXT` (nullable) |

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Generate PostgreSQL DDL
cd examples/postgres
npx tsx generate-ddl.ts
```

Or run the schema file directly to see the DDL output:

```bash
cd examples/postgres
npx tsx schema.ts
```

## Expected Output

```sql
============================================================
-- Customer Table
============================================================

CREATE TABLE IF NOT EXISTS "public"."Customer" (
  "$id" TEXT NOT NULL,
  "$type" TEXT NOT NULL,
  "$version" INTEGER NOT NULL DEFAULT 1,
  "$createdAt" BIGINT NOT NULL,
  "$updatedAt" BIGINT NOT NULL,
  "id" UUID NOT NULL,
  "email" TEXT UNIQUE,
  "name" TEXT NOT NULL,
  "company" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT,
  "postalCode" TEXT,
  "status" TEXT DEFAULT 'active',
  "tier" TEXT DEFAULT 'free',
  "totalOrders" INTEGER DEFAULT 0,
  "totalSpent" DECIMAL(10, 2) DEFAULT 0,
  "lastOrderAt" TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  PRIMARY KEY ("$id"),
  UNIQUE ("email")
);

CREATE INDEX IF NOT EXISTS "idx_Customer_email" ON "public"."Customer" ("email");
CREATE INDEX IF NOT EXISTS "idx_Customer_createdAt" ON "public"."Customer" ("createdAt");
```

## System Fields

The PostgreSQL adapter adds system fields to each table:

| Field | Type | Description |
|-------|------|-------------|
| `$id` | TEXT | Unique document identifier (primary key) |
| `$type` | TEXT | Document type name |
| `$version` | INTEGER | Version for optimistic concurrency |
| `$createdAt` | BIGINT | Creation timestamp (epoch ms) |
| `$updatedAt` | BIGINT | Last update timestamp (epoch ms) |

You can disable system fields with `includeSystemFields: false`.

## PostgreSQL Features

### JSONB for Flexible Data

```sql
-- Store flexible metadata
INSERT INTO "Customer" (metadata) VALUES ('{"source": "web", "campaign": "summer2024"}');

-- Query JSON fields
SELECT * FROM "Customer" WHERE metadata->>'source' = 'web';

-- Index JSON fields
CREATE INDEX idx_customer_source ON "Customer" ((metadata->>'source'));
```

### Array Types

```sql
-- Store arrays
INSERT INTO "Product" (tags) VALUES (ARRAY['electronics', 'sale', 'featured']);

-- Query arrays
SELECT * FROM "Product" WHERE 'sale' = ANY(tags);

-- Index arrays (GIN index)
CREATE INDEX idx_product_tags ON "Product" USING GIN (tags);
```

### Full-Text Search

```sql
-- Create a text search index
ALTER TABLE "Product" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || COALESCE(description, ''))) STORED;

CREATE INDEX idx_product_search ON "Product" USING GIN (search_vector);

-- Search products
SELECT * FROM "Product" WHERE search_vector @@ plainto_tsquery('english', 'laptop computer');
```

### Constraints and Foreign Keys

```sql
-- Add foreign key constraint
ALTER TABLE "Order" ADD CONSTRAINT fk_order_customer
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id");

-- Add check constraint
ALTER TABLE "Product" ADD CONSTRAINT chk_price_positive
  CHECK (price > 0);
```

## Best Practices

1. **Use JSONB over JSON** - JSONB is faster for queries and supports indexing
2. **Index strategically** - Index columns used in WHERE, JOIN, and ORDER BY
3. **Use appropriate types** - UUID for identifiers, TIMESTAMPTZ for global apps
4. **Consider partitioning** - For tables with millions of rows

## Next Steps

- See [duckdb](../duckdb/) for DuckDB DDL generation
- See [clickhouse](../clickhouse/) for ClickHouse DDL generation
- See [iceberg](../iceberg/) for Iceberg metadata export
- See [basic](../basic/) for basic schema definitions
