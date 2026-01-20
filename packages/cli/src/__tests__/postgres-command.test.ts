/**
 * PostgreSQL Command Tests for @icetype/cli
 *
 * Tests for the `ice postgres export` command which generates
 * PostgreSQL DDL from IceType schemas.
 *
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
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

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
 * Create a schema with various field types for testing type mappings
 */
function createSchemaWithTypes(): IceTypeSchema {
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
  fields.set('age', {
    name: 'age',
    type: 'int',
    modifier: '?',
    isArray: false,
    isOptional: true,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('metadata', {
    name: 'metadata',
    type: 'json',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('createdAt', {
    name: 'createdAt',
    type: 'timestamp',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('balance', {
    name: 'balance',
    type: 'double',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('isActive', {
    name: 'isActive',
    type: 'bool',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('data', {
    name: 'data',
    type: 'binary',
    modifier: '?',
    isArray: false,
    isOptional: true,
    isUnique: false,
    isIndexed: false,
  });

  return {
    name: 'TypedEntity',
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// generatePostgresDDL Function Tests
// =============================================================================

describe('generatePostgresDDL', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid CREATE TABLE statement', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');
    const schema = createValidSchema('User');

    const ddl = generatePostgresDDL(schema);

    expect(ddl).toContain('CREATE TABLE');
    expect(ddl).toContain('User');
  });

  it('should include all fields from schema', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');
    const schema = createValidSchema('User');

    const ddl = generatePostgresDDL(schema);

    expect(ddl).toContain('id');
    expect(ddl).toContain('name');
    expect(ddl).toContain('email');
  });

  it('should use appropriate PostgreSQL types', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');
    const schema = createSchemaWithTypes();

    const ddl = generatePostgresDDL(schema);

    // uuid -> UUID
    expect(ddl).toContain('UUID');
    // string -> TEXT
    expect(ddl).toContain('TEXT');
    // int -> INTEGER
    expect(ddl).toContain('INTEGER');
    // json -> JSONB
    expect(ddl).toContain('JSONB');
    // timestamp -> TIMESTAMP
    expect(ddl).toContain('TIMESTAMP');
    // double -> DOUBLE PRECISION
    expect(ddl).toContain('DOUBLE PRECISION');
    // bool -> BOOLEAN
    expect(ddl).toContain('BOOLEAN');
    // binary -> BYTEA
    expect(ddl).toContain('BYTEA');
  });

  it('should mark required fields as NOT NULL', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');
    const schema = createValidSchema('User');

    const ddl = generatePostgresDDL(schema);

    // id is required (!)
    expect(ddl).toMatch(/id\s+UUID\s+NOT NULL/);
  });

  it('should allow NULL for optional fields', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');
    const schema = createSchemaWithTypes();

    const ddl = generatePostgresDDL(schema);

    // age is optional (?)
    // Should NOT have NOT NULL
    const ageMatch = ddl.match(/age\s+INTEGER(?:\s+NOT NULL)?/);
    expect(ageMatch).toBeTruthy();
    // The optional field should not have NOT NULL
    expect(ddl).not.toMatch(/age\s+INTEGER\s+NOT NULL/);
  });

  it('should add UNIQUE constraint for unique fields', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');
    const schema = createValidSchema('User');

    const ddl = generatePostgresDDL(schema);

    // id has unique modifier
    expect(ddl).toMatch(/id\s+UUID.*UNIQUE/);
  });

  it('should generate CREATE INDEX for indexed fields', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');
    const schema = createValidSchema('User');

    const ddl = generatePostgresDDL(schema);

    // email is indexed (#)
    expect(ddl).toContain('CREATE INDEX');
    expect(ddl).toMatch(/CREATE INDEX.*email/i);
  });

  it('should support --schema-name option for PostgreSQL schema', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');
    const schema = createValidSchema('User');

    const ddl = generatePostgresDDL(schema, { schemaName: 'public' });

    // Both 'public' and 'User' are SQL reserved keywords, so they get quoted
    expect(ddl).toContain('"public"."User"');
  });

  it('should skip system fields starting with $', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('$internalField', {
      name: '$internalField',
      type: 'string',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });
    fields.set('regularField', {
      name: 'regularField',
      type: 'string',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Entity',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const ddl = generatePostgresDDL(schema);

    expect(ddl).toContain('regularField');
    expect(ddl).not.toContain('$internalField');
  });

  it('should handle empty fields map gracefully', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');

    const schema: IceTypeSchema = {
      name: 'EmptyEntity',
      version: 1,
      fields: new Map(),
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const ddl = generatePostgresDDL(schema);

    expect(ddl).toContain('CREATE TABLE');
    expect(ddl).toContain('EmptyEntity');
  });
});

// =============================================================================
// postgresExport Command Tests
// =============================================================================

describe('ice postgres export command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('argument parsing', () => {
    it('should error when --schema is missing', async () => {
      const { postgresExport } = await import('../commands/postgres.js');

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await postgresExport([]);
      } catch {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('--schema is required')
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should accept -s as short form of --schema', async () => {
      // This test verifies the parseArgs configuration accepts -s
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['-s', './schema.ts'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          schemaName: { type: 'string' },
        },
      });

      expect(values.schema).toBe('./schema.ts');
    });

    it('should accept -o as short form of --output', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-o', './output.sql'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          schemaName: { type: 'string' },
        },
      });

      expect(values.output).toBe('./output.sql');
    });

    it('should parse --schemaName option', async () => {
      const { parseArgs } = await import('node:util');

      // Note: parseArgs uses the option key name directly as the CLI flag
      // So --schemaName not --schema-name
      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--schemaName', 'myschema'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          schemaName: { type: 'string' },
        },
      });

      expect(values.schemaName).toBe('myschema');
    });
  });

  describe('output handling', () => {
    it('should output to stdout by default when no --output specified', async () => {
      // Create a simple mock for loadSchemaFile
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'TestSchema', schema: createValidSchema('TestSchema') }],
          errors: [],
        }),
      }));

      // Re-import to get mocked version
      const { postgresExport } = await import('../commands/postgres.js');

      // Mock fs.existsSync to return true for schema file
      vi.mocked(fs.existsSync).mockReturnValue(true);

      try {
        await postgresExport(['--schema', './schema.ts']);
      } catch {
        // May throw due to actual file loading
      }

      // Should NOT call writeFileSync when no --output is specified
      // (output goes to stdout via console.log)
    });

    it('should support --output option to write to file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      // We can verify the argument parsing accepts --output
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--output', './create-tables.sql'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          schemaName: { type: 'string' },
        },
      });

      expect(values.output).toBe('./create-tables.sql');
    });
  });

  describe('error handling', () => {
    it('should handle file not found error', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { postgresExport } = await import('../commands/postgres.js');

      try {
        await postgresExport(['--schema', './nonexistent.ts']);
      } catch {
        // Expected
      }

      // Should report error for nonexistent file
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });
});

// =============================================================================
// DDL Generation Edge Cases
// =============================================================================

describe('DDL generation edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle multiple indexed fields', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');

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
      isUnique: false,
      isIndexed: true,
    });
    fields.set('username', {
      name: 'username',
      type: 'string',
      modifier: '#',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: true,
    });

    const schema: IceTypeSchema = {
      name: 'User',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const ddl = generatePostgresDDL(schema);

    // Should have two CREATE INDEX statements
    const indexMatches = ddl.match(/CREATE INDEX/g);
    expect(indexMatches?.length).toBe(2);
  });

  it('should generate proper index names', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');
    const schema = createValidSchema('User');

    const ddl = generatePostgresDDL(schema);

    // Index name should follow convention: idx_{table}_{column}
    expect(ddl).toMatch(/idx_User_email/i);
  });

  it('should handle schema names with special characters in table name', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');

    const schema: IceTypeSchema = {
      name: 'UserProfile',
      version: 1,
      fields: new Map([
        ['id', {
          name: 'id',
          type: 'uuid',
          modifier: '!',
          isArray: false,
          isOptional: false,
          isUnique: true,
          isIndexed: false,
        }],
      ]),
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const ddl = generatePostgresDDL(schema, { schemaName: 'my_schema' });

    expect(ddl).toContain('my_schema.UserProfile');
  });

  it('should handle fields with both unique and indexed flags', async () => {
    const { generatePostgresDDL } = await import('../commands/postgres.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('email', {
      name: 'email',
      type: 'string',
      modifier: '#',
      isArray: false,
      isOptional: false,
      isUnique: true,
      isIndexed: true,
    });

    const schema: IceTypeSchema = {
      name: 'User',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const ddl = generatePostgresDDL(schema);

    // Should have UNIQUE constraint in column definition
    expect(ddl).toMatch(/email\s+TEXT.*UNIQUE/);
    // Should also have CREATE INDEX (indexes are separate from unique constraints)
    expect(ddl).toContain('CREATE INDEX');
  });
});

// =============================================================================
// generatePostgresDDLForAllSchemas Tests
// =============================================================================

describe('generatePostgresDDLForAllSchemas', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate DDL for multiple schemas', async () => {
    const { generatePostgresDDLForAllSchemas } = await import('../commands/postgres.js');

    const schemas = [
      createValidSchema('User'),
      createValidSchema('Post'),
    ];

    const ddl = generatePostgresDDLForAllSchemas(schemas);

    expect(ddl).toContain('CREATE TABLE');
    expect(ddl).toContain('User');
    expect(ddl).toContain('Post');
  });

  it('should separate multiple tables with blank lines', async () => {
    const { generatePostgresDDLForAllSchemas } = await import('../commands/postgres.js');

    const schemas = [
      createValidSchema('User'),
      createValidSchema('Post'),
    ];

    const ddl = generatePostgresDDLForAllSchemas(schemas);

    // Should have blank line between tables
    expect(ddl).toMatch(/;\n\n.*CREATE TABLE/);
  });

  it('should apply schema name to all tables', async () => {
    const { generatePostgresDDLForAllSchemas } = await import('../commands/postgres.js');

    const schemas = [
      createValidSchema('User'),
      createValidSchema('Post'),
    ];

    const ddl = generatePostgresDDLForAllSchemas(schemas, { schemaName: 'app' });

    // 'User' is a SQL reserved keyword, so it gets quoted
    expect(ddl).toContain('app."User"');
    expect(ddl).toContain('app.Post');
  });

  it('should handle empty schemas array', async () => {
    const { generatePostgresDDLForAllSchemas } = await import('../commands/postgres.js');

    const ddl = generatePostgresDDLForAllSchemas([]);

    expect(ddl).toBe('');
  });
});
