/**
 * Tests for Migration Rollback Support
 *
 * TDD RED Phase: These tests define the expected behavior for rollback functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Migration, SchemaVersion, SchemaDiff } from '@icetype/core';
import { createSchemaVersion } from '@icetype/core';
import {
  type MigrationRunner,
  type MigrationHistory,
  type MigrationRecord,
  type RollbackRecord,
  type RollbackResult,
  createMigrationRunner,
  createMigrationHistory,
  InMemoryHistoryStorage,
  MigrationError,
  createMigrationGenerator,
} from '../index.js';

// =============================================================================
// Test Helpers
// =============================================================================

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

// =============================================================================
// Rollback Execution Tests
// =============================================================================

describe('Migration Rollback Execution', () => {
  describe('successful rollback', () => {
    it('should execute rollback statements in reverse order', async () => {
      const executor = createMockExecutor();
      const runner = createMigrationRunner(executor);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      const rollbackStatements = [
        'DROP INDEX idx_users_email;',
        'ALTER TABLE users DROP COLUMN email;',
      ];

      const result = await runner.rollback(migration, rollbackStatements);

      expect(result.success).toBe(true);
      expect(result.migrationId).toBe('migration-1');
      expect(result.executedStatements).toBe(2);
      expect(executor.execute).toHaveBeenCalledTimes(2);
    });

    it('should wrap rollback in transaction by default', async () => {
      const executor = createMockExecutor();
      const runner = createMigrationRunner(executor, { useTransactions: true });

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await runner.rollback(migration, ['ALTER TABLE users DROP COLUMN email;']);

      expect(executor.beginTransaction).toHaveBeenCalled();
      expect(executor.commit).toHaveBeenCalled();
    });

    it('should report execution time for rollback', async () => {
      const executor = createMockExecutor();
      const runner = createMigrationRunner(executor);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      const result = await runner.rollback(migration, ['SELECT 1;']);

      expect(result.executionTime).toBeDefined();
      expect(typeof result.executionTime).toBe('number');
    });
  });

  describe('rollback of unapplied migration', () => {
    it('should fail when trying to rollback an unapplied migration', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'unapplied-migration',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      // Migration was never applied
      const wasApplied = await history.hasApplied('unapplied-migration');
      expect(wasApplied).toBe(false);

      // The rollback validation should check this before execution
      const canRollback = await history.canRollback('unapplied-migration');
      expect(canRollback.allowed).toBe(false);
      expect(canRollback.reason).toContain('not applied');
    });
  });

  describe('partial rollback failure handling', () => {
    it('should track partial rollback when some statements fail', async () => {
      const executor = createMockExecutor();
      // First statement succeeds, second fails
      executor.execute
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Constraint violation'));

      const runner = createMigrationRunner(executor, { useTransactions: false });

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      const result = await runner.rollback(migration, [
        'ALTER TABLE users DROP COLUMN email;',
        'ALTER TABLE users DROP COLUMN name;', // This will fail
      ]);

      expect(result.success).toBe(false);
      expect(result.executedStatements).toBe(1);
      expect(result.error).toBeDefined();
      expect(result.error?.statementIndex).toBe(1);
    });

    it('should rollback database transaction on partial failure', async () => {
      const executor = createMockExecutor();
      executor.execute
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('SQL error'));

      const runner = createMigrationRunner(executor, { useTransactions: true });

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await runner.rollback(migration, [
        'ALTER TABLE users DROP COLUMN email;',
        'INVALID SQL;',
      ]);

      expect(executor.rollback).toHaveBeenCalled();
      expect(executor.commit).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Rollback History Tracking Tests
// =============================================================================

describe('Migration Rollback History', () => {
  describe('recordRollback method', () => {
    it('should record when a migration is rolled back', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      // First apply the migration
      await history.record(migration);
      expect(await history.hasApplied('migration-1')).toBe(true);

      // Then record the rollback
      await history.recordRollback('migration-1');

      // Migration should no longer be marked as applied
      expect(await history.hasApplied('migration-1')).toBe(false);
    });

    it('should track rollback history with timestamp', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration);

      const beforeRollback = new Date();
      await history.recordRollback('migration-1');
      const afterRollback = new Date();

      const rollbackRecord = await history.getRollbackRecord('migration-1');

      expect(rollbackRecord).not.toBeNull();
      expect(rollbackRecord!.rolledBackAt.getTime()).toBeGreaterThanOrEqual(
        beforeRollback.getTime()
      );
      expect(rollbackRecord!.rolledBackAt.getTime()).toBeLessThanOrEqual(
        afterRollback.getTime()
      );
    });

    it('should preserve original migration record when rolling back', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      migration.description = 'Add email column';

      await history.record(migration);
      await history.recordRollback('migration-1');

      // Can still get the rollback record with original info
      const rollbackRecord = await history.getRollbackRecord('migration-1');
      expect(rollbackRecord).not.toBeNull();
      expect(rollbackRecord!.originalRecord.description).toBe('Add email column');
    });
  });

  describe('preventing re-application of rolled-back migrations', () => {
    it('should flag migration as rolled back', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration);
      await history.recordRollback('migration-1');

      const wasRolledBack = await history.wasRolledBack('migration-1');
      expect(wasRolledBack).toBe(true);
    });

    it('should warn when re-applying a rolled-back migration without force flag', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration);
      await history.recordRollback('migration-1');

      const canReapply = await history.canReapply('migration-1');
      expect(canReapply.allowed).toBe(false);
      expect(canReapply.reason).toContain('previously rolled back');
    });

    it('should allow re-applying with force flag', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration);
      await history.recordRollback('migration-1');

      const canReapply = await history.canReapply('migration-1', { force: true });
      expect(canReapply.allowed).toBe(true);
    });

    it('should clear rolled-back status when re-applied with force', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration);
      await history.recordRollback('migration-1');
      await history.record(migration, { force: true });

      expect(await history.wasRolledBack('migration-1')).toBe(false);
      expect(await history.hasApplied('migration-1')).toBe(true);
    });
  });

  describe('rollback history listing', () => {
    it('should list all rolled-back migrations', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration1 = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      const migration2 = createMockMigration(
        'migration-2',
        createSchemaVersion(1, 1, 0),
        createSchemaVersion(1, 2, 0)
      );

      await history.record(migration1);
      await history.record(migration2);
      await history.recordRollback('migration-1');
      await history.recordRollback('migration-2');

      const rolledBack = await history.getRolledBackMigrations();

      expect(rolledBack.length).toBe(2);
      expect(rolledBack.map((r) => r.migrationId)).toContain('migration-1');
      expect(rolledBack.map((r) => r.migrationId)).toContain('migration-2');
    });
  });
});

// =============================================================================
// Rollback Validation Tests
// =============================================================================

describe('Rollback Validation', () => {
  describe('verify migration was applied', () => {
    it('should verify migration exists before rollback', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const canRollback = await history.canRollback('nonexistent-migration');

      expect(canRollback.allowed).toBe(false);
      expect(canRollback.reason).toContain('not applied');
    });

    it('should allow rollback for applied migration', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration);

      const canRollback = await history.canRollback('migration-1');

      expect(canRollback.allowed).toBe(true);
    });
  });

  describe('check for dependent migrations', () => {
    it('should detect dependent migrations that would break', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration1 = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      const migration2 = createMockMigration(
        'migration-2',
        createSchemaVersion(1, 1, 0), // Depends on migration-1
        createSchemaVersion(1, 2, 0)
      );

      await history.record(migration1);
      await history.record(migration2);

      // Rolling back migration-1 would break migration-2
      const canRollback = await history.canRollback('migration-1');

      expect(canRollback.allowed).toBe(false);
      expect(canRollback.reason).toContain('dependent');
      expect(canRollback.dependentMigrations).toContain('migration-2');
    });

    it('should allow rollback of latest migration', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration1 = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      const migration2 = createMockMigration(
        'migration-2',
        createSchemaVersion(1, 1, 0),
        createSchemaVersion(1, 2, 0)
      );

      await history.record(migration1);
      await new Promise((r) => setTimeout(r, 10));
      await history.record(migration2);

      // Rolling back migration-2 should be fine
      const canRollback = await history.canRollback('migration-2');

      expect(canRollback.allowed).toBe(true);
    });

    it('should allow rollback with cascade option for dependent migrations', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration1 = createMockMigration(
        'migration-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      const migration2 = createMockMigration(
        'migration-2',
        createSchemaVersion(1, 1, 0),
        createSchemaVersion(1, 2, 0)
      );

      await history.record(migration1);
      await history.record(migration2);

      const canRollback = await history.canRollback('migration-1', { cascade: true });

      expect(canRollback.allowed).toBe(true);
      expect(canRollback.cascadeRollbacks).toContain('migration-2');
    });
  });

  describe('warn about data loss operations', () => {
    it('should flag rollbacks that may cause data loss', async () => {
      const generator = createMigrationGenerator('postgres');

      // A diff that adds a column
      const diff: SchemaDiff = {
        schemaName: 'users',
        fromVersion: createSchemaVersion(1, 0, 0),
        toVersion: createSchemaVersion(1, 1, 0),
        changes: [
          {
            type: 'add_field',
            field: 'email',
            definition: {
              type: 'string',
              isOptional: false,
              modifier: '!',
            },
          },
        ],
      };

      // Rolling back an add_field means dropping the column -> data loss
      const rollbackStatements = generator.generateRollback(diff);

      // The rollback should include a DROP COLUMN which causes data loss
      const hasDataLossRisk = rollbackStatements.some(
        (stmt) => stmt.includes('DROP COLUMN') || stmt.includes('DROP TABLE')
      );

      expect(hasDataLossRisk).toBe(true);
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Rollback Integration', () => {
  it('should complete full rollback workflow', async () => {
    const executor = createMockExecutor();
    const storage = new InMemoryHistoryStorage();
    const history = createMigrationHistory(storage);
    const runner = createMigrationRunner(executor);

    const migration = createMockMigration(
      'migration-1',
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    // 1. Apply migration
    const applyStatements = ['ALTER TABLE users ADD COLUMN email TEXT;'];
    await runner.run(migration, applyStatements);
    await history.record(migration);

    expect(await history.hasApplied('migration-1')).toBe(true);
    expect(await history.getCurrentVersion()).toEqual(createSchemaVersion(1, 1, 0));

    // 2. Validate rollback is allowed
    const canRollback = await history.canRollback('migration-1');
    expect(canRollback.allowed).toBe(true);

    // 3. Execute rollback
    const rollbackStatements = ['ALTER TABLE users DROP COLUMN email;'];
    const result = await runner.rollback(migration, rollbackStatements);

    expect(result.success).toBe(true);

    // 4. Record rollback in history
    await history.recordRollback('migration-1');

    expect(await history.hasApplied('migration-1')).toBe(false);
    expect(await history.wasRolledBack('migration-1')).toBe(true);
  });
});
