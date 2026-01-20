/**
 * CLI Commands Tests for @icetype/cli
 *
 * Tests for the CLI commands: init, validate, generate, and iceberg export.
 * Uses mocked file system operations.
 *
 * Note: These tests focus on the behavior that can be tested without
 * intercepting process.exit(), which is challenging with ESM modules.
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
    mkdirSync: vi.fn(),
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

// =============================================================================
// Init Command Tests
// =============================================================================

describe('init command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('schema file creation', () => {
    it('should create schema.ts file in current directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(String(callArgs?.[0])).toContain('schema.ts');
    });

    it('should create schema.ts file in specified directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'myproject']);

      expect(fs.mkdirSync).toHaveBeenCalled();
      const mkdirArgs = vi.mocked(fs.mkdirSync).mock.calls[0];
      expect(mkdirArgs?.[0]).toBe('myproject');
    });

    it('should not overwrite existing schema.ts without --force', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('already exists')
      );
    });

    it('should overwrite existing schema.ts with --force flag', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init(['--force']);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should overwrite existing schema.ts with -f short flag', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init(['-f']);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should include IceType schema template content', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = callArgs?.[1];

      // Check for expected template elements
      expect(typeof content).toBe('string');
      if (typeof content === 'string') {
        expect(content).toContain('@icetype/core');
        expect(content).toContain('parseSchema');
        expect(content).toContain('$type');
      }
    });

    it('should print success message after creating file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Created schema file')
      );
    });

    it('should print next steps instructions', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Next steps')
      );
    });
  });

  describe('directory creation', () => {
    it('should create directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'newdir']);

      expect(fs.mkdirSync).toHaveBeenCalledWith('newdir', { recursive: true });
    });

    it('should support -d short flag for directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['-d', 'mydir']);

      expect(fs.mkdirSync).toHaveBeenCalledWith('mydir', { recursive: true });
    });
  });
});

// =============================================================================
// generateTypeScriptInterface Function Tests
// =============================================================================

describe('generateTypeScriptInterface', () => {
  it('should generate valid TypeScript interface', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');
    const schema = createValidSchema('User');

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('export interface User');
    expect(output).toContain('$id: string');
    expect(output).toContain('$type:');
    expect(output).toContain('$version: number');
    expect(output).toContain('$createdAt: number');
    expect(output).toContain('$updatedAt: number');
  });

  it('should include user-defined fields', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');
    const schema = createValidSchema('User');

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('name');
    expect(output).toContain('email');
  });

  it('should generate input type interface', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');
    const schema = createValidSchema('User');

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('export interface UserInput');
  });

  it('should include @generated JSDoc comment', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');
    const schema = createValidSchema('User');

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('@generated');
  });

  it('should mark optional fields correctly', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

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
    fields.set('nickname', {
      name: 'nickname',
      type: 'string',
      modifier: '?',
      isArray: false,
      isOptional: true,
      isUnique: false,
      isIndexed: false,
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

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('nickname?:');
  });

  it('should handle array fields', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('tags', {
      name: 'tags',
      type: 'string',
      modifier: '',
      isArray: true,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Post',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('string[]');
  });

  it('should map primitive types correctly', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('strField', {
      name: 'strField',
      type: 'string',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });
    fields.set('intField', {
      name: 'intField',
      type: 'int',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });
    fields.set('boolField', {
      name: 'boolField',
      type: 'bool',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });
    fields.set('timestampField', {
      name: 'timestampField',
      type: 'timestamp',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Types',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('strField: string');
    expect(output).toContain('intField: number');
    expect(output).toContain('boolField: boolean');
    expect(output).toContain('timestampField: number');
  });

  it('should handle relation fields as string IDs', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('author', {
      name: 'author',
      type: 'User',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
      relation: {
        operator: '->',
        targetType: 'User',
      },
    });
    fields.set('comments', {
      name: 'comments',
      type: 'Comment',
      modifier: '',
      isArray: true,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
      relation: {
        operator: '<-',
        targetType: 'Comment',
        inverse: 'post',
      },
    });

    const schema: IceTypeSchema = {
      name: 'Post',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    // Relations should be mapped to string IDs
    expect(output).toContain('author: string');
    expect(output).toContain('comments: string[]');
  });

  it('should handle json type as unknown', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('metadata', {
      name: 'metadata',
      type: 'json',
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

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('metadata: unknown');
  });

  it('should handle binary type as Uint8Array', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('data', {
      name: 'data',
      type: 'binary',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Blob',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('data: Uint8Array');
  });

  it('should handle text type as string', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('content', {
      name: 'content',
      type: 'text',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Article',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('content: string');
  });

  it('should handle uuid type as string', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

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
      name: 'Entity',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('id: string');
  });

  it('should handle float and double types as number', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('price', {
      name: 'price',
      type: 'float',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });
    fields.set('amount', {
      name: 'amount',
      type: 'double',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Transaction',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('price: number');
    expect(output).toContain('amount: number');
  });

  it('should handle date and time types as number (epoch)', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('birthDate', {
      name: 'birthDate',
      type: 'date',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });
    fields.set('startTime', {
      name: 'startTime',
      type: 'time',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Event',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('birthDate: number');
    expect(output).toContain('startTime: number');
  });

  it('should handle unknown types as unknown', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('custom', {
      name: 'custom',
      type: 'customType',
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

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('custom: unknown');
  });

  it('should handle long and bigint types as number', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('bigNum', {
      name: 'bigNum',
      type: 'long',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });
    fields.set('hugeNum', {
      name: 'hugeNum',
      type: 'bigint',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Numbers',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('bigNum: number');
    expect(output).toContain('hugeNum: number');
  });

  it('should skip system fields starting with $', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('$systemField', {
      name: '$systemField',
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

    const output = generateTypeScriptInterface(schema);

    // Should not contain user-defined $systemField as a user field
    // (the output will have system $id, $type etc., but not $systemField)
    expect(output).toContain('regularField: string');
    // $systemField should be skipped (it starts with $)
    const lines = output.split('\n');
    const systemFieldLine = lines.find(
      (line) => line.includes('$systemField') && !line.includes('$id') && !line.includes('$type')
    );
    expect(systemFieldLine).toBeUndefined();
  });

  it('should handle decimal type as number', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('price', {
      name: 'price',
      type: 'decimal',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
      precision: 10,
      scale: 2,
    });

    const schema: IceTypeSchema = {
      name: 'Product',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('price: number');
  });

  it('should mark fields with default values as optional in input type', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('status', {
      name: 'status',
      type: 'string',
      modifier: '',
      isArray: false,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
      defaultValue: 'active',
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

    const output = generateTypeScriptInterface(schema);

    // In input type, fields with defaults should be optional
    expect(output).toContain('status?: string');
  });

  it('should handle arrays of numbers', async () => {
    const { generateTypeScriptInterface } = await import('../commands/generate.js');

    const fields = new Map<string, FieldDefinition>();
    fields.set('scores', {
      name: 'scores',
      type: 'int',
      modifier: '',
      isArray: true,
      isOptional: false,
      isUnique: false,
      isIndexed: false,
    });

    const schema: IceTypeSchema = {
      name: 'Student',
      version: 1,
      fields,
      directives: {},
      relations: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('scores: number[]');
  });
});

// =============================================================================
// CLI Integration Tests
// =============================================================================

describe('CLI integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('command routing', () => {
    it('should recognize init command and create schema file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Created schema file')
      );
    });
  });
});
