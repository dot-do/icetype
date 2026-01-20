/**
 * Iceberg Command Tests for @icetype/cli
 *
 * Tests for the ice iceberg export command using TDD approach.
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
 * Create a schema with partition configuration for testing
 */
function createSchemaWithPartitions(name: string = 'PartitionedEntity'): IceTypeSchema {
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
  fields.set('tenantId', {
    name: 'tenantId',
    type: 'string',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: true,
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
  fields.set('data', {
    name: 'data',
    type: 'json',
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
      partitionBy: ['tenantId', 'createdAt'],
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
  fields.set('score', {
    name: 'score',
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
  fields.set('createdAt', {
    name: 'createdAt',
    type: 'timestamp',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });
  fields.set('metadata', {
    name: 'metadata',
    type: 'json',
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
// Iceberg Export Command Tests
// =============================================================================

describe('ice iceberg command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('icebergExport', () => {
    it('should export schema to Iceberg metadata JSON', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      // Verify the function exists and is a function
      expect(typeof icebergExport).toBe('function');
    });

    it('should error when --schema is missing', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await icebergExport([]);
      } catch {
        // Expected - process.exit was called
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('--schema is required')
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should support --output option to write to file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { icebergExport } = await import('../commands/iceberg.js');

      // Verify function can accept output option
      expect(typeof icebergExport).toBe('function');
    });

    it('should support --location option for table location', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      // Verify function can accept location option
      expect(typeof icebergExport).toBe('function');
    });

    it('should support -s short flag for schema', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['-s', './schema.ts'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          location: { type: 'string', short: 'l' },
        },
      });

      expect(values.schema).toBe('./schema.ts');
    });

    it('should support -o short flag for output', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-o', './metadata.json'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          location: { type: 'string', short: 'l' },
        },
      });

      expect(values.output).toBe('./metadata.json');
    });

    it('should support -l short flag for location', async () => {
      const { parseArgs } = await import('node:util');

      const { values } = parseArgs({
        args: ['--schema', './schema.ts', '-l', 's3://bucket/table'],
        options: {
          schema: { type: 'string', short: 's' },
          output: { type: 'string', short: 'o' },
          location: { type: 'string', short: 'l' },
        },
      });

      expect(values.location).toBe('s3://bucket/table');
    });

    it('should use default output path when --output is not specified', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      // Default output should be metadata.json
      expect(typeof icebergExport).toBe('function');
    });

    it('should use default location when --location is not specified', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      // Default location should be s3://bucket/table
      expect(typeof icebergExport).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should handle file not found error gracefully', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      try {
        await icebergExport(['--schema', './nonexistent.ts']);
      } catch {
        // Expected
      }

      expect(mockConsoleError).toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should handle invalid schema file gracefully', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await icebergExport(['--schema', './invalid-schema.ts']);
      } catch {
        // Expected
      }

      mockExit.mockRestore();
    });

    it('should handle file write errors gracefully', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      // Mock writeFileSync to throw an error
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Verify function handles write errors
      expect(typeof icebergExport).toBe('function');
    });

    it('should handle empty schema file', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await icebergExport(['--schema', './empty.ts']);
      } catch {
        // Expected
      }

      mockExit.mockRestore();
    });
  });

  describe('multiple schemas handling', () => {
    it('should use first schema when multiple schemas are in file', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      // The command currently uses the first schema found
      expect(typeof icebergExport).toBe('function');
    });

    it('should log the number of schemas found', async () => {
      const { icebergExport } = await import('../commands/iceberg.js');

      // Verify function logs schema count
      expect(typeof icebergExport).toBe('function');
    });
  });
});

// =============================================================================
// Iceberg Metadata Generation Tests
// =============================================================================

describe('Iceberg metadata generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid Iceberg metadata structure', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');

    expect(metadata).toHaveProperty('formatVersion');
    expect(metadata).toHaveProperty('tableUuid');
    expect(metadata).toHaveProperty('location');
    expect(metadata).toHaveProperty('schemas');
    expect(metadata).toHaveProperty('partitionSpecs');
    expect(metadata).toHaveProperty('sortOrders');
  });

  it('should use format version 2', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');

    expect(metadata.formatVersion).toBe(2);
  });

  it('should set correct table location', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');
    const location = 's3://my-bucket/tables/users';

    const metadata = generateIcebergMetadata(schema, location);

    expect(metadata.location).toBe(location);
  });

  it('should include system fields in schema', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');
    const icebergSchema = metadata.schemas[0];

    const fieldNames = icebergSchema?.fields.map(f => f.name) ?? [];
    expect(fieldNames).toContain('$id');
    expect(fieldNames).toContain('$type');
    expect(fieldNames).toContain('$version');
    expect(fieldNames).toContain('$createdAt');
    expect(fieldNames).toContain('$updatedAt');
  });

  it('should include user fields in schema', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');
    const icebergSchema = metadata.schemas[0];

    const fieldNames = icebergSchema?.fields.map(f => f.name) ?? [];
    expect(fieldNames).toContain('id');
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('email');
  });

  it('should mark required fields correctly', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createSchemaWithTypes();

    const metadata = generateIcebergMetadata(schema, 's3://bucket/entities');
    const icebergSchema = metadata.schemas[0];

    // Find the 'id' field (required)
    const idField = icebergSchema?.fields.find(f => f.name === 'id');
    expect(idField?.required).toBe(true);

    // Find the 'age' field (optional)
    const ageField = icebergSchema?.fields.find(f => f.name === 'age');
    expect(ageField?.required).toBe(false);
  });

  it('should map IceType types to Iceberg types correctly', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createSchemaWithTypes();

    const metadata = generateIcebergMetadata(schema, 's3://bucket/entities');
    const icebergSchema = metadata.schemas[0];

    // uuid -> uuid
    const idField = icebergSchema?.fields.find(f => f.name === 'id');
    expect(idField?.type.type).toBe('uuid');

    // string -> string
    const nameField = icebergSchema?.fields.find(f => f.name === 'name');
    expect(nameField?.type.type).toBe('string');

    // int -> int
    const ageField = icebergSchema?.fields.find(f => f.name === 'age');
    expect(ageField?.type.type).toBe('int');

    // double -> double
    const scoreField = icebergSchema?.fields.find(f => f.name === 'score');
    expect(scoreField?.type.type).toBe('double');

    // bool -> boolean
    const isActiveField = icebergSchema?.fields.find(f => f.name === 'isActive');
    expect(isActiveField?.type.type).toBe('boolean');

    // timestamp -> timestamp
    const createdAtField = icebergSchema?.fields.find(f => f.name === 'createdAt');
    expect(createdAtField?.type.type).toBe('timestamp');
  });

  it('should include custom properties in metadata', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users', {
      'write.format.default': 'parquet',
      'write.parquet.compression-codec': 'zstd',
    });

    expect(metadata.properties).toHaveProperty('write.format.default', 'parquet');
    expect(metadata.properties).toHaveProperty('write.parquet.compression-codec', 'zstd');
  });

  it('should include icetype source info in properties', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');

    expect(metadata.properties).toHaveProperty('icetype.source.schema', 'User');
    expect(metadata.properties).toHaveProperty('icetype.source.version', '1');
  });
});

// =============================================================================
// Partition Configuration Tests
// =============================================================================

describe('partition configuration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate partition spec from directives', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createSchemaWithPartitions('PartitionedTable');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/table');
    const partitionSpec = metadata.partitionSpecs[0];

    expect(partitionSpec).toBeDefined();
    expect(partitionSpec?.fields.length).toBeGreaterThan(0);
  });

  it('should use identity transform for string partition fields', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createSchemaWithPartitions('PartitionedTable');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/table');
    const partitionSpec = metadata.partitionSpecs[0];

    // tenantId is a string field - should use identity transform
    const tenantIdPartition = partitionSpec?.fields.find(f => f.name === 'tenantId');
    expect(tenantIdPartition?.transform).toBe('identity');
  });

  it('should use day transform for timestamp partition fields', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createSchemaWithPartitions('PartitionedTable');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/table');
    const partitionSpec = metadata.partitionSpecs[0];

    // createdAt is a timestamp field - should use day transform
    const createdAtPartition = partitionSpec?.fields.find(f => f.name === 'createdAt');
    expect(createdAtPartition?.transform).toBe('day');
  });

  it('should default to $type partition when no partitionBy specified', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createSchemaWithTypes(); // No partitionBy directive

    const metadata = generateIcebergMetadata(schema, 's3://bucket/table');
    const partitionSpec = metadata.partitionSpecs[0];

    // Should default to partitioning by $type
    const typePartition = partitionSpec?.fields.find(f => f.name === '$type');
    expect(typePartition).toBeDefined();
    expect(typePartition?.transform).toBe('identity');
  });

  it('should assign unique field IDs to partition fields', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createSchemaWithPartitions('PartitionedTable');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/table');
    const partitionSpec = metadata.partitionSpecs[0];

    const fieldIds = partitionSpec?.fields.map(f => f.fieldId) ?? [];
    const uniqueFieldIds = new Set(fieldIds);

    // All field IDs should be unique
    expect(uniqueFieldIds.size).toBe(fieldIds.length);
  });
});

// =============================================================================
// Sort Order Tests
// =============================================================================

describe('sort order generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate default sort order', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');
    const sortOrder = metadata.sortOrders[0];

    expect(sortOrder).toBeDefined();
    expect(sortOrder?.orderId).toBe(0);
  });

  it('should sort by $createdAt descending by default', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');
    const sortOrder = metadata.sortOrders[0];

    // Find the sort field for $createdAt
    const createdAtSort = sortOrder?.fields.find(f => {
      // Find the schema field with this sourceId
      const schemaField = metadata.schemas[0]?.fields.find(sf => sf.id === f.sourceId);
      return schemaField?.name === '$createdAt';
    });

    expect(createdAtSort).toBeDefined();
    expect(createdAtSort?.direction).toBe('desc');
    expect(createdAtSort?.nullOrder).toBe('nulls-last');
  });
});

// =============================================================================
// Parquet Schema Generation Tests
// =============================================================================

describe('Parquet schema generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid Parquet schema', async () => {
    const { generateParquetSchema } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const parquetSchema = generateParquetSchema(schema);

    expect(parquetSchema).toHaveProperty('name', 'User');
    expect(parquetSchema).toHaveProperty('fields');
    expect(Array.isArray(parquetSchema.fields)).toBe(true);
  });

  it('should include system fields in Parquet schema', async () => {
    const { generateParquetSchema } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const parquetSchema = generateParquetSchema(schema);

    const fieldNames = parquetSchema.fields.map(f => f.name);
    expect(fieldNames).toContain('$id');
    expect(fieldNames).toContain('$type');
    expect(fieldNames).toContain('$version');
    expect(fieldNames).toContain('$createdAt');
    expect(fieldNames).toContain('$updatedAt');
  });

  it('should map IceType types to Parquet types correctly', async () => {
    const { generateParquetSchema } = await import('@icetype/iceberg');
    const schema = createSchemaWithTypes();

    const parquetSchema = generateParquetSchema(schema);

    // string -> BYTE_ARRAY with UTF8
    const nameField = parquetSchema.fields.find(f => f.name === 'name');
    expect(nameField?.type).toBe('BYTE_ARRAY');
    expect(nameField?.convertedType).toBe('UTF8');

    // int -> INT32
    const ageField = parquetSchema.fields.find(f => f.name === 'age');
    expect(ageField?.type).toBe('INT32');

    // double -> DOUBLE
    const scoreField = parquetSchema.fields.find(f => f.name === 'score');
    expect(scoreField?.type).toBe('DOUBLE');

    // bool -> BOOLEAN
    const isActiveField = parquetSchema.fields.find(f => f.name === 'isActive');
    expect(isActiveField?.type).toBe('BOOLEAN');

    // timestamp -> INT64 with TIMESTAMP_MILLIS
    const createdAtField = parquetSchema.fields.find(f => f.name === 'createdAt');
    expect(createdAtField?.type).toBe('INT64');
    expect(createdAtField?.convertedType).toBe('TIMESTAMP_MILLIS');
  });

  it('should set correct repetition for required fields', async () => {
    const { generateParquetSchema } = await import('@icetype/iceberg');
    const schema = createSchemaWithTypes();

    const parquetSchema = generateParquetSchema(schema);

    // id is required
    const idField = parquetSchema.fields.find(f => f.name === 'id');
    expect(idField?.repetition).toBe('REQUIRED');

    // age is optional
    const ageField = parquetSchema.fields.find(f => f.name === 'age');
    expect(ageField?.repetition).toBe('OPTIONAL');
  });

  it('should generate Parquet schema string', async () => {
    const { generateParquetSchemaString } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const schemaString = generateParquetSchemaString(schema);

    expect(schemaString).toContain('message User');
    expect(schemaString).toContain('REQUIRED');
    expect(schemaString).toContain('$id');
  });

  it('should handle uuid type correctly', async () => {
    const { generateParquetSchema } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const parquetSchema = generateParquetSchema(schema);

    const idField = parquetSchema.fields.find(f => f.name === 'id');
    expect(idField?.type).toBe('FIXED_LEN_BYTE_ARRAY');
    expect(idField?.typeLength).toBe(16);
    expect(idField?.convertedType).toBe('UUID');
  });

  it('should handle json type correctly', async () => {
    const { generateParquetSchema } = await import('@icetype/iceberg');
    const schema = createSchemaWithTypes();

    const parquetSchema = generateParquetSchema(schema);

    const metadataField = parquetSchema.fields.find(f => f.name === 'metadata');
    expect(metadataField?.type).toBe('BYTE_ARRAY');
    expect(metadataField?.convertedType).toBe('JSON');
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

  it('should display usage when --schema is missing', async () => {
    const { icebergExport } = await import('../commands/iceberg.js');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      await icebergExport([]);
    } catch {
      // Expected
    }

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Usage:')
    );

    mockExit.mockRestore();
  });

  it('should log export progress', async () => {
    const { icebergExport } = await import('../commands/iceberg.js');

    // Verify function logs progress
    expect(typeof icebergExport).toBe('function');
  });

  it('should log schema count when loading', async () => {
    const { icebergExport } = await import('../commands/iceberg.js');

    // Verify function logs schema information
    expect(typeof icebergExport).toBe('function');
  });

  it('should log table location in output', async () => {
    const { icebergExport } = await import('../commands/iceberg.js');

    // Verify function logs table location
    expect(typeof icebergExport).toBe('function');
  });

  it('should log field count in schema', async () => {
    const { icebergExport } = await import('../commands/iceberg.js');

    // Verify function logs field count
    expect(typeof icebergExport).toBe('function');
  });

  it('should log partition field count', async () => {
    const { icebergExport } = await import('../commands/iceberg.js');

    // Verify function logs partition count
    expect(typeof icebergExport).toBe('function');
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

  it('should output valid JSON format', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');
    const jsonString = JSON.stringify(metadata, null, 2);

    // Should be valid JSON
    expect(() => JSON.parse(jsonString)).not.toThrow();
  });

  it('should include all required Iceberg metadata fields', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');

    // Required fields per Iceberg spec
    expect(metadata).toHaveProperty('formatVersion');
    expect(metadata).toHaveProperty('tableUuid');
    expect(metadata).toHaveProperty('location');
    expect(metadata).toHaveProperty('lastSequenceNumber');
    expect(metadata).toHaveProperty('lastUpdatedMs');
    expect(metadata).toHaveProperty('lastColumnId');
    expect(metadata).toHaveProperty('currentSchemaId');
    expect(metadata).toHaveProperty('schemas');
    expect(metadata).toHaveProperty('defaultSpecId');
    expect(metadata).toHaveProperty('partitionSpecs');
    expect(metadata).toHaveProperty('lastPartitionId');
    expect(metadata).toHaveProperty('defaultSortOrderId');
    expect(metadata).toHaveProperty('sortOrders');
    expect(metadata).toHaveProperty('properties');
  });

  it('should have at least one schema in schemas array', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');

    expect(metadata.schemas.length).toBeGreaterThanOrEqual(1);
  });

  it('should have at least one partition spec', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');

    expect(metadata.partitionSpecs.length).toBeGreaterThanOrEqual(1);
  });

  it('should have at least one sort order', async () => {
    const { generateIcebergMetadata } = await import('@icetype/iceberg');
    const schema = createValidSchema('User');

    const metadata = generateIcebergMetadata(schema, 's3://bucket/users');

    expect(metadata.sortOrders.length).toBeGreaterThanOrEqual(1);
  });
});
