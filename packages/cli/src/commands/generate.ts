/**
 * ice generate command
 *
 * Generates TypeScript types from IceType schemas.
 * Supports watch mode for automatic regeneration on file changes.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { watchGenerate } from '../utils/watcher.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import {
  requireOption,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

const GENERATE_HELP: HelpCommand = {
  name: 'generate',
  description: 'Generate TypeScript types from IceType schema',
  usage: 'ice generate --schema <file> [--output <file>] [--watch]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path (default: <schema>.generated.ts)' },
    { name: 'watch', short: 'w', description: 'Watch mode for automatic regeneration' },
    { name: 'quiet', short: 'q', description: 'Suppress non-error output' },
    { name: 'verbose', short: 'v', description: 'Enable verbose logging' },
  ],
  examples: [
    'ice generate --schema ./schema.ts --output ./types.ts',
    'ice generate -s ./schema.ts -o ./types.ts --watch',
  ],
};

/**
 * Options for the generate command.
 */
export interface GenerateOptions {
  /** Path to the schema file. */
  schema: string;
  /** Path to the output file. */
  output?: string;
  /** Enable watch mode for automatic regeneration. */
  watch?: boolean;
  /** Suppress non-error output. */
  quiet?: boolean;
  /** Enable verbose logging. */
  verbose?: boolean;
}

/**
 * Run the generation process once.
 *
 * @param options - Generation options
 * @throws Error if generation fails
 */
export async function runGeneration(options: GenerateOptions): Promise<void> {
  const { schema: schemaPath, output, quiet = false, verbose = false } = options;

  const logger = createLogger({
    quiet,
    level: verbose ? LogLevel.DEBUG : LogLevel.INFO,
  });

  const outputPath = output ?? schemaPath.replace(/\.(ts|js|mjs|json)$/, '.generated.ts');

  logger.debug('Starting generation', { schemaPath, outputPath });

  // Load schemas from the file
  logger.debug('Loading schema file', { path: schemaPath });
  const loadResult = await loadSchemaFile(schemaPath);

  // Check for loading errors - throws if any
  checkSchemaLoadErrors(loadResult.errors, schemaPath);

  // Check that schemas exist - throws if none
  checkSchemasExist(loadResult.schemas, schemaPath);

  logger.debug(`Found ${loadResult.schemas.length} schema(s)`);

  // Generate types for all schemas
  const types = generateTypesFromSchemas(loadResult.schemas.map(s => s.schema));

  try {
    writeFileSync(outputPath, types);
    logger.success(`Generated types: ${outputPath}`);
  } catch (writeError) {
    const message = writeError instanceof Error ? writeError.message : String(writeError);
    throw new Error(`Failed to write output file '${outputPath}': ${message}`);
  }
}

export async function generate(args: string[]) {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(GENERATE_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      watch: { type: 'boolean', short: 'w' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Validate required options - throws if missing
  requireOption(
    values.schema,
    'schema',
    'generate',
    'ice generate --schema ./schema.ts --output ./types.ts [--watch]'
  );

  // values.schema is guaranteed to be string after the check above
  const schemaPath = values.schema;
  const outputPath = typeof values.output === 'string' ? values.output : schemaPath.replace(/\.(ts|js|mjs|json)$/, '.generated.ts');

  const options: GenerateOptions = {
    schema: schemaPath,
    output: outputPath,
    watch: values.watch ?? false,
    quiet: values.quiet ?? false,
    verbose: values.verbose ?? false,
  };

  const logger = createLogger({
    quiet: options.quiet,
    level: options.verbose ? LogLevel.DEBUG : LogLevel.INFO,
  });

  if (options.watch) {
    // Watch mode - run initial generation and watch for changes
    logger.info('Starting watch mode...');
    await watchGenerate({
      schemaPath,
      runGeneration: async () => {
        await runGeneration(options);
      },
      quiet: options.quiet,
      verbose: options.verbose,
    });
  } else {
    // Single generation - let errors propagate to main CLI handler
    logger.info(`Generating types from: ${schemaPath}`);
    await runGeneration(options);
  }
}

/**
 * Generate TypeScript types from multiple schemas
 */
function generateTypesFromSchemas(schemas: IceTypeSchema[]): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * IceType Generated Types`);
  lines.push(` *`);
  lines.push(` * This file was generated by 'ice generate'.`);
  lines.push(` * Do not edit manually - changes will be overwritten.`);
  lines.push(` *`);
  lines.push(` * @generated`);
  lines.push(` */`);
  lines.push(``);

  for (const schema of schemas) {
    lines.push(generateTypeScriptInterface(schema));
    lines.push(``);
  }

  return lines.join('\n');
}

/**
 * Generate TypeScript interface from IceType schema
 */
export function generateTypeScriptInterface(schema: IceTypeSchema): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Generated from IceType schema: ${schema.name}`);
  lines.push(` * @generated`);
  lines.push(` */`);
  lines.push(``);

  // Generate the interface
  lines.push(`export interface ${schema.name} {`);

  // System fields
  lines.push(`  /** Unique document identifier */`);
  lines.push(`  $id: string;`);
  lines.push(`  /** Document type */`);
  lines.push(`  $type: '${schema.name}';`);
  lines.push(`  /** Document version */`);
  lines.push(`  $version: number;`);
  lines.push(`  /** Creation timestamp (epoch ms) */`);
  lines.push(`  $createdAt: number;`);
  lines.push(`  /** Last update timestamp (epoch ms) */`);
  lines.push(`  $updatedAt: number;`);

  // User fields
  for (const [fieldName, field] of schema.fields) {
    if (fieldName.startsWith('$')) continue;

    const tsType = fieldToTypeScript(field);
    const optional = field.isOptional ? '?' : '';
    lines.push(`  ${fieldName}${optional}: ${tsType};`);
  }

  lines.push(`}`);

  // Generate input type (without system fields)
  lines.push(``);
  lines.push(`/** Input type for creating ${schema.name} */`);
  lines.push(`export interface ${schema.name}Input {`);

  for (const [fieldName, field] of schema.fields) {
    if (fieldName.startsWith('$')) continue;

    const tsType = fieldToTypeScript(field);
    const optional = field.isOptional || field.defaultValue !== undefined ? '?' : '';
    lines.push(`  ${fieldName}${optional}: ${tsType};`);
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Convert IceType field to TypeScript type
 */
function fieldToTypeScript(field: FieldDefinition): string {
  if (field.relation) {
    // Relations become string IDs or arrays of string IDs
    if (field.isArray) {
      return 'string[]';
    }
    return 'string';
  }

  let baseType: string;

  switch (field.type.toLowerCase()) {
    case 'string':
    case 'text':
    case 'uuid':
      baseType = 'string';
      break;
    case 'int':
    case 'long':
    case 'bigint':
    case 'float':
    case 'double':
    case 'decimal':
      baseType = 'number';
      break;
    case 'bool':
    case 'boolean':
      baseType = 'boolean';
      break;
    case 'timestamp':
    case 'timestamptz':
    case 'date':
    case 'time':
      baseType = 'number'; // Epoch ms
      break;
    case 'json':
      baseType = 'unknown';
      break;
    case 'binary':
      baseType = 'Uint8Array';
      break;
    default:
      baseType = 'unknown';
  }

  if (field.isArray) {
    return `${baseType}[]`;
  }

  return baseType;
}

