/**
 * Migration Runner Module for @icetype/migrations
 *
 * Provides interfaces and implementations for executing migrations
 * against a database.
 *
 * @packageDocumentation
 */

import type { Migration } from '@icetype/core';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of running a single migration.
 */
export interface MigrationResult {
  /** Whether the migration succeeded */
  success: boolean;
  /** The ID of the migration that was run */
  migrationId: string;
  /** Number of SQL statements executed */
  executedStatements: number;
  /** Error information if the migration failed */
  error?: MigrationError;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * Result of running multiple migrations.
 */
export interface BatchMigrationResult {
  /** Whether all migrations succeeded */
  success: boolean;
  /** Number of migrations that were run */
  migrationsRun: number;
  /** Results for each individual migration */
  results: MigrationResult[];
  /** Total execution time in milliseconds */
  totalExecutionTime?: number;
}

/**
 * Options for configuring the migration runner.
 */
export interface RunnerOptions {
  /** Whether to wrap migrations in transactions (default: true) */
  useTransactions?: boolean;
  /** Whether to stop on first error (default: true) */
  stopOnError?: boolean;
  /** Whether to log executed statements (default: false) */
  logStatements?: boolean;
  /** Logger function for statement logging */
  logger?: (message: string) => void;
}

/**
 * Interface for database execution.
 * Adapters implement this to connect the runner to their database.
 */
export interface DatabaseExecutor {
  /** Execute a SQL statement */
  execute(sql: string): Promise<void>;
  /** Begin a transaction */
  beginTransaction(): Promise<void>;
  /** Commit the current transaction */
  commit(): Promise<void>;
  /** Rollback the current transaction */
  rollback(): Promise<void>;
}

/**
 * Interface for running migrations.
 */
export interface MigrationRunner {
  /**
   * Run a single migration.
   * @param migration - The migration to run
   * @param statements - SQL statements to execute
   * @returns Result of the migration
   */
  run(migration: Migration, statements: string[]): Promise<MigrationResult>;

  /**
   * Run multiple migrations in sequence.
   * @param migrations - Array of migrations to run
   * @param statementsMap - Map of migration ID to SQL statements
   * @returns Result of the batch migration
   */
  runAll(
    migrations: Migration[],
    statementsMap: Map<string, string[]>
  ): Promise<BatchMigrationResult>;

  /**
   * Rollback a migration.
   * @param migration - The migration to rollback
   * @param statements - Rollback SQL statements
   * @returns Result of the rollback
   */
  rollback(migration: Migration, statements: string[]): Promise<MigrationResult>;

  /**
   * Preview migration statements without executing.
   * @param migration - The migration to preview
   * @param statements - SQL statements to preview
   * @returns The statements that would be executed
   */
  dryRun(migration: Migration, statements: string[]): Promise<string[]>;
}

// =============================================================================
// Error Class
// =============================================================================

/**
 * Error thrown when a migration fails.
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly migrationId: string,
    public readonly statementIndex: number,
    public readonly statement?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MigrationError';

    // Fix prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, MigrationError.prototype);
  }
}

// =============================================================================
// Implementation
// =============================================================================

class DefaultMigrationRunner implements MigrationRunner {
  constructor(
    private readonly executor: DatabaseExecutor,
    private readonly options: RunnerOptions = {}
  ) {}

  async run(migration: Migration, statements: string[]): Promise<MigrationResult> {
    const startTime = Date.now();
    const useTransactions = this.options.useTransactions !== false;

    try {
      if (useTransactions) {
        await this.executor.beginTransaction();
      }

      let executedCount = 0;
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]!;

        if (this.options.logStatements) {
          const logger = this.options.logger ?? console.log;
          logger(`[${migration.id}] Executing: ${stmt}`);
        }

        try {
          await this.executor.execute(stmt);
          executedCount++;
        } catch (error) {
          const migrationError = new MigrationError(
            error instanceof Error ? error.message : String(error),
            migration.id,
            i,
            stmt,
            error instanceof Error ? error : undefined
          );

          if (useTransactions) {
            await this.executor.rollback();
          }

          return {
            success: false,
            migrationId: migration.id,
            executedStatements: executedCount,
            error: migrationError,
            executionTime: Date.now() - startTime,
          };
        }
      }

      if (useTransactions) {
        await this.executor.commit();
      }

      return {
        success: true,
        migrationId: migration.id,
        executedStatements: executedCount,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      // Handle transaction errors
      if (useTransactions) {
        try {
          await this.executor.rollback();
        } catch {
          // Ignore rollback errors
        }
      }

      return {
        success: false,
        migrationId: migration.id,
        executedStatements: 0,
        error: new MigrationError(
          error instanceof Error ? error.message : String(error),
          migration.id,
          -1,
          undefined,
          error instanceof Error ? error : undefined
        ),
        executionTime: Date.now() - startTime,
      };
    }
  }

  async runAll(
    migrations: Migration[],
    statementsMap: Map<string, string[]>
  ): Promise<BatchMigrationResult> {
    const startTime = Date.now();
    const results: MigrationResult[] = [];
    const stopOnError = this.options.stopOnError !== false;

    for (const migration of migrations) {
      const statements = statementsMap.get(migration.id) ?? [];
      const result = await this.run(migration, statements);
      results.push(result);

      if (!result.success && stopOnError) {
        return {
          success: false,
          migrationsRun: results.length,
          results,
          totalExecutionTime: Date.now() - startTime,
        };
      }
    }

    const allSucceeded = results.every((r) => r.success);

    return {
      success: allSucceeded,
      migrationsRun: results.length,
      results,
      totalExecutionTime: Date.now() - startTime,
    };
  }

  async rollback(migration: Migration, statements: string[]): Promise<MigrationResult> {
    // Rollback is essentially running a migration with rollback statements
    return this.run(migration, statements);
  }

  async dryRun(_migration: Migration, statements: string[]): Promise<string[]> {
    // Simply return the statements that would be executed
    return statements;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a MigrationRunner with the given database executor.
 *
 * @param executor - The database executor to use
 * @param options - Optional configuration options
 * @returns A MigrationRunner instance
 *
 * @example
 * ```typescript
 * const executor = {
 *   execute: (sql) => db.exec(sql),
 *   beginTransaction: () => db.exec('BEGIN'),
 *   commit: () => db.exec('COMMIT'),
 *   rollback: () => db.exec('ROLLBACK'),
 * };
 *
 * const runner = createMigrationRunner(executor);
 * const result = await runner.run(migration, statements);
 * ```
 */
export function createMigrationRunner(
  executor: DatabaseExecutor,
  options: RunnerOptions = {}
): MigrationRunner {
  return new DefaultMigrationRunner(executor, options);
}
