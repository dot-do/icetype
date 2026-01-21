/**
 * @icetype/migrations
 *
 * Migration generation and management infrastructure for IceType schemas.
 *
 * This package provides:
 * - `MigrationGenerator` interface for generating SQL statements from schema diffs
 * - `MigrationRunner` interface for executing migrations
 * - `MigrationHistory` for tracking applied migrations
 * - Dialect-specific SQL generation (SQLite, PostgreSQL, MySQL, DuckDB)
 *
 * @example
 * ```typescript
 * import {
 *   generateMigration,
 *   createMigrationRunner,
 *   createMigrationHistory,
 *   InMemoryHistoryStorage,
 * } from '@icetype/migrations';
 * import { diffSchemas } from '@icetype/core';
 *
 * // Generate migration from schema diff
 * const diff = diffSchemas(oldSchema, newSchema);
 * const statements = generateMigration(diff, 'postgres');
 *
 * // Execute migration
 * const runner = createMigrationRunner(executor);
 * const result = await runner.run(migration, statements);
 *
 * // Track applied migrations
 * const history = createMigrationHistory(new InMemoryHistoryStorage());
 * await history.record(migration);
 *
 * // Get pending migrations
 * const pending = await history.getPending(allMigrations);
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Generator Exports
// =============================================================================

export {
  // Types
  type Dialect,
  type GeneratorOptions,
  type MigrationGenerator,
  // Factory functions
  createMigrationGenerator,
  generateMigration,
} from './generator.js';

// =============================================================================
// Runner Exports
// =============================================================================

export {
  // Types
  type MigrationResult,
  type BatchMigrationResult,
  type RunnerOptions,
  type DatabaseExecutor,
  type MigrationRunner,
  // Classes
  MigrationError,
  // Factory functions
  createMigrationRunner,
} from './runner.js';

// =============================================================================
// History Exports
// =============================================================================

export {
  // Types
  type MigrationRecord,
  type RollbackRecord,
  type RollbackResult,
  type ReapplyResult,
  type RecordOptions,
  type RollbackCheckOptions,
  type HistoryQueryOptions,
  type HistoryStorage,
  type MigrationHistory,
  // Classes
  InMemoryHistoryStorage,
  // Factory functions
  createMigrationHistory,
} from './history.js';

// =============================================================================
// Re-export Core Types for Convenience
// =============================================================================

// Re-export types from @icetype/core that are commonly used with migrations
export type {
  Migration,
  MigrationOperation,
  SchemaVersion,
  SchemaDiff,
  SchemaChange,
} from '@icetype/core';
