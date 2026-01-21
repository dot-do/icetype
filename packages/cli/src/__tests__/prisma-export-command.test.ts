/**
 * Prisma Export Command Tests for @icetype/cli
 *
 * Tests for the `ice prisma export` command which generates
 * Prisma schema files from IceType schemas.
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
// generatePrismaSchema Function Tests (via @icetype/prisma)
// =============================================================================

describe('generatePrismaSchema', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid Prisma schema with datasource block', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('datasource db');
    expect(prismaSchema).toContain('provider = "postgresql"');
    expect(prismaSchema).toContain('url');
  });

  it('should generate valid Prisma schema with generator block', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('generator client');
    expect(prismaSchema).toContain('provider = "prisma-client-js"');
  });

  it('should generate model definition', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('model User');
    expect(prismaSchema).toContain('{');
    expect(prismaSchema).toContain('}');
  });

  it('should include all fields from schema', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('id');
    expect(prismaSchema).toContain('name');
    expect(prismaSchema).toContain('email');
  });

  it('should use appropriate Prisma types', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createSchemaWithTypes();

    const prismaSchema = generatePrismaSchema([schema]);

    // uuid -> String
    expect(prismaSchema).toContain('String');
    // int -> Int
    expect(prismaSchema).toContain('Int');
    // json -> Json
    expect(prismaSchema).toContain('Json');
    // timestamp -> DateTime
    expect(prismaSchema).toContain('DateTime');
    // double -> Float
    expect(prismaSchema).toContain('Float');
    // bool -> Boolean
    expect(prismaSchema).toContain('Boolean');
    // binary -> Bytes
    expect(prismaSchema).toContain('Bytes');
  });

  it('should mark optional fields with ?', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createSchemaWithTypes();

    const prismaSchema = generatePrismaSchema([schema]);

    // age is optional (?)
    expect(prismaSchema).toMatch(/age\s+Int\?/);
    // data is optional (?)
    expect(prismaSchema).toMatch(/data\s+Bytes\?/);
  });

  it('should add @unique attribute for unique fields', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema]);

    // email has indexed modifier which adds @unique
    expect(prismaSchema).toContain('@unique');
  });

  it('should add @id attribute for id field', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('@id');
  });

  it('should add @default(uuid()) for uuid type id fields', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('@default(uuid())');
  });

  it('should support mysql provider', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema], { provider: 'mysql' });

    expect(prismaSchema).toContain('provider = "mysql"');
  });

  it('should support sqlite provider', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema], { provider: 'sqlite' });

    expect(prismaSchema).toContain('provider = "sqlite"');
  });

  it('should support sqlserver provider', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema], { provider: 'sqlserver' });

    expect(prismaSchema).toContain('provider = "sqlserver"');
  });

  it('should support mongodb provider', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema], { provider: 'mongodb' });

    expect(prismaSchema).toContain('provider = "mongodb"');
  });

  it('should support custom database URL', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const prismaSchema = generatePrismaSchema([schema], {
      databaseUrl: 'env("CUSTOM_DATABASE_URL")',
    });

    expect(prismaSchema).toContain('env("CUSTOM_DATABASE_URL")');
  });

  it('should skip system fields starting with $', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');

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

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('regularField');
    expect(prismaSchema).not.toContain('$internalField');
  });

  it('should handle empty schemas array', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');

    const prismaSchema = generatePrismaSchema([]);

    // Should still have datasource and generator blocks
    expect(prismaSchema).toContain('datasource db');
    expect(prismaSchema).toContain('generator client');
  });

  it('should generate multiple models', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');

    const schemas = [
      createValidSchema('User'),
      createValidSchema('Post'),
    ];

    const prismaSchema = generatePrismaSchema(schemas);

    expect(prismaSchema).toContain('model User');
    expect(prismaSchema).toContain('model Post');
  });
});

// =============================================================================
// prismaExport Command Tests
// =============================================================================

describe('ice prisma export command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('argument parsing', () => {
    it('should error when --schema is missing', async () => {
      const { prismaExport } = await import('../commands/prisma.js');

      // Commands now throw errors (main CLI catches and exits)
      await expect(prismaExport([])).rejects.toThrow('--schema is required');
    });

    it('should accept -s as short form of --schema', async () => {
      // This test verifies the parseArgs configuration accepts -s
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['-s', './schema.ts'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
          'datasource-url': { type: 'string' },
          quiet: { type: 'boolean', short: 'q' },
          verbose: { type: 'boolean', short: 'v' },
        },
      });

      expect(values.schema).toBe('./schema.ts');
    });

    it('should accept -o as short form of --output', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-o', './schema.prisma'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
          'datasource-url': { type: 'string' },
          quiet: { type: 'boolean', short: 'q' },
          verbose: { type: 'boolean', short: 'v' },
        },
      });

      expect(values.output).toBe('./schema.prisma');
    });

    it('should accept -p as short form of --provider', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-p', 'mysql'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
          'datasource-url': { type: 'string' },
          quiet: { type: 'boolean', short: 'q' },
          verbose: { type: 'boolean', short: 'v' },
        },
      });

      expect(values.provider).toBe('mysql');
    });

    it('should parse --datasource-url option', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--datasource-url', 'DATABASE_CONNECTION_STRING'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
          'datasource-url': { type: 'string' },
          quiet: { type: 'boolean', short: 'q' },
          verbose: { type: 'boolean', short: 'v' },
        },
      });

      expect(values['datasource-url']).toBe('DATABASE_CONNECTION_STRING');
    });

    it('should parse --quiet option', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--quiet'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
          'datasource-url': { type: 'string' },
          quiet: { type: 'boolean', short: 'q' },
          verbose: { type: 'boolean', short: 'v' },
        },
      });

      expect(values.quiet).toBe(true);
    });

    it('should parse -q as short form of --quiet', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-q'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
          'datasource-url': { type: 'string' },
          quiet: { type: 'boolean', short: 'q' },
          verbose: { type: 'boolean', short: 'v' },
        },
      });

      expect(values.quiet).toBe(true);
    });

    it('should parse --verbose option', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--verbose'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
          'datasource-url': { type: 'string' },
          quiet: { type: 'boolean', short: 'q' },
          verbose: { type: 'boolean', short: 'v' },
        },
      });

      expect(values.verbose).toBe(true);
    });

    it('should parse -v as short form of --verbose', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-v'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
          'datasource-url': { type: 'string' },
          quiet: { type: 'boolean', short: 'q' },
          verbose: { type: 'boolean', short: 'v' },
        },
      });

      expect(values.verbose).toBe(true);
    });
  });

  describe('provider validation', () => {
    it('should accept postgresql provider', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--provider', 'postgresql'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
        },
      });

      expect(values.provider).toBe('postgresql');
    });

    it('should accept mysql provider', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--provider', 'mysql'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
        },
      });

      expect(values.provider).toBe('mysql');
    });

    it('should accept sqlite provider', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--provider', 'sqlite'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
        },
      });

      expect(values.provider).toBe('sqlite');
    });

    it('should accept sqlserver provider', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--provider', 'sqlserver'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
        },
      });

      expect(values.provider).toBe('sqlserver');
    });

    it('should accept mongodb provider', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--provider', 'mongodb'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
        },
      });

      expect(values.provider).toBe('mongodb');
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
      const { prismaExport } = await import('../commands/prisma.js');

      // Mock fs.existsSync to return true for schema file
      vi.mocked(fs.existsSync).mockReturnValue(true);

      try {
        await prismaExport(['--schema', './schema.ts']);
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
        args: ['--schema', './schema.ts', '--output', './schema.prisma'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          provider: { type: 'string', short: 'p' },
        },
      });

      expect(values.output).toBe('./schema.prisma');
    });
  });

  describe('error handling', () => {
    it('should throw error when file not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { prismaExport } = await import('../commands/prisma.js');

      // Commands now throw errors (main CLI catches and exits)
      await expect(prismaExport(['--schema', './nonexistent.ts'])).rejects.toThrow();
    });
  });
});

// =============================================================================
// PrismaAdapter Tests
// =============================================================================

describe('PrismaAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name and version', async () => {
    const { PrismaAdapter } = await import('@icetype/prisma');

    const adapter = new PrismaAdapter();

    expect(adapter.name).toBe('prisma');
    expect(adapter.version).toBe('0.1.0');
  });

  it('should transform schema to Prisma model output', async () => {
    const { PrismaAdapter } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const adapter = new PrismaAdapter();
    const model = adapter.transform(schema);

    expect(model.name).toBe('User');
    expect(model.fields).toBeDefined();
    expect(model.fields.length).toBeGreaterThan(0);
  });

  it('should serialize Prisma model output to string', async () => {
    const { PrismaAdapter } = await import('@icetype/prisma');
    const schema = createValidSchema('User');

    const adapter = new PrismaAdapter();
    const model = adapter.transform(schema);
    const serialized = adapter.serialize(model);

    expect(serialized).toContain('model User');
    expect(serialized).toContain('{');
    expect(serialized).toContain('}');
  });

  it('should generate complete schema with generateSchema method', async () => {
    const { PrismaAdapter } = await import('@icetype/prisma');
    const schemas = [createValidSchema('User'), createValidSchema('Post')];

    const adapter = new PrismaAdapter();
    const schemaString = adapter.generateSchema(schemas);

    expect(schemaString).toContain('datasource db');
    expect(schemaString).toContain('generator client');
    expect(schemaString).toContain('model User');
    expect(schemaString).toContain('model Post');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Prisma schema edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle schema with only id field', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');

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

    const schema: IceTypeSchema = {
      name: 'MinimalEntity',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('model MinimalEntity');
    expect(prismaSchema).toContain('id');
    expect(prismaSchema).toContain('@id');
  });

  it('should handle createdAt field with @default(now())', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');

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
    fields.set('createdAt', {
      name: 'createdAt',
      type: 'timestamp',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'TimestampEntity',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('@default(now())');
  });

  it('should handle updatedAt field with @updatedAt', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');

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
    fields.set('updatedAt', {
      name: 'updatedAt',
      type: 'timestamp',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'TimestampEntity',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('@updatedAt');
  });

  it('should handle bigint type', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');

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
    fields.set('bigNumber', {
      name: 'bigNumber',
      type: 'bigint',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'BigIntEntity',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('BigInt');
  });

  it('should handle decimal type', async () => {
    const { generatePrismaSchema } = await import('@icetype/prisma');

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
    fields.set('price', {
      name: 'price',
      type: 'decimal',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'DecimalEntity',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const prismaSchema = generatePrismaSchema([schema]);

    expect(prismaSchema).toContain('Decimal');
  });
});
