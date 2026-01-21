/**
 * ice project generate command
 *
 * Generates denormalized OLAP schemas from projection definitions.
 * Reads schemas with $projection: 'olap' and outputs Iceberg/Parquet schema files.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { IceTypeSchema } from '@icetype/core';
import { isProjection, type ProjectionType } from '@icetype/core';
import {
  generateProjectionSchema,
  type ProjectionDefinition,
  type IcebergSchema,
  type ParquetSchema,
  createParquetSchemaGenerator,
} from '@icetype/iceberg';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import {
  requireOption,
  validateOptionValue,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

// =============================================================================
// Types
// =============================================================================

/** Output format for projection generation */
type OutputFormat = 'iceberg' | 'parquet';

/** Valid output formats */
const VALID_FORMATS: readonly OutputFormat[] = ['iceberg', 'parquet'] as const;

/** Extended schema directives with projection fields */
interface SchemaDirectivesWithProjection {
  projection?: ProjectionType;
  from?: string;
  expand?: string[];
  flatten?: Record<string, string>;
  partitionBy?: string[];
  index?: Array<{ fields: string[]; unique?: boolean; name?: string }>;
  fts?: string[];
  vector?: Array<{ field: string; dimensions: number; metric?: 'cosine' | 'euclidean' | 'dot' }>;
}

// =============================================================================
// Help Definition
// =============================================================================

const PROJECT_GENERATE_HELP: HelpCommand = {
  name: 'project generate',
  description: 'Generate OLAP schemas from projection definitions',
  usage: 'ice project generate --schema <file> [--output <file>] [--format iceberg|parquet] [--projection <name>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path', defaultValue: 'projection.json' },
    { name: 'format', short: 'f', description: 'Output format: iceberg or parquet', defaultValue: 'iceberg' },
    { name: 'projection', short: 'p', description: 'Specific projection name to generate (optional, default: all)' },
  ],
  examples: [
    'ice project generate --schema ./schema.ts --output ./olap-schema.json',
    'ice project generate -s ./schema.ts -f parquet -o ./schema.parquet.txt',
    'ice project generate --schema ./schema.ts --projection OrdersFlat',
  ],
};

const PROJECT_HELP: HelpCommand = {
  name: 'project',
  description: 'OLAP projection schema operations',
  usage: 'ice project <subcommand> [options]',
  options: [],
  subcommands: [{ name: 'generate', description: 'Generate OLAP schemas from projection definitions' }],
  examples: [
    'ice project generate --schema ./schema.ts --output ./olap-schema.json',
    'ice project generate -s ./schema.ts -f parquet',
  ],
};

// =============================================================================
// Projection Extraction
// =============================================================================

/**
 * Extract projection definition from an IceType schema.
 *
 * @param schema - The IceType schema
 * @returns ProjectionDefinition if it's a projection schema, null otherwise
 */
function extractProjectionDefinition(schema: IceTypeSchema): ProjectionDefinition | null {
  if (!isProjection(schema)) {
    return null;
  }

  const directives = schema.directives as SchemaDirectivesWithProjection;

  // Must have a source entity
  if (!directives.from) {
    return null;
  }

  return {
    $type: schema.name,
    $projection: directives.projection!,
    $from: directives.from,
    $expand: directives.expand,
    $flatten: directives.flatten,
  };
}

/**
 * Find all projection schemas from loaded schemas.
 *
 * @param schemas - Array of loaded schemas
 * @returns Array of tuples [schema, projectionDefinition]
 */
function findProjectionSchemas(
  schemas: Array<{ name: string; schema: IceTypeSchema }>
): Array<{ name: string; schema: IceTypeSchema; projection: ProjectionDefinition }> {
  const results: Array<{ name: string; schema: IceTypeSchema; projection: ProjectionDefinition }> = [];

  for (const { name, schema } of schemas) {
    const projection = extractProjectionDefinition(schema);
    if (projection) {
      results.push({ name, schema, projection });
    }
  }

  return results;
}

// =============================================================================
// Schema Generation
// =============================================================================

/**
 * Generate Iceberg schema output.
 */
function generateIcebergOutput(
  projectionDef: ProjectionDefinition,
  allSchemas: Map<string, IceTypeSchema>
): IcebergSchema {
  return generateProjectionSchema(projectionDef, allSchemas);
}

/**
 * Generate Parquet schema output.
 */
function generateParquetOutput(
  projectionDef: ProjectionDefinition,
  allSchemas: Map<string, IceTypeSchema>
): ParquetSchema {
  // First generate the Iceberg schema to get the denormalized fields
  const icebergSchema = generateProjectionSchema(projectionDef, allSchemas);

  // Convert Iceberg fields to a synthetic IceTypeSchema for Parquet generation
  const parquetGenerator = createParquetSchemaGenerator();

  // Create a synthetic schema from the Iceberg fields
  const syntheticSchema = createSyntheticSchema(projectionDef.$type, icebergSchema);

  return parquetGenerator.generateSchema(syntheticSchema);
}

/**
 * Create a synthetic IceTypeSchema from Iceberg schema fields.
 * This allows us to use the standard Parquet generator.
 */
function createSyntheticSchema(name: string, icebergSchema: IcebergSchema): IceTypeSchema {
  const fields = new Map<string, import('@icetype/core').FieldDefinition>();

  for (const field of icebergSchema.fields) {
    // Skip system fields as they'll be added by the Parquet generator
    if (field.name.startsWith('$')) continue;

    fields.set(field.name, {
      name: field.name,
      type: mapIcebergTypeToIceType(field.type),
      modifier: field.required ? '!' : '?',
      isArray: field.type.type === 'list',
      isOptional: !field.required,
      isUnique: false,
      isIndexed: false,
    });
  }

  return {
    name,
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Map Iceberg type to IceType primitive.
 */
function mapIcebergTypeToIceType(icebergType: import('@icetype/iceberg').IcebergType): string {
  switch (icebergType.type) {
    case 'string':
      return 'string';
    case 'int':
      return 'int';
    case 'long':
      return 'long';
    case 'float':
      return 'float';
    case 'double':
      return 'double';
    case 'boolean':
      return 'bool';
    case 'uuid':
      return 'uuid';
    case 'timestamp':
      return 'timestamp';
    case 'timestamptz':
      return 'timestamptz';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'binary':
      return 'binary';
    case 'decimal':
      return 'decimal';
    case 'list':
      return icebergType.elementType ? mapIcebergTypeToIceType(icebergType.elementType) : 'string';
    default:
      return 'string';
  }
}

// =============================================================================
// Command Implementation
// =============================================================================

/**
 * ice project generate command handler.
 */
export async function projectGenerate(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(PROJECT_GENERATE_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
      projection: { type: 'string', short: 'p' },
    },
  });

  // Validate required options
  requireOption(
    values.schema,
    'schema',
    'project generate',
    'ice project generate --schema ./schema.ts --output ./olap-schema.json'
  );

  const schemaPath = values.schema;
  const outputPath = typeof values.output === 'string' ? values.output : 'projection.json';
  const formatValue = typeof values.format === 'string' ? values.format : 'iceberg';
  const projectionName = typeof values.projection === 'string' ? values.projection : undefined;

  // Validate format option
  validateOptionValue(formatValue, 'format', VALID_FORMATS);
  const format = formatValue as OutputFormat;

  console.log(`Generating OLAP schema from: ${schemaPath}`);
  console.log(`Output format: ${format}`);

  // Load schemas from the file
  const loadResult = await loadSchemaFile(schemaPath);
  checkSchemaLoadErrors(loadResult.errors, schemaPath);
  checkSchemasExist(loadResult.schemas, schemaPath);

  console.log(`Found ${loadResult.schemas.length} schema(s)`);

  // Build schema map for projection resolution
  const schemaMap = new Map<string, IceTypeSchema>();
  for (const { name, schema } of loadResult.schemas) {
    schemaMap.set(name, schema);
    // Also add by schema name (they might differ from export name)
    schemaMap.set(schema.name, schema);
  }

  // Find projection schemas
  const projectionSchemas = findProjectionSchemas(loadResult.schemas);

  if (projectionSchemas.length === 0) {
    console.log('No projection schemas found (schemas with $projection directive)');
    console.log('Hint: Add $projection: "olap" and $from: "SourceEntity" to create a projection');
    return;
  }

  console.log(`Found ${projectionSchemas.length} projection schema(s)`);

  // Filter by projection name if specified
  let targetProjections = projectionSchemas;
  if (projectionName) {
    targetProjections = projectionSchemas.filter(
      (p) => p.name === projectionName || p.schema.name === projectionName
    );

    if (targetProjections.length === 0) {
      throw new Error(
        `Projection '${projectionName}' not found. Available projections: ${projectionSchemas
          .map((p) => p.schema.name)
          .join(', ')}`
      );
    }
  }

  // Generate output for each projection
  const results: Record<string, unknown> = {};

  for (const { schema, projection } of targetProjections) {
    console.log(`Generating ${format} schema for: ${schema.name}`);
    console.log(`  Source: ${projection.$from}`);
    if (projection.$expand?.length) {
      console.log(`  Expanding: ${projection.$expand.join(', ')}`);
    }

    try {
      if (format === 'iceberg') {
        const icebergSchema = generateIcebergOutput(projection, schemaMap);
        results[schema.name] = icebergSchema;
        console.log(`  Generated ${icebergSchema.fields.length} fields`);
      } else {
        const parquetSchema = generateParquetOutput(projection, schemaMap);
        results[schema.name] = parquetSchema;
        console.log(`  Generated ${parquetSchema.fields.length} fields`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate ${format} schema for '${schema.name}': ${message}`);
    }
  }

  // Write output
  let outputContent: string;
  if (format === 'iceberg') {
    // JSON output for Iceberg
    outputContent = JSON.stringify(
      targetProjections.length === 1 ? Object.values(results)[0] : results,
      null,
      2
    );
  } else {
    // Parquet schema string output
    const parquetGenerator = createParquetSchemaGenerator();
    const schemaStrings = Object.entries(results).map(([name, schema]) => {
      return `// ${name}\n${parquetGenerator.toSchemaString(schema as ParquetSchema)}`;
    });
    outputContent = schemaStrings.join('\n\n');
  }

  try {
    writeFileSync(outputPath, outputContent);
  } catch (writeError) {
    const message = writeError instanceof Error ? writeError.message : String(writeError);
    throw new Error(
      `Failed to write output file '${outputPath}': ${message}\n` +
        'Check that the directory exists and you have write permissions.'
    );
  }

  console.log(`Wrote ${format} schema to: ${outputPath}`);
  console.log(`Generated ${Object.keys(results).length} projection(s)`);
}

/**
 * Main entry point for ice project command.
 * Routes to subcommands.
 */
export async function project(args: string[]): Promise<void> {
  // Check for help on the parent command
  if (hasHelpFlag(args) && args[0] !== 'generate') {
    console.log(generateHelpText(PROJECT_HELP));
    process.exit(0);
  }

  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'generate':
      await projectGenerate(subArgs);
      break;

    default:
      if (subcommand) {
        console.error(`Unknown project subcommand: ${subcommand}`);
      }
      console.log('Available: ice project generate');
      console.log('Use: ice project --help for more information');
      process.exit(1);
  }
}
