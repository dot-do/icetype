/**
 * DuckDB DDL Generation Example
 *
 * Demonstrates how to generate DuckDB CREATE TABLE statements
 * from IceType schemas using the DuckDB adapter.
 *
 * Run with: npx tsx generate-ddl.ts
 */

import { parseSchema } from '@icetype/core';
import { DuckDBAdapter, transformToDuckDBDDL } from '@icetype/duckdb';
import { CustomerSchema, schemas } from './schema.js';

/**
 * Main function - generate DuckDB DDL for all schemas
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType to DuckDB DDL Generation');
  console.log('='.repeat(60));

  const adapter = new DuckDBAdapter();

  for (const [name, definition] of Object.entries(schemas)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`-- ${name} Table`);
    console.log('='.repeat(60) + '\n');

    // Parse the IceType schema
    const schema = parseSchema(definition);

    // Transform to DuckDB DDL
    const ddl = adapter.transform(schema, {
      schema: 'main',
      ifNotExists: true,
      includeSystemFields: true,  // Include $id, $type, $version, etc.
    });

    // Serialize to SQL (with indexes)
    const sql = adapter.serializeWithIndexes(ddl);

    console.log(sql);
    console.log('');

    // Print schema summary
    console.log(`-- Summary:`);
    console.log(`--   Columns: ${ddl.columns.length}`);
    console.log(`--   Primary Key: ${ddl.primaryKey?.join(', ') || 'none'}`);
    if (ddl.uniqueConstraints && ddl.uniqueConstraints.length > 0) {
      console.log(`--   Unique Constraints: ${ddl.uniqueConstraints.map(c => c.join(', ')).join('; ')}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DDL generation complete!');
  console.log('='.repeat(60));

  // Print convenience function example
  console.log('\n--- Alternative: Using convenience function ---\n');

  const quickDDL = transformToDuckDBDDL(parseSchema(CustomerSchema), {
    ifNotExists: true,
    includeSystemFields: false,  // Skip system fields for simpler output
  });

  console.log('// Without system fields:\n');
  console.log(quickDDL);

  // Print usage examples
  console.log(`
DuckDB Usage Examples:

-- Create in-memory database and tables
-- (Just run the generated DDL)

-- Insert a customer
INSERT INTO "main"."Customer" (
    "$id", "$type", "$version", "$createdAt", "$updatedAt",
    "id", "email", "name", "createdAt", "updatedAt"
) VALUES (
    'cust_123', 'Customer', 1, epoch_ms(now()), epoch_ms(now()),
    gen_random_uuid(), 'user@example.com', 'John Doe',
    epoch_ms(now()), epoch_ms(now())
);

-- Query customers
SELECT * FROM "main"."Customer" WHERE status = 'active';

-- Join orders with customers
SELECT
    o.order_number,
    c.name as customer_name,
    o.total_amount
FROM "main"."Order" o
JOIN "main"."Customer" c ON o.customer_id = c.id
WHERE o.status = 'shipped';

-- Read from Parquet file
CREATE TABLE imported_orders AS
SELECT * FROM read_parquet('orders.parquet');

-- Export to Parquet
COPY "main"."Order" TO 'orders_export.parquet' (FORMAT PARQUET);

-- Aggregate analytics
SELECT
    event_type,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users
FROM "main"."AnalyticsEvent"
WHERE created_at >= now() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
`);
}

main();
