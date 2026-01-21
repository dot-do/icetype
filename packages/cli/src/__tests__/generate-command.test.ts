/**
 * Generate Command Tests for @icetype/cli
 *
 * Tests for the CLI generate command that generates TypeScript types from IceType schemas.
 * Follows TDD approach: RED -> GREEN -> REFACTOR
 *
 * Coverage targets: lines 37-160 of generate.ts
 * - runGeneration function (lines 37-76)
 * - generate function (lines 78-136)
 * - generateTypesFromSchemas function (lines 141-160)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

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
  fields.set('email', {
    name: 'email',
    type: 'string',
    modifier: '#',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: true,
  });

  return {
    name,
    version: 1,
    fields,
    directives: {
      partitionBy: ['id'],
      fts: ['name'],
    },
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a schema with various field types for comprehensive testing
 */
function createSchemaWithAllTypes(): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();

  // String types
  fields.set('name', {
    name: 'name',
    type: 'string',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('bio', {
    name: 'bio',
    type: 'text',
    modifier: '?',
    isArray: false,
    isOptional: true,
    isUnique: false,
    isIndexed: false,
  });

  // Numeric types
  fields.set('age', {
    name: 'age',
    type: 'int',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('score', {
    name: 'score',
    type: 'float',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('balance', {
    name: 'balance',
    type: 'decimal',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
    precision: 10,
    scale: 2,
  });

  // Boolean type
  fields.set('active', {
    name: 'active',
    type: 'boolean',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });

  // Timestamp/date types
  fields.set('createdAt', {
    name: 'createdAt',
    type: 'timestamp',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('birthDate', {
    name: 'birthDate',
    type: 'date',
    modifier: '?',
    isArray: false,
    isOptional: true,
    isUnique: false,
    isIndexed: false,
  });

  // Special types
  fields.set('metadata', {
    name: 'metadata',
    type: 'json',
    modifier: '?',
    isArray: false,
    isOptional: true,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('avatar', {
    name: 'avatar',
    type: 'binary',
    modifier: '?',
    isArray: false,
    isOptional: true,
    isUnique: false,
    isIndexed: false,
  });

  // Array type
  fields.set('tags', {
    name: 'tags',
    type: 'string',
    modifier: '',
    isArray: true,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });

  // Relation types
  fields.set('author', {
    name: 'author',
    type: 'User',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
    relation: {
      operator: '->',
      targetType: 'User',
    },
  });
  fields.set('comments', {
    name: 'comments',
    type: 'Comment',
    modifier: '',
    isArray: true,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
    relation: {
      operator: '<-',
      targetType: 'Comment',
      inverse: 'post',
    },
  });

  return {
    name: 'Post',
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// runGeneration Function Tests
// =============================================================================

describe('runGeneration function', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('successful generation', () => {
    it('should generate types to default output path when no output specified', async () => {
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await runGeneration({
        schema: './schema.ts',
        quiet: true,
      });

      expect(mockWriteFileSync).toHaveBeenCalled();
      const [outputPath, content] = mockWriteFileSync.mock.calls[0];
      expect(outputPath).toBe('./schema.generated.ts');
      expect(content).toContain('export interface User');
    });

    it('should generate types to custom output path when specified', async () => {
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await runGeneration({
        schema: './schema.ts',
        output: './custom-types.ts',
        quiet: true,
      });

      expect(mockWriteFileSync).toHaveBeenCalled();
      const [outputPath] = mockWriteFileSync.mock.calls[0];
      expect(outputPath).toBe('./custom-types.ts');
    });

    it('should handle .js schema files', async () => {
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await runGeneration({
        schema: './schema.js',
        quiet: true,
      });

      const [outputPath] = mockWriteFileSync.mock.calls[0];
      expect(outputPath).toBe('./schema.generated.ts');
    });

    it('should handle .mjs schema files', async () => {
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await runGeneration({
        schema: './schema.mjs',
        quiet: true,
      });

      const [outputPath] = mockWriteFileSync.mock.calls[0];
      expect(outputPath).toBe('./schema.generated.ts');
    });

    it('should handle .json schema files', async () => {
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await runGeneration({
        schema: './schema.json',
        quiet: true,
      });

      const [outputPath] = mockWriteFileSync.mock.calls[0];
      expect(outputPath).toBe('./schema.generated.ts');
    });

    it('should generate types with verbose logging when verbose flag is set', async () => {
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await runGeneration({
        schema: './schema.ts',
        verbose: true,
      });

      expect(mockWriteFileSync).toHaveBeenCalled();
      // Verbose mode should log debug messages
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error when schema loading fails', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: ['File not found: ./missing-schema.ts'],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await expect(
        runGeneration({
          schema: './missing-schema.ts',
          quiet: true,
        })
      ).rejects.toThrow('File not found');
    });

    it('should throw error when no schemas found in file', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: [],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await expect(
        runGeneration({
          schema: './empty-schema.ts',
          quiet: true,
        })
      ).rejects.toThrow('No schemas found in the file');
    });

    it('should throw error when file write fails', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn().mockImplementation(() => {
            throw new Error('EACCES: permission denied');
          }),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await expect(
        runGeneration({
          schema: './schema.ts',
          output: '/root/readonly.ts',
          quiet: true,
        })
      ).rejects.toThrow("Failed to write output file '/root/readonly.ts': EACCES: permission denied");
    });

    it('should handle non-Error write exceptions', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn().mockImplementation(() => {
            throw 'string error'; // Non-Error exception
          }),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      await expect(
        runGeneration({
          schema: './schema.ts',
          quiet: true,
        })
      ).rejects.toThrow('string error');
    });

    it('should include multiple schema loading errors in thrown error', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: ['Error 1: Invalid syntax', 'Error 2: Missing field'],
        }),
      }));

      const { runGeneration } = await import('../commands/generate.js');

      // Both errors should be included in the thrown error message
      try {
        await runGeneration({
          schema: './invalid-schema.ts',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Error 1');
        expect(message).toContain('Error 2');
      }
    });
  });
});

// =============================================================================
// generate CLI Function Tests
// =============================================================================

describe('generate CLI function', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('argument parsing', () => {
    it('should exit with error when --schema is not provided', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn(),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Commands now throw errors (main CLI catches and exits)
      await expect(generate([])).rejects.toThrow('--schema is required');
    });

    it('should support -s short flag for schema path', async () => {
      const mockSchema = createValidSchema('User');
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await generate(['-s', './schema.ts', '-q']);

      expect(mockLoadSchemaFile).toHaveBeenCalledWith('./schema.ts');
    });

    it('should support -o short flag for output path', async () => {
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await generate(['-s', './schema.ts', '-o', './custom.ts', '-q']);

      expect(mockWriteFileSync).toHaveBeenCalled();
      const [outputPath] = mockWriteFileSync.mock.calls[0];
      expect(outputPath).toBe('./custom.ts');
    });

    it('should support --quiet/-q flag', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Reset mock before this specific test
      mockConsoleLog.mockClear();

      await generate(['--schema', './schema.ts', '--quiet']);

      // In quiet mode, info logs should be suppressed
      // Only check that write succeeded
    });

    it('should support --verbose/-v flag', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await generate(['--schema', './schema.ts', '--verbose']);

      // Verbose mode should produce more output
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should default output path based on schema file name', async () => {
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await generate(['--schema', './my-schema.ts', '-q']);

      const [outputPath] = mockWriteFileSync.mock.calls[0];
      expect(outputPath).toBe('./my-schema.generated.ts');
    });
  });

  describe('watch mode', () => {
    it('should call watchGenerate when --watch flag is provided', async () => {
      const mockSchema = createValidSchema('User');
      const mockWatchGenerate = vi.fn().mockResolvedValue(undefined);

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: mockWatchGenerate,
      }));

      const { generate } = await import('../commands/generate.js');

      // Note: watchGenerate never resolves normally, so we mock it to resolve immediately
      await generate(['--schema', './schema.ts', '--watch', '-q']);

      expect(mockWatchGenerate).toHaveBeenCalled();
      expect(mockWatchGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaPath: './schema.ts',
          quiet: true,
          verbose: false,
        })
      );
    });

    it('should support -w short flag for watch mode', async () => {
      const mockWatchGenerate = vi.fn().mockResolvedValue(undefined);

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema() }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: mockWatchGenerate,
      }));

      const { generate } = await import('../commands/generate.js');

      await generate(['-s', './schema.ts', '-w', '-q']);

      expect(mockWatchGenerate).toHaveBeenCalled();
    });
  });

  describe('error handling in CLI', () => {
    it('should throw error when generation fails', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: ['File not found'],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Commands now throw errors (main CLI catches and exits)
      await expect(generate(['--schema', './missing.ts'])).rejects.toThrow();
    });

    it('should throw error with schema syntax error message', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [],
          errors: ['Schema syntax error'],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await expect(generate(['--schema', './invalid.ts'])).rejects.toThrow('Schema syntax error');
    });

    it('should propagate non-Error exceptions', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn().mockImplementation(() => {
            throw 'string exception';
          }),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema() }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await expect(generate(['--schema', './schema.ts'])).rejects.toThrow('string exception');
    });
  });
});

// =============================================================================
// generateTypesFromSchemas Tests (Multiple Schemas)
// =============================================================================

describe('multiple schema generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate types for multiple schemas in one file', async () => {
    const userSchema = createValidSchema('User');
    const postSchema = createValidSchema('Post');
    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [
          { name: 'User', schema: userSchema },
          { name: 'Post', schema: postSchema },
        ],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
    });

    expect(mockWriteFileSync).toHaveBeenCalled();
    const [, content] = mockWriteFileSync.mock.calls[0];

    // Both interfaces should be present
    expect(content).toContain('export interface User');
    expect(content).toContain('export interface UserInput');
    expect(content).toContain('export interface Post');
    expect(content).toContain('export interface PostInput');
  });

  it('should include header comment in generated file', async () => {
    const mockSchema = createValidSchema('User');
    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
    });

    const [, content] = mockWriteFileSync.mock.calls[0];

    expect(content).toContain('IceType Generated Types');
    expect(content).toContain('This file was generated by');
    expect(content).toContain("'ice generate'");
    expect(content).toContain('Do not edit manually');
    expect(content).toContain('@generated');
  });

  it('should generate types with all field types correctly mapped', async () => {
    const mockSchema = createSchemaWithAllTypes();
    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'Post', schema: mockSchema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
    });

    const [, content] = mockWriteFileSync.mock.calls[0];

    // System fields
    expect(content).toContain('$id: string');
    expect(content).toContain("$type: 'Post'");
    expect(content).toContain('$version: number');
    expect(content).toContain('$createdAt: number');
    expect(content).toContain('$updatedAt: number');

    // String types
    expect(content).toContain('name: string');
    expect(content).toContain('bio?: string');

    // Numeric types
    expect(content).toContain('age: number');
    expect(content).toContain('score: number');
    expect(content).toContain('balance: number');

    // Boolean
    expect(content).toContain('active: boolean');

    // Timestamps
    expect(content).toContain('createdAt: number');
    expect(content).toContain('birthDate?: number');

    // Special types
    expect(content).toContain('metadata?: unknown');
    expect(content).toContain('avatar?: Uint8Array');

    // Arrays
    expect(content).toContain('tags: string[]');

    // Relations (as string IDs)
    expect(content).toContain('author: string');
    expect(content).toContain('comments: string[]');
  });
});

// =============================================================================
// Help Flag Tests
// =============================================================================

describe('help flag', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show help and exit when --help flag is provided', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: vi.fn(),
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn(),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { generate } = await import('../commands/generate.js');

    try {
      await generate(['--help']);
    } catch {
      // Expected - process.exit throws
    }

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('generate')
    );

    mockExit.mockRestore();
  });

  it('should show help and exit when -h flag is provided', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: vi.fn(),
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn(),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { generate } = await import('../commands/generate.js');

    try {
      await generate(['-h']);
    } catch {
      // Expected - process.exit throws
    }

    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });
});

// =============================================================================
// Watch Mode Callback Tests
// =============================================================================

describe('watch mode callback execution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should pass runGeneration callback to watchGenerate that calls runGeneration', async () => {
    const mockSchema = createValidSchema('User');
    const mockWriteFileSync = vi.fn();
    let capturedRunGeneration: (() => Promise<void>) | undefined;

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      }),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn().mockImplementation((options: { runGeneration: () => Promise<void> }) => {
        capturedRunGeneration = options.runGeneration;
        return Promise.resolve();
      }),
    }));

    const { generate } = await import('../commands/generate.js');

    await generate(['--schema', './schema.ts', '--watch', '-q']);

    // Now call the captured runGeneration callback to test lines 143-144
    expect(capturedRunGeneration).toBeDefined();
    if (capturedRunGeneration) {
      await capturedRunGeneration();
      expect(mockWriteFileSync).toHaveBeenCalled();
    }
  });
});

// =============================================================================
// Additional Coverage Tests
// =============================================================================

describe('additional type mappings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle timestamptz type as number', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('updatedAt', {
      name: 'updatedAt',
      type: 'timestamptz',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Entity',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'Entity', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('updatedAt: number');
  });

  it('should handle time type as number', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('startTime', {
      name: 'startTime',
      type: 'time',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Event',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'Event', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('startTime: number');
  });

  it('should handle bool alias for boolean', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('isActive', {
      name: 'isActive',
      type: 'bool',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'User',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('isActive: boolean');
  });

  it('should handle arrays of unknown types', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('items', {
      name: 'items',
      type: 'json',
      modifier: '',
      isArray: true,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Collection',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'Collection', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('items: unknown[]');
  });

  it('should handle arrays of binary type', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('files', {
      name: 'files',
      type: 'binary',
      modifier: '',
      isArray: true,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Storage',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'Storage', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('files: Uint8Array[]');
  });
});

// =============================================================================
// Nullable Style Tests
// =============================================================================

describe('nullable style configuration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should use union style by default (T | null | undefined)', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('name', {
      name: 'name',
      type: 'string',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'User',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('name?: string | null | undefined;');
  });

  it('should generate optional style (T | undefined) when nullableStyle is optional', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('name', {
      name: 'name',
      type: 'string',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'User',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
      nullableStyle: 'optional',
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('name?: string | undefined;');
    expect(content).not.toContain('| null |');
  });

  it('should generate strict style (T | null) when nullableStyle is strict', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('name', {
      name: 'name',
      type: 'string',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'User',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
      nullableStyle: 'strict',
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('name?: string | null;');
    expect(content).not.toContain('| undefined');
  });

  it('should apply nullable style to optional relations', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('author', {
      name: 'author',
      type: 'User',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
      relation: {
        operator: '->',
        targetType: 'User',
      },
    });

    const schema: IceTypeSchema = {
      name: 'Post',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'Post', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
      nullableStyle: 'strict',
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('author?: string | null;');
  });

  it('should not apply nullable suffix to required fields', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('name', {
      name: 'name',
      type: 'string',
      modifier: '!',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'User',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema }],
        errors: [],
      }),
    }));

    const { runGeneration } = await import('../commands/generate.js');

    await runGeneration({
      schema: './schema.ts',
      quiet: true,
      nullableStyle: 'union',
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('name: string;');
    expect(content).not.toContain('name: string | null');
    expect(content).not.toContain('name: string | undefined');
  });

  it('should support --nullable-style CLI flag', async () => {
    const fields = new Map<string, FieldDefinition>();
    fields.set('name', {
      name: 'name',
      type: 'string',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'User',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockWriteFileSync = vi.fn();

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: mockWriteFileSync,
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema }],
        errors: [],
      }),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const { generate } = await import('../commands/generate.js');

    await generate(['--schema', './schema.ts', '--nullable-style', 'optional', '-q']);

    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content).toContain('name?: string | undefined;');
  });

  it('should reject invalid --nullable-style values', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: vi.fn(),
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn(),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const { generate } = await import('../commands/generate.js');

    await expect(
      generate(['--schema', './schema.ts', '--nullable-style', 'invalid', '-q'])
    ).rejects.toThrow("Invalid --nullable-style value 'invalid'. Must be one of: union, optional, strict");
  });
});
