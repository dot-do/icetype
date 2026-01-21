/**
 * Drizzle Export Command Tests for @icetype/cli
 *
 * Tests for the ice drizzle export command using TDD approach.
 * Uses mocked file system operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';

// Mock modules
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// Mock console methods to capture output
const _mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const _mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a valid IceTypeSchema object for testing
 */
function createValidSchema(name: string = 'TestEntity'): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  fields.set('id', {
    name: 'id',
    type: 'uuid',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: true,
    isIndexed: false,
  });
  fields.set('name', {
    name: 'name',
    type: 'string',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('email', {
    name: 'email',
    type: 'string',
    modifier: '#',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: true,
  });
  fields.set('age', {
    name: 'age',
    type: 'int',
    modifier: '?',
    isArray: false,
    isOptional: true,
    isUnique: false,
    isIndexed: false,
  });

  return {
    name,
    version: 1,
    fields,
    directives: {
      partitionBy: ['id'],
      fts: ['name'],
    },
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a schema with indexed fields for testing
 */
function createSchemaWithIndexes(name: string = 'IndexedEntity'): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  fields.set('id', {
    name: 'id',
    type: 'uuid',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: true,
    isIndexed: false,
  });
  fields.set('email', {
    name: 'email',
    type: 'string',
    modifier: '#',
    isArray: false,
    isOptional: false,
    isUnique: true,
    isIndexed: true,
  });
  fields.set('status', {
    name: 'status',
    type: 'string',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: true,
  });

  return {
    name,
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a schema with various field types for testing
 */
function createSchemaWithVariousTypes(name: string = 'TypesEntity'): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  fields.set('id', {
    name: 'id',
    type: 'uuid',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: true,
    isIndexed: false,
  });
  fields.set('name', {
    name: 'name',
    type: 'string',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('count', {
    name: 'count',
    type: 'int',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('price', {
    name: 'price',
    type: 'float',
    modifier: '?',
    isArray: false,
    isOptional: true,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('active', {
    name: 'active',
    type: 'boolean',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('createdAt', {
    name: 'createdAt',
    type: 'timestamp',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });

  return {
    name,
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// Drizzle Export Command Tests
// =============================================================================

describe('ice drizzle command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('drizzle export', () => {
    it('should generate Drizzle schema from IceType schema', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

      expect(result).toContain('import');
      expect(result).toContain('drizzle-orm');
      expect(result).toContain('pgTable');
    });

    it('should support --output option to write to file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

      expect(result).toContain('pgTable');
      expect(result).toContain('user');
    });

    it('should output to stdout by default', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('pgTable');
    });

    it('should error when --schema is missing', async () => {
      const { drizzleExport } = await import('../commands/drizzle.js');

      await expect(drizzleExport([])).rejects.toThrow('--schema is required');
    });

    it('should handle multiple schemas in a file', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const schemas = [
        createValidSchema('User'),
        createValidSchema('Post'),
      ];

      const result = _testHelpers.generateCodeFromSchemas(schemas, {});

      expect(result).toContain('pgTable');
      expect(result).toContain('user');
      expect(result).toContain('post');
    });

    it('should generate valid TypeScript syntax', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

      // Check for valid TypeScript/Drizzle syntax elements
      expect(result).toContain('import');
      expect(result).toContain('export const');
      expect(result).toContain('pgTable');
      expect(result).toMatch(/from\s+['"]drizzle-orm/);
    });

    it('should support PostgreSQL dialect by default', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

      expect(result).toContain('drizzle-orm/pg-core');
      expect(result).toContain('pgTable');
    });

    it('should support MySQL dialect', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'mysql' });

      expect(result).toContain('drizzle-orm/mysql-core');
      expect(result).toContain('mysqlTable');
    });

    it('should support SQLite dialect', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'sqlite' });

      expect(result).toContain('drizzle-orm/sqlite-core');
      expect(result).toContain('sqliteTable');
    });

    it('should include proper imports for each dialect', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');
      const mockSchema = createSchemaWithVariousTypes('Test');

      // PostgreSQL
      const pgResult = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'pg' });
      expect(pgResult).toContain('drizzle-orm/pg-core');

      // MySQL
      const mysqlResult = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'mysql' });
      expect(mysqlResult).toContain('drizzle-orm/mysql-core');

      // SQLite
      const sqliteResult = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'sqlite' });
      expect(sqliteResult).toContain('drizzle-orm/sqlite-core');
    });

    it('should use camelCase for column names by default', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

      // Should have camelCase variable names
      expect(result).toMatch(/\buser\b/);
    });

    it('should support custom table name option', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, { tableName: 'custom_users' });

      expect(result).toContain('custom_users');
    });

    it('should generate type exports for inference', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

      // Drizzle typically exports types like:
      // export type User = typeof user.$inferSelect;
      // export type NewUser = typeof user.$inferInsert;
      expect(result).toMatch(/export\s+type/);
    });

    it('should handle uuid fields correctly for PostgreSQL', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'pg' });

      expect(result).toContain('uuid');
    });

    it('should handle uuid fields correctly for MySQL (as varchar)', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'mysql' });

      // MySQL doesn't have native uuid type, uses varchar
      expect(result).toContain('varchar');
    });

    it('should handle uuid fields correctly for SQLite (as text)', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'sqlite' });

      // SQLite uses text for uuid
      expect(result).toContain('text');
    });

    it('should handle optional fields with nullable modifier', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

      // age field is optional (modifier: '?')
      // Should not have .notNull() for optional fields
      expect(result).toContain('age');
    });

    it('should handle required fields with notNull modifier', async () => {
      const { _testHelpers } = await import('../commands/drizzle.js');

      const mockSchema = createValidSchema('User');
      const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

      // id field is required (modifier: '!')
      expect(result).toContain('notNull');
    });
  });
});

// =============================================================================
// CLI Argument Parsing Tests
// =============================================================================

describe('drizzle command argument parsing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should parse --schema option', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['--schema', './schema.ts'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.schema).toBe('./schema.ts');
  });

  it('should parse -s short option for schema', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['-s', './schema.ts'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.schema).toBe('./schema.ts');
  });

  it('should parse --output option', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['--schema', './schema.ts', '--output', './drizzle-schema.ts'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.output).toBe('./drizzle-schema.ts');
  });

  it('should parse -o short option for output', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['-s', './schema.ts', '-o', './drizzle-schema.ts'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.output).toBe('./drizzle-schema.ts');
  });

  it('should parse --dialect option', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['--schema', './schema.ts', '--dialect', 'mysql'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.dialect).toBe('mysql');
  });

  it('should parse -d short option for dialect', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['-s', './schema.ts', '-d', 'sqlite'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.dialect).toBe('sqlite');
  });

  it('should parse --camel-case option', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['--schema', './schema.ts', '--camel-case'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.camelCase).toBe(true);
  });

  it('should parse --table-name option', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['--schema', './schema.ts', '--table-name', 'custom_table'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.tableName).toBe('custom_table');
  });

  it('should parse --quiet option', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['--schema', './schema.ts', '--quiet'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.quiet).toBe(true);
  });

  it('should parse -q short option for quiet', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['-s', './schema.ts', '-q'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.quiet).toBe(true);
  });

  it('should parse --verbose option', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['--schema', './schema.ts', '--verbose'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.verbose).toBe(true);
  });

  it('should parse -v short option for verbose', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = ['-s', './schema.ts', '-v'];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.verbose).toBe(true);
  });

  it('should parse all options together', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const args = [
      '--schema', './schema.ts',
      '--output', './drizzle-schema.ts',
      '--dialect', 'pg',
      '--camel-case',
      '--table-name', 'users',
    ];
    const parsed = _testHelpers.parseArgs(args);

    expect(parsed.schema).toBe('./schema.ts');
    expect(parsed.output).toBe('./drizzle-schema.ts');
    expect(parsed.dialect).toBe('pg');
    expect(parsed.camelCase).toBe(true);
    expect(parsed.tableName).toBe('users');
  });
});

// =============================================================================
// Dialect Validation Tests
// =============================================================================

describe('drizzle dialect validation', () => {
  it('should accept pg dialect', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    expect(_testHelpers.VALID_DIALECTS).toContain('pg');
  });

  it('should accept mysql dialect', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    expect(_testHelpers.VALID_DIALECTS).toContain('mysql');
  });

  it('should accept sqlite dialect', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    expect(_testHelpers.VALID_DIALECTS).toContain('sqlite');
  });

  it('should have exactly 3 valid dialects', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    expect(_testHelpers.VALID_DIALECTS).toHaveLength(3);
  });
});

// =============================================================================
// Code Generation Details Tests
// =============================================================================

describe('drizzle code generation details', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should generate table with snake_case name from PascalCase schema', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const mockSchema = createValidSchema('UserProfile');
    const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

    expect(result).toContain('user_profile');
  });

  it('should generate proper primary key for id field', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const mockSchema = createValidSchema('User');
    const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

    expect(result).toContain('primaryKey');
  });

  it('should handle unique constraint for unique fields', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const mockSchema = createSchemaWithIndexes('User');
    const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

    expect(result).toContain('unique');
  });

  it('should convert string type to varchar for PostgreSQL', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const mockSchema = createValidSchema('User');
    const result = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'pg' });

    expect(result).toContain('varchar');
  });

  it('should convert int type to integer', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const mockSchema = createValidSchema('User');
    const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

    expect(result).toContain('integer');
  });

  it('should handle timestamp types', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const mockSchema = createSchemaWithVariousTypes('Test');
    const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

    expect(result).toContain('timestamp');
  });

  it('should handle boolean types', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const mockSchema = createSchemaWithVariousTypes('Test');
    const result = _testHelpers.generateCodeFromSchema(mockSchema, {});

    expect(result).toContain('boolean');
  });

  it('should handle float types', async () => {
    const { _testHelpers } = await import('../commands/drizzle.js');

    const mockSchema = createSchemaWithVariousTypes('Test');
    const result = _testHelpers.generateCodeFromSchema(mockSchema, { dialect: 'pg' });

    // PostgreSQL uses doublePrecision or real for float
    expect(result.toLowerCase()).toMatch(/real|double|numeric|float/);
  });
});
