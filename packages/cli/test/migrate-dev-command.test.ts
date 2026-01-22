/**
 * Migrate Dev Command Tests for @icetype/cli
 *
 * Tests for the `ice migrate dev` command - an interactive migration workflow
 * similar to Prisma's `prisma migrate dev` command.
 *
 * Expected UX flow:
 * ```
 * $ ice migrate dev --schema ./schema.ts --dialect postgres
 *
 * Detected changes:
 * + Added field 'email' to User
 * ~ Changed 'age' from int to long
 *
 * Generated migration: 20240121_add_email_widen_age.sql
 *
 * Apply this migration? [y/N]
 * ```
 *
 * RED PHASE: These tests are expected to FAIL because:
 * - `ice migrate dev` command doesn't exist yet
 * - Interactive prompts not implemented
 * - Migration application logic not implemented
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
    mkdirSync: vi.fn(),
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
// Migrate Dev Command Tests
// =============================================================================

describe('migrate dev command', () => {
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
  // Command Existence Tests
  // ===========================================================================

  describe('command existence', () => {
    it('should export migrateDev function', async () => {
      // This test verifies the migrate dev command exists
      const migrateModule = await import('../commands/migrate.js');

      expect(migrateModule.migrateDev).toBeDefined();
      expect(typeof migrateModule.migrateDev).toBe('function');
    });

    it('should be registered as a subcommand in migrate router', async () => {
      const { migrate } = await import('../commands/migrate.js');

      try {
        await migrate(['dev', '--help']);
      } catch {
        // process.exit throws
      }

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('ice migrate dev');
    });
  });

  // ===========================================================================
  // Schema Change Detection Tests
  // ===========================================================================

  describe('schema change detection', () => {
    it('should detect schema changes from database state', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Schema with a new field that doesn't exist in database
      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Detected changes');
    });

    it('should display added fields in change summary', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show added fields with + prefix
      expect(allOutput).toMatch(/\+.*Added field/);
    });

    it('should display modified fields in change summary', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Schema with type change (int -> long)
      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('age', createField('age', 'long', { modifier: '!' })); // Changed from int
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show modified fields with ~ prefix
      expect(allOutput).toMatch(/~.*Changed/);
    });

    it('should display removed fields in change summary', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Schema with fewer fields than database (field removed)
      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      // 'name' field was removed
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show removed fields with - prefix
      expect(allOutput).toMatch(/-.*Removed field/);
    });
  });

  // ===========================================================================
  // Migration Generation Tests
  // ===========================================================================

  describe('migration generation', () => {
    it('should generate migration file automatically', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Generated migration');
    });

    it('should use timestamp-based migration filename', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show migration filename with timestamp pattern YYYYMMDD_
      expect(allOutput).toMatch(/\d{8}_.*\.sql/);
    });

    it('should save migration to migrations directory', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      // Should write to migrations directory
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/migrations.*\.sql$/),
        expect.any(String)
      );
    });

    it('should create migrations directory if it does not exist', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('migrations'),
        expect.objectContaining({ recursive: true })
      );
    });
  });

  // ===========================================================================
  // Migration Application Tests
  // ===========================================================================

  describe('migration application', () => {
    it('should show what will be applied before applying', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres', '--yes']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show SQL that will be applied
      expect(allOutput).toContain('ALTER TABLE');
    });

    it('should apply migration when --yes flag is provided', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres', '--yes']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Migration applied successfully');
    });

    it('should prompt for confirmation by default (without --yes)', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Apply this migration?');
    });
  });

  // ===========================================================================
  // Dry Run Mode Tests
  // ===========================================================================

  describe('dry run mode', () => {
    it('should support --dry-run flag', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres', '--dry-run']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Dry run');
    });

    it('should show changes without applying in dry-run mode', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres', '--dry-run']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show changes but not apply
      expect(allOutput).toContain('Detected changes');
      expect(allOutput).not.toContain('Migration applied');
    });

    it('should not write migration file in dry-run mode', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres', '--dry-run']);

      // Should NOT write migration file in dry-run mode
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Error Handling - No Changes
  // ===========================================================================

  describe('error handling - no changes', () => {
    it('should report when no changes are detected', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Schema that matches database state (no changes)
      // Must include 'name' because the mock DB state always has 'name'
      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('name', createField('name', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('No changes detected');
    });

    it('should not generate migration file when no changes', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Schema that matches database state (no changes)
      // Must include 'name' because the mock DB state always has 'name'
      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('name', createField('name', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      // Should not write migration file when no changes
      expect(fs.writeFileSync).not.toHaveBeenCalledWith(
        expect.stringContaining('migrations'),
        expect.any(String)
      );
    });
  });

  // ===========================================================================
  // Error Handling - Breaking Changes
  // ===========================================================================

  describe('error handling - breaking changes', () => {
    it('should warn about destructive changes', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Schema with field removed (destructive)
      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      // 'email' field was removed - destructive change
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toMatch(/WARNING.*destructive|BREAKING CHANGE|data loss/i);
    });

    it('should require explicit confirmation for breaking changes', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      // Schema with column type narrowing (potentially data loss)
      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('count', createField('count', 'int', { modifier: '!' })); // Narrowed from long
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should require explicit confirmation
      expect(allOutput).toContain('This migration contains breaking changes');
    });

    it('should allow --force to bypass breaking change confirmation', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      // --force should allow bypassing breaking change confirmation
      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres', '--force', '--yes']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Migration applied');
    });
  });

  // ===========================================================================
  // Required Arguments Tests
  // ===========================================================================

  describe('required arguments', () => {
    it('should error when --schema is not provided', async () => {
      const { migrateDev } = await import('../commands/migrate.js');

      await expect(migrateDev(['--dialect', 'postgres'])).rejects.toThrow(
        '--schema is required'
      );
    });

    it('should error when --dialect is not provided', async () => {
      const { migrateDev } = await import('../commands/migrate.js');

      await expect(migrateDev(['--schema', './schema.ts'])).rejects.toThrow(
        '--dialect is required'
      );
    });

    it('should error with unsupported dialect', async () => {
      const { migrateDev } = await import('../commands/migrate.js');

      await expect(
        migrateDev(['--schema', './schema.ts', '--dialect', 'oracle'])
      ).rejects.toThrow('Invalid value');
    });
  });

  // ===========================================================================
  // Help Text Tests
  // ===========================================================================

  describe('help text', () => {
    it('should show help when --help flag is provided', async () => {
      const { migrateDev } = await import('../commands/migrate.js');

      try {
        await migrateDev(['--help']);
      } catch {
        // process.exit throws
      }

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('ice migrate dev');
      expect(allOutput).toContain('--schema');
      expect(allOutput).toContain('--dialect');
      expect(allOutput).toContain('--dry-run');
      expect(allOutput).toContain('--yes');
    });

    it('should show -h short help flag', async () => {
      const { migrateDev } = await import('../commands/migrate.js');

      try {
        await migrateDev(['-h']);
      } catch {
        // process.exit throws
      }

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('ice migrate dev');
    });
  });

  // ===========================================================================
  // Database Connection Tests
  // ===========================================================================

  describe('database connection', () => {
    it('should support --database-url option', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev([
        '--schema', './schema.ts',
        '--dialect', 'postgres',
        '--database-url', 'postgres://localhost:5432/testdb',
        '--dry-run',
      ]);

      // Should not throw - command should accept database-url option
      expect(true).toBe(true);
    });

    it('should support --db short flag for database-url', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev([
        '--schema', './schema.ts',
        '--dialect', 'postgres',
        '--db', 'postgres://localhost:5432/testdb',
        '--dry-run',
      ]);

      // Should not throw - command should accept -db short option
      expect(true).toBe(true);
    });
  });

  // ===========================================================================
  // Migration Directory Options Tests
  // ===========================================================================

  describe('migration directory options', () => {
    it('should support --migrations-dir option', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev([
        '--schema', './schema.ts',
        '--dialect', 'postgres',
        '--migrations-dir', './custom-migrations',
        '--yes',
      ]);

      // Should write to custom migrations directory
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('custom-migrations'),
        expect.any(String)
      );
    });
  });

  // ===========================================================================
  // Output Format Tests
  // ===========================================================================

  describe('output format', () => {
    it('should support --json flag for JSON output', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev([
        '--schema', './schema.ts',
        '--dialect', 'postgres',
        '--json',
        '--dry-run',
      ]);

      // Find the JSON output
      const jsonOutput = mockConsoleLog.mock.calls
        .map((c) => c[0])
        .find((output: string) => output && output.trim().startsWith('{'));
      expect(jsonOutput).toBeDefined();

      const parsed = JSON.parse(jsonOutput);
      expect(parsed.changes).toBeDefined();
      expect(parsed.migrationFile).toBeDefined();
    });

    it('should support --quiet flag to suppress informational output', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev([
        '--schema', './schema.ts',
        '--dialect', 'postgres',
        '--quiet',
      ]);

      // With --quiet, should have minimal output
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).not.toContain('Loading schema');
    });
  });

  // ===========================================================================
  // Migration Naming Tests
  // ===========================================================================

  describe('migration naming', () => {
    it('should support --name flag for custom migration name', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev([
        '--schema', './schema.ts',
        '--dialect', 'postgres',
        '--name', 'add_user_email',
        '--yes',
      ]);

      // Should use custom name in migration filename
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('add_user_email'),
        expect.any(String)
      );
    });

    it('should auto-generate descriptive migration name from changes', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      fields.set('age', createField('age', 'int', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev(['--schema', './schema.ts', '--dialect', 'postgres', '--yes']);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should auto-generate descriptive name
      expect(allOutput).toMatch(/Generated migration:.*add_email|add_age/);
    });
  });
});

// =============================================================================
// Main Migrate Command Router Tests for 'dev' subcommand
// =============================================================================

describe('migrate command router - dev subcommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should list dev in available subcommands', async () => {
    const { migrate } = await import('../commands/migrate.js');

    try {
      await migrate([]);
    } catch {
      // process.exit throws
    }

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('dev');
  });

  it('should route to dev subcommand', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    const { migrate } = await import('../commands/migrate.js');

    await migrate(['dev', '--schema', './schema.ts', '--dialect', 'postgres', '--dry-run']);

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    // Should process the dev command (not error as unknown subcommand)
    expect(mockConsoleError).not.toHaveBeenCalledWith('Unknown migrate subcommand: dev');
  });
});
