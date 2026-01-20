/**
 * Apache Iceberg Schema Example
 *
 * This file defines schemas optimized for Apache Iceberg table generation.
 * Iceberg is a high-performance table format for huge analytic datasets.
 *
 * Key considerations for Iceberg:
 * - Partitioning: Use $partitionBy for efficient data organization
 * - Type mapping: IceType types map to Iceberg/Parquet types
 * - Schema evolution: Iceberg tracks schema changes with version IDs
 */

import type { SchemaDefinition } from '@icetype/core';

/**
 * Analytics Event Schema
 *
 * Time-series event data with date-based partitioning.
 * This is a common pattern for analytics workloads.
 */
export const EventSchema: SchemaDefinition = {
  $type: 'Event',

  // Partition by tenant and event date for efficient queries
  // Creates partition directories like: /tenantId=acme/eventDate=2024-01-15/
  $partitionBy: ['tenantId', 'eventDate'],

  // Secondary indexes for query optimization
  $index: [
    ['tenantId', 'eventType', 'eventDate'],
    ['userId', 'eventDate'],
  ],

  // Event identification
  id: 'uuid!',
  eventType: 'string!',       // e.g., 'page_view', 'click', 'purchase'
  eventName: 'string!',       // Human-readable event name

  // Multi-tenant context
  tenantId: 'string!',        // Partition key for tenant isolation
  userId: 'string?',          // Optional user identifier
  sessionId: 'string?',       // Optional session tracking

  // Time fields
  eventDate: 'date!',         // Partition key (day granularity)
  timestamp: 'timestamptz!',  // Exact event time with timezone

  // Flexible event data (stored as JSON in Parquet)
  properties: 'json?',        // Event-specific properties
  metadata: 'json?',          // System metadata

  // Numeric metrics
  value: 'double?',           // Optional numeric value
  duration: 'long?',          // Duration in milliseconds
};

/**
 * E-commerce Order Schema
 *
 * Order data with customer-based partitioning.
 * Uses decimal types for monetary precision.
 */
export const OrderSchema: SchemaDefinition = {
  $type: 'Order',

  // Partition by customer for efficient customer queries
  $partitionBy: ['customerId'],

  $index: [
    ['customerId', 'orderDate'],
    ['status', 'orderDate'],
  ],

  id: 'uuid!',
  orderNumber: 'string!#',    // Unique order number

  // Customer info
  customerId: 'string!',      // Partition key
  customerEmail: 'string!',

  // Order details
  orderDate: 'date!',
  status: 'string!',          // 'pending', 'shipped', 'delivered'

  // Monetary values with decimal precision
  subtotal: 'decimal(10,2)!',
  tax: 'decimal(10,2)!',
  shipping: 'decimal(10,2)!',
  total: 'decimal(10,2)!',
  currency: 'string = "USD"',

  // Complex data as JSON
  shippingAddress: 'json!',
  items: 'json!',             // Line items array

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

// Export all schemas
export const schemas = {
  Event: EventSchema,
  Order: OrderSchema,
};
