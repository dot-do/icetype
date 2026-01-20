/**
 * Iceberg Export Schema Example
 *
 * This file defines schemas optimized for Apache Iceberg table generation.
 * Key considerations for Iceberg:
 *
 * 1. Partitioning - Use $partitionBy for efficient data organization
 * 2. Sort Order - Iceberg supports sorted tables for better query performance
 * 3. Schema Evolution - Iceberg tracks schema changes with version IDs
 */

import type { SchemaDefinition } from '@icetype/core';

/**
 * Analytics Event Schema
 *
 * Optimized for time-series analytics with daily partitioning.
 * This schema demonstrates best practices for Iceberg table design:
 * - Partition by date (day granularity) for time-based queries
 * - Include tenant ID for multi-tenant isolation
 * - Use appropriate types that map well to Iceberg/Parquet
 */
export const EventSchema: SchemaDefinition = {
  $type: 'Event',

  // Partition by tenant and event date for efficient queries
  // Iceberg will create partition directories like:
  // /tenantId=acme/eventDate=2024-01-15/
  $partitionBy: ['tenantId', 'eventDate'],

  // Indexes help with query optimization metadata
  $index: [
    ['tenantId', 'eventType', 'eventDate'],
    ['userId', 'eventDate'],
  ],

  // Event identification
  id: 'uuid!',
  eventType: 'string!',       // e.g., 'page_view', 'click', 'purchase'
  eventName: 'string!',       // Human-readable event name

  // Tenant and user context
  tenantId: 'string!',        // Multi-tenant partition key
  userId: 'string?',          // Optional user identifier
  sessionId: 'string?',       // Optional session tracking

  // Timestamps
  eventDate: 'date!',         // Partition key (day granularity)
  timestamp: 'timestamptz!',  // Exact event time with timezone

  // Event data
  properties: 'json?',        // Flexible event properties
  metadata: 'json?',          // System metadata

  // Numeric metrics
  value: 'double?',           // Optional numeric value
  duration: 'long?',          // Duration in milliseconds

  // Source tracking
  source: 'string?',          // Traffic source
  medium: 'string?',          // Marketing medium
  campaign: 'string?',        // Campaign identifier

  // Device and location
  deviceType: 'string?',      // 'mobile', 'desktop', 'tablet'
  country: 'string?',         // ISO country code
  region: 'string?',          // State/province
};

/**
 * Order Schema
 *
 * E-commerce order data with customer-based partitioning.
 * Demonstrates decimal types for monetary values.
 */
export const OrderSchema: SchemaDefinition = {
  $type: 'Order',

  // Partition by customer for efficient customer-specific queries
  $partitionBy: ['customerId'],

  $index: [
    ['customerId', 'orderDate'],
    ['status', 'orderDate'],
  ],

  id: 'uuid!',
  orderNumber: 'string!#',    // Unique, indexed order number

  // Customer info
  customerId: 'string!',
  customerEmail: 'string!',

  // Order details
  orderDate: 'date!',
  status: 'string!',          // 'pending', 'confirmed', 'shipped', 'delivered'

  // Monetary values (using decimal for precision)
  subtotal: 'decimal(10,2)!',
  tax: 'decimal(10,2)!',
  shipping: 'decimal(10,2)!',
  total: 'decimal(10,2)!',
  currency: 'string = "USD"',

  // Shipping address (as JSON for flexibility)
  shippingAddress: 'json!',

  // Line items stored as JSON array
  items: 'json!',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
  shippedAt: 'timestamp?',
  deliveredAt: 'timestamp?',
};

/**
 * Inventory Schema
 *
 * Product inventory with warehouse-based partitioning.
 */
export const InventorySchema: SchemaDefinition = {
  $type: 'Inventory',

  // Partition by warehouse for location-specific queries
  $partitionBy: ['warehouseId'],

  $index: [
    ['productId', 'warehouseId'],
    ['sku'],
  ],

  id: 'uuid!',
  sku: 'string!#',            // Stock keeping unit
  productId: 'string!',
  productName: 'string!',

  // Location
  warehouseId: 'string!',
  locationCode: 'string?',    // Bin/shelf location

  // Quantity tracking
  quantityOnHand: 'int!',
  quantityReserved: 'int = 0',
  quantityAvailable: 'int!',
  reorderPoint: 'int = 10',
  reorderQuantity: 'int = 100',

  // Cost tracking
  unitCost: 'decimal(10,2)?',
  totalValue: 'decimal(12,2)?',

  // Status
  status: 'string = "active"',
  lastCountedAt: 'timestamp?',
  lastReceivedAt: 'timestamp?',
};

export const schemas = {
  Event: EventSchema,
  Order: OrderSchema,
  Inventory: InventorySchema,
};
