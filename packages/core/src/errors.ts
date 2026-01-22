/**
 * IceType Error Classes
 *
 * Standardized error handling for the IceType ecosystem.
 * All errors extend from IceTypeError for consistent error handling.
 *
 * Type Guard Pattern Notes:
 * - Error type guards use `instanceof` checks (appropriate for class hierarchies)
 * - For structural type guards with WeakMap caching (document validation, etc.),
 *   see @db4/core's type-guards.ts which provides shared, optimized guards
 *   that can be used by both db4 and icetype codebases.
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
    if (options.context !== undefined) {
      this.context = options.context;
    }

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
    if (options.path !== undefined) {
      this.path = options.path;
    }
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

    const context: Record<string, unknown> = {
      ...options.context,
      line,
      column,
    };
    if (path !== undefined) {
      context.path = path;
    }
    super(fullMessage, {
      ...options,
      code: options.code ?? ErrorCodes.PARSE_ERROR,
      context,
    });
    this.name = 'ParseError';
    this.line = line;
    this.column = column;
    if (path !== undefined) {
      this.path = path;
    }

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

    const context: Record<string, unknown> = {
      ...options.context,
    };
    if (adapterName !== undefined) {
      context.adapterName = adapterName;
    }
    if (operation !== undefined) {
      context.operation = operation;
    }
    super(`${prefix}${message}`, {
      ...options,
      code: options.code ?? ErrorCodes.ADAPTER_ERROR,
      context,
    });
    this.name = 'AdapterError';
    if (adapterName !== undefined) {
      this.adapterName = adapterName;
    }
    if (operation !== undefined) {
      this.operation = operation;
    }

    Object.setPrototypeOf(this, AdapterError.prototype);
  }
}

// =============================================================================
// Schema Load Error
// =============================================================================

/**
 * Documentation links for common schema loading errors.
 */
export const SchemaLoadErrorDocs = {
  /** Link to module resolution troubleshooting */
  MODULE_RESOLUTION: 'https://icetype.dev/docs/troubleshooting/module-resolution',
  /** Link to tsconfig path aliases setup */
  PATH_ALIASES: 'https://icetype.dev/docs/guides/path-aliases',
  /** Link to supported file types documentation */
  FILE_TYPES: 'https://icetype.dev/docs/guides/schema-files',
  /** Link to schema export format documentation */
  SCHEMA_FORMAT: 'https://icetype.dev/docs/guides/schema-format',
  /** Link to syntax error debugging guide */
  SYNTAX_ERRORS: 'https://icetype.dev/docs/troubleshooting/syntax-errors',
  /** Link to JSON schema format documentation */
  JSON_FORMAT: 'https://icetype.dev/docs/guides/json-schemas',
} as const;

/**
 * Suggestion for fixing a schema load error.
 */
export interface SchemaLoadSuggestion {
  /** Short description of the suggestion */
  message: string;
  /** Optional command to run */
  command?: string;
  /** Link to relevant documentation */
  docLink?: string;
}

/**
 * Structured context for schema load errors.
 */
export interface SchemaLoadErrorContext {
  /** The type of error encountered */
  errorType: 'file_not_found' | 'unsupported_extension' | 'module_load' | 'syntax_error' |
             'import_error' | 'runtime_error' | 'no_schemas_found' | 'json_parse' | 'unknown';
  /** File path that caused the error */
  filePath?: string;
  /** File extension */
  extension?: string;
  /** Line number where error occurred (if available) */
  line?: number;
  /** Column number where error occurred (if available) */
  column?: number;
  /** Missing module name (for import errors) */
  missingModule?: string;
  /** Whether the error is from a path alias */
  isPathAlias?: boolean;
  /** Suggestions for fixing the error */
  suggestions?: SchemaLoadSuggestion[];
  /** Link to relevant documentation */
  docLink?: string;
  /** Additional data specific to the error type */
  [key: string]: unknown;
}

/**
 * Options for SchemaLoadError.
 */
export interface SchemaLoadErrorOptions extends IceTypeErrorOptions {
  /** Path to the file that failed to load */
  filePath?: string;
  /** File extension if relevant */
  extension?: string;
  /** Structured error context */
  errorContext?: SchemaLoadErrorContext;
}

/**
 * Error thrown when schema loading fails.
 *
 * Provides structured error context for programmatic error handling:
 * - Error type classification
 * - Location information (file, line, column)
 * - Actionable suggestions
 * - Documentation links
 *
 * @example
 * ```typescript
 * // Basic usage
 * throw new SchemaLoadError('File not found', {
 *   filePath: './schema.ts',
 *   code: ErrorCodes.FILE_NOT_FOUND,
 * });
 *
 * // With structured context
 * throw new SchemaLoadError('Module not found', {
 *   filePath: './schema.ts',
 *   code: ErrorCodes.MODULE_LOAD_ERROR,
 *   errorContext: {
 *     errorType: 'import_error',
 *     missingModule: '@myapp/shared',
 *     isPathAlias: true,
 *     suggestions: [
 *       { message: 'Check your tsconfig.json paths configuration', docLink: SchemaLoadErrorDocs.PATH_ALIASES },
 *     ],
 *     docLink: SchemaLoadErrorDocs.MODULE_RESOLUTION,
 *   },
 * });
 * ```
 */
export class SchemaLoadError extends IceTypeError {
  /** Path to the file that failed to load */
  public readonly filePath?: string;
  /** File extension if relevant */
  public readonly extension?: string;
  /** Structured error context */
  public readonly errorContext?: SchemaLoadErrorContext;

  constructor(message: string, options: SchemaLoadErrorOptions = {}) {
    const { filePath, extension, errorContext } = options;

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
        errorContext,
      },
    });
    this.name = 'SchemaLoadError';
    if (filePath !== undefined) {
      this.filePath = filePath;
    }
    if (extension !== undefined) {
      this.extension = extension;
    }
    if (errorContext !== undefined) {
      this.errorContext = errorContext;
    }

    Object.setPrototypeOf(this, SchemaLoadError.prototype);
  }

  /**
   * Format error with structured context, including suggestions and documentation links.
   *
   * @returns Formatted error string with suggestions and documentation links
   */
  override format(): string {
    let output = super.format();

    if (this.errorContext) {
      const { suggestions, docLink, line, column } = this.errorContext;

      // Add location info if available
      if (line !== undefined && column !== undefined) {
        output += `\n  Location: line ${line}, column ${column}`;
      } else if (line !== undefined) {
        output += `\n  Location: line ${line}`;
      }

      // Add suggestions
      if (suggestions && suggestions.length > 0) {
        output += '\n\n  Suggestions:';
        for (const suggestion of suggestions) {
          output += `\n    - ${suggestion.message}`;
          if (suggestion.command) {
            output += `\n      Run: ${suggestion.command}`;
          }
          if (suggestion.docLink) {
            output += `\n      See: ${suggestion.docLink}`;
          }
        }
      }

      // Add documentation link
      if (docLink) {
        output += `\n\n  Documentation: ${docLink}`;
      }
    }

    return output;
  }

  /**
   * Get suggestions for fixing this error.
   *
   * @returns Array of suggestions, or empty array if none
   */
  getSuggestions(): SchemaLoadSuggestion[] {
    return this.errorContext?.suggestions ?? [];
  }

  /**
   * Get documentation link for this error.
   *
   * @returns Documentation URL or undefined
   */
  getDocLink(): string | undefined {
    return this.errorContext?.docLink;
  }

  /**
   * Check if this error has location information.
   *
   * @returns True if line number is available
   */
  hasLocation(): boolean {
    return this.errorContext?.line !== undefined;
  }

  /**
   * Get the location in file:line:column format for editor navigation.
   *
   * @returns Location string or undefined if not available
   */
  getLocationString(): string | undefined {
    if (!this.errorContext?.line) return undefined;
    const { line, column } = this.errorContext;
    if (this.filePath) {
      return column !== undefined
        ? `${this.filePath}:${line}:${column}`
        : `${this.filePath}:${line}`;
    }
    return column !== undefined ? `line ${line}, column ${column}` : `line ${line}`;
  }

  /**
   * Convert error to a plain object for serialization.
   * Includes errorContext for structured error handling.
   */
  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      filePath: this.filePath,
      extension: this.extension,
      errorContext: this.errorContext,
    };
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

// =============================================================================
// Exhaustive Type Checking
// =============================================================================

/**
 * Helper function for exhaustive type checking in switch statements.
 *
 * Use this in the `default` case of a switch statement to ensure all
 * possible values of a union type are handled. TypeScript will report
 * a compile-time error if a case is missing.
 *
 * @param value - The value that should never reach this point
 * @returns Never returns; always throws
 * @throws Error with the unexpected value
 *
 * @example
 * ```typescript
 * type Status = 'active' | 'inactive' | 'pending';
 *
 * function handleStatus(status: Status): string {
 *   switch (status) {
 *     case 'active': return 'Active';
 *     case 'inactive': return 'Inactive';
 *     case 'pending': return 'Pending';
 *     default: return assertNever(status);
 *   }
 * }
 * ```
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
