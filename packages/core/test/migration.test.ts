/**
 * Migration Type and Operations Tests for @icetype/core
 *
 * Tests for Migration type structure, createMigrationFromDiff, and related operations.
 */

import { describe, it, expect } from 'vitest';
import { parseSchema } from '../src/parser.js';
import { diffSchemas } from '../src/migrations.js';
import {
  createMigrationFromDiff,
  isBreakingMigration,
  mergeMigrations,
  validateMigration,
  type Migration,
  type MigrationOperation,
  type ColumnChanges,
  type Constraint,
} from '../src/migration.js';
import { createSchemaVersion, type SchemaVersion } from '../src/version.js';

// =============================================================================
// Migration Type Structure Tests
// =============================================================================

describe('Migration type structure', () => {
  it('should have required id property', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(migration.id).toBeDefined();
    expect(typeof migration.id).toBe('string');
    expect(migration.id.length).toBeGreaterThan(0);
  });

  it('should have fromVersion and toVersion properties', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(migration.fromVersion).toEqual({ major: 1, minor: 0, patch: 0 });
    expect(migration.toVersion).toEqual({ major: 1, minor: 1, patch: 0 });
  });

  it('should have timestamp property as Date', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(migration.timestamp).toBeInstanceOf(Date);
  });

  it('should have optional description property', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0),
      { description: 'Add name field to User' }
    );

    expect(migration.description).toBe('Add name field to User');
  });

  it('should have operations array', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(Array.isArray(migration.operations)).toBe(true);
  });

  it('should have isBreaking boolean property', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(typeof migration.isBreaking).toBe('boolean');
  });
});

// =============================================================================
// createMigrationFromDiff Tests
// =============================================================================

describe('createMigrationFromDiff', () => {
  describe('addColumn operations', () => {
    it('should create addColumn operation for added fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
      const diff = diffSchemas(oldSchema, newSchema);

      const migration = createMigrationFromDiff(
        diff,
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      expect(migration.operations).toHaveLength(1);
      expect(migration.operations[0]).toEqual({
        op: 'addColumn',
        table: 'User',
        column: 'name',
        type: 'string',
        nullable: false,
      });
    });

    it('should create addColumn operation with nullable flag for optional fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const migration = createMigrationFromDiff(
        diff,
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      expect(migration.operations).toHaveLength(1);
      expect(migration.operations[0]).toMatchObject({
        op: 'addColumn',
        table: 'User',
        column: 'email',
        nullable: true,
      });
    });

    it('should include default value when specified', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', status: 'string = "active"' });
      const diff = diffSchemas(oldSchema, newSchema);

      const migration = createMigrationFromDiff(
        diff,
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      expect(migration.operations[0]).toMatchObject({
        op: 'addColumn',
        column: 'status',
        default: 'active',
      });
    });
  });

  describe('dropColumn operations', () => {
    it('should create dropColumn operation for removed fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const diff = diffSchemas(oldSchema, newSchema);

      const migration = createMigrationFromDiff(
        diff,
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(2, 0, 0)
      );

      expect(migration.operations).toHaveLength(1);
      expect(migration.operations[0]).toEqual({
        op: 'dropColumn',
        table: 'User',
        column: 'name',
      });
    });
  });

  describe('alterColumn operations', () => {
    it('should create alterColumn operation for type changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'long' });
      const diff = diffSchemas(oldSchema, newSchema);

      const migration = createMigrationFromDiff(
        diff,
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      expect(migration.operations).toHaveLength(1);
      expect(migration.operations[0]).toMatchObject({
        op: 'alterColumn',
        table: 'User',
        column: 'count',
        changes: {
          type: { from: 'int', to: 'long' },
        },
      });
    });

    it('should create alterColumn operation for nullable changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const migration = createMigrationFromDiff(
        diff,
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      expect(migration.operations).toHaveLength(1);
      expect(migration.operations[0]).toMatchObject({
        op: 'alterColumn',
        table: 'User',
        column: 'name',
        changes: {
          nullable: { from: false, to: true },
        },
      });
    });
  });

  describe('addIndex operations', () => {
    it('should create addIndex operation for indexed fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string#' });
      const diff = diffSchemas(oldSchema, newSchema);

      const migration = createMigrationFromDiff(
        diff,
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      const addIndexOp = migration.operations.find((op) => op.op === 'addIndex');
      expect(addIndexOp).toBeDefined();
      expect(addIndexOp).toMatchObject({
        op: 'addIndex',
        table: 'User',
        columns: ['email'],
        unique: true,
      });
    });
  });

  describe('dropIndex operations', () => {
    it('should create dropIndex operation when index is removed', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string#' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string' });
      const diff = diffSchemas(oldSchema, newSchema);

      const migration = createMigrationFromDiff(
        diff,
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(1, 1, 0)
      );

      const dropIndexOp = migration.operations.find((op) => op.op === 'dropIndex');
      expect(dropIndexOp).toBeDefined();
      expect(dropIndexOp).toMatchObject({
        op: 'dropIndex',
        table: 'User',
      });
    });
  });

  describe('multiple operations', () => {
    it('should create multiple operations for complex diffs', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        oldField: 'string',
      });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string?',
        newField: 'int!',
      });
      const diff = diffSchemas(oldSchema, newSchema);

      const migration = createMigrationFromDiff(
        diff,
        createSchemaVersion(1, 0, 0),
        createSchemaVersion(2, 0, 0)
      );

      expect(migration.operations.length).toBeGreaterThanOrEqual(3);

      const opTypes = migration.operations.map((op) => op.op);
      expect(opTypes).toContain('addColumn');
      expect(opTypes).toContain('dropColumn');
      expect(opTypes).toContain('alterColumn');
    });
  });
});

// =============================================================================
// MigrationOperation Types Tests
// =============================================================================

describe('MigrationOperation types', () => {
  it('should support addColumn operation', () => {
    const op: MigrationOperation = {
      op: 'addColumn',
      table: 'users',
      column: 'email',
      type: 'string',
      nullable: false,
    };
    expect(op.op).toBe('addColumn');
  });

  it('should support dropColumn operation', () => {
    const op: MigrationOperation = {
      op: 'dropColumn',
      table: 'users',
      column: 'email',
    };
    expect(op.op).toBe('dropColumn');
  });

  it('should support renameColumn operation', () => {
    const op: MigrationOperation = {
      op: 'renameColumn',
      table: 'users',
      oldName: 'email',
      newName: 'email_address',
    };
    expect(op.op).toBe('renameColumn');
  });

  it('should support alterColumn operation', () => {
    const op: MigrationOperation = {
      op: 'alterColumn',
      table: 'users',
      column: 'email',
      changes: {
        type: { from: 'string', to: 'text' },
      },
    };
    expect(op.op).toBe('alterColumn');
  });

  it('should support addIndex operation', () => {
    const op: MigrationOperation = {
      op: 'addIndex',
      table: 'users',
      columns: ['email'],
      unique: true,
    };
    expect(op.op).toBe('addIndex');
  });

  it('should support dropIndex operation', () => {
    const op: MigrationOperation = {
      op: 'dropIndex',
      table: 'users',
      indexName: 'idx_users_email',
    };
    expect(op.op).toBe('dropIndex');
  });

  it('should support addConstraint operation', () => {
    const op: MigrationOperation = {
      op: 'addConstraint',
      table: 'users',
      constraint: {
        name: 'fk_users_organization',
        type: 'foreignKey',
        columns: ['organization_id'],
        references: { table: 'organizations', columns: ['id'] },
      },
    };
    expect(op.op).toBe('addConstraint');
  });

  it('should support dropConstraint operation', () => {
    const op: MigrationOperation = {
      op: 'dropConstraint',
      table: 'users',
      constraintName: 'fk_users_organization',
    };
    expect(op.op).toBe('dropConstraint');
  });
});

// =============================================================================
// Migration Metadata Tests
// =============================================================================

describe('Migration metadata', () => {
  it('should generate unique IDs for different migrations', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration1 = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );
    const migration2 = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 1, 0),
      createSchemaVersion(1, 2, 0)
    );

    expect(migration1.id).not.toBe(migration2.id);
  });

  it('should set timestamp close to current time', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const before = new Date();
    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );
    const after = new Date();

    expect(migration.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(migration.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should use provided description', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0),
      { description: 'Add name field' }
    );

    expect(migration.description).toBe('Add name field');
  });

  it('should allow undefined description', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(migration.description).toBeUndefined();
  });
});

// =============================================================================
// Migration Validation Tests
// =============================================================================

describe('validateMigration', () => {
  it('should validate a valid migration', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    const result = validateMigration(migration);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject migration with invalid version (from > to)', () => {
    const migration: Migration = {
      id: 'test-migration',
      fromVersion: createSchemaVersion(2, 0, 0),
      toVersion: createSchemaVersion(1, 0, 0),
      timestamp: new Date(),
      operations: [],
      isBreaking: false,
    };

    const result = validateMigration(migration);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_VERSION_ORDER')).toBe(true);
  });

  it('should reject migration with empty table name in operation', () => {
    const migration: Migration = {
      id: 'test-migration',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date(),
      operations: [
        { op: 'addColumn', table: '', column: 'name', type: 'string', nullable: false },
      ],
      isBreaking: false,
    };

    const result = validateMigration(migration);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'EMPTY_TABLE_NAME')).toBe(true);
  });

  it('should reject migration with empty column name', () => {
    const migration: Migration = {
      id: 'test-migration',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date(),
      operations: [
        { op: 'addColumn', table: 'users', column: '', type: 'string', nullable: false },
      ],
      isBreaking: false,
    };

    const result = validateMigration(migration);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'EMPTY_COLUMN_NAME')).toBe(true);
  });

  it('should reject migration with invalid operation type', () => {
    const migration: Migration = {
      id: 'test-migration',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date(),
      operations: [
        { op: 'invalidOp' as any, table: 'users', column: 'name' },
      ],
      isBreaking: false,
    };

    const result = validateMigration(migration);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_OPERATION')).toBe(true);
  });

  it('should reject migration with missing required properties in addColumn', () => {
    const migration: Migration = {
      id: 'test-migration',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date(),
      operations: [
        { op: 'addColumn', table: 'users', column: 'name' } as any,
      ],
      isBreaking: false,
    };

    const result = validateMigration(migration);
    expect(result.valid).toBe(false);
  });
});

// =============================================================================
// isBreakingMigration Tests
// =============================================================================

describe('isBreakingMigration', () => {
  it('should return true for migrations with dropColumn operations', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(2, 0, 0)
    );

    expect(isBreakingMigration(migration)).toBe(true);
    expect(migration.isBreaking).toBe(true);
  });

  it('should return true for migrations with type changes that lose precision', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'long' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(2, 0, 0)
    );

    expect(isBreakingMigration(migration)).toBe(true);
  });

  it('should return true for migrations that make nullable fields required', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(isBreakingMigration(migration)).toBe(true);
  });

  it('should return false for migrations that only add columns', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(isBreakingMigration(migration)).toBe(false);
    expect(migration.isBreaking).toBe(false);
  });

  it('should return false for migrations that make required fields optional', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(isBreakingMigration(migration)).toBe(false);
  });

  it('should return false for migrations that widen types', () => {
    const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });
    const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'long' });
    const diff = diffSchemas(oldSchema, newSchema);

    const migration = createMigrationFromDiff(
      diff,
      createSchemaVersion(1, 0, 0),
      createSchemaVersion(1, 1, 0)
    );

    expect(isBreakingMigration(migration)).toBe(false);
  });

  it('should return true for migrations with dropConstraint operations', () => {
    const migration: Migration = {
      id: 'test-migration',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(2, 0, 0),
      timestamp: new Date(),
      operations: [
        { op: 'dropConstraint', table: 'users', constraintName: 'fk_users_org' },
      ],
      isBreaking: true,
    };

    expect(isBreakingMigration(migration)).toBe(true);
  });
});

// =============================================================================
// mergeMigrations Tests
// =============================================================================

describe('mergeMigrations', () => {
  it('should merge two sequential migrations', () => {
    const migration1: Migration = {
      id: 'migration-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-01-01'),
      operations: [
        { op: 'addColumn', table: 'users', column: 'name', type: 'string', nullable: true },
      ],
      isBreaking: false,
    };

    const migration2: Migration = {
      id: 'migration-2',
      fromVersion: createSchemaVersion(1, 1, 0),
      toVersion: createSchemaVersion(1, 2, 0),
      timestamp: new Date('2024-01-02'),
      operations: [
        { op: 'addColumn', table: 'users', column: 'email', type: 'string', nullable: true },
      ],
      isBreaking: false,
    };

    const merged = mergeMigrations([migration1, migration2]);

    expect(merged.fromVersion).toEqual(createSchemaVersion(1, 0, 0));
    expect(merged.toVersion).toEqual(createSchemaVersion(1, 2, 0));
    expect(merged.operations).toHaveLength(2);
  });

  it('should combine isBreaking flags (true if any are breaking)', () => {
    const migration1: Migration = {
      id: 'migration-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-01-01'),
      operations: [
        { op: 'addColumn', table: 'users', column: 'name', type: 'string', nullable: true },
      ],
      isBreaking: false,
    };

    const migration2: Migration = {
      id: 'migration-2',
      fromVersion: createSchemaVersion(1, 1, 0),
      toVersion: createSchemaVersion(2, 0, 0),
      timestamp: new Date('2024-01-02'),
      operations: [
        { op: 'dropColumn', table: 'users', column: 'oldField' },
      ],
      isBreaking: true,
    };

    const merged = mergeMigrations([migration1, migration2]);

    expect(merged.isBreaking).toBe(true);
  });

  it('should throw error for non-sequential migrations', () => {
    const migration1: Migration = {
      id: 'migration-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-01-01'),
      operations: [],
      isBreaking: false,
    };

    const migration2: Migration = {
      id: 'migration-2',
      fromVersion: createSchemaVersion(1, 2, 0), // Gap: should be 1.1.0
      toVersion: createSchemaVersion(1, 3, 0),
      timestamp: new Date('2024-01-02'),
      operations: [],
      isBreaking: false,
    };

    expect(() => mergeMigrations([migration1, migration2])).toThrow();
  });

  it('should optimize redundant operations (add then drop same column)', () => {
    const migration1: Migration = {
      id: 'migration-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-01-01'),
      operations: [
        { op: 'addColumn', table: 'users', column: 'temp', type: 'string', nullable: true },
      ],
      isBreaking: false,
    };

    const migration2: Migration = {
      id: 'migration-2',
      fromVersion: createSchemaVersion(1, 1, 0),
      toVersion: createSchemaVersion(1, 2, 0),
      timestamp: new Date('2024-01-02'),
      operations: [
        { op: 'dropColumn', table: 'users', column: 'temp' },
      ],
      isBreaking: true,
    };

    const merged = mergeMigrations([migration1, migration2]);

    // The add and drop should cancel out
    const tempColumnOps = merged.operations.filter(
      (op) =>
        (op.op === 'addColumn' || op.op === 'dropColumn') &&
        'column' in op &&
        op.column === 'temp'
    );
    expect(tempColumnOps).toHaveLength(0);
  });

  it('should generate new ID for merged migration', () => {
    const migration1: Migration = {
      id: 'migration-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-01-01'),
      operations: [],
      isBreaking: false,
    };

    const migration2: Migration = {
      id: 'migration-2',
      fromVersion: createSchemaVersion(1, 1, 0),
      toVersion: createSchemaVersion(1, 2, 0),
      timestamp: new Date('2024-01-02'),
      operations: [],
      isBreaking: false,
    };

    const merged = mergeMigrations([migration1, migration2]);

    expect(merged.id).not.toBe('migration-1');
    expect(merged.id).not.toBe('migration-2');
    expect(merged.id.length).toBeGreaterThan(0);
  });

  it('should use latest timestamp from merged migrations', () => {
    const migration1: Migration = {
      id: 'migration-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-01-01'),
      operations: [],
      isBreaking: false,
    };

    const migration2: Migration = {
      id: 'migration-2',
      fromVersion: createSchemaVersion(1, 1, 0),
      toVersion: createSchemaVersion(1, 2, 0),
      timestamp: new Date('2024-01-15'),
      operations: [],
      isBreaking: false,
    };

    const merged = mergeMigrations([migration1, migration2]);

    expect(merged.timestamp).toEqual(new Date('2024-01-15'));
  });

  it('should throw error for empty array', () => {
    expect(() => mergeMigrations([])).toThrow();
  });

  it('should return clone for single migration', () => {
    const migration: Migration = {
      id: 'migration-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-01-01'),
      operations: [
        { op: 'addColumn', table: 'users', column: 'name', type: 'string', nullable: true },
      ],
      isBreaking: false,
    };

    const result = mergeMigrations([migration]);

    expect(result.fromVersion).toEqual(migration.fromVersion);
    expect(result.toVersion).toEqual(migration.toVersion);
    expect(result.operations).toEqual(migration.operations);
  });

  it('should merge three or more migrations', () => {
    const migration1: Migration = {
      id: 'migration-1',
      fromVersion: createSchemaVersion(1, 0, 0),
      toVersion: createSchemaVersion(1, 1, 0),
      timestamp: new Date('2024-01-01'),
      operations: [
        { op: 'addColumn', table: 'users', column: 'name', type: 'string', nullable: true },
      ],
      isBreaking: false,
    };

    const migration2: Migration = {
      id: 'migration-2',
      fromVersion: createSchemaVersion(1, 1, 0),
      toVersion: createSchemaVersion(1, 2, 0),
      timestamp: new Date('2024-01-02'),
      operations: [
        { op: 'addColumn', table: 'users', column: 'email', type: 'string', nullable: true },
      ],
      isBreaking: false,
    };

    const migration3: Migration = {
      id: 'migration-3',
      fromVersion: createSchemaVersion(1, 2, 0),
      toVersion: createSchemaVersion(1, 3, 0),
      timestamp: new Date('2024-01-03'),
      operations: [
        { op: 'addColumn', table: 'users', column: 'age', type: 'int', nullable: true },
      ],
      isBreaking: false,
    };

    const merged = mergeMigrations([migration1, migration2, migration3]);

    expect(merged.fromVersion).toEqual(createSchemaVersion(1, 0, 0));
    expect(merged.toVersion).toEqual(createSchemaVersion(1, 3, 0));
    expect(merged.operations).toHaveLength(3);
  });
});

// =============================================================================
// SchemaVersion Tests
// =============================================================================

describe('SchemaVersion', () => {
  it('should have major, minor, and patch properties', () => {
    const version: SchemaVersion = createSchemaVersion(1, 2, 3);

    expect(version.major).toBe(1);
    expect(version.minor).toBe(2);
    expect(version.patch).toBe(3);
  });
});

// =============================================================================
// ColumnChanges Tests
// =============================================================================

describe('ColumnChanges', () => {
  it('should support type changes', () => {
    const changes: ColumnChanges = {
      type: { from: 'int', to: 'long' },
    };
    expect(changes.type).toBeDefined();
  });

  it('should support nullable changes', () => {
    const changes: ColumnChanges = {
      nullable: { from: false, to: true },
    };
    expect(changes.nullable).toBeDefined();
  });

  it('should support default value changes', () => {
    const changes: ColumnChanges = {
      default: { from: undefined, to: 'active' },
    };
    expect(changes.default).toBeDefined();
  });

  it('should support multiple changes', () => {
    const changes: ColumnChanges = {
      type: { from: 'string', to: 'text' },
      nullable: { from: false, to: true },
      default: { from: undefined, to: '' },
    };
    expect(Object.keys(changes)).toHaveLength(3);
  });
});

// =============================================================================
// Constraint Tests
// =============================================================================

describe('Constraint', () => {
  it('should support foreignKey constraint', () => {
    const constraint: Constraint = {
      name: 'fk_users_org',
      type: 'foreignKey',
      columns: ['organization_id'],
      references: { table: 'organizations', columns: ['id'] },
    };
    expect(constraint.type).toBe('foreignKey');
  });

  it('should support unique constraint', () => {
    const constraint: Constraint = {
      name: 'uq_users_email',
      type: 'unique',
      columns: ['email'],
    };
    expect(constraint.type).toBe('unique');
  });

  it('should support check constraint', () => {
    const constraint: Constraint = {
      name: 'ck_users_age',
      type: 'check',
      expression: 'age >= 0',
    };
    expect(constraint.type).toBe('check');
  });

  it('should support primaryKey constraint', () => {
    const constraint: Constraint = {
      name: 'pk_users',
      type: 'primaryKey',
      columns: ['id'],
    };
    expect(constraint.type).toBe('primaryKey');
  });
});
