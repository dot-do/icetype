/**
 * Tests for Drizzle Schema Generator
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import {
  toCamelCase,
  toSnakeCase,
  toPascalCase,
  escapeString,
  generateImports,
  collectImports,
  generateColumn,
  generateTable,
  generateSchemaCode,
  formatDefaultValue,
  validateTableName,
  validateColumnName,
} from '../src/generator.js';
import type { DrizzleSchema, DrizzleTable, DrizzleColumn } from '../src/types.js';

// =============================================================================
// toCamelCase() Tests
// =============================================================================

describe('toCamelCase()', () => {
  it('should convert snake_case to camelCase', () => {
    expect(toCamelCase('user_name')).toBe('userName');
    expect(toCamelCase('created_at')).toBe('createdAt');
    expect(toCamelCase('first_name_last')).toBe('firstNameLast');
  });

  it('should convert kebab-case to camelCase', () => {
    expect(toCamelCase('user-name')).toBe('userName');
    expect(toCamelCase('created-at')).toBe('createdAt');
  });

  it('should lowercase first character', () => {
    expect(toCamelCase('UserName')).toBe('userName');
    expect(toCamelCase('User')).toBe('user');
  });

  it('should handle already camelCase strings', () => {
    expect(toCamelCase('userName')).toBe('userName');
    expect(toCamelCase('createdAt')).toBe('createdAt');
  });

  it('should handle single word strings', () => {
    expect(toCamelCase('user')).toBe('user');
    expect(toCamelCase('name')).toBe('name');
  });

  it('should handle empty string', () => {
    expect(toCamelCase('')).toBe('');
  });
});

// =============================================================================
// toSnakeCase() Tests
// =============================================================================

describe('toSnakeCase()', () => {
  it('should convert camelCase to snake_case', () => {
    expect(toSnakeCase('userName')).toBe('user_name');
    expect(toSnakeCase('createdAt')).toBe('created_at');
    expect(toSnakeCase('firstNameLast')).toBe('first_name_last');
  });

  it('should convert PascalCase to snake_case', () => {
    expect(toSnakeCase('UserName')).toBe('user_name');
    expect(toSnakeCase('CreatedAt')).toBe('created_at');
  });

  it('should handle already snake_case strings', () => {
    expect(toSnakeCase('user_name')).toBe('user_name');
    expect(toSnakeCase('created_at')).toBe('created_at');
  });

  it('should handle single word strings', () => {
    expect(toSnakeCase('user')).toBe('user');
    expect(toSnakeCase('User')).toBe('user');
  });

  it('should handle empty string', () => {
    expect(toSnakeCase('')).toBe('');
  });

  it('should not add leading underscore', () => {
    expect(toSnakeCase('ABC')).not.toMatch(/^_/);
  });
});

// =============================================================================
// toPascalCase() Tests
// =============================================================================

describe('toPascalCase()', () => {
  it('should convert snake_case to PascalCase', () => {
    expect(toPascalCase('user_name')).toBe('UserName');
    expect(toPascalCase('created_at')).toBe('CreatedAt');
  });

  it('should convert camelCase to PascalCase', () => {
    expect(toPascalCase('userName')).toBe('UserName');
    expect(toPascalCase('createdAt')).toBe('CreatedAt');
  });

  it('should handle already PascalCase strings', () => {
    expect(toPascalCase('UserName')).toBe('UserName');
  });

  it('should handle single word strings', () => {
    expect(toPascalCase('user')).toBe('User');
    expect(toPascalCase('name')).toBe('Name');
  });

  it('should handle empty string', () => {
    expect(toPascalCase('')).toBe('');
  });
});

// =============================================================================
// escapeString() Tests
// =============================================================================

describe('escapeString()', () => {
  it('should wrap string in single quotes', () => {
    expect(escapeString('hello')).toBe("'hello'");
    expect(escapeString('world')).toBe("'world'");
  });

  it('should escape single quotes in string', () => {
    expect(escapeString("it's")).toBe("'it\\'s'");
    expect(escapeString("don't")).toBe("'don\\'t'");
  });

  it('should handle empty string', () => {
    expect(escapeString('')).toBe("''");
  });

  it('should handle strings with special characters', () => {
    expect(escapeString('hello\nworld')).toBe("'hello\nworld'");
    expect(escapeString('tab\there')).toBe("'tab\there'");
  });
});

// =============================================================================
// generateImports() Tests
// =============================================================================

describe('generateImports()', () => {
  it('should generate import statement', () => {
    const schema: DrizzleSchema = {
      dialect: 'pg',
      tables: [],
      imports: [
        { from: 'drizzle-orm/pg-core', names: ['pgTable', 'varchar', 'integer'] },
      ],
    };

    const result = generateImports(schema);
    expect(result).toContain("import {");
    expect(result).toContain("} from 'drizzle-orm/pg-core'");
    expect(result).toContain('integer');
    expect(result).toContain('pgTable');
    expect(result).toContain('varchar');
  });

  it('should sort import names', () => {
    const schema: DrizzleSchema = {
      dialect: 'pg',
      tables: [],
      imports: [
        { from: 'drizzle-orm/pg-core', names: ['varchar', 'integer', 'boolean'] },
      ],
    };

    const result = generateImports(schema);
    // Names should be sorted: boolean, integer, varchar
    expect(result).toMatch(/boolean.*integer.*varchar/);
  });

  it('should handle multiple imports', () => {
    const schema: DrizzleSchema = {
      dialect: 'pg',
      tables: [],
      imports: [
        { from: 'drizzle-orm/pg-core', names: ['pgTable'] },
        { from: 'drizzle-orm', names: ['sql'] },
      ],
    };

    const result = generateImports(schema);
    expect(result).toContain("from 'drizzle-orm/pg-core'");
    expect(result).toContain("from 'drizzle-orm'");
  });
});

// =============================================================================
// collectImports() Tests
// =============================================================================

describe('collectImports()', () => {
  it('should collect unique type imports', () => {
    const tables: DrizzleTable[] = [
      {
        tableName: 'users',
        exportName: 'users',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: false, isArray: false, originalName: 'id' },
          { name: 'name', type: 'varchar', nullable: true, primaryKey: false, unique: false, isArray: false, originalName: 'name' },
        ],
        indexes: [],
      },
    ];

    const imports = collectImports(tables, 'pg');
    expect(imports[0]!.names).toContain('pgTable');
    expect(imports[0]!.names).toContain('uuid');
    expect(imports[0]!.names).toContain('varchar');
  });

  it('should include table function for each dialect', () => {
    const tables: DrizzleTable[] = [{
      tableName: 'test',
      exportName: 'test',
      columns: [],
      indexes: [],
    }];

    expect(collectImports(tables, 'pg')[0]!.names).toContain('pgTable');
    expect(collectImports(tables, 'mysql')[0]!.names).toContain('mysqlTable');
    expect(collectImports(tables, 'sqlite')[0]!.names).toContain('sqliteTable');
  });

  it('should deduplicate type imports', () => {
    const tables: DrizzleTable[] = [
      {
        tableName: 'users',
        exportName: 'users',
        columns: [
          { name: 'a', type: 'varchar', nullable: false, primaryKey: false, unique: false, isArray: false, originalName: 'a' },
          { name: 'b', type: 'varchar', nullable: false, primaryKey: false, unique: false, isArray: false, originalName: 'b' },
        ],
        indexes: [],
      },
    ];

    const imports = collectImports(tables, 'pg');
    const varcharCount = imports[0]!.names.filter(n => n === 'varchar').length;
    expect(varcharCount).toBe(1);
  });
});

// =============================================================================
// generateColumn() Tests
// =============================================================================

describe('generateColumn()', () => {
  it('should generate basic column', () => {
    const column: DrizzleColumn = {
      name: 'name',
      type: 'varchar',
      nullable: true,
      primaryKey: false,
      unique: false,
      isArray: false,
      originalName: 'name',
    };

    const result = generateColumn(column, 'pg');
    expect(result).toContain("varchar('name')");
  });

  it('should include primaryKey()', () => {
    const column: DrizzleColumn = {
      name: 'id',
      type: 'uuid',
      nullable: false,
      primaryKey: true,
      unique: false,
      isArray: false,
      originalName: 'id',
    };

    const result = generateColumn(column, 'pg');
    expect(result).toContain('.primaryKey()');
  });

  it('should include notNull()', () => {
    const column: DrizzleColumn = {
      name: 'email',
      type: 'varchar',
      nullable: false,
      primaryKey: false,
      unique: false,
      isArray: false,
      originalName: 'email',
    };

    const result = generateColumn(column, 'pg');
    expect(result).toContain('.notNull()');
  });

  it('should include unique()', () => {
    const column: DrizzleColumn = {
      name: 'email',
      type: 'varchar',
      nullable: true,
      primaryKey: false,
      unique: true,
      isArray: false,
      originalName: 'email',
    };

    const result = generateColumn(column, 'pg');
    expect(result).toContain('.unique()');
  });

  it('should not include unique() for primary key', () => {
    const column: DrizzleColumn = {
      name: 'id',
      type: 'uuid',
      nullable: false,
      primaryKey: true,
      unique: true,
      isArray: false,
      originalName: 'id',
    };

    const result = generateColumn(column, 'pg');
    expect(result).not.toContain('.unique()');
  });

  it('should include default value', () => {
    const column: DrizzleColumn = {
      name: 'status',
      type: 'varchar',
      nullable: true,
      primaryKey: false,
      unique: false,
      defaultValue: "'active'",
      isArray: false,
      originalName: 'status',
    };

    const result = generateColumn(column, 'pg');
    expect(result).toContain(".default('active')");
  });

  it('should include type parameters', () => {
    const column: DrizzleColumn = {
      name: 'name',
      type: 'varchar',
      typeParams: { length: 255 },
      nullable: true,
      primaryKey: false,
      unique: false,
      isArray: false,
      originalName: 'name',
    };

    const result = generateColumn(column, 'pg');
    expect(result).toContain('length: 255');
  });
});

// =============================================================================
// generateTable() Tests
// =============================================================================

describe('generateTable()', () => {
  it('should generate table declaration', () => {
    const table: DrizzleTable = {
      tableName: 'users',
      exportName: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: false, isArray: false, originalName: 'id' },
      ],
      indexes: [],
    };

    const result = generateTable(table, 'pg');
    expect(result).toContain("export const users = pgTable('users'");
  });

  it('should generate type export', () => {
    const table: DrizzleTable = {
      tableName: 'users',
      exportName: 'users',
      columns: [],
      indexes: [],
    };

    const result = generateTable(table, 'pg');
    expect(result).toContain('export type Users = typeof users.$inferSelect');
    expect(result).toContain('export type NewUsers = typeof users.$inferInsert');
  });

  it('should use correct table function for dialect', () => {
    const table: DrizzleTable = {
      tableName: 'test',
      exportName: 'test',
      columns: [],
      indexes: [],
    };

    expect(generateTable(table, 'pg')).toContain('pgTable');
    expect(generateTable(table, 'mysql')).toContain('mysqlTable');
    expect(generateTable(table, 'sqlite')).toContain('sqliteTable');
  });

  it('should include all columns', () => {
    const table: DrizzleTable = {
      tableName: 'users',
      exportName: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: false, isArray: false, originalName: 'id' },
        { name: 'name', type: 'varchar', nullable: true, primaryKey: false, unique: false, isArray: false, originalName: 'name' },
        { name: 'email', type: 'varchar', nullable: false, primaryKey: false, unique: true, isArray: false, originalName: 'email' },
      ],
      indexes: [],
    };

    const result = generateTable(table, 'pg');
    expect(result).toContain('id:');
    expect(result).toContain('name:');
    expect(result).toContain('email:');
  });
});

// =============================================================================
// generateSchemaCode() Tests
// =============================================================================

describe('generateSchemaCode()', () => {
  it('should generate complete schema code', () => {
    const schema: DrizzleSchema = {
      dialect: 'pg',
      tables: [
        {
          tableName: 'users',
          exportName: 'users',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: false, isArray: false, originalName: 'id' },
          ],
          indexes: [],
        },
      ],
      imports: [
        { from: 'drizzle-orm/pg-core', names: ['pgTable', 'uuid'] },
      ],
    };

    const result = generateSchemaCode(schema);
    expect(result).toContain('Drizzle ORM Schema');
    expect(result).toContain('@icetype/drizzle');
    expect(result).toContain('import {');
    expect(result).toContain('export const users');
  });

  it('should include dialect in header', () => {
    const schema: DrizzleSchema = {
      dialect: 'mysql',
      tables: [],
      imports: [],
    };

    const result = generateSchemaCode(schema);
    expect(result).toContain('Dialect: mysql');
  });

  it('should handle multiple tables', () => {
    const schema: DrizzleSchema = {
      dialect: 'pg',
      tables: [
        { tableName: 'users', exportName: 'users', columns: [], indexes: [] },
        { tableName: 'posts', exportName: 'posts', columns: [], indexes: [] },
      ],
      imports: [{ from: 'drizzle-orm/pg-core', names: ['pgTable'] }],
    };

    const result = generateSchemaCode(schema);
    expect(result).toContain('export const users');
    expect(result).toContain('export const posts');
  });
});

// =============================================================================
// formatDefaultValue() Tests
// =============================================================================

describe('formatDefaultValue()', () => {
  it('should format string values', () => {
    expect(formatDefaultValue('hello', 'varchar')).toBe("'hello'");
    expect(formatDefaultValue('world', 'text')).toBe("'world'");
  });

  it('should format boolean values', () => {
    expect(formatDefaultValue(true, 'boolean')).toBe('true');
    expect(formatDefaultValue(false, 'boolean')).toBe('false');
  });

  it('should format numeric values', () => {
    expect(formatDefaultValue(42, 'integer')).toBe('42');
    expect(formatDefaultValue(3.14, 'double')).toBe('3.14');
  });

  it('should return undefined for null/undefined', () => {
    expect(formatDefaultValue(null, 'varchar')).toBeUndefined();
    expect(formatDefaultValue(undefined, 'varchar')).toBeUndefined();
  });

  it('should handle object values as JSON', () => {
    const result = formatDefaultValue({ key: 'value' }, 'json');
    expect(result).toBe('{"key":"value"}');
  });
});

// =============================================================================
// validateTableName() Tests
// =============================================================================

describe('validateTableName()', () => {
  it('should keep valid names unchanged', () => {
    expect(validateTableName('users')).toBe('users');
    expect(validateTableName('user_posts')).toBe('user_posts');
    expect(validateTableName('Table123')).toBe('Table123');
  });

  it('should replace invalid characters', () => {
    expect(validateTableName('user-posts')).toBe('user_posts');
    expect(validateTableName('user.posts')).toBe('user_posts');
    expect(validateTableName('user@posts')).toBe('user_posts');
  });

  it('should prefix names starting with numbers', () => {
    expect(validateTableName('123users')).toBe('t_123users');
    expect(validateTableName('1table')).toBe('t_1table');
  });
});

// =============================================================================
// validateColumnName() Tests
// =============================================================================

describe('validateColumnName()', () => {
  it('should keep valid names unchanged', () => {
    expect(validateColumnName('id')).toBe('id');
    expect(validateColumnName('user_name')).toBe('user_name');
    expect(validateColumnName('Column123')).toBe('Column123');
  });

  it('should replace invalid characters', () => {
    expect(validateColumnName('user-name')).toBe('user_name');
    expect(validateColumnName('user.name')).toBe('user_name');
  });

  it('should prefix names starting with numbers', () => {
    expect(validateColumnName('123id')).toBe('c_123id');
    expect(validateColumnName('1column')).toBe('c_1column');
  });
});
