/**
 * ice validate command
 *
 * Validates IceType schema syntax.
 */

import { parseArgs } from 'node:util';
import { validateSchema } from '@icetype/core';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { createLogger, LogLevel, type LoggerOptions } from '../utils/logger.js';

export interface ValidateOptions {
  /** Path to the schema file */
  schema?: string;
  /** Enable quiet mode (only show errors) */
  quiet?: boolean;
  /** Enable verbose/debug output */
  verbose?: boolean;
}

export async function validate(args: string[]) {
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

  if (!values.schema) {
    logger.error('--schema is required');
    logger.info('Usage: ice validate --schema ./schema.ts');
    process.exit(1);
  }

  // values.schema is guaranteed to be string after the check above
  const schemaPath = values.schema;
  logger.info(`Validating schema: ${schemaPath}`);

  try {
    // Load schemas from the file
    logger.debug('Loading schema file', { path: schemaPath });
    const loadResult = await loadSchemaFile(schemaPath);

    // Check for loading errors
    if (loadResult.errors.length > 0) {
      for (const error of loadResult.errors) {
        logger.error(error);
      }
      process.exit(1);
    }

    if (loadResult.schemas.length === 0) {
      logger.error('No schemas found in the file');
      process.exit(1);
    }

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
      process.exit(1);
    }

    logger.success('All schemas are valid');
  } catch (error) {
    logger.error('Error loading schema', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}
