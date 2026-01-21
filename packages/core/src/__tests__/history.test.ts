/**
 * Schema History Tests for @icetype/core
 *
 * Tests for schema history tracking system that maintains
 * a record of all schema versions and their migrations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSchemaHistory,
  addHistoryEntry,
  getHistoryEntry,
  getLatestEntry,
  serializeHistory,
  parseHistory,
  computeSchemaChecksum,
  type SchemaHistory,
  type SchemaHistoryEntry,
} from '../history.js';
import { createSchemaVersion, serializeSchemaVersion, type SchemaVersion } from '../version.js';
import type { IceTypeSchema, FieldDefinition, SchemaDirectives } from '../types.js';
import type { Migration } from '../migration.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Helper to create a minimal IceTypeSchema for testing.
 */
function createTestSchema(
  name: string,
  fields: Record<string, Partial<FieldDefinition>> = {}
): IceTypeSchema {
  const fieldsMap = new Map<string, FieldDefinition>();
  for (const [fieldName, partial] of Object.entries(fields)) {
    fieldsMap.set(fieldName, {
      name: fieldName,
      type: partial.type ?? 'string',
      modifier: partial.modifier ?? '',
      isArray: partial.isArray ?? false,
      isOptional: partial.isOptional ?? false,
      isUnique: partial.isUnique ?? false,
      isIndexed: partial.isIndexed ?? false,
      ...partial,
    } as FieldDefinition);
  }

  return {
    name,
    fields: fieldsMap,
    directives: {} as SchemaDirectives,
    relations: new Map(),
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Helper to create a minimal migration for testing.
 */
function createTestMigration(
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion
): Migration {
  return {
    id: `migration_${Date.now()}`,
    fromVersion,
    toVersion,
    timestamp: new Date(),
    operations: [],
    isBreaking: false,
  };
}

/**
 * Helper to create a test history entry.
 */
function createTestEntry(
  version: string,
  checksum: string,
  timestamp?: Date
): SchemaHistoryEntry {
  return {
    version: parseVersionString(version),
    timestamp: timestamp ?? new Date(),
    checksum,
    migration: null,
  };
}

/**
 * Parse version string helper (bypasses SchemaVersion for simplicity).
 */
function parseVersionString(v: string): SchemaVersion {
  const [major, minor, patch] = v.split('.').map(Number);
  return createSchemaVersion(major!, minor!, patch!);
}

// =============================================================================
// createSchemaHistory Tests
// =============================================================================

describe('createSchemaHistory', () => {
  it('should create an empty history with schema name', () => {
    const history = createSchemaHistory('MySchema');
    expect(history.schemaName).toBe('MySchema');
    expect(history.entries).toEqual([]);
  });

  it('should create independent history instances', () => {
    const history1 = createSchemaHistory('Schema1');
    const history2 = createSchemaHistory('Schema2');

    expect(history1.schemaName).toBe('Schema1');
    expect(history2.schemaName).toBe('Schema2');
    expect(history1).not.toBe(history2);
  });

  it('should handle empty schema name', () => {
    const history = createSchemaHistory('');
    expect(history.schemaName).toBe('');
    expect(history.entries).toEqual([]);
  });

  it('should handle schema name with special characters', () => {
    const history = createSchemaHistory('My_Schema-v2.0');
    expect(history.schemaName).toBe('My_Schema-v2.0');
  });
});

// =============================================================================
// addHistoryEntry Tests
// =============================================================================

describe('addHistoryEntry', () => {
  let history: SchemaHistory;

  beforeEach(() => {
    history = createSchemaHistory('TestSchema');
  });

  it('should add a new entry to empty history', () => {
    const entry = createTestEntry('1.0.0', 'sha256:abc123');
    const updated = addHistoryEntry(history, entry);

    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0]!.checksum).toBe('sha256:abc123');
    expect(serializeSchemaVersion(updated.entries[0]!.version)).toBe('1.0.0');
  });

  it('should add multiple entries', () => {
    const entry1 = createTestEntry('1.0.0', 'sha256:abc123');
    const entry2 = createTestEntry('1.1.0', 'sha256:def456');

    let updated = addHistoryEntry(history, entry1);
    updated = addHistoryEntry(updated, entry2);

    expect(updated.entries).toHaveLength(2);
    expect(serializeSchemaVersion(updated.entries[0]!.version)).toBe('1.0.0');
    expect(serializeSchemaVersion(updated.entries[1]!.version)).toBe('1.1.0');
  });

  it('should not mutate original history', () => {
    const entry = createTestEntry('1.0.0', 'sha256:abc123');
    const updated = addHistoryEntry(history, entry);

    expect(history.entries).toHaveLength(0);
    expect(updated.entries).toHaveLength(1);
  });

  it('should add entry with migration', () => {
    const fromVersion = createSchemaVersion(1, 0, 0);
    const toVersion = createSchemaVersion(1, 1, 0);
    const migration = createTestMigration(fromVersion, toVersion);

    const entry: SchemaHistoryEntry = {
      version: toVersion,
      timestamp: new Date(),
      checksum: 'sha256:abc123',
      migration,
    };

    const updated = addHistoryEntry(history, entry);
    expect(updated.entries[0]!.migration).toBe(migration);
  });

  it('should add entry with null migration', () => {
    const entry = createTestEntry('1.0.0', 'sha256:abc123');
    const updated = addHistoryEntry(history, entry);
    expect(updated.entries[0]!.migration).toBeNull();
  });

  it('should preserve schema name when adding entries', () => {
    const entry = createTestEntry('1.0.0', 'sha256:abc123');
    const updated = addHistoryEntry(history, entry);
    expect(updated.schemaName).toBe('TestSchema');
  });
});

// =============================================================================
// getHistoryEntry Tests
// =============================================================================

describe('getHistoryEntry', () => {
  let history: SchemaHistory;

  beforeEach(() => {
    history = createSchemaHistory('TestSchema');
    history = addHistoryEntry(history, createTestEntry('1.0.0', 'sha256:v1'));
    history = addHistoryEntry(history, createTestEntry('1.1.0', 'sha256:v1.1'));
    history = addHistoryEntry(history, createTestEntry('2.0.0', 'sha256:v2'));
  });

  it('should retrieve entry by exact version', () => {
    const version = createSchemaVersion(1, 1, 0);
    const entry = getHistoryEntry(history, version);

    expect(entry).not.toBeUndefined();
    expect(entry!.checksum).toBe('sha256:v1.1');
  });

  it('should return undefined for non-existent version', () => {
    const version = createSchemaVersion(3, 0, 0);
    const entry = getHistoryEntry(history, version);

    expect(entry).toBeUndefined();
  });

  it('should find first entry', () => {
    const version = createSchemaVersion(1, 0, 0);
    const entry = getHistoryEntry(history, version);

    expect(entry).not.toBeUndefined();
    expect(entry!.checksum).toBe('sha256:v1');
  });

  it('should find last entry', () => {
    const version = createSchemaVersion(2, 0, 0);
    const entry = getHistoryEntry(history, version);

    expect(entry).not.toBeUndefined();
    expect(entry!.checksum).toBe('sha256:v2');
  });

  it('should return undefined for empty history', () => {
    const emptyHistory = createSchemaHistory('Empty');
    const version = createSchemaVersion(1, 0, 0);
    const entry = getHistoryEntry(emptyHistory, version);

    expect(entry).toBeUndefined();
  });
});

// =============================================================================
// getLatestEntry Tests
// =============================================================================

describe('getLatestEntry', () => {
  it('should return undefined for empty history', () => {
    const history = createSchemaHistory('TestSchema');
    const latest = getLatestEntry(history);

    expect(latest).toBeUndefined();
  });

  it('should return the only entry for single-entry history', () => {
    let history = createSchemaHistory('TestSchema');
    history = addHistoryEntry(history, createTestEntry('1.0.0', 'sha256:only'));

    const latest = getLatestEntry(history);
    expect(latest).not.toBeUndefined();
    expect(latest!.checksum).toBe('sha256:only');
  });

  it('should return the last added entry', () => {
    let history = createSchemaHistory('TestSchema');
    history = addHistoryEntry(history, createTestEntry('1.0.0', 'sha256:first'));
    history = addHistoryEntry(history, createTestEntry('1.1.0', 'sha256:second'));
    history = addHistoryEntry(history, createTestEntry('2.0.0', 'sha256:third'));

    const latest = getLatestEntry(history);
    expect(latest).not.toBeUndefined();
    expect(latest!.checksum).toBe('sha256:third');
    expect(serializeSchemaVersion(latest!.version)).toBe('2.0.0');
  });
});

// =============================================================================
// serializeHistory Tests
// =============================================================================

describe('serializeHistory', () => {
  it('should serialize empty history', () => {
    const history = createSchemaHistory('TestSchema');
    const json = serializeHistory(history);
    const parsed = JSON.parse(json);

    expect(parsed.schemaName).toBe('TestSchema');
    expect(parsed.entries).toEqual([]);
  });

  it('should serialize history with entries', () => {
    let history = createSchemaHistory('TestSchema');
    const timestamp = new Date('2024-01-15T10:30:00Z');
    history = addHistoryEntry(history, {
      version: createSchemaVersion(1, 0, 0),
      timestamp,
      checksum: 'sha256:abc123',
      migration: null,
    });

    const json = serializeHistory(history);
    const parsed = JSON.parse(json);

    expect(parsed.schemaName).toBe('TestSchema');
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].version).toBe('1.0.0');
    expect(parsed.entries[0].timestamp).toBe('2024-01-15T10:30:00.000Z');
    expect(parsed.entries[0].checksum).toBe('sha256:abc123');
  });

  it('should serialize history with migration', () => {
    let history = createSchemaHistory('TestSchema');
    const fromVersion = createSchemaVersion(1, 0, 0);
    const toVersion = createSchemaVersion(1, 1, 0);
    const migration = createTestMigration(fromVersion, toVersion);

    history = addHistoryEntry(history, {
      version: toVersion,
      timestamp: new Date('2024-01-15T10:30:00Z'),
      checksum: 'sha256:def456',
      migration,
    });

    const json = serializeHistory(history);
    const parsed = JSON.parse(json);

    expect(parsed.entries[0].migration).not.toBeNull();
    expect(parsed.entries[0].migration.id).toBe(migration.id);
  });

  it('should produce valid JSON', () => {
    let history = createSchemaHistory('TestSchema');
    history = addHistoryEntry(history, createTestEntry('1.0.0', 'sha256:abc'));

    const json = serializeHistory(history);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

// =============================================================================
// parseHistory Tests
// =============================================================================

describe('parseHistory', () => {
  it('should parse empty history JSON', () => {
    const json = JSON.stringify({
      schemaName: 'TestSchema',
      entries: [],
    });

    const history = parseHistory(json);
    expect(history.schemaName).toBe('TestSchema');
    expect(history.entries).toEqual([]);
  });

  it('should parse history with entries', () => {
    const json = JSON.stringify({
      schemaName: 'TestSchema',
      entries: [
        {
          version: '1.0.0',
          timestamp: '2024-01-15T10:30:00.000Z',
          checksum: 'sha256:abc123',
          migration: null,
        },
      ],
    });

    const history = parseHistory(json);
    expect(history.schemaName).toBe('TestSchema');
    expect(history.entries).toHaveLength(1);
    expect(serializeSchemaVersion(history.entries[0]!.version)).toBe('1.0.0');
    expect(history.entries[0]!.checksum).toBe('sha256:abc123');
    expect(history.entries[0]!.timestamp).toBeInstanceOf(Date);
  });

  it('should roundtrip: serialize then parse returns equivalent history', () => {
    let original = createSchemaHistory('TestSchema');
    original = addHistoryEntry(original, {
      version: createSchemaVersion(1, 0, 0),
      timestamp: new Date('2024-01-15T10:30:00Z'),
      checksum: 'sha256:abc123',
      migration: null,
    });
    original = addHistoryEntry(original, {
      version: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-01-16T10:30:00Z'),
      checksum: 'sha256:def456',
      migration: null,
    });

    const json = serializeHistory(original);
    const parsed = parseHistory(json);

    expect(parsed.schemaName).toBe(original.schemaName);
    expect(parsed.entries).toHaveLength(original.entries.length);
    expect(serializeSchemaVersion(parsed.entries[0]!.version)).toBe('1.0.0');
    expect(serializeSchemaVersion(parsed.entries[1]!.version)).toBe('1.1.0');
    expect(parsed.entries[0]!.checksum).toBe(original.entries[0]!.checksum);
    expect(parsed.entries[1]!.checksum).toBe(original.entries[1]!.checksum);
  });

  it('should throw for invalid JSON', () => {
    expect(() => parseHistory('not valid json')).toThrow();
  });

  it('should throw for missing schemaName', () => {
    const json = JSON.stringify({ entries: [] });
    expect(() => parseHistory(json)).toThrow();
  });

  it('should throw for missing entries', () => {
    const json = JSON.stringify({ schemaName: 'Test' });
    expect(() => parseHistory(json)).toThrow();
  });

  it('should parse history with migration', () => {
    const json = JSON.stringify({
      schemaName: 'TestSchema',
      entries: [
        {
          version: '1.1.0',
          timestamp: '2024-01-15T10:30:00.000Z',
          checksum: 'sha256:abc123',
          migration: {
            id: 'migration_123',
            fromVersion: '1.0.0',
            toVersion: '1.1.0',
            timestamp: '2024-01-15T10:30:00.000Z',
            operations: [],
            isBreaking: false,
          },
        },
      ],
    });

    const history = parseHistory(json);
    expect(history.entries[0]!.migration).not.toBeNull();
    expect(history.entries[0]!.migration!.id).toBe('migration_123');
  });
});

// =============================================================================
// computeSchemaChecksum Tests
// =============================================================================

describe('computeSchemaChecksum', () => {
  it('should compute checksum for a schema', () => {
    const schema = createTestSchema('User', {
      id: { type: 'uuid', modifier: '!' },
      name: { type: 'string' },
    });

    const checksum = computeSchemaChecksum(schema);
    expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should return same checksum for identical schemas', () => {
    const schema1 = createTestSchema('User', {
      id: { type: 'uuid', modifier: '!' },
      name: { type: 'string' },
    });

    const schema2 = createTestSchema('User', {
      id: { type: 'uuid', modifier: '!' },
      name: { type: 'string' },
    });

    // Update timestamps to match for consistency
    schema2.createdAt = schema1.createdAt;
    schema2.updatedAt = schema1.updatedAt;

    const checksum1 = computeSchemaChecksum(schema1);
    const checksum2 = computeSchemaChecksum(schema2);

    expect(checksum1).toBe(checksum2);
  });

  it('should return different checksum when field added', () => {
    const schema1 = createTestSchema('User', {
      id: { type: 'uuid', modifier: '!' },
    });

    const schema2 = createTestSchema('User', {
      id: { type: 'uuid', modifier: '!' },
      name: { type: 'string' },
    });

    const checksum1 = computeSchemaChecksum(schema1);
    const checksum2 = computeSchemaChecksum(schema2);

    expect(checksum1).not.toBe(checksum2);
  });

  it('should return different checksum when field type changed', () => {
    const schema1 = createTestSchema('User', {
      age: { type: 'int' },
    });

    const schema2 = createTestSchema('User', {
      age: { type: 'string' },
    });

    const checksum1 = computeSchemaChecksum(schema1);
    const checksum2 = computeSchemaChecksum(schema2);

    expect(checksum1).not.toBe(checksum2);
  });

  it('should return different checksum when field modifier changed', () => {
    const schema1 = createTestSchema('User', {
      name: { type: 'string', modifier: '' },
    });

    const schema2 = createTestSchema('User', {
      name: { type: 'string', modifier: '!' },
    });

    const checksum1 = computeSchemaChecksum(schema1);
    const checksum2 = computeSchemaChecksum(schema2);

    expect(checksum1).not.toBe(checksum2);
  });

  it('should return different checksum when schema name changed', () => {
    const schema1 = createTestSchema('User', {
      id: { type: 'uuid' },
    });

    const schema2 = createTestSchema('Account', {
      id: { type: 'uuid' },
    });

    const checksum1 = computeSchemaChecksum(schema1);
    const checksum2 = computeSchemaChecksum(schema2);

    expect(checksum1).not.toBe(checksum2);
  });

  it('should be deterministic (multiple calls return same value)', () => {
    const schema = createTestSchema('User', {
      id: { type: 'uuid' },
      name: { type: 'string' },
    });

    const checksum1 = computeSchemaChecksum(schema);
    const checksum2 = computeSchemaChecksum(schema);
    const checksum3 = computeSchemaChecksum(schema);

    expect(checksum1).toBe(checksum2);
    expect(checksum2).toBe(checksum3);
  });

  it('should ignore non-schema properties (timestamps)', () => {
    const schema1 = createTestSchema('User', {
      id: { type: 'uuid' },
    });
    schema1.createdAt = 1000;
    schema1.updatedAt = 2000;

    const schema2 = createTestSchema('User', {
      id: { type: 'uuid' },
    });
    schema2.createdAt = 3000;
    schema2.updatedAt = 4000;

    const checksum1 = computeSchemaChecksum(schema1);
    const checksum2 = computeSchemaChecksum(schema2);

    // Checksums should be equal despite different timestamps
    expect(checksum1).toBe(checksum2);
  });

  it('should handle schema with directives', () => {
    const schema = createTestSchema('User', {
      id: { type: 'uuid' },
    });
    schema.directives = {
      partitionBy: ['id'],
      fts: ['name'],
    };

    const checksum = computeSchemaChecksum(schema);
    expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should return different checksum when directives change', () => {
    const schema1 = createTestSchema('User', {
      id: { type: 'uuid' },
    });
    schema1.directives = { partitionBy: ['id'] };

    const schema2 = createTestSchema('User', {
      id: { type: 'uuid' },
    });
    schema2.directives = { partitionBy: ['name'] };

    const checksum1 = computeSchemaChecksum(schema1);
    const checksum2 = computeSchemaChecksum(schema2);

    expect(checksum1).not.toBe(checksum2);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Schema History Integration', () => {
  it('should track schema evolution through multiple versions', () => {
    let history = createSchemaHistory('User');

    // Version 1.0.0 - Initial schema
    const schema1 = createTestSchema('User', {
      id: { type: 'uuid', modifier: '!' },
      email: { type: 'string' },
    });
    history = addHistoryEntry(history, {
      version: createSchemaVersion(1, 0, 0),
      timestamp: new Date('2024-01-01T00:00:00Z'),
      checksum: computeSchemaChecksum(schema1),
      migration: null,
    });

    // Version 1.1.0 - Add name field
    const schema2 = createTestSchema('User', {
      id: { type: 'uuid', modifier: '!' },
      email: { type: 'string' },
      name: { type: 'string' },
    });
    const migration1 = createTestMigration(
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );
    history = addHistoryEntry(history, {
      version: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-02-01T00:00:00Z'),
      checksum: computeSchemaChecksum(schema2),
      migration: migration1,
    });

    // Verify history
    expect(history.entries).toHaveLength(2);
    expect(history.entries[0]!.checksum).not.toBe(history.entries[1]!.checksum);
    expect(history.entries[1]!.migration).toBe(migration1);

    // Serialize and parse
    const json = serializeHistory(history);
    const restored = parseHistory(json);

    expect(restored.schemaName).toBe('User');
    expect(restored.entries).toHaveLength(2);
  });

  it('should produce stable JSON format for file storage', () => {
    let history = createSchemaHistory('MySchema');
    history = addHistoryEntry(history, {
      version: createSchemaVersion(1, 0, 0),
      timestamp: new Date('2024-01-15T10:30:00Z'),
      checksum: 'sha256:abc123def456',
      migration: null,
    });

    const json = serializeHistory(history);
    const parsed = JSON.parse(json);

    // Verify format matches specification
    expect(parsed).toEqual({
      schemaName: 'MySchema',
      entries: [
        {
          version: '1.0.0',
          timestamp: '2024-01-15T10:30:00.000Z',
          checksum: 'sha256:abc123def456',
          migration: null,
        },
      ],
    });
  });
});
