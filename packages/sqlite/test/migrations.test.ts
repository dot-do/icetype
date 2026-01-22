/**
 * Tests for SQLiteMigrationGenerator implementation
 *
 * SQLite has LIMITED ALTER TABLE support:
 * - Supports: ADD COLUMN, RENAME COLUMN (3.25+)
 * - Does NOT support: DROP COLUMN directly, TYPE changes, constraint changes
 *
 * For unsupported operations, we use the table recreation pattern:
 * 1. CREATE TABLE temp_table AS SELECT ... FROM original
 * 2. DROP TABLE original
 * 3. CREATE TABLE original (...new schema...)
 * 4. INSERT INTO original SELECT ... FROM temp_table
 * 5. DROP TABLE temp_table
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import type { SchemaDiff, SchemaChange, FieldDefinition } from '@icetype/core';
import {
  SQLiteMigrationGenerator,
  createSQLiteMigrationGenerator,
  type SQLiteMigrationOptions,
  type TableSchema,
} from '../src/migrations.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock schema diff for testing
 */
function createMockDiff(changes: SchemaChange[], schemaName = 'User'): SchemaDiff {
  return {
    schemaName,
    changes,
    isBreaking: changes.some(
      (c) =>
        c.type === 'remove_field' ||
        (c.type === 'change_modifier' && c.newModifier === '!')
    ),
  };
}

/**
 * Create a field definition for testing
 */
function createFieldDef(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    name: 'testField',
    type: 'string',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
    ...overrides,
  };
}

/**
 * Create a table schema for testing table recreation
 */
function createTableSchema(columns: Array<{ name: string; type: string; nullable?: boolean }>): TableSchema {
  return {
    tableName: 'User',
    columns: columns.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable ?? true,
    })),
    primaryKey: ['id'],
  };
}

// =============================================================================
// SQLiteMigrationGenerator Class Tests
// =============================================================================

describe('SQLiteMigrationGenerator', () => {
  describe('constructor and properties', () => {
    it('should create a generator with default options', () => {
      const generator = new SQLiteMigrationGenerator();
      expect(generator.dialect).toBe('sqlite');
    });

    it('should accept options', () => {
      const generator = new SQLiteMigrationGenerator({
        quoteIdentifiers: true,
        semicolons: true,
      });
      expect(generator.dialect).toBe('sqlite');
    });

    it('should have dialect "sqlite"', () => {
      const generator = new SQLiteMigrationGenerator();
      expect(generator.dialect).toBe('sqlite');
    });
  });

  // ===========================================================================
  // Simple Operations (Direct ALTER TABLE)
  // ===========================================================================

  describe('ADD COLUMN (simple operation)', () => {
    it('should generate simple ALTER TABLE ADD COLUMN for optional field', () => {
      const generator = new SQLiteMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef({ type: 'string', isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE User ADD COLUMN email TEXT;');
    });

    it('should handle integer type', () => {
      const generator = new SQLiteMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'age',
          definition: createFieldDef({ type: 'int', isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toBe('ALTER TABLE User ADD COLUMN age INTEGER;');
    });

    it('should handle boolean type (stored as INTEGER)', () => {
      const generator = new SQLiteMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'active',
          definition: createFieldDef({ type: 'boolean', isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toBe('ALTER TABLE User ADD COLUMN active INTEGER;');
    });

    it('should handle required field with default value', () => {
      const generator = new SQLiteMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'status',
          definition: createFieldDef({
            type: 'string',
            isOptional: false,
            modifier: '!',
            defaultValue: 'pending',
          }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toContain('NOT NULL');
      expect(statements[0]).toContain("DEFAULT 'pending'");
    });

    it('should quote identifiers when option is set', () => {
      const generator = new SQLiteMigrationGenerator({ quoteIdentifiers: true });
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef({ type: 'string', isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toBe('ALTER TABLE "User" ADD COLUMN "email" TEXT;');
    });
  });

  describe('RENAME COLUMN (simple operation, SQLite 3.25+)', () => {
    it('should generate simple ALTER TABLE RENAME COLUMN', () => {
      const generator = new SQLiteMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'rename_field',
          oldName: 'firstName',
          newName: 'givenName',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe(
        'ALTER TABLE User RENAME COLUMN firstName TO givenName;'
      );
    });

    it('should quote identifiers when option is set', () => {
      const generator = new SQLiteMigrationGenerator({ quoteIdentifiers: true });
      const diff = createMockDiff([
        {
          type: 'rename_field',
          oldName: 'first name',
          newName: 'given name',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toBe(
        'ALTER TABLE "User" RENAME COLUMN "first name" TO "given name";'
      );
    });
  });

  // ===========================================================================
  // Complex Operations (Table Recreation Required)
  // ===========================================================================

  describe('DROP COLUMN (requires table recreation)', () => {
    it('should generate table recreation pattern for DROP COLUMN', () => {
      const generator = new SQLiteMigrationGenerator();
      const tableSchema = createTableSchema([
        { name: 'id', type: 'TEXT', nullable: false },
        { name: 'name', type: 'TEXT', nullable: true },
        { name: 'oldField', type: 'TEXT', nullable: true },
      ]);

      const diff = createMockDiff([
        {
          type: 'remove_field',
          field: 'oldField',
        },
      ]);

      const statements = generator.generateWithSchema(diff, tableSchema);

      expect(statements).toHaveLength(5);
      // Step 1: Create temp table with remaining columns
      expect(statements[0]).toContain('CREATE TABLE __temp_User');
      expect(statements[0]).toContain('SELECT id, name FROM User');
      // Step 2: Drop original table
      expect(statements[1]).toBe('DROP TABLE User;');
      // Step 3: Create new table without dropped column
      expect(statements[2]).toContain('CREATE TABLE User');
      expect(statements[2]).not.toContain('oldField');
      // Step 4: Copy data back
      expect(statements[3]).toContain('INSERT INTO User');
      expect(statements[3]).toContain('SELECT');
      expect(statements[3]).toContain('FROM __temp_User');
      // Step 5: Drop temp table
      expect(statements[4]).toBe('DROP TABLE __temp_User;');
    });

    it('should preserve column order when dropping a column', () => {
      const generator = new SQLiteMigrationGenerator();
      const tableSchema = createTableSchema([
        { name: 'id', type: 'TEXT', nullable: false },
        { name: 'first', type: 'TEXT', nullable: true },
        { name: 'middle', type: 'TEXT', nullable: true },
        { name: 'last', type: 'TEXT', nullable: true },
      ]);

      const diff = createMockDiff([
        {
          type: 'remove_field',
          field: 'middle',
        },
      ]);

      const statements = generator.generateWithSchema(diff, tableSchema);

      // The select should have id, first, last (no middle)
      expect(statements[0]).toContain('SELECT id, first, last FROM User');
    });
  });

  describe('TYPE change (requires table recreation)', () => {
    it('should generate table recreation pattern for TYPE change', () => {
      const generator = new SQLiteMigrationGenerator();
      const tableSchema = createTableSchema([
        { name: 'id', type: 'TEXT', nullable: false },
        { name: 'age', type: 'TEXT', nullable: true },
      ]);

      const diff = createMockDiff([
        {
          type: 'change_type',
          field: 'age',
          oldType: 'string',
          newType: 'int',
        },
      ]);

      const statements = generator.generateWithSchema(diff, tableSchema);

      // 6 statements: 1 warning comment + 5 table recreation steps
      expect(statements).toHaveLength(6);
      // Step 0: Warning comment
      expect(statements[0]).toContain('WARNING');
      // Step 1: Create temp table
      expect(statements[1]).toContain('CREATE TABLE __temp_User');
      // Step 2: Drop original table
      expect(statements[2]).toBe('DROP TABLE User;');
      // Step 3: Create new table with new type
      expect(statements[3]).toContain('CREATE TABLE User');
      expect(statements[3]).toContain('age INTEGER');
      // Step 4: Copy data with CAST
      expect(statements[4]).toContain('INSERT INTO User');
      expect(statements[4]).toContain('CAST(age AS INTEGER)');
      // Step 5: Drop temp table
      expect(statements[5]).toBe('DROP TABLE __temp_User;');
    });

    it('should generate warning comment for potential data loss', () => {
      const generator = new SQLiteMigrationGenerator();
      const tableSchema = createTableSchema([
        { name: 'id', type: 'TEXT', nullable: false },
        { name: 'value', type: 'TEXT', nullable: true },
      ]);

      const diff = createMockDiff([
        {
          type: 'change_type',
          field: 'value',
          oldType: 'string',
          newType: 'int',
        },
      ]);

      const statements = generator.generateWithSchema(diff, tableSchema);

      // Should have a warning comment
      expect(statements.some((s) => s.includes('-- WARNING'))).toBe(true);
    });
  });

  describe('change_modifier (constraint changes require table recreation)', () => {
    it('should generate table recreation for NOT NULL change', () => {
      const generator = new SQLiteMigrationGenerator();
      const tableSchema = createTableSchema([
        { name: 'id', type: 'TEXT', nullable: false },
        { name: 'name', type: 'TEXT', nullable: true },
      ]);

      const diff = createMockDiff([
        {
          type: 'change_modifier',
          field: 'name',
          oldModifier: '?',
          newModifier: '!',
        },
      ]);

      const statements = generator.generateWithSchema(diff, tableSchema);

      expect(statements).toHaveLength(5);
      // The new table should have NOT NULL constraint
      expect(statements[2]).toContain('name TEXT NOT NULL');
    });

    it('should handle removing NOT NULL constraint', () => {
      const generator = new SQLiteMigrationGenerator();
      const tableSchema = createTableSchema([
        { name: 'id', type: 'TEXT', nullable: false },
        { name: 'name', type: 'TEXT', nullable: false },
      ]);

      const diff = createMockDiff([
        {
          type: 'change_modifier',
          field: 'name',
          oldModifier: '!',
          newModifier: '?',
        },
      ]);

      const statements = generator.generateWithSchema(diff, tableSchema);

      // The new table should NOT have NOT NULL constraint on name
      expect(statements[2]).toContain('name TEXT');
      expect(statements[2]).not.toContain('name TEXT NOT NULL');
    });
  });

  // ===========================================================================
  // Rollback Generation
  // ===========================================================================

  describe('generateRollback', () => {
    it('should generate rollback for ADD COLUMN by dropping it', () => {
      const generator = new SQLiteMigrationGenerator();
      const tableSchema = createTableSchema([
        { name: 'id', type: 'TEXT', nullable: false },
        { name: 'email', type: 'TEXT', nullable: true },
      ]);

      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef({ type: 'string', isOptional: true }),
        },
      ]);

      const statements = generator.generateRollbackWithSchema(diff, tableSchema);

      // Rollback of ADD COLUMN requires table recreation in SQLite
      expect(statements.length).toBeGreaterThan(0);
    });

    it('should generate rollback for RENAME COLUMN', () => {
      const generator = new SQLiteMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'rename_field',
          oldName: 'firstName',
          newName: 'givenName',
        },
      ]);

      const statements = generator.generateRollback(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe(
        'ALTER TABLE User RENAME COLUMN givenName TO firstName;'
      );
    });
  });

  // ===========================================================================
  // Multiple Operations
  // ===========================================================================

  describe('multiple operations', () => {
    it('should handle multiple simple operations', () => {
      const generator = new SQLiteMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef({ type: 'string', isOptional: true }),
        },
        {
          type: 'rename_field',
          oldName: 'firstName',
          newName: 'givenName',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain('ADD COLUMN');
      expect(statements[1]).toContain('RENAME COLUMN');
    });

    it('should batch complex operations into single table recreation', () => {
      const generator = new SQLiteMigrationGenerator();
      const tableSchema = createTableSchema([
        { name: 'id', type: 'TEXT', nullable: false },
        { name: 'field1', type: 'TEXT', nullable: true },
        { name: 'field2', type: 'TEXT', nullable: true },
        { name: 'field3', type: 'TEXT', nullable: true },
      ]);

      const diff = createMockDiff([
        { type: 'remove_field', field: 'field1' },
        { type: 'remove_field', field: 'field2' },
      ]);

      const statements = generator.generateWithSchema(diff, tableSchema);

      // Should be a single recreation, not two separate ones
      // 5 statements total for the recreation pattern
      expect(statements).toHaveLength(5);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty diff', () => {
      const generator = new SQLiteMigrationGenerator();
      const diff = createMockDiff([]);

      const statements = generator.generate(diff);

      expect(statements).toEqual([]);
    });

    it('should handle table names with spaces', () => {
      const generator = new SQLiteMigrationGenerator({ quoteIdentifiers: true });
      const diff = createMockDiff(
        [
          {
            type: 'add_field',
            field: 'email',
            definition: createFieldDef({ type: 'string', isOptional: true }),
          },
        ],
        'My Table'
      );

      const statements = generator.generate(diff);

      expect(statements[0]).toContain('"My Table"');
    });

    it('should handle column names that are SQL keywords', () => {
      const generator = new SQLiteMigrationGenerator({ quoteIdentifiers: true });
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'select',
          definition: createFieldDef({ type: 'string', isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]).toContain('"select"');
    });

    it('should omit semicolons when option is false', () => {
      const generator = new SQLiteMigrationGenerator({ semicolons: false });
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef({ type: 'string', isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]!.endsWith(';')).toBe(false);
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createSQLiteMigrationGenerator', () => {
  it('should create a SQLiteMigrationGenerator instance', () => {
    const generator = createSQLiteMigrationGenerator();

    expect(generator).toBeInstanceOf(SQLiteMigrationGenerator);
    expect(generator.dialect).toBe('sqlite');
  });

  it('should accept options', () => {
    const options: SQLiteMigrationOptions = {
      quoteIdentifiers: true,
      semicolons: false,
    };

    const generator = createSQLiteMigrationGenerator(options);

    expect(generator).toBeInstanceOf(SQLiteMigrationGenerator);
  });
});
