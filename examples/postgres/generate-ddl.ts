/**
 * PostgreSQL DDL Generation Example
 *
 * Demonstrates how to generate PostgreSQL CREATE TABLE statements
 * from IceType schemas using the PostgreSQL adapter.
 *
 * Run with: npx tsx generate-ddl.ts
 */

import { parseSchema } from '@icetype/core';
import { PostgresAdapter, transformToPostgresDDL } from '@icetype/postgres';
import { CustomerSchema, schemas } from './schema.js';

/**
 * Main function - generate PostgreSQL DDL for all schemas
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType to PostgreSQL DDL Generation');
  console.log('='.repeat(60));

  const adapter = new PostgresAdapter();

  for (const [name, definition] of Object.entries(schemas)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`-- ${name} Table`);
    console.log('='.repeat(60) + '\n');

    // Parse the IceType schema
    const schema = parseSchema(definition);

    // Transform to PostgreSQL DDL
    const ddl = adapter.transform(schema, {
      schema: 'public',
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

  const quickDDL = transformToPostgresDDL(parseSchema(CustomerSchema), {
    ifNotExists: true,
    includeSystemFields: false,  // Skip system fields for simpler output
  });

  console.log('// Without system fields:\n');
  console.log(quickDDL);

  // Print usage examples
  console.log(`
PostgreSQL Usage Examples:

-- Create the schema (namespace)
CREATE SCHEMA IF NOT EXISTS public;

-- Insert a customer
INSERT INTO "public"."Customer" (
    "$id", "$type", "$version", "$createdAt", "$updatedAt",
    "id", "email", "name", "createdAt", "updatedAt"
) VALUES (
    'cust_' || gen_random_uuid(), 'Customer', 1,
    EXTRACT(EPOCH FROM now()) * 1000,
    EXTRACT(EPOCH FROM now()) * 1000,
    gen_random_uuid(), 'user@example.com', 'John Doe',
    now(), now()
);

-- Query customers with JSON metadata
SELECT * FROM "public"."Customer"
WHERE status = 'active'
  AND metadata->>'source' = 'web';

-- Join orders with customers
SELECT
    o."orderNumber",
    c."name" as customer_name,
    o."totalAmount"
FROM "public"."Order" o
JOIN "public"."Customer" c ON o."customerId" = c."id"
WHERE o."status" = 'shipped';

-- Aggregate order stats by customer
SELECT
    c."name",
    COUNT(o.*) as order_count,
    SUM(o."totalAmount") as total_spent
FROM "public"."Customer" c
LEFT JOIN "public"."Order" o ON o."customerId" = c."id"
GROUP BY c."id", c."name"
ORDER BY total_spent DESC;

-- Query products with array containment
SELECT * FROM "public"."Product"
WHERE 'sale' = ANY(tags);

-- Full-text search on product descriptions
SELECT * FROM "public"."Product"
WHERE to_tsvector('english', name || ' ' || COALESCE(description, ''))
      @@ plainto_tsquery('english', 'laptop');

-- Add foreign key constraints (after table creation)
ALTER TABLE "public"."Order" ADD CONSTRAINT fk_order_customer
  FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id");

ALTER TABLE "public"."OrderItem" ADD CONSTRAINT fk_orderitem_order
  FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id");

ALTER TABLE "public"."OrderItem" ADD CONSTRAINT fk_orderitem_product
  FOREIGN KEY ("productId") REFERENCES "public"."Product"("id");
`);
}

main();
