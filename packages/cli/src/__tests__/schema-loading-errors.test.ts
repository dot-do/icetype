/**
 * Schema Loading Errors Tests for @icetype/cli
 *
 * TDD tests for better error context in schema loading.
 * Tests verify that stack traces are preserved, file paths are included,
 * line numbers are reported when available, and various error types
 * provide clear debugging information.
 *
 * These tests are expected to FAIL because:
 * - Current implementation drops stack traces
 * - No verbose flag handling for errors
 * - Error context is incomplete
 *
 * Issue: icetype-eg2.4
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';
import { SchemaLoadError, ErrorCodes } from '@icetype/core';

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
 * Create a valid IceTypeSchema object for testing
 */
function createValidSchema(name: string = 'TestEntity'): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  fields.set('id', {
    name: 'id',
    type: 'uuid',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: true,
    isIndexed: false,
  });

  return {
    name,
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Get all error messages as strings
 */
function getErrorMessages(): string[] {
  return consoleErrorCalls.flatMap(call =>
    call.args.map(arg => String(arg))
  );
}

/**
 * Get all log messages as strings
 */
function getLogMessages(): string[] {
  return consoleLogCalls.flatMap(call =>
    call.args.map(arg => String(arg))
  );
}

/**
 * Check if any output (error or log) contains the expected string
 */
function outputContains(substring: string): boolean {
  const allOutput = [...getErrorMessages(), ...getLogMessages()];
  return allOutput.some(msg => msg.includes(substring));
}

// =============================================================================
// Stack Trace Preservation Tests
// =============================================================================

describe('Schema Loading Errors: Stack Trace Preservation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('--verbose flag shows stack traces', () => {
    it('should show stack trace when --verbose flag is provided and schema load fails', async () => {
      // Create an error with a stack trace
      const originalError = new Error('Cannot find module "missing-module"');
      originalError.stack = `Error: Cannot find module "missing-module"
    at Module._resolveFilename (internal/modules/cjs/loader.js:636:15)
    at Module._load (internal/modules/cjs/loader.js:562:25)
    at loadSchema (/path/to/schema-loader.ts:100:20)
    at processSchema (/path/to/cli.ts:50:10)`;

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue(originalError),
      }));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/missing-schema.ts', '--verbose']);
      } catch {
        // Expected - process.exit throws
      }

      // In verbose mode, the stack trace should be visible in the output
      const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

      // FAILING: Current implementation drops stack traces
      // The stack trace should be preserved and shown in verbose mode
      expect(allOutput).toContain('at Module._resolveFilename');
      expect(allOutput).toContain('at loadSchema');

      mockExit.mockRestore();
    });

    it('should NOT show stack trace without --verbose flag', async () => {
      const originalError = new Error('Cannot find module "missing-module"');
      originalError.stack = `Error: Cannot find module "missing-module"
    at Module._resolveFilename (internal/modules/cjs/loader.js:636:15)
    at loadSchema (/path/to/schema-loader.ts:100:20)`;

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue(originalError),
      }));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/missing-schema.ts']);
      } catch {
        // Expected
      }

      const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

      // Without verbose, should show error message but NOT full stack
      expect(allOutput).toContain('Cannot find module');
      // Stack trace details should be hidden in normal mode
      expect(allOutput).not.toContain('at Module._resolveFilename');

      mockExit.mockRestore();
    });
  });

  describe('error includes original error name', () => {
    it('should preserve and display the original error class name', async () => {
      const schemaError = new SchemaLoadError('Failed to parse TypeScript', {
        filePath: '/path/to/schema.ts',
        code: ErrorCodes.SCHEMA_LOAD_ERROR,
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue(schemaError),
      }));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/schema.ts', '--verbose']);
      } catch {
        // Expected
      }

      const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

      // FAILING: Should include the error class name in verbose output
      expect(allOutput).toContain('SchemaLoadError');

      mockExit.mockRestore();
    });

    it('should show TypeError name when TypeError is thrown', async () => {
      const typeError = new TypeError('undefined is not a function');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue(typeError),
      }));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/schema.ts', '--verbose']);
      } catch {
        // Expected
      }

      const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

      // FAILING: Should include TypeError name in verbose output
      expect(allOutput).toContain('TypeError');

      mockExit.mockRestore();
    });
  });
});

// =============================================================================
// File Path in Error Messages
// =============================================================================

describe('Schema Loading Errors: File Path Inclusion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should include the absolute file path in error messages', async () => {
    const schemaPath = '/Users/test/project/schemas/user.ts';

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [],
        errors: [`Failed to load module: ${schemaPath}`],
      }),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', schemaPath]);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // Should show the absolute path
    expect(allOutput).toContain('/Users/test/project/schemas/user.ts');

    mockExit.mockRestore();
  });

  it('should resolve relative paths to absolute in error messages', async () => {
    const relativePath = './schemas/user.ts';
    const expectedAbsolute = resolve(process.cwd(), relativePath);

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [],
        errors: ['File not found'],
      }),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', relativePath]);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Error should show absolute path, not just relative
    // For debugging, users need to know the exact file location
    expect(allOutput).toContain(expectedAbsolute);

    mockExit.mockRestore();
  });
});

// =============================================================================
// Line Number Reporting
// =============================================================================

describe('Schema Loading Errors: Line Number Reporting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should include line number when available from transpilation errors', async () => {
    // Simulate a TypeScript syntax error with line info
    const syntaxError = new SyntaxError('Unexpected token');
    (syntaxError as any).loc = { line: 42, column: 10 };

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(syntaxError),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should extract and display line number from error.loc
    expect(allOutput).toMatch(/line\s*:?\s*42/i);

    mockExit.mockRestore();
  });

  it('should extract line number from error stack when not in loc property', async () => {
    const error = new Error('Undefined variable "foo"');
    error.stack = `Error: Undefined variable "foo"
    at /path/to/schema.ts:25:15
    at Module._compile (internal/modules/cjs/loader.js:1085:14)`;

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(error),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should parse stack trace to extract line 25
    expect(allOutput).toContain('line 25');

    mockExit.mockRestore();
  });
});

// =============================================================================
// Transpilation Error Clarity
// =============================================================================

describe('Schema Loading Errors: Transpilation Error Clarity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide clear message for TypeScript syntax errors', async () => {
    const error = new SyntaxError("Unexpected token '}'");
    error.stack = `SyntaxError: Unexpected token '}'
    at /path/to/schema.ts:15:1`;

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(error),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should clearly indicate this is a transpilation/syntax error
    expect(allOutput).toMatch(/transpil|syntax|parse/i);
    expect(allOutput).toContain("Unexpected token '}'");

    mockExit.mockRestore();
  });

  it('should distinguish between TypeScript errors and runtime errors', async () => {
    const transpileError = new Error('[jiti] Failed to transform /path/schema.ts');
    transpileError.name = 'TransformError';

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(transpileError),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should indicate this is a TypeScript transpilation error
    expect(allOutput).toMatch(/transpil|transform|typescript/i);

    mockExit.mockRestore();
  });
});

// =============================================================================
// Import Error Clarity
// =============================================================================

describe('Schema Loading Errors: Import Error Clarity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show what module is missing for "Cannot find module" errors', async () => {
    const error = new Error("Cannot find module '@myorg/shared-types'");
    error.stack = `Error: Cannot find module '@myorg/shared-types'
    at /path/to/schema.ts:1:1`;

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(error),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // Should clearly show which module is missing
    expect(allOutput).toContain('@myorg/shared-types');
    // FAILING: Should provide helpful suggestion for installing
    expect(allOutput).toMatch(/npm install|missing|not found/i);

    mockExit.mockRestore();
  });

  it('should show the import path for relative import errors', async () => {
    const error = new Error("Cannot find module './utils/helpers'");

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(error),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // Should show the missing relative import path
    expect(allOutput).toContain('./utils/helpers');

    mockExit.mockRestore();
  });

  it('should suggest tsconfig paths for path alias errors', async () => {
    const error = new Error("Cannot find module '@schemas/user'");

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(error),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should suggest checking tsconfig paths for @ imports
    expect(allOutput).toMatch(/tsconfig|path\s*alias|paths/i);

    mockExit.mockRestore();
  });
});

// =============================================================================
// Runtime Error Stack Traces
// =============================================================================

describe('Schema Loading Errors: Runtime Error Stack Traces', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show full stack trace for runtime errors in verbose mode', async () => {
    const runtimeError = new Error('Cannot read property "name" of undefined');
    runtimeError.stack = `TypeError: Cannot read property "name" of undefined
    at parseSchema (/path/to/schema.ts:50:20)
    at Object.<anonymous> (/path/to/schema.ts:100:1)
    at Module._compile (internal/modules/cjs/loader.js:1085:14)`;

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(runtimeError),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should show the full stack trace in verbose mode
    expect(allOutput).toContain('at parseSchema');
    expect(allOutput).toContain('/path/to/schema.ts:50:20');

    mockExit.mockRestore();
  });

  it('should indicate the error occurred at runtime (not transpilation)', async () => {
    const runtimeError = new ReferenceError('config is not defined');
    runtimeError.stack = `ReferenceError: config is not defined
    at /path/to/schema.ts:10:5`;

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(runtimeError),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should clearly indicate this is a runtime error
    expect(allOutput).toMatch(/runtime|execution|ReferenceError/i);
    expect(allOutput).toContain('config is not defined');

    mockExit.mockRestore();
  });
});

// =============================================================================
// Error Location Reporting
// =============================================================================

describe('Schema Loading Errors: Error Location Reporting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should report error location when available in error object', async () => {
    const error = new Error('Invalid schema definition');
    (error as any).loc = { line: 15, column: 8 };

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(error),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should extract and display location from error.loc
    expect(allOutput).toMatch(/line\s*:?\s*15/i);
    expect(allOutput).toMatch(/col(umn)?\s*:?\s*8/i);

    mockExit.mockRestore();
  });

  it('should report file:line:column format in verbose mode', async () => {
    const error = new Error('Schema validation failed');
    error.stack = `Error: Schema validation failed
    at /path/to/schema.ts:42:13`;

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(error),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should show file:line:column format for easy navigation
    // Editors like VS Code can click on this format to jump to location
    expect(allOutput).toContain('/path/to/schema.ts:42:13');

    mockExit.mockRestore();
  });
});

// =============================================================================
// Cause Chain Preservation
// =============================================================================

describe('Schema Loading Errors: Cause Chain Preservation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    consoleErrorCalls = [];
    consoleLogCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should preserve and display error cause chain in verbose mode', async () => {
    const rootCause = new Error('ENOENT: no such file or directory');
    const middleCause = new Error('Failed to read config file', { cause: rootCause });
    const topError = new SchemaLoadError('Schema loading failed', {
      cause: middleCause,
      filePath: '/path/to/schema.ts',
      code: ErrorCodes.SCHEMA_LOAD_ERROR,
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockRejectedValue(topError),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { validate } = await import('../commands/validate.js');

    try {
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    } catch {
      // Expected
    }

    const allOutput = [...getErrorMessages(), ...getLogMessages()].join('\n');

    // FAILING: Should show the full cause chain in verbose mode
    expect(allOutput).toContain('Schema loading failed');
    expect(allOutput).toContain('Failed to read config file');
    expect(allOutput).toContain('ENOENT');

    mockExit.mockRestore();
  });
});
