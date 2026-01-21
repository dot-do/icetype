/**
 * Iceberg Export Example
 *
 * This file demonstrates how to export IceType schemas to Apache Iceberg
 * table metadata format. The generated metadata can be used to:
 *
 * 1. Create Iceberg tables in data warehouses (Spark, Trino, etc.)
 * 2. Configure data lake storage (S3, GCS, Azure Blob)
 * 3. Set up CDC (Change Data Capture) pipelines
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { parseSchema, type SchemaDefinition } from '@icetype/core';
import {
  generateIcebergMetadata,
  generateParquetSchema,
  type IcebergTableMetadata,
} from '@icetype/iceberg';
import { EventSchema, OrderSchema, InventorySchema } from './schema.js';

// Configuration
const OUTPUT_DIR = './output';
const BASE_LOCATION = 's3://data-lake/warehouse';

/**
 * Export a single schema to Iceberg metadata
 */
function exportSchema(
  schemaDefinition: SchemaDefinition,
  tableName: string,
  location: string
): { metadata: IcebergTableMetadata; parquet: object } {
  console.log(`\nExporting ${tableName}...`);

  // Parse the IceType schema
  const schema = parseSchema(schemaDefinition);

  // Generate Iceberg table metadata
  const metadata = generateIcebergMetadata(schema, location, {
    // Iceberg table properties
    'write.format.default': 'parquet',
    'write.parquet.compression-codec': 'zstd',
    'write.metadata.compression-codec': 'gzip',
    'write.target-file-size-bytes': '134217728', // 128 MB
    'commit.manifest.target-size-bytes': '8388608', // 8 MB
    'commit.manifest-merge.enabled': 'true',
  });

  // Generate Parquet schema for reference
  const parquet = generateParquetSchema(schema);

  // Print summary
  console.log(`  Table UUID: ${metadata.tableUuid}`);
  console.log(`  Location: ${metadata.location}`);
  console.log(`  Format version: ${metadata.formatVersion}`);
  console.log(`  Schema ID: ${metadata.currentSchemaId}`);
  console.log(`  Fields: ${metadata.schemas[0]?.fields.length ?? 0}`);
  console.log(`  Partition fields: ${metadata.partitionSpecs[0]?.fields.length ?? 0}`);

  // Print partition spec details
  const partitionSpec = metadata.partitionSpecs[0];
  if (partitionSpec && partitionSpec.fields.length > 0) {
    console.log('  Partitions:');
    for (const field of partitionSpec.fields) {
      console.log(`    - ${field.name} (${field.transform})`);
    }
  }

  return { metadata, parquet };
}

/**
 * Main export runner
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType to Apache Iceberg Export');
  console.log('='.repeat(60));

  // Create output directory
  try {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }

  const exports = [
    {
      definition: EventSchema,
      name: 'events',
      location: `${BASE_LOCATION}/events`,
    },
    {
      definition: OrderSchema,
      name: 'orders',
      location: `${BASE_LOCATION}/orders`,
    },
    {
      definition: InventorySchema,
      name: 'inventory',
      location: `${BASE_LOCATION}/inventory`,
    },
  ];

  const results: Array<{
    name: string;
    metadata: IcebergTableMetadata;
    parquet: object;
  }> = [];

  for (const { definition, name, location } of exports) {
    const { metadata, parquet } = exportSchema(definition, name, location);
    results.push({ name, metadata, parquet });

    // Write individual metadata files
    const metadataPath = `${OUTPUT_DIR}/${name}-metadata.json`;
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`  Wrote: ${metadataPath}`);

    const parquetPath = `${OUTPUT_DIR}/${name}-parquet-schema.json`;
    writeFileSync(parquetPath, JSON.stringify(parquet, null, 2));
    console.log(`  Wrote: ${parquetPath}`);
  }

  // Write combined catalog file
  const catalog = {
    version: 1,
    timestamp: new Date().toISOString(),
    tables: results.map(r => ({
      name: r.name,
      location: r.metadata.location,
      uuid: r.metadata.tableUuid,
      schemaId: r.metadata.currentSchemaId,
    })),
  };

  const catalogPath = `${OUTPUT_DIR}/catalog.json`;
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('Export Summary');
  console.log('='.repeat(60));
  console.log(`Tables exported: ${results.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}/`);
  console.log(`Catalog file: ${catalogPath}`);
  console.log('='.repeat(60));

  // Print usage instructions
  console.log('\nUsage with Apache Spark:');
  console.log('```sql');
  console.log("-- Register the table using the metadata file");
  console.log("CALL system.register_table(");
  console.log("  'my_catalog.my_database.events',");
  console.log(`  '${BASE_LOCATION}/events/metadata/v1.metadata.json'`);
  console.log(");");
  console.log('```');

  console.log('\nUsage with Trino/Presto:');
  console.log('```sql');
  console.log("-- Create external table from metadata");
  console.log("CREATE TABLE events (");
  console.log("  -- Schema auto-discovered from metadata");
  console.log(") WITH (");
  console.log("  format = 'PARQUET',");
  console.log(`  location = '${BASE_LOCATION}/events'`);
  console.log(");");
  console.log('```');
}

main();
