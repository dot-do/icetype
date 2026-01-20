/**
 * CLI Error Handling Utilities
 *
 * Provides consistent error handling patterns for all CLI commands.
 *
 * Pattern:
 * - Commands should throw errors (not call process.exit directly)
 * - The main CLI catches errors and handles them with handleCliError()
 * - IceTypeError subclasses are formatted with their error codes
 * - All errors go to stderr with exit code 1
 */

import { isIceTypeError, getErrorMessage, IceTypeError, ErrorCodes } from '@icetype/core';
import { createLogger, LogLevel, type Logger } from './logger.js';

/**
 * Error thrown when a required CLI option is missing.
 */
export class MissingOptionError extends IceTypeError {
  public readonly optionName: string;
  public readonly command: string;

  constructor(optionName: string, command: string, usage?: string) {
    const message = usage
      ? `--${optionName} is required\nUsage: ${usage}`
      : `--${optionName} is required`;
    super(message, {
      code: 'ICETYPE_CLI_MISSING_OPTION',
      context: { optionName, command },
    });
    this.name = 'MissingOptionError';
    this.optionName = optionName;
    this.command = command;

    Object.setPrototypeOf(this, MissingOptionError.prototype);
  }
}

/**
 * Error thrown when a CLI option has an invalid value.
 */
export class InvalidOptionError extends IceTypeError {
  public readonly optionName: string;
  public readonly value: string;
  public readonly validValues?: string[];

  constructor(optionName: string, value: string, validValues?: string[]) {
    const validList = validValues ? `\nValid values: ${validValues.join(', ')}` : '';
    const message = `Invalid value '${value}' for --${optionName}${validList}`;
    super(message, {
      code: 'ICETYPE_CLI_INVALID_OPTION',
      context: { optionName, value, validValues },
    });
    this.name = 'InvalidOptionError';
    this.optionName = optionName;
    this.value = value;
    this.validValues = validValues;

    Object.setPrototypeOf(this, InvalidOptionError.prototype);
  }
}

/**
 * Error thrown when no schemas are found in a file.
 */
export class NoSchemasError extends IceTypeError {
  public readonly filePath: string;

  constructor(filePath: string) {
    super(`No schemas found in the file: ${filePath}`, {
      code: ErrorCodes.NO_SCHEMAS_FOUND,
      context: { filePath },
    });
    this.name = 'NoSchemasError';
    this.filePath = filePath;

    Object.setPrototypeOf(this, NoSchemasError.prototype);
  }
}

/**
 * Format an error for CLI output.
 *
 * Uses getErrorMessage() for IceTypeError subclasses to include
 * error codes and context. For other errors, extracts the message.
 *
 * @param error - The error to format
 * @returns Formatted error message
 */
export function formatCliError(error: unknown): string {
  if (isIceTypeError(error)) {
    return getErrorMessage(error);
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

/**
 * Handle a CLI error consistently.
 *
 * - Formats the error using formatCliError()
 * - Outputs to stderr
 * - Exits with code 1
 *
 * @param error - The error to handle
 * @param logger - Optional logger to use (defaults to error-only logger)
 */
export function handleCliError(error: unknown, logger?: Logger): never {
  const log = logger ?? createLogger({ level: LogLevel.ERROR });
  const message = formatCliError(error);
  log.error(message);
  process.exit(1);
}

/**
 * Assert that a required option is present.
 *
 * @param value - The option value
 * @param optionName - Name of the option (without --)
 * @param command - The command name
 * @param usage - Optional usage string
 * @throws MissingOptionError if the value is undefined or empty
 */
export function requireOption(
  value: string | undefined,
  optionName: string,
  command: string,
  usage?: string
): asserts value is string {
  if (!value) {
    throw new MissingOptionError(optionName, command, usage);
  }
}

/**
 * Validate an option value against a list of valid values.
 *
 * @param value - The option value
 * @param optionName - Name of the option
 * @param validValues - Array of valid values
 * @throws InvalidOptionError if the value is not in the valid list
 */
export function validateOptionValue<T extends string>(
  value: string,
  optionName: string,
  validValues: readonly T[]
): asserts value is T {
  if (!validValues.includes(value as T)) {
    throw new InvalidOptionError(optionName, value, [...validValues]);
  }
}

/**
 * Check for schema loading errors and throw if any.
 *
 * @param errors - Array of error messages from schema loading
 * @param schemaPath - Path to the schema file
 * @throws IceTypeError with combined error messages
 */
export function checkSchemaLoadErrors(errors: string[], schemaPath: string): void {
  if (errors.length > 0) {
    throw new IceTypeError(errors.join('\n'), {
      code: ErrorCodes.SCHEMA_LOAD_ERROR,
      context: { schemaPath, errorCount: errors.length },
    });
  }
}

/**
 * Check that schemas were found and throw if none.
 *
 * @param schemas - Array of loaded schemas
 * @param schemaPath - Path to the schema file
 * @throws NoSchemasError if no schemas were found
 */
export function checkSchemasExist(
  schemas: unknown[],
  schemaPath: string
): void {
  if (schemas.length === 0) {
    throw new NoSchemasError(schemaPath);
  }
}
