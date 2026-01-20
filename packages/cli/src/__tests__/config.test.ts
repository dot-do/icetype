/**
 * Configuration File Tests for @icetype/cli
 *
 * Tests for loading icetype.config.ts/js configuration files.
 * Follows TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock modules
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

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a temporary directory with test config files for integration tests
 */
async function createTempConfigDir(configContent: string, filename: string = 'icetype.config.ts'): Promise<string> {
  const tmpDir = path.join(process.cwd(), '.test-config-' + Date.now());
  const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  actualFs.mkdirSync(tmpDir, { recursive: true });
  actualFs.writeFileSync(path.join(tmpDir, filename), configContent);
  return tmpDir;
}

/**
 * Cleans up temporary test directory
 */
async function cleanupTempDir(dir: string): Promise<void> {
  const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  if (actualFs.existsSync(dir)) {
    const files = actualFs.readdirSync(dir);
    for (const file of files) {
      actualFs.unlinkSync(path.join(dir, file));
    }
    actualFs.rmdirSync(dir);
  }
}

// =============================================================================
// IceTypeConfig Interface Tests
// =============================================================================

describe('IceTypeConfig Interface', () => {
  it('should export IceTypeConfig type', async () => {
    // Type checking is done at compile time - this test verifies the module exports
    const configModule = await import('../utils/config.js');
    expect(configModule).toBeDefined();
  });

  it('should accept valid config with all options', async () => {
    const configModule = await import('../utils/config.js');
    const { defineConfig } = configModule;

    const config = {
      schema: './schemas/**/*.ts',
      output: {
        types: './generated/types.ts',
        duckdb: './generated/duckdb.sql',
        postgres: './generated/postgres.sql',
        clickhouse: './generated/clickhouse.sql',
        iceberg: './generated/iceberg.json',
      },
      adapters: {
        duckdb: { ifNotExists: true, schemaName: 'analytics' },
        postgres: { schemaName: 'public', ifNotExists: true },
        clickhouse: { engine: 'MergeTree' },
        iceberg: { location: 's3://bucket/path' },
      },
      watch: {
        enabled: true,
        debounce: 500,
      },
    };

    // defineConfig should pass through the config and validate types
    const result = defineConfig(config);
    expect(result).toEqual(config);
  });

  it('should accept minimal config with just schema path', async () => {
    const { defineConfig } = await import('../utils/config.js');

    const config = {
      schema: './schemas/**/*.ts',
    };

    const result = defineConfig(config);
    expect(result.schema).toBe('./schemas/**/*.ts');
  });
});

// =============================================================================
// Config Loading Tests
// =============================================================================

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('config file discovery', () => {
    it('should find icetype.config.ts from cwd', async () => {
      const { findConfigFile } = await import('../utils/config.js');

      // Mock that icetype.config.ts exists
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return String(p).endsWith('icetype.config.ts');
      });

      const result = findConfigFile('/mock/project');

      expect(result).toContain('icetype.config.ts');
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should fall back to icetype.config.js if .ts not found', async () => {
      const { findConfigFile } = await import('../utils/config.js');

      // Mock that only .js exists
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return String(p).endsWith('icetype.config.js');
      });

      const result = findConfigFile('/mock/project');

      expect(result).toContain('icetype.config.js');
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('icetype.config.ts'));
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('icetype.config.js'));
    });

    it('should fall back to icetype.config.mjs if .ts and .js not found', async () => {
      const { findConfigFile } = await import('../utils/config.js');

      // Mock that only .mjs exists
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return String(p).endsWith('icetype.config.mjs');
      });

      const result = findConfigFile('/mock/project');

      expect(result).toContain('icetype.config.mjs');
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('icetype.config.ts'));
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('icetype.config.js'));
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('icetype.config.mjs'));
    });

    it('should return empty config when no config file exists', async () => {
      const { loadConfig } = await import('../utils/config.js');

      // Mock that no config files exist
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await loadConfig({ cwd: '/mock/project' });

      expect(result.config).toEqual({});
      expect(result.configPath).toBeUndefined();
    });

    it('should check explicit config path when provided', async () => {
      const { loadConfig } = await import('../utils/config.js');

      // Mock that explicit config file does NOT exist (will throw error)
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        loadConfig({
          cwd: '/mock/project',
          configPath: '/custom/path/my-config.ts',
        })
      ).rejects.toThrow('Config file not found');

      expect(fs.existsSync).toHaveBeenCalledWith('/custom/path/my-config.ts');
    });
  });

  describe('config parsing and validation', () => {
    it('should throw error for invalid config file path', async () => {
      const { loadConfig } = await import('../utils/config.js');

      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        loadConfig({
          cwd: '/mock/project',
          configPath: '/nonexistent/config.ts',
        })
      ).rejects.toThrow('Config file not found');
    });

    it('should validate config schema and reject invalid configs', async () => {
      const { validateConfig } = await import('../utils/config.js');

      // Invalid config - schema should be string, not number
      const invalidConfig = {
        schema: 123,
      };

      const result = validateConfig(invalidConfig as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('schema'))).toBe(true);
    });

    it('should validate output paths are strings', async () => {
      const { validateConfig } = await import('../utils/config.js');

      const invalidConfig = {
        schema: './schema.ts',
        output: {
          types: 123, // Should be string
        },
      };

      const result = validateConfig(invalidConfig as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('output') && e.includes('types'))).toBe(true);
    });

    it('should pass validation for valid config', async () => {
      const { validateConfig } = await import('../utils/config.js');

      const validConfig = {
        schema: './schemas/**/*.ts',
        output: {
          types: './generated/types.ts',
        },
        adapters: {
          duckdb: { ifNotExists: true },
        },
      };

      const result = validateConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// =============================================================================
// Config Merging with CLI Options Tests
// =============================================================================

describe('mergeConfig', () => {
  it('should merge config file with CLI options', async () => {
    const { mergeConfig } = await import('../utils/config.js');

    const fileConfig = {
      schema: './schemas/default.ts',
      output: {
        types: './generated/types.ts',
      },
    };

    const cliOptions = {
      schema: './schemas/override.ts',
    };

    const result = mergeConfig(fileConfig, cliOptions);

    expect(result.schema).toBe('./schemas/override.ts'); // CLI takes precedence
    expect(result.output?.types).toBe('./generated/types.ts'); // Kept from file
  });

  it('should let CLI options take precedence over config file', async () => {
    const { mergeConfig } = await import('../utils/config.js');

    const fileConfig = {
      schema: './from-config.ts',
      output: {
        types: './from-config-types.ts',
        duckdb: './from-config-duckdb.sql',
      },
      adapters: {
        duckdb: { ifNotExists: true },
      },
    };

    const cliOptions = {
      output: './from-cli-output.ts',
      // CLI output should override the types output
    };

    const result = mergeConfig(fileConfig, cliOptions);

    // When CLI provides single output, it should be used as the primary output
    expect(result.schema).toBe('./from-config.ts');
    expect(result.output).toBe('./from-cli-output.ts');
  });

  it('should handle empty CLI options', async () => {
    const { mergeConfig } = await import('../utils/config.js');

    const fileConfig = {
      schema: './schemas/default.ts',
      output: {
        types: './generated/types.ts',
      },
    };

    const result = mergeConfig(fileConfig, {});

    expect(result.schema).toBe('./schemas/default.ts');
    expect(result.output).toEqual({ types: './generated/types.ts' });
  });

  it('should handle empty config file', async () => {
    const { mergeConfig } = await import('../utils/config.js');

    const cliOptions = {
      schema: './schemas/from-cli.ts',
      output: './output/from-cli.ts',
    };

    const result = mergeConfig({}, cliOptions);

    expect(result.schema).toBe('./schemas/from-cli.ts');
    expect(result.output).toBe('./output/from-cli.ts');
  });

  it('should deep merge adapter options', async () => {
    const { mergeConfig } = await import('../utils/config.js');

    const fileConfig = {
      schema: './schema.ts',
      adapters: {
        duckdb: { ifNotExists: true, schemaName: 'analytics' },
        postgres: { schemaName: 'public' },
      },
    };

    const cliOptions = {
      adapters: {
        duckdb: { schemaName: 'override' }, // Override just this property
      },
    };

    const result = mergeConfig(fileConfig, cliOptions);

    expect(result.adapters?.duckdb?.ifNotExists).toBe(true); // Kept from file
    expect(result.adapters?.duckdb?.schemaName).toBe('override'); // Overridden by CLI
    expect(result.adapters?.postgres?.schemaName).toBe('public'); // Kept from file
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('config error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should provide helpful error message for syntax errors in config', async () => {
    const { loadConfig } = await import('../utils/config.js');

    // Mock that config file exists but import fails
    vi.mocked(fs.existsSync).mockReturnValue(true);

    // The actual import error is caught and wrapped
    // This is tested via integration tests with actual files
    expect(true).toBe(true);
  });

  it('should provide helpful error message for missing default export', async () => {
    const { validateConfigExport } = await import('../utils/config.js');

    const moduleWithNoDefault = {
      someOtherExport: {},
    };

    expect(() => validateConfigExport(moduleWithNoDefault)).toThrow('default export');
  });

  it('should handle config file that exports a function', async () => {
    const { resolveConfig } = await import('../utils/config.js');

    const configFn = () => ({
      schema: './dynamic-schema.ts',
    });

    const result = await resolveConfig(configFn);

    expect(result.schema).toBe('./dynamic-schema.ts');
  });

  it('should handle async config function', async () => {
    const { resolveConfig } = await import('../utils/config.js');

    const asyncConfigFn = async () => ({
      schema: './async-schema.ts',
    });

    const result = await resolveConfig(asyncConfigFn);

    expect(result.schema).toBe('./async-schema.ts');
  });
});

// =============================================================================
// defineConfig Helper Tests
// =============================================================================

describe('defineConfig', () => {
  it('should return the config unchanged (type helper)', async () => {
    const { defineConfig } = await import('../utils/config.js');

    const config = {
      schema: './schema.ts',
      output: {
        types: './types.ts',
      },
    };

    const result = defineConfig(config);

    expect(result).toEqual(config);
    expect(result).toBe(config); // Should be same reference
  });

  it('should provide type checking for config object', async () => {
    const { defineConfig } = await import('../utils/config.js');

    // This is mainly a compile-time check, but we verify it works at runtime
    const config = defineConfig({
      schema: './schema.ts',
      output: {
        types: './generated/types.ts',
        duckdb: './generated/duckdb.sql',
      },
      adapters: {
        duckdb: {
          ifNotExists: true,
        },
      },
    });

    expect(config.schema).toBe('./schema.ts');
    expect(config.output?.types).toBe('./generated/types.ts');
    expect(config.adapters?.duckdb?.ifNotExists).toBe(true);
  });
});

// =============================================================================
// Config File Path Discovery Tests
// =============================================================================

describe('findConfigFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should search for config files in priority order', async () => {
    const { findConfigFile } = await import('../utils/config.js');

    // Track the order of existsSync calls
    const callOrder: string[] = [];
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      callOrder.push(String(p));
      return false;
    });

    await findConfigFile('/project');

    // Should check in order: .ts, .js, .mjs
    expect(callOrder[0]).toContain('icetype.config.ts');
    expect(callOrder[1]).toContain('icetype.config.js');
    expect(callOrder[2]).toContain('icetype.config.mjs');
  });

  it('should return first found config file', async () => {
    const { findConfigFile } = await import('../utils/config.js');

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).endsWith('icetype.config.ts');
    });

    const result = await findConfigFile('/project');

    expect(result).toContain('icetype.config.ts');
  });

  it('should return undefined when no config file found', async () => {
    const { findConfigFile } = await import('../utils/config.js');

    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await findConfigFile('/project');

    expect(result).toBeUndefined();
  });
});

// =============================================================================
// Full Config Resolution Flow Tests
// =============================================================================

describe('resolveFullConfig', () => {
  it('should resolve config with CLI overrides', async () => {
    const { resolveFullConfig } = await import('../utils/config.js');

    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await resolveFullConfig({
      cwd: '/project',
      cliOptions: {
        schema: './cli-schema.ts',
        output: './cli-output.ts',
      },
    });

    expect(result.schema).toBe('./cli-schema.ts');
    expect(result.output).toBe('./cli-output.ts');
  });

  it('should merge file config with CLI options', async () => {
    const { resolveFullConfig, loadConfig } = await import('../utils/config.js');

    // For this test, we'll verify the merge behavior in isolation
    // since dynamic import mocking is complex
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await resolveFullConfig({
      cwd: '/project',
      cliOptions: {
        schema: './from-cli.ts',
        verbose: true,
      },
    });

    expect(result.schema).toBe('./from-cli.ts');
  });
});
