/**
 * Schema Migrations Tests for @icetype/core
 *
 * Tests for schema diffing and migration plan generation.
 */

import { describe, it, expect } from 'vitest';
import { parseSchema } from '../src/parser.js';
import { diffSchemas, generateMigrationPlan } from '../src/migrations.js';

// =============================================================================
// diffSchemas Tests
// =============================================================================

describe('diffSchemas', () => {
  describe('added fields', () => {
    it('should detect added fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.addedFields).toHaveLength(1);
      expect(diff.addedFields[0]!.name).toBe('name');
    });

    it('should detect multiple added fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        email: 'string!',
        age: 'int?',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.addedFields).toHaveLength(3);
      const addedNames = diff.addedFields.map((f) => f.name);
      expect(addedNames).toContain('name');
      expect(addedNames).toContain('email');
      expect(addedNames).toContain('age');
    });

    it('should correctly identify added field types', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', createdAt: 'timestamp' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.addedFields).toHaveLength(1);
      expect(diff.addedFields[0]!.name).toBe('createdAt');
      expect(diff.addedFields[0]!.type).toBe('timestamp');
    });
  });

  describe('removed fields', () => {
    it('should detect removed fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.removedFields).toHaveLength(1);
      expect(diff.removedFields[0]!.name).toBe('name');
    });

    it('should detect multiple removed fields', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        email: 'string!',
        phone: 'string?',
      });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.removedFields).toHaveLength(3);
      const removedNames = diff.removedFields.map((f) => f.name);
      expect(removedNames).toContain('name');
      expect(removedNames).toContain('email');
      expect(removedNames).toContain('phone');
    });
  });

  describe('type changes', () => {
    it('should detect type changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'long' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.modifiedFields).toHaveLength(1);
      expect(diff.modifiedFields[0]!.name).toBe('count');
      expect(diff.modifiedFields[0]!.changes).toContain('type');
      expect(diff.modifiedFields[0]!.oldField.type).toBe('int');
      expect(diff.modifiedFields[0]!.newField.type).toBe('long');
    });

    it('should detect string to text type change', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', bio: 'string' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', bio: 'text' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.modifiedFields).toHaveLength(1);
      expect(diff.modifiedFields[0]!.changes).toContain('type');
    });
  });

  describe('modifier changes', () => {
    it('should detect modifier changes (nullable to required)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.modifiedFields).toHaveLength(1);
      expect(diff.modifiedFields[0]!.changes).toContain('modifier');
    });

    it('should detect modifier changes (required to nullable)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.modifiedFields).toHaveLength(1);
      expect(diff.modifiedFields[0]!.changes).toContain('modifier');
    });

    it('should detect indexed modifier changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string#' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.modifiedFields).toHaveLength(1);
      expect(diff.modifiedFields[0]!.changes).toContain('indexed');
    });
  });

  describe('array changes', () => {
    it('should detect array changes (scalar to array)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', tags: 'string' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', tags: 'string[]' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.modifiedFields).toHaveLength(1);
      expect(diff.modifiedFields[0]!.changes).toContain('array');
    });

    it('should detect array changes (array to scalar)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', tags: 'string[]' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', tags: 'string' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.modifiedFields).toHaveLength(1);
      expect(diff.modifiedFields[0]!.changes).toContain('array');
    });
  });

  describe('identical schemas', () => {
    it('should return empty diff for identical schemas', () => {
      const schema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(schema, schema);

      expect(diff.addedFields).toHaveLength(0);
      expect(diff.removedFields).toHaveLength(0);
      expect(diff.modifiedFields).toHaveLength(0);
      expect(diff.hasChanges).toBe(false);
    });

    it('should return empty diff for schemas with same fields', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        email: 'string?',
      });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        email: 'string?',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.hasChanges).toBe(false);
    });
  });

  describe('combined changes', () => {
    it('should detect added, removed, and modified fields together', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        age: 'int',
        oldField: 'string',
      });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string?', // modified: required -> optional
        age: 'long', // modified: type change
        newField: 'timestamp', // added
        // oldField: removed
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.addedFields).toHaveLength(1);
      expect(diff.addedFields[0]!.name).toBe('newField');

      expect(diff.removedFields).toHaveLength(1);
      expect(diff.removedFields[0]!.name).toBe('oldField');

      expect(diff.modifiedFields).toHaveLength(2);
      const modifiedNames = diff.modifiedFields.map((f) => f.name);
      expect(modifiedNames).toContain('name');
      expect(modifiedNames).toContain('age');

      expect(diff.hasChanges).toBe(true);
    });
  });

  describe('schema name', () => {
    it('should include schema name in diff', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.schemaName).toBe('User');
    });
  });
});

// =============================================================================
// generateMigrationPlan Tests
// =============================================================================

describe('generateMigrationPlan', () => {
  describe('added fields', () => {
    it('should generate SQL for added fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string' });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      expect(plan.up).toContain('ALTER TABLE');
      expect(plan.up).toContain('ADD COLUMN');
      expect(plan.up).toContain('name');
    });

    it('should generate SQL for multiple added fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string',
        email: 'string',
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      expect(plan.up).toContain('name');
      expect(plan.up).toContain('email');
    });

    it('should generate correct PostgreSQL types for added fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        count: 'int',
        active: 'boolean',
        score: 'float',
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      expect(plan.up).toContain('INTEGER');
      expect(plan.up).toContain('BOOLEAN');
      expect(plan.up).toContain('REAL');
    });
  });

  describe('removed fields', () => {
    it('should generate SQL for removed fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      expect(plan.down).toContain('ADD COLUMN');
      expect(plan.up).toContain('DROP COLUMN');
    });

    it('should generate down migration to restore removed fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      expect(plan.down).toContain('ADD COLUMN');
      expect(plan.down).toContain('name');
    });
  });

  describe('modified fields', () => {
    it('should generate SQL for type changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'long' });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      expect(plan.up).toContain('ALTER COLUMN');
      expect(plan.up).toContain('count');
    });
  });

  describe('SQL dialects', () => {
    it('should support different SQL dialects', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });

      const diff = diffSchemas(oldSchema, newSchema);

      const pgPlan = generateMigrationPlan(diff, { dialect: 'postgres' });
      const chPlan = generateMigrationPlan(diff, { dialect: 'clickhouse' });

      expect(pgPlan.up).toContain('INTEGER');
      expect(chPlan.up).toContain('Int32');
    });

    it('should generate DuckDB dialect', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'duckdb' });

      expect(plan.up).toContain('INTEGER');
    });

    it('should generate ClickHouse dialect with correct types', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string',
        count: 'long',
        active: 'boolean',
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'clickhouse' });

      expect(plan.up).toContain('String');
      expect(plan.up).toContain('Int64');
      expect(plan.up).toContain('Bool');
    });
  });

  describe('nullable fields', () => {
    it('should handle nullable fields in migration', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      // Nullable fields should not have NOT NULL constraint
      expect(plan.up).not.toMatch(/name.*NOT NULL/i);
    });

    it('should handle required fields in migration', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      expect(plan.up).toContain('NOT NULL');
    });
  });

  describe('empty diff', () => {
    it('should generate empty migration plan for no changes', () => {
      const schema = parseSchema({ $type: 'User', id: 'uuid!' });
      const diff = diffSchemas(schema, schema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      expect(plan.up).toBe('');
      expect(plan.down).toBe('');
    });
  });

  describe('table name', () => {
    it('should use schema name as table name', () => {
      const oldSchema = parseSchema({ $type: 'users', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'users', id: 'uuid!', name: 'string' });

      const diff = diffSchemas(oldSchema, newSchema);
      const plan = generateMigrationPlan(diff, { dialect: 'postgres' });

      expect(plan.up).toContain('users');
    });
  });
});
