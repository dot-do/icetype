/**
 * Tests for MigrationGenerator interface and generateMigration function
 *
 * TDD RED Phase: These tests define the expected behavior before implementation
 */

import { describe, it, expect } from 'vitest';
import type { SchemaDiff, SchemaChange, MigrationOperation } from '@icetype/core';
import {
  type MigrationGenerator,
  type GeneratorOptions,
  generateMigration,
  createMigrationGenerator,
} from '../generator.js';

describe('MigrationGenerator interface', () => {
  describe('interface contract', () => {
    it('should have a generate method that takes a diff and returns SQL statements', () => {
      const generator: MigrationGenerator = {
        dialect: 'sqlite',
        generate: (diff: SchemaDiff): string[] => {
          return [];
        },
        generateRollback: (diff: SchemaDiff): string[] => {
          return [];
        },
      };

      expect(generator.dialect).toBe('sqlite');
      expect(typeof generator.generate).toBe('function');
      expect(typeof generator.generateRollback).toBe('function');
    });

    it('should support different dialects', () => {
      const dialects = ['sqlite', 'postgres', 'mysql', 'duckdb'] as const;

      for (const dialect of dialects) {
        const generator: MigrationGenerator = {
          dialect,
          generate: () => [],
          generateRollback: () => [],
        };
        expect(generator.dialect).toBe(dialect);
      }
    });
  });
});

describe('generateMigration function', () => {
  // Create a mock schema diff for testing
  const createMockDiff = (changes: SchemaChange[]): SchemaDiff => ({
    schemaName: 'User',
    changes,
    isBreaking: changes.some(
      (c) =>
        c.type === 'remove_field' ||
        (c.type === 'change_modifier' && c.newModifier === '!')
    ),
  });

  describe('add_field operations', () => {
    it('should generate ADD COLUMN for add_field changes', () => {
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: {
            type: 'string',
            isOptional: true,
            isArray: false,
            isUnique: false,
            isIndexed: false,
          },
        },
      ]);

      const statements = generateMigration(diff, 'sqlite');

      expect(statements.length).toBeGreaterThan(0);
      expect(statements[0]).toContain('ALTER TABLE');
      expect(statements[0]).toContain('ADD COLUMN');
      expect(statements[0]).toContain('email');
    });

    it('should handle required fields with NOT NULL constraint', () => {
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'name',
          definition: {
            type: 'string',
            isOptional: false,
            modifier: '!',
            isArray: false,
            isUnique: false,
            isIndexed: false,
          },
        },
      ]);

      const statements = generateMigration(diff, 'sqlite');

      expect(statements.length).toBeGreaterThan(0);
      expect(statements[0]).toContain('NOT NULL');
    });
  });

  describe('remove_field operations', () => {
    it('should generate DROP COLUMN for remove_field changes', () => {
      const diff = createMockDiff([
        {
          type: 'remove_field',
          field: 'oldField',
        },
      ]);

      const statements = generateMigration(diff, 'sqlite');

      expect(statements.length).toBeGreaterThan(0);
      expect(statements[0]).toContain('DROP COLUMN');
      expect(statements[0]).toContain('oldField');
    });
  });

  describe('rename_field operations', () => {
    it('should generate RENAME COLUMN for rename_field changes', () => {
      const diff = createMockDiff([
        {
          type: 'rename_field',
          oldName: 'firstName',
          newName: 'givenName',
        },
      ]);

      const statements = generateMigration(diff, 'sqlite');

      expect(statements.length).toBeGreaterThan(0);
      expect(statements[0]).toContain('RENAME COLUMN');
      expect(statements[0]).toContain('firstName');
      expect(statements[0]).toContain('givenName');
    });
  });

  describe('change_type operations', () => {
    it('should generate ALTER COLUMN for type changes', () => {
      const diff = createMockDiff([
        {
          type: 'change_type',
          field: 'age',
          oldType: 'int',
          newType: 'bigint',
        },
      ]);

      const statements = generateMigration(diff, 'postgres');

      expect(statements.length).toBeGreaterThan(0);
      // Postgres uses ALTER COLUMN ... TYPE
      expect(statements[0]).toContain('ALTER');
      expect(statements[0]).toContain('age');
    });
  });

  describe('change_modifier operations', () => {
    it('should generate ALTER COLUMN for modifier changes', () => {
      const diff = createMockDiff([
        {
          type: 'change_modifier',
          field: 'status',
          oldModifier: '?',
          newModifier: '!',
        },
      ]);

      const statements = generateMigration(diff, 'postgres');

      expect(statements.length).toBeGreaterThan(0);
      expect(statements[0]).toContain('ALTER');
      expect(statements[0]).toContain('status');
    });
  });

  describe('change_directive operations', () => {
    it('should generate index statements for $index directive changes', () => {
      const diff = createMockDiff([
        {
          type: 'change_directive',
          directive: '$index',
          oldValue: undefined,
          newValue: [['email']],
        },
      ]);

      const statements = generateMigration(diff, 'sqlite');

      expect(statements.length).toBeGreaterThan(0);
      expect(statements[0]).toContain('CREATE INDEX');
    });
  });

  describe('multiple operations', () => {
    it('should generate multiple statements for multiple changes', () => {
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: {
            type: 'string',
            isOptional: true,
            isArray: false,
            isUnique: false,
            isIndexed: false,
          },
        },
        {
          type: 'remove_field',
          field: 'legacy',
        },
      ]);

      const statements = generateMigration(diff, 'sqlite');

      expect(statements.length).toBe(2);
    });
  });

  describe('dialect-specific generation', () => {
    const diff = createMockDiff([
      {
        type: 'add_field',
        field: 'uuid',
        definition: {
          type: 'uuid',
          isOptional: false,
          modifier: '!',
          isArray: false,
          isUnique: false,
          isIndexed: false,
        },
      },
    ]);

    it('should generate SQLite-compatible SQL', () => {
      const statements = generateMigration(diff, 'sqlite');
      expect(statements.length).toBeGreaterThan(0);
      // SQLite uses TEXT for UUID
      expect(statements[0]).toContain('TEXT');
    });

    it('should generate PostgreSQL-compatible SQL', () => {
      const statements = generateMigration(diff, 'postgres');
      expect(statements.length).toBeGreaterThan(0);
      // PostgreSQL has native UUID type
      expect(statements[0]).toContain('UUID');
    });

    it('should generate MySQL-compatible SQL', () => {
      const statements = generateMigration(diff, 'mysql');
      expect(statements.length).toBeGreaterThan(0);
      // MySQL uses CHAR(36) for UUID
      expect(statements[0]).toMatch(/CHAR\(36\)|VARCHAR\(36\)/);
    });
  });

  describe('empty diff handling', () => {
    it('should return empty array for diff with no changes', () => {
      const diff = createMockDiff([]);

      const statements = generateMigration(diff, 'sqlite');

      expect(statements).toEqual([]);
    });
  });
});

describe('createMigrationGenerator factory', () => {
  it('should create a generator for a specific dialect', () => {
    const generator = createMigrationGenerator('sqlite');

    expect(generator.dialect).toBe('sqlite');
    expect(typeof generator.generate).toBe('function');
    expect(typeof generator.generateRollback).toBe('function');
  });

  it('should throw for unknown dialect', () => {
    expect(() => createMigrationGenerator('unknown' as any)).toThrow();
  });

  it('should accept options', () => {
    const options: GeneratorOptions = {
      quoteIdentifiers: true,
      semicolons: true,
    };

    const generator = createMigrationGenerator('postgres', options);
    expect(generator.dialect).toBe('postgres');
  });
});
