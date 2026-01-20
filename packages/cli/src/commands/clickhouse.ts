/**
 * ice clickhouse export command
 *
 * Exports IceType schema to ClickHouse DDL (CREATE TABLE statements).
 *
 * Usage:
 *   ice clickhouse export --schema ./schema.ts --output ./create-tables.sql
 *   ice clickhouse export -s ./schema.ts --engine ReplacingMergeTree --database analytics
 *
 * Options:
 *   -s, --schema     Path to the IceType schema file (required)
 *   -o, --output     Output file path (writes to stdout if not specified)
 *   -e, --engine     ClickHouse engine type (default: MergeTree)
 *   -d, --database   Database name to prefix tables with
 *   -q, --quiet      Suppress informational output
 *   -v, --verbose    Show detailed output
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { ClickHouseAdapter, ClickHouseEngine } from '@icetype/clickhouse';
import { getAdapter } from '../utils/adapter-registry.js';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import type { Logger } from '../utils/logger.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import {
  requireOption,
  validateOptionValue,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

const CLICKHOUSE_EXPORT_HELP: HelpCommand = {
  name: 'clickhouse export',
  description: 'Export IceType schema to ClickHouse DDL',
  usage: 'ice clickhouse export --schema <file> [--output <file>] [--engine <engine>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'engine', short: 'e', description: 'ClickHouse engine type', defaultValue: 'MergeTree' },
    { name: 'database', short: 'd', description: 'Database name to prefix tables with' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice clickhouse export --schema ./schema.ts --output ./tables.sql',
    'ice clickhouse export -s ./schema.ts --engine ReplacingMergeTree --database analytics',
  ],
};

/**
 * Valid ClickHouse engine types.
 */
const VALID_ENGINES: ClickHouseEngine[] = [
  'MergeTree',
  'ReplacingMergeTree',
  'SummingMergeTree',
  'AggregatingMergeTree',
  'CollapsingMergeTree',
];

/**
 * Check if a value is a valid ClickHouse engine.
 */
function isValidEngine(value: string): value is ClickHouseEngine {
  return VALID_ENGINES.includes(value as ClickHouseEngine);
}

// Export for use in other modules
export { isValidEngine };

/**
 * Export IceType schema to ClickHouse DDL.
 *
 * @param args - Command line arguments
 */
export async function clickhouseExport(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(CLICKHOUSE_EXPORT_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      engine: { type: 'string', short: 'e' },
      database: { type: 'string', short: 'd' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Determine log level based on flags
  let logLevel = LogLevel.INFO;
  if (values.verbose) {
    logLevel = LogLevel.DEBUG;
  } else if (values.quiet) {
    logLevel = LogLevel.ERROR;
  }

  const logger: Logger = createLogger({
    level: logLevel,
    quiet: values.quiet,
  });

  // Validate required --schema option - throws if missing
  requireOption(
    values.schema,
    'schema',
    'clickhouse export',
    'ice clickhouse export --schema ./schema.ts --output ./create-tables.sql'
  );

  const schemaPath = values.schema;
  const outputPath = values.output; // undefined means stdout

  // Validate engine option if provided
  let engine: ClickHouseEngine = 'MergeTree';
  if (values.engine) {
    validateOptionValue(values.engine, 'engine', VALID_ENGINES);
    engine = values.engine;
  }

  // Get database name if provided
  const database = values.database;

  logger.info(`Exporting ClickHouse DDL from: ${schemaPath}`);
  logger.debug('Options:', {
    engine,
    database: database || '(default)',
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

    // Get the ClickHouse adapter from the registry
    const adapter = getAdapter('clickhouse') as ClickHouseAdapter | undefined;
    if (!adapter) {
      throw new Error('ClickHouse adapter is not registered. Call initializeAdapterRegistry() first.');
    }

    // Generate DDL for all schemas
    const ddlStatements: string[] = [];

    for (const { name, schema } of loadResult.schemas) {
      logger.debug(`Processing schema: ${name}`);

      // Transform schema to ClickHouse DDL structure
      const ddl = adapter.transform(schema, {
        engine,
        database,
        ifNotExists: true,
      });

      // Serialize to SQL
      const sql = adapter.serialize(ddl);
      ddlStatements.push(sql);

      logger.debug(`Generated DDL for: ${ddl.tableName}`, {
        columns: ddl.columns.length,
        engine: ddl.engine,
        orderBy: ddl.orderBy.join(', ') || '(auto)',
      });
    }

    // Combine all DDL statements
    const fullDdl = ddlStatements.join('\n\n');

    // Output the DDL
    if (outputPath) {
      try {
        writeFileSync(outputPath, fullDdl);
        logger.success(`Exported ClickHouse DDL: ${outputPath}`);
        logger.info(`Generated ${loadResult.schemas.length} table(s)`);
      } catch (writeError) {
        const message =
          writeError instanceof Error ? writeError.message : String(writeError);
        throw new Error(
          `Failed to write output file '${outputPath}': ${message}\n` +
          'Check that the directory exists and you have write permissions.'
        );
      }
    } else {
      // Output to stdout
      console.log(fullDdl);
    }
}
