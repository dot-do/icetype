/**
 * Error Classes Tests for @icetype/core
 *
 * Tests for the standardized error handling system.
 */

import { describe, it, expect } from 'vitest';
import {
  IceTypeError,
  ParseError,
  SchemaValidationError,
  AdapterError,
  SchemaLoadError,
  ErrorCodes,
  isIceTypeError,
  isParseError,
  isSchemaValidationError,
  isAdapterError,
  isSchemaLoadError,
  getErrorMessage,
  assertNever,
} from '../errors.js';

// =============================================================================
// IceTypeError Tests
// =============================================================================

describe('IceTypeError', () => {
  it('should create error with message', () => {
    const error = new IceTypeError('Something went wrong');
    expect(error.message).toBe('Something went wrong');
    expect(error.name).toBe('IceTypeError');
    expect(error.code).toBe('ICETYPE_0000');
  });

  it('should create error with code', () => {
    const error = new IceTypeError('Test error', {
      code: ErrorCodes.PARSE_ERROR,
    });
    expect(error.code).toBe(ErrorCodes.PARSE_ERROR);
  });

  it('should create error with context', () => {
    const error = new IceTypeError('Test error', {
      context: { field: 'email', value: 'invalid' },
    });
    expect(error.context).toEqual({ field: 'email', value: 'invalid' });
  });

  it('should create error with cause', () => {
    const cause = new Error('Original error');
    const error = new IceTypeError('Wrapper error', { cause });
    expect(error.cause).toBe(cause);
  });

  it('should be an instance of Error', () => {
    const error = new IceTypeError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(IceTypeError);
  });

  describe('format()', () => {
    it('should format error with code', () => {
      const error = new IceTypeError('Test error', {
        code: ErrorCodes.PARSE_ERROR,
      });
      expect(error.format()).toContain('[ICETYPE_1000]');
      expect(error.format()).toContain('Test error');
    });

    it('should format error with context', () => {
      const error = new IceTypeError('Test error', {
        context: { field: 'email' },
      });
      const formatted = error.format();
      expect(formatted).toContain('Context:');
      expect(formatted).toContain('field');
      expect(formatted).toContain('email');
    });

    it('should format error with cause', () => {
      const cause = new Error('Root cause');
      const error = new IceTypeError('Wrapper', { cause });
      expect(error.format()).toContain('Caused by: Root cause');
    });
  });

  describe('toJSON()', () => {
    it('should serialize error to JSON', () => {
      const error = new IceTypeError('Test error', {
        code: ErrorCodes.PARSE_ERROR,
        context: { field: 'test' },
      });
      const json = error.toJSON();
      expect(json.name).toBe('IceTypeError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe(ErrorCodes.PARSE_ERROR);
      expect(json.context).toEqual({ field: 'test' });
    });
  });
});

// =============================================================================
// ParseError Tests
// =============================================================================

describe('ParseError', () => {
  it('should create parse error with location', () => {
    const error = new ParseError('Unexpected token', {
      line: 10,
      column: 5,
    });
    expect(error.line).toBe(10);
    expect(error.column).toBe(5);
    expect(error.name).toBe('ParseError');
    expect(error.message).toContain('line 10');
    expect(error.message).toContain('column 5');
  });

  it('should default to line 1, column 1', () => {
    const error = new ParseError('Syntax error');
    expect(error.line).toBe(1);
    expect(error.column).toBe(1);
  });

  it('should include path in message', () => {
    const error = new ParseError('Invalid type', {
      path: 'user.email',
      line: 5,
      column: 10,
    });
    expect(error.path).toBe('user.email');
    expect(error.message).toContain('user.email');
  });

  it('should extend IceTypeError', () => {
    const error = new ParseError('Test');
    expect(error).toBeInstanceOf(IceTypeError);
    expect(error).toBeInstanceOf(ParseError);
  });

  it('should use PARSE_ERROR code by default', () => {
    const error = new ParseError('Test');
    expect(error.code).toBe(ErrorCodes.PARSE_ERROR);
  });

  describe('formatWithSource()', () => {
    it('should format error with source context', () => {
      const source = 'line one\nline two\nline three';
      const error = new ParseError('Error on line 2', {
        line: 2,
        column: 5,
      });
      const formatted = error.formatWithSource(source);
      expect(formatted).toContain('line two');
      expect(formatted).toContain('^');
    });

    it('should handle missing source', () => {
      const error = new ParseError('Test', { line: 1, column: 1 });
      const formatted = error.formatWithSource();
      expect(formatted).toBe(error.message);
    });
  });
});

// =============================================================================
// SchemaValidationError Tests
// =============================================================================

describe('SchemaValidationError', () => {
  it('should create validation error with path', () => {
    const error = new SchemaValidationError('Unknown type', {
      path: 'user.status',
    });
    expect(error.path).toBe('user.status');
    expect(error.message).toContain('user.status');
  });

  it('should include value in error', () => {
    const error = new SchemaValidationError('Invalid value', {
      path: 'user.age',
      value: -5,
    });
    expect(error.value).toBe(-5);
  });

  it('should use SCHEMA_VALIDATION_ERROR code by default', () => {
    const error = new SchemaValidationError('Test');
    expect(error.code).toBe(ErrorCodes.SCHEMA_VALIDATION_ERROR);
  });

  it('should extend IceTypeError', () => {
    const error = new SchemaValidationError('Test');
    expect(error).toBeInstanceOf(IceTypeError);
  });
});

// =============================================================================
// AdapterError Tests
// =============================================================================

describe('AdapterError', () => {
  it('should create adapter error with adapter name', () => {
    const error = new AdapterError('Transform failed', {
      adapterName: 'iceberg',
    });
    expect(error.adapterName).toBe('iceberg');
    expect(error.message).toContain('iceberg');
  });

  it('should include operation in message', () => {
    const error = new AdapterError('Missing option', {
      adapterName: 'iceberg',
      operation: 'transform',
    });
    expect(error.operation).toBe('transform');
    expect(error.message).toContain('transform');
    expect(error.message).toContain('failed');
  });

  it('should use ADAPTER_ERROR code by default', () => {
    const error = new AdapterError('Test');
    expect(error.code).toBe(ErrorCodes.ADAPTER_ERROR);
  });

  it('should extend IceTypeError', () => {
    const error = new AdapterError('Test');
    expect(error).toBeInstanceOf(IceTypeError);
  });
});

// =============================================================================
// SchemaLoadError Tests
// =============================================================================

describe('SchemaLoadError', () => {
  it('should create load error with file path', () => {
    const error = new SchemaLoadError('File not found', {
      filePath: './schema.ts',
    });
    expect(error.filePath).toBe('./schema.ts');
    expect(error.message).toContain('./schema.ts');
  });

  it('should include extension', () => {
    const error = new SchemaLoadError('Unsupported file type', {
      filePath: './schema.yaml',
      extension: '.yaml',
    });
    expect(error.extension).toBe('.yaml');
  });

  it('should use SCHEMA_LOAD_ERROR code by default', () => {
    const error = new SchemaLoadError('Test');
    expect(error.code).toBe(ErrorCodes.SCHEMA_LOAD_ERROR);
  });

  it('should extend IceTypeError', () => {
    const error = new SchemaLoadError('Test');
    expect(error).toBeInstanceOf(IceTypeError);
  });

  describe('structured error context', () => {
    it('should store errorContext', () => {
      const error = new SchemaLoadError('Module not found', {
        filePath: './schema.ts',
        errorContext: {
          errorType: 'import_error',
          missingModule: '@myapp/shared',
          isPathAlias: true,
          suggestions: [
            { message: 'Check your tsconfig.json paths configuration' },
          ],
          docLink: 'https://icetype.dev/docs/troubleshooting/module-resolution',
        },
      });
      expect(error.errorContext).toBeDefined();
      expect(error.errorContext?.errorType).toBe('import_error');
      expect(error.errorContext?.missingModule).toBe('@myapp/shared');
      expect(error.errorContext?.isPathAlias).toBe(true);
    });

    it('should return suggestions via getSuggestions()', () => {
      const error = new SchemaLoadError('Test', {
        errorContext: {
          errorType: 'syntax_error',
          suggestions: [
            { message: 'Check for missing commas' },
            { message: 'Check for missing brackets', command: 'npm run lint' },
          ],
        },
      });
      const suggestions = error.getSuggestions();
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].message).toBe('Check for missing commas');
      expect(suggestions[1].command).toBe('npm run lint');
    });

    it('should return empty array from getSuggestions() when no errorContext', () => {
      const error = new SchemaLoadError('Test');
      expect(error.getSuggestions()).toEqual([]);
    });

    it('should return docLink via getDocLink()', () => {
      const error = new SchemaLoadError('Test', {
        errorContext: {
          errorType: 'file_not_found',
          docLink: 'https://icetype.dev/docs/guides/schema-files',
        },
      });
      expect(error.getDocLink()).toBe('https://icetype.dev/docs/guides/schema-files');
    });

    it('should return undefined from getDocLink() when no docLink', () => {
      const error = new SchemaLoadError('Test');
      expect(error.getDocLink()).toBeUndefined();
    });

    it('should detect location via hasLocation()', () => {
      const errorWithLocation = new SchemaLoadError('Test', {
        errorContext: {
          errorType: 'syntax_error',
          line: 10,
          column: 5,
        },
      });
      const errorWithoutLocation = new SchemaLoadError('Test');

      expect(errorWithLocation.hasLocation()).toBe(true);
      expect(errorWithoutLocation.hasLocation()).toBe(false);
    });

    it('should format location string via getLocationString()', () => {
      const error = new SchemaLoadError('Test', {
        filePath: '/path/to/schema.ts',
        errorContext: {
          errorType: 'syntax_error',
          line: 10,
          column: 5,
        },
      });
      expect(error.getLocationString()).toBe('/path/to/schema.ts:10:5');
    });

    it('should format location without column', () => {
      const error = new SchemaLoadError('Test', {
        filePath: '/path/to/schema.ts',
        errorContext: {
          errorType: 'syntax_error',
          line: 10,
        },
      });
      expect(error.getLocationString()).toBe('/path/to/schema.ts:10');
    });

    it('should return undefined from getLocationString() without line', () => {
      const error = new SchemaLoadError('Test');
      expect(error.getLocationString()).toBeUndefined();
    });

    it('should include suggestions in format()', () => {
      const error = new SchemaLoadError('Test error', {
        errorContext: {
          errorType: 'import_error',
          suggestions: [
            { message: 'Install the package', command: 'npm install foo' },
            { message: 'Check documentation', docLink: 'https://example.com' },
          ],
          docLink: 'https://icetype.dev/docs/main',
        },
      });
      const formatted = error.format();
      expect(formatted).toContain('Suggestions:');
      expect(formatted).toContain('Install the package');
      expect(formatted).toContain('npm install foo');
      expect(formatted).toContain('Check documentation');
      expect(formatted).toContain('https://example.com');
      expect(formatted).toContain('Documentation: https://icetype.dev/docs/main');
    });

    it('should include location in format()', () => {
      const error = new SchemaLoadError('Test error', {
        errorContext: {
          errorType: 'syntax_error',
          line: 10,
          column: 5,
        },
      });
      const formatted = error.format();
      expect(formatted).toContain('Location: line 10, column 5');
    });

    it('should include errorContext in toJSON()', () => {
      const error = new SchemaLoadError('Test', {
        filePath: './schema.ts',
        extension: '.ts',
        errorContext: {
          errorType: 'module_load',
          line: 5,
        },
      });
      const json = error.toJSON();
      expect(json.filePath).toBe('./schema.ts');
      expect(json.extension).toBe('.ts');
      expect(json.errorContext).toEqual({
        errorType: 'module_load',
        line: 5,
      });
    });
  });
});

// =============================================================================
// Type Guard Tests
// =============================================================================

describe('Type Guards', () => {
  describe('isIceTypeError', () => {
    it('should return true for IceTypeError', () => {
      expect(isIceTypeError(new IceTypeError('test'))).toBe(true);
    });

    it('should return true for subclasses', () => {
      expect(isIceTypeError(new ParseError('test'))).toBe(true);
      expect(isIceTypeError(new SchemaValidationError('test'))).toBe(true);
      expect(isIceTypeError(new AdapterError('test'))).toBe(true);
      expect(isIceTypeError(new SchemaLoadError('test'))).toBe(true);
    });

    it('should return false for regular Error', () => {
      expect(isIceTypeError(new Error('test'))).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isIceTypeError('string')).toBe(false);
      expect(isIceTypeError(null)).toBe(false);
      expect(isIceTypeError(undefined)).toBe(false);
    });
  });

  describe('isParseError', () => {
    it('should return true for ParseError', () => {
      expect(isParseError(new ParseError('test'))).toBe(true);
    });

    it('should return false for other IceTypeErrors', () => {
      expect(isParseError(new SchemaValidationError('test'))).toBe(false);
      expect(isParseError(new AdapterError('test'))).toBe(false);
    });
  });

  describe('isSchemaValidationError', () => {
    it('should return true for SchemaValidationError', () => {
      expect(isSchemaValidationError(new SchemaValidationError('test'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isSchemaValidationError(new ParseError('test'))).toBe(false);
    });
  });

  describe('isAdapterError', () => {
    it('should return true for AdapterError', () => {
      expect(isAdapterError(new AdapterError('test'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isAdapterError(new ParseError('test'))).toBe(false);
    });
  });

  describe('isSchemaLoadError', () => {
    it('should return true for SchemaLoadError', () => {
      expect(isSchemaLoadError(new SchemaLoadError('test'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isSchemaLoadError(new ParseError('test'))).toBe(false);
    });
  });
});

// =============================================================================
// getErrorMessage Tests
// =============================================================================

describe('getErrorMessage', () => {
  it('should format IceTypeError', () => {
    const error = new IceTypeError('Test', { code: ErrorCodes.PARSE_ERROR });
    expect(getErrorMessage(error)).toContain('[ICETYPE_1000]');
  });

  it('should handle regular Error', () => {
    const error = new Error('Regular error');
    expect(getErrorMessage(error)).toBe('Regular error');
  });

  it('should handle string', () => {
    expect(getErrorMessage('string error')).toBe('string error');
  });

  it('should handle null/undefined', () => {
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
  });
});

// =============================================================================
// ErrorCodes Tests
// =============================================================================

describe('ErrorCodes', () => {
  it('should have parse error codes starting with ICETYPE_1', () => {
    expect(ErrorCodes.PARSE_ERROR).toMatch(/^ICETYPE_1/);
    expect(ErrorCodes.EMPTY_TYPE).toMatch(/^ICETYPE_1/);
    expect(ErrorCodes.UNKNOWN_TYPE).toMatch(/^ICETYPE_1/);
  });

  it('should have schema validation codes starting with ICETYPE_2', () => {
    expect(ErrorCodes.SCHEMA_VALIDATION_ERROR).toMatch(/^ICETYPE_2/);
    expect(ErrorCodes.UNKNOWN_PARTITION_FIELD).toMatch(/^ICETYPE_2/);
  });

  it('should have adapter error codes starting with ICETYPE_3', () => {
    expect(ErrorCodes.ADAPTER_ERROR).toMatch(/^ICETYPE_3/);
    expect(ErrorCodes.ADAPTER_ALREADY_REGISTERED).toMatch(/^ICETYPE_3/);
  });

  it('should have schema load codes starting with ICETYPE_4', () => {
    expect(ErrorCodes.SCHEMA_LOAD_ERROR).toMatch(/^ICETYPE_4/);
    expect(ErrorCodes.FILE_NOT_FOUND).toMatch(/^ICETYPE_4/);
  });
});

// =============================================================================
// assertNever Tests
// =============================================================================

describe('assertNever', () => {
  it('should throw error with unexpected value', () => {
    // Use type assertion to test runtime behavior
    const unexpectedValue = 'unexpected' as never;
    expect(() => assertNever(unexpectedValue)).toThrow('Unexpected value: unexpected');
  });

  it('should include the value in the error message', () => {
    const unexpectedValue = 42 as never;
    expect(() => assertNever(unexpectedValue)).toThrow('Unexpected value: 42');
  });

  it('should work in exhaustive switch statements', () => {
    type Status = 'active' | 'inactive';

    function handleStatus(status: Status): string {
      switch (status) {
        case 'active':
          return 'Active';
        case 'inactive':
          return 'Inactive';
        default:
          return assertNever(status);
      }
    }

    expect(handleStatus('active')).toBe('Active');
    expect(handleStatus('inactive')).toBe('Inactive');
  });

  it('should throw for unhandled cases at runtime', () => {
    type Color = 'red' | 'blue';

    function handleColor(color: Color): string {
      switch (color) {
        case 'red':
          return 'Red';
        // Intentionally not handling 'blue' to test runtime behavior
        default:
          return assertNever(color as never);
      }
    }

    expect(handleColor('red')).toBe('Red');
    expect(() => handleColor('blue')).toThrow('Unexpected value: blue');
  });
});
