/**
 * Diff Command Tests for @icetype/cli
 *
 * Tests for the `ice diff` command which compares two IceType schemas
 * and generates migration SQL.
 *
 * Uses mocked file system and schema loader.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';
import type { LoadResult } from '../src/utils/schema-loader.js';

// Mock node:fs
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// Mock the schema loader
vi.mock('../utils/schema-loader.js', () => ({
  loadSchemaFile: vi.fn(),
}));

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock process.exit to prevent tests from actually exiting
// Note: process.exit is tricky to mock because it's called synchronously.
// We mock it to throw an error so the function terminates.
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as typeof process.exit);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a basic IceTypeSchema for testing
 */
function createSchema(
  name: string,
  fields: Map<string, FieldDefinition>
): IceTypeSchema {
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
 * Create a FieldDefinition
 */
function createField(
  name: string,
  type: string,
  options: Partial<FieldDefinition> = {}
): FieldDefinition {
  return {
    name,
    type,
    modifier: options.modifier ?? '',
    isArray: options.isArray ?? false,
    isOptional: options.isOptional ?? false,
    isUnique: options.isUnique ?? false,
    isIndexed: options.isIndexed ?? false,
    ...options,
  };
}

/**
 * Create a LoadResult for mocking
 */
function createLoadResult(schemas: IceTypeSchema[], errors: string[] = []): LoadResult {
  return {
    schemas: schemas.map((schema) => ({
      name: schema.name,
      schema,
    })),
    errors,
  };
}

/**
 * Get the mocked loadSchemaFile function
 */
async function getMockedLoadSchemaFile() {
  const module = await import('../utils/schema-loader.js');
  return vi.mocked(module.loadSchemaFile);
}

// =============================================================================
// Diff Command Tests
// =============================================================================

describe('diff command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Error Cases - Missing Arguments
  // ===========================================================================

  describe('error cases - missing arguments', () => {
    it('should error when --old is not provided', async () => {
      const { diff } = await import('../commands/diff.js');

      // Commands now throw errors (main CLI catches and exits)
      await expect(diff(['--new', './new-schema.ts'])).rejects.toThrow('--old is required');
    });

    it('should error when --new is not provided', async () => {
      const { diff } = await import('../commands/diff.js');

      await expect(diff(['--old', './old-schema.ts'])).rejects.toThrow('--new is required');
    });

    it('should error with unsupported dialect', async () => {
      const { diff } = await import('../commands/diff.js');

      await expect(
        diff(['--old', './old.ts', '--new', './new.ts', '--dialect', 'mysql'])
      ).rejects.toThrow('Invalid value');
    });
  });

  // ===========================================================================
  // Error Cases - File Loading Errors
  // ===========================================================================

  describe('error cases - file loading', () => {
    it('should error when old schema file has load errors', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockResolvedValue({
        schemas: [],
        errors: ['File not found: ./old-schema.ts'],
      });

      const { diff } = await import('../commands/diff.js');

      await expect(
        diff(['--old', './old-schema.ts', '--new', './new-schema.ts'])
      ).rejects.toThrow('File not found');
    });

    it('should error when old schema file has no schemas', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockResolvedValue({
        schemas: [],
        errors: [],
      });

      const { diff } = await import('../commands/diff.js');

      await expect(
        diff(['--old', './old-schema.ts', '--new', './new-schema.ts'])
      ).rejects.toThrow('No schemas found');
    });

    it('should error when new schema file has load errors', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce({
          schemas: [],
          errors: ['Failed to parse new-schema.ts'],
        });

      const { diff } = await import('../commands/diff.js');

      await expect(
        diff(['--old', './old-schema.ts', '--new', './new-schema.ts'])
      ).rejects.toThrow('Failed to parse');
    });

    it('should error when new schema file has no schemas', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce({ schemas: [], errors: [] });

      const { diff } = await import('../commands/diff.js');

      await expect(
        diff(['--old', './old-schema.ts', '--new', './new-schema.ts'])
      ).rejects.toThrow('No schemas found');
    });
  });

  // ===========================================================================
  // Schema Comparison - Added Fields
  // ===========================================================================

  describe('schema comparison - added fields', () => {
    it('should detect added fields and generate ALTER TABLE ADD COLUMN', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Old schema with id only
      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      // New schema with id and email
      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string', { modifier: '!' }));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      // Should output the migration
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Added fields: email');
      expect(allOutput).toContain('ALTER TABLE User ADD COLUMN email');
      expect(allOutput).toContain('Schema changes detected');
    });

    it('should handle multiple added fields', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Old schema with id only
      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      // New schema with id, email, and name
      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string', { modifier: '!' }));
      newFields.set('name', createField('name', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('email');
      expect(allOutput).toContain('name');
    });
  });

  // ===========================================================================
  // Schema Comparison - Removed Fields
  // ===========================================================================

  describe('schema comparison - removed fields', () => {
    it('should detect removed fields and generate ALTER TABLE DROP COLUMN', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Old schema with id and email
      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      oldFields.set('email', createField('email', 'string', { modifier: '!' }));
      const oldSchema = createSchema('User', oldFields);

      // New schema with id only
      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Removed fields: email');
      expect(allOutput).toContain('ALTER TABLE User DROP COLUMN email');
    });
  });

  // ===========================================================================
  // Schema Comparison - Modified Fields
  // ===========================================================================

  describe('schema comparison - modified fields', () => {
    it('should detect modified field types', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Old schema with age as int
      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      oldFields.set('age', createField('age', 'int'));
      const oldSchema = createSchema('User', oldFields);

      // New schema with age as string
      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('age', createField('age', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Modified fields:');
      expect(allOutput).toContain('age');
      expect(allOutput).toContain('type');
    });

    it('should detect modifier changes (optional to required)', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Old schema with optional email
      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      oldFields.set('email', createField('email', 'string', { modifier: '?', isOptional: true }));
      const oldSchema = createSchema('User', oldFields);

      // New schema with required email
      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string', { modifier: '!', isOptional: false }));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Modified fields:');
      expect(allOutput).toContain('modifier');
    });
  });

  // ===========================================================================
  // Schema Comparison - No Changes
  // ===========================================================================

  describe('schema comparison - no changes', () => {
    it('should detect when schemas are identical', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Both schemas identical
      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string'));
      const oldSchema = createSchema('User', fields);
      const newSchema = createSchema('User', new Map(fields)); // Clone

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('No schema changes detected');
      expect(allOutput).toContain('No changes');
    });
  });

  // ===========================================================================
  // New and Removed Schemas
  // ===========================================================================

  describe('schema comparison - new and removed schemas', () => {
    it('should detect when a schema is new (not in old)', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Old has User only
      const userFields = new Map<string, FieldDefinition>();
      userFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const userSchema = createSchema('User', userFields);

      // New has User and Post
      const postFields = new Map<string, FieldDefinition>();
      postFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      postFields.set('title', createField('title', 'string'));
      const postSchema = createSchema('Post', postFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([userSchema]))
        .mockResolvedValueOnce(createLoadResult([userSchema, postSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Schema Post: NEW TABLE');
    });

    it('should detect when a schema is removed (not in new)', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Old has User and Post
      const userFields = new Map<string, FieldDefinition>();
      userFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const userSchema = createSchema('User', userFields);

      const postFields = new Map<string, FieldDefinition>();
      postFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const postSchema = createSchema('Post', postFields);

      // New has User only
      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([userSchema, postSchema]))
        .mockResolvedValueOnce(createLoadResult([userSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Schema Post: REMOVED');
      expect(allOutput).toContain('WARNING');
    });
  });

  // ===========================================================================
  // Dialect Options
  // ===========================================================================

  describe('dialect options', () => {
    it('should use postgres dialect by default', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Dialect: postgres');
    });

    it('should support postgres dialect with --dialect flag', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Dialect: postgres');
    });

    it('should support clickhouse dialect', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('age', createField('age', 'int'));
      const newSchema = createSchema('User', newFields);

      // Mock for type change to test MODIFY COLUMN syntax
      const oldFields2 = new Map<string, FieldDefinition>();
      oldFields2.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      oldFields2.set('status', createField('status', 'int'));
      const oldSchema2 = createSchema('User', oldFields2);

      const newFields2 = new Map<string, FieldDefinition>();
      newFields2.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields2.set('status', createField('status', 'string'));
      const newSchema2 = createSchema('User', newFields2);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema2]))
        .mockResolvedValueOnce(createLoadResult([newSchema2]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts', '--dialect', 'clickhouse']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Dialect: clickhouse');
      // ClickHouse uses MODIFY COLUMN instead of ALTER COLUMN TYPE
      expect(allOutput).toContain('MODIFY COLUMN');
    });

    it('should support duckdb dialect', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts', '--dialect', 'duckdb']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Dialect: duckdb');
    });

    it('should support -d short flag for dialect', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts', '-d', 'clickhouse']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Dialect: clickhouse');
    });
  });

  // ===========================================================================
  // Output Option
  // ===========================================================================

  describe('output option', () => {
    it('should write migration to file when --output is specified', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { diff } = await import('../commands/diff.js');

      await diff([
        '--old',
        './old-schema.ts',
        '--new',
        './new-schema.ts',
        '--output',
        './migration.sql',
      ]);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        './migration.sql',
        expect.stringContaining('IceType Migration')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Migration written to: ./migration.sql')
      );
    });

    it('should support -o short flag for output', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { diff } = await import('../commands/diff.js');

      await diff([
        '--old',
        './old-schema.ts',
        '--new',
        './new-schema.ts',
        '-o',
        './output.sql',
      ]);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        './output.sql',
        expect.any(String)
      );
    });

    it('should output to console when --output is not specified', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('IceType Migration');
    });
  });

  // ===========================================================================
  // Migration SQL Content
  // ===========================================================================

  describe('migration SQL content', () => {
    it('should include header comments in migration output', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('-- IceType Migration');
      expect(allOutput).toContain('-- Generated from:');
      expect(allOutput).toContain('-- Dialect:');
      expect(allOutput).toContain('-- Date:');
    });

    it('should include UP and DOWN migrations', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('-- UP Migration');
      expect(allOutput).toContain('-- DOWN Migration');
    });

    it('should generate correct ADD COLUMN SQL for postgres', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string', { modifier: '!' }));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('ALTER TABLE User ADD COLUMN email');
      expect(allOutput).toContain('NOT NULL');
    });

    it('should generate correct DROP COLUMN SQL in down migration', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const oldFields = new Map<string, FieldDefinition>();
      oldFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', oldFields);

      const newFields = new Map<string, FieldDefinition>();
      newFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      newFields.set('email', createField('email', 'string'));
      const newSchema = createSchema('User', newFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Down migration should have DROP COLUMN for the added field
      expect(allOutput).toContain('DROP COLUMN email');
    });
  });

  // ===========================================================================
  // General Exception Handling
  // ===========================================================================

  describe('exception handling', () => {
    it('should propagate errors for main CLI to handle', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockRejectedValue(new Error('Unexpected error occurred'));

      const { diff } = await import('../commands/diff.js');

      // Commands now throw errors, main CLI catches and handles them
      await expect(
        diff(['--old', './old-schema.ts', '--new', './new-schema.ts'])
      ).rejects.toThrow('Unexpected error occurred');
    });

    it('should propagate non-Error exceptions', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockRejectedValue('String error');

      const { diff } = await import('../commands/diff.js');

      await expect(
        diff(['--old', './old-schema.ts', '--new', './new-schema.ts'])
      ).rejects.toBe('String error');
    });
  });

  // ===========================================================================
  // Console Output
  // ===========================================================================

  describe('console output', () => {
    it('should print schema paths being compared', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([schema]))
        .mockResolvedValueOnce(createLoadResult([schema]));

      const { diff } = await import('../commands/diff.js');

      await diff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      expect(mockConsoleLog).toHaveBeenCalledWith('Comparing schemas:');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Old: ./old-schema.ts');
      expect(mockConsoleLog).toHaveBeenCalledWith('  New: ./new-schema.ts');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Dialect: postgres');
    });
  });
});
