/**
 * ice iceberg export command
 *
 * Exports IceType schema to Apache Iceberg metadata format.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { generateIcebergMetadata } from '@icetype/iceberg';
import { loadSchemaFile } from '../utils/schema-loader.js';

export async function icebergExport(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      location: { type: 'string', short: 'l' },
    },
  });

  if (!values.schema) {
    console.error('Error: --schema is required');
    console.log('Usage: ice iceberg export --schema ./schema.ts --output ./metadata.json --location s3://bucket/table');
    process.exit(1);
  }

  // values.schema is guaranteed to be string after the check above
  const schemaPath = values.schema;
  const outputPath = typeof values.output === 'string' ? values.output : 'metadata.json';
  const location = typeof values.location === 'string' ? values.location : 's3://bucket/table';

  console.log(`Exporting Iceberg metadata from: ${schemaPath}`);

  try {
    // Load schemas from the file
    const loadResult = await loadSchemaFile(schemaPath);

    // Check for loading errors
    if (loadResult.errors.length > 0) {
      for (const error of loadResult.errors) {
        console.error(error);
      }
      process.exit(1);
    }

    if (loadResult.schemas.length === 0) {
      console.error('No schemas found in the file');
      process.exit(1);
    }

    console.log(`Found ${loadResult.schemas.length} schema(s)`);

    // Use the first schema for Iceberg export
    const firstSchema = loadResult.schemas[0];
    if (!firstSchema) {
      console.error('No schemas found in the file');
      process.exit(1);
    }
    const { name, schema } = firstSchema;
    console.log(`Using schema: ${name}`);

    const metadata = generateIcebergMetadata(schema, location, {
      'write.format.default': 'parquet',
      'write.parquet.compression-codec': 'snappy',
    });

    const json = JSON.stringify(metadata, null, 2);

    try {
      writeFileSync(outputPath, json);
    } catch (writeError) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      console.error(`Error: Failed to write output file '${outputPath}': ${message}`);
      console.error('Check that the directory exists and you have write permissions.');
      process.exit(1);
    }

    console.log(`Exported Iceberg metadata: ${outputPath}`);
    console.log(`Table location: ${location}`);
    console.log(`Schema: ${metadata.schemas[0]?.fields.length ?? 0} fields`);
    console.log(`Partition spec: ${metadata.partitionSpecs[0]?.fields.length ?? 0} partition fields`);
  } catch (error) {
    console.error('Error exporting Iceberg metadata:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
