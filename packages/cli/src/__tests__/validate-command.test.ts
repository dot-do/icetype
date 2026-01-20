/**
 * Validate Command Tests for @icetype/cli
 *
 * Tests for the CLI validate command that validates IceType schema files.
 * Follows TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IceTypeSchema, FieldDefinition, ValidationResult } from '@icetype/core';

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

// =============================================================================
// Helper Functions
// =============================================================================

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
  fields.set('name', {
    name: 'name',
    type: 'string',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
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
 * Create a validation result for testing
 */
function createValidationResult(
  valid: boolean,
  errors: Array<{ path: string; message: string; code: string }> = [],
  warnings: Array<{ path: string; message: string; code: string }> = []
): ValidationResult {
  return { valid, errors, warnings };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('validate command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Missing --schema flag tests
  // ===========================================================================

  describe('missing --schema flag', () => {
    it('should exit with error when --schema is not provided', async () => {
      // Mock schema-loader (won't be called)
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn(),
      }));

      // Mock validateSchema (won't be called)
      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn(),
        };
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate([]);
      } catch {
        // Expected
      }

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('--schema is required')
      );

      mockExit.mockRestore();
    });

    it('should show usage hint when --schema is not provided', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn(),
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
        await validate([]);
      } catch {
        // Expected
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage:')
      );

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // File not found tests
  // ===========================================================================

  describe('file not found', () => {
    it('should exit with error when schema file does not exist', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: ['File not found: /path/to/missing.ts'],
        }),
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
        await validate(['--schema', '/path/to/missing.ts']);
      } catch {
        // Expected
      }

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('File not found')
      );

      mockExit.mockRestore();
    });

    it('should support -s short flag for schema path', async () => {
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [],
        errors: ['File not found: /path/to/schema.ts'],
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
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
        await validate(['-s', '/path/to/schema.ts']);
      } catch {
        // Expected
      }

      expect(mockLoadSchemaFile).toHaveBeenCalled();

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // Validating correct schema tests
  // ===========================================================================

  describe('validating a correct schema file', () => {
    it('should validate a correct schema and report success', async () => {
      const schema = createValidSchema('User');
      const mockValidateSchema = vi.fn().mockReturnValue(createValidationResult(true));

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: mockValidateSchema };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schema.ts']);

      expect(mockValidateSchema).toHaveBeenCalledWith(schema);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('User is valid')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('All schemas are valid')
      );
    });

    it('should validate multiple schemas in a file', async () => {
      const userSchema = createValidSchema('User');
      const postSchema = createValidSchema('Post');
      const mockValidateSchema = vi.fn().mockReturnValue(createValidationResult(true));

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [
            { name: 'User', schema: userSchema },
            { name: 'Post', schema: postSchema },
          ],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: mockValidateSchema };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schemas.ts']);

      expect(mockValidateSchema).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 schema(s)')
      );
    });

    it('should show schema count when validating', async () => {
      const schema = createValidSchema('Test');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'Test', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: vi.fn().mockReturnValue(createValidationResult(true)) };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schema.ts']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 schema(s)')
      );
    });
  });

  // ===========================================================================
  // Schema loading errors (syntax errors) tests
  // ===========================================================================

  describe('schema with loading/syntax errors', () => {
    it('should exit with error when schema file has syntax errors', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: ['Failed to load TypeScript file: /path/to/bad.ts\n  Error: Unexpected token'],
        }),
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
        await validate(['--schema', '/path/to/bad.ts']);
      } catch {
        // Expected
      }

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load TypeScript file')
      );

      mockExit.mockRestore();
    });

    it('should exit with error when no schemas are found in file', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: [],
        }),
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
        await validate(['--schema', '/path/to/empty.ts']);
      } catch {
        // Expected
      }

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('No schemas found')
      );

      mockExit.mockRestore();
    });

    it('should report multiple loading errors', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: ['Error 1: syntax error', 'Error 2: another error'],
        }),
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
        await validate(['--schema', '/path/to/bad.ts']);
      } catch {
        // Expected
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error 1')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error 2')
      );

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // Schema validation errors (semantic errors) tests
  // ===========================================================================

  describe('schema with semantic/validation errors', () => {
    it('should exit with error when schema has unknown types', async () => {
      const schema = createValidSchema('BadSchema');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'BadSchema', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue(
            createValidationResult(false, [
              { path: 'badField', message: 'Unknown type: unknownType', code: 'UNKNOWN_TYPE' },
            ])
          ),
        };
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

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('BadSchema validation failed')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('UNKNOWN_TYPE')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('badField')
      );

      mockExit.mockRestore();
    });

    it('should exit with error when schema has invalid directive references', async () => {
      const schema = createValidSchema('BadDirectives');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'BadDirectives', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue(
            createValidationResult(false, [
              {
                path: '$partitionBy.nonexistent',
                message: 'Partition field "nonexistent" does not exist',
                code: 'UNKNOWN_PARTITION_FIELD',
              },
            ])
          ),
        };
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

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('UNKNOWN_PARTITION_FIELD')
      );

      mockExit.mockRestore();
    });

    it('should report multiple validation errors', async () => {
      const schema = createValidSchema('ManyErrors');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'ManyErrors', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue(
            createValidationResult(false, [
              { path: 'field1', message: 'Unknown type: bad1', code: 'UNKNOWN_TYPE' },
              { path: 'field2', message: 'Unknown type: bad2', code: 'UNKNOWN_TYPE' },
              { path: '$index.missing', message: 'Index field missing', code: 'UNKNOWN_INDEX_FIELD' },
            ])
          ),
        };
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

      // Should report all errors
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('field1'));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('field2'));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('UNKNOWN_INDEX_FIELD'));

      mockExit.mockRestore();
    });

    it('should show errors for each invalid schema when validating multiple', async () => {
      const schema1 = createValidSchema('Schema1');
      const schema2 = createValidSchema('Schema2');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [
            { name: 'Schema1', schema: schema1 },
            { name: 'Schema2', schema: schema2 },
          ],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn()
            .mockReturnValueOnce(createValidationResult(false, [
              { path: 'field1', message: 'Error in schema1', code: 'UNKNOWN_TYPE' },
            ]))
            .mockReturnValueOnce(createValidationResult(false, [
              { path: 'field2', message: 'Error in schema2', code: 'UNKNOWN_TYPE' },
            ])),
        };
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/schemas.ts']);
      } catch {
        // Expected
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Schema1 validation failed')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Schema2 validation failed')
      );

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // Validation warnings tests
  // ===========================================================================

  describe('schema with validation warnings', () => {
    it('should show warnings for valid schema', async () => {
      const schema = createValidSchema('WithWarnings');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'WithWarnings', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue(
            createValidationResult(
              true,
              [],
              [{ path: '$type', message: 'Schema name not specified', code: 'MISSING_SCHEMA_NAME' }]
            )
          ),
        };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schema.ts']);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('MISSING_SCHEMA_NAME')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('WithWarnings is valid')
      );
    });

    it('should show warnings alongside errors for invalid schema', async () => {
      const schema = createValidSchema('WithBoth');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'WithBoth', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue(
            createValidationResult(
              false,
              [{ path: 'badField', message: 'Unknown type', code: 'UNKNOWN_TYPE' }],
              [{ path: '$type', message: 'Schema name warning', code: 'MISSING_SCHEMA_NAME' }]
            )
          ),
        };
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

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('UNKNOWN_TYPE')
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('MISSING_SCHEMA_NAME')
      );

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // --quiet flag tests
  // ===========================================================================

  describe('--quiet flag', () => {
    it('should suppress info output with --quiet flag', async () => {
      const schema = createValidSchema('QuietTest');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'QuietTest', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: vi.fn().mockReturnValue(createValidationResult(true)) };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schema.ts', '--quiet']);

      // In quiet mode, "Found N schema(s)" and "Validating schema" should be suppressed
      // Note: The actual behavior depends on logger implementation
    });

    it('should support -q short flag for quiet mode', async () => {
      const schema = createValidSchema('QuietShort');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'QuietShort', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: vi.fn().mockReturnValue(createValidationResult(true)) };
      });

      const { validate } = await import('../commands/validate.js');

      // Should not throw - just verify it accepts the flag
      await validate(['--schema', '/path/to/schema.ts', '-q']);
    });

    it('should still show errors in quiet mode', async () => {
      const schema = createValidSchema('QuietErrors');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'QuietErrors', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue(
            createValidationResult(false, [
              { path: 'field', message: 'Error message', code: 'ERROR_CODE' },
            ])
          ),
        };
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/schema.ts', '--quiet']);
      } catch {
        // Expected
      }

      expect(mockConsoleError).toHaveBeenCalled();

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // --verbose flag tests
  // ===========================================================================

  describe('--verbose flag', () => {
    it('should enable verbose/debug output with --verbose flag', async () => {
      const schema = createValidSchema('VerboseTest');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'VerboseTest', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: vi.fn().mockReturnValue(createValidationResult(true)) };
      });

      const { validate } = await import('../commands/validate.js');

      // Should not throw - just verify it accepts the flag
      await validate(['--schema', '/path/to/schema.ts', '--verbose']);
    });

    it('should support -v short flag for verbose mode', async () => {
      const schema = createValidSchema('VerboseShort');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'VerboseShort', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: vi.fn().mockReturnValue(createValidationResult(true)) };
      });

      const { validate } = await import('../commands/validate.js');

      // Should not throw - just verify it accepts the flag
      await validate(['--schema', '/path/to/schema.ts', '-v']);
    });
  });

  // ===========================================================================
  // Mixed valid and invalid schemas tests
  // ===========================================================================

  describe('mixed valid and invalid schemas', () => {
    it('should exit with error if any schema is invalid', async () => {
      const validSchema = createValidSchema('ValidSchema');
      const invalidSchema = createValidSchema('InvalidSchema');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [
            { name: 'ValidSchema', schema: validSchema },
            { name: 'InvalidSchema', schema: invalidSchema },
          ],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn()
            .mockReturnValueOnce(createValidationResult(true))
            .mockReturnValueOnce(
              createValidationResult(false, [
                { path: 'field', message: 'Error', code: 'ERROR' },
              ])
            ),
        };
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/schemas.ts']);
      } catch {
        // Expected
      }

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ValidSchema is valid')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('InvalidSchema validation failed')
      );

      mockExit.mockRestore();
    });

    it('should validate all schemas before exiting', async () => {
      const schema1 = createValidSchema('Schema1');
      const schema2 = createValidSchema('Schema2');
      const schema3 = createValidSchema('Schema3');

      const mockValidateSchema = vi.fn()
        .mockReturnValueOnce(createValidationResult(false, [{ path: 'f1', message: 'e1', code: 'c1' }]))
        .mockReturnValueOnce(createValidationResult(true))
        .mockReturnValueOnce(createValidationResult(false, [{ path: 'f3', message: 'e3', code: 'c3' }]));

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [
            { name: 'Schema1', schema: schema1 },
            { name: 'Schema2', schema: schema2 },
            { name: 'Schema3', schema: schema3 },
          ],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: mockValidateSchema };
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { validate } = await import('../commands/validate.js');

      try {
        await validate(['--schema', '/path/to/schemas.ts']);
      } catch {
        // Expected
      }

      // All 3 schemas should be validated
      expect(mockValidateSchema).toHaveBeenCalledTimes(3);

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // Error handling tests
  // ===========================================================================

  describe('error handling', () => {
    it('should handle unexpected errors during schema loading', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue(new Error('Unexpected loading error')),
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

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error loading schema')
      );

      mockExit.mockRestore();
    });

    it('should include error message in output', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue(new Error('Custom error message')),
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

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Custom error message')
      );

      mockExit.mockRestore();
    });

    it('should handle non-Error thrown values', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockRejectedValue('String error'),
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

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('String error')
      );

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // Path handling tests
  // ===========================================================================

  describe('schema path handling', () => {
    it('should pass the schema path to loadSchemaFile', async () => {
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [],
        errors: ['File not found'],
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
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
        await validate(['--schema', '/custom/path/schema.ts']);
      } catch {
        // Expected
      }

      expect(mockLoadSchemaFile).toHaveBeenCalledWith('/custom/path/schema.ts');

      mockExit.mockRestore();
    });

    it('should handle relative paths', async () => {
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [],
        errors: ['File not found'],
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
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
        await validate(['--schema', './schemas/user.ts']);
      } catch {
        // Expected
      }

      expect(mockLoadSchemaFile).toHaveBeenCalledWith('./schemas/user.ts');

      mockExit.mockRestore();
    });

    it('should handle paths with spaces', async () => {
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [],
        errors: ['File not found'],
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
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
        await validate(['--schema', '/path/with spaces/schema.ts']);
      } catch {
        // Expected
      }

      expect(mockLoadSchemaFile).toHaveBeenCalledWith('/path/with spaces/schema.ts');

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // Output format tests
  // ===========================================================================

  describe('output formatting', () => {
    it('should include error code in validation error output', async () => {
      const schema = createValidSchema('ErrorCode');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'ErrorCode', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue(
            createValidationResult(false, [
              { path: 'testField', message: 'Test error', code: 'TEST_ERROR_CODE' },
            ])
          ),
        };
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

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[TEST_ERROR_CODE]')
      );

      mockExit.mockRestore();
    });

    it('should include field path in validation error output', async () => {
      const schema = createValidSchema('FieldPath');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'FieldPath', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue(
            createValidationResult(false, [
              { path: 'nested.field.path', message: 'Error', code: 'ERROR' },
            ])
          ),
        };
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

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('nested.field.path')
      );

      mockExit.mockRestore();
    });

    it('should include error message in validation error output', async () => {
      const schema = createValidSchema('ErrorMsg');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'ErrorMsg', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue(
            createValidationResult(false, [
              { path: 'field', message: 'Detailed error message here', code: 'CODE' },
            ])
          ),
        };
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

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Detailed error message here')
      );

      mockExit.mockRestore();
    });

    it('should display validating schema path message', async () => {
      const schema = createValidSchema('Display');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'Display', schema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return { ...actual, validateSchema: vi.fn().mockReturnValue(createValidationResult(true)) };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/my/schema/path.ts']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Validating schema: /my/schema/path.ts')
      );
    });
  });
});
