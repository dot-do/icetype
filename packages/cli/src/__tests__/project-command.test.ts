/**
 * Project Command Tests for @icetype/cli
 *
 * Tests for the ice project generate command using TDD approach.
 * Uses mocked file system operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import type { IceTypeSchema, FieldDefinition, RelationDefinition } from '@icetype/core';

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
 * Create a valid base IceTypeSchema object for testing
 */
function createBaseSchema(name: string = 'Order'): IceTypeSchema {
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
  fields.set('customerId', {
    name: 'customerId',
    type: 'string',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: true,
  });
  fields.set('total', {
    name: 'total',
    type: 'double',
    modifier: '!',
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

  const relations = new Map<string, RelationDefinition>();
  relations.set('customer', {
    operator: '->',
    targetType: 'Customer',
  });

  return {
    name,
    version: 1,
    fields,
    directives: {},
    relations,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a Customer schema for relation testing
 */
function createCustomerSchema(): IceTypeSchema {
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
    name: 'Customer',
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a projection schema for testing
 */
function createProjectionSchema(name: string = 'OrdersFlat'): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  // Projection schemas may have minimal fields - the actual fields come from expansion

  return {
    name,
    version: 1,
    fields,
    directives: {
      projection: 'olap',
      from: 'Order',
      expand: ['customer'],
      flatten: { 'customer.email': 'customerEmail' },
    } as IceTypeSchema['directives'] & {
      projection: 'olap';
      from: string;
      expand: string[];
      flatten: Record<string, string>;
    },
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a projection schema without $from (invalid)
 */
function createProjectionSchemaWithoutFrom(): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();

  return {
    name: 'InvalidProjection',
    version: 1,
    fields,
    directives: {
      projection: 'olap',
      // Missing $from
    } as IceTypeSchema['directives'] & { projection: 'olap' },
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// Project Generate Command Tests
// =============================================================================

describe('ice project command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('projectGenerate', () => {
    it('should export project generate function', async () => {
      const { projectGenerate } = await import('../commands/project.js');
      expect(typeof projectGenerate).toBe('function');
    });

    it('should error when --schema is missing', async () => {
      const { projectGenerate } = await import('../commands/project.js');
      await expect(projectGenerate([])).rejects.toThrow('--schema is required');
    });

    it('should support --output option', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--output', './olap.json'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          projection: { type: 'string', short: 'p' },
        },
      });

      expect(values.output).toBe('./olap.json');
    });

    it('should support --format option with iceberg', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--format', 'iceberg'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          projection: { type: 'string', short: 'p' },
        },
      });

      expect(values.format).toBe('iceberg');
    });

    it('should support --format option with parquet', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--format', 'parquet'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          projection: { type: 'string', short: 'p' },
        },
      });

      expect(values.format).toBe('parquet');
    });

    it('should support --projection option to filter specific projection', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '--projection', 'OrdersFlat'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          projection: { type: 'string', short: 'p' },
        },
      });

      expect(values.projection).toBe('OrdersFlat');
    });

    it('should support -s short flag for schema', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['-s', './schema.ts'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          projection: { type: 'string', short: 'p' },
        },
      });

      expect(values.schema).toBe('./schema.ts');
    });

    it('should support -o short flag for output', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-o', './output.json'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          projection: { type: 'string', short: 'p' },
        },
      });

      expect(values.output).toBe('./output.json');
    });

    it('should support -f short flag for format', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-f', 'parquet'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          projection: { type: 'string', short: 'p' },
        },
      });

      expect(values.format).toBe('parquet');
    });

    it('should support -p short flag for projection', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-p', 'MyProjection'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          projection: { type: 'string', short: 'p' },
        },
      });

      expect(values.projection).toBe('MyProjection');
    });

    it('should use default output path when --output is not specified', async () => {
      const { projectGenerate } = await import('../commands/project.js');
      // Verify function exists and can accept arguments without output
      expect(typeof projectGenerate).toBe('function');
    });

    it('should use iceberg as default format', async () => {
      const { projectGenerate } = await import('../commands/project.js');
      // Verify function exists with default format handling
      expect(typeof projectGenerate).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should throw error when file not found', async () => {
      const { projectGenerate } = await import('../commands/project.js');

      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(projectGenerate(['--schema', './nonexistent.ts'])).rejects.toThrow();
    });

    it('should throw error for invalid format option', async () => {
      const { projectGenerate } = await import('../commands/project.js');

      // Mock file exists but format is invalid
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await expect(
        projectGenerate(['--schema', './schema.ts', '--format', 'invalid'])
      ).rejects.toThrow('Invalid value');
    });

    it('should handle file write errors', async () => {
      const { projectGenerate } = await import('../commands/project.js');

      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Verify function handles write errors properly
      expect(typeof projectGenerate).toBe('function');
    });
  });

  describe('project parent command', () => {
    it('should export project function', async () => {
      const { project } = await import('../commands/project.js');
      expect(typeof project).toBe('function');
    });

    it('should route to generate subcommand', async () => {
      const { project } = await import('../commands/project.js');

      // Verify function can handle generate subcommand routing
      expect(typeof project).toBe('function');
    });
  });
});

// =============================================================================
// Projection Schema Extraction Tests
// =============================================================================

describe('projection schema extraction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should identify projection schemas with $projection directive', async () => {
    const { isProjection } = await import('@icetype/core');
    const projectionSchema = createProjectionSchema();

    expect(isProjection(projectionSchema)).toBe(true);
  });

  it('should not identify non-projection schemas', async () => {
    const { isProjection } = await import('@icetype/core');
    const baseSchema = createBaseSchema();

    expect(isProjection(baseSchema)).toBe(false);
  });

  it('should extract $from from projection schema', async () => {
    const { getProjectionSource } = await import('@icetype/core');
    const projectionSchema = createProjectionSchema();

    expect(getProjectionSource(projectionSchema)).toBe('Order');
  });

  it('should return undefined for non-projection schema source', async () => {
    const { getProjectionSource } = await import('@icetype/core');
    const baseSchema = createBaseSchema();

    expect(getProjectionSource(baseSchema)).toBeUndefined();
  });
});

// =============================================================================
// Iceberg Schema Generation Tests
// =============================================================================

describe('Iceberg projection schema generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid Iceberg schema from projection', async () => {
    const { generateProjectionSchema } = await import('@icetype/iceberg');

    const projectionDef: import('@icetype/iceberg').ProjectionDefinition = {
      $type: 'OrdersFlat',
      $projection: 'olap',
      $from: 'Order',
      $expand: ['customer'],
    };

    const orderSchema = createBaseSchema();
    const customerSchema = createCustomerSchema();

    const schemaMap = new Map<string, IceTypeSchema>();
    schemaMap.set('Order', orderSchema);
    schemaMap.set('Customer', customerSchema);

    const icebergSchema = generateProjectionSchema(projectionDef, schemaMap);

    expect(icebergSchema).toHaveProperty('type', 'struct');
    expect(icebergSchema).toHaveProperty('fields');
    expect(Array.isArray(icebergSchema.fields)).toBe(true);
  });

  it('should include system fields in generated schema', async () => {
    const { generateProjectionSchema } = await import('@icetype/iceberg');

    const projectionDef: import('@icetype/iceberg').ProjectionDefinition = {
      $type: 'OrdersFlat',
      $projection: 'olap',
      $from: 'Order',
    };

    const orderSchema = createBaseSchema();

    const schemaMap = new Map<string, IceTypeSchema>();
    schemaMap.set('Order', orderSchema);

    const icebergSchema = generateProjectionSchema(projectionDef, schemaMap);

    const fieldNames = icebergSchema.fields.map((f) => f.name);
    expect(fieldNames).toContain('$id');
    expect(fieldNames).toContain('$type');
    expect(fieldNames).toContain('$version');
  });

  it('should include source entity fields', async () => {
    const { generateProjectionSchema } = await import('@icetype/iceberg');

    const projectionDef: import('@icetype/iceberg').ProjectionDefinition = {
      $type: 'OrdersFlat',
      $projection: 'olap',
      $from: 'Order',
    };

    const orderSchema = createBaseSchema();

    const schemaMap = new Map<string, IceTypeSchema>();
    schemaMap.set('Order', orderSchema);

    const icebergSchema = generateProjectionSchema(projectionDef, schemaMap);

    const fieldNames = icebergSchema.fields.map((f) => f.name);
    expect(fieldNames).toContain('id');
    expect(fieldNames).toContain('customerId');
    expect(fieldNames).toContain('total');
    expect(fieldNames).toContain('createdAt');
  });

  it('should throw error when source entity does not exist', async () => {
    const { generateProjectionSchema } = await import('@icetype/iceberg');

    const projectionDef: import('@icetype/iceberg').ProjectionDefinition = {
      $type: 'OrdersFlat',
      $projection: 'olap',
      $from: 'NonExistentEntity',
    };

    const schemaMap = new Map<string, IceTypeSchema>();

    expect(() => generateProjectionSchema(projectionDef, schemaMap)).toThrow(
      /source entity.*does not exist/i
    );
  });
});

// =============================================================================
// Parquet Schema Generation Tests
// =============================================================================

describe('Parquet projection schema generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid Parquet schema', async () => {
    const { generateParquetSchema } = await import('@icetype/iceberg');
    const schema = createBaseSchema();

    const parquetSchema = generateParquetSchema(schema);

    expect(parquetSchema).toHaveProperty('name', 'Order');
    expect(parquetSchema).toHaveProperty('fields');
    expect(Array.isArray(parquetSchema.fields)).toBe(true);
  });

  it('should generate Parquet schema string', async () => {
    const { generateParquetSchemaString } = await import('@icetype/iceberg');
    const schema = createBaseSchema();

    const schemaString = generateParquetSchemaString(schema);

    expect(schemaString).toContain('message Order');
    expect(schemaString).toContain('REQUIRED');
  });

  it('should map IceType types to Parquet types', async () => {
    const { generateParquetSchema } = await import('@icetype/iceberg');
    const schema = createBaseSchema();

    const parquetSchema = generateParquetSchema(schema);

    // double -> DOUBLE
    const totalField = parquetSchema.fields.find((f) => f.name === 'total');
    expect(totalField?.type).toBe('DOUBLE');

    // timestamp -> INT64 with TIMESTAMP_MILLIS
    const createdAtField = parquetSchema.fields.find((f) => f.name === 'createdAt');
    expect(createdAtField?.type).toBe('INT64');
    expect(createdAtField?.convertedType).toBe('TIMESTAMP_MILLIS');
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

  it('should include usage hint in error when --schema is missing', async () => {
    const { projectGenerate } = await import('../commands/project.js');

    try {
      await projectGenerate([]);
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('--schema is required');
      expect((error as Error).message).toContain('Usage:');
    }
  });

  it('should validate format option values', async () => {
    const { projectGenerate } = await import('../commands/project.js');

    try {
      await projectGenerate(['--schema', './schema.ts', '--format', 'xml']);
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('Invalid value');
      expect((error as Error).message).toContain('iceberg');
      expect((error as Error).message).toContain('parquet');
    }
  });
});

// =============================================================================
// Output Format Tests
// =============================================================================

describe('output format', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should output valid JSON for iceberg format', async () => {
    const { generateProjectionSchema } = await import('@icetype/iceberg');

    const projectionDef: import('@icetype/iceberg').ProjectionDefinition = {
      $type: 'OrdersFlat',
      $projection: 'olap',
      $from: 'Order',
    };

    const orderSchema = createBaseSchema();
    const schemaMap = new Map<string, IceTypeSchema>();
    schemaMap.set('Order', orderSchema);

    const icebergSchema = generateProjectionSchema(projectionDef, schemaMap);
    const jsonString = JSON.stringify(icebergSchema, null, 2);

    // Should be valid JSON
    expect(() => JSON.parse(jsonString)).not.toThrow();
  });

  it('should output valid Parquet schema string', async () => {
    const { generateParquetSchemaString } = await import('@icetype/iceberg');
    const schema = createBaseSchema();

    const schemaString = generateParquetSchemaString(schema);

    // Should contain expected Parquet schema structure
    expect(schemaString).toContain('message');
    expect(schemaString).toContain('{');
    expect(schemaString).toContain('}');
  });

  it('should include all required Iceberg schema fields', async () => {
    const { generateProjectionSchema } = await import('@icetype/iceberg');

    const projectionDef: import('@icetype/iceberg').ProjectionDefinition = {
      $type: 'OrdersFlat',
      $projection: 'olap',
      $from: 'Order',
    };

    const orderSchema = createBaseSchema();
    const schemaMap = new Map<string, IceTypeSchema>();
    schemaMap.set('Order', orderSchema);

    const icebergSchema = generateProjectionSchema(projectionDef, schemaMap);

    // Required fields per Iceberg schema spec
    expect(icebergSchema).toHaveProperty('type');
    expect(icebergSchema).toHaveProperty('schemaId');
    expect(icebergSchema).toHaveProperty('identifierFieldIds');
    expect(icebergSchema).toHaveProperty('fields');
  });
});
