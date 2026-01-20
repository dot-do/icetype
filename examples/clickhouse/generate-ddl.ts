/**
 * ClickHouse DDL Generation Example
 *
 * Demonstrates how to generate ClickHouse CREATE TABLE statements
 * from IceType schemas using the ClickHouse adapter.
 *
 * Run with: npx tsx generate-ddl.ts
 */

import { parseSchema } from '@icetype/core';
import { ClickHouseAdapter } from '@icetype/clickhouse';
import { schemas } from './schema.js';

/**
 * Main function - generate ClickHouse DDL for all schemas
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType to ClickHouse DDL Generation');
  console.log('='.repeat(60));

  const adapter = new ClickHouseAdapter();

  // Configuration for different table types
  const tableConfigs: Record<string, {
    engine: 'MergeTree' | 'ReplacingMergeTree' | 'SummingMergeTree';
    orderBy: string[];
    partitionBy?: string;
    versionColumn?: string;
    sumColumns?: string[];
  }> = {
    Pageview: {
      engine: 'ReplacingMergeTree',
      orderBy: ['site_id', 'visitor_id', 'timestamp', 'id'],
      partitionBy: 'toYYYYMM(timestamp)',
    },
    Metric: {
      engine: 'SummingMergeTree',
      orderBy: ['service', 'metric', 'environment', 'host', 'date'],
      partitionBy: 'toYYYYMM(date)',
      sumColumns: ['count', 'sum_duration', 'sum_bytes', 'error_count'],
    },
    UserEvent: {
      engine: 'ReplacingMergeTree',
      orderBy: ['tenant_id', 'user_id', 'event_time', 'event_id'],
      partitionBy: 'toYYYYMM(event_time)',
      versionColumn: 'version',
    },
  };

  for (const [name, definition] of Object.entries(schemas)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`-- ${name} Table`);
    console.log('='.repeat(60) + '\n');

    // Parse the IceType schema
    const schema = parseSchema(definition);
    const config = tableConfigs[name];

    if (!config) {
      console.log(`No config for ${name}, skipping...`);
      continue;
    }

    // Transform to ClickHouse DDL structure
    const ddl = adapter.transform(schema, {
      database: 'analytics',
      engine: config.engine,
      orderBy: config.orderBy,
      partitionBy: config.partitionBy,
      versionColumn: config.versionColumn,
      sumColumns: config.sumColumns,
      ifNotExists: true,
    });

    // Serialize to SQL
    const sql = adapter.serialize(ddl);

    console.log(sql);
    console.log('');

    // Print configuration summary
    console.log('-- Configuration:');
    console.log(`--   Engine: ${config.engine}`);
    console.log(`--   ORDER BY: (${config.orderBy.join(', ')})`);
    if (config.partitionBy) {
      console.log(`--   PARTITION BY: ${config.partitionBy}`);
    }
    if (config.versionColumn) {
      console.log(`--   Version column: ${config.versionColumn}`);
    }
    if (config.sumColumns) {
      console.log(`--   Sum columns: ${config.sumColumns.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DDL generation complete!');
  console.log('='.repeat(60));

  // Print usage examples
  console.log(`
ClickHouse Usage Examples:

-- Create the database
CREATE DATABASE IF NOT EXISTS analytics;

-- Insert pageview data
INSERT INTO analytics.pageview (
    id, site_id, page_url, session_id, visitor_id, timestamp
) VALUES (
    generateUUIDv4(),
    'site_123',
    'https://example.com/page',
    'session_abc',
    'visitor_xyz',
    now()
);

-- Query pageviews by site
SELECT
    site_id,
    count() as pageviews,
    uniq(visitor_id) as unique_visitors
FROM analytics.pageview
WHERE timestamp >= today() - 7
GROUP BY site_id
ORDER BY pageviews DESC;

-- Query metrics with rollup
SELECT
    service,
    metric,
    sum(count) as total_count,
    sum(sum_duration) / sum(count) as avg_duration
FROM analytics.metric
WHERE date >= today() - 30
GROUP BY service, metric
ORDER BY total_count DESC;

-- Retention with TTL (add to table)
ALTER TABLE analytics.pageview
MODIFY TTL timestamp + INTERVAL 90 DAY;
`);
}

main();
