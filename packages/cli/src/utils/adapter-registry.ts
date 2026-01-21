/**
 * Adapter Registry Utilities for IceType CLI
 *
 * This module provides functions to initialize and manage the global adapter
 * registry used throughout the CLI. It registers all supported adapters
 * (postgres, duckdb, clickhouse, iceberg) with the globalRegistry from
 * @icetype/adapters.
 *
 * @packageDocumentation
 */

import { globalRegistry } from '@icetype/adapters';
import type { SchemaAdapter } from '@icetype/adapters';
import { PostgresAdapter } from '@icetype/postgres';
import { DuckDBAdapter } from '@icetype/duckdb';
import { ClickHouseAdapter } from '@icetype/clickhouse';
import { IcebergAdapter } from '@icetype/iceberg';
import { MySQLAdapter } from '@icetype/mysql';
import { SQLiteAdapter } from '@icetype/sqlite';

// =============================================================================
// State Management
// =============================================================================

/**
 * Track whether the registry has been initialized to prevent duplicate registration.
 */
let initialized = false;

// =============================================================================
// Extended Adapter Interface for CLI
// =============================================================================

/**
 * Extended adapter with CLI-specific metadata.
 */
export interface ExtendedSchemaAdapter extends SchemaAdapter {
  /** Operations this adapter supports (e.g., 'export', 'import') */
  supportedOperations?: string[];
  /** CLI-specific metadata for help text generation */
  cliMetadata?: {
    description?: string;
    examples?: string[];
  };
  /** CLI option definitions for parseArgs */
  cliOptions?: Record<string, { type: 'string' | 'boolean'; short?: string; description?: string }>;
}

/**
 * Default supported operations for adapters.
 */
const DEFAULT_SUPPORTED_OPERATIONS = ['export'];

/**
 * Default CLI metadata for adapters.
 */
const DEFAULT_CLI_METADATA: Record<string, { description: string; examples: string[] }> = {
  postgres: {
    description: 'PostgreSQL DDL generation adapter',
    examples: [
      'ice postgres export --schema ./schema.ts --output ./tables.sql',
      'ice postgres export -s ./schema.ts --schemaName public',
    ],
  },
  duckdb: {
    description: 'DuckDB DDL generation adapter',
    examples: [
      'ice duckdb export --schema ./schema.ts --output ./tables.sql',
      'ice duckdb export -s ./schema.ts --schema-name analytics',
    ],
  },
  clickhouse: {
    description: 'ClickHouse DDL generation adapter',
    examples: [
      'ice clickhouse export --schema ./schema.ts --output ./tables.sql',
      'ice clickhouse export -s ./schema.ts --engine ReplacingMergeTree',
    ],
  },
  iceberg: {
    description: 'Apache Iceberg metadata generation adapter',
    examples: [
      'ice iceberg export --schema ./schema.ts --output ./metadata.json',
      'ice iceberg export -s ./schema.ts --location s3://bucket/table',
    ],
  },
  mysql: {
    description: 'MySQL DDL generation adapter',
    examples: [
      'ice mysql export --schema ./schema.ts --output ./tables.sql',
    ],
  },
  sqlite: {
    description: 'SQLite DDL generation adapter',
    examples: [
      'ice sqlite export --schema ./schema.ts --output ./tables.sql',
    ],
  },
};

/**
 * Default CLI options for adapters.
 */
const DEFAULT_CLI_OPTIONS = {
  schema: { type: 'string' as const, short: 's', description: 'Path to schema file' },
  output: { type: 'string' as const, short: 'o', description: 'Output file path' },
  help: { type: 'boolean' as const, short: 'h', description: 'Show help' },
};

/**
 * Get adapter with extended CLI metadata.
 *
 * This wraps the base adapter with additional CLI-specific properties
 * like supportedOperations, cliMetadata, and cliOptions.
 *
 * @param name - The adapter name
 * @returns Extended adapter with CLI metadata or undefined
 */
function getExtendedAdapter(name: string): ExtendedSchemaAdapter | undefined {
  const adapter = globalRegistry.get(name);
  if (!adapter) {
    return undefined;
  }

  // Return adapter with extended properties
  const extended = adapter as ExtendedSchemaAdapter;

  // Add default supportedOperations if not present
  if (!extended.supportedOperations) {
    extended.supportedOperations = DEFAULT_SUPPORTED_OPERATIONS;
  }

  // Add default cliMetadata if not present
  if (!extended.cliMetadata) {
    extended.cliMetadata = DEFAULT_CLI_METADATA[name] || {
      description: `${name} adapter`,
      examples: [`ice ${name} export --schema ./schema.ts`],
    };
  }

  // Add default cliOptions if not present
  if (!extended.cliOptions) {
    extended.cliOptions = DEFAULT_CLI_OPTIONS;
  }

  return extended;
}

// =============================================================================
// Custom Command Handlers
// =============================================================================

/**
 * Custom command handler type.
 */
export type CommandHandler = (args: string[]) => Promise<string>;

/**
 * Store for custom command handlers.
 */
const customCommandHandlers = new Map<string, CommandHandler>();

/**
 * Track which adapters have been loaded (for lazy loading).
 */
const loadedAdapters = new Set<string>();

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the global adapter registry with all supported adapters.
 *
 * This function registers the following adapters:
 * - postgres: PostgreSQL DDL generation
 * - duckdb: DuckDB DDL generation
 * - clickhouse: ClickHouse DDL generation
 * - iceberg: Apache Iceberg metadata generation
 *
 * The function is idempotent - calling it multiple times will not
 * register adapters more than once.
 *
 * @example
 * ```typescript
 * import { initializeAdapterRegistry } from './utils/adapter-registry.js';
 *
 * // Call at CLI startup
 * initializeAdapterRegistry();
 *
 * // Now adapters are available via globalRegistry
 * import { globalRegistry } from '@icetype/adapters';
 * const postgres = globalRegistry.get('postgres');
 * ```
 */
export function initializeAdapterRegistry(): void {
  // Prevent duplicate registration
  if (initialized) {
    return;
  }

  // Register all supported adapters
  // Note: Each adapter's `name` property determines its registry key

  // PostgreSQL adapter
  if (!globalRegistry.has('postgres')) {
    globalRegistry.register(new PostgresAdapter());
  }

  // DuckDB adapter
  if (!globalRegistry.has('duckdb')) {
    globalRegistry.register(new DuckDBAdapter());
  }

  // ClickHouse adapter
  if (!globalRegistry.has('clickhouse')) {
    globalRegistry.register(new ClickHouseAdapter());
  }

  // Iceberg adapter
  if (!globalRegistry.has('iceberg')) {
    globalRegistry.register(new IcebergAdapter());
  }

  // MySQL adapter
  if (!globalRegistry.has('mysql')) {
    globalRegistry.register(new MySQLAdapter());
  }

  // SQLite adapter
  if (!globalRegistry.has('sqlite')) {
    globalRegistry.register(new SQLiteAdapter());
  }

  initialized = true;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get an adapter from the global registry by name.
 *
 * This is a convenience wrapper around `globalRegistry.get()` that ensures
 * the registry is initialized before attempting to retrieve an adapter.
 * Returns the adapter with extended CLI metadata attached.
 *
 * @param name - The adapter name (e.g., 'postgres', 'duckdb', 'clickhouse', 'iceberg')
 * @returns The adapter if found, undefined otherwise
 *
 * @example
 * ```typescript
 * import { getAdapter } from './utils/adapter-registry.js';
 *
 * const postgresAdapter = getAdapter('postgres');
 * if (postgresAdapter) {
 *   const ddl = postgresAdapter.transform(schema);
 *   const sql = postgresAdapter.serialize(ddl);
 * }
 * ```
 */
export function getAdapter(name: string): ExtendedSchemaAdapter | undefined {
  return getExtendedAdapter(name);
}

/**
 * Check if an adapter is registered in the global registry.
 *
 * @param name - The adapter name to check
 * @returns True if the adapter is registered
 *
 * @example
 * ```typescript
 * import { hasAdapter } from './utils/adapter-registry.js';
 *
 * if (hasAdapter('postgres')) {
 *   // PostgreSQL adapter is available
 * }
 * ```
 */
export function hasAdapter(name: string): boolean {
  return globalRegistry.has(name);
}

/**
 * Get a list of all registered adapter names.
 *
 * @returns Array of registered adapter names
 *
 * @example
 * ```typescript
 * import { listAdapters } from './utils/adapter-registry.js';
 *
 * const adapters = listAdapters();
 * console.log('Available adapters:', adapters.join(', '));
 * // Output: Available adapters: postgres, duckdb, clickhouse, iceberg
 * ```
 */
export function listAdapters(): string[] {
  return globalRegistry.list();
}

/**
 * Reset the registry state (primarily for testing).
 *
 * This clears the global registry and resets the initialized flag,
 * allowing `initializeAdapterRegistry` to register adapters again.
 *
 * @internal
 */
export function resetAdapterRegistry(): void {
  globalRegistry.clear();
  customCommandHandlers.clear();
  loadedAdapters.clear();
  initialized = false;
}

// =============================================================================
// Dynamic Command Discovery
// =============================================================================

/**
 * Command metadata for CLI help generation.
 */
export interface CommandMetadata {
  name: string;
  description: string;
  subcommands: string[];
  examples?: string[];
}

/**
 * Get available commands based on registered adapters.
 *
 * @returns Array of command metadata for each registered adapter
 */
export function getAvailableCommands(): CommandMetadata[] {
  const adapters = globalRegistry.list();
  const commands: CommandMetadata[] = [];

  for (const name of adapters) {
    const adapter = getExtendedAdapter(name);
    if (!adapter) continue;

    commands.push({
      name,
      description: adapter.cliMetadata?.description || `${name} adapter`,
      subcommands: adapter.supportedOperations || DEFAULT_SUPPORTED_OPERATIONS,
      examples: adapter.cliMetadata?.examples,
    });
  }

  return commands;
}

/**
 * Generate dynamic help text from registered adapters.
 *
 * @returns Help text string including all registered adapters
 */
export function generateDynamicHelpText(): string {
  const commands = getAvailableCommands();
  const lines: string[] = ['Available adapter commands:'];

  for (const cmd of commands) {
    lines.push(`  ${cmd.name}`);
    for (const subcmd of cmd.subcommands) {
      lines.push(`    ${cmd.name} ${subcmd}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Dynamic Command Router
// =============================================================================

/**
 * Dynamic command router interface.
 */
export interface DynamicCommandRouter {
  hasCommand(name: string): boolean;
  getSubcommands(name: string): string[];
}

/**
 * Create a dynamic command router based on registered adapters.
 *
 * @returns Router object for checking commands and subcommands
 */
export function createDynamicCommandRouter(): DynamicCommandRouter {
  return {
    hasCommand(name: string): boolean {
      return globalRegistry.has(name);
    },
    getSubcommands(name: string): string[] {
      const adapter = getExtendedAdapter(name);
      return adapter?.supportedOperations || [];
    },
  };
}

// =============================================================================
// Command Registry
// =============================================================================

/**
 * Build a command registry mapping adapter:subcommand to handlers.
 *
 * @returns Map of command keys (e.g., 'postgres:export') to existence
 */
export function buildCommandRegistry(): Map<string, boolean> {
  const registry = new Map<string, boolean>();
  const adapters = globalRegistry.list();

  for (const name of adapters) {
    const adapter = getExtendedAdapter(name);
    if (!adapter) continue;

    const operations = adapter.supportedOperations || DEFAULT_SUPPORTED_OPERATIONS;
    for (const op of operations) {
      registry.set(`${name}:${op}`, true);
    }
  }

  return registry;
}

// =============================================================================
// Unified Export Handler
// =============================================================================

/**
 * Unified export handler interface.
 */
export interface UnifiedExportHandler {
  export(adapterName: string, schema: import('@icetype/core').IceTypeSchema, options?: unknown): Promise<string>;
}

/**
 * Create a unified export handler that works with any registered adapter.
 *
 * @returns Handler object with export method
 */
export function createUnifiedExportHandler(): UnifiedExportHandler {
  return {
    async export(adapterName: string, schema: import('@icetype/core').IceTypeSchema, options?: unknown): Promise<string> {
      const adapter = globalRegistry.get(adapterName);
      if (!adapter) {
        throw new Error(`Adapter '${adapterName}' not found`);
      }

      const output = adapter.transform(schema, options);
      return adapter.serialize(output);
    },
  };
}

// =============================================================================
// Custom Command Registration
// =============================================================================

/**
 * Register a custom command handler for an adapter.
 *
 * @param adapterName - The adapter name
 * @param commandName - The command/subcommand name
 * @param handler - The handler function
 */
export function registerAdapterCommand(
  adapterName: string,
  commandName: string,
  handler: CommandHandler
): void {
  const key = `${adapterName}:${commandName}`;
  customCommandHandlers.set(key, handler);

  // Also update the adapter's supported operations
  const adapter = getExtendedAdapter(adapterName);
  if (adapter && adapter.supportedOperations && !adapter.supportedOperations.includes(commandName)) {
    adapter.supportedOperations.push(commandName);
  }
}

/**
 * Execute a custom adapter command.
 *
 * @param adapterName - The adapter name
 * @param commandName - The command/subcommand name
 * @param args - Command arguments
 * @returns Promise resolving to command result
 */
export async function executeAdapterCommand(
  adapterName: string,
  commandName: string,
  args: string[]
): Promise<string> {
  const key = `${adapterName}:${commandName}`;
  const handler = customCommandHandlers.get(key);

  if (!handler) {
    throw new Error(`No handler registered for ${key}`);
  }

  return handler(args);
}

// =============================================================================
// Error Handling with Suggestions
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Suggest similar adapter names for typos.
 *
 * @param input - The input adapter name (possibly misspelled)
 * @returns Array of similar adapter names
 */
export function suggestSimilarAdapters(input: string): string[] {
  const adapters = globalRegistry.list();
  const suggestions: Array<{ name: string; distance: number }> = [];

  for (const name of adapters) {
    const distance = levenshteinDistance(input.toLowerCase(), name.toLowerCase());
    // Include if exact match or within threshold
    if (distance <= 3 || name.includes(input) || input.includes(name)) {
      suggestions.push({ name, distance });
    }
  }

  // Sort by distance (closest first)
  suggestions.sort((a, b) => a.distance - b.distance);

  return suggestions.map(s => s.name);
}

/**
 * Get an adapter or throw a descriptive error with suggestions.
 *
 * @param name - The adapter name
 * @returns The adapter
 * @throws Error with helpful message if adapter not found
 */
export function getAdapterOrThrow(name: string): SchemaAdapter {
  const adapter = globalRegistry.get(name);

  if (!adapter) {
    const available = globalRegistry.list();
    const suggestions = suggestSimilarAdapters(name);

    let message = `Adapter '${name}' not found.`;

    if (suggestions.length > 0 && suggestions[0] !== name) {
      message += ` Did you mean '${suggestions[0]}'?`;
    }

    message += ` Available adapters: ${available.join(', ')}`;

    throw new Error(message);
  }

  return adapter;
}

/**
 * Validate that a subcommand is valid for an adapter.
 *
 * @param adapterName - The adapter name
 * @param subcommand - The subcommand to validate
 * @throws Error if subcommand is invalid
 */
export function validateAdapterSubcommand(adapterName: string, subcommand: string): void {
  const adapter = getExtendedAdapter(adapterName);

  if (!adapter) {
    throw new Error(`Adapter '${adapterName}' not found`);
  }

  const validSubcommands = adapter.supportedOperations || DEFAULT_SUPPORTED_OPERATIONS;

  if (!validSubcommands.includes(subcommand)) {
    throw new Error(
      `Unknown subcommand '${subcommand}' for adapter '${adapterName}'. ` +
      `Available subcommands: ${validSubcommands.join(', ')}`
    );
  }
}

// =============================================================================
// CLI Router
// =============================================================================

/**
 * CLI router interface for dynamic command routing.
 */
export interface CliRouter {
  isAdapterCommand(name: string): boolean;
  getHandler(adapterName: string, subcommand: string): ((args: string[]) => Promise<void>) | undefined;
}

/**
 * Create a CLI router for dynamic command dispatching.
 *
 * @returns CLI router object
 */
export function createCliRouter(): CliRouter {
  return {
    isAdapterCommand(name: string): boolean {
      return globalRegistry.has(name);
    },

    getHandler(adapterName: string, subcommand: string): ((args: string[]) => Promise<void>) | undefined {
      const adapter = globalRegistry.get(adapterName);
      if (!adapter) {
        return undefined;
      }

      // Check for custom handler first
      const customKey = `${adapterName}:${subcommand}`;
      const customHandler = customCommandHandlers.get(customKey);
      if (customHandler) {
        return async (args: string[]) => {
          await customHandler(args);
        };
      }

      // Default export handler
      if (subcommand === 'export') {
        return async (_args: string[]) => {
          // This would be implemented with actual CLI logic
          // For now, just return a placeholder
        };
      }

      return undefined;
    },
  };
}

// =============================================================================
// Lazy Adapter Loading
// =============================================================================

/**
 * Lazy adapter loader interface.
 */
export interface LazyAdapterLoader {
  isLoaded(name: string): boolean;
  load(name: string): Promise<SchemaAdapter>;
}

/**
 * Create a lazy adapter loader for on-demand adapter loading.
 *
 * @returns Lazy adapter loader object
 */
export function createLazyAdapterLoader(): LazyAdapterLoader {
  return {
    isLoaded(name: string): boolean {
      return loadedAdapters.has(name);
    },

    async load(name: string): Promise<SchemaAdapter> {
      const adapter = globalRegistry.get(name);
      if (!adapter) {
        throw new Error(`Adapter '${name}' not found`);
      }

      loadedAdapters.add(name);
      return adapter;
    },
  };
}

// =============================================================================
// Re-exports for Convenience
// =============================================================================

/**
 * Re-export the global registry for direct access when needed.
 */
export { globalRegistry };
