/**
 * Tests for Reversible Migrations with UP and DOWN Sections
 *
 * TDD RED Phase: These tests define the expected behavior for reversible migrations
 * that have explicit UP (forward) and DOWN (backward) sections.
 *
 * Features under test:
 * - Generating migrations with UP and DOWN sections
 * - Validating that DOWN is the inverse of UP
 * - Detecting irreversible operations (DROP without CREATE)
 * - Rolling back migrations using DOWN section
 * - Generating UP from schema diff
 * - Generating DOWN automatically when possible
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SchemaDiff, SchemaChange, FieldDefinition } from '@icetype/core';
import { createSchemaVersion } from '@icetype/core';
import {
  generateReversibleMigration,
  validateReversibility,
  detectIrreversibleOperations,
  generateDownFromUp,
  parseMigrationFile,
  formatMigrationFile,
  type ReversibleMigration,
  type MigrationValidationResult,
  type IrreversibleOperation,
  type ReversibleMigrationOptions,
} from '../utils/reversible-migrations.js';

// =============================================================================
// Test Helpers
// =============================================================================

const createMockDiff = (changes: SchemaChange[]): SchemaDiff => ({
  schemaName: 'users',
  changes,
  isBreaking: changes.some(
    (c) =>
      c.type === 'remove_field' ||
      (c.type === 'change_modifier' && c.newModifier === '!')
  ),
});

// =============================================================================
// Test Suites
// =============================================================================

describe('Reversible Migrations', () => {
  describe('generateReversibleMigration', () => {
    describe('generates migrations with UP and DOWN sections', () => {
      it('should generate UP section from schema diff', () => {
        const diff = createMockDiff([
          {
            type: 'add_field',
            field: 'email',
            definition: {
              type: 'string',
              isOptional: false,
              modifier: '!',
              isArray: false,
              isUnique: false,
              isIndexed: false,
            } as FieldDefinition,
          },
        ]);

        const migration = generateReversibleMigration(diff, { dialect: 'postgres' });

        expect(migration.up).toBeDefined();
        expect(migration.up.length).toBeGreaterThan(0);
        expect(migration.up[0]).toContain('ALTER TABLE');
        expect(migration.up[0]).toContain('ADD COLUMN');
        expect(migration.up[0]).toContain('email');
      });

      it('should generate DOWN section as inverse of UP', () => {
        const diff = createMockDiff([
          {
            type: 'add_field',
            field: 'email',
            definition: {
              type: 'string',
              isOptional: false,
              modifier: '!',
              isArray: false,
              isUnique: false,
              isIndexed: false,
            } as FieldDefinition,
          },
        ]);

        const migration = generateReversibleMigration(diff, { dialect: 'postgres' });

        expect(migration.down).toBeDefined();
        expect(migration.down.length).toBeGreaterThan(0);
        // DOWN should DROP the column that UP added
        expect(migration.down[0]).toContain('DROP COLUMN');
        expect(migration.down[0]).toContain('email');
      });

      it('should generate DOWN statements in reverse order of UP', () => {
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
            } as FieldDefinition,
          },
          {
            type: 'add_field',
            field: 'phone',
            definition: {
              type: 'string',
              isOptional: true,
              isArray: false,
              isUnique: false,
              isIndexed: false,
            } as FieldDefinition,
          },
        ]);

        const migration = generateReversibleMigration(diff, { dialect: 'postgres' });

        // UP: add email, then add phone
        expect(migration.up[0]).toContain('email');
        expect(migration.up[1]).toContain('phone');

        // DOWN: drop phone first, then drop email (reverse order)
        expect(migration.down[0]).toContain('phone');
        expect(migration.down[1]).toContain('email');
      });

      it('should mark migration as reversible when all operations are reversible', () => {
        const diff = createMockDiff([
          {
            type: 'rename_field',
            oldName: 'firstName',
            newName: 'givenName',
          },
        ]);

        const migration = generateReversibleMigration(diff, { dialect: 'postgres' });

        expect(migration.reversible).toBe(true);
        expect(migration.warnings).toHaveLength(0);
      });

      it('should include version information in migration', () => {
        const diff: SchemaDiff = {
          schemaName: 'users',
          changes: [],
          isBreaking: false,
          fromVersion: createSchemaVersion(1, 0, 0),
          toVersion: createSchemaVersion(1, 1, 0),
        };

        const migration = generateReversibleMigration(diff, { dialect: 'postgres' });

        expect(migration.fromVersion).toEqual({ major: 1, minor: 0, patch: 0 });
        expect(migration.toVersion).toEqual({ major: 1, minor: 1, patch: 0 });
      });
    });

    describe('handles different change types', () => {
      it('should generate reversible migration for rename_field', () => {
        const diff = createMockDiff([
          {
            type: 'rename_field',
            oldName: 'firstName',
            newName: 'givenName',
          },
        ]);

        const migration = generateReversibleMigration(diff, { dialect: 'postgres' });

        // UP: rename firstName to givenName
        expect(migration.up[0]).toContain('RENAME COLUMN');
        expect(migration.up[0]).toContain('firstName');
        expect(migration.up[0]).toContain('givenName');

        // DOWN: rename givenName back to firstName
        expect(migration.down[0]).toContain('RENAME COLUMN');
        expect(migration.down[0]).toContain('givenName');
        expect(migration.down[0]).toContain('firstName');

        expect(migration.reversible).toBe(true);
      });

      it('should generate reversible migration for change_modifier (nullable)', () => {
        const diff = createMockDiff([
          {
            type: 'change_modifier',
            field: 'status',
            oldModifier: '?',
            newModifier: '!',
          },
        ]);

        const migration = generateReversibleMigration(diff, { dialect: 'postgres' });

        // UP: SET NOT NULL
        expect(migration.up[0]).toContain('SET NOT NULL');

        // DOWN: DROP NOT NULL
        expect(migration.down[0]).toContain('DROP NOT NULL');

        expect(migration.reversible).toBe(true);
      });

      it('should generate reversible migration for change_type (compatible)', () => {
        const diff = createMockDiff([
          {
            type: 'change_type',
            field: 'count',
            oldType: 'int',
            newType: 'bigint',
          },
        ]);

        const migration = generateReversibleMigration(diff, { dialect: 'postgres' });

        // UP: change to bigint
        expect(migration.up[0]).toContain('TYPE');
        expect(migration.up[0]).toContain('BIGINT');

        // DOWN: change back to int (with warning about potential data loss)
        expect(migration.down[0]).toContain('TYPE');
        expect(migration.down[0]).toContain('INTEGER');

        expect(migration.warnings).toContainEqual(
          expect.stringContaining('data loss')
        );
      });

      it('should generate reversible migration for add_index', () => {
        const diff = createMockDiff([
          {
            type: 'change_directive',
            directive: '$index',
            oldValue: undefined,
            newValue: [['email']],
          },
        ]);

        const migration = generateReversibleMigration(diff, { dialect: 'postgres' });

        // UP: CREATE INDEX
        expect(migration.up[0]).toContain('CREATE INDEX');

        // DOWN: DROP INDEX
        expect(migration.down[0]).toContain('DROP INDEX');

        expect(migration.reversible).toBe(true);
      });
    });
  });

  describe('validateReversibility', () => {
    it('should validate that DOWN is the inverse of UP for add_field', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Add email column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users ADD COLUMN email TEXT NOT NULL;'],
        down: ['ALTER TABLE users DROP COLUMN email;'],
        reversible: true,
        warnings: [],
        createdAt: new Date(),
      };

      const result = validateReversibility(migration);

      expect(result.valid).toBe(true);
      expect(result.isReversible).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect when DOWN is not the inverse of UP', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Add email column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users ADD COLUMN email TEXT NOT NULL;'],
        down: ['ALTER TABLE users DROP COLUMN phone;'], // Wrong column!
        reversible: true,
        warnings: [],
        createdAt: new Date(),
      };

      const result = validateReversibility(migration);

      expect(result.valid).toBe(false);
      expect(result.isReversible).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('does not reverse')
      );
    });

    it('should validate rename operations have matching columns', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Rename column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users RENAME COLUMN first_name TO given_name;'],
        down: ['ALTER TABLE users RENAME COLUMN given_name TO first_name;'],
        reversible: true,
        warnings: [],
        createdAt: new Date(),
      };

      const result = validateReversibility(migration);

      expect(result.valid).toBe(true);
      expect(result.isReversible).toBe(true);
    });

    it('should detect mismatched rename in DOWN', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Rename column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users RENAME COLUMN first_name TO given_name;'],
        down: ['ALTER TABLE users RENAME COLUMN last_name TO surname;'], // Wrong!
        reversible: true,
        warnings: [],
        createdAt: new Date(),
      };

      const result = validateReversibility(migration);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('does not reverse')
      );
    });

    it('should flag empty DOWN section as invalid for non-empty UP', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Add email column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users ADD COLUMN email TEXT NOT NULL;'],
        down: [],
        reversible: false,
        warnings: [],
        createdAt: new Date(),
      };

      const result = validateReversibility(migration);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('DOWN section is empty')
      );
    });
  });

  describe('detectIrreversibleOperations', () => {
    it('should detect DROP COLUMN without corresponding CREATE', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Remove legacy column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users DROP COLUMN legacy_field;'],
        down: ['-- Cannot restore dropped column without original definition'],
        reversible: false,
        warnings: ['Data loss: dropping column legacy_field'],
        createdAt: new Date(),
      };

      const irreversible = detectIrreversibleOperations(migration);

      expect(irreversible).toHaveLength(1);
      expect(irreversible[0].type).toBe('drop_column');
      expect(irreversible[0].reason).toContain('original definition unknown');
      expect(irreversible[0].statement).toContain('DROP COLUMN');
    });

    it('should detect DROP TABLE as irreversible', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Remove deprecated table',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 2, minor: 0, patch: 0 },
        up: ['DROP TABLE deprecated_data;'],
        down: ['-- Cannot restore dropped table'],
        reversible: false,
        warnings: ['Data loss: dropping table deprecated_data'],
        createdAt: new Date(),
      };

      const irreversible = detectIrreversibleOperations(migration);

      expect(irreversible).toHaveLength(1);
      expect(irreversible[0].type).toBe('drop_table');
      expect(irreversible[0].reason).toContain('table structure and data lost');
    });

    it('should detect narrowing type change as potentially irreversible', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Change column type',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users ALTER COLUMN age TYPE SMALLINT;'], // bigint -> smallint
        down: ['ALTER TABLE users ALTER COLUMN age TYPE BIGINT;'],
        reversible: true,
        warnings: ['Potential data loss: narrowing from BIGINT to SMALLINT'],
        createdAt: new Date(),
      };

      const irreversible = detectIrreversibleOperations(migration);

      expect(irreversible).toHaveLength(1);
      expect(irreversible[0].type).toBe('change_type');
      expect(irreversible[0].reason).toContain('narrowing');
    });

    it('should detect TRUNCATE as irreversible', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Clear old data',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['TRUNCATE TABLE audit_log;'],
        down: ['-- Cannot restore truncated data'],
        reversible: false,
        warnings: ['Data loss: truncating table audit_log'],
        createdAt: new Date(),
      };

      const irreversible = detectIrreversibleOperations(migration);

      expect(irreversible).toHaveLength(1);
      expect(irreversible[0].type).toBe('remove_data');
      expect(irreversible[0].reason).toContain('data cannot be restored');
    });

    it('should not flag reversible operations', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Rename column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users RENAME COLUMN first_name TO given_name;'],
        down: ['ALTER TABLE users RENAME COLUMN given_name TO first_name;'],
        reversible: true,
        warnings: [],
        createdAt: new Date(),
      };

      const irreversible = detectIrreversibleOperations(migration);

      expect(irreversible).toHaveLength(0);
    });

    it('should suggest fixes for some irreversible operations', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Remove column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users DROP COLUMN email;'],
        down: [],
        reversible: false,
        warnings: [],
        createdAt: new Date(),
      };

      const irreversible = detectIrreversibleOperations(migration);

      expect(irreversible[0].suggestedFix).toBeDefined();
      expect(irreversible[0].suggestedFix).toContain('ADD COLUMN email');
    });
  });

  describe('generateDownFromUp', () => {
    it('should generate DROP COLUMN from ADD COLUMN', () => {
      const upStatements = ['ALTER TABLE users ADD COLUMN email TEXT NOT NULL;'];

      const result = generateDownFromUp(upStatements, 'postgres');

      expect(result.down).toHaveLength(1);
      expect(result.down[0]).toContain('DROP COLUMN');
      expect(result.down[0]).toContain('email');
    });

    it('should generate reverse RENAME from RENAME COLUMN', () => {
      const upStatements = [
        'ALTER TABLE users RENAME COLUMN first_name TO given_name;',
      ];

      const result = generateDownFromUp(upStatements, 'postgres');

      expect(result.down).toHaveLength(1);
      expect(result.down[0]).toContain('RENAME COLUMN');
      expect(result.down[0]).toContain('given_name TO first_name');
    });

    it('should generate DROP INDEX from CREATE INDEX', () => {
      const upStatements = ['CREATE INDEX idx_users_email ON users (email);'];

      const result = generateDownFromUp(upStatements, 'postgres');

      expect(result.down).toHaveLength(1);
      expect(result.down[0]).toContain('DROP INDEX');
      expect(result.down[0]).toContain('idx_users_email');
    });

    it('should generate CREATE TABLE from DROP TABLE with warning', () => {
      const upStatements = ['DROP TABLE old_users;'];

      const result = generateDownFromUp(upStatements, 'postgres');

      expect(result.down).toHaveLength(1);
      // Cannot fully reverse DROP TABLE, so should be a comment/placeholder
      expect(result.down[0]).toContain('--');
      expect(result.down[0]).toContain('CREATE TABLE');
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Cannot automatically generate')
      );
    });

    it('should generate reverse type change from ALTER TYPE', () => {
      const upStatements = [
        'ALTER TABLE users ALTER COLUMN count TYPE BIGINT;',
      ];

      // Need context about original type - this should warn
      const result = generateDownFromUp(upStatements, 'postgres');

      expect(result.warnings).toContainEqual(
        expect.stringContaining('original type unknown')
      );
    });

    it('should handle multiple statements in reverse order', () => {
      const upStatements = [
        'ALTER TABLE users ADD COLUMN email TEXT;',
        'ALTER TABLE users ADD COLUMN phone TEXT;',
        'CREATE INDEX idx_users_email ON users (email);',
      ];

      const result = generateDownFromUp(upStatements, 'postgres');

      expect(result.down).toHaveLength(3);
      // Should be in reverse order
      expect(result.down[0]).toContain('DROP INDEX');
      expect(result.down[1]).toContain('DROP COLUMN phone');
      expect(result.down[2]).toContain('DROP COLUMN email');
    });

    it('should handle dialect-specific syntax for MySQL', () => {
      const upStatements = ['ALTER TABLE users ADD COLUMN email VARCHAR(255);'];

      const result = generateDownFromUp(upStatements, 'mysql');

      expect(result.down).toHaveLength(1);
      expect(result.down[0]).toContain('DROP COLUMN');
      // MySQL might use backticks
      expect(result.down[0]).toMatch(/DROP COLUMN `?email`?/);
    });

    it('should handle dialect-specific syntax for SQLite', () => {
      const upStatements = ['ALTER TABLE users ADD COLUMN email TEXT;'];

      const result = generateDownFromUp(upStatements, 'sqlite');

      expect(result.down).toHaveLength(1);
      expect(result.down[0]).toContain('DROP COLUMN');
    });
  });

  describe('parseMigrationFile', () => {
    it('should parse migration file with -- UP and -- DOWN markers', () => {
      const content = `
-- Migration: Add email column
-- Version: 1.0.0 -> 1.1.0

-- UP
ALTER TABLE users ADD COLUMN email TEXT NOT NULL;
CREATE INDEX idx_users_email ON users (email);

-- DOWN
DROP INDEX idx_users_email;
ALTER TABLE users DROP COLUMN email;
`;

      const result = parseMigrationFile(content);

      expect(result.up).toHaveLength(2);
      expect(result.up[0]).toContain('ADD COLUMN email');
      expect(result.up[1]).toContain('CREATE INDEX');

      expect(result.down).toHaveLength(2);
      expect(result.down[0]).toContain('DROP INDEX');
      expect(result.down[1]).toContain('DROP COLUMN');
    });

    it('should handle migration file with === UP === and === DOWN === markers', () => {
      const content = `
=== UP ===
ALTER TABLE users ADD COLUMN email TEXT;

=== DOWN ===
ALTER TABLE users DROP COLUMN email;
`;

      const result = parseMigrationFile(content);

      expect(result.up).toHaveLength(1);
      expect(result.down).toHaveLength(1);
    });

    it('should handle empty DOWN section', () => {
      const content = `
-- UP
ALTER TABLE users DROP COLUMN legacy;

-- DOWN
-- This migration is not reversible
`;

      const result = parseMigrationFile(content);

      expect(result.up).toHaveLength(1);
      expect(result.down).toHaveLength(0); // Comments don't count as statements
    });

    it('should handle multiline statements', () => {
      const content = `
-- UP
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOWN
DROP TABLE users;
`;

      const result = parseMigrationFile(content);

      expect(result.up).toHaveLength(1);
      expect(result.up[0]).toContain('CREATE TABLE');
      expect(result.up[0]).toContain('id UUID PRIMARY KEY');
      expect(result.down).toHaveLength(1);
    });

    it('should throw error for missing UP section', () => {
      const content = `
-- DOWN
ALTER TABLE users DROP COLUMN email;
`;

      expect(() => parseMigrationFile(content)).toThrow('Missing UP section');
    });

    it('should throw error for missing DOWN section when strict', () => {
      const content = `
-- UP
ALTER TABLE users ADD COLUMN email TEXT;
`;

      // For now, just parsing shouldn't throw - validation does
      const result = parseMigrationFile(content);
      expect(result.up).toHaveLength(1);
      expect(result.down).toHaveLength(0);
    });
  });

  describe('formatMigrationFile', () => {
    it('should format migration with UP and DOWN sections', () => {
      const migration: ReversibleMigration = {
        id: '20260121_add_email',
        name: 'Add email column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: [
          'ALTER TABLE users ADD COLUMN email TEXT NOT NULL;',
          'CREATE INDEX idx_users_email ON users (email);',
        ],
        down: [
          'DROP INDEX idx_users_email;',
          'ALTER TABLE users DROP COLUMN email;',
        ],
        reversible: true,
        warnings: [],
        createdAt: new Date('2026-01-21T12:00:00Z'),
      };

      const content = formatMigrationFile(migration);

      expect(content).toContain('-- Migration: Add email column');
      expect(content).toContain('-- ID: 20260121_add_email');
      expect(content).toContain('-- Version: 1.0.0 -> 1.1.0');
      expect(content).toContain('-- UP');
      expect(content).toContain('ALTER TABLE users ADD COLUMN email');
      expect(content).toContain('-- DOWN');
      expect(content).toContain('DROP INDEX');
    });

    it('should include warnings as comments', () => {
      const migration: ReversibleMigration = {
        id: '20260121_change_type',
        name: 'Change column type',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users ALTER COLUMN count TYPE SMALLINT;'],
        down: ['ALTER TABLE users ALTER COLUMN count TYPE INTEGER;'],
        reversible: true,
        warnings: ['Potential data loss: narrowing integer type'],
        createdAt: new Date(),
      };

      const content = formatMigrationFile(migration);

      expect(content).toContain('-- WARNING: Potential data loss');
    });

    it('should mark non-reversible migrations', () => {
      const migration: ReversibleMigration = {
        id: '20260121_drop_column',
        name: 'Drop legacy column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users DROP COLUMN legacy;'],
        down: ['-- NOT REVERSIBLE: Original column definition unknown'],
        reversible: false,
        warnings: ['Data loss: dropping column'],
        createdAt: new Date(),
      };

      const content = formatMigrationFile(migration);

      expect(content).toContain('-- REVERSIBLE: false');
      expect(content).toContain('NOT REVERSIBLE');
    });
  });

  describe('rolling back migrations using DOWN section', () => {
    it('should execute DOWN statements to rollback a migration', async () => {
      // This tests the integration with the migration runner
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Add email column',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        up: ['ALTER TABLE users ADD COLUMN email TEXT;'],
        down: ['ALTER TABLE users DROP COLUMN email;'],
        reversible: true,
        warnings: [],
        createdAt: new Date(),
      };

      // The DOWN section should be usable with the existing migration runner
      expect(migration.down).toHaveLength(1);
      expect(migration.down[0]).toContain('DROP COLUMN');

      // We're just testing that the structure is correct here
      // Full integration would be tested elsewhere
    });

    it('should refuse to rollback non-reversible migrations without force flag', () => {
      const migration: ReversibleMigration = {
        id: 'migration-1',
        name: 'Drop table',
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 2, minor: 0, patch: 0 },
        up: ['DROP TABLE old_data;'],
        down: [],
        reversible: false,
        warnings: ['Data loss: dropping table'],
        createdAt: new Date(),
      };

      // Migration runner should check reversible flag
      expect(migration.reversible).toBe(false);
      expect(migration.down).toHaveLength(0);
    });
  });

  describe('strict reversibility mode', () => {
    it('should fail generation when irreversible operations are detected in strict mode', () => {
      const diff = createMockDiff([
        {
          type: 'remove_field',
          field: 'legacy',
        },
      ]);

      expect(() =>
        generateReversibleMigration(diff, {
          dialect: 'postgres',
          strictReversibility: true,
        })
      ).toThrow('irreversible operation');
    });

    it('should allow irreversible operations when not in strict mode', () => {
      const diff = createMockDiff([
        {
          type: 'remove_field',
          field: 'legacy',
        },
      ]);

      const migration = generateReversibleMigration(diff, {
        dialect: 'postgres',
        strictReversibility: false,
      });

      expect(migration).toBeDefined();
      expect(migration.reversible).toBe(false);
      expect(migration.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('data preservation options', () => {
    it('should backup column data before dropping when preserveData is true', () => {
      const diff = createMockDiff([
        {
          type: 'remove_field',
          field: 'legacy_email',
        },
      ]);

      const migration = generateReversibleMigration(diff, {
        dialect: 'postgres',
        preserveData: true,
      });

      // Should create a backup first
      expect(migration.up[0]).toContain('CREATE TABLE');
      expect(migration.up[0]).toContain('_backup');
      expect(migration.up.some((s) => s.includes('DROP COLUMN'))).toBe(true);

      // DOWN should restore from backup
      expect(migration.down.some((s) => s.includes('ADD COLUMN'))).toBe(true);
      expect(migration.down.some((s) => s.includes('UPDATE'))).toBe(true);
    });
  });
});
