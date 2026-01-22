/**
 * Migrate Status Command Tests for @icetype/cli
 *
 * Tests for the `ice migrate status` command - shows pending migrations,
 * applied migrations, and database state comparison.
 *
 * Expected output format:
 * ```
 * Migration Status:
 *
 * Database: postgres://localhost/mydb
 * Schema: ./schema.ts
 *
 * Applied migrations: 3
 * Pending migrations: 2
 *
 * Pending:
 *   - 20240120_add_email.sql
 *   - 20240121_add_age.sql
 * ```
 *
 * RED PHASE: These tests are expected to FAIL because:
 * - `ice migrate status` command doesn't exist yet
 * - Migration tracking table not implemented
 * - Migration directory reading not implemented
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
    readdirSync: vi.fn(),
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
// Migrate Status Command Tests
// =============================================================================

describe('migrate status command', () => {
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
    it('should export migrateStatus function', async () => {
      // This test verifies the migrate status command exists
      const migrateModule = await import('../commands/migrate.js');

      expect(migrateModule.migrateStatus).toBeDefined();
      expect(typeof migrateModule.migrateStatus).toBe('function');
    });

    it('should be registered as a subcommand in migrate router', async () => {
      const { migrate } = await import('../commands/migrate.js');

      try {
        await migrate(['status', '--help']);
      } catch {
        // process.exit throws
      }

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('ice migrate status');
    });
  });

  // ===========================================================================
  // Pending Migrations Count Tests
  // ===========================================================================

  describe('pending migrations count', () => {
    it('should show pending migrations count', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      // Mock migrations directory with 2 pending migrations
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_name.sql',
        '20240120_add_email.sql',
        '20240121_add_age.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Pending migrations:');
      expect(allOutput).toMatch(/Pending migrations:\s*2/);
    });

    it('should show zero pending migrations when all are applied', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_name.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
        '--database-url',
        'postgres://localhost/mydb',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Pending migrations: 0');
    });
  });

  // ===========================================================================
  // Applied Migrations List Tests
  // ===========================================================================

  describe('applied migrations list', () => {
    it('should show applied migrations list', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_name.sql',
        '20240120_add_email.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Applied migrations:');
      expect(allOutput).toMatch(/Applied migrations:\s*\d+/);
    });

    it('should list individual applied migrations', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_name.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
        '--verbose',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('20240118_init.sql');
      expect(allOutput).toContain('20240119_add_name.sql');
    });
  });

  // ===========================================================================
  // Current Schema Version Tests
  // ===========================================================================

  describe('current schema version', () => {
    it('should show current schema version', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_name.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show version info either as latest migration or schema version
      expect(allOutput).toMatch(/version|Version/i);
    });

    it('should show schema path in status output', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Schema:');
      expect(allOutput).toContain('./schema.ts');
    });
  });

  // ===========================================================================
  // Database State Comparison Tests
  // ===========================================================================

  describe('database state comparison', () => {
    it('should show database connection info', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
        '--database-url',
        'postgres://localhost/mydb',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Database:');
      expect(allOutput).toContain('postgres://localhost/mydb');
    });

    it('should indicate when database is up to date with schema', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // When all migrations are applied, should indicate up-to-date status
      expect(allOutput).toMatch(/up.to.date|synced|current/i);
    });

    it('should indicate when database has pending migrations', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_name.sql',
        '20240120_add_email.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Pending:');
      expect(allOutput).toContain('20240120_add_email.sql');
    });
  });

  // ===========================================================================
  // JSON Output Flag Tests
  // ===========================================================================

  describe('--json flag', () => {
    it('should output JSON format when --json flag is provided', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_name.sql',
        '20240120_add_email.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
        '--json',
      ]);

      // Find the JSON output
      const jsonOutput = mockConsoleLog.mock.calls
        .map((c) => c[0])
        .find((output: string) => output && output.trim().startsWith('{'));

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed).toHaveProperty('appliedMigrations');
      expect(parsed).toHaveProperty('pendingMigrations');
    });

    it('should include migration counts in JSON output', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_name.sql',
        '20240120_add_email.sql',
        '20240121_add_age.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
        '--json',
      ]);

      const jsonOutput = mockConsoleLog.mock.calls
        .map((c) => c[0])
        .find((output: string) => output && output.trim().startsWith('{'));

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(typeof parsed.appliedCount).toBe('number');
      expect(typeof parsed.pendingCount).toBe('number');
    });

    it('should include schema path in JSON output', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
        '--json',
      ]);

      const jsonOutput = mockConsoleLog.mock.calls
        .map((c) => c[0])
        .find((output: string) => output && output.trim().startsWith('{'));

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.schema).toBe('./schema.ts');
    });
  });

  // ===========================================================================
  // No Migrations Directory Tests
  // ===========================================================================

  describe('no migrations directory', () => {
    it('should handle non-existent migrations directory', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toMatch(/no migrations|directory not found|not initialized/i);
    });

    it('should show helpful message when migrations directory does not exist', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './nonexistent-migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should suggest running migrate dev or creating directory
      expect(allOutput).toMatch(/migrate dev|create|initialize/i);
    });
  });

  // ===========================================================================
  // Empty Migrations Directory Tests
  // ===========================================================================

  describe('empty migrations directory', () => {
    it('should handle empty migrations directory', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Applied migrations: 0');
      expect(allOutput).toContain('Pending migrations: 0');
    });

    it('should show zero applied and pending for empty directory', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
        '--json',
      ]);

      const jsonOutput = mockConsoleLog.mock.calls
        .map((c) => c[0])
        .find((output: string) => output && output.trim().startsWith('{'));

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.appliedCount).toBe(0);
      expect(parsed.pendingCount).toBe(0);
      expect(parsed.appliedMigrations).toEqual([]);
      expect(parsed.pendingMigrations).toEqual([]);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should require --schema option', async () => {
      const { migrateStatus } = await import('../commands/migrate.js');

      await expect(migrateStatus(['--migrations-dir', './migrations'])).rejects.toThrow(
        '--schema is required'
      );
    });

    it('should error when schema file has load errors', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockResolvedValue({
        schemas: [],
        errors: ['File not found: ./schema.ts'],
      });

      const { migrateStatus } = await import('../commands/migrate.js');

      await expect(
        migrateStatus(['--schema', './schema.ts', '--migrations-dir', './migrations'])
      ).rejects.toThrow('File not found');
    });

    it('should error when schema file has no schemas', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();
      loadSchemaFile.mockResolvedValue({
        schemas: [],
        errors: [],
      });

      const { migrateStatus } = await import('../commands/migrate.js');

      await expect(
        migrateStatus(['--schema', './schema.ts', '--migrations-dir', './migrations'])
      ).rejects.toThrow('No schemas found');
    });
  });

  // ===========================================================================
  // Help Text Tests
  // ===========================================================================

  describe('help text', () => {
    it('should show help when --help flag is provided', async () => {
      const { migrateStatus } = await import('../commands/migrate.js');

      try {
        await migrateStatus(['--help']);
      } catch {
        // process.exit throws
      }

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('ice migrate status');
      expect(allOutput).toContain('--schema');
      expect(allOutput).toContain('--migrations-dir');
    });

    it('should show usage examples in help', async () => {
      const { migrateStatus } = await import('../commands/migrate.js');

      try {
        await migrateStatus(['--help']);
      } catch {
        // process.exit throws
      }

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Example');
    });
  });

  // ===========================================================================
  // Output Format Tests
  // ===========================================================================

  describe('output format', () => {
    it('should display Migration Status header', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Migration Status');
    });

    it('should list pending migrations with bullet points', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_name.sql',
        '20240120_add_email.sql',
        '20240121_add_age.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateStatus } = await import('../commands/migrate.js');

      await migrateStatus([
        '--schema',
        './schema.ts',
        '--migrations-dir',
        './migrations',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Pending:');
      // Should list pending migrations with dashes or bullets
      expect(allOutput).toMatch(/[-*]\s*20240120_add_email\.sql/);
      expect(allOutput).toMatch(/[-*]\s*20240121_add_age\.sql/);
    });
  });
});

// =============================================================================
// Main Migrate Command Router Tests for Status
// =============================================================================

describe('migrate command router - status subcommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should route to status subcommand', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '20240118_init.sql',
    ] as unknown as fs.Dirent[]);

    const { migrate } = await import('../commands/migrate.js');

    await migrate([
      'status',
      '--schema',
      './schema.ts',
      '--migrations-dir',
      './migrations',
    ]);

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Migration Status');
  });

  it('should list status in migrate help', async () => {
    const { migrate } = await import('../commands/migrate.js');

    try {
      await migrate(['--help']);
    } catch {
      // process.exit throws
    }

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('status');
  });
});
