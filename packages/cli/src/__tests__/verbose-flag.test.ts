/**
 * Verbose Flag Tests for @icetype/cli
 *
 * TDD tests for the --verbose/-v flag behavior across all CLI commands.
 * Verifies that verbose mode enables debug logging with timing info,
 * file paths, and detailed processing information.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
 * Check if debug-level logging was called (debug logs include timestamps)
 * Debug logs are formatted with timestamps like "HH:MM:SS.mmm"
 */
function hasDebugLog(mockFn: ReturnType<typeof vi.spyOn>): boolean {
  return mockFn.mock.calls.some(call => {
    const msg = String(call[0]);
    // Debug logs include timestamps in format HH:MM:SS.mmm
    return /\d{2}:\d{2}:\d{2}\.\d{3}/.test(msg);
  });
}

/**
 * Get all log messages as strings
 */
function getLogMessages(mockFn: ReturnType<typeof vi.spyOn>): string[] {
  return mockFn.mock.calls.map(call => String(call[0]));
}

// =============================================================================
// Verbose Flag Behavior Tests
// =============================================================================

describe('--verbose flag behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Generate Command Verbose Tests
  // ===========================================================================

  describe('generate command', () => {
    it('should show debug-level logging with timestamps when --verbose is set', async () => {
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

      await generate(['--schema', './schema.ts', '--verbose']);

      // Verbose mode should show debug logs with timestamps
      expect(hasDebugLog(mockConsoleLog)).toBe(true);
    });

    it('should show file paths being processed in verbose mode', async () => {
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

      await generate(['--schema', './my-schema.ts', '--verbose']);

      const logs = getLogMessages(mockConsoleLog);
      // Should log the schema path and output path in debug messages
      expect(logs.some(log => log.includes('schemaPath') || log.includes('outputPath') || log.includes('my-schema'))).toBe(true);
    });

    it('should show schema count in verbose mode', async () => {
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
          schemas: [
            { name: 'User', schema: mockSchema },
            { name: 'Post', schema: createValidSchema('Post') },
          ],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await generate(['--schema', './schema.ts', '--verbose']);

      const logs = getLogMessages(mockConsoleLog);
      // Should log the number of schemas found
      expect(logs.some(log => log.includes('2') && log.includes('schema'))).toBe(true);
    });

    it('should NOT show debug logs without --verbose flag', async () => {
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

      await generate(['--schema', './schema.ts']);

      // Without verbose, should NOT have debug logs (no timestamps)
      expect(hasDebugLog(mockConsoleLog)).toBe(false);
    });

    it('should support -v short flag for verbose mode', async () => {
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

      await generate(['--schema', './schema.ts', '-v']);

      // -v should enable debug logs with timestamps
      expect(hasDebugLog(mockConsoleLog)).toBe(true);
    });
  });

  // ===========================================================================
  // Validate Command Verbose Tests
  // ===========================================================================

  describe('validate command', () => {
    it('should show debug-level logging when --verbose is set', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
        };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schema.ts', '--verbose']);

      // Verbose mode should show debug logs with timestamps
      expect(hasDebugLog(mockConsoleLog)).toBe(true);
    });

    it('should show schema loading path in verbose mode', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
        };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schema.ts', '--verbose']);

      const logs = getLogMessages(mockConsoleLog);
      // Should log the file path being loaded
      expect(logs.some(log => log.includes('path') || log.includes('/path/to/schema.ts'))).toBe(true);
    });

    it('should show schema name being validated in verbose mode', async () => {
      const mockSchema = createValidSchema('MyEntity');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'MyEntity', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
        };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schema.ts', '--verbose']);

      const logs = getLogMessages(mockConsoleLog);
      // Should log the schema name being validated
      expect(logs.some(log => log.includes('MyEntity') || log.includes('name'))).toBe(true);
    });

    it('should NOT show debug logs without --verbose flag', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
        };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schema.ts']);

      // Without verbose, should NOT have debug logs (no timestamps)
      expect(hasDebugLog(mockConsoleLog)).toBe(false);
    });

    it('should support -v short flag for verbose mode', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          validateSchema: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
        };
      });

      const { validate } = await import('../commands/validate.js');

      await validate(['--schema', '/path/to/schema.ts', '-v']);

      // -v should enable debug logs with timestamps
      expect(hasDebugLog(mockConsoleLog)).toBe(true);
    });
  });

  // ===========================================================================
  // ClickHouse Command Verbose Tests
  // ===========================================================================

  describe('clickhouse export command', () => {
    it('should show debug-level logging when --verbose is set', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/adapter-registry.js', () => ({
        getAdapter: vi.fn().mockReturnValue({
          transform: vi.fn().mockReturnValue({
            tableName: 'User',
            columns: [],
            engine: 'MergeTree',
            orderBy: ['id'],
          }),
          serialize: vi.fn().mockReturnValue('CREATE TABLE User ...'),
        }),
      }));

      const { clickhouseExport } = await import('../commands/clickhouse.js');

      await clickhouseExport(['--schema', '/path/to/schema.ts', '--verbose']);

      // Verbose mode should show debug logs with timestamps
      expect(hasDebugLog(mockConsoleLog)).toBe(true);
    });

    it('should show options being used in verbose mode', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/adapter-registry.js', () => ({
        getAdapter: vi.fn().mockReturnValue({
          transform: vi.fn().mockReturnValue({
            tableName: 'User',
            columns: [],
            engine: 'MergeTree',
            orderBy: ['id'],
          }),
          serialize: vi.fn().mockReturnValue('CREATE TABLE User ...'),
        }),
      }));

      const { clickhouseExport } = await import('../commands/clickhouse.js');

      await clickhouseExport(['--schema', '/path/to/schema.ts', '--engine', 'ReplacingMergeTree', '--verbose']);

      const logs = getLogMessages(mockConsoleLog);
      // Should log the options (engine, database, output)
      expect(logs.some(log => log.includes('engine') || log.includes('ReplacingMergeTree'))).toBe(true);
    });

    it('should show schema processing details in verbose mode', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/adapter-registry.js', () => ({
        getAdapter: vi.fn().mockReturnValue({
          transform: vi.fn().mockReturnValue({
            tableName: 'User',
            columns: [{ name: 'id' }, { name: 'name' }],
            engine: 'MergeTree',
            orderBy: ['id'],
          }),
          serialize: vi.fn().mockReturnValue('CREATE TABLE User ...'),
        }),
      }));

      const { clickhouseExport } = await import('../commands/clickhouse.js');

      await clickhouseExport(['--schema', '/path/to/schema.ts', '--verbose']);

      const logs = getLogMessages(mockConsoleLog);
      // Should log processing details for each schema
      expect(logs.some(log => log.includes('Processing') || log.includes('User') || log.includes('columns'))).toBe(true);
    });

    it('should NOT show debug logs without --verbose flag', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/adapter-registry.js', () => ({
        getAdapter: vi.fn().mockReturnValue({
          transform: vi.fn().mockReturnValue({
            tableName: 'User',
            columns: [],
            engine: 'MergeTree',
            orderBy: ['id'],
          }),
          serialize: vi.fn().mockReturnValue('CREATE TABLE User ...'),
        }),
      }));

      const { clickhouseExport } = await import('../commands/clickhouse.js');

      await clickhouseExport(['--schema', '/path/to/schema.ts']);

      // Without verbose, should NOT have debug logs (no timestamps)
      expect(hasDebugLog(mockConsoleLog)).toBe(false);
    });
  });

  // ===========================================================================
  // DuckDB Command Verbose Tests
  // ===========================================================================

  describe('duckdb export command', () => {
    it('should show debug-level logging when --verbose is set', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/adapter-registry.js', () => ({
        getAdapter: vi.fn().mockReturnValue({
          transform: vi.fn().mockReturnValue({
            tableName: 'User',
            columns: [],
          }),
          serialize: vi.fn().mockReturnValue('CREATE TABLE User ...'),
          serializeWithIndexes: vi.fn().mockReturnValue('CREATE TABLE User ...'),
        }),
      }));

      const { duckdbExport } = await import('../commands/duckdb.js');

      await duckdbExport(['--schema', '/path/to/schema.ts', '--verbose']);

      // Verbose mode should show debug logs with timestamps
      expect(hasDebugLog(mockConsoleLog)).toBe(true);
    });

    it('should show schema name option in verbose mode when provided', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/adapter-registry.js', () => ({
        getAdapter: vi.fn().mockReturnValue({
          transform: vi.fn().mockReturnValue({
            tableName: 'User',
            columns: [],
          }),
          serialize: vi.fn().mockReturnValue('CREATE TABLE User ...'),
          serializeWithIndexes: vi.fn().mockReturnValue('CREATE TABLE User ...'),
        }),
      }));

      const { duckdbExport } = await import('../commands/duckdb.js');

      await duckdbExport(['--schema', '/path/to/schema.ts', '--schema-name', 'analytics', '--verbose']);

      const logs = getLogMessages(mockConsoleLog);
      // Should log schema name
      expect(logs.some(log => log.includes('analytics') || log.includes('schema'))).toBe(true);
    });

    it('should NOT show debug logs without --verbose flag', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/adapter-registry.js', () => ({
        getAdapter: vi.fn().mockReturnValue({
          transform: vi.fn().mockReturnValue({
            tableName: 'User',
            columns: [],
          }),
          serialize: vi.fn().mockReturnValue('CREATE TABLE User ...'),
          serializeWithIndexes: vi.fn().mockReturnValue('CREATE TABLE User ...'),
        }),
      }));

      const { duckdbExport } = await import('../commands/duckdb.js');

      await duckdbExport(['--schema', '/path/to/schema.ts']);

      // Without verbose, should NOT have debug logs (no timestamps)
      expect(hasDebugLog(mockConsoleLog)).toBe(false);
    });
  });

  // ===========================================================================
  // Postgres Command Verbose Tests
  // ===========================================================================

  describe('postgres export command', () => {
    it('should show debug-level logging when --verbose is set', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          getPostgresType: vi.fn().mockReturnValue('TEXT'),
        };
      });

      vi.doMock('@icetype/postgres', () => ({
        escapeIdentifier: vi.fn((name: string) => `"${name}"`),
      }));

      const { postgresExport } = await import('../commands/postgres.js');

      await postgresExport(['--schema', '/path/to/schema.ts', '--verbose']);

      // Verbose mode should show debug logs with timestamps
      expect(hasDebugLog(mockConsoleLog)).toBe(true);
    });

    it('should show file paths in verbose mode', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          getPostgresType: vi.fn().mockReturnValue('TEXT'),
        };
      });

      vi.doMock('@icetype/postgres', () => ({
        escapeIdentifier: vi.fn((name: string) => `"${name}"`),
      }));

      const { postgresExport } = await import('../commands/postgres.js');

      await postgresExport(['--schema', '/my/custom/path.ts', '--verbose']);

      const logs = getLogMessages(mockConsoleLog);
      // Should show schema path in verbose mode
      expect(logs.some(log => log.includes('/my/custom/path.ts') || log.includes('path'))).toBe(true);
    });

    it('should NOT show debug logs without --verbose flag', async () => {
      const mockSchema = createValidSchema('User');

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      vi.doMock('@icetype/core', async () => {
        const actual = await vi.importActual<typeof import('@icetype/core')>('@icetype/core');
        return {
          ...actual,
          getPostgresType: vi.fn().mockReturnValue('TEXT'),
        };
      });

      vi.doMock('@icetype/postgres', () => ({
        escapeIdentifier: vi.fn((name: string) => `"${name}"`),
      }));

      const { postgresExport } = await import('../commands/postgres.js');

      await postgresExport(['--schema', '/path/to/schema.ts']);

      // Without verbose, should NOT have debug logs (no timestamps)
      expect(hasDebugLog(mockConsoleLog)).toBe(false);
    });
  });

  // ===========================================================================
  // Watcher Verbose Tests
  // ===========================================================================

  describe('watcher utility', () => {
    it('should accept verbose option in WatcherOptions', async () => {
      // The watcher utility already supports the verbose option
      // This test verifies the type and interface contract
      const watcherModule = await vi.importActual('../utils/watcher.js');

      // Verify the module exports the expected functions
      expect(watcherModule).toHaveProperty('createWatcher');
      expect(watcherModule).toHaveProperty('watchGenerate');
    });
  });
});
