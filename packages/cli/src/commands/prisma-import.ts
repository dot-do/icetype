/**
 * ice prisma import command
 *
 * Imports existing Prisma schemas and converts them to IceType schema definitions.
 * This is useful for migrating from Prisma to IceType.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { assertNever } from '@icetype/core';
import { parsePrismaFile, type IceTypeSchemaDefinition } from '@icetype/prisma';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import {
  requireOption,
  validateOptionValue,
} from '../utils/cli-error.js';

const PRISMA_IMPORT_HELP: HelpCommand = {
  name: 'prisma import',
  description: 'Import Prisma schema and convert to IceType',
  usage: 'ice prisma import --input <file> [--output <file>] [--format <format>]',
  options: [
    { name: 'input', short: 'i', description: 'Input .prisma schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'format', short: 'f', description: 'Output format (ts, json)', defaultValue: 'ts' },
    { name: 'quiet', short: 'q', description: 'Suppress informational messages' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
    { name: 'no-relations', description: 'Exclude relation fields from output' },
    { name: 'no-unique-to-indexed', description: 'Do not convert unique constraints to indexed' },
  ],
  examples: [
    'ice prisma import --input ./prisma/schema.prisma',
    'ice prisma import -i ./schema.prisma -o ./schema.ts',
    'ice prisma import -i ./schema.prisma -f json -o ./schema.json',
    'ice prisma import -i ./schema.prisma --no-relations',
  ],
};

// =============================================================================
// Types
// =============================================================================

interface PrismaImportCliOptions {
  input?: string;
  output?: string;
  format?: string;
  quiet?: boolean;
  verbose?: boolean;
  noRelations?: boolean;
  noUniqueToIndexed?: boolean;
}

// Valid output formats
const VALID_FORMATS = ['ts', 'json'] as const;
type OutputFormat = (typeof VALID_FORMATS)[number];

// =============================================================================
// Output Formatting
// =============================================================================

/**
 * Format IceType schemas as TypeScript code.
 *
 * @param schemas - Array of IceType schema definitions
 * @returns TypeScript code string
 */
export function formatAsTypeScript(schemas: IceTypeSchemaDefinition[]): string {
  const lines: string[] = [];

  // Add header comment
  lines.push('/**');
  lines.push(' * IceType Schema Definitions');
  lines.push(' *');
  lines.push(' * Generated from Prisma schema by @icetype/cli');
  lines.push(' */');
  lines.push('');
  lines.push("import { DB } from '@icetype/core';");
  lines.push('');

  // Export the schema definitions
  lines.push('export const db = DB({');

  for (const schema of schemas) {
    const typeName = schema.$type;
    lines.push(`  ${typeName}: {`);

    // Process fields (excluding $type and other $ prefixed properties)
    for (const [key, value] of Object.entries(schema)) {
      if (key.startsWith('$')) continue;
      if (typeof value === 'string') {
        // Escape any quotes in the value
        const escapedValue = value.replace(/'/g, "\\'");
        lines.push(`    ${key}: '${escapedValue}',`);
      }
    }

    lines.push('  },');
  }

  lines.push('});');
  lines.push('');

  // Export individual schema types for convenience
  lines.push('// Export individual schema types');
  for (const schema of schemas) {
    const typeName = schema.$type;
    lines.push(`export const ${typeName}Schema = db.${typeName};`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format IceType schemas as JSON.
 *
 * @param schemas - Array of IceType schema definitions
 * @returns JSON string
 */
export function formatAsJson(schemas: IceTypeSchemaDefinition[]): string {
  return JSON.stringify(schemas, null, 2);
}

/**
 * Format schemas based on output format.
 *
 * @param schemas - Array of IceType schema definitions
 * @param format - Output format ('ts' or 'json')
 * @returns Formatted output string
 */
export function formatSchemas(schemas: IceTypeSchemaDefinition[], format: OutputFormat): string {
  switch (format) {
    case 'ts':
      return formatAsTypeScript(schemas);
    case 'json':
      return formatAsJson(schemas);
    default:
      return assertNever(format);
  }
}

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * Parse command line arguments for prisma import command.
 *
 * @param args - Command line arguments
 * @returns Parsed options
 */
export function parseCliArgs(args: string[]): PrismaImportCliOptions {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
      'no-relations': { type: 'boolean' },
      'no-unique-to-indexed': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  return {
    input: values.input,
    output: values.output,
    format: values.format,
    quiet: values.quiet ?? false,
    verbose: values.verbose ?? false,
    noRelations: values['no-relations'] ?? false,
    noUniqueToIndexed: values['no-unique-to-indexed'] ?? false,
  };
}

// =============================================================================
// Main Export Command
// =============================================================================

/**
 * Import Prisma schema and convert to IceType.
 *
 * @param args - Command line arguments
 * @throws Error if --input is not provided
 *
 * @example
 * ```bash
 * ice prisma import --input ./prisma/schema.prisma
 * ice prisma import -i ./schema.prisma -o ./icetype-schema.ts
 * ice prisma import -i ./schema.prisma -f json -o ./schema.json
 * ice prisma import -i ./schema.prisma --no-relations
 * ```
 */
export async function prismaImport(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(PRISMA_IMPORT_HELP));
    process.exit(0);
  }

  const options = parseCliArgs(args);

  // Create logger based on verbosity
  const logLevel = options.verbose
    ? LogLevel.DEBUG
    : options.quiet
      ? LogLevel.ERROR
      : LogLevel.INFO;

  const logger = createLogger({
    level: logLevel,
    quiet: options.quiet,
  });

  // Validate required options - throws if missing
  requireOption(
    options.input,
    'input',
    'prisma import',
    'ice prisma import --input ./prisma/schema.prisma'
  );

  const inputPath = options.input;

  // Validate format option
  const format: OutputFormat = (options.format as OutputFormat) || 'ts';
  validateOptionValue(format, 'format', VALID_FORMATS);

  logger.info(`Importing Prisma schema from: ${inputPath}`);
  logger.debug('Options:', {
    format,
    output: options.output || '(stdout)',
    includeRelations: !options.noRelations,
    convertUniqueToIndexed: !options.noUniqueToIndexed,
  });

  // Parse the Prisma schema file
  logger.debug('Parsing Prisma schema file', { path: inputPath });

  let schemas: IceTypeSchemaDefinition[];
  try {
    schemas = await parsePrismaFile(inputPath, {
      includeRelations: !options.noRelations,
      convertUniqueToIndexed: !options.noUniqueToIndexed,
    });
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(
      `Failed to parse Prisma schema '${inputPath}': ${message}\n` +
        'Make sure the file exists and contains valid Prisma schema syntax.'
    );
  }

  if (schemas.length === 0) {
    logger.warn('No models found in the Prisma schema file');
    return;
  }

  logger.info(`Found ${schemas.length} model(s)`);
  logger.debug('Models found:', {
    names: schemas.map((s) => s.$type),
  });

  // Format the output
  const output = formatSchemas(schemas, format);

  // Write output
  if (options.output) {
    try {
      writeFileSync(options.output, output);
      logger.success(`Exported IceType schema to: ${options.output}`);
    } catch (writeError) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      throw new Error(
        `Failed to write output file '${options.output}': ${message}\n` +
          'Check that the directory exists and you have write permissions.'
      );
    }
  } else {
    // Output to stdout
    console.log(output);
  }

  // Log summary
  logger.info(`Converted ${schemas.length} Prisma model(s) to IceType`);
  logger.info(`Output format: ${format}`);
}

// =============================================================================
// Test Helpers (exported for testing)
// =============================================================================

/**
 * Test helpers for unit testing the prisma import command.
 * These are not part of the public API.
 */
export const _testHelpers = {
  formatAsTypeScript,
  formatAsJson,
  formatSchemas,
  parseCliArgs,
  VALID_FORMATS,
};
