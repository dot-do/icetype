/**
 * ice drizzle export command
 *
 * Exports IceType schema to Drizzle ORM TypeScript schema files.
 * Supports PostgreSQL, MySQL, and SQLite dialects.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs as nodeParseArgs } from 'node:util';
import type { IceTypeSchema } from '@icetype/core';
import {
  DrizzleAdapter,
  transformSchemasToDrizzle,
  type DrizzleDialect,
  type DrizzleAdapterOptions,
} from '@icetype/drizzle';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import {
  requireOption,
  checkSchemaLoadErrors,
  checkSchemasExist,
  validateOptionValue,
} from '../utils/cli-error.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Valid dialect values for Drizzle ORM.
 */
const VALID_DIALECTS = ['pg', 'mysql', 'sqlite'] as const;

const DRIZZLE_EXPORT_HELP: HelpCommand = {
  name: 'drizzle export',
  description: 'Export IceType schema to Drizzle ORM TypeScript schema files',
  usage: 'ice drizzle export --schema <file> [--output <file>] [--dialect <pg|mysql|sqlite>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'dialect', short: 'd', description: 'Target SQL dialect (pg, mysql, sqlite)', defaultValue: 'pg' },
    { name: 'camel-case', description: 'Use camelCase for column names in generated code' },
    { name: 'table-name', description: 'Override the table name for single schema export' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice drizzle export --schema ./schema.ts --output ./drizzle-schema.ts',
    'ice drizzle export -s ./schema.ts -d mysql --output ./db/schema.ts',
    'ice drizzle export -s ./schema.ts --dialect sqlite --camel-case',
    'ice drizzle export -s ./schema.ts -d pg --table-name users',
  ],
};

// =============================================================================
// Types
// =============================================================================

interface DrizzleExportOptions {
  schema?: string;
  output?: string;
  dialect?: string;
  camelCase?: boolean;
  tableName?: string;
  quiet?: boolean;
  verbose?: boolean;
}

interface GenerateOptions {
  dialect?: DrizzleDialect;
  camelCase?: boolean;
  tableName?: string;
}

// =============================================================================
// Code Generation Helpers
// =============================================================================

/**
 * Generate Drizzle schema code from a single IceType schema.
 *
 * @param schema - The IceType schema
 * @param options - Generation options
 * @returns The generated TypeScript code
 */
function generateCodeFromSchema(
  schema: IceTypeSchema,
  options: GenerateOptions
): string {
  const adapter = new DrizzleAdapter();

  const adapterOptions: DrizzleAdapterOptions = {
    dialect: options.dialect ?? 'pg',
    camelCase: options.camelCase ?? true,
    tableName: options.tableName,
    enforceNotNull: true,
    includeSystemFields: false,
  };

  const drizzleSchema = adapter.transform(schema, adapterOptions);
  return adapter.serialize(drizzleSchema);
}

/**
 * Generate Drizzle schema code from multiple IceType schemas.
 *
 * @param schemas - Array of IceType schemas
 * @param options - Generation options
 * @returns The combined TypeScript code
 */
function generateCodeFromSchemas(
  schemas: IceTypeSchema[],
  options: GenerateOptions
): string {
  const adapterOptions: DrizzleAdapterOptions = {
    dialect: options.dialect ?? 'pg',
    camelCase: options.camelCase ?? true,
    tableName: options.tableName,
    enforceNotNull: true,
    includeSystemFields: false,
  };

  return transformSchemasToDrizzle(schemas, adapterOptions);
}

/**
 * Parse command line arguments for drizzle export command.
 *
 * @param args - Command line arguments
 * @returns Parsed options
 */
function parseArgs(args: string[]): DrizzleExportOptions {
  const { values } = nodeParseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      dialect: { type: 'string', short: 'd' },
      'camel-case': { type: 'boolean' },
      'table-name': { type: 'string' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  return {
    schema: values.schema,
    output: values.output,
    dialect: values.dialect,
    camelCase: values['camel-case'] ?? true,
    tableName: values['table-name'],
    quiet: values.quiet ?? false,
    verbose: values.verbose ?? false,
  };
}

// =============================================================================
// Main Export Command
// =============================================================================

/**
 * Export IceType schema to Drizzle ORM TypeScript schema files.
 *
 * Generates Drizzle ORM TypeScript schema files from IceType schemas.
 * Supports PostgreSQL, MySQL, and SQLite dialects.
 *
 * @param args - Command line arguments
 * @throws Error if --schema is not provided or dialect is invalid
 *
 * @example
 * ```bash
 * # Export to PostgreSQL Drizzle schema
 * ice drizzle export --schema ./schema.ts --output ./drizzle-schema.ts
 *
 * # Export to MySQL with camelCase column names
 * ice drizzle export -s ./schema.ts -d mysql --camel-case
 *
 * # Export to SQLite with custom table name
 * ice drizzle export -s ./schema.ts --dialect sqlite --table-name users
 * ```
 */
export async function drizzleExport(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(DRIZZLE_EXPORT_HELP));
    process.exit(0);
  }

  const options = parseArgs(args);

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
    options.schema,
    'schema',
    'drizzle export',
    'ice drizzle export --schema ./schema.ts --output ./drizzle-schema.ts'
  );

  const schemaPath = options.schema;

  // Validate dialect if provided
  let dialect: DrizzleDialect = 'pg';
  if (options.dialect) {
    validateOptionValue(options.dialect, 'dialect', VALID_DIALECTS);
    dialect = options.dialect as DrizzleDialect;
  }

  logger.info(`Exporting Drizzle schema from: ${schemaPath}`);
  logger.debug('Options:', {
    dialect,
    camelCase: options.camelCase,
    tableName: options.tableName || '(default)',
    output: options.output || '(stdout)',
  });

  // Load schemas from the file - throws on errors
  logger.debug('Loading schema file', { path: schemaPath });
  const loadResult = await loadSchemaFile(schemaPath);
  checkSchemaLoadErrors(loadResult.errors, schemaPath);
  checkSchemasExist(loadResult.schemas, schemaPath);

  logger.info(`Found ${loadResult.schemas.length} schema(s)`);
  logger.debug('Schemas found:', {
    names: loadResult.schemas.map((s) => s.name),
  });

  // Generate Drizzle code for all schemas
  const schemas = loadResult.schemas.map((s) => s.schema);
  const code = generateCodeFromSchemas(schemas, {
    dialect,
    camelCase: options.camelCase,
    tableName: options.tableName,
  });

  // Output code
  if (options.output) {
    try {
      writeFileSync(options.output, code);
      logger.success(`Exported Drizzle schema to: ${options.output}`);
    } catch (writeError) {
      const message =
        writeError instanceof Error ? writeError.message : String(writeError);
      throw new Error(
        `Failed to write output file '${options.output}': ${message}`
      );
    }
  } else {
    // Output to stdout
    console.log(code);
  }

  // Log summary
  logger.info(`Generated Drizzle schema for ${schemas.length} table(s)`);
  logger.info(`Target dialect: ${dialect}`);
  if (options.camelCase) {
    logger.debug('Using camelCase for column names');
  }
}

// =============================================================================
// Test Helpers (exported for testing)
// =============================================================================

/**
 * Test helpers for unit testing the drizzle command.
 * These are not part of the public API.
 */
export const _testHelpers = {
  generateCodeFromSchema,
  generateCodeFromSchemas,
  parseArgs,
  VALID_DIALECTS,
};
