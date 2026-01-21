/**
 * ClickHouse Migration Generator Tests
 *
 * Tests for generating ClickHouse-specific ALTER TABLE migration statements.
 *
 * ClickHouse has unique syntax compared to standard SQL:
 * - ADD COLUMN col Type [AFTER existing]
 * - DROP COLUMN col
 * - RENAME COLUMN old TO new
 * - MODIFY COLUMN col Type (for type changes)
 * - COMMENT COLUMN col 'comment'
 * - Supports Nullable(), LowCardinality(), and other type wrappers
 */

import { describe, it, expect } from 'vitest';
import type { SchemaDiff, FieldDefinition } from '@icetype/core';
import {
  ClickHouseMigrationGenerator,
  createClickHouseMigrationGenerator,
} from '../migrations.js';

// =============================================================================
// Helper to create test field definitions
// =============================================================================

function createFieldDef(
  name: string,
  type: string,
  options: Partial<FieldDefinition> = {}
): FieldDefinition {
  return {
    name,
    type,
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
    ...options,
  };
}

// =============================================================================
// ADD COLUMN Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - ADD COLUMN', () => {
  it('should generate ADD COLUMN for basic string field', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN email String;');
  });

  it('should generate ADD COLUMN for required field (not null)', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'name',
          definition: createFieldDef('name', 'string', { modifier: '!' }),
        },
      ],
      isBreaking: true,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN name String;');
  });

  it('should generate ADD COLUMN for nullable field with Nullable() wrapper', () => {
    const diff: SchemaDiff = {
      schemaName: 'products',
      changes: [
        {
          type: 'add_field',
          field: 'description',
          definition: createFieldDef('description', 'string', {
            isOptional: true,
            modifier: '?',
          }),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe(
      'ALTER TABLE products ADD COLUMN description Nullable(String);'
    );
  });

  it('should generate ADD COLUMN for integer types', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'age',
          definition: createFieldDef('age', 'int'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN age Int32;');
  });

  it('should generate ADD COLUMN for bigint types', () => {
    const diff: SchemaDiff = {
      schemaName: 'events',
      changes: [
        {
          type: 'add_field',
          field: 'timestamp_ns',
          definition: createFieldDef('timestamp_ns', 'bigint'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE events ADD COLUMN timestamp_ns Int64;');
  });

  it('should generate ADD COLUMN for UUID type', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'external_id',
          definition: createFieldDef('external_id', 'uuid'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN external_id UUID;');
  });

  it('should generate ADD COLUMN for timestamp type', () => {
    const diff: SchemaDiff = {
      schemaName: 'events',
      changes: [
        {
          type: 'add_field',
          field: 'created_at',
          definition: createFieldDef('created_at', 'timestamp'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE events ADD COLUMN created_at DateTime64(3);');
  });

  it('should generate ADD COLUMN for array types', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'tags',
          definition: createFieldDef('tags', 'string', { isArray: true }),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN tags Array(String);');
  });

  it('should generate ADD COLUMN for decimal type with precision', () => {
    const diff: SchemaDiff = {
      schemaName: 'products',
      changes: [
        {
          type: 'add_field',
          field: 'price',
          definition: createFieldDef('price', 'decimal', {
            precision: 10,
            scale: 2,
          }),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE products ADD COLUMN price Decimal(10, 2);');
  });

  it('should generate ADD COLUMN with AFTER clause when position specified', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator({ afterColumn: 'name' });
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN email String AFTER name;');
  });

  it('should generate ADD COLUMN for boolean type', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'is_active',
          definition: createFieldDef('is_active', 'boolean'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN is_active Bool;');
  });

  it('should generate ADD COLUMN for JSON type', () => {
    const diff: SchemaDiff = {
      schemaName: 'events',
      changes: [
        {
          type: 'add_field',
          field: 'metadata',
          definition: createFieldDef('metadata', 'json'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE events ADD COLUMN metadata JSON;');
  });
});

// =============================================================================
// DROP COLUMN Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - DROP COLUMN', () => {
  it('should generate DROP COLUMN statement', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [{ type: 'remove_field', field: 'old_field' }],
      isBreaking: true,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users DROP COLUMN old_field;');
  });

  it('should generate multiple DROP COLUMN statements', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        { type: 'remove_field', field: 'field1' },
        { type: 'remove_field', field: 'field2' },
      ],
      isBreaking: true,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toBe('ALTER TABLE users DROP COLUMN field1;');
    expect(statements[1]).toBe('ALTER TABLE users DROP COLUMN field2;');
  });
});

// =============================================================================
// RENAME COLUMN Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - RENAME COLUMN', () => {
  it('should generate RENAME COLUMN statement', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [{ type: 'rename_field', oldName: 'old_name', newName: 'new_name' }],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users RENAME COLUMN old_name TO new_name;');
  });

  it('should escape identifiers that need escaping', () => {
    const diff: SchemaDiff = {
      schemaName: 'my-table',
      changes: [
        { type: 'rename_field', oldName: 'field-name', newName: 'new-field-name' },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe(
      'ALTER TABLE `my-table` RENAME COLUMN `field-name` TO `new-field-name`;'
    );
  });
});

// =============================================================================
// MODIFY COLUMN (Type Change) Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - MODIFY COLUMN (type change)', () => {
  it('should generate MODIFY COLUMN for type change', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        { type: 'change_type', field: 'age', oldType: 'int', newType: 'bigint' },
      ],
      isBreaking: true,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users MODIFY COLUMN age Int64;');
  });

  it('should generate MODIFY COLUMN for string to text change', () => {
    const diff: SchemaDiff = {
      schemaName: 'posts',
      changes: [
        { type: 'change_type', field: 'content', oldType: 'string', newType: 'text' },
      ],
      isBreaking: true,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE posts MODIFY COLUMN content String;');
  });
});

// =============================================================================
// MODIFY COLUMN (Modifier Change) Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - MODIFY COLUMN (modifier change)', () => {
  it('should generate MODIFY COLUMN for optional to required change', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        { type: 'change_modifier', field: 'email', oldModifier: '?', newModifier: '!' },
      ],
      isBreaking: true,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    // ClickHouse: changing from Nullable to non-Nullable
    expect(statements[0]).toContain('ALTER TABLE users MODIFY COLUMN email');
    expect(statements[0]).toContain('-- Modifier change');
  });

  it('should generate MODIFY COLUMN for required to optional change', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        { type: 'change_modifier', field: 'name', oldModifier: '!', newModifier: '?' },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('ALTER TABLE users MODIFY COLUMN name');
    expect(statements[0]).toContain('-- Modifier change');
  });
});

// =============================================================================
// COMMENT COLUMN Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - COMMENT COLUMN', () => {
  it('should generate COMMENT COLUMN statement when column has comment', () => {
    const generator = new ClickHouseMigrationGenerator();
    const statement = generator.generateCommentColumn('users', 'email', 'User email address');

    expect(statement).toBe("ALTER TABLE users COMMENT COLUMN email 'User email address';");
  });

  it('should escape quotes in comment', () => {
    const generator = new ClickHouseMigrationGenerator();
    const statement = generator.generateCommentColumn(
      'users',
      'name',
      "User's full name"
    );

    expect(statement).toBe("ALTER TABLE users COMMENT COLUMN name 'User''s full name';");
  });
});

// =============================================================================
// ClickHouse-Specific Type Syntax Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - ClickHouse Type Syntax', () => {
  it('should handle Nullable type wrapper', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'middle_name',
          definition: createFieldDef('middle_name', 'string', {
            isOptional: true,
            modifier: '?',
          }),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements[0]).toContain('Nullable(String)');
  });

  it('should handle LowCardinality type via options', () => {
    const diff: SchemaDiff = {
      schemaName: 'events',
      changes: [
        {
          type: 'add_field',
          field: 'event_type',
          definition: createFieldDef('event_type', 'string'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator({
      useLowCardinality: ['event_type'],
    });
    const statements = generator.generate(diff);

    expect(statements[0]).toBe(
      'ALTER TABLE events ADD COLUMN event_type LowCardinality(String);'
    );
  });

  it('should handle nested Nullable with LowCardinality', () => {
    const diff: SchemaDiff = {
      schemaName: 'events',
      changes: [
        {
          type: 'add_field',
          field: 'category',
          definition: createFieldDef('category', 'string', {
            isOptional: true,
            modifier: '?',
          }),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator({
      useLowCardinality: ['category'],
    });
    const statements = generator.generate(diff);

    expect(statements[0]).toBe(
      'ALTER TABLE events ADD COLUMN category LowCardinality(Nullable(String));'
    );
  });

  it('should handle Array with element type', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'scores',
          definition: createFieldDef('scores', 'int', { isArray: true }),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN scores Array(Int32);');
  });
});

// =============================================================================
// Codec Support Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - Codec Support', () => {
  it('should add CODEC when specified in options', () => {
    const diff: SchemaDiff = {
      schemaName: 'logs',
      changes: [
        {
          type: 'add_field',
          field: 'message',
          definition: createFieldDef('message', 'string'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator({
      codecs: { message: 'ZSTD(3)' },
    });
    const statements = generator.generate(diff);

    expect(statements[0]).toBe(
      'ALTER TABLE logs ADD COLUMN message String CODEC(ZSTD(3));'
    );
  });

  it('should add DEFAULT when specified in field definition', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'status',
          definition: createFieldDef('status', 'string', {
            defaultValue: 'active',
          }),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements[0]).toBe(
      "ALTER TABLE users ADD COLUMN status String DEFAULT 'active';"
    );
  });
});

// =============================================================================
// Materialized Column Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - Materialized Columns', () => {
  it('should generate MATERIALIZED column when specified', () => {
    const generator = new ClickHouseMigrationGenerator();
    const statement = generator.generateMaterializedColumn(
      'events',
      'event_date',
      'Date',
      'toDate(created_at)'
    );

    expect(statement).toBe(
      'ALTER TABLE events ADD COLUMN event_date Date MATERIALIZED toDate(created_at);'
    );
  });

  it('should generate ALIAS column when specified', () => {
    const generator = new ClickHouseMigrationGenerator();
    const statement = generator.generateAliasColumn(
      'users',
      'full_name',
      'String',
      "concat(first_name, ' ', last_name)"
    );

    expect(statement).toBe(
      "ALTER TABLE users ADD COLUMN full_name String ALIAS concat(first_name, ' ', last_name);"
    );
  });
});

// =============================================================================
// Database Prefix Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - Database Prefix', () => {
  it('should include database prefix when specified', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator({ database: 'analytics' });
    const statements = generator.generate(diff);

    expect(statements[0]).toBe(
      'ALTER TABLE analytics.users ADD COLUMN email String;'
    );
  });

  it('should validate database name for injection', () => {
    expect(() => {
      new ClickHouseMigrationGenerator({
        database: "analytics'; DROP DATABASE analytics; --",
      });
    }).toThrow();
  });
});

// =============================================================================
// Rollback Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - Rollback', () => {
  it('should generate rollback for ADD COLUMN (DROP)', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generateRollback(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users DROP COLUMN email;');
  });

  it('should generate rollback for DROP COLUMN (comment)', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [{ type: 'remove_field', field: 'old_field' }],
      isBreaking: true,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generateRollback(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('Cannot rollback DROP COLUMN');
  });

  it('should generate rollback for RENAME COLUMN (reverse rename)', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [{ type: 'rename_field', oldName: 'old_name', newName: 'new_name' }],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generateRollback(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users RENAME COLUMN new_name TO old_name;');
  });

  it('should generate rollback for type change', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        { type: 'change_type', field: 'age', oldType: 'int', newType: 'bigint' },
      ],
      isBreaking: true,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generateRollback(diff);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('ALTER TABLE users MODIFY COLUMN age Int32;');
  });
});

// =============================================================================
// Options Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - Options', () => {
  it('should omit semicolons when configured', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator({ semicolons: false });
    const statements = generator.generate(diff);

    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN email String');
    expect(statements[0]).not.toContain(';');
  });

  it('should always quote identifiers when configured', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string'),
        },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator({ quoteIdentifiers: true });
    const statements = generator.generate(diff);

    expect(statements[0]).toBe('ALTER TABLE `users` ADD COLUMN `email` String;');
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createClickHouseMigrationGenerator', () => {
  it('should create a generator instance', () => {
    const generator = createClickHouseMigrationGenerator();
    expect(generator).toBeInstanceOf(ClickHouseMigrationGenerator);
  });

  it('should pass options to the generator', () => {
    const generator = createClickHouseMigrationGenerator({
      database: 'test_db',
      semicolons: false,
    });

    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'name',
          definition: createFieldDef('name', 'string'),
        },
      ],
      isBreaking: false,
    };

    const statements = generator.generate(diff);
    expect(statements[0]).toContain('test_db.users');
    expect(statements[0]).not.toContain(';');
  });
});

// =============================================================================
// Multiple Changes Tests
// =============================================================================

describe('ClickHouseMigrationGenerator - Multiple Changes', () => {
  it('should generate statements for multiple changes', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string'),
        },
        {
          type: 'add_field',
          field: 'age',
          definition: createFieldDef('age', 'int'),
        },
        { type: 'remove_field', field: 'old_field' },
        { type: 'rename_field', oldName: 'name', newName: 'full_name' },
      ],
      isBreaking: true,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generate(diff);

    expect(statements).toHaveLength(4);
    expect(statements[0]).toBe('ALTER TABLE users ADD COLUMN email String;');
    expect(statements[1]).toBe('ALTER TABLE users ADD COLUMN age Int32;');
    expect(statements[2]).toBe('ALTER TABLE users DROP COLUMN old_field;');
    expect(statements[3]).toBe('ALTER TABLE users RENAME COLUMN name TO full_name;');
  });

  it('should process rollback in reverse order', () => {
    const diff: SchemaDiff = {
      schemaName: 'users',
      changes: [
        {
          type: 'add_field',
          field: 'email',
          definition: createFieldDef('email', 'string'),
        },
        { type: 'rename_field', oldName: 'name', newName: 'full_name' },
      ],
      isBreaking: false,
    };

    const generator = new ClickHouseMigrationGenerator();
    const statements = generator.generateRollback(diff);

    expect(statements).toHaveLength(2);
    // Reverse order
    expect(statements[0]).toBe('ALTER TABLE users RENAME COLUMN full_name TO name;');
    expect(statements[1]).toBe('ALTER TABLE users DROP COLUMN email;');
  });
});
