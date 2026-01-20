/**
 * IceType Error Classes
 *
 * Standardized error handling for the IceType ecosystem.
 * All errors extend from IceTypeError for consistent error handling.
 *
 * @packageDocumentation
 */

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Error codes for IceType errors.
 * These codes allow programmatic error handling.
 */
export const ErrorCodes = {
  // Parse errors (1xxx)
  PARSE_ERROR: 'ICETYPE_1000',
  EMPTY_TYPE: 'ICETYPE_1001',
  INVALID_MODIFIER_POSITION: 'ICETYPE_1002',
  UNKNOWN_TYPE: 'ICETYPE_1003',
  UNKNOWN_GENERIC_TYPE: 'ICETYPE_1004',
  UNKNOWN_PARAMETRIC_TYPE: 'ICETYPE_1005',
  INVALID_MAP_PARAMS: 'ICETYPE_1006',
  INVALID_PARAM_VALUE: 'ICETYPE_1007',
  EMPTY_RELATION: 'ICETYPE_1008',
  MISSING_RELATION_OPERATOR: 'ICETYPE_1009',
  MISSING_TARGET_TYPE: 'ICETYPE_1010',

  // Schema validation errors (2xxx)
  SCHEMA_VALIDATION_ERROR: 'ICETYPE_2000',
  MISSING_SCHEMA_NAME: 'ICETYPE_2001',
  UNKNOWN_PARTITION_FIELD: 'ICETYPE_2002',
  UNKNOWN_INDEX_FIELD: 'ICETYPE_2003',
  UNKNOWN_FTS_FIELD: 'ICETYPE_2004',
  UNKNOWN_VECTOR_FIELD: 'ICETYPE_2005',
  INVALID_VECTOR_DIMENSIONS: 'ICETYPE_2006',
  CONFLICTING_MODIFIERS: 'ICETYPE_2007',

  // Adapter errors (3xxx)
  ADAPTER_ERROR: 'ICETYPE_3000',
  ADAPTER_ALREADY_REGISTERED: 'ICETYPE_3001',
  ADAPTER_NOT_FOUND: 'ICETYPE_3002',
  MISSING_ADAPTER_OPTION: 'ICETYPE_3003',
  INVALID_ADAPTER_CONFIG: 'ICETYPE_3004',

  // Schema loader errors (4xxx)
  SCHEMA_LOAD_ERROR: 'ICETYPE_4000',
  FILE_NOT_FOUND: 'ICETYPE_4001',
  UNSUPPORTED_FILE_TYPE: 'ICETYPE_4002',
  NO_SCHEMAS_FOUND: 'ICETYPE_4003',
  MODULE_LOAD_ERROR: 'ICETYPE_4004',
  JSON_PARSE_ERROR: 'ICETYPE_4005',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// =============================================================================
// Base Error Class
// =============================================================================

/**
 * Options for IceTypeError constructor.
 */
export interface IceTypeErrorOptions {
  /** Error code for programmatic handling */
  code?: string;
  /** Original error that caused this error */
  cause?: Error;
  /** Additional context about the error */
  context?: Record<string, unknown>;
}

/**
 * Base error class for all IceType errors.
 *
 * Provides consistent error formatting with:
 * - Error codes for programmatic handling
 * - Cause chaining for debugging
 * - Context for additional information
 *
 * @example
 * ```typescript
 * throw new IceTypeError('Something went wrong', {
 *   code: 'ICETYPE_1000',
 *   context: { field: 'email', value: 'invalid' },
 * });
 * ```
 */
export class IceTypeError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;
  /** Additional context about the error */
  public readonly context?: Record<string, unknown>;

  constructor(message: string, options: IceTypeErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'IceTypeError';
    this.code = options.code ?? 'ICETYPE_0000';
    this.context = options.context;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, IceTypeError.prototype);
  }

  /**
   * Format the error for display.
   *
   * @returns Formatted error string with code and context
   */
  format(): string {
    let output = `[${this.code}] ${this.message}`;

    if (this.context && Object.keys(this.context).length > 0) {
      output += '\n  Context:';
      for (const [key, value] of Object.entries(this.context)) {
        output += `\n    ${key}: ${JSON.stringify(value)}`;
      }
    }

    if (this.cause instanceof Error) {
      output += `\n  Caused by: ${this.cause.message}`;
    }

    return output;
  }

  /**
   * Convert error to a plain object for serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    };
  }
}

// =============================================================================
// Schema Validation Error
// =============================================================================

/**
 * Options for SchemaValidationError.
 */
export interface SchemaValidationErrorOptions extends IceTypeErrorOptions {
  /** Path to the invalid field or directive */
  path?: string;
  /** The invalid value that caused the error */
  value?: unknown;
}

/**
 * Error thrown when schema validation fails.
 *
 * @example
 * ```typescript
 * throw new SchemaValidationError('Unknown field type', {
 *   path: 'user.email',
 *   value: 'invalidType',
 *   code: ErrorCodes.UNKNOWN_TYPE,
 * });
 * ```
 */
export class SchemaValidationError extends IceTypeError {
  /** Path to the invalid field or directive */
  public readonly path?: string;
  /** The invalid value that caused the error */
  public readonly value?: unknown;

  constructor(message: string, options: SchemaValidationErrorOptions = {}) {
    const fullMessage = options.path ? `${options.path}: ${message}` : message;
    super(fullMessage, {
      ...options,
      code: options.code ?? ErrorCodes.SCHEMA_VALIDATION_ERROR,
    });
    this.name = 'SchemaValidationError';
    this.path = options.path;
    this.value = options.value;

    Object.setPrototypeOf(this, SchemaValidationError.prototype);
  }
}

// =============================================================================
// Parse Error
// =============================================================================

/**
 * Options for ParseError.
 */
export interface ParseErrorOptions extends IceTypeErrorOptions {
  /** Line number where the error occurred (1-indexed) */
  line?: number;
  /** Column number where the error occurred (1-indexed) */
  column?: number;
  /** The field or path that caused the error */
  path?: string;
}

/**
 * Error thrown when parsing IceType schema syntax fails.
 *
 * Provides location information (line/column) for helpful error messages.
 *
 * @example
 * ```typescript
 * throw new ParseError('Unexpected token', {
 *   line: 10,
 *   column: 5,
 *   path: 'user.email',
 *   code: ErrorCodes.PARSE_ERROR,
 * });
 * ```
 */
export class ParseError extends IceTypeError {
  /** Line number where the error occurred (1-indexed) */
  public readonly line: number;
  /** Column number where the error occurred (1-indexed) */
  public readonly column: number;
  /** The field or path that caused the error */
  public readonly path?: string;

  constructor(message: string, options: ParseErrorOptions = {}) {
    const { line = 1, column = 1, path } = options;

    // Build a helpful error message with location info
    let fullMessage = message;
    if (path) {
      fullMessage = `${path}: ${message}`;
    }
    fullMessage = `Parse error at line ${line}, column ${column}: ${fullMessage}`;

    super(fullMessage, {
      ...options,
      code: options.code ?? ErrorCodes.PARSE_ERROR,
      context: {
        ...options.context,
        line,
        column,
        path,
      },
    });
    this.name = 'ParseError';
    this.line = line;
    this.column = column;
    this.path = path;

    Object.setPrototypeOf(this, ParseError.prototype);
  }

  /**
   * Format the error for display with source context.
   *
   * @param source - The original source string (optional)
   * @returns Formatted error message with source context
   */
  formatWithSource(source?: string): string {
    let output = this.message;

    if (source && this.line > 0) {
      const lines = source.split('\n');
      const lineIndex = this.line - 1;

      if (lineIndex >= 0 && lineIndex < lines.length) {
        const sourceLine = lines[lineIndex];
        const pointer = ' '.repeat(Math.max(0, this.column - 1)) + '^';

        output += '\n\n';
        output += `  ${this.line} | ${sourceLine}\n`;
        output += `    | ${pointer}`;
      }
    }

    return output;
  }
}

// =============================================================================
// Adapter Error
// =============================================================================

/**
 * Options for AdapterError.
 */
export interface AdapterErrorOptions extends IceTypeErrorOptions {
  /** Name of the adapter that caused the error */
  adapterName?: string;
  /** The operation that failed */
  operation?: string;
}

/**
 * Error thrown when adapter operations fail.
 *
 * @example
 * ```typescript
 * throw new AdapterError('Missing required option: location', {
 *   adapterName: 'iceberg',
 *   operation: 'transform',
 *   code: ErrorCodes.MISSING_ADAPTER_OPTION,
 * });
 * ```
 */
export class AdapterError extends IceTypeError {
  /** Name of the adapter that caused the error */
  public readonly adapterName?: string;
  /** The operation that failed */
  public readonly operation?: string;

  constructor(message: string, options: AdapterErrorOptions = {}) {
    const { adapterName, operation } = options;

    let prefix = '';
    if (adapterName) {
      prefix = operation
        ? `Adapter '${adapterName}' ${operation} failed: `
        : `Adapter '${adapterName}': `;
    }

    super(`${prefix}${message}`, {
      ...options,
      code: options.code ?? ErrorCodes.ADAPTER_ERROR,
      context: {
        ...options.context,
        adapterName,
        operation,
      },
    });
    this.name = 'AdapterError';
    this.adapterName = adapterName;
    this.operation = operation;

    Object.setPrototypeOf(this, AdapterError.prototype);
  }
}

// =============================================================================
// Schema Load Error
// =============================================================================

/**
 * Options for SchemaLoadError.
 */
export interface SchemaLoadErrorOptions extends IceTypeErrorOptions {
  /** Path to the file that failed to load */
  filePath?: string;
  /** File extension if relevant */
  extension?: string;
}

/**
 * Error thrown when schema loading fails.
 *
 * @example
 * ```typescript
 * throw new SchemaLoadError('File not found', {
 *   filePath: './schema.ts',
 *   code: ErrorCodes.FILE_NOT_FOUND,
 * });
 * ```
 */
export class SchemaLoadError extends IceTypeError {
  /** Path to the file that failed to load */
  public readonly filePath?: string;
  /** File extension if relevant */
  public readonly extension?: string;

  constructor(message: string, options: SchemaLoadErrorOptions = {}) {
    const { filePath, extension } = options;

    let fullMessage = message;
    if (filePath) {
      fullMessage = `${filePath}: ${message}`;
    }

    super(fullMessage, {
      ...options,
      code: options.code ?? ErrorCodes.SCHEMA_LOAD_ERROR,
      context: {
        ...options.context,
        filePath,
        extension,
      },
    });
    this.name = 'SchemaLoadError';
    this.filePath = filePath;
    this.extension = extension;

    Object.setPrototypeOf(this, SchemaLoadError.prototype);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Type guard to check if an error is an IceTypeError.
 *
 * @param error - The error to check
 * @returns True if the error is an IceTypeError
 */
export function isIceTypeError(error: unknown): error is IceTypeError {
  return error instanceof IceTypeError;
}

/**
 * Type guard to check if an error is a ParseError.
 *
 * @param error - The error to check
 * @returns True if the error is a ParseError
 */
export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError;
}

/**
 * Type guard to check if an error is a SchemaValidationError.
 *
 * @param error - The error to check
 * @returns True if the error is a SchemaValidationError
 */
export function isSchemaValidationError(error: unknown): error is SchemaValidationError {
  return error instanceof SchemaValidationError;
}

/**
 * Type guard to check if an error is an AdapterError.
 *
 * @param error - The error to check
 * @returns True if the error is an AdapterError
 */
export function isAdapterError(error: unknown): error is AdapterError {
  return error instanceof AdapterError;
}

/**
 * Type guard to check if an error is a SchemaLoadError.
 *
 * @param error - The error to check
 * @returns True if the error is a SchemaLoadError
 */
export function isSchemaLoadError(error: unknown): error is SchemaLoadError {
  return error instanceof SchemaLoadError;
}

/**
 * Get a user-friendly error message from any error.
 *
 * @param error - The error to format
 * @returns A user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isIceTypeError(error)) {
    return error.format();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
