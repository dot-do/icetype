/**
 * Tests for DrizzleAdapter implementation
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema } from '@icetype/core';
import type { IceTypeSchema } from '@icetype/core';
import {
  DrizzleAdapter,
  createDrizzleAdapter,
  transformToDrizzle,
  generateDrizzleSchema,
  transformSchemasToDrizzle,
} from '../src/adapter.js';
// DrizzleSchema type used implicitly in tests

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a simple test schema.
 */
function createSimpleSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    name: 'string',
    age: 'int?',
  });
}

/**
 * Create a schema with various field types.
 */
function createTypedSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'Product',
    id: 'uuid!',
    name: 'string!',
    description: 'text',
    price: 'double',
    quantity: 'int',
    isActive: 'boolean',
    createdAt: 'timestamp',
    releaseDate: 'date',
    metadata: 'json',
  });
}

/**
 * Create a schema with indexes.
 */
function createIndexedSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'Order',
    $index: [['userId'], ['createdAt']],
    id: 'uuid!',
    userId: 'uuid!',
    total: 'double',
    status: 'string',
    createdAt: 'timestamp',
  });
}

// =============================================================================
// createDrizzleAdapter() Factory Tests
// =============================================================================

describe('createDrizzleAdapter()', () => {
  it('should create a new DrizzleAdapter instance', () => {
    const adapter = createDrizzleAdapter();

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(DrizzleAdapter);
  });

  it('should create independent adapter instances', () => {
    const adapter1 = createDrizzleAdapter();
    const adapter2 = createDrizzleAdapter();

    expect(adapter1).not.toBe(adapter2);
  });

  it('should create adapter with correct interface methods', () => {
    const adapter = createDrizzleAdapter();

    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.version).toBe('string');
  });
});

// =============================================================================
// DrizzleAdapter Properties Tests
// =============================================================================

describe('DrizzleAdapter properties', () => {
  let adapter: DrizzleAdapter;

  beforeEach(() => {
    adapter = new DrizzleAdapter();
  });

  describe('name property', () => {
    it('should have name "drizzle"', () => {
      expect(adapter.name).toBe('drizzle');
    });

    it('should be readonly', () => {
      const originalName = adapter.name;
      expect(adapter.name).toBe(originalName);
    });
  });

  describe('version property', () => {
    it('should have a valid semver version', () => {
      expect(adapter.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should be "0.1.0"', () => {
      expect(adapter.version).toBe('0.1.0');
    });

    it('should be readonly', () => {
      const originalVersion = adapter.version;
      expect(adapter.version).toBe(originalVersion);
    });
  });
});

// =============================================================================
// transform() Tests - Basic
// =============================================================================

describe('DrizzleAdapter.transform() - Basic', () => {
  let adapter: DrizzleAdapter;

  beforeEach(() => {
    adapter = new DrizzleAdapter();
  });

  it('should return valid DrizzleSchema', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema);

    expect(result).toBeDefined();
    expect(result.dialect).toBeDefined();
    expect(result.tables).toBeDefined();
    expect(result.imports).toBeDefined();
  });

  it('should default to PostgreSQL dialect', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema);

    expect(result.dialect).toBe('pg');
  });

  it('should generate correct table structure', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema);

    expect(result.tables.length).toBe(1);
    expect(result.tables[0]!.tableName).toBe('user');
    expect(result.tables[0]!.exportName).toBe('user');
  });

  it('should include column definitions', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema);

    const columns = result.tables[0]!.columns;
    expect(columns.length).toBeGreaterThan(0);
  });

  it('should include required imports', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema);

    expect(result.imports.length).toBeGreaterThan(0);
    expect(result.imports[0]!.from).toBe('drizzle-orm/pg-core');
  });
});

// =============================================================================
// transform() Tests - Dialects
// =============================================================================

describe('DrizzleAdapter.transform() - Dialects', () => {
  let adapter: DrizzleAdapter;

  beforeEach(() => {
    adapter = new DrizzleAdapter();
  });

  it('should support PostgreSQL dialect', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema, { dialect: 'pg' });

    expect(result.dialect).toBe('pg');
    expect(result.imports[0]!.from).toBe('drizzle-orm/pg-core');
  });

  it('should support MySQL dialect', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema, { dialect: 'mysql' });

    expect(result.dialect).toBe('mysql');
    expect(result.imports[0]!.from).toBe('drizzle-orm/mysql-core');
  });

  it('should support SQLite dialect', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema, { dialect: 'sqlite' });

    expect(result.dialect).toBe('sqlite');
    expect(result.imports[0]!.from).toBe('drizzle-orm/sqlite-core');
  });

  it('should include pgTable for PostgreSQL', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema, { dialect: 'pg' });

    expect(result.imports[0]!.names).toContain('pgTable');
  });

  it('should include mysqlTable for MySQL', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema, { dialect: 'mysql' });

    expect(result.imports[0]!.names).toContain('mysqlTable');
  });

  it('should include sqliteTable for SQLite', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema, { dialect: 'sqlite' });

    expect(result.imports[0]!.names).toContain('sqliteTable');
  });
});

// =============================================================================
// transform() Tests - Options
// =============================================================================

describe('DrizzleAdapter.transform() - Options', () => {
  let adapter: DrizzleAdapter;

  beforeEach(() => {
    adapter = new DrizzleAdapter();
  });

  it('should accept custom table name', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema, { tableName: 'custom_users' });

    expect(result.tables[0]!.tableName).toBe('custom_users');
  });

  it('should include system fields when requested', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema, { includeSystemFields: true });

    const columnNames = result.tables[0]!.columns.map(c => c.originalName);
    expect(columnNames).toContain('$id');
    expect(columnNames).toContain('$type');
    expect(columnNames).toContain('$createdAt');
    expect(columnNames).toContain('$updatedAt');
  });

  it('should exclude system fields by default', () => {
    const schema = createSimpleSchema();
    const result = adapter.transform(schema);

    const columnNames = result.tables[0]!.columns.map(c => c.originalName);
    expect(columnNames).not.toContain('$id');
    expect(columnNames).not.toContain('$type');
  });

  it('should apply camelCase to column names by default', () => {
    const schema = parseSchema({
      $type: 'User',
      user_name: 'string',
      created_at: 'timestamp',
    });
    const result = adapter.transform(schema);

    const columnNames = result.tables[0]!.columns.map(c => c.name);
    expect(columnNames).toContain('userName');
    expect(columnNames).toContain('createdAt');
  });

  it('should preserve original names when camelCase is false', () => {
    const schema = parseSchema({
      $type: 'User',
      user_name: 'string',
      created_at: 'timestamp',
    });
    const result = adapter.transform(schema, { camelCase: false });

    const columnNames = result.tables[0]!.columns.map(c => c.name);
    expect(columnNames).toContain('user_name');
    expect(columnNames).toContain('created_at');
  });
});

// =============================================================================
// transform() Tests - Field Types
// =============================================================================

describe('DrizzleAdapter.transform() - Field Types', () => {
  let adapter: DrizzleAdapter;

  beforeEach(() => {
    adapter = new DrizzleAdapter();
  });

  it('should map string to varchar for PostgreSQL', () => {
    const schema = parseSchema({ $type: 'Test', name: 'string' });
    const result = adapter.transform(schema, { dialect: 'pg' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'name');
    expect(column?.type).toBe('varchar');
  });

  it('should map string to text for SQLite', () => {
    const schema = parseSchema({ $type: 'Test', name: 'string' });
    const result = adapter.transform(schema, { dialect: 'sqlite' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'name');
    expect(column?.type).toBe('text');
  });

  it('should map int to integer', () => {
    const schema = parseSchema({ $type: 'Test', count: 'int' });
    const result = adapter.transform(schema, { dialect: 'pg' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'count');
    expect(column?.type).toBe('integer');
  });

  it('should map uuid to uuid for PostgreSQL', () => {
    const schema = parseSchema({ $type: 'Test', id: 'uuid' });
    const result = adapter.transform(schema, { dialect: 'pg' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'id');
    expect(column?.type).toBe('uuid');
  });

  it('should map uuid to varchar for MySQL', () => {
    const schema = parseSchema({ $type: 'Test', id: 'uuid' });
    const result = adapter.transform(schema, { dialect: 'mysql' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'id');
    expect(column?.type).toBe('varchar');
  });

  it('should map uuid to text for SQLite', () => {
    const schema = parseSchema({ $type: 'Test', id: 'uuid' });
    const result = adapter.transform(schema, { dialect: 'sqlite' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'id');
    expect(column?.type).toBe('text');
  });

  it('should map boolean to boolean for PostgreSQL', () => {
    const schema = parseSchema({ $type: 'Test', isActive: 'boolean' });
    const result = adapter.transform(schema, { dialect: 'pg' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'isActive');
    expect(column?.type).toBe('boolean');
  });

  it('should map boolean to integer for SQLite', () => {
    const schema = parseSchema({ $type: 'Test', isActive: 'boolean' });
    const result = adapter.transform(schema, { dialect: 'sqlite' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'isActive');
    expect(column?.type).toBe('integer');
  });

  it('should map timestamp to timestamp', () => {
    const schema = parseSchema({ $type: 'Test', createdAt: 'timestamp' });
    const result = adapter.transform(schema, { dialect: 'pg' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'createdAt');
    expect(column?.type).toBe('timestamp');
  });

  it('should map json to json for PostgreSQL', () => {
    const schema = parseSchema({ $type: 'Test', data: 'json' });
    const result = adapter.transform(schema, { dialect: 'pg' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'data');
    expect(column?.type).toBe('json');
  });

  it('should map json to text for SQLite', () => {
    const schema = parseSchema({ $type: 'Test', data: 'json' });
    const result = adapter.transform(schema, { dialect: 'sqlite' });

    const column = result.tables[0]!.columns.find(c => c.originalName === 'data');
    expect(column?.type).toBe('text');
  });
});

// =============================================================================
// transform() Tests - Modifiers
// =============================================================================

describe('DrizzleAdapter.transform() - Modifiers', () => {
  let adapter: DrizzleAdapter;

  beforeEach(() => {
    adapter = new DrizzleAdapter();
  });

  it('should mark required fields as not nullable', () => {
    const schema = parseSchema({ $type: 'Test', name: 'string!' });
    const result = adapter.transform(schema);

    const column = result.tables[0]!.columns.find(c => c.originalName === 'name');
    expect(column?.nullable).toBe(false);
  });

  it('should mark optional fields as nullable', () => {
    const schema = parseSchema({ $type: 'Test', name: 'string?' });
    const result = adapter.transform(schema);

    const column = result.tables[0]!.columns.find(c => c.originalName === 'name');
    expect(column?.nullable).toBe(true);
  });

  it('should mark unique fields', () => {
    const schema = parseSchema({ $type: 'Test', email: 'string#' });
    const result = adapter.transform(schema);

    const column = result.tables[0]!.columns.find(c => c.originalName === 'email');
    expect(column?.unique).toBe(true);
  });

  it('should mark required uuid id as primary key', () => {
    const schema = parseSchema({ $type: 'Test', id: 'uuid!' });
    const result = adapter.transform(schema);

    const column = result.tables[0]!.columns.find(c => c.originalName === 'id');
    expect(column?.primaryKey).toBe(true);
  });
});

// =============================================================================
// serialize() Tests
// =============================================================================

describe('DrizzleAdapter.serialize()', () => {
  let adapter: DrizzleAdapter;

  beforeEach(() => {
    adapter = new DrizzleAdapter();
  });

  it('should serialize to valid TypeScript code', () => {
    const schema = createSimpleSchema();
    const drizzleSchema = adapter.transform(schema);
    const code = adapter.serialize(drizzleSchema);

    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
  });

  it('should include import statement', () => {
    const schema = createSimpleSchema();
    const drizzleSchema = adapter.transform(schema, { dialect: 'pg' });
    const code = adapter.serialize(drizzleSchema);

    expect(code).toContain("import {");
    expect(code).toContain("} from 'drizzle-orm/pg-core'");
  });

  it('should include table export', () => {
    const schema = createSimpleSchema();
    const drizzleSchema = adapter.transform(schema);
    const code = adapter.serialize(drizzleSchema);

    expect(code).toContain('export const user =');
  });

  it('should include type exports', () => {
    const schema = createSimpleSchema();
    const drizzleSchema = adapter.transform(schema);
    const code = adapter.serialize(drizzleSchema);

    expect(code).toContain('export type User =');
    expect(code).toContain('export type NewUser =');
    expect(code).toContain('$inferSelect');
    expect(code).toContain('$inferInsert');
  });

  it('should include primary key definition', () => {
    const schema = createSimpleSchema();
    const drizzleSchema = adapter.transform(schema);
    const code = adapter.serialize(drizzleSchema);

    expect(code).toContain('.primaryKey()');
  });

  it('should include notNull definition for required fields', () => {
    const schema = createSimpleSchema();
    const drizzleSchema = adapter.transform(schema);
    const code = adapter.serialize(drizzleSchema);

    expect(code).toContain('.notNull()');
  });

  it('should include unique constraint', () => {
    const schema = createSimpleSchema();
    const drizzleSchema = adapter.transform(schema);
    const code = adapter.serialize(drizzleSchema);

    expect(code).toContain('.unique()');
  });

  it('should generate header comment', () => {
    const schema = createSimpleSchema();
    const drizzleSchema = adapter.transform(schema);
    const code = adapter.serialize(drizzleSchema);

    expect(code).toContain('Drizzle ORM Schema');
    expect(code).toContain('@icetype/drizzle');
  });
});

// =============================================================================
// Convenience Function Tests
// =============================================================================

describe('transformToDrizzle()', () => {
  it('should transform schema to code in one step', () => {
    const schema = createSimpleSchema();
    const code = transformToDrizzle(schema);

    expect(typeof code).toBe('string');
    expect(code).toContain('pgTable');
    expect(code).toContain('export const user');
  });

  it('should accept dialect option', () => {
    const schema = createSimpleSchema();
    const code = transformToDrizzle(schema, { dialect: 'mysql' });

    expect(code).toContain('mysqlTable');
    expect(code).toContain("from 'drizzle-orm/mysql-core'");
  });
});

describe('generateDrizzleSchema()', () => {
  it('should return DrizzleSchema structure', () => {
    const schema = createSimpleSchema();
    const result = generateDrizzleSchema(schema);

    expect(result.dialect).toBe('pg');
    expect(result.tables).toHaveLength(1);
    expect(result.imports).toBeDefined();
  });
});

describe('transformSchemasToDrizzle()', () => {
  it('should transform multiple schemas', () => {
    const schema1 = createSimpleSchema();
    const schema2 = createTypedSchema();
    const code = transformSchemasToDrizzle([schema1, schema2]);

    expect(code).toContain('export const user');
    expect(code).toContain('export const product');
  });

  it('should include all imports from all tables', () => {
    const schema1 = parseSchema({ $type: 'A', id: 'uuid!' });
    const schema2 = parseSchema({ $type: 'B', name: 'string', count: 'int' });
    const code = transformSchemasToDrizzle([schema1, schema2], { dialect: 'pg' });

    expect(code).toContain('uuid');
    expect(code).toContain('varchar');
    expect(code).toContain('integer');
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('DrizzleAdapter Integration', () => {
  let adapter: DrizzleAdapter;

  beforeEach(() => {
    adapter = new DrizzleAdapter();
  });

  it('should produce complete transform and serialize workflow', () => {
    const schema = createTypedSchema();
    const drizzleSchema = adapter.transform(schema, { dialect: 'pg' });
    const code = adapter.serialize(drizzleSchema);

    expect(code).toBeDefined();
    expect(code).toContain('pgTable');
    expect(code).toContain('export const product');
  });

  it('should be compatible with SchemaAdapter interface', () => {
    const genericAdapter = adapter as {
      name: string;
      version: string;
      transform: (schema: IceTypeSchema, options?: unknown) => unknown;
      serialize: (output: unknown) => string;
    };

    expect(genericAdapter.name).toBe('drizzle');
    expect(genericAdapter.version).toBeDefined();
    expect(typeof genericAdapter.transform).toBe('function');
    expect(typeof genericAdapter.serialize).toBe('function');
  });

  it('should handle indexed schema', () => {
    const schema = createIndexedSchema();
    const drizzleSchema = adapter.transform(schema);

    expect(drizzleSchema.tables[0]!.indexes.length).toBeGreaterThan(0);
  });

  it('should generate valid code for all dialects', () => {
    const schema = createSimpleSchema();

    const pgCode = transformToDrizzle(schema, { dialect: 'pg' });
    const mysqlCode = transformToDrizzle(schema, { dialect: 'mysql' });
    const sqliteCode = transformToDrizzle(schema, { dialect: 'sqlite' });

    expect(pgCode).toContain('pgTable');
    expect(mysqlCode).toContain('mysqlTable');
    expect(sqliteCode).toContain('sqliteTable');
  });
});
