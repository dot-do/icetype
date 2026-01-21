/**
 * PostgreSQL Schema Example
 *
 * This file defines schemas optimized for PostgreSQL, a powerful
 * object-relational database. PostgreSQL is great for:
 *
 * - Transactional applications with ACID compliance
 * - Complex queries with advanced SQL features
 * - JSONB for flexible semi-structured data
 * - Full-text search and array operations
 */

import type { SchemaDefinition } from '@icetype/core';
import { parseSchema } from '@icetype/core';
import { PostgresAdapter } from '@icetype/postgres';

/**
 * Customer Schema
 *
 * Customer data with typical business fields.
 * Uses PostgreSQL features like JSONB for metadata.
 */
export const CustomerSchema: SchemaDefinition = {
  $type: 'Customer',

  $index: [
    ['email'],
    ['createdAt'],
  ],

  // Primary key
  id: 'uuid!',

  // Customer info
  email: 'string!#',          // Unique email
  name: 'string!',
  company: 'string?',
  phone: 'string?',

  // Address (optional)
  address: 'string?',
  city: 'string?',
  state: 'string?',
  country: 'string?',
  postalCode: 'string?',

  // Status
  status: 'string = "active"',
  tier: 'string = "free"',    // 'free', 'pro', 'enterprise'

  // Metrics
  totalOrders: 'int = 0',
  totalSpent: 'decimal(10,2) = 0',
  lastOrderAt: 'timestamp?',

  // Flexible metadata (stored as JSONB in PostgreSQL)
  metadata: 'json?',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

/**
 * Product Schema
 *
 * Product catalog with pricing, inventory, and PostgreSQL arrays for tags.
 */
export const ProductSchema: SchemaDefinition = {
  $type: 'Product',

  $index: [
    ['sku'],
    ['category'],
  ],

  // Primary key
  id: 'uuid!',

  // Product details
  sku: 'string!#',            // Unique SKU
  name: 'string!',
  description: 'text?',
  category: 'string!',

  // Pricing
  price: 'decimal(10,2)!',
  costPrice: 'decimal(10,2)?',
  currency: 'string = "USD"',

  // Inventory
  quantityInStock: 'int = 0',
  reorderPoint: 'int = 10',

  // Status
  isActive: 'boolean = true',
  isFeatured: 'boolean = false',

  // Tags (PostgreSQL array type)
  tags: 'string[]',

  // Flexible attributes (JSONB for varying product attributes)
  attributes: 'json?',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

/**
 * Order Schema
 *
 * Order records linking customers and products.
 * Uses JSONB for flexible shipping/billing addresses.
 */
export const OrderSchema: SchemaDefinition = {
  $type: 'Order',

  $index: [
    ['customerId', 'createdAt'],
    ['status', 'createdAt'],
    ['orderNumber'],
  ],

  // Primary key
  id: 'uuid!',
  orderNumber: 'string!#',    // Human-readable order number

  // Customer reference
  customerId: 'uuid!',

  // Order details
  status: 'string = "pending"',  // 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
  orderDate: 'date!',

  // Monetary values
  subtotal: 'decimal(10,2)!',
  taxAmount: 'decimal(10,2)!',
  shippingAmount: 'decimal(10,2) = 0',
  discountAmount: 'decimal(10,2) = 0',
  totalAmount: 'decimal(10,2)!',
  currency: 'string = "USD"',

  // Addresses (JSONB for flexible structure)
  shippingAddress: 'json?',
  billingAddress: 'json?',

  // Tracking
  trackingNumber: 'string?',
  shippedAt: 'timestamp?',
  deliveredAt: 'timestamp?',

  // Notes
  customerNotes: 'text?',
  internalNotes: 'text?',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

/**
 * Order Item Schema
 *
 * Line items for orders, demonstrating normalized relational design.
 */
export const OrderItemSchema: SchemaDefinition = {
  $type: 'OrderItem',

  $index: [
    ['orderId'],
    ['productId'],
  ],

  // Primary key
  id: 'uuid!',

  // Relations
  orderId: 'uuid!',
  productId: 'uuid!',

  // Item details
  sku: 'string!',
  name: 'string!',
  quantity: 'int!',

  // Pricing (captured at time of order)
  unitPrice: 'decimal(10,2)!',
  totalPrice: 'decimal(10,2)!',

  // Optional discount
  discountPercent: 'decimal(5,2) = 0',

  // Timestamps
  createdAt: 'timestamp!',
};

// Export all schemas
export const schemas = {
  Customer: CustomerSchema,
  Product: ProductSchema,
  Order: OrderSchema,
  OrderItem: OrderItemSchema,
};

// =============================================================================
// Main - Generate DDL when run directly
// =============================================================================

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
`);
}

main();
