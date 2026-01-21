/**
 * IceType Plugin Configuration
 *
 * Supports loading plugin configuration from:
 * - icetype.config.ts / icetype.config.js / icetype.config.mjs
 * - package.json "icetype" field (fallback)
 *
 * @packageDocumentation
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { IceTypeError } from './errors.js';

// =============================================================================
// Config Error Classes
// =============================================================================

/**
 * Error thrown when config file loading fails.
 */
export class ConfigLoadError extends IceTypeError {
  public readonly configPath?: string;
  public readonly searchedPaths?: string[];

  constructor(
    message: string,
    options: {
      configPath?: string;
      searchedPaths?: string[];
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'ICETYPE_6000',
      cause: options.cause,
      context: {
        configPath: options.configPath,
        searchedPaths: options.searchedPaths,
      },
    });
    this.name = 'ConfigLoadError';
    this.configPath = options.configPath;
    this.searchedPaths = options.searchedPaths;
    Object.setPrototypeOf(this, ConfigLoadError.prototype);
  }
}

/**
 * Error thrown when config validation fails.
 */
export class ConfigValidationError extends IceTypeError {
  public readonly validationErrors?: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    options: {
      validationErrors?: Array<{ path: string; message: string }>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'ICETYPE_6001',
      cause: options.cause,
      context: {
        validationErrors: options.validationErrors,
      },
    });
    this.name = 'ConfigValidationError';
    this.validationErrors = options.validationErrors;
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
}

// =============================================================================
// Config Types
// =============================================================================

/**
 * Plugin configuration entry.
 */
export interface PluginEntry {
  /** Plugin name or path */
  name: string;
  /** Plugin-specific options */
  options?: Record<string, unknown>;
  /** Whether the plugin is enabled (default: true) */
  enabled?: boolean;
}

/**
 * IceType configuration file structure.
 */
export interface IceTypeConfig {
  /**
   * Plugins to load.
   * Can be:
   * - string: plugin name to load with default options
   * - PluginEntry: plugin with custom options
   */
  plugins?: Array<string | PluginEntry>;

  /**
   * Enable/disable auto-discovery of adapters from node_modules.
   * Default: true
   */
  autoDiscover?: boolean;

  /**
   * Patterns for auto-discovery.
   * Default: ['icetype-adapter-*', '@icetype/*']
   */
  discoverPatterns?: string[];

  /**
   * Strict mode - throw on validation errors.
   * Default: false
   */
  strictMode?: boolean;

  /**
   * Enable caching of loaded plugins.
   * Default: true
   */
  cacheEnabled?: boolean;

  /**
   * Additional search paths for plugins.
   */
  pluginSearchPaths?: string[];

  /**
   * Global plugin options applied to all plugins.
   */
  globalPluginOptions?: Record<string, unknown>;
}

/**
 * Resolved plugin configuration (normalized).
 */
export interface ResolvedPluginConfig {
  /** Plugin name */
  name: string;
  /** Resolved plugin options (merged with global options) */
  options: Record<string, unknown>;
  /** Whether the plugin is enabled */
  enabled: boolean;
}

/**
 * Resolved IceType configuration.
 */
export interface ResolvedConfig {
  /** Resolved plugins */
  plugins: ResolvedPluginConfig[];
  /** Auto-discovery enabled */
  autoDiscover: boolean;
  /** Discovery patterns */
  discoverPatterns: string[];
  /** Strict mode */
  strictMode: boolean;
  /** Cache enabled */
  cacheEnabled: boolean;
  /** Plugin search paths */
  pluginSearchPaths: string[];
  /** Config file path (if loaded from file) */
  configPath?: string;
  /** Source of config ('file' | 'package.json' | 'defaults') */
  configSource: 'file' | 'package.json' | 'defaults';
}

/**
 * Options for loading config.
 */
export interface LoadConfigOptions {
  /** Working directory to search from */
  cwd?: string;
  /** Explicit config file path */
  configPath?: string;
  /** Skip package.json fallback */
  skipPackageJson?: boolean;
  /** Use defaults if no config found (don't throw) */
  useDefaults?: boolean;
}

// =============================================================================
// Config File Names
// =============================================================================

/**
 * Supported config file names in order of precedence.
 */
export const CONFIG_FILE_NAMES = [
  'icetype.config.ts',
  'icetype.config.mts',
  'icetype.config.js',
  'icetype.config.mjs',
  'icetype.config.cjs',
] as const;

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: ResolvedConfig = {
  plugins: [],
  autoDiscover: true,
  discoverPatterns: ['icetype-adapter-*', '@icetype/*'],
  strictMode: false,
  cacheEnabled: true,
  pluginSearchPaths: [],
  configSource: 'defaults',
};

// =============================================================================
// Config Loading Functions
// =============================================================================

/**
 * Find config file in the given directory.
 *
 * @param cwd - Directory to search in
 * @returns Path to config file or null if not found
 */
export function findConfigFile(cwd: string = process.cwd()): string | null {
  for (const fileName of CONFIG_FILE_NAMES) {
    const configPath = path.join(cwd, fileName);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Load config from a file.
 *
 * @param configPath - Path to config file
 * @returns Loaded config object
 */
export async function loadConfigFile(configPath: string): Promise<IceTypeConfig> {
  if (!fs.existsSync(configPath)) {
    throw new ConfigLoadError(`Config file not found: ${configPath}`, {
      configPath,
    });
  }

  const ext = path.extname(configPath);

  try {
    // For TypeScript and ES modules, use dynamic import
    if (ext === '.ts' || ext === '.mts' || ext === '.mjs' || ext === '.js') {
      // Convert to file URL for proper import on all platforms
      const fileUrl = pathToFileURL(configPath).href;
      const module = await import(fileUrl);
      return module.default ?? module;
    }

    // For CommonJS, use require (wrapped for ESM compatibility)
    if (ext === '.cjs') {
      // Use dynamic import with createRequire for CJS files
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      return require(configPath);
    }

    throw new ConfigLoadError(`Unsupported config file extension: ${ext}`, {
      configPath,
    });
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      throw error;
    }
    throw new ConfigLoadError(`Failed to load config file: ${configPath}`, {
      configPath,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * Load config from package.json "icetype" field.
 *
 * @param cwd - Directory containing package.json
 * @returns Config from package.json or null if not found
 */
export function loadPackageJsonConfig(cwd: string = process.cwd()): IceTypeConfig | null {
  const packageJsonPath = path.join(cwd, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (packageJson.icetype && typeof packageJson.icetype === 'object') {
      return packageJson.icetype as IceTypeConfig;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize a plugin entry to a resolved plugin config.
 *
 * @param entry - Plugin entry (string or PluginEntry)
 * @param globalOptions - Global plugin options to merge
 * @returns Resolved plugin config
 */
export function normalizePluginEntry(
  entry: string | PluginEntry,
  globalOptions: Record<string, unknown> = {}
): ResolvedPluginConfig {
  if (typeof entry === 'string') {
    return {
      name: entry,
      options: { ...globalOptions },
      enabled: true,
    };
  }

  return {
    name: entry.name,
    options: { ...globalOptions, ...entry.options },
    enabled: entry.enabled ?? true,
  };
}

/**
 * Resolve and normalize a raw config to a fully resolved config.
 *
 * @param config - Raw config object
 * @param configSource - Source of the config
 * @param configPath - Path to config file (if applicable)
 * @returns Resolved config
 */
export function resolveConfig(
  config: IceTypeConfig,
  configSource: 'file' | 'package.json' | 'defaults',
  configPath?: string
): ResolvedConfig {
  const globalOptions = config.globalPluginOptions ?? {};

  const plugins: ResolvedPluginConfig[] = (config.plugins ?? []).map((entry) =>
    normalizePluginEntry(entry, globalOptions)
  );

  return {
    plugins,
    autoDiscover: config.autoDiscover ?? DEFAULT_CONFIG.autoDiscover,
    discoverPatterns: config.discoverPatterns ?? DEFAULT_CONFIG.discoverPatterns,
    strictMode: config.strictMode ?? DEFAULT_CONFIG.strictMode,
    cacheEnabled: config.cacheEnabled ?? DEFAULT_CONFIG.cacheEnabled,
    pluginSearchPaths: config.pluginSearchPaths ?? DEFAULT_CONFIG.pluginSearchPaths,
    configPath,
    configSource,
  };
}

/**
 * Validate a config object.
 *
 * @param config - Config to validate
 * @throws ConfigValidationError if validation fails
 */
export function validateConfig(config: IceTypeConfig): void {
  const errors: Array<{ path: string; message: string }> = [];

  // Validate plugins array
  if (config.plugins !== undefined) {
    if (!Array.isArray(config.plugins)) {
      errors.push({ path: 'plugins', message: 'plugins must be an array' });
    } else {
      config.plugins.forEach((entry, index) => {
        if (typeof entry === 'string') {
          if (entry.trim() === '') {
            errors.push({
              path: `plugins[${index}]`,
              message: 'Plugin name cannot be empty',
            });
          }
        } else if (typeof entry === 'object' && entry !== null) {
          if (!entry.name || typeof entry.name !== 'string') {
            errors.push({
              path: `plugins[${index}].name`,
              message: 'Plugin entry must have a name',
            });
          }
          if (entry.options !== undefined && typeof entry.options !== 'object') {
            errors.push({
              path: `plugins[${index}].options`,
              message: 'Plugin options must be an object',
            });
          }
          if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') {
            errors.push({
              path: `plugins[${index}].enabled`,
              message: 'Plugin enabled must be a boolean',
            });
          }
        } else {
          errors.push({
            path: `plugins[${index}]`,
            message: 'Plugin entry must be a string or object',
          });
        }
      });
    }
  }

  // Validate autoDiscover
  if (config.autoDiscover !== undefined && typeof config.autoDiscover !== 'boolean') {
    errors.push({ path: 'autoDiscover', message: 'autoDiscover must be a boolean' });
  }

  // Validate discoverPatterns
  if (config.discoverPatterns !== undefined) {
    if (!Array.isArray(config.discoverPatterns)) {
      errors.push({ path: 'discoverPatterns', message: 'discoverPatterns must be an array' });
    } else {
      config.discoverPatterns.forEach((pattern, index) => {
        if (typeof pattern !== 'string') {
          errors.push({
            path: `discoverPatterns[${index}]`,
            message: 'Pattern must be a string',
          });
        }
      });
    }
  }

  // Validate strictMode
  if (config.strictMode !== undefined && typeof config.strictMode !== 'boolean') {
    errors.push({ path: 'strictMode', message: 'strictMode must be a boolean' });
  }

  // Validate cacheEnabled
  if (config.cacheEnabled !== undefined && typeof config.cacheEnabled !== 'boolean') {
    errors.push({ path: 'cacheEnabled', message: 'cacheEnabled must be a boolean' });
  }

  // Validate pluginSearchPaths
  if (config.pluginSearchPaths !== undefined) {
    if (!Array.isArray(config.pluginSearchPaths)) {
      errors.push({ path: 'pluginSearchPaths', message: 'pluginSearchPaths must be an array' });
    } else {
      config.pluginSearchPaths.forEach((searchPath, index) => {
        if (typeof searchPath !== 'string') {
          errors.push({
            path: `pluginSearchPaths[${index}]`,
            message: 'Search path must be a string',
          });
        }
      });
    }
  }

  // Validate globalPluginOptions
  if (
    config.globalPluginOptions !== undefined &&
    (typeof config.globalPluginOptions !== 'object' || config.globalPluginOptions === null)
  ) {
    errors.push({ path: 'globalPluginOptions', message: 'globalPluginOptions must be an object' });
  }

  if (errors.length > 0) {
    throw new ConfigValidationError('Invalid configuration', {
      validationErrors: errors,
    });
  }
}

/**
 * Load IceType configuration.
 *
 * Searches for config in the following order:
 * 1. Explicit configPath (if provided)
 * 2. Config file in cwd (icetype.config.ts, .js, etc.)
 * 3. package.json "icetype" field (fallback)
 * 4. Default configuration (if useDefaults is true)
 *
 * @param options - Load options
 * @returns Resolved configuration
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<ResolvedConfig> {
  const {
    cwd = process.cwd(),
    configPath: explicitPath,
    skipPackageJson = false,
    useDefaults = true,
  } = options;

  const searchedPaths: string[] = [];

  // 1. Try explicit config path
  if (explicitPath) {
    const resolvedPath = path.isAbsolute(explicitPath)
      ? explicitPath
      : path.join(cwd, explicitPath);
    searchedPaths.push(resolvedPath);

    const config = await loadConfigFile(resolvedPath);
    validateConfig(config);
    return resolveConfig(config, 'file', resolvedPath);
  }

  // 2. Search for config file
  const foundConfigPath = findConfigFile(cwd);
  if (foundConfigPath) {
    searchedPaths.push(foundConfigPath);
    const config = await loadConfigFile(foundConfigPath);
    validateConfig(config);
    return resolveConfig(config, 'file', foundConfigPath);
  }

  // Track searched paths
  for (const fileName of CONFIG_FILE_NAMES) {
    searchedPaths.push(path.join(cwd, fileName));
  }

  // 3. Try package.json fallback
  if (!skipPackageJson) {
    const packageJsonPath = path.join(cwd, 'package.json');
    searchedPaths.push(`${packageJsonPath} (icetype field)`);

    const packageConfig = loadPackageJsonConfig(cwd);
    if (packageConfig) {
      validateConfig(packageConfig);
      return resolveConfig(packageConfig, 'package.json', packageJsonPath);
    }
  }

  // 4. Use defaults or throw
  if (useDefaults) {
    return { ...DEFAULT_CONFIG };
  }

  throw new ConfigLoadError('No configuration found', {
    searchedPaths,
  });
}

/**
 * Define an IceType configuration.
 * Helper function for type-safe config file creation.
 *
 * @example
 * ```typescript
 * // icetype.config.ts
 * import { defineConfig } from '@icetype/core';
 *
 * export default defineConfig({
 *   plugins: [
 *     'postgres',
 *     { name: 'mysql', options: { connectionString: 'mysql://...' } },
 *   ],
 *   autoDiscover: true,
 * });
 * ```
 *
 * @param config - Configuration object
 * @returns The same config (for type inference)
 */
export function defineConfig(config: IceTypeConfig): IceTypeConfig {
  return config;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for ConfigLoadError.
 */
export function isConfigLoadError(error: unknown): error is ConfigLoadError {
  return error instanceof ConfigLoadError;
}

/**
 * Type guard for ConfigValidationError.
 */
export function isConfigValidationError(error: unknown): error is ConfigValidationError {
  return error instanceof ConfigValidationError;
}
