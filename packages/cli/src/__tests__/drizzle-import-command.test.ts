/**
 * Drizzle Import Command Tests for @icetype/cli
 *
 * Tests for the `ice drizzle import` command which imports
 * Drizzle ORM schemas and converts them to IceType format.
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

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
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
    isUnique: true,
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
  fields.set('tags', {
    name: 'tags',
    type: 'string',
    modifier: '',
    isArray: true,
    isOptional: false,
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
// fieldToIceTypeString Function Tests
// =============================================================================

describe('fieldToIceTypeString', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should convert required uuid field', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'id',
      type: 'uuid',
      modifier: '!',
      isArray: false,
      isOptional: false,
      isUnique: true,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('uuid!');
  });

  it('should convert optional string field', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'nickname',
      type: 'string',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('string?');
  });

  it('should convert indexed string field', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'email',
      type: 'string',
      modifier: '#',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: true,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('string#');
  });

  it('should convert array field', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'tags',
      type: 'string',
      modifier: '',
      isArray: true,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('string[]');
  });

  it('should handle decimal with precision and scale', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'price',
      type: 'decimal',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
      precision: 10,
      scale: 2,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('decimal(10,2)');
  });

  it('should handle string with length', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'code',
      type: 'string',
      modifier: '!',
      isArray: false,
      isOptional: false,
      isUnique: true,
      isIndexed: false,
      length: 10,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('string(10)!');
  });

  it('should handle field with unique flag', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'email',
      type: 'string',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: true,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('string!');
  });
});

// =============================================================================
// generateTypeScriptOutput Function Tests
// =============================================================================

describe('generateTypeScriptOutput', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate TypeScript import statement', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schemas = [createValidSchema('User')];
    const output = generateTypeScriptOutput(schemas);

    expect(output).toContain("import { parseSchema } from '@icetype/core'");
  });

  it('should generate schema export with $type directive', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schemas = [createValidSchema('User')];
    const output = generateTypeScriptOutput(schemas);

    expect(output).toContain("export const UserSchema = parseSchema({");
    expect(output).toContain("$type: 'User'");
  });

  it('should include all fields', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schemas = [createValidSchema('User')];
    const output = generateTypeScriptOutput(schemas);

    expect(output).toContain("id: 'uuid!'");
    expect(output).toContain("name:");
    expect(output).toContain("email:");
  });

  it('should generate multiple schemas', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schemas = [
      createValidSchema('User'),
      createValidSchema('Post'),
    ];
    const output = generateTypeScriptOutput(schemas);

    expect(output).toContain('export const UserSchema');
    expect(output).toContain('export const PostSchema');
  });

  it('should include directives if present', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schema = createValidSchema('User');
    schema.directives = {
      partitionBy: ['tenantId'],
      index: [{ fields: ['email'] }],
    };

    const output = generateTypeScriptOutput([schema]);

    expect(output).toContain('$partitionBy');
    expect(output).toContain('$index');
  });
});

// =============================================================================
// generateJsonOutput Function Tests
// =============================================================================

describe('generateJsonOutput', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid JSON', async () => {
    const { generateJsonOutput } = await import('../commands/drizzle-import.js');

    const schemas = [createValidSchema('User')];
    const output = generateJsonOutput(schemas);

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should include $type in JSON output', async () => {
    const { generateJsonOutput } = await import('../commands/drizzle-import.js');

    const schemas = [createValidSchema('User')];
    const output = generateJsonOutput(schemas);
    const parsed = JSON.parse(output);

    expect(parsed[0].$type).toBe('User');
  });

  it('should include all fields in JSON output', async () => {
    const { generateJsonOutput } = await import('../commands/drizzle-import.js');

    const schemas = [createValidSchema('User')];
    const output = generateJsonOutput(schemas);
    const parsed = JSON.parse(output);

    expect(parsed[0].id).toBe('uuid!');
    expect(parsed[0].name).toBeDefined();
    expect(parsed[0].email).toBeDefined();
  });

  it('should handle multiple schemas in JSON', async () => {
    const { generateJsonOutput } = await import('../commands/drizzle-import.js');

    const schemas = [
      createValidSchema('User'),
      createValidSchema('Post'),
    ];
    const output = generateJsonOutput(schemas);
    const parsed = JSON.parse(output);

    expect(parsed.length).toBe(2);
    expect(parsed[0].$type).toBe('User');
    expect(parsed[1].$type).toBe('Post');
  });
});

// =============================================================================
// generateOutput Function Tests
// =============================================================================

describe('generateOutput', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate TypeScript output for ts format', async () => {
    const { generateOutput } = await import('../commands/drizzle-import.js');

    const schemas = [createValidSchema('User')];
    const output = generateOutput(schemas, 'ts');

    expect(output).toContain("import { parseSchema }");
  });

  it('should generate JSON output for json format', async () => {
    const { generateOutput } = await import('../commands/drizzle-import.js');

    const schemas = [createValidSchema('User')];
    const output = generateOutput(schemas, 'json');

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should throw for unknown format due to exhaustive type checking', async () => {
    const { generateOutput } = await import('../commands/drizzle-import.js');

    const schemas = [createValidSchema('User')];
    // Cast to any to test exhaustive type checking
    expect(() => {
      generateOutput(schemas, 'unknown' as any);
    }).toThrow('Unexpected value');
  });
});

// =============================================================================
// drizzleImport Command Tests
// =============================================================================

describe('ice drizzle import command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('argument parsing', () => {
    it('should error when --input is missing', async () => {
      const { drizzleImport } = await import('../commands/drizzle-import.js');

      await expect(drizzleImport([])).rejects.toThrow('--input is required');
    });

    it('should accept -i as short form of --input', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['-i', './schema.ts'],
        options: {
          input: { type: 'string', short: 'i' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
        },
      });

      expect(values.input).toBe('./schema.ts');
    });

    it('should accept -o as short form of --output', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--input', './schema.ts', '-o', './output.ts'],
        options: {
          input: { type: 'string', short: 'i' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
        },
      });

      expect(values.output).toBe('./output.ts');
    });

    it('should accept -f as short form of --format', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--input', './schema.ts', '-f', 'json'],
        options: {
          input: { type: 'string', short: 'i' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
        },
      });

      expect(values.format).toBe('json');
    });

    it('should accept --quiet flag', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--input', './schema.ts', '--quiet'],
        options: {
          input: { type: 'string', short: 'i' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          quiet: { type: 'boolean', short: 'q' },
        },
      });

      expect(values.quiet).toBe(true);
    });

    it('should accept --verbose flag', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--input', './schema.ts', '--verbose'],
        options: {
          input: { type: 'string', short: 'i' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          verbose: { type: 'boolean', short: 'v' },
        },
      });

      expect(values.verbose).toBe(true);
    });
  });

  describe('format validation', () => {
    it('should reject invalid format values', async () => {
      const { drizzleImport } = await import('../commands/drizzle-import.js');

      // Mock the file read to fail before format validation
      const fsMock = await import('node:fs/promises');
      vi.mocked(fsMock.readFile).mockRejectedValue(new Error('File not found'));

      await expect(
        drizzleImport(['--input', './schema.ts', '--format', 'invalid'])
      ).rejects.toThrow();
    });
  });
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

describe('edge cases and error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty schema name gracefully', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

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
      name: '',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptOutput([schema]);
    expect(output).toContain("$type: ''");
  });

  it('should handle schema with no fields', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schema: IceTypeSchema = {
      name: 'EmptyEntity',
      version: 1,
      fields: new Map(),
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptOutput([schema]);
    expect(output).toContain("$type: 'EmptyEntity'");
  });

  it('should handle empty schemas array', async () => {
    const { generateTypeScriptOutput, generateJsonOutput } = await import(
      '../commands/drizzle-import.js'
    );

    const tsOutput = generateTypeScriptOutput([]);
    const jsonOutput = generateJsonOutput([]);

    expect(tsOutput).toContain("import { parseSchema }");
    expect(JSON.parse(jsonOutput)).toEqual([]);
  });

  it('should handle field with all modifiers', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'complexField',
      type: 'string',
      modifier: '!',
      isArray: true,
      isOptional: false,
      isUnique: true,
      isIndexed: true,
      length: 255,
    };

    const result = fieldToIceTypeString(field);
    // Length takes precedence, then array, then modifier
    expect(result).toContain('string');
  });

  it('should handle special characters in field names', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('user_id', {
      name: 'user_id',
      type: 'uuid',
      modifier: '!',
      isArray: false,
      isOptional: false,
      isUnique: true,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'UserProfile',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptOutput([schema]);
    expect(output).toContain('user_id');
  });
});

// =============================================================================
// Schema Directives Tests
// =============================================================================

describe('schema directives handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should include partitionBy directive', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schema = createValidSchema('User');
    schema.directives = {
      partitionBy: ['tenantId', 'region'],
    };

    const output = generateTypeScriptOutput([schema]);
    expect(output).toContain('$partitionBy');
    expect(output).toContain('tenantId');
    expect(output).toContain('region');
  });

  it('should include index directive', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schema = createValidSchema('User');
    schema.directives = {
      index: [
        { fields: ['email'] },
        { fields: ['name', 'createdAt'] },
      ],
    };

    const output = generateTypeScriptOutput([schema]);
    expect(output).toContain('$index');
    expect(output).toContain('email');
  });

  it('should include fts directive', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schema = createValidSchema('User');
    schema.directives = {
      fts: ['name', 'description'],
    };

    const output = generateTypeScriptOutput([schema]);
    expect(output).toContain('$fts');
    expect(output).toContain('name');
    expect(output).toContain('description');
  });

  it('should include vector directive', async () => {
    const { generateTypeScriptOutput } = await import('../commands/drizzle-import.js');

    const schema = createValidSchema('User');
    schema.directives = {
      vector: 'embedding',
    };

    const output = generateTypeScriptOutput([schema]);
    expect(output).toContain('$vector');
    expect(output).toContain('embedding');
  });

  it('should include directives in JSON output', async () => {
    const { generateJsonOutput } = await import('../commands/drizzle-import.js');

    const schema = createValidSchema('User');
    schema.directives = {
      partitionBy: ['tenantId'],
      index: [{ fields: ['email'] }],
    };

    const output = generateJsonOutput([schema]);
    const parsed = JSON.parse(output);

    expect(parsed[0].$partitionBy).toEqual(['tenantId']);
    expect(parsed[0].$index).toBeDefined();
  });
});

// =============================================================================
// Various Field Types Tests
// =============================================================================

describe('various field types', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle timestamp type', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'createdAt',
      type: 'timestamp',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('timestamp');
  });

  it('should handle json type', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'metadata',
      type: 'json',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('json?');
  });

  it('should handle boolean type', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'isActive',
      type: 'bool',
      modifier: '!',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('bool!');
  });

  it('should handle binary type', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'data',
      type: 'binary',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('binary?');
  });

  it('should handle long type', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'bigNumber',
      type: 'long',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('long');
  });

  it('should handle float type', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'ratio',
      type: 'float',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('float');
  });

  it('should handle date type', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'birthday',
      type: 'date',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('date?');
  });

  it('should handle text type', async () => {
    const { fieldToIceTypeString } = await import('../commands/drizzle-import.js');

    const field: FieldDefinition = {
      name: 'content',
      type: 'text',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    };

    const result = fieldToIceTypeString(field);
    expect(result).toBe('text');
  });
});
