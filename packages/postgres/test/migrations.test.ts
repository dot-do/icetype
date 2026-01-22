/**
 * Tests for PostgresMigrationGenerator
 *
 * TDD approach - tests define expected PostgreSQL-specific migration behavior
 */

import { describe, it, expect } from 'vitest';
import type { SchemaDiff, SchemaChange, FieldDefinition } from '@icetype/core';
import { PostgresMigrationGenerator } from '../src/migrations.js';

describe('PostgresMigrationGenerator', () => {
  const generator = new PostgresMigrationGenerator();

  // Helper to create a test diff
  const createDiff = (schemaName: string, changes: SchemaChange[], isBreaking = false): SchemaDiff => ({
    schemaName,
    changes,
    isBreaking,
  });

  // Helper to create a field definition
  const createFieldDef = (
    name: string,
    type: string,
    options: Partial<FieldDefinition> = {}
  ): FieldDefinition => ({
    name,
    type,
    modifier: '',
    isOptional: false,
    isArray: false,
    isUnique: false,
    isIndexed: false,
    ...options,
  });

  describe('dialect property', () => {
    it('should have dialect set to postgres', () => {
      expect(generator.dialect).toBe('postgres');
    });
  });

  describe('add_field operations', () => {
    it('should generate ALTER TABLE ADD COLUMN for nullable column', () => {
      const diff = createDiff('users', [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE "users" ADD COLUMN "email" TEXT;');
    });

    it('should generate NOT NULL for required column', () => {
      const diff = createDiff('users', [
        {
          type: 'add_field',
          field: 'name',
          definition: createFieldDef('name', 'string', { modifier: '!' }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE "users" ADD COLUMN "name" TEXT NOT NULL;');
    });

    it('should handle NOT NULL with DEFAULT value', () => {
      const diff = createDiff('users', [
        {
          type: 'add_field',
          field: 'status',
          definition: createFieldDef('status', 'string', {
            modifier: '!',
            defaultValue: 'active',
          }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe(
        "ALTER TABLE \"users\" ADD COLUMN \"status\" TEXT NOT NULL DEFAULT 'active';"
      );
    });

    it('should handle different PostgreSQL types', () => {
      const types: Array<{ iceType: string; expected: string }> = [
        { iceType: 'string', expected: 'TEXT' },
        { iceType: 'int', expected: 'INTEGER' },
        { iceType: 'bigint', expected: 'BIGINT' },
        { iceType: 'float', expected: 'REAL' },
        { iceType: 'double', expected: 'DOUBLE PRECISION' },
        { iceType: 'boolean', expected: 'BOOLEAN' },
        { iceType: 'uuid', expected: 'UUID' },
        { iceType: 'timestamp', expected: 'TIMESTAMPTZ' },
        { iceType: 'json', expected: 'JSONB' },
        { iceType: 'blob', expected: 'BYTEA' },
      ];

      for (const { iceType, expected } of types) {
        const diff = createDiff('test', [
          {
            type: 'add_field',
            field: 'col',
            definition: createFieldDef('col', iceType, { isOptional: true }),
          },
        ]);

        const statements = generator.generate(diff);
        expect(statements[0]).toContain(expected);
      }
    });
  });

  describe('remove_field operations', () => {
    it('should generate ALTER TABLE DROP COLUMN', () => {
      const diff = createDiff('users', [
        {
          type: 'remove_field',
          field: 'legacy_field',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE "users" DROP COLUMN "legacy_field";');
    });
  });

  describe('rename_field operations', () => {
    it('should generate ALTER TABLE RENAME COLUMN', () => {
      const diff = createDiff('users', [
        {
          type: 'rename_field',
          oldName: 'firstName',
          newName: 'first_name',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe(
        'ALTER TABLE "users" RENAME COLUMN "firstName" TO "first_name";'
      );
    });
  });

  describe('change_type operations', () => {
    it('should generate ALTER COLUMN TYPE for type changes', () => {
      const diff = createDiff('users', [
        {
          type: 'change_type',
          field: 'age',
          oldType: 'int',
          newType: 'bigint',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe(
        'ALTER TABLE "users" ALTER COLUMN "age" TYPE BIGINT;'
      );
    });

    it('should include USING clause for incompatible type changes', () => {
      const diff = createDiff('users', [
        {
          type: 'change_type',
          field: 'score',
          oldType: 'string',
          newType: 'int',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('USING');
      expect(statements[0]).toContain('::INTEGER');
    });
  });

  describe('change_modifier operations', () => {
    it('should generate SET NOT NULL when making column required', () => {
      const diff = createDiff('users', [
        {
          type: 'change_modifier',
          field: 'name',
          oldModifier: '?',
          newModifier: '!',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe(
        'ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;'
      );
    });

    it('should generate DROP NOT NULL when making column optional', () => {
      const diff = createDiff('users', [
        {
          type: 'change_modifier',
          field: 'bio',
          oldModifier: '!',
          newModifier: '?',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe(
        'ALTER TABLE "users" ALTER COLUMN "bio" DROP NOT NULL;'
      );
    });
  });

  describe('change_directive operations', () => {
    it('should generate CREATE INDEX CONCURRENTLY for $index directive', () => {
      const diff = createDiff('users', [
        {
          type: 'change_directive',
          directive: '$index',
          oldValue: undefined,
          newValue: [['email']],
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CREATE INDEX CONCURRENTLY');
      expect(statements[0]).toContain('"users"');
      expect(statements[0]).toContain('"email"');
    });

    it('should handle composite indexes', () => {
      const diff = createDiff('orders', [
        {
          type: 'change_directive',
          directive: '$index',
          oldValue: undefined,
          newValue: [['user_id', 'created_at']],
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('"user_id", "created_at"');
    });

    it('should handle multiple indexes', () => {
      const diff = createDiff('users', [
        {
          type: 'change_directive',
          directive: '$index',
          oldValue: undefined,
          newValue: [['email'], ['username']],
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain('"email"');
      expect(statements[1]).toContain('"username"');
    });
  });

  describe('multiple operations', () => {
    it('should generate multiple statements for multiple changes', () => {
      const diff = createDiff('users', [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string', { isOptional: true }),
        },
        {
          type: 'remove_field',
          field: 'legacy',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(2);
    });
  });

  describe('generateRollback', () => {
    it('should generate rollback for add_field', () => {
      const diff = createDiff('users', [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string', { isOptional: true }),
        },
      ]);

      const rollback = generator.generateRollback(diff);

      expect(rollback).toHaveLength(1);
      expect(rollback[0]).toBe('ALTER TABLE "users" DROP COLUMN "email";');
    });

    it('should generate rollback for rename_field', () => {
      const diff = createDiff('users', [
        {
          type: 'rename_field',
          oldName: 'firstName',
          newName: 'first_name',
        },
      ]);

      const rollback = generator.generateRollback(diff);

      expect(rollback).toHaveLength(1);
      expect(rollback[0]).toBe(
        'ALTER TABLE "users" RENAME COLUMN "first_name" TO "firstName";'
      );
    });

    it('should generate rollback for change_modifier', () => {
      const diff = createDiff('users', [
        {
          type: 'change_modifier',
          field: 'name',
          oldModifier: '?',
          newModifier: '!',
        },
      ]);

      const rollback = generator.generateRollback(diff);

      expect(rollback).toHaveLength(1);
      expect(rollback[0]).toBe(
        'ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;'
      );
    });

    it('should generate rollback for change_type', () => {
      const diff = createDiff('users', [
        {
          type: 'change_type',
          field: 'age',
          oldType: 'int',
          newType: 'bigint',
        },
      ]);

      const rollback = generator.generateRollback(diff);

      expect(rollback).toHaveLength(1);
      expect(rollback[0]).toContain('TYPE INTEGER');
    });

    it('should reverse operations in reverse order', () => {
      const diff = createDiff('users', [
        {
          type: 'add_field',
          field: 'first',
          definition: createFieldDef('first', 'string', { isOptional: true }),
        },
        {
          type: 'add_field',
          field: 'second',
          definition: createFieldDef('second', 'string', { isOptional: true }),
        },
      ]);

      const rollback = generator.generateRollback(diff);

      expect(rollback).toHaveLength(2);
      expect(rollback[0]).toContain('second'); // Reversed order
      expect(rollback[1]).toContain('first');
    });
  });

  describe('identifier quoting', () => {
    it('should quote table and column names with double quotes', () => {
      const diff = createDiff('User', [
        {
          type: 'add_field',
          field: 'firstName',
          definition: createFieldDef('firstName', 'string', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toBe('ALTER TABLE "User" ADD COLUMN "firstName" TEXT;');
    });

    it('should handle reserved words in identifiers', () => {
      const diff = createDiff('order', [
        {
          type: 'add_field',
          field: 'group',
          definition: createFieldDef('group', 'string', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toBe('ALTER TABLE "order" ADD COLUMN "group" TEXT;');
    });
  });

  describe('empty diff', () => {
    it('should return empty array for diff with no changes', () => {
      const diff = createDiff('users', []);

      const statements = generator.generate(diff);

      expect(statements).toEqual([]);
    });
  });

  describe('default value formatting', () => {
    it('should format string defaults with quotes', () => {
      const diff = createDiff('users', [
        {
          type: 'add_field',
          field: 'status',
          definition: createFieldDef('status', 'string', {
            modifier: '!',
            defaultValue: 'pending',
          }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toContain("DEFAULT 'pending'");
    });

    it('should format numeric defaults without quotes', () => {
      const diff = createDiff('users', [
        {
          type: 'add_field',
          field: 'score',
          definition: createFieldDef('score', 'int', {
            modifier: '!',
            defaultValue: 0,
          }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toContain('DEFAULT 0');
    });

    it('should format boolean defaults as PostgreSQL booleans', () => {
      const diff = createDiff('users', [
        {
          type: 'add_field',
          field: 'active',
          definition: createFieldDef('active', 'boolean', {
            modifier: '!',
            defaultValue: true,
          }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toContain('DEFAULT TRUE');
    });
  });

  describe('options', () => {
    it('should allow disabling CONCURRENTLY for indexes', () => {
      const generator = new PostgresMigrationGenerator({ concurrentIndexes: false });

      const diff = createDiff('users', [
        {
          type: 'change_directive',
          directive: '$index',
          oldValue: undefined,
          newValue: [['email']],
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).not.toContain('CONCURRENTLY');
    });
  });
});
