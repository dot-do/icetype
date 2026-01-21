/**
 * ice sqlite export command
 *
 * Exports IceType schema to SQLite DDL (Data Definition Language).
 */

import { writeFileSync } from 'node:fs';
import { parseArgs as nodeParseArgs } from 'node:util';
import type { IceTypeSchema } from '@icetype/core';
import { SQLiteAdapter, type SQLiteAdapterOptions } from '@icetype/sqlite';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import {
  requireOption,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

const SQLITE_EXPORT_HELP: HelpCommand = {
  name: 'sqlite export',
  description: 'Export IceType schema to SQLite DDL',
  usage: 'ice sqlite export --schema <file> [--output <file>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'table-name', description: 'Override the table name' },
    { name: 'if-not-exists', description: 'Add IF NOT EXISTS to CREATE statements' },
    { name: 'indexes', description: 'Include index creation statements' },
    { name: 'strict', description: 'Use STRICT mode for type enforcement (SQLite 3.37+)' },
    { name: 'without-rowid', description: 'Use WITHOUT ROWID optimization' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice sqlite export --schema ./schema.ts --output ./tables.sql',
    'ice sqlite export -s ./schema.ts --strict --without-rowid',
    'ice sqlite export -s ./schema.ts --if-not-exists --indexes',
  ],
};

// =============================================================================
// Types
// =============================================================================

interface SQLiteExportOptions {
  schema?: string;
  output?: string;
  tableName?: string;
  quiet?: boolean;
  verbose?: boolean;
  ifNotExists?: boolean;
  includeIndexes?: boolean;
  strict?: boolean;
  withoutRowid?: boolean;
}

interface GenerateDDLOptions {
  tableName?: string;
  ifNotExists?: boolean;
  includeIndexes?: boolean;
  strict?: boolean;
  withoutRowid?: boolean;
}

// =============================================================================
// DDL Generation Helpers
// =============================================================================

/**
 * Generate SQLite DDL from a single IceType schema.
 *
 * @param schema - The IceType schema
 * @param options - Generation options
 * @returns The DDL SQL string
 */
function generateDDLFromSchema(
  schema: IceTypeSchema,
  options: GenerateDDLOptions
): string {
  const adapter = new SQLiteAdapter();

  const adapterOptions: SQLiteAdapterOptions = {
    tableName: options.tableName,
    ifNotExists: options.ifNotExists ?? false,
    strict: options.strict ?? false,
    withoutRowid: options.withoutRowid ?? false,
  };

  const ddl = adapter.transform(schema, adapterOptions);

  if (options.includeIndexes) {
    return adapter.serializeWithIndexes(ddl);
  }

  return adapter.serialize(ddl);
}

/**
 * Generate SQLite DDL from multiple IceType schemas.
 *
 * @param schemas - Array of IceType schemas
 * @param options - Generation options
 * @returns The combined DDL SQL string
 */
function generateDDLFromSchemas(
  schemas: IceTypeSchema[],
  options: GenerateDDLOptions
): string {
  const statements: string[] = [];

  for (const schema of schemas) {
    const ddl = generateDDLFromSchema(schema, options);
    statements.push(ddl);
  }

  return statements.join('\n\n');
}

/**
 * Parse command line arguments for sqlite export command.
 *
 * @param args - Command line arguments
 * @returns Parsed options
 */
function parseArgs(args: string[]): SQLiteExportOptions {
  const { values } = nodeParseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      'table-name': { type: 'string' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
      'if-not-exists': { type: 'boolean' },
      indexes: { type: 'boolean' },
      strict: { type: 'boolean' },
      'without-rowid': { type: 'boolean' },
    },
  });

  return {
    schema: values.schema,
    output: values.output,
    tableName: values['table-name'],
    quiet: values.quiet ?? false,
    verbose: values.verbose ?? false,
    ifNotExists: values['if-not-exists'] ?? false,
    includeIndexes: values.indexes ?? false,
    strict: values.strict ?? false,
    withoutRowid: values['without-rowid'] ?? false,
  };
}

// =============================================================================
// Main Export Command
// =============================================================================

/**
 * Export IceType schema to SQLite DDL.
 *
 * @param args - Command line arguments
 * @throws Error if --schema is not provided
 *
 * @example
 * ```bash
 * ice sqlite export --schema ./schema.ts --output ./create-tables.sql
 * ice sqlite export -s ./schema.ts --strict --without-rowid
 * ice sqlite export -s ./schema.ts --if-not-exists --indexes
 * ```
 */
export async function sqliteExport(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(SQLITE_EXPORT_HELP));
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
    'sqlite export',
    'ice sqlite export --schema ./schema.ts --output ./tables.sql'
  );

  const schemaPath = options.schema;

  logger.info(`Exporting SQLite DDL from: ${schemaPath}`);
  logger.debug('Options:', {
    tableName: options.tableName || '(default)',
    output: options.output || '(stdout)',
    ifNotExists: options.ifNotExists,
    includeIndexes: options.includeIndexes,
    strict: options.strict,
    withoutRowid: options.withoutRowid,
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

  // Generate DDL for all schemas
  const schemas = loadResult.schemas.map((s) => s.schema);
  const ddl = generateDDLFromSchemas(schemas, {
    tableName: options.tableName,
    ifNotExists: options.ifNotExists,
    includeIndexes: options.includeIndexes,
    strict: options.strict,
    withoutRowid: options.withoutRowid,
  });

  // Output DDL
  if (options.output) {
    try {
      writeFileSync(options.output, ddl);
      logger.success(`Exported SQLite DDL to: ${options.output}`);
    } catch (writeError) {
      const message =
        writeError instanceof Error ? writeError.message : String(writeError);
      throw new Error(
        `Failed to write output file '${options.output}': ${message}`
      );
    }
  } else {
    // Output to stdout
    console.log(ddl);
  }

  // Log summary
  logger.info(`Generated DDL for ${schemas.length} table(s)`);
  if (options.strict) {
    logger.info('Using SQLite STRICT mode');
  }
  if (options.withoutRowid) {
    logger.info('Using WITHOUT ROWID optimization');
  }
}

// =============================================================================
// Test Helpers (exported for testing)
// =============================================================================

/**
 * Test helpers for unit testing the sqlite command.
 * These are not part of the public API.
 */
export const _testHelpers = {
  generateDDLFromSchema,
  generateDDLFromSchemas,
  parseArgs,
};
