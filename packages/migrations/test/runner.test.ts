/**
 * Tests for MigrationRunner interface
 *
 * TDD RED Phase: These tests define the expected behavior before implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Migration, SchemaVersion } from '@icetype/core';
import { createSchemaVersion } from '@icetype/core';
import {
  type MigrationRunner,
  type RunnerOptions,
  type MigrationResult,
  createMigrationRunner,
  MigrationError,
} from '../src/runner.js';

describe('MigrationRunner interface', () => {
  // Mock database executor
  const createMockExecutor = () => ({
    execute: vi.fn().mockResolvedValue(undefined),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  });

  const createMockMigration = (
    id: string,
    fromVersion: SchemaVersion,
    toVersion: SchemaVersion
  ): Migration => ({
    id,
    fromVersion,
    toVersion,
    timestamp: new Date(),
    operations: [
      {
        op: 'addColumn',
        table: 'users',
        column: 'email',
        type: 'string',
        nullable: true,
      },
    ],
    isBreaking: false,
  });

  describe('interface contract', () => {
    it('should have run method that executes a migration', async () => {
      const executor = createMockExecutor();
      const runner: MigrationRunner = {
        run: async (migration: Migration, statements: string[]): Promise<MigrationResult> => {
          for (const stmt of statements) {
            await executor.execute(stmt);
          }
          return {
            success: true,
            migrationId: migration.id,
            executedStatements: statements.length,
          };
        },
        runAll: async () => ({ success: true, migrationsRun: 0, results: [] }),
        rollback: async () => ({ success: true, migrationId: '', executedStatements: 0 }),
        dryRun: async () => [],
      };

      const migration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      const result = await runner.run(migration, ['SELECT 1;']);

      expect(result.success).toBe(true);
      expect(result.migrationId).toBe('test-1');
      expect(result.executedStatements).toBe(1);
    });

    it('should have runAll method for batch migrations', async () => {
      const runner: MigrationRunner = {
        run: async () => ({ success: true, migrationId: '', executedStatements: 0 }),
        runAll: async (migrations, statementsMap) => ({
          success: true,
          migrationsRun: migrations.length,
          results: migrations.map((m) => ({
            success: true,
            migrationId: m.id,
            executedStatements: (statementsMap.get(m.id) || []).length,
          })),
        }),
        rollback: async () => ({ success: true, migrationId: '', executedStatements: 0 }),
        dryRun: async () => [],
      };

      const migrations = [
        createMockMigration('test-1', createSchemaVersion(1, 0, 0), createSchemaVersion(1, 1, 0)),
        createMockMigration('test-2', createSchemaVersion(1, 1, 0), createSchemaVersion(1, 2, 0)),
      ];

      const statementsMap = new Map<string, string[]>([
        ['test-1', ['ALTER TABLE users ADD COLUMN email TEXT;']],
        ['test-2', ['ALTER TABLE users ADD COLUMN name TEXT;']],
      ]);

      const result = await runner.runAll(migrations, statementsMap);

      expect(result.success).toBe(true);
      expect(result.migrationsRun).toBe(2);
      expect(result.results.length).toBe(2);
    });

    it('should have rollback method', async () => {
      const runner: MigrationRunner = {
        run: async () => ({ success: true, migrationId: '', executedStatements: 0 }),
        runAll: async () => ({ success: true, migrationsRun: 0, results: [] }),
        rollback: async (migration, statements) => ({
          success: true,
          migrationId: migration.id,
          executedStatements: statements.length,
        }),
        dryRun: async () => [],
      };

      const migration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      const result = await runner.rollback(migration, ['DROP COLUMN email;']);

      expect(result.success).toBe(true);
      expect(result.migrationId).toBe('test-1');
    });

    it('should have dryRun method for preview', async () => {
      const runner: MigrationRunner = {
        run: async () => ({ success: true, migrationId: '', executedStatements: 0 }),
        runAll: async () => ({ success: true, migrationsRun: 0, results: [] }),
        rollback: async () => ({ success: true, migrationId: '', executedStatements: 0 }),
        dryRun: async (migration, statements) => statements,
      };

      const migration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      const preview = await runner.dryRun(migration, [
        'ALTER TABLE users ADD COLUMN email TEXT;',
      ]);

      expect(preview).toEqual(['ALTER TABLE users ADD COLUMN email TEXT;']);
    });
  });
});

describe('createMigrationRunner factory', () => {
  const createMockExecutor = () => ({
    execute: vi.fn().mockResolvedValue(undefined),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  });

  it('should create a runner with default options', () => {
    const executor = createMockExecutor();
    const runner = createMigrationRunner(executor);

    expect(runner).toBeDefined();
    expect(typeof runner.run).toBe('function');
    expect(typeof runner.runAll).toBe('function');
    expect(typeof runner.rollback).toBe('function');
    expect(typeof runner.dryRun).toBe('function');
  });

  it('should accept custom options', () => {
    const executor = createMockExecutor();
    const options: RunnerOptions = {
      useTransactions: true,
      stopOnError: true,
      logStatements: false,
    };

    const runner = createMigrationRunner(executor, options);

    expect(runner).toBeDefined();
  });

  it('should execute statements in transaction when useTransactions is true', async () => {
    const executor = createMockExecutor();
    const runner = createMigrationRunner(executor, { useTransactions: true });

    const migration = {
      id: 'test-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date(),
      operations: [],
      isBreaking: false,
    };

    await runner.run(migration, ['ALTER TABLE users ADD COLUMN email TEXT;']);

    expect(executor.beginTransaction).toHaveBeenCalled();
    expect(executor.execute).toHaveBeenCalledWith('ALTER TABLE users ADD COLUMN email TEXT;');
    expect(executor.commit).toHaveBeenCalled();
  });

  it('should rollback on error when in transaction', async () => {
    const executor = createMockExecutor();
    executor.execute.mockRejectedValueOnce(new Error('SQL error'));

    const runner = createMigrationRunner(executor, { useTransactions: true });

    const migration = {
      id: 'test-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date(),
      operations: [],
      isBreaking: false,
    };

    const result = await runner.run(migration, ['INVALID SQL;']);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(executor.rollback).toHaveBeenCalled();
  });
});

describe('MigrationError', () => {
  it('should include migration id and statement index', () => {
    const error = new MigrationError('Failed to execute', 'test-1', 2, 'ALTER TABLE...');

    expect(error.message).toBe('Failed to execute');
    expect(error.migrationId).toBe('test-1');
    expect(error.statementIndex).toBe(2);
    expect(error.statement).toBe('ALTER TABLE...');
  });

  it('should be instanceof Error', () => {
    const error = new MigrationError('Failed', 'test-1', 0);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MigrationError);
  });
});
