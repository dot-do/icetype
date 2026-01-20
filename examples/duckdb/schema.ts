/**
 * DuckDB Schema Example
 *
 * This file defines schemas optimized for DuckDB, an in-process
 * analytical database. DuckDB is great for:
 *
 * - Local analytics and data processing
 * - Embedding in applications
 * - Reading Parquet, CSV, JSON files
 * - Integration with data science tools
 */

import type { SchemaDefinition } from '@icetype/core';

/**
 * Customer Schema
 *
 * Customer data with typical business fields.
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

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

/**
 * Product Schema
 *
 * Product catalog with pricing and inventory.
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

  // Metadata
  tags: 'string[]',
  attributes: 'json?',        // Flexible product attributes

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

/**
 * Order Schema
 *
 * Order records linking customers and products.
 */
export const OrderSchema: SchemaDefinition = {
  $type: 'Order',

  $index: [
    ['customerId', 'createdAt'],
    ['status', 'createdAt'],
  ],

  // Primary key
  id: 'uuid!',
  orderNumber: 'string!#',    // Human-readable order number

  // Customer reference
  customerId: 'string!',
  customer: '-> Customer',

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

  // Shipping info (as JSON for flexibility)
  shippingAddress: 'json?',
  billingAddress: 'json?',

  // Line items (as JSON array)
  items: 'json!',

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
 * Analytics Event Schema
 *
 * Lightweight event tracking for analytics.
 */
export const AnalyticsEventSchema: SchemaDefinition = {
  $type: 'AnalyticsEvent',

  $index: [
    ['eventType', 'createdAt'],
    ['userId', 'createdAt'],
  ],

  // Primary key
  id: 'uuid!',

  // Event identification
  eventType: 'string!',
  eventName: 'string!',

  // Context
  userId: 'string?',
  sessionId: 'string?',

  // Event data
  properties: 'json?',

  // Timestamp
  createdAt: 'timestamp!',
};

// Export all schemas
export const schemas = {
  Customer: CustomerSchema,
  Product: ProductSchema,
  Order: OrderSchema,
  AnalyticsEvent: AnalyticsEventSchema,
};
