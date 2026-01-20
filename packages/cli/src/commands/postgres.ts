/**
 * ice postgres export command
 *
 * Exports IceType schema to PostgreSQL DDL (Data Definition Language).
 * Generates CREATE TABLE statements with appropriate PostgreSQL types,
 * NOT NULL constraints, UNIQUE constraints, and indexes.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getPostgresType } from '@icetype/core';
import { escapeIdentifier } from '@icetype/postgres';
import { loadSchemaFile } from '../utils/schema-loader.js';
import type { IceTypeSchema } from '@icetype/core';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import {
  requireOption,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

const POSTGRES_EXPORT_HELP: HelpCommand = {
  name: 'postgres export',
  description: 'Export IceType schema to PostgreSQL DDL',
  usage: 'ice postgres export --schema <file> [--output <file>] [--schemaName <name>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'schemaName', description: 'PostgreSQL schema name (e.g., public, app)' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice postgres export --schema ./schema.ts --output ./tables.sql',
    'ice postgres export -s ./schema.ts --schemaName public',
  ],
};

/**
 * Options for PostgreSQL DDL generation
 */
export interface PostgresDDLOptions {
  /** PostgreSQL schema name (e.g., 'public', 'app') */
  schemaName?: string;
}

/**
 * Generate PostgreSQL DDL for a single IceType schema.
 *
 * @param schema - The IceType schema to convert
 * @param options - Optional DDL generation options
 * @returns PostgreSQL DDL string (CREATE TABLE + CREATE INDEX statements)
 *
 * @example
 * ```typescript
 * const ddl = generatePostgresDDL(userSchema, { schemaName: 'public' });
 * // CREATE TABLE public.User (
 * //   id UUID NOT NULL UNIQUE,
 * //   name TEXT NOT NULL,
 * //   email TEXT NOT NULL
 * // );
 * // CREATE INDEX idx_User_email ON public.User (email);
 * ```
 */
export function generatePostgresDDL(
  schema: IceTypeSchema,
  options?: PostgresDDLOptions
): string {
  const schemaName = options?.schemaName;
  const escapedTableName = escapeIdentifier(schema.name);
  const tableName = schemaName
    ? `${escapeIdentifier(schemaName)}.${escapedTableName}`
    : escapedTableName;

  const columns: string[] = [];
  const indexes: string[] = [];

  // Process all fields
  for (const [fieldName, field] of schema.fields) {
    // Skip system fields starting with $
    if (fieldName.startsWith('$')) continue;

    const pgType = getPostgresType(field.type);
    const constraints: string[] = [];

    // NOT NULL for required fields (! modifier or non-optional)
    if (field.modifier === '!' || (!field.isOptional && field.modifier !== '?')) {
      constraints.push('NOT NULL');
    }

    // UNIQUE constraint
    if (field.isUnique || field.modifier === '!') {
      constraints.push('UNIQUE');
    }

    const constraintStr = constraints.length > 0 ? ' ' + constraints.join(' ') : '';
    const escapedFieldName = escapeIdentifier(fieldName);
    columns.push(`  ${escapedFieldName} ${pgType}${constraintStr}`);

    // Create index for indexed fields
    if (field.isIndexed || field.modifier === '#') {
      // Sanitize the index name by replacing special characters
      const safeIndexName = `idx_${schema.name}_${fieldName}`.replace(/[^a-zA-Z0-9_]/g, '_');
      indexes.push(
        `CREATE INDEX ${escapeIdentifier(safeIndexName)} ON ${tableName} (${escapedFieldName});`
      );
    }
  }

  // Build CREATE TABLE statement
  let ddl = `CREATE TABLE ${tableName} (\n${columns.join(',\n')}\n);`;

  // Add indexes if any
  if (indexes.length > 0) {
    ddl += '\n\n' + indexes.join('\n');
  }

  return ddl;
}

/**
 * Generate PostgreSQL DDL for multiple IceType schemas.
 *
 * @param schemas - Array of IceType schemas to convert
 * @param options - Optional DDL generation options
 * @returns Combined PostgreSQL DDL string for all schemas
 *
 * @example
 * ```typescript
 * const ddl = generatePostgresDDLForAllSchemas([userSchema, postSchema], { schemaName: 'app' });
 * ```
 */
export function generatePostgresDDLForAllSchemas(
  schemas: IceTypeSchema[],
  options?: PostgresDDLOptions
): string {
  if (schemas.length === 0) {
    return '';
  }

  const ddlStatements = schemas.map((schema) => generatePostgresDDL(schema, options));
  return ddlStatements.join('\n\n');
}

/**
 * CLI command handler for `ice postgres export`
 *
 * @param args - Command line arguments
 *
 * Usage:
 * ```bash
 * ice postgres export --schema ./schema.ts --output ./create-tables.sql
 * ice postgres export -s ./schema.ts --schema-name public
 * ice postgres export -s ./schema.ts  # outputs to stdout
 * ```
 */
export async function postgresExport(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(POSTGRES_EXPORT_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      schemaName: { type: 'string' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Validate required options - throws if missing
  requireOption(
    values.schema,
    'schema',
    'postgres export',
    'ice postgres export --schema ./schema.ts --output ./create-tables.sql --schema-name public'
  );

  const schemaPath = values.schema;
  const outputPath = typeof values.output === 'string' ? values.output : undefined;
  const schemaName = typeof values.schemaName === 'string' ? values.schemaName : undefined;
  const quiet = values.quiet === true;
  const verbose = values.verbose === true;

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

  logger.info(`Exporting PostgreSQL DDL from: ${schemaPath}`);
  logger.debug('Options:', {
    schemaName: schemaName || '(default)',
    output: outputPath || '(stdout)',
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

  for (const { name } of loadResult.schemas) {
    logger.debug(`Processing schema: ${name}`);
  }

  const ddl = generatePostgresDDLForAllSchemas(schemas, { schemaName });

  // Output DDL
  if (outputPath) {
    try {
      writeFileSync(outputPath, ddl);
      logger.success(`Exported PostgreSQL DDL: ${outputPath}`);
      logger.info(`Generated ${loadResult.schemas.length} table(s)`);
    } catch (writeError) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      throw new Error(
        `Failed to write output file '${outputPath}': ${message}\n` +
        'Check that the directory exists and you have write permissions.'
      );
    }
  } else {
    // Output to stdout
    console.log(ddl);
  }
}
