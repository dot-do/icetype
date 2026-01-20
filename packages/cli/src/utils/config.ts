/**
 * IceType Configuration File Support
 *
 * Provides loading and merging of icetype.config.ts/js configuration files.
 *
 * @packageDocumentation
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// =============================================================================
// Types
// =============================================================================

/**
 * Output configuration for different targets.
 */
export interface OutputConfig {
  /** Path to generated TypeScript types file. */
  types?: string;
  /** Path to DuckDB DDL output file. */
  duckdb?: string;
  /** Path to PostgreSQL DDL output file. */
  postgres?: string;
  /** Path to ClickHouse DDL output file. */
  clickhouse?: string;
  /** Path to Iceberg metadata output file. */
  iceberg?: string;
}

/**
 * DuckDB adapter options.
 */
export interface DuckDBAdapterConfig {
  /** Use IF NOT EXISTS in DDL statements. */
  ifNotExists?: boolean;
  /** DuckDB schema name. */
  schemaName?: string;
}

/**
 * PostgreSQL adapter options.
 */
export interface PostgresAdapterConfig {
  /** Use IF NOT EXISTS in DDL statements. */
  ifNotExists?: boolean;
  /** PostgreSQL schema name. */
  schemaName?: string;
}

/**
 * ClickHouse adapter options.
 */
export interface ClickHouseAdapterConfig {
  /** ClickHouse table engine (e.g., 'MergeTree', 'ReplacingMergeTree'). */
  engine?: string;
  /** Use IF NOT EXISTS in DDL statements. */
  ifNotExists?: boolean;
}

/**
 * Iceberg adapter options.
 */
export interface IcebergAdapterConfig {
  /** Iceberg table location (e.g., 's3://bucket/path'). */
  location?: string;
}

/**
 * Adapter-specific configurations.
 */
export interface AdaptersConfig {
  duckdb?: DuckDBAdapterConfig;
  postgres?: PostgresAdapterConfig;
  clickhouse?: ClickHouseAdapterConfig;
  iceberg?: IcebergAdapterConfig;
}

/**
 * Watch mode configuration.
 */
export interface WatchConfig {
  /** Enable watch mode. */
  enabled?: boolean;
  /** Debounce delay in milliseconds. */
  debounce?: number;
}

/**
 * IceType project configuration.
 *
 * @example
 * ```typescript
 * // icetype.config.ts
 * import { defineConfig } from '@icetype/cli';
 *
 * export default defineConfig({
 *   schema: './schemas/*.ts',
 *   output: {
 *     types: './generated/types.ts',
 *     duckdb: './generated/duckdb.sql',
 *   },
 *   adapters: {
 *     duckdb: { ifNotExists: true },
 *   },
 * });
 * ```
 */
export interface IceTypeConfig {
  /** Glob pattern or path to schema file(s). */
  schema?: string;
  /** Output configuration or single output path. */
  output?: OutputConfig | string;
  /** Adapter-specific configurations. */
  adapters?: AdaptersConfig;
  /** Watch mode configuration. */
  watch?: WatchConfig;
  /** Suppress non-error output. */
  quiet?: boolean;
  /** Enable verbose logging. */
  verbose?: boolean;
}

/**
 * Config function type for dynamic configs.
 */
export type IceTypeConfigFn = () => IceTypeConfig | Promise<IceTypeConfig>;

/**
 * Config export type - can be object or function.
 */
export type IceTypeConfigExport = IceTypeConfig | IceTypeConfigFn;

/**
 * Result of config validation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Result of loading a config file.
 */
export interface LoadConfigResult {
  config: IceTypeConfig;
  configPath?: string;
}

/**
 * Options for loading config.
 */
export interface LoadConfigOptions {
  /** Working directory to search for config. */
  cwd?: string;
  /** Explicit path to config file. */
  configPath?: string;
}

/**
 * Options for full config resolution.
 */
export interface ResolveConfigOptions {
  /** Working directory to search for config. */
  cwd?: string;
  /** Explicit path to config file. */
  configPath?: string;
  /** CLI options to merge (take precedence). */
  cliOptions?: Partial<IceTypeConfig> & Record<string, unknown>;
}

// =============================================================================
// Config File Discovery
// =============================================================================

/**
 * Config file names in priority order.
 */
const CONFIG_FILES = [
  'icetype.config.ts',
  'icetype.config.js',
  'icetype.config.mjs',
];

/**
 * Find the config file in the given directory.
 *
 * @param cwd - Directory to search in
 * @returns Path to config file or undefined if not found
 */
export function findConfigFile(cwd: string): string | undefined {
  for (const filename of CONFIG_FILES) {
    const configPath = join(cwd, filename);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return undefined;
}

// =============================================================================
// Config Loading
// =============================================================================

/**
 * Load a config file and return its contents.
 *
 * @param options - Loading options
 * @returns Loaded config and path
 * @throws Error if explicit config path doesn't exist
 */
export async function loadConfig(
  options: LoadConfigOptions = {}
): Promise<LoadConfigResult> {
  const cwd = options.cwd ?? process.cwd();

  // If explicit config path provided, use it
  if (options.configPath) {
    const absolutePath = resolve(cwd, options.configPath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Config file not found: ${absolutePath}`);
    }
    const config = await loadConfigFromFile(absolutePath);
    return { config, configPath: absolutePath };
  }

  // Search for config file
  const configPath = findConfigFile(cwd);
  if (!configPath) {
    return { config: {} };
  }

  const config = await loadConfigFromFile(configPath);
  return { config, configPath };
}

/**
 * Load and parse a config file.
 *
 * @param configPath - Absolute path to config file
 * @returns Parsed config object
 */
async function loadConfigFromFile(configPath: string): Promise<IceTypeConfig> {
  try {
    // Convert to file URL for dynamic import
    const fileUrl = pathToFileURL(configPath).href;

    // Dynamic import of the config file
    const configModule = await import(fileUrl);

    // Validate the export
    validateConfigExport(configModule);

    // Resolve the config (handle function exports)
    const configExport = configModule.default as IceTypeConfigExport;
    return await resolveConfig(configExport);
  } catch (error) {
    if (error instanceof Error && error.message.includes('default export')) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config file '${configPath}': ${message}`);
  }
}

// =============================================================================
// Config Resolution
// =============================================================================

/**
 * Resolve a config export (object or function) to a config object.
 *
 * @param configExport - Config object or function
 * @returns Resolved config object
 */
export async function resolveConfig(
  configExport: IceTypeConfigExport
): Promise<IceTypeConfig> {
  if (typeof configExport === 'function') {
    return await configExport();
  }
  return configExport;
}

/**
 * Validate that a module has a default export.
 *
 * @param module - Imported module
 * @throws Error if no default export
 */
export function validateConfigExport(module: unknown): void {
  if (
    module === null ||
    typeof module !== 'object' ||
    !('default' in module)
  ) {
    throw new Error(
      'Config file must have a default export. Use `export default { ... }` or `export default defineConfig({ ... })`'
    );
  }
}

// =============================================================================
// Config Validation
// =============================================================================

/**
 * Validate a config object.
 *
 * @param config - Config to validate
 * @returns Validation result
 */
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (config === null || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }

  const cfg = config as Record<string, unknown>;

  // Validate schema field
  if (cfg.schema !== undefined && typeof cfg.schema !== 'string') {
    errors.push('Config field "schema" must be a string');
  }

  // Validate output field
  if (cfg.output !== undefined) {
    if (typeof cfg.output === 'object' && cfg.output !== null) {
      const output = cfg.output as Record<string, unknown>;
      for (const key of ['types', 'duckdb', 'postgres', 'clickhouse', 'iceberg']) {
        if (output[key] !== undefined && typeof output[key] !== 'string') {
          errors.push(`Config field "output.${key}" must be a string`);
        }
      }
    } else if (typeof cfg.output !== 'string') {
      errors.push('Config field "output" must be a string or object');
    }
  }

  // Validate adapters field
  if (cfg.adapters !== undefined) {
    if (typeof cfg.adapters !== 'object' || cfg.adapters === null) {
      errors.push('Config field "adapters" must be an object');
    }
  }

  // Validate watch field
  if (cfg.watch !== undefined) {
    if (typeof cfg.watch !== 'object' || cfg.watch === null) {
      errors.push('Config field "watch" must be an object');
    }
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// Config Merging
// =============================================================================

/**
 * Deep merge two objects.
 *
 * @param target - Target object
 * @param source - Source object (values take precedence)
 * @returns Merged object
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Deep merge objects
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      // Override with source value
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Merge config file with CLI options.
 * CLI options take precedence over config file values.
 *
 * @param fileConfig - Config from file
 * @param cliOptions - CLI options
 * @returns Merged config
 */
export function mergeConfig(
  fileConfig: IceTypeConfig,
  cliOptions: Partial<IceTypeConfig> & Record<string, unknown>
): IceTypeConfig & Record<string, unknown> {
  // Handle special case where CLI output is a string but file output is object
  if (
    typeof cliOptions.output === 'string' &&
    typeof fileConfig.output === 'object'
  ) {
    // CLI string output replaces entire file output config
    return deepMerge(
      fileConfig as Record<string, unknown>,
      { ...cliOptions, output: cliOptions.output }
    ) as IceTypeConfig & Record<string, unknown>;
  }

  return deepMerge(
    fileConfig as Record<string, unknown>,
    cliOptions as Record<string, unknown>
  ) as IceTypeConfig & Record<string, unknown>;
}

// =============================================================================
// Full Config Resolution
// =============================================================================

/**
 * Resolve full config from file and CLI options.
 *
 * @param options - Resolution options
 * @returns Fully resolved config
 */
export async function resolveFullConfig(
  options: ResolveConfigOptions = {}
): Promise<IceTypeConfig & Record<string, unknown>> {
  const { cwd = process.cwd(), configPath, cliOptions = {} } = options;

  // Load config from file
  const { config: fileConfig } = await loadConfig({ cwd, configPath });

  // Merge with CLI options
  return mergeConfig(fileConfig, cliOptions);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Type helper for defining config with full type checking.
 * This function returns its argument unchanged - it exists purely for
 * TypeScript autocompletion in config files.
 *
 * @example
 * ```typescript
 * // icetype.config.ts
 * import { defineConfig } from '@icetype/cli';
 *
 * export default defineConfig({
 *   schema: './schemas/*.ts',
 *   output: { types: './generated/types.ts' },
 * });
 * ```
 *
 * @param config - Config object
 * @returns The same config object
 */
export function defineConfig(config: IceTypeConfig): IceTypeConfig {
  return config;
}
