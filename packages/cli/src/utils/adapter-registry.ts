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

import { globalRegistry, IcebergAdapter } from '@icetype/adapters';
import type { SchemaAdapter } from '@icetype/adapters';
import { PostgresAdapter } from '@icetype/postgres';
import { DuckDBAdapter } from '@icetype/duckdb';
import { ClickHouseAdapter } from '@icetype/clickhouse';
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
export function getAdapter(name: string): SchemaAdapter | undefined {
  return globalRegistry.get(name);
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
  initialized = false;
}

// =============================================================================
// Re-exports for Convenience
// =============================================================================

/**
 * Re-export the global registry for direct access when needed.
 */
export { globalRegistry };
