/**
 * Migrate Dry-Run Tests for @icetype/cli
 *
 * Tests for the `--dry-run` flag across all migrate subcommands.
 * The dry-run flag shows what would happen without actually executing.
 *
 * Expected behavior:
 * - --dry-run shows SQL without executing
 * - --dry-run shows migration plan
 * - --dry-run doesn't modify database
 * - --dry-run works with all subcommands (up, down, status)
 * - Combine with --verbose for more detail
 *
 * RED PHASE: These tests are expected to FAIL because:
 * - `ice migrate up` command doesn't exist yet
 * - `ice migrate down` command doesn't exist yet
 * - `ice migrate status` with --dry-run not implemented
 * - Full dry-run semantics not implemented across all commands
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';
import type { LoadResult } from '../utils/schema-loader.js';

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
// Dry Run Shows SQL Without Executing
// =============================================================================

describe('--dry-run shows SQL without executing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('migrate up --dry-run', () => {
    it('should show SQL statements that would be executed', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_email.sql',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(
        'ALTER TABLE User ADD COLUMN email TEXT NOT NULL;'
      );

      const { migrateUp } = await import('../commands/migrate.js');

      await migrateUp([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show the SQL that would be executed
      expect(allOutput).toContain('ALTER TABLE');
      expect(allOutput).toContain('email');
    });

    it('should not execute SQL in dry-run mode', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue('CREATE TABLE User (id UUID PRIMARY KEY);');

      const { migrateUp } = await import('../commands/migrate.js');

      await migrateUp([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should indicate dry-run mode
      expect(allOutput).toMatch(/dry.run|would be|preview/i);
      // Should NOT indicate actual execution
      expect(allOutput).not.toMatch(/executed|applied|success/i);
    });

    it('should display which migration files would be applied', async () => {
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

      const { migrateUp } = await import('../commands/migrate.js');

      await migrateUp([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should list migration files that would be applied
      expect(allOutput).toContain('20240119_add_name.sql');
      expect(allOutput).toContain('20240120_add_email.sql');
    });
  });

  describe('migrate down --dry-run', () => {
    it('should show rollback SQL that would be executed', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_email.sql',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '-- UP\nALTER TABLE User ADD COLUMN email TEXT;\n-- DOWN\nALTER TABLE User DROP COLUMN email;'
      );

      const { migrateDown } = await import('../commands/migrate.js');

      await migrateDown([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show the rollback SQL
      expect(allOutput).toContain('DROP COLUMN');
    });

    it('should not execute rollback in dry-run mode', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateDown } = await import('../commands/migrate.js');

      await migrateDown([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should indicate dry-run mode, not actual execution
      expect(allOutput).toMatch(/dry.run|would be|preview/i);
      expect(allOutput).not.toMatch(/rolled back|reverted|success/i);
    });
  });
});

// =============================================================================
// Dry Run Shows Migration Plan
// =============================================================================

describe('--dry-run shows migration plan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show the complete migration plan in dry-run mode', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    fields.set('email', createField('email', 'string', { modifier: '!' }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '20240118_init.sql',
      '20240119_add_email.sql',
      '20240120_add_age.sql',
    ] as unknown as fs.Dirent[]);

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
    ]);

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    // Should show migration plan header
    expect(allOutput).toMatch(/plan|Plan|PLAN/);
    // Should show number of migrations to apply
    expect(allOutput).toMatch(/\d+\s*migration/i);
  });

  it('should show step-by-step migration order in dry-run mode', async () => {
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

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
    ]);

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    // Migrations should appear in order
    const initIndex = allOutput.indexOf('20240118_init.sql');
    const nameIndex = allOutput.indexOf('20240119_add_name.sql');
    const emailIndex = allOutput.indexOf('20240120_add_email.sql');

    // At least some should appear if there are pending migrations
    expect(nameIndex > -1 || emailIndex > -1).toBe(true);
    // If both appear, they should be in order
    if (nameIndex > -1 && emailIndex > -1) {
      expect(nameIndex).toBeLessThan(emailIndex);
    }
  });

  it('should show estimated changes summary in dry-run mode', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    fields.set('email', createField('email', 'string', { modifier: '!' }));
    fields.set('age', createField('age', 'int', { modifier: '!' }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '20240118_add_fields.sql',
    ] as unknown as fs.Dirent[]);
    vi.mocked(fs.readFileSync).mockReturnValue(
      'ALTER TABLE User ADD COLUMN email TEXT;\nALTER TABLE User ADD COLUMN age INTEGER;'
    );

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
    ]);

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    // Should show summary of changes
    expect(allOutput).toMatch(/changes|statements|operations/i);
  });
});

// =============================================================================
// Dry Run Doesn't Modify Database
// =============================================================================

describe("--dry-run doesn't modify database", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not write migration tracking records in dry-run mode', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '20240118_init.sql',
    ] as unknown as fs.Dirent[]);

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
    ]);

    // In dry-run mode, should not write any files
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should not update migration history table in dry-run mode', async () => {
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

    const { migrateUp } = await import('../commands/migrate.js');

    // First, check status before dry-run
    const { migrateStatus } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
    ]);

    // Clear output and check status again
    mockConsoleLog.mockClear();

    await migrateStatus([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
    ]);

    const statusOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    // Pending count should still be > 0 because dry-run didn't apply anything
    expect(statusOutput).toMatch(/pending/i);
  });

  it('should not create new files in dry-run mode for migrate dev', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    fields.set('email', createField('email', 'string', { modifier: '!' }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(false);

    const { migrateDev } = await import('../commands/migrate.js');

    await migrateDev([
      '--schema', './schema.ts',
      '--dialect', 'postgres',
      '--dry-run',
    ]);

    // Should NOT write migration file in dry-run mode
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    // Should NOT create migrations directory
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('should not modify lock files in dry-run mode', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '20240118_init.sql',
    ] as unknown as fs.Dirent[]);

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
    ]);

    // Check no lock-related files were written
    const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
    const lockFileWrites = writeCalls.filter(
      (call) => String(call[0]).includes('lock') || String(call[0]).includes('.lock')
    );
    expect(lockFileWrites).toHaveLength(0);
  });
});

// =============================================================================
// Dry Run Works With All Subcommands
// =============================================================================

describe('--dry-run works with all subcommands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('migrate up --dry-run', () => {
    it('should export migrateUp function', async () => {
      const migrateModule = await import('../commands/migrate.js');
      expect(migrateModule.migrateUp).toBeDefined();
      expect(typeof migrateModule.migrateUp).toBe('function');
    });

    it('should accept --dry-run flag', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateUp } = await import('../commands/migrate.js');

      // Should not throw when --dry-run is provided
      await expect(
        migrateUp([
          '--schema', './schema.ts',
          '--migrations-dir', './migrations',
          '--dry-run',
        ])
      ).resolves.not.toThrow();
    });

    it('should show --dry-run in help text', async () => {
      const { migrateUp } = await import('../commands/migrate.js');

      try {
        await migrateUp(['--help']);
      } catch {
        // process.exit throws
      }

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('--dry-run');
    });
  });

  describe('migrate down --dry-run', () => {
    it('should export migrateDown function', async () => {
      const migrateModule = await import('../commands/migrate.js');
      expect(migrateModule.migrateDown).toBeDefined();
      expect(typeof migrateModule.migrateDown).toBe('function');
    });

    it('should accept --dry-run flag', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateDown } = await import('../commands/migrate.js');

      // Should not throw when --dry-run is provided
      await expect(
        migrateDown([
          '--schema', './schema.ts',
          '--migrations-dir', './migrations',
          '--dry-run',
        ])
      ).resolves.not.toThrow();
    });

    it('should show --dry-run in help text', async () => {
      const { migrateDown } = await import('../commands/migrate.js');

      try {
        await migrateDown(['--help']);
      } catch {
        // process.exit throws
      }

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('--dry-run');
    });

    it('should support --step flag with --dry-run', async () => {
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

      const { migrateDown } = await import('../commands/migrate.js');

      await migrateDown([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
        '--step', '2',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should indicate it would roll back 2 migrations
      expect(allOutput).toMatch(/2|two/i);
    });
  });

  describe('migrate status --dry-run', () => {
    it('should export migrateStatus function', async () => {
      const migrateModule = await import('../commands/migrate.js');
      expect(migrateModule.migrateStatus).toBeDefined();
      expect(typeof migrateModule.migrateStatus).toBe('function');
    });

    it('should accept --dry-run flag (though status is inherently read-only)', async () => {
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

      // Should not throw when --dry-run is provided (status is already read-only)
      await expect(
        migrateStatus([
          '--schema', './schema.ts',
          '--migrations-dir', './migrations',
          '--dry-run',
        ])
      ).resolves.not.toThrow();
    });
  });

  describe('migrate dev --dry-run', () => {
    it('should already support --dry-run flag', async () => {
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
        '--dry-run',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Dry run');
    });
  });

  describe('main migrate router', () => {
    it('should route up subcommand with --dry-run', async () => {
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
        'up',
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
      ]);

      // Should not error as unknown subcommand
      expect(mockConsoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('Unknown migrate subcommand: up')
      );
    });

    it('should route down subcommand with --dry-run', async () => {
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
        'down',
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
      ]);

      // Should not error as unknown subcommand
      expect(mockConsoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('Unknown migrate subcommand: down')
      );
    });
  });
});

// =============================================================================
// Combine With --verbose For More Detail
// =============================================================================

describe('combine --dry-run with --verbose for more detail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('migrate up --dry-run --verbose', () => {
    it('should show additional detail with --verbose flag', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_email.sql',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(
        'ALTER TABLE User ADD COLUMN email TEXT NOT NULL;'
      );

      const { migrateUp } = await import('../commands/migrate.js');

      // First run without verbose
      await migrateUp([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
      ]);

      const normalOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      mockConsoleLog.mockClear();

      // Then run with verbose
      await migrateUp([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
        '--verbose',
      ]);

      const verboseOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');

      // Verbose output should be longer or contain more detail
      expect(verboseOutput.length).toBeGreaterThanOrEqual(normalOutput.length);
    });

    it('should show full SQL content with --verbose', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '-- Migration: init\nCREATE TABLE User (\n  id UUID PRIMARY KEY,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);'
      );

      const { migrateUp } = await import('../commands/migrate.js');

      await migrateUp([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
        '--verbose',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // With verbose, should show full SQL including comments
      expect(allOutput).toContain('CREATE TABLE');
      expect(allOutput).toContain('id UUID');
    });

    it('should show file paths with --verbose', async () => {
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

      const { migrateUp } = await import('../commands/migrate.js');

      await migrateUp([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
        '--verbose',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show paths to migration files
      expect(allOutput).toMatch(/migrations.*\.sql/);
    });

    it('should show timing estimates with --verbose', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateUp } = await import('../commands/migrate.js');

      await migrateUp([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
        '--verbose',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Verbose mode might show timing or statement count info
      expect(allOutput).toMatch(/statement|operation|step/i);
    });
  });

  describe('migrate down --dry-run --verbose', () => {
    it('should show detailed rollback information', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_email.sql',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '-- UP\nALTER TABLE User ADD COLUMN email TEXT;\n-- DOWN\nALTER TABLE User DROP COLUMN email;'
      );

      const { migrateDown } = await import('../commands/migrate.js');

      await migrateDown([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
        '--verbose',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show detailed rollback SQL
      expect(allOutput).toContain('DROP COLUMN');
    });

    it('should show dependency warnings with --verbose', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '20240118_init.sql',
        '20240119_add_fk.sql',
      ] as unknown as fs.Dirent[]);

      const { migrateDown } = await import('../commands/migrate.js');

      await migrateDown([
        '--schema', './schema.ts',
        '--migrations-dir', './migrations',
        '--dry-run',
        '--verbose',
      ]);

      // Verbose should provide more context about what will happen
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput.length).toBeGreaterThan(0);
    });
  });

  describe('migrate dev --dry-run --verbose', () => {
    it('should show detailed schema analysis', async () => {
      const loadSchemaFile = await getMockedLoadSchemaFile();

      const fields = new Map<string, FieldDefinition>();
      fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
      fields.set('email', createField('email', 'string', { modifier: '!' }));
      fields.set('age', createField('age', 'int'));
      const schema = createSchema('User', fields);

      loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

      const { migrateDev } = await import('../commands/migrate.js');

      await migrateDev([
        '--schema', './schema.ts',
        '--dialect', 'postgres',
        '--dry-run',
      ]);

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      // Should show detected changes
      expect(allOutput).toContain('Detected changes');
    });
  });
});

// =============================================================================
// JSON Output With Dry Run
// =============================================================================

describe('--dry-run with --json output', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should output valid JSON in dry-run mode', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    fields.set('email', createField('email', 'string', { modifier: '!' }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '20240118_init.sql',
    ] as unknown as fs.Dirent[]);

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
      '--json',
    ]);

    const jsonOutput = mockConsoleLog.mock.calls
      .map((c) => c[0])
      .find((output: string) => output && output.trim().startsWith('{'));

    expect(jsonOutput).toBeDefined();
    expect(() => JSON.parse(jsonOutput)).not.toThrow();
  });

  it('should include dryRun flag in JSON output', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '20240118_init.sql',
    ] as unknown as fs.Dirent[]);

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
      '--json',
    ]);

    const jsonOutput = mockConsoleLog.mock.calls
      .map((c) => c[0])
      .find((output: string) => output && output.trim().startsWith('{'));

    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.dryRun).toBe(true);
  });

  it('should include migration list in JSON output', async () => {
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

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
      '--json',
    ]);

    const jsonOutput = mockConsoleLog.mock.calls
      .map((c) => c[0])
      .find((output: string) => output && output.trim().startsWith('{'));

    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.migrations).toBeDefined();
    expect(Array.isArray(parsed.migrations)).toBe(true);
  });

  it('should include SQL statements in JSON output', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '20240118_init.sql',
    ] as unknown as fs.Dirent[]);
    vi.mocked(fs.readFileSync).mockReturnValue('CREATE TABLE User (id UUID PRIMARY KEY);');

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
      '--json',
    ]);

    const jsonOutput = mockConsoleLog.mock.calls
      .map((c) => c[0])
      .find((output: string) => output && output.trim().startsWith('{'));

    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.sql || parsed.statements).toBeDefined();
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('--dry-run edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty migrations directory in dry-run mode', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([]);

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
    ]);

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    // Should indicate no migrations to apply
    expect(allOutput).toMatch(/no.*migration|up.to.date|nothing/i);
  });

  it('should handle non-existent migrations directory in dry-run mode', async () => {
    const loadSchemaFile = await getMockedLoadSchemaFile();

    const fields = new Map<string, FieldDefinition>();
    fields.set('id', createField('id', 'uuid', { modifier: '!', isUnique: true }));
    const schema = createSchema('User', fields);

    loadSchemaFile.mockResolvedValue(createLoadResult([schema]));

    vi.mocked(fs.existsSync).mockReturnValue(false);

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './nonexistent',
      '--dry-run',
    ]);

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    // Should handle gracefully
    expect(allOutput).toMatch(/not found|does not exist|no migrations/i);
  });

  it('should work with --dry-run and --target flag', async () => {
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

    const { migrateUp } = await import('../commands/migrate.js');

    await migrateUp([
      '--schema', './schema.ts',
      '--migrations-dir', './migrations',
      '--dry-run',
      '--target', '20240119_add_name.sql',
    ]);

    const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
    // Should show only up to target migration
    expect(allOutput).toContain('20240119_add_name.sql');
    // Should not include migrations after target
    expect(allOutput).not.toContain('20240120_add_email.sql');
  });
});
