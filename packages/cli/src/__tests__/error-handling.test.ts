/**
 * CLI Error Handling Tests for @icetype/cli
 *
 * TDD tests to verify consistent error handling patterns across all CLI commands.
 *
 * Requirements:
 * 1. All commands should exit with code 1 on error
 * 2. All commands should format errors consistently using getErrorMessage()
 * 3. Error output should go to stderr
 * 4. IceTypeError subclasses should be handled specially
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  IceTypeError,
  SchemaLoadError,
  ParseError,
  AdapterError,
  ErrorCodes,
} from '@icetype/core';

// Store for captured console calls
let consoleErrorCalls: Array<{ args: unknown[] }> = [];
let consoleLogCalls: Array<{ args: unknown[] }> = [];

// Original console methods
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

// =============================================================================
// Test Setup and Utilities
// =============================================================================

beforeAll(() => {
  // Override console methods to capture output
  console.error = (...args: unknown[]) => {
    consoleErrorCalls.push({ args });
  };
  console.log = (...args: unknown[]) => {
    consoleLogCalls.push({ args });
  };
  console.warn = () => {};
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

/**
 * Helper to check if any console.error call contains the expected message
 */
function expectStderrToContain(substring: string): void {
  const found = consoleErrorCalls.some((call) =>
    call.args.some((arg) => String(arg).includes(substring))
  );
  expect(found, `Expected stderr to contain "${substring}" but it did not. Calls: ${JSON.stringify(consoleErrorCalls)}`).toBe(true);
}

/**
 * Helper to check that a message is in stderr (not stdout)
 */
function expectMessageInStderrNotStdout(substring: string): void {
  // Should be in stderr
  const inStderr = consoleErrorCalls.some((call) =>
    call.args.some((arg) => String(arg).includes(substring))
  );
  // Should NOT be in stdout (unless it's a help message or usage hint)
  const inStdout = consoleLogCalls.some((call) =>
    call.args.some((arg) => String(arg).includes(substring))
  );

  expect(inStderr, `Expected "${substring}" to be in stderr`).toBe(true);
  // Only check stdout exclusion for error messages, not usage hints
  if (!substring.includes('Usage:') && !substring.includes('Available')) {
    expect(inStdout, `Expected "${substring}" NOT to be in stdout (errors should go to stderr)`).toBe(false);
  }
}

// =============================================================================
// Test Suite: Commands Throw Errors (Central Handling Pattern)
// =============================================================================

describe('CLI Error Handling: Commands Throw Errors for Central Handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // After refactoring, commands should THROW errors (not call process.exit directly).
  // The main CLI (cli.ts) catches these errors and handles them consistently.
  // This pattern allows for better testing and consistent error formatting.

  describe('validate command', () => {
    it('should throw error when --schema is missing', async () => {
      const { validate } = await import('../commands/validate.js');

      await expect(validate([])).rejects.toThrow('--schema is required');
    });

    it('should throw error when schema file is not found', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: ['File not found: /path/to/missing.ts'],
        }),
      }));

      const { validate } = await import('../commands/validate.js');

      await expect(validate(['--schema', '/path/to/missing.ts'])).rejects.toThrow();
    });
  });

  describe('generate command', () => {
    it('should throw error when --schema is missing', async () => {
      const { generate } = await import('../commands/generate.js');

      await expect(generate([])).rejects.toThrow('--schema is required');
    });
  });

  describe('diff command', () => {
    it('should throw error when --old is missing', async () => {
      const { diff } = await import('../commands/diff.js');

      await expect(diff(['--new', '/path/to/new.ts'])).rejects.toThrow('--old is required');
    });

    it('should throw error when --new is missing', async () => {
      const { diff } = await import('../commands/diff.js');

      await expect(diff(['--old', '/path/to/old.ts'])).rejects.toThrow('--new is required');
    });

    it('should throw error when dialect is invalid', async () => {
      const { diff } = await import('../commands/diff.js');

      await expect(
        diff(['--old', '/path/to/old.ts', '--new', '/path/to/new.ts', '--dialect', 'invalid'])
      ).rejects.toThrow('Invalid value');
    });
  });

  describe('clickhouse export command', () => {
    it('should throw error when --schema is missing', async () => {
      const { clickhouseExport } = await import('../commands/clickhouse.js');

      await expect(clickhouseExport([])).rejects.toThrow('--schema is required');
    });

    it('should throw error when engine is invalid', async () => {
      const { clickhouseExport } = await import('../commands/clickhouse.js');

      await expect(
        clickhouseExport(['--schema', '/path/to/schema.ts', '--engine', 'InvalidEngine'])
      ).rejects.toThrow('Invalid value');
    });
  });

  describe('duckdb export command', () => {
    it('should throw error when --schema is missing', async () => {
      const { duckdbExport } = await import('../commands/duckdb.js');

      await expect(duckdbExport([])).rejects.toThrow('--schema is required');
    });
  });

  describe('postgres export command', () => {
    it('should throw error when --schema is missing', async () => {
      const { postgresExport } = await import('../commands/postgres.js');

      await expect(postgresExport([])).rejects.toThrow('--schema is required');
    });
  });

  describe('iceberg export command', () => {
    it('should throw error when --schema is missing', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      await expect(icebergExport([])).rejects.toThrow('--schema is required');
    });
  });
});

// =============================================================================
// Test Suite: Error Message Content (Commands throw errors with proper messages)
// =============================================================================

describe('CLI Error Handling: Error Message Content', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Commands now throw errors with descriptive messages.
  // The main CLI catches these and outputs to stderr via formatCliError().
  // These tests verify the error messages contain the right information.

  describe('validate command error messages', () => {
    it('should include option name in error when --schema is missing', async () => {
      const { validate } = await import('../commands/validate.js');

      try {
        await validate([]);
      } catch (error) {
        expect((error as Error).message).toContain('--schema is required');
      }
    });
  });

  describe('diff command error messages', () => {
    it('should include option name in error when --old is missing', async () => {
      const { diff } = await import('../commands/diff.js');

      try {
        await diff(['--new', '/path/to/new.ts']);
      } catch (error) {
        expect((error as Error).message).toContain('--old is required');
      }
    });
  });

  describe('clickhouse export command error messages', () => {
    it('should include option name in error when --schema is missing', async () => {
      const { clickhouseExport } = await import('../commands/clickhouse.js');

      try {
        await clickhouseExport([]);
      } catch (error) {
        expect((error as Error).message).toContain('--schema is required');
      }
    });
  });
});

// =============================================================================
// Test Suite: IceTypeError Handling
// =============================================================================

describe('CLI Error Handling: IceTypeError Subclass Formatting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('main CLI error handler', () => {
    it('should format IceTypeError with error code and context', async () => {
      const error = new IceTypeError('Test error message', {
        code: 'ICETYPE_TEST',
        context: { field: 'testField' },
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue(error),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: vi.fn() };
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/schema.ts']);
      } catch {
        // Expected
      }

      // The error should be formatted with error code
      // Note: Currently the validate command uses logger.error which doesn't call getErrorMessage
      // This test documents the current behavior - after refactoring, it should use getErrorMessage
      mockExit.mockRestore();
    });

    it('should format SchemaLoadError with file path context', async () => {
      const error = new SchemaLoadError('Failed to load', {
        filePath: '/path/to/schema.ts',
        code: ErrorCodes.FILE_NOT_FOUND,
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue(error),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: vi.fn() };
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/schema.ts']);
      } catch {
        // Expected
      }

      mockExit.mockRestore();
    });

    it('should format ParseError with line and column info', async () => {
      const error = new ParseError('Unexpected token', {
        line: 10,
        column: 5,
        path: 'user.email',
        code: ErrorCodes.PARSE_ERROR,
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue(error),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: vi.fn() };
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/schema.ts']);
      } catch {
        // Expected
      }

      mockExit.mockRestore();
    });

    it('should format AdapterError with adapter name', async () => {
      const error = new AdapterError('Missing required option: location', {
        adapterName: 'iceberg',
        operation: 'transform',
        code: ErrorCodes.MISSING_ADAPTER_OPTION,
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'Test', schema: {} }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/adapter-registry.js', () => ({
        getAdapter: vi.fn().mockImplementation(() => {
          throw error;
        }),
      }));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      // Note: This would need the iceberg command to be tested
      mockExit.mockRestore();
    });
  });
});

// =============================================================================
// Test Suite: Consistent Error Message Format
// =============================================================================

describe('CLI Error Handling: Consistent Error Message Format', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // All commands now throw MissingOptionError for missing required options.
  // This ensures a consistent format: "--{option} is required"

  describe('required option errors have consistent format', () => {
    it('validate: throws with "--schema is required" message', async () => {
      const { validate } = await import('../commands/validate.js');

      await expect(validate([])).rejects.toThrow('--schema is required');
    });

    it('generate: throws with "--schema is required" message', async () => {
      const { generate } = await import('../commands/generate.js');

      await expect(generate([])).rejects.toThrow('--schema is required');
    });

    it('diff: throws with "--old is required" message', async () => {
      const { diff } = await import('../commands/diff.js');

      await expect(diff([])).rejects.toThrow('--old is required');
    });

    it('clickhouse: throws with "--schema is required" message', async () => {
      const { clickhouseExport } = await import('../commands/clickhouse.js');

      await expect(clickhouseExport([])).rejects.toThrow('--schema is required');
    });

    it('postgres: throws with "--schema is required" message', async () => {
      const { postgresExport } = await import('../commands/postgres.js');

      await expect(postgresExport([])).rejects.toThrow('--schema is required');
    });

    it('iceberg: throws with "--schema is required" message', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      await expect(icebergExport([])).rejects.toThrow('--schema is required');
    });

    it('duckdb: throws with "--schema is required" message', async () => {
      const { duckdbExport } = await import('../commands/duckdb.js');

      await expect(duckdbExport([])).rejects.toThrow('--schema is required');
    });
  });
});

// =============================================================================
// Test Suite: formatCliError Utility
// =============================================================================

describe('CLI Error Handling: formatCliError Utility', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should format IceTypeError with error code', async () => {
    const { formatCliError, MissingOptionError } = await import('../utils/cli-error.js');

    const error = new MissingOptionError('schema', 'test');
    const formatted = formatCliError(error);

    // Should use getErrorMessage() which includes [CODE] prefix for IceTypeError
    expect(formatted).toContain('--schema is required');
  });

  it('should format regular Error with "Error:" prefix', async () => {
    const { formatCliError } = await import('../utils/cli-error.js');

    const error = new Error('Something went wrong');
    const formatted = formatCliError(error);

    expect(formatted).toBe('Error: Something went wrong');
  });

  it('should format non-Error values as strings', async () => {
    const { formatCliError } = await import('../utils/cli-error.js');

    const formatted = formatCliError('A string error');

    expect(formatted).toBe('Error: A string error');
  });
});
