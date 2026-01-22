/**
 * Migrate Command Tests for @icetype/cli
 *
 * Tests for the `ice migrate` command group:
 * - ice migrate generate
 * - ice migrate diff
 * - ice migrate plan
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
// Migrate Generate Command Tests
// =============================================================================

describe('migrate generate command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('error cases - missing arguments', () => {
    it('should error when --schema is not provided', async () => {
      const { migrateGenerate } = await import('../commands/migrate.js');

      await expect(migrateGenerate(['--from', '1', '--to', '2'])).rejects.toThrow(
        '--schema is required'
      );
    });

    it('should error when --from is not provided', async () => {
      const { migrateGenerate } = await import('../commands/migrate.js');

      await expect(
        migrateGenerate(['--schema', './schema.ts', '--to', '2'])
      ).rejects.toThrow('--from is required');
    });

    it('should error when --to is not provided', async () => {
      const { migrateGenerate } = await import('../commands/migrate.js');

      await expect(
        migrateGenerate(['--schema', './schema.ts', '--from', '1'])
      ).rejects.toThrow('--to is required');
    });

    it('should error with unsupported dialect', async () => {
      const { migrateGenerate } = await import('../commands/migrate.js');

      await expect(
        migrateGenerate([
          '--schema',
          './schema.ts',
          '--from',
          '1',
          '--to',
          '2',
          '--dialect',
          'oracle',
        ])
      ).rejects.toThrow('Invalid value');
    });

    it('should error with unsupported format', async () => {
      const { migrateGenerate } = await import('../commands/migrate.js');

      await expect(
        migrateGenerate([
          '--schema',
          './schema.ts',
          '--from',
          '1',
          '--to',
          '2',
          '--format',
          'xml',
        ])
      ).rejects.toThrow('Invalid value');
    });
  });

  describe('error cases - file loading', () => {
    it('should error when schema file has load errors', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockResolvedValue({
        schemas: [],
        errors: ['File not found: ./schema.ts'],
      });

      const { migrateGenerate } = await import('../commands/migrate.js');

      await expect(
        migrateGenerate(['--schema', './schema.ts', '--from', '1', '--to', '2'])
      ).rejects.toThrow('File not found');
    });

    it('should error when schema file has no schemas', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockResolvedValue({
        schemas: [],
        errors: [],
      });

      const { migrateGenerate } = await import('../commands/migrate.js');

      await expect(
        migrateGenerate(['--schema', './schema.ts', '--from', '1', '--to', '2'])
      ).rejects.toThrow('No schemas found');
    });
  });

  describe('successful generation', () => {
    it('should generate migration SQL output', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateGenerate } = await import('../commands/migrate.js');

      await migrateGenerate(['--schema', './schema.ts', '--from', '1', '--to', '2']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('IceType Migration');
      expect(allOutput).toContain('From version: 1');
      expect(allOutput).toContain('To version: 2');
      expect(allOutput).toContain('Schema: User');
    });

    it('should support JSON format output', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateGenerate } = await import('../commands/migrate.js');

      await migrateGenerate([
        '--schema',
        './schema.ts',
        '--from',
        '1',
        '--to',
        '2',
        '--format',
        'json',
        '--quiet',
      ]);

      // Find the JSON output (it's the call that starts with '{')
      const jsonOutput = mockConsoleLog.mock.calls
        .map((c) => c[0])
        .find((output: string) => output && output.trim().startsWith('{'));
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.fromVersion).toBe('1');
      expect(parsed.toVersion).toBe('2');
      expect(parsed.schemas).toBeDefined();
    });

    it('should write to file when --output is specified', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { migrateGenerate } = await import('../commands/migrate.js');

      await migrateGenerate([
        '--schema',
        './schema.ts',
        '--from',
        '1',
        '--to',
        '2',
        '--output',
        './migration.sql',
      ]);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        './migration.sql',
        expect.stringContaining('IceType Migration')
      );
    });
  });
});

// =============================================================================
// Migrate Diff Command Tests
// =============================================================================

describe('migrate diff command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('error cases - missing arguments', () => {
    it('should error when --old is not provided', async () => {
      const { migrateDiff } = await import('../commands/migrate.js');

      await expect(migrateDiff(['--new', './new-schema.ts'])).rejects.toThrow(
        '--old is required'
      );
    });

    it('should error when --new is not provided', async () => {
      const { migrateDiff } = await import('../commands/migrate.js');

      await expect(migrateDiff(['--old', './old-schema.ts'])).rejects.toThrow(
        '--new is required'
      );
    });

    it('should error with unsupported dialect', async () => {
      const { migrateDiff } = await import('../commands/migrate.js');

      await expect(
        migrateDiff(['--old', './old.ts', '--new', './new.ts', '--dialect', 'oracle'])
      ).rejects.toThrow('Invalid value');
    });
  });

  describe('error cases - file loading', () => {
    it('should error when old schema file has load errors', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockResolvedValue({
        schemas: [],
        errors: ['File not found: ./old-schema.ts'],
      });

      const { migrateDiff } = await import('../commands/migrate.js');

      await expect(
        migrateDiff(['--old', './old-schema.ts', '--new', './new-schema.ts'])
      ).rejects.toThrow('File not found');
    });

    it('should error when old schema file has no schemas', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockResolvedValue({
        schemas: [],
        errors: [],
      });

      const { migrateDiff } = await import('../commands/migrate.js');

      await expect(
        migrateDiff(['--old', './old-schema.ts', '--new', './new-schema.ts'])
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

      const { migrateDiff } = await import('../commands/migrate.js');

      await expect(
        migrateDiff(['--old', './old-schema.ts', '--new', './new-schema.ts'])
      ).rejects.toThrow('Failed to parse');
    });
  });

  describe('schema comparison', () => {
    it('should detect added fields', async () => {
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

      const { migrateDiff } = await import('../commands/migrate.js');

      await migrateDiff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Added fields: email');
    });

    it('should detect removed fields', async () => {
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

      const { migrateDiff } = await import('../commands/migrate.js');

      await migrateDiff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Removed fields: email');
    });

    it('should detect no changes', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Identical schemas
      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', fields);
      const newSchema = createSchema('User', new Map(fields));

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      const { migrateDiff } = await import('../commands/migrate.js');

      await migrateDiff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('No changes');
    });

    it('should detect new schemas', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Old has User only
      const userFields = new Map<string, FieldDefinition>();
      userFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const userSchema = createSchema('User', userFields);

      // New has User and Post
      const postFields = new Map<string, FieldDefinition>();
      postFields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const postSchema = createSchema('Post', postFields);

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([userSchema]))
        .mockResolvedValueOnce(createLoadResult([userSchema, postSchema]));

      const { migrateDiff } = await import('../commands/migrate.js');

      await migrateDiff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Schema Post: NEW TABLE');
    });

    it('should detect removed schemas', async () => {
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

      const { migrateDiff } = await import('../commands/migrate.js');

      await migrateDiff(['--old', './old-schema.ts', '--new', './new-schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Schema Post: REMOVED');
    });
  });

  describe('output formats', () => {
    it('should support JSON format', async () => {
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

      const { migrateDiff } = await import('../commands/migrate.js');

      await migrateDiff([
        '--old',
        './old-schema.ts',
        '--new',
        './new-schema.ts',
        '--format',
        'json',
        '--quiet',
      ]);

      // Find the JSON output (it's the call that starts with '{')
      const jsonOutput = mockConsoleLog.mock.calls
        .map((c) => c[0])
        .find((output: string) => output && output.trim().startsWith('{'));
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.hasChanges).toBe(true);
      expect(parsed.schemas).toBeDefined();
    });

    it('should write to file when --output is specified', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const oldSchema = createSchema('User', fields);
      const newSchema = createSchema('User', new Map(fields));

      loadSchemaFile
        .mockResolvedValueOnce(createLoadResult([oldSchema]))
        .mockResolvedValueOnce(createLoadResult([newSchema]));

      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { migrateDiff } = await import('../commands/migrate.js');

      await migrateDiff([
        '--old',
        './old-schema.ts',
        '--new',
        './new-schema.ts',
        '--output',
        './diff.sql',
      ]);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        './diff.sql',
        expect.stringContaining('IceType Schema Diff')
      );
    });
  });
});

// =============================================================================
// Migrate Plan Command Tests
// =============================================================================

describe('migrate plan command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('error cases', () => {
    it('should error when --schema is not provided', async () => {
      const { migratePlan } = await import('../commands/migrate.js');

      await expect(migratePlan([])).rejects.toThrow('--schema is required');
    });

    it('should error with unsupported dialect', async () => {
      const { migratePlan } = await import('../commands/migrate.js');

      await expect(
        migratePlan(['--schema', './schema.ts', '--dialect', 'oracle'])
      ).rejects.toThrow('Invalid value');
    });

    it('should error when schema file has load errors', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockResolvedValue({
        schemas: [],
        errors: ['File not found: ./schema.ts'],
      });

      const { migratePlan } = await import('../commands/migrate.js');

      await expect(migratePlan(['--schema', './schema.ts'])).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('successful plan generation', () => {
    it('should generate migration plan', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      fields.set('name', createField('name', 'string', { isOptional: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migratePlan } = await import('../commands/migrate.js');

      await migratePlan(['--schema', './schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('IceType Migration Plan');
      expect(allOutput).toContain('Schema: User');
      expect(allOutput).toContain('Fields:');
      expect(allOutput).toContain('id');
      expect(allOutput).toContain('email');
      expect(allOutput).toContain('name');
    });

    it('should support JSON format', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migratePlan } = await import('../commands/migrate.js');

      await migratePlan(['--schema', './schema.ts', '--format', 'json', '--quiet']);

      // Find the JSON output (it's the call that starts with '{')
      const jsonOutput = mockConsoleLog.mock.calls
        .map((c) => c[0])
        .find((output: string) => output && output.trim().startsWith('{'));
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.schemas).toBeDefined();
      expect(parsed.schemas[0].schema).toBe('User');
      expect(parsed.schemas[0].fields).toBeDefined();
    });

    it('should write to file when --output is specified', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { migratePlan } = await import('../commands/migrate.js');

      await migratePlan(['--schema', './schema.ts', '--output', './plan.sql']);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        './plan.sql',
        expect.stringContaining('IceType Migration Plan')
      );
    });

    it('should show multiple schemas', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const userFields = new Map<string, FieldDefinition>();
      userFields.set('id', createField('id', 'uuid', { modifier: '!' }));
      const userSchema = createSchema('User', userFields);

      const postFields = new Map<string, FieldDefinition>();
      postFields.set('id', createField('id', 'uuid', { modifier: '!' }));
      postFields.set('title', createField('title', 'string'));
      const postSchema = createSchema('Post', postFields);

      loadSchemaFile.mockResolvedValue(createLoadResult([userSchema, postSchema]));

      const { migratePlan } = await import('../commands/migrate.js');

      await migratePlan(['--schema', './schema.ts']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Schema: User');
      expect(allOutput).toContain('Schema: Post');
    });
  });
});

// =============================================================================
// Main Migrate Command Router Tests
// =============================================================================

describe('migrate command router', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show help when no subcommand is provided', async () => {
    const { migrate } = await import('../commands/migrate.js');

    try {
      await migrate([]);
    } catch {
      // process.exit throws
    }

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('ice migrate');
    expect(allOutput).toContain('generate');
    expect(allOutput).toContain('diff');
    expect(allOutput).toContain('plan');
  });

  it('should show help with --help flag', async () => {
    const { migrate } = await import('../commands/migrate.js');

    try {
      await migrate(['--help']);
    } catch {
      // process.exit throws
    }

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('ice migrate');
  });

  it('should error on unknown subcommand', async () => {
    const { migrate } = await import('../commands/migrate.js');

    try {
      await migrate(['unknown']);
    } catch {
      // process.exit throws
    }

    expect(mockConsoleError).toHaveBeenCalledWith('Unknown migrate subcommand: unknown');
  });
});
