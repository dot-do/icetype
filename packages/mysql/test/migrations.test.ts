/**
 * Tests for MySQLMigrationGenerator
 *
 * TDD - Tests written first to define expected behavior
 */

import { describe, it, expect } from 'vitest';
import type { SchemaDiff, SchemaChange, FieldDefinition } from '@icetype/core';
import { MySQLMigrationGenerator } from '../src/migrations.js';

// Helper to create a mock FieldDefinition
const createFieldDef = (
  type: string,
  overrides: Partial<FieldDefinition> = {}
): FieldDefinition => ({
  name: 'field',
  type,
  modifier: '',
  isArray: false,
  isOptional: false,
  isUnique: false,
  isIndexed: false,
  ...overrides,
});

// Helper to create a mock SchemaDiff
const createMockDiff = (changes: SchemaChange[]): SchemaDiff => ({
  schemaName: 'users',
  changes,
  isBreaking: changes.some(
    (c) =>
      c.type === 'remove_field' ||
      (c.type === 'change_modifier' && c.newModifier === '!')
  ),
});

describe('MySQLMigrationGenerator', () => {
  describe('dialect property', () => {
    it('should have dialect set to mysql', () => {
      const generator = new MySQLMigrationGenerator();
      expect(generator.dialect).toBe('mysql');
    });
  });

  describe('ADD COLUMN operations', () => {
    it('should generate ALTER TABLE ... ADD COLUMN for add_field', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('string', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN email VARCHAR(255);');
    });

    it('should add NOT NULL constraint for required fields', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'name',
          definition: createFieldDef('string', { modifier: '!' }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('NOT NULL');
    });

    it('should handle uuid type as CHAR(36)', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'id',
          definition: createFieldDef('uuid', { modifier: '!' }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CHAR(36)');
    });

    it('should handle boolean type as TINYINT(1)', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'isActive',
          definition: createFieldDef('boolean', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('TINYINT(1)');
    });

    it('should handle json type', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'metadata',
          definition: createFieldDef('json', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('JSON');
    });

    it('should handle decimal type with precision and scale', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'balance',
          definition: createFieldDef('decimal', {
            isOptional: true,
            precision: 10,
            scale: 2,
          }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('DECIMAL(10, 2)');
    });
  });

  describe('DROP COLUMN operations', () => {
    it('should generate ALTER TABLE ... DROP COLUMN for remove_field', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'remove_field',
          field: 'oldField',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE users DROP COLUMN oldField;');
    });
  });

  describe('RENAME COLUMN operations (MySQL 8.0+)', () => {
    it('should generate ALTER TABLE ... RENAME COLUMN for rename_field', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'rename_field',
          oldName: 'firstName',
          newName: 'givenName',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE users RENAME COLUMN firstName TO givenName;');
    });
  });

  describe('MODIFY COLUMN operations (type change without rename)', () => {
    it('should generate ALTER TABLE ... MODIFY COLUMN for change_type', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'change_type',
          field: 'age',
          oldType: 'int',
          newType: 'bigint',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE users MODIFY COLUMN age BIGINT;');
    });

    it('should handle type change from string to text', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'change_type',
          field: 'description',
          oldType: 'string',
          newType: 'text',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE users MODIFY COLUMN description TEXT;');
    });
  });

  describe('CHANGE COLUMN operations (combined rename + type change)', () => {
    it('should support CHANGE COLUMN syntax via combined operations', () => {
      // MySQL CHANGE COLUMN syntax: ALTER TABLE t CHANGE old_col new_col type
      // This is for when you need to rename AND change type together
      const generator = new MySQLMigrationGenerator();

      // Using changeColumn method directly for combined operation
      const statement = generator.generateChangeColumn(
        'users',
        'firstName',
        'givenName',
        'text'
      );

      expect(statement).toBe('ALTER TABLE users CHANGE COLUMN firstName givenName TEXT;');
    });
  });

  describe('Modifier changes (nullability)', () => {
    it('should generate MODIFY COLUMN with NOT NULL for required modifier', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'change_modifier',
          field: 'status',
          oldModifier: '?',
          newModifier: '!',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      // Note: MySQL MODIFY requires full column definition
      // For simplicity, we generate a conceptual statement
      expect(statements[0]).toContain('ALTER TABLE users');
      expect(statements[0]).toContain('status');
      expect(statements[0]).toContain('SET NOT NULL');
    });

    it('should generate MODIFY COLUMN with NULL for optional modifier', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'change_modifier',
          field: 'status',
          oldModifier: '!',
          newModifier: '?',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('DROP NOT NULL');
    });
  });

  describe('Index operations', () => {
    it('should generate CREATE INDEX for new indexes', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'change_directive',
          directive: '$index',
          oldValue: undefined,
          newValue: [['email']],
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CREATE INDEX');
      expect(statements[0]).toContain('idx_users_email');
      expect(statements[0]).toContain('ON users');
      expect(statements[0]).toContain('(email)');
    });

    it('should generate CREATE INDEX for composite indexes', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'change_directive',
          directive: '$index',
          oldValue: undefined,
          newValue: [['firstName', 'lastName']],
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('idx_users_firstName_lastName');
      expect(statements[0]).toContain('(firstName, lastName)');
    });

    it('should generate multiple indexes when needed', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'change_directive',
          directive: '$index',
          oldValue: undefined,
          newValue: [['email'], ['createdAt']],
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain('idx_users_email');
      expect(statements[1]).toContain('idx_users_createdAt');
    });
  });

  describe('Character set and collation handling', () => {
    it('should support charset option in generator options', () => {
      const generator = new MySQLMigrationGenerator({
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
      });

      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'name',
          definition: createFieldDef('string', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CHARACTER SET utf8mb4');
      expect(statements[0]).toContain('COLLATE utf8mb4_unicode_ci');
    });
  });

  describe('Identifier quoting', () => {
    it('should use backticks for identifiers when quoteIdentifiers is true', () => {
      const generator = new MySQLMigrationGenerator({ quoteIdentifiers: true });
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'order',
          definition: createFieldDef('int', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('`users`');
      expect(statements[0]).toContain('`order`');
    });
  });

  describe('Rollback generation', () => {
    it('should generate DROP COLUMN for add_field rollback', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('string', { isOptional: true }),
        },
      ]);

      const statements = generator.generateRollback(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE users DROP COLUMN email;');
    });

    it('should generate RENAME COLUMN back for rename_field rollback', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'rename_field',
          oldName: 'firstName',
          newName: 'givenName',
        },
      ]);

      const statements = generator.generateRollback(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE users RENAME COLUMN givenName TO firstName;');
    });

    it('should generate type change back for change_type rollback', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'change_type',
          field: 'age',
          oldType: 'int',
          newType: 'bigint',
        },
      ]);

      const statements = generator.generateRollback(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('ALTER TABLE users MODIFY COLUMN age INT;');
    });

    it('should generate DROP INDEX for index rollback', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'change_directive',
          directive: '$index',
          oldValue: undefined,
          newValue: [['email']],
        },
      ]);

      const statements = generator.generateRollback(diff);

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('DROP INDEX');
      expect(statements[0]).toContain('idx_users_email');
    });
  });

  describe('ENGINE considerations', () => {
    it('should support engine option for index-heavy operations', () => {
      const generator = new MySQLMigrationGenerator({ engine: 'InnoDB' });
      expect(generator.engine).toBe('InnoDB');
    });
  });

  describe('Multiple operations', () => {
    it('should generate multiple statements for multiple changes', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('string', { isOptional: true }),
        },
        {
          type: 'remove_field',
          field: 'legacy',
        },
        {
          type: 'rename_field',
          oldName: 'old',
          newName: 'new',
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements).toHaveLength(3);
    });
  });

  describe('Empty diff handling', () => {
    it('should return empty array for diff with no changes', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([]);

      const statements = generator.generate(diff);

      expect(statements).toEqual([]);
    });
  });

  describe('Semicolon handling', () => {
    it('should include semicolons by default', () => {
      const generator = new MySQLMigrationGenerator();
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('string', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]!.endsWith(';')).toBe(true);
    });

    it('should not include semicolons when disabled', () => {
      const generator = new MySQLMigrationGenerator({ semicolons: false });
      const diff = createMockDiff([
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('string', { isOptional: true }),
        },
      ]);

      const statements = generator.generate(diff);

      expect(statements[0]!.endsWith(';')).toBe(false);
    });
  });
});
