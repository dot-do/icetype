/**
 * ice duckdb export command
 *
 * Exports IceType schema to DuckDB DDL (Data Definition Language).
 */

import { writeFileSync } from 'node:fs';
import { parseArgs as nodeParseArgs } from 'node:util';
import type { IceTypeSchema } from '@icetype/core';
import { DuckDBAdapter } from '@icetype/duckdb';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { createLogger, LogLevel } from '../utils/logger.js';

// =============================================================================
// Types
// =============================================================================

interface DuckDBExportOptions {
  schema?: string;
  output?: string;
  schemaName?: string;
  quiet?: boolean;
  verbose?: boolean;
  ifNotExists?: boolean;
  includeIndexes?: boolean;
}

interface GenerateDDLOptions {
  schemaName?: string;
  ifNotExists?: boolean;
  includeIndexes?: boolean;
}

// =============================================================================
// DDL Generation Helpers
// =============================================================================

/**
 * Generate DuckDB DDL from a single IceType schema.
 *
 * @param schema - The IceType schema
 * @param options - Generation options
 * @returns The DDL SQL string
 */
function generateDDLFromSchema(
  schema: IceTypeSchema,
  options: GenerateDDLOptions
): string {
  const adapter = new DuckDBAdapter();

  const ddl = adapter.transform(schema, {
    schema: options.schemaName,
    ifNotExists: options.ifNotExists ?? false,
  });

  if (options.includeIndexes) {
    return adapter.serializeWithIndexes(ddl);
  }

  return adapter.serialize(ddl);
}

/**
 * Generate DuckDB DDL from multiple IceType schemas.
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
 * Parse command line arguments for duckdb export command.
 *
 * @param args - Command line arguments
 * @returns Parsed options
 */
function parseArgs(args: string[]): DuckDBExportOptions {
  const { values } = nodeParseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      'schema-name': { type: 'string' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
      'if-not-exists': { type: 'boolean' },
      indexes: { type: 'boolean' },
    },
  });

  return {
    schema: values.schema,
    output: values.output,
    schemaName: values['schema-name'],
    quiet: values.quiet ?? false,
    verbose: values.verbose ?? false,
    ifNotExists: values['if-not-exists'] ?? false,
    includeIndexes: values.indexes ?? false,
  };
}

// =============================================================================
// Main Export Command
// =============================================================================

/**
 * Export IceType schema to DuckDB DDL.
 *
 * @param args - Command line arguments
 * @throws Error if --schema is not provided
 *
 * @example
 * ```bash
 * ice duckdb export --schema ./schema.ts --output ./create-tables.sql
 * ice duckdb export -s ./schema.ts --schema-name analytics
 * ```
 */
export async function duckdbExport(args: string[]): Promise<void> {
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

  // Validate required options
  if (!options.schema) {
    const error = new Error('--schema is required');
    logger.error('Error: --schema is required');
    logger.info(
      'Usage: ice duckdb export --schema ./schema.ts --output ./tables.sql'
    );
    throw error;
  }

  const schemaPath = options.schema;

  logger.info(`Exporting DuckDB DDL from: ${schemaPath}`);

  try {
    // Load schemas from the file
    const loadResult = await loadSchemaFile(schemaPath);

    // Check for loading errors
    if (loadResult.errors.length > 0) {
      for (const error of loadResult.errors) {
        logger.error(error);
      }
      throw new Error(`Failed to load schema from: ${schemaPath}`);
    }

    if (loadResult.schemas.length === 0) {
      throw new Error('No schemas found in the file');
    }

    logger.info(`Found ${loadResult.schemas.length} schema(s)`);

    // Generate DDL for all schemas
    const schemas = loadResult.schemas.map((s) => s.schema);
    const ddl = generateDDLFromSchemas(schemas, {
      schemaName: options.schemaName,
      ifNotExists: options.ifNotExists,
      includeIndexes: options.includeIndexes,
    });

    // Output DDL
    if (options.output) {
      try {
        writeFileSync(options.output, ddl);
        logger.success(`Exported DuckDB DDL to: ${options.output}`);
      } catch (writeError) {
        const message =
          writeError instanceof Error ? writeError.message : String(writeError);
        logger.error(`Failed to write output file '${options.output}': ${message}`);
        throw new Error(`Failed to write output file: ${options.output}`);
      }
    } else {
      // Output to stdout
      console.log(ddl);
    }

    // Log summary
    logger.info(`Generated DDL for ${schemas.length} table(s)`);
    if (options.schemaName) {
      logger.info(`Using DuckDB schema: ${options.schemaName}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('--schema is required')) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error exporting DuckDB DDL: ${message}`);
    throw error;
  }
}

// =============================================================================
// Test Helpers (exported for testing)
// =============================================================================

/**
 * Test helpers for unit testing the duckdb command.
 * These are not part of the public API.
 */
export const _testHelpers = {
  generateDDLFromSchema,
  generateDDLFromSchemas,
  parseArgs,
};
