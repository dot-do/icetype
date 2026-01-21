/**
 * ice prisma export command
 *
 * Exports IceType schema to Prisma schema format.
 * Generates Prisma schema files with datasource, generator,
 * and model definitions from IceType schemas.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { generatePrismaSchema, type PrismaExportOptions, type PrismaProvider } from '@icetype/prisma';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import {
  requireOption,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

const PRISMA_EXPORT_HELP: HelpCommand = {
  name: 'prisma export',
  description: 'Export IceType schema to Prisma schema format',
  usage: 'ice prisma export --schema <file> [--output <file>] [--provider <provider>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'provider', short: 'p', description: 'Database provider (postgresql, mysql, sqlite, sqlserver, mongodb)', defaultValue: 'postgresql' },
    { name: 'datasource-url', description: 'Custom DATABASE_URL environment variable name' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice prisma export --schema ./schema.ts --output ./schema.prisma',
    'ice prisma export -s ./schema.ts -p mysql',
    'ice prisma export -s ./schema.ts --datasource-url DATABASE_CONNECTION_STRING',
  ],
};

/**
 * Valid Prisma database providers
 */
const VALID_PROVIDERS: PrismaProvider[] = [
  'postgresql',
  'mysql',
  'sqlite',
  'sqlserver',
  'mongodb',
];

/**
 * Validate that a provider string is a valid Prisma provider
 */
function isValidProvider(provider: string): provider is PrismaProvider {
  return VALID_PROVIDERS.includes(provider as PrismaProvider);
}

/**
 * CLI command handler for `ice prisma export`
 *
 * @param args - Command line arguments
 *
 * Usage:
 * ```bash
 * ice prisma export --schema ./schema.ts --output ./schema.prisma
 * ice prisma export -s ./schema.ts --provider mysql
 * ice prisma export -s ./schema.ts --datasource-url DATABASE_CONNECTION_STRING
 * ice prisma export -s ./schema.ts  # outputs to stdout
 * ```
 */
export async function prismaExport(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(PRISMA_EXPORT_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      provider: { type: 'string', short: 'p' },
      'datasource-url': { type: 'string' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Validate required options - throws if missing
  requireOption(
    values.schema,
    'schema',
    'prisma export',
    'ice prisma export --schema ./schema.ts --output ./schema.prisma'
  );

  const schemaPath = values.schema;
  const outputPath = typeof values.output === 'string' ? values.output : undefined;
  const providerInput = typeof values.provider === 'string' ? values.provider : 'postgresql';
  const datasourceUrl = typeof values['datasource-url'] === 'string' ? values['datasource-url'] : undefined;
  const quiet = values.quiet === true;
  const verbose = values.verbose === true;

  // Validate provider
  if (!isValidProvider(providerInput)) {
    throw new Error(
      `Invalid provider '${providerInput}'. Valid providers are: ${VALID_PROVIDERS.join(', ')}`
    );
  }
  const provider: PrismaProvider = providerInput;

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

  logger.info(`Exporting Prisma schema from: ${schemaPath}`);
  logger.debug('Options:', {
    provider,
    datasourceUrl: datasourceUrl || 'DATABASE_URL',
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

  // Generate Prisma schema for all loaded schemas
  const schemas = loadResult.schemas.map((s) => s.schema);

  for (const { name } of loadResult.schemas) {
    logger.debug(`Processing schema: ${name}`);
  }

  // Build export options
  const exportOptions: PrismaExportOptions = {
    provider,
  };

  // Set custom datasource URL if provided
  if (datasourceUrl) {
    exportOptions.databaseUrl = `env("${datasourceUrl}")`;
  }

  const prismaSchema = generatePrismaSchema(schemas, exportOptions);

  // Output Prisma schema
  if (outputPath) {
    try {
      writeFileSync(outputPath, prismaSchema);
      logger.success(`Exported Prisma schema: ${outputPath}`);
      logger.info(`Generated ${loadResult.schemas.length} model(s)`);
    } catch (writeError) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      throw new Error(
        `Failed to write output file '${outputPath}': ${message}\n` +
        'Check that the directory exists and you have write permissions.'
      );
    }
  } else {
    // Output to stdout
    console.log(prismaSchema);
  }
}
