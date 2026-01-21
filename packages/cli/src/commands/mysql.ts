/**
 * ice mysql export command
 *
 * Exports IceType schema to MySQL DDL (Data Definition Language).
 */

import { writeFileSync } from 'node:fs';
import { parseArgs as nodeParseArgs } from 'node:util';
import type { IceTypeSchema } from '@icetype/core';
import type { MySQLAdapter } from '@icetype/mysql';
import { getAdapter } from '../utils/adapter-registry.js';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import {
  requireOption,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

const MYSQL_EXPORT_HELP: HelpCommand = {
  name: 'mysql export',
  description: 'Export IceType schema to MySQL DDL',
  usage: 'ice mysql export --schema <file> [--output <file>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'if-not-exists', description: 'Add IF NOT EXISTS to CREATE statements' },
    { name: 'indexes', description: 'Include index creation statements' },
    { name: 'engine', short: 'e', description: 'MySQL storage engine', defaultValue: 'InnoDB' },
    { name: 'charset', description: 'Character set (e.g., utf8mb4)' },
    { name: 'collation', description: 'Collation (e.g., utf8mb4_unicode_ci)' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice mysql export --schema ./schema.ts --output ./tables.sql',
    'ice mysql export -s ./schema.ts --engine InnoDB --charset utf8mb4',
    'ice mysql export -s ./schema.ts --if-not-exists --indexes',
  ],
};

// =============================================================================
// Types
// =============================================================================

interface MySQLExportOptions {
  schema?: string;
  output?: string;
  quiet?: boolean;
  verbose?: boolean;
  ifNotExists?: boolean;
  includeIndexes?: boolean;
  engine?: string;
  charset?: string;
  collation?: string;
}

interface GenerateDDLOptions {
  ifNotExists?: boolean;
  includeIndexes?: boolean;
  engine?: string;
  charset?: string;
  collation?: string;
}

// =============================================================================
// DDL Generation Helpers
// =============================================================================

/**
 * Generate MySQL DDL from a single IceType schema.
 *
 * @param schema - The IceType schema
 * @param options - Generation options
 * @returns The DDL SQL string
 */
function generateDDLFromSchema(
  schema: IceTypeSchema,
  options: GenerateDDLOptions
): string {
  // Get the MySQL adapter from the registry
  const adapter = getAdapter('mysql') as MySQLAdapter | undefined;
  if (!adapter) {
    throw new Error('MySQL adapter is not registered. Call initializeAdapterRegistry() first.');
  }

  const ddl = adapter.transform(schema, {
    ifNotExists: options.ifNotExists ?? false,
    engine: options.engine,
    charset: options.charset,
    collation: options.collation,
  });

  if (options.includeIndexes) {
    return adapter.serializeWithIndexes(ddl);
  }

  return adapter.serialize(ddl);
}

/**
 * Generate MySQL DDL from multiple IceType schemas.
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
 * Parse command line arguments for mysql export command.
 *
 * @param args - Command line arguments
 * @returns Parsed options
 */
function parseArgs(args: string[]): MySQLExportOptions {
  const { values } = nodeParseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
      'if-not-exists': { type: 'boolean' },
      indexes: { type: 'boolean' },
      engine: { type: 'string', short: 'e' },
      charset: { type: 'string' },
      collation: { type: 'string' },
    },
  });

  return {
    schema: values.schema,
    output: values.output,
    quiet: values.quiet ?? false,
    verbose: values.verbose ?? false,
    ifNotExists: values['if-not-exists'] ?? false,
    includeIndexes: values.indexes ?? false,
    engine: values.engine,
    charset: values.charset,
    collation: values.collation,
  };
}

// =============================================================================
// Main Export Command
// =============================================================================

/**
 * Export IceType schema to MySQL DDL.
 *
 * @param args - Command line arguments
 * @throws Error if --schema is not provided
 *
 * @example
 * ```bash
 * ice mysql export --schema ./schema.ts --output ./create-tables.sql
 * ice mysql export -s ./schema.ts --engine InnoDB --charset utf8mb4
 * ```
 */
export async function mysqlExport(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(MYSQL_EXPORT_HELP));
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
    'mysql export',
    'ice mysql export --schema ./schema.ts --output ./tables.sql'
  );

  const schemaPath = options.schema;

  logger.info(`Exporting MySQL DDL from: ${schemaPath}`);
  logger.debug('Options:', {
    engine: options.engine || 'InnoDB',
    charset: options.charset || '(default)',
    collation: options.collation || '(default)',
    output: options.output || '(stdout)',
    ifNotExists: options.ifNotExists,
    includeIndexes: options.includeIndexes,
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
    ifNotExists: options.ifNotExists,
    includeIndexes: options.includeIndexes,
    engine: options.engine,
    charset: options.charset,
    collation: options.collation,
  });

  // Output DDL
  if (options.output) {
    try {
      writeFileSync(options.output, ddl);
      logger.success(`Exported MySQL DDL to: ${options.output}`);
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
  if (options.engine) {
    logger.info(`Using MySQL engine: ${options.engine}`);
  }
  if (options.charset) {
    logger.info(`Using charset: ${options.charset}`);
  }
}

// =============================================================================
// Test Helpers (exported for testing)
// =============================================================================

/**
 * Test helpers for unit testing the mysql command.
 * These are not part of the public API.
 */
export const _testHelpers = {
  generateDDLFromSchema,
  generateDDLFromSchemas,
  parseArgs,
};
