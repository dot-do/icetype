/**
 * ice iceberg export command
 *
 * Exports IceType schema to Apache Iceberg metadata format.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { IcebergAdapter, IcebergTableMetadata } from '@icetype/iceberg';
import { getAdapter } from '../utils/adapter-registry.js';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import {
  requireOption,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

const ICEBERG_EXPORT_HELP: HelpCommand = {
  name: 'iceberg export',
  description: 'Export IceType schema to Apache Iceberg metadata format',
  usage: 'ice iceberg export --schema <file> [--output <file>] [--location <path>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path', defaultValue: 'metadata.json' },
    { name: 'location', short: 'l', description: 'Table storage location', defaultValue: 's3://bucket/table' },
  ],
  examples: [
    'ice iceberg export --schema ./schema.ts --output ./metadata.json',
    'ice iceberg export -s ./schema.ts --location s3://my-bucket/tables/users',
  ],
};

export async function icebergExport(args: string[]) {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(ICEBERG_EXPORT_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      location: { type: 'string', short: 'l' },
    },
  });

  // Validate required options - throws if missing
  requireOption(
    values.schema,
    'schema',
    'iceberg export',
    'ice iceberg export --schema ./schema.ts --output ./metadata.json --location s3://bucket/table'
  );

  // values.schema is guaranteed to be string after the check above
  const schemaPath = values.schema;
  const outputPath = typeof values.output === 'string' ? values.output : 'metadata.json';
  const location = typeof values.location === 'string' ? values.location : 's3://bucket/table';

  console.log(`Exporting Iceberg metadata from: ${schemaPath}`);

  // Load schemas from the file - throws on errors
  const loadResult = await loadSchemaFile(schemaPath);
  checkSchemaLoadErrors(loadResult.errors, schemaPath);
  checkSchemasExist(loadResult.schemas, schemaPath);

  console.log(`Found ${loadResult.schemas.length} schema(s)`);

  // Use the first schema for Iceberg export (checkSchemasExist ensures at least one exists)
  const firstSchema = loadResult.schemas[0]!;
  const { name, schema } = firstSchema;
  console.log(`Using schema: ${name}`);

  // Get the Iceberg adapter from the registry
  const adapter = getAdapter('iceberg') as IcebergAdapter | undefined;
  if (!adapter) {
    throw new Error('Iceberg adapter is not registered. Call initializeAdapterRegistry() first.');
  }

  // Transform the schema using the adapter
  const metadata = adapter.transform(schema, {
    location,
    properties: {
      'write.format.default': 'parquet',
      'write.parquet.compression-codec': 'snappy',
    },
  }) as IcebergTableMetadata;

  const json = adapter.serialize(metadata);

  try {
    writeFileSync(outputPath, json);
  } catch (writeError) {
    const message = writeError instanceof Error ? writeError.message : String(writeError);
    throw new Error(
      `Failed to write output file '${outputPath}': ${message}\n` +
      'Check that the directory exists and you have write permissions.'
    );
  }

  console.log(`Exported Iceberg metadata: ${outputPath}`);
  console.log(`Table location: ${location}`);
  console.log(`Schema: ${metadata.schemas[0]?.fields.length ?? 0} fields`);
  console.log(`Partition spec: ${metadata.partitionSpecs[0]?.fields.length ?? 0} partition fields`);
}
