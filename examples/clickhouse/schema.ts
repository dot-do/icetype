/**
 * ClickHouse Schema Example
 *
 * This file defines schemas optimized for ClickHouse OLAP database.
 * ClickHouse is designed for real-time analytics on large datasets.
 *
 * Key ClickHouse concepts:
 * - MergeTree engine family for efficient storage and queries
 * - Partitioning for data management (usually by date)
 * - ORDER BY for sorting and primary key organization
 * - Materialized views for pre-aggregation
 */

import type { SchemaDefinition } from '@icetype/core';

/**
 * Pageview Analytics Schema
 *
 * High-volume web analytics data optimized for ClickHouse.
 * Uses ReplacingMergeTree for deduplication.
 */
export const PageviewSchema: SchemaDefinition = {
  $type: 'Pageview',

  // Partition by month for efficient data management
  $partitionBy: ['timestamp'],

  // Indexes help with query optimization
  $index: [
    ['siteId', 'timestamp'],
    ['userId', 'timestamp'],
  ],

  // Event identification
  id: 'uuid!',
  siteId: 'string!',          // Website identifier
  pageUrl: 'string!',         // Page URL
  pageTitle: 'string?',       // Page title

  // User tracking
  userId: 'string?',          // Logged-in user ID
  sessionId: 'string!',       // Session identifier
  visitorId: 'string!',       // Anonymous visitor ID

  // Time
  timestamp: 'timestamp!',    // Event time (will be DateTime64)

  // Request details
  referrer: 'string?',        // Referrer URL
  userAgent: 'string?',       // Browser user agent

  // Geo data
  country: 'string?',         // ISO country code
  region: 'string?',          // State/province
  city: 'string?',            // City name

  // Device info
  deviceType: 'string?',      // 'desktop', 'mobile', 'tablet'
  browser: 'string?',         // Browser name
  os: 'string?',              // Operating system

  // Performance metrics
  loadTime: 'int?',           // Page load time in ms
  ttfb: 'int?',               // Time to first byte in ms
};

/**
 * Metrics Schema
 *
 * Time-series metrics data with SummingMergeTree semantics.
 * Designed for real-time metric aggregation.
 */
export const MetricSchema: SchemaDefinition = {
  $type: 'Metric',

  // Partition by date for retention management
  $partitionBy: ['date'],

  $index: [
    ['service', 'metric', 'date'],
  ],

  // Metric identification
  service: 'string!',         // Service name
  metric: 'string!',          // Metric name (e.g., 'http_requests')
  date: 'date!',              // Date for partitioning

  // Dimensions (for grouping)
  environment: 'string!',     // 'prod', 'staging', 'dev'
  host: 'string!',            // Hostname
  endpoint: 'string?',        // API endpoint

  // Aggregatable values
  count: 'long!',             // Request count
  sumDuration: 'long!',       // Sum of durations (for avg calculation)
  sumBytes: 'long!',          // Sum of response bytes
  errorCount: 'long = 0',     // Error count

  // Min/max for range queries
  minDuration: 'long?',       // Minimum duration
  maxDuration: 'long?',       // Maximum duration
};

/**
 * User Events Schema
 *
 * User behavior events with ReplacingMergeTree for deduplication.
 */
export const UserEventSchema: SchemaDefinition = {
  $type: 'UserEvent',

  // Partition by month
  $partitionBy: ['eventTime'],

  $index: [
    ['tenantId', 'userId', 'eventTime'],
    ['eventType', 'eventTime'],
  ],

  // Event identification
  eventId: 'uuid!',
  tenantId: 'string!',
  userId: 'string!',

  // Event details
  eventType: 'string!',       // 'signup', 'login', 'purchase', etc.
  eventName: 'string!',       // Human-readable name
  eventTime: 'timestamp!',    // Event timestamp

  // Event properties (stored as JSON string)
  properties: 'json?',

  // Revenue tracking
  revenue: 'decimal(10,2)?',
  currency: 'string?',

  // Version for ReplacingMergeTree deduplication
  version: 'long = 0',
};

// Export all schemas
export const schemas = {
  Pageview: PageviewSchema,
  Metric: MetricSchema,
  UserEvent: UserEventSchema,
};
