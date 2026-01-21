/**
 * ice drizzle import command
 *
 * Imports existing Drizzle ORM schemas and converts them to IceType schemas.
 * Supports all Drizzle dialects: PostgreSQL, MySQL, and SQLite.
 *
 * This command is useful for migrating from Drizzle to IceType, allowing you
 * to preserve your existing schema definitions.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { assertNever } from '@icetype/core';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';
import { parseDrizzleFile } from '@icetype/drizzle';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import { requireOption, validateOptionValue } from '../utils/cli-error.js';

const DRIZZLE_IMPORT_HELP: HelpCommand = {
  name: 'drizzle import',
  description: 'Import Drizzle ORM schemas and convert to IceType format',
  usage: 'ice drizzle import --input <file> [--output <file>] [--format <ts|json>]',
  options: [
    { name: 'input', short: 'i', description: 'Input Drizzle schema file (TypeScript)', required: true },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'format', short: 'f', description: 'Output format (ts, json)', defaultValue: 'ts' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice drizzle import --input ./drizzle-schema.ts',
    'ice drizzle import -i ./schema.ts --output ./icetype-schema.ts',
    'ice drizzle import -i ./schema.ts -o ./schema.json --format json',
    'ice drizzle import -i ./schema.ts --verbose',
  ],
};

/**
 * Valid output formats for the drizzle import command.
 */
export type DrizzleImportFormat = 'ts' | 'json';

/**
 * Options for the drizzle import command.
 */
export interface DrizzleImportCommandOptions {
  /** Input Drizzle schema file path */
  input: string;
  /** Output file path (optional, defaults to stdout) */
  output?: string;
  /** Output format */
  format: DrizzleImportFormat;
  /** Suppress informational output */
  quiet?: boolean;
  /** Show verbose output */
  verbose?: boolean;
}

/**
 * Convert a FieldDefinition to its IceType string representation.
 *
 * @param field - The field definition
 * @returns IceType field string (e.g., 'string!', 'int?', 'uuid#')
 */
export function fieldToIceTypeString(field: FieldDefinition): string {
  let base = field.type;

  // Handle array types
  if (field.isArray) {
    base += '[]';
  }

  // Handle type parameters (precision, scale, length)
  if (field.precision !== undefined || field.scale !== undefined) {
    const precision = field.precision ?? 0;
    const scale = field.scale ?? 0;
    // Skip if both are 0
    if (precision > 0 || scale > 0) {
      base = `decimal(${precision},${scale})`;
    }
  } else if (field.length !== undefined && field.length > 0) {
    base = `string(${field.length})`;
  }

  // Handle modifiers
  if (field.modifier === '!' || field.isUnique) {
    base += '!';
  } else if (field.modifier === '#' || (field.isIndexed && !field.isUnique)) {
    base += '#';
  } else if (field.modifier === '?' || field.isOptional) {
    base += '?';
  }

  return base;
}

/**
 * Generate TypeScript output for IceType schemas.
 *
 * @param schemas - Array of IceType schemas
 * @returns TypeScript code as a string
 */
export function generateTypeScriptOutput(schemas: IceTypeSchema[]): string {
  const lines: string[] = [];

  // Add import statement
  lines.push("import { parseSchema } from '@icetype/core';");
  lines.push('');

  // Generate each schema
  for (const schema of schemas) {
    lines.push(`export const ${schema.name}Schema = parseSchema({`);
    lines.push(`  $type: '${schema.name}',`);

    // Add directives if present
    if (schema.directives.partitionBy && schema.directives.partitionBy.length > 0) {
      lines.push(`  $partitionBy: ${JSON.stringify(schema.directives.partitionBy)},`);
    }
    if (schema.directives.index && schema.directives.index.length > 0) {
      const indexArrays = schema.directives.index.map((idx) => idx.fields);
      lines.push(`  $index: ${JSON.stringify(indexArrays)},`);
    }
    if (schema.directives.fts && schema.directives.fts.length > 0) {
      lines.push(`  $fts: ${JSON.stringify(schema.directives.fts)},`);
    }
    if (schema.directives.vector) {
      lines.push(`  $vector: '${schema.directives.vector}',`);
    }

    // Add fields
    lines.push('');
    for (const [fieldName, field] of schema.fields) {
      const iceTypeStr = fieldToIceTypeString(field);
      lines.push(`  ${fieldName}: '${iceTypeStr}',`);
    }

    lines.push('});');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate JSON output for IceType schemas.
 *
 * @param schemas - Array of IceType schemas
 * @returns JSON string
 */
export function generateJsonOutput(schemas: IceTypeSchema[]): string {
  // Convert Map fields to plain objects for JSON serialization
  const serializableSchemas = schemas.map((schema) => ({
    $type: schema.name,
    ...Object.fromEntries(
      Array.from(schema.fields.entries()).map(([name, field]) => [
        name,
        fieldToIceTypeString(field),
      ])
    ),
    ...(schema.directives.partitionBy && { $partitionBy: schema.directives.partitionBy }),
    ...(schema.directives.index && {
      $index: schema.directives.index.map((idx) => idx.fields),
    }),
    ...(schema.directives.fts && { $fts: schema.directives.fts }),
    ...(schema.directives.vector && { $vector: schema.directives.vector }),
  }));

  return JSON.stringify(serializableSchemas, null, 2);
}

/**
 * Generate output based on the specified format.
 *
 * @param schemas - Array of IceType schemas
 * @param format - Output format (ts or json)
 * @returns Formatted output string
 */
export function generateOutput(
  schemas: IceTypeSchema[],
  format: DrizzleImportFormat
): string {
  switch (format) {
    case 'ts':
      return generateTypeScriptOutput(schemas);
    case 'json':
      return generateJsonOutput(schemas);
    default:
      return assertNever(format);
  }
}

/**
 * CLI command handler for `ice drizzle import`
 *
 * @param args - Command line arguments
 *
 * Usage:
 * ```bash
 * ice drizzle import --input ./drizzle-schema.ts
 * ice drizzle import -i ./schema.ts --output ./icetype-schema.ts
 * ice drizzle import -i ./schema.ts -o ./schema.json --format json
 * ```
 */
export async function drizzleImport(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(DRIZZLE_IMPORT_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f', default: 'ts' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Validate required options - throws if missing
  requireOption(
    values.input,
    'input',
    'drizzle import',
    'ice drizzle import --input ./drizzle-schema.ts --output ./icetype-schema.ts'
  );

  const inputPath = values.input;
  const outputPath = typeof values.output === 'string' ? values.output : undefined;
  const format = (values.format as string) || 'ts';
  const quiet = values.quiet === true;
  const verbose = values.verbose === true;

  // Validate format option
  const validFormats = ['ts', 'json'] as const;
  validateOptionValue(format, 'format', validFormats);

  // Create logger based on verbosity
  const logLevel = verbose
    ? LogLevel.DEBUG
    : quiet
      ? LogLevel.ERROR
      : LogLevel.INFO;

  const logger = createLogger({
    level: logLevel,
    quiet,
  });

  logger.info(`Importing Drizzle schema from: ${inputPath}`);
  logger.debug('Options:', {
    format,
    output: outputPath || '(stdout)',
  });

  // Parse the Drizzle schema file
  logger.debug('Parsing Drizzle schema file', { path: inputPath });
  let schemas: IceTypeSchema[];
  try {
    schemas = await parseDrizzleFile(inputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse Drizzle schema file '${inputPath}': ${message}\n` +
        'Check that the file exists and contains valid Drizzle table definitions.'
    );
  }

  if (schemas.length === 0) {
    throw new Error(
      `No Drizzle tables found in '${inputPath}'.\n` +
        'Make sure the file contains pgTable, mysqlTable, or sqliteTable definitions.'
    );
  }

  logger.info(`Found ${schemas.length} table(s)`);
  logger.debug('Tables found:', {
    names: schemas.map((s) => s.name),
  });

  // Generate output in the specified format
  for (const schema of schemas) {
    logger.debug(`Processing schema: ${schema.name}`);
  }

  const output = generateOutput(schemas, format as DrizzleImportFormat);

  // Output to file or stdout
  if (outputPath) {
    try {
      writeFileSync(outputPath, output);
      logger.success(`Exported IceType schema: ${outputPath}`);
      logger.info(`Converted ${schemas.length} table(s) to IceType format`);
    } catch (writeError) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      throw new Error(
        `Failed to write output file '${outputPath}': ${message}\n` +
          'Check that the directory exists and you have write permissions.'
      );
    }
  } else {
    // Output to stdout
    console.log(output);
  }
}

/**
 * Export the help definition for use in the main CLI.
 */
export const DRIZZLE_IMPORT_HELP_COMMAND = DRIZZLE_IMPORT_HELP;
