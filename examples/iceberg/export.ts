/**
 * Iceberg Export Example
 *
 * Demonstrates how to export IceType schemas to Apache Iceberg
 * table metadata and Parquet schema formats.
 *
 * Run with: npx tsx export.ts
 */

import { parseSchema } from '@icetype/core';
import {
  generateIcebergMetadata,
  generateParquetSchema,
} from '@icetype/iceberg';
import { schemas } from './schema.js';

// Configuration
const BASE_LOCATION = 's3://my-data-lake/warehouse';

/**
 * Main function - export schemas to Iceberg metadata
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType to Apache Iceberg Export');
  console.log('='.repeat(60));

  for (const [name, definition] of Object.entries(schemas)) {
    console.log(`\n--- Exporting ${name} Schema ---\n`);

    // Parse the IceType schema
    const schema = parseSchema(definition);
    const location = `${BASE_LOCATION}/${name.toLowerCase()}`;

    // Generate Iceberg table metadata
    const metadata = generateIcebergMetadata(schema, location, {
      // Iceberg table properties
      'write.format.default': 'parquet',
      'write.parquet.compression-codec': 'zstd',
    });

    // Generate Parquet schema
    const parquetSchema = generateParquetSchema(schema);

    // Print summary
    console.log(`Table: ${name}`);
    console.log(`Location: ${metadata.location}`);
    console.log(`Format Version: ${metadata.formatVersion}`);
    console.log(`Schema ID: ${metadata.currentSchemaId}`);

    // Print schema fields
    const icebergSchema = metadata.schemas[0];
    if (icebergSchema) {
      console.log(`\nIceberg Schema (${icebergSchema.fields.length} fields):`);
      for (const field of icebergSchema.fields) {
        const required = field.required ? '' : '?';
        const typeStr = typeof field.type === 'string'
          ? field.type
          : JSON.stringify(field.type);
        console.log(`  - ${field.name}${required}: ${typeStr}`);
      }
    }

    // Print partition spec
    const partitionSpec = metadata.partitionSpecs[0];
    if (partitionSpec && partitionSpec.fields.length > 0) {
      console.log('\nPartition Spec:');
      for (const field of partitionSpec.fields) {
        console.log(`  - ${field.name} (${field.transform})`);
      }
    }

    // Print Parquet schema summary
    console.log(`\nParquet Schema: ${parquetSchema.fields.length} columns`);

    // Print the metadata JSON (truncated for readability)
    console.log('\nMetadata JSON (sample):');
    console.log(JSON.stringify({
      formatVersion: metadata.formatVersion,
      tableUuid: metadata.tableUuid,
      location: metadata.location,
      currentSchemaId: metadata.currentSchemaId,
      defaultSpecId: metadata.defaultSpecId,
      properties: metadata.properties,
    }, null, 2));
  }

  console.log('\n' + '='.repeat(60));
  console.log('Export complete!');
  console.log('='.repeat(60));

  // Print usage examples
  console.log(`
Usage with Apache Spark:
\`\`\`sql
-- Create table from Iceberg metadata
CREATE TABLE my_catalog.events
USING iceberg
LOCATION '${BASE_LOCATION}/event'
\`\`\`

Usage with Trino:
\`\`\`sql
-- Query the Iceberg table
SELECT eventType, COUNT(*) as count
FROM iceberg.my_schema.events
WHERE eventDate >= DATE '2024-01-01'
GROUP BY eventType
ORDER BY count DESC
\`\`\`

Usage with DuckDB:
\`\`\`sql
-- Read Iceberg table with DuckDB
INSTALL iceberg;
LOAD iceberg;

SELECT * FROM iceberg_scan('${BASE_LOCATION}/event');
\`\`\`
`);
}

main();
