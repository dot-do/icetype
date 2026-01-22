/**
 * Tests for MigrationHistory tracking
 *
 * TDD RED Phase: These tests define the expected behavior before implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Migration, SchemaVersion } from '@icetype/core';
import { createSchemaVersion } from '@icetype/core';
import {
  type MigrationHistory,
  type MigrationRecord,
  type HistoryStorage,
  createMigrationHistory,
  InMemoryHistoryStorage,
} from '../src/history.js';

describe('MigrationHistory', () => {
  const createMockMigration = (
    id: string,
    fromVersion: SchemaVersion,
    toVersion: SchemaVersion
  ): Migration => ({
    id,
    fromVersion,
    toVersion,
    timestamp: new Date(),
    operations: [],
    isBreaking: false,
  });

  describe('interface contract', () => {
    it('should track applied migrations with record method', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration);

      const records = await history.getAll();
      expect(records.length).toBe(1);
      expect(records[0]!.migrationId).toBe('test-1');
    });

    it('should check if migration has been applied with hasApplied method', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      expect(await history.hasApplied('test-1')).toBe(false);

      await history.record(migration);

      expect(await history.hasApplied('test-1')).toBe(true);
      expect(await history.hasApplied('test-2')).toBe(false);
    });

    it('should get current version', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      // Initial version should be null or 0.0.0
      const initial = await history.getCurrentVersion();
      expect(initial).toBeNull();

      const migration1 = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration1);

      const v1 = await history.getCurrentVersion();
      expect(v1).not.toBeNull();
      expect(v1!.major).toBe(1);
      expect(v1!.minor).toBe(1);
      expect(v1!.patch).toBe(0);
    });

    it('should get pending migrations', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration1 = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      const migration2 = createMockMigration(
        'test-2',
        createSchemaVersion(1, 1, 0),
        createSchemaVersion(1, 2, 0)
      );
      const migration3 = createMockMigration(
        'test-3',
        createSchemaVersion(1, 2, 0),
        createSchemaVersion(1, 3, 0)
      );

      await history.record(migration1);

      const pending = await history.getPending([migration1, migration2, migration3]);

      expect(pending.length).toBe(2);
      expect(pending[0]!.id).toBe('test-2');
      expect(pending[1]!.id).toBe('test-3');
    });
  });

  describe('MigrationRecord', () => {
    it('should include timestamp of when migration was applied', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const before = new Date();

      const migration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration);

      const after = new Date();

      const records = await history.getAll();
      expect(records[0]!.appliedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(records[0]!.appliedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include checksum for integrity verification', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      migration.operations = [
        {
          op: 'addColumn',
          table: 'users',
          column: 'email',
          type: 'string',
          nullable: true,
        },
      ];

      await history.record(migration);

      const records = await history.getAll();
      expect(records[0]!.checksum).toBeDefined();
      expect(typeof records[0]!.checksum).toBe('string');
    });

    it('should detect checksum mismatch when migration content changes', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      migration.operations = [
        {
          op: 'addColumn',
          table: 'users',
          column: 'email',
          type: 'string',
          nullable: true,
        },
      ];

      await history.record(migration);

      // Modify migration
      const modifiedMigration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      modifiedMigration.operations = [
        {
          op: 'addColumn',
          table: 'users',
          column: 'name', // Changed column
          type: 'string',
          nullable: true,
        },
      ];

      const isValid = await history.verifyIntegrity(modifiedMigration);
      expect(isValid).toBe(false);
    });
  });

  describe('remove method', () => {
    it('should remove migration record for rollback', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      await history.record(migration);
      expect(await history.hasApplied('test-1')).toBe(true);

      await history.remove('test-1');
      expect(await history.hasApplied('test-1')).toBe(false);
    });
  });

  describe('getAll with ordering', () => {
    it('should return migrations in chronological order by default', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration1 = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      const migration2 = createMockMigration(
        'test-2',
        createSchemaVersion(1, 1, 0),
        createSchemaVersion(1, 2, 0)
      );

      await history.record(migration1);
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      await history.record(migration2);

      const records = await history.getAll();

      expect(records[0]!.migrationId).toBe('test-1');
      expect(records[1]!.migrationId).toBe('test-2');
    });

    it('should support reverse chronological order', async () => {
      const storage = new InMemoryHistoryStorage();
      const history = createMigrationHistory(storage);

      const migration1 = createMockMigration(
        'test-1',
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );
      const migration2 = createMockMigration(
        'test-2',
        createSchemaVersion(1, 1, 0),
        createSchemaVersion(1, 2, 0)
      );

      await history.record(migration1);
      await new Promise((r) => setTimeout(r, 10));
      await history.record(migration2);

      const records = await history.getAll({ order: 'desc' });

      expect(records[0]!.migrationId).toBe('test-2');
      expect(records[1]!.migrationId).toBe('test-1');
    });
  });
});

describe('InMemoryHistoryStorage', () => {
  it('should implement HistoryStorage interface', () => {
    const storage = new InMemoryHistoryStorage();

    expect(typeof storage.save).toBe('function');
    expect(typeof storage.load).toBe('function');
    expect(typeof storage.remove).toBe('function');
    expect(typeof storage.has).toBe('function');
  });

  it('should persist records', async () => {
    const storage = new InMemoryHistoryStorage();

    const record: MigrationRecord = {
      migrationId: 'test-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      appliedAt: new Date(),
      checksum: 'abc123',
    };

    await storage.save(record);

    const loaded = await storage.load('test-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.migrationId).toBe('test-1');
    expect(loaded!.checksum).toBe('abc123');
  });

  it('should return null for non-existent record', async () => {
    const storage = new InMemoryHistoryStorage();

    const loaded = await storage.load('non-existent');
    expect(loaded).toBeNull();
  });
});

describe('HistoryStorage interface', () => {
  it('should define required methods', () => {
    // This test verifies the interface shape at compile time
    const storage: HistoryStorage = {
      save: async () => {},
      load: async () => null,
      remove: async () => {},
      has: async () => false,
      getAll: async () => [],
    };

    expect(storage).toBeDefined();
  });
});
