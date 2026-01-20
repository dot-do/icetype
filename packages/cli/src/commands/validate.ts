/**
 * ice validate command
 *
 * Validates IceType schema syntax.
 */

import { parseArgs } from 'node:util';
import { validateSchema } from '@icetype/core';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { createLogger, LogLevel, type LoggerOptions } from '../utils/logger.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import {
  requireOption,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

const VALIDATE_HELP: HelpCommand = {
  name: 'validate',
  description: 'Validate IceType schema syntax',
  usage: 'ice validate --schema <file>',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'quiet', short: 'q', description: 'Suppress non-error output' },
    { name: 'verbose', short: 'v', description: 'Enable verbose/debug output' },
  ],
  examples: [
    'ice validate --schema ./schema.ts',
    'ice validate -s ./schema.ts --verbose',
  ],
};

export interface ValidateOptions {
  /** Path to the schema file */
  schema?: string;
  /** Enable quiet mode (only show errors) */
  quiet?: boolean;
  /** Enable verbose/debug output */
  verbose?: boolean;
}

export async function validate(args: string[]) {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(VALIDATE_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Configure logger based on CLI flags
  const loggerOptions: LoggerOptions = {
    level: values.verbose ? LogLevel.DEBUG : LogLevel.INFO,
    quiet: values.quiet,
  };
  const logger = createLogger(loggerOptions);

  // Validate required options - throws if missing
  requireOption(values.schema, 'schema', 'validate', 'ice validate --schema ./schema.ts');

  // values.schema is guaranteed to be string after the check above
  const schemaPath = values.schema;
  logger.info(`Validating schema: ${schemaPath}`);

  // Load schemas from the file
  logger.debug('Loading schema file', { path: schemaPath });
  const loadResult = await loadSchemaFile(schemaPath);

  // Check for loading errors - throws if any
  checkSchemaLoadErrors(loadResult.errors, schemaPath);

  // Check that schemas exist - throws if none
  checkSchemasExist(loadResult.schemas, schemaPath);

  logger.info(`Found ${loadResult.schemas.length} schema(s)`);

  let hasErrors = false;

  // Validate each schema
  for (const { name, schema } of loadResult.schemas) {
    logger.debug(`Validating schema`, { name });
    const result = validateSchema(schema);

    if (result.valid) {
      logger.success(`${name} is valid`);

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          logger.warn(`[${warning.code}] ${warning.path}: ${warning.message}`, { schema: name });
        }
      }
    } else {
      hasErrors = true;
      logger.error(`${name} validation failed`);

      for (const error of result.errors) {
        logger.error(`[${error.code}] ${error.path}: ${error.message}`, { schema: name });
      }

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          logger.warn(`[${warning.code}] ${warning.path}: ${warning.message}`, { schema: name });
        }
      }
    }
  }

  if (hasErrors) {
    throw new Error('Schema validation failed');
  }

  logger.success('All schemas are valid');
}
