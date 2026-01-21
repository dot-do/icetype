/**
 * Plugin Config Tests for @icetype/core
 *
 * Tests for the configuration file loading system.
 * Tests cover:
 * - Loading config from icetype.config.ts/js files
 * - Fallback to package.json "icetype" field
 * - Config validation
 * - Config resolution and normalization
 * - defineConfig helper
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

import {
  loadConfig,
  loadConfigFile,
  loadPackageJsonConfig,
  findConfigFile,
  resolveConfig,
  validateConfig,
  normalizePluginEntry,
  defineConfig,
  ConfigLoadError,
  ConfigValidationError,
  isConfigLoadError,
  isConfigValidationError,
  CONFIG_FILE_NAMES,
  DEFAULT_CONFIG,
} from '../plugin-config.js';

import type {
  IceTypeConfig,
  PluginEntry,
  ResolvedConfig,
  ResolvedPluginConfig,
} from '../plugin-config.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a temporary directory for testing.
 */
function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'icetype-config-test-'));
  return tempDir;
}

/**
 * Clean up a temporary directory.
 */
function cleanupTempDir(tempDir: string): void {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

/**
 * Write a file to the temp directory.
 */
function writeFile(tempDir: string, fileName: string, content: string): string {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// =============================================================================
// findConfigFile Tests
// =============================================================================

describe('findConfigFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should return null when no config file exists', () => {
    const result = findConfigFile(tempDir);
    expect(result).toBeNull();
  });

  it('should find icetype.config.ts', () => {
    writeFile(tempDir, 'icetype.config.ts', 'export default {}');
    const result = findConfigFile(tempDir);
    expect(result).toBe(path.join(tempDir, 'icetype.config.ts'));
  });

  it('should find icetype.config.js', () => {
    writeFile(tempDir, 'icetype.config.js', 'export default {}');
    const result = findConfigFile(tempDir);
    expect(result).toBe(path.join(tempDir, 'icetype.config.js'));
  });

  it('should find icetype.config.mjs', () => {
    writeFile(tempDir, 'icetype.config.mjs', 'export default {}');
    const result = findConfigFile(tempDir);
    expect(result).toBe(path.join(tempDir, 'icetype.config.mjs'));
  });

  it('should prioritize .ts over .js', () => {
    writeFile(tempDir, 'icetype.config.ts', 'export default { strictMode: true }');
    writeFile(tempDir, 'icetype.config.js', 'export default { strictMode: false }');
    const result = findConfigFile(tempDir);
    expect(result).toBe(path.join(tempDir, 'icetype.config.ts'));
  });

  it('should support all config file names', () => {
    // Verify all supported names are in the constant
    expect(CONFIG_FILE_NAMES).toContain('icetype.config.ts');
    expect(CONFIG_FILE_NAMES).toContain('icetype.config.mts');
    expect(CONFIG_FILE_NAMES).toContain('icetype.config.js');
    expect(CONFIG_FILE_NAMES).toContain('icetype.config.mjs');
    expect(CONFIG_FILE_NAMES).toContain('icetype.config.cjs');
  });
});

// =============================================================================
// loadConfigFile Tests
// =============================================================================

describe('loadConfigFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should throw ConfigLoadError for non-existent file', async () => {
    const nonExistent = path.join(tempDir, 'nonexistent.config.js');

    await expect(loadConfigFile(nonExistent)).rejects.toThrow(ConfigLoadError);
    await expect(loadConfigFile(nonExistent)).rejects.toThrow('Config file not found');
  });

  it('should load a valid JavaScript config file', async () => {
    const configPath = writeFile(
      tempDir,
      'icetype.config.mjs',
      `export default {
        plugins: ['postgres'],
        autoDiscover: false,
      };`
    );

    const config = await loadConfigFile(configPath);

    expect(config).toEqual({
      plugins: ['postgres'],
      autoDiscover: false,
    });
  });

  it('should load config with named export', async () => {
    const configPath = writeFile(
      tempDir,
      'icetype.config.mjs',
      `const config = {
        plugins: ['mysql'],
        strictMode: true,
      };
      export default config;`
    );

    const config = await loadConfigFile(configPath);

    expect(config.plugins).toEqual(['mysql']);
    expect(config.strictMode).toBe(true);
  });

  it('should throw ConfigLoadError for invalid JavaScript', async () => {
    const configPath = writeFile(tempDir, 'icetype.config.mjs', 'this is not valid javascript {{{');

    await expect(loadConfigFile(configPath)).rejects.toThrow(ConfigLoadError);
  });
});

// =============================================================================
// loadPackageJsonConfig Tests
// =============================================================================

describe('loadPackageJsonConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should return null when package.json does not exist', () => {
    const result = loadPackageJsonConfig(tempDir);
    expect(result).toBeNull();
  });

  it('should return null when package.json has no icetype field', () => {
    writeFile(
      tempDir,
      'package.json',
      JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      })
    );

    const result = loadPackageJsonConfig(tempDir);
    expect(result).toBeNull();
  });

  it('should load config from package.json icetype field', () => {
    writeFile(
      tempDir,
      'package.json',
      JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        icetype: {
          plugins: ['postgres', 'mysql'],
          autoDiscover: false,
        },
      })
    );

    const result = loadPackageJsonConfig(tempDir);

    expect(result).toEqual({
      plugins: ['postgres', 'mysql'],
      autoDiscover: false,
    });
  });

  it('should return null for non-object icetype field', () => {
    writeFile(
      tempDir,
      'package.json',
      JSON.stringify({
        name: 'test-package',
        icetype: 'not an object',
      })
    );

    const result = loadPackageJsonConfig(tempDir);
    expect(result).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    writeFile(tempDir, 'package.json', 'not valid json');

    const result = loadPackageJsonConfig(tempDir);
    expect(result).toBeNull();
  });
});

// =============================================================================
// normalizePluginEntry Tests
// =============================================================================

describe('normalizePluginEntry', () => {
  it('should normalize a string entry', () => {
    const result = normalizePluginEntry('postgres');

    expect(result).toEqual({
      name: 'postgres',
      options: {},
      enabled: true,
    });
  });

  it('should normalize a PluginEntry object', () => {
    const entry: PluginEntry = {
      name: 'mysql',
      options: { connectionString: 'mysql://localhost' },
      enabled: true,
    };

    const result = normalizePluginEntry(entry);

    expect(result).toEqual({
      name: 'mysql',
      options: { connectionString: 'mysql://localhost' },
      enabled: true,
    });
  });

  it('should default enabled to true', () => {
    const entry: PluginEntry = {
      name: 'sqlite',
    };

    const result = normalizePluginEntry(entry);

    expect(result.enabled).toBe(true);
  });

  it('should merge global options with plugin options', () => {
    const entry: PluginEntry = {
      name: 'postgres',
      options: { connectionString: 'postgres://localhost' },
    };
    const globalOptions = { timeout: 5000, retries: 3 };

    const result = normalizePluginEntry(entry, globalOptions);

    expect(result.options).toEqual({
      timeout: 5000,
      retries: 3,
      connectionString: 'postgres://localhost',
    });
  });

  it('should let plugin options override global options', () => {
    const entry: PluginEntry = {
      name: 'postgres',
      options: { timeout: 10000 },
    };
    const globalOptions = { timeout: 5000 };

    const result = normalizePluginEntry(entry, globalOptions);

    expect(result.options.timeout).toBe(10000);
  });

  it('should apply global options to string entries', () => {
    const globalOptions = { debug: true };

    const result = normalizePluginEntry('postgres', globalOptions);

    expect(result.options).toEqual({ debug: true });
  });
});

// =============================================================================
// validateConfig Tests
// =============================================================================

describe('validateConfig', () => {
  it('should accept valid empty config', () => {
    expect(() => validateConfig({})).not.toThrow();
  });

  it('should accept valid full config', () => {
    const config: IceTypeConfig = {
      plugins: [
        'postgres',
        { name: 'mysql', options: { host: 'localhost' }, enabled: true },
      ],
      autoDiscover: true,
      discoverPatterns: ['icetype-adapter-*'],
      strictMode: false,
      cacheEnabled: true,
      pluginSearchPaths: ['/custom/path'],
      globalPluginOptions: { debug: true },
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('should reject non-array plugins', () => {
    const config = { plugins: 'not an array' } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('plugins must be an array'))).toBe(true);
      }
    }
  });

  it('should reject empty plugin names', () => {
    const config: IceTypeConfig = {
      plugins: ['postgres', ''],
    };

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('Plugin name cannot be empty'))).toBe(true);
      }
    }
  });

  it('should reject plugin entry without name', () => {
    const config = {
      plugins: [{ options: {} }],
    } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('Plugin entry must have a name'))).toBe(true);
      }
    }
  });

  it('should reject non-object plugin options', () => {
    const config = {
      plugins: [{ name: 'test', options: 'not an object' }],
    } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('Plugin options must be an object'))).toBe(true);
      }
    }
  });

  it('should reject non-boolean enabled', () => {
    const config = {
      plugins: [{ name: 'test', enabled: 'yes' }],
    } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('Plugin enabled must be a boolean'))).toBe(true);
      }
    }
  });

  it('should reject non-boolean autoDiscover', () => {
    const config = { autoDiscover: 'yes' } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('autoDiscover must be a boolean'))).toBe(true);
      }
    }
  });

  it('should reject non-array discoverPatterns', () => {
    const config = { discoverPatterns: '*' } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('discoverPatterns must be an array'))).toBe(true);
      }
    }
  });

  it('should reject non-string pattern in discoverPatterns', () => {
    const config = { discoverPatterns: [123] } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('Pattern must be a string'))).toBe(true);
      }
    }
  });

  it('should reject non-boolean strictMode', () => {
    const config = { strictMode: 1 } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('strictMode must be a boolean'))).toBe(true);
      }
    }
  });

  it('should reject non-boolean cacheEnabled', () => {
    const config = { cacheEnabled: 'true' } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('cacheEnabled must be a boolean'))).toBe(true);
      }
    }
  });

  it('should reject non-array pluginSearchPaths', () => {
    const config = { pluginSearchPaths: '/path' } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('pluginSearchPaths must be an array'))).toBe(true);
      }
    }
  });

  it('should reject non-object globalPluginOptions', () => {
    const config = { globalPluginOptions: 'options' } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.some((e) => e.message.includes('globalPluginOptions must be an object'))).toBe(true);
      }
    }
  });

  it('should collect multiple validation errors', () => {
    const config = {
      plugins: 'not array',
      autoDiscover: 'yes',
      strictMode: 1,
    } as unknown as IceTypeConfig;

    try {
      validateConfig(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isConfigValidationError(error)).toBe(true);
      if (isConfigValidationError(error)) {
        expect(error.validationErrors?.length).toBeGreaterThan(1);
      }
    }
  });
});

// =============================================================================
// resolveConfig Tests
// =============================================================================

describe('resolveConfig', () => {
  it('should resolve empty config with defaults', () => {
    const result = resolveConfig({}, 'defaults');

    expect(result.plugins).toEqual([]);
    expect(result.autoDiscover).toBe(true);
    expect(result.discoverPatterns).toEqual(['icetype-adapter-*', '@icetype/*']);
    expect(result.strictMode).toBe(false);
    expect(result.cacheEnabled).toBe(true);
    expect(result.pluginSearchPaths).toEqual([]);
    expect(result.configSource).toBe('defaults');
  });

  it('should resolve config with provided values', () => {
    const config: IceTypeConfig = {
      plugins: ['postgres'],
      autoDiscover: false,
      discoverPatterns: ['my-adapter-*'],
      strictMode: true,
      cacheEnabled: false,
      pluginSearchPaths: ['/custom'],
    };

    const result = resolveConfig(config, 'file', '/path/to/icetype.config.ts');

    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0].name).toBe('postgres');
    expect(result.autoDiscover).toBe(false);
    expect(result.discoverPatterns).toEqual(['my-adapter-*']);
    expect(result.strictMode).toBe(true);
    expect(result.cacheEnabled).toBe(false);
    expect(result.pluginSearchPaths).toEqual(['/custom']);
    expect(result.configSource).toBe('file');
    expect(result.configPath).toBe('/path/to/icetype.config.ts');
  });

  it('should normalize plugin entries', () => {
    const config: IceTypeConfig = {
      plugins: [
        'postgres',
        { name: 'mysql', options: { host: 'localhost' }, enabled: false },
      ],
    };

    const result = resolveConfig(config, 'file');

    expect(result.plugins).toHaveLength(2);
    expect(result.plugins[0]).toEqual({
      name: 'postgres',
      options: {},
      enabled: true,
    });
    expect(result.plugins[1]).toEqual({
      name: 'mysql',
      options: { host: 'localhost' },
      enabled: false,
    });
  });

  it('should apply global plugin options', () => {
    const config: IceTypeConfig = {
      plugins: ['postgres', { name: 'mysql', options: { port: 3306 } }],
      globalPluginOptions: { debug: true, timeout: 5000 },
    };

    const result = resolveConfig(config, 'file');

    expect(result.plugins[0].options).toEqual({ debug: true, timeout: 5000 });
    expect(result.plugins[1].options).toEqual({ debug: true, timeout: 5000, port: 3306 });
  });
});

// =============================================================================
// loadConfig Tests
// =============================================================================

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should return defaults when no config found and useDefaults is true', async () => {
    const result = await loadConfig({ cwd: tempDir, useDefaults: true });

    expect(result.configSource).toBe('defaults');
    expect(result.plugins).toEqual([]);
    expect(result.autoDiscover).toBe(true);
  });

  it('should throw when no config found and useDefaults is false', async () => {
    await expect(
      loadConfig({ cwd: tempDir, useDefaults: false })
    ).rejects.toThrow(ConfigLoadError);
  });

  it('should load from explicit config path', async () => {
    const configPath = writeFile(
      tempDir,
      'custom.config.mjs',
      `export default { plugins: ['custom'], autoDiscover: false };`
    );

    const result = await loadConfig({
      cwd: tempDir,
      configPath: 'custom.config.mjs',
    });

    expect(result.configSource).toBe('file');
    expect(result.plugins[0].name).toBe('custom');
    expect(result.autoDiscover).toBe(false);
  });

  it('should find and load icetype.config.mjs', async () => {
    writeFile(
      tempDir,
      'icetype.config.mjs',
      `export default { plugins: ['discovered'], strictMode: true };`
    );

    const result = await loadConfig({ cwd: tempDir });

    expect(result.configSource).toBe('file');
    expect(result.plugins[0].name).toBe('discovered');
    expect(result.strictMode).toBe(true);
  });

  it('should fall back to package.json icetype field', async () => {
    writeFile(
      tempDir,
      'package.json',
      JSON.stringify({
        name: 'test',
        icetype: {
          plugins: ['from-package'],
          cacheEnabled: false,
        },
      })
    );

    const result = await loadConfig({ cwd: tempDir });

    expect(result.configSource).toBe('package.json');
    expect(result.plugins[0].name).toBe('from-package');
    expect(result.cacheEnabled).toBe(false);
  });

  it('should prefer config file over package.json', async () => {
    writeFile(
      tempDir,
      'icetype.config.mjs',
      `export default { plugins: ['from-file'] };`
    );
    writeFile(
      tempDir,
      'package.json',
      JSON.stringify({
        name: 'test',
        icetype: { plugins: ['from-package'] },
      })
    );

    const result = await loadConfig({ cwd: tempDir });

    expect(result.configSource).toBe('file');
    expect(result.plugins[0].name).toBe('from-file');
  });

  it('should skip package.json when skipPackageJson is true', async () => {
    writeFile(
      tempDir,
      'package.json',
      JSON.stringify({
        name: 'test',
        icetype: { plugins: ['from-package'] },
      })
    );

    const result = await loadConfig({
      cwd: tempDir,
      skipPackageJson: true,
      useDefaults: true,
    });

    expect(result.configSource).toBe('defaults');
  });

  it('should validate config before returning', async () => {
    writeFile(
      tempDir,
      'icetype.config.mjs',
      `export default { plugins: 'not an array' };`
    );

    await expect(loadConfig({ cwd: tempDir })).rejects.toThrow(ConfigValidationError);
  });

  it('should handle absolute configPath', async () => {
    const configPath = writeFile(
      tempDir,
      'absolute.config.mjs',
      `export default { plugins: ['absolute'] };`
    );

    const result = await loadConfig({
      configPath: configPath, // Absolute path
    });

    expect(result.plugins[0].name).toBe('absolute');
  });
});

// =============================================================================
// defineConfig Tests
// =============================================================================

describe('defineConfig', () => {
  it('should return the same config object', () => {
    const config: IceTypeConfig = {
      plugins: ['test'],
      autoDiscover: true,
    };

    const result = defineConfig(config);

    expect(result).toBe(config);
  });

  it('should provide type safety for config', () => {
    // This test mainly verifies TypeScript types work correctly
    const config = defineConfig({
      plugins: [
        'string-plugin',
        { name: 'object-plugin', options: { key: 'value' } },
      ],
      autoDiscover: true,
      discoverPatterns: ['pattern-*'],
      strictMode: false,
      cacheEnabled: true,
      pluginSearchPaths: ['/path'],
      globalPluginOptions: { global: true },
    });

    expect(config.plugins).toHaveLength(2);
    expect(config.autoDiscover).toBe(true);
  });
});

// =============================================================================
// Error Type Tests
// =============================================================================

describe('Error Types', () => {
  describe('ConfigLoadError', () => {
    it('should have proper structure', () => {
      const error = new ConfigLoadError('Load failed', {
        configPath: '/path/to/config.ts',
        searchedPaths: ['/path1', '/path2'],
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConfigLoadError');
      expect(error.message).toBe('Load failed');
      expect(error.configPath).toBe('/path/to/config.ts');
      expect(error.searchedPaths).toEqual(['/path1', '/path2']);
    });

    it('should be detectable with type guard', () => {
      const error = new ConfigLoadError('Test');
      expect(isConfigLoadError(error)).toBe(true);
      expect(isConfigLoadError(new Error('Test'))).toBe(false);
    });
  });

  describe('ConfigValidationError', () => {
    it('should have proper structure', () => {
      const errors = [
        { path: 'plugins', message: 'Invalid' },
        { path: 'autoDiscover', message: 'Must be boolean' },
      ];

      const error = new ConfigValidationError('Validation failed', {
        validationErrors: errors,
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConfigValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.validationErrors).toEqual(errors);
    });

    it('should be detectable with type guard', () => {
      const error = new ConfigValidationError('Test');
      expect(isConfigValidationError(error)).toBe(true);
      expect(isConfigValidationError(new Error('Test'))).toBe(false);
    });
  });
});

// =============================================================================
// DEFAULT_CONFIG Tests
// =============================================================================

describe('DEFAULT_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONFIG.plugins).toEqual([]);
    expect(DEFAULT_CONFIG.autoDiscover).toBe(true);
    expect(DEFAULT_CONFIG.discoverPatterns).toEqual(['icetype-adapter-*', '@icetype/*']);
    expect(DEFAULT_CONFIG.strictMode).toBe(false);
    expect(DEFAULT_CONFIG.cacheEnabled).toBe(true);
    expect(DEFAULT_CONFIG.pluginSearchPaths).toEqual([]);
    expect(DEFAULT_CONFIG.configSource).toBe('defaults');
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should handle complex plugin configuration', async () => {
    writeFile(
      tempDir,
      'icetype.config.mjs',
      `export default {
        plugins: [
          'postgres',
          { name: 'mysql', options: { host: 'localhost', port: 3306 } },
          { name: 'disabled-plugin', enabled: false },
        ],
        autoDiscover: false,
        discoverPatterns: ['my-adapter-*'],
        strictMode: true,
        cacheEnabled: true,
        pluginSearchPaths: ['/custom/plugins'],
        globalPluginOptions: {
          timeout: 30000,
          retries: 3,
        },
      };`
    );

    const result = await loadConfig({ cwd: tempDir });

    // Verify plugins
    expect(result.plugins).toHaveLength(3);

    // First plugin (string)
    expect(result.plugins[0].name).toBe('postgres');
    expect(result.plugins[0].options).toEqual({ timeout: 30000, retries: 3 });
    expect(result.plugins[0].enabled).toBe(true);

    // Second plugin (object with options)
    expect(result.plugins[1].name).toBe('mysql');
    expect(result.plugins[1].options).toEqual({
      timeout: 30000,
      retries: 3,
      host: 'localhost',
      port: 3306,
    });
    expect(result.plugins[1].enabled).toBe(true);

    // Third plugin (disabled)
    expect(result.plugins[2].name).toBe('disabled-plugin');
    expect(result.plugins[2].enabled).toBe(false);

    // Verify other options
    expect(result.autoDiscover).toBe(false);
    expect(result.discoverPatterns).toEqual(['my-adapter-*']);
    expect(result.strictMode).toBe(true);
    expect(result.cacheEnabled).toBe(true);
    expect(result.pluginSearchPaths).toEqual(['/custom/plugins']);
  });

  it('should work with defineConfig helper in config file', async () => {
    // This simulates what a user would write in their config file
    writeFile(
      tempDir,
      'icetype.config.mjs',
      `
      // In a real file, this would be: import { defineConfig } from '@icetype/core';
      const defineConfig = (config) => config;

      export default defineConfig({
        plugins: ['postgres', 'mysql'],
        autoDiscover: true,
      });`
    );

    const result = await loadConfig({ cwd: tempDir });

    expect(result.plugins).toHaveLength(2);
    expect(result.plugins[0].name).toBe('postgres');
    expect(result.plugins[1].name).toBe('mysql');
  });
});
