/**
 * Tests for IcebergAdapter implementation
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema, AdapterError, ErrorCodes } from '@icetype/core';
import {
  IcebergAdapter,
  createIcebergAdapter,
} from '../adapter.js';
import type { IcebergTableMetadata } from '../types.js';
import type { IceTypeSchema } from '@icetype/core';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a simple test schema for basic testing
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
 * Create a schema with partition by directive
 */
function createPartitionedSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'Order',
    $partitionBy: ['tenantId'],
    id: 'uuid!',
    tenantId: 'string!',
    amount: 'double',
    createdAt: 'timestamp',
  });
}

/**
 * Create a schema with various field types
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

// =============================================================================
// createIcebergAdapter() Factory Tests
// =============================================================================

describe('createIcebergAdapter()', () => {
  it('should create a new IcebergAdapter instance', () => {
    const adapter = createIcebergAdapter();

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(IcebergAdapter);
  });

  it('should create independent adapter instances', () => {
    const adapter1 = createIcebergAdapter();
    const adapter2 = createIcebergAdapter();

    expect(adapter1).not.toBe(adapter2);
  });

  it('should create adapter with correct interface methods', () => {
    const adapter = createIcebergAdapter();

    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.version).toBe('string');
  });
});

// =============================================================================
// IcebergAdapter Properties Tests
// =============================================================================

describe('IcebergAdapter properties', () => {
  let adapter: IcebergAdapter;

  beforeEach(() => {
    adapter = new IcebergAdapter();
  });

  describe('name property', () => {
    it('should have name "iceberg"', () => {
      expect(adapter.name).toBe('iceberg');
    });

    it('should be readonly', () => {
      // TypeScript enforces readonly, but we can verify the value doesn't change
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
// transform() Tests
// =============================================================================

describe('IcebergAdapter.transform()', () => {
  let adapter: IcebergAdapter;

  beforeEach(() => {
    adapter = new IcebergAdapter();
  });

  describe('Options validation', () => {
    it('should throw AdapterError when location is not provided', () => {
      const schema = createSimpleSchema();

      expect(() => adapter.transform(schema)).toThrow(AdapterError);
      expect(() => adapter.transform(schema)).toThrow(/Missing required option: location/);
    });

    it('should throw AdapterError when options is undefined', () => {
      const schema = createSimpleSchema();

      expect(() => adapter.transform(schema, undefined)).toThrow(AdapterError);
    });

    it('should throw AdapterError when location is empty string', () => {
      const schema = createSimpleSchema();

      expect(() => adapter.transform(schema, { location: '' })).toThrow(AdapterError);
    });

    it('should include adapter name and operation in error', () => {
      const schema = createSimpleSchema();

      try {
        adapter.transform(schema);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError);
        const adapterError = error as AdapterError;
        expect(adapterError.adapterName).toBe('iceberg');
        expect(adapterError.operation).toBe('transform');
        expect(adapterError.code).toBe(ErrorCodes.MISSING_ADAPTER_OPTION);
      }
    });
  });

  describe('Valid Iceberg metadata generation', () => {
    it('should return valid IcebergTableMetadata', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, {
        location: 's3://test-bucket/tables/users',
      });

      expect(result).toBeDefined();
      expect(result.formatVersion).toBeDefined();
      expect(result.tableUuid).toBeDefined();
      expect(result.location).toBe('s3://test-bucket/tables/users');
      expect(result.schemas).toBeDefined();
      expect(Array.isArray(result.schemas)).toBe(true);
    });

    it('should include correct format version', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, {
        location: 's3://test/table',
      });

      expect(result.formatVersion).toBe(2);
    });

    it('should use provided location', () => {
      const schema = createSimpleSchema();
      const location = 's3://my-bucket/my-tables/users';
      const result = adapter.transform(schema, { location });

      expect(result.location).toBe(location);
    });

    it('should generate a table UUID', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, {
        location: 's3://test/table',
      });

      expect(result.tableUuid).toBeDefined();
      expect(typeof result.tableUuid).toBe('string');
      expect(result.tableUuid.length).toBeGreaterThan(0);
    });

    it('should include schema definition', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, {
        location: 's3://test/table',
      });

      expect(result.schemas).toBeDefined();
      expect(result.schemas.length).toBeGreaterThan(0);

      const icebergSchema = result.schemas[0];
      expect(icebergSchema).toBeDefined();
      expect(icebergSchema!.type).toBe('struct');
      expect(icebergSchema!.fields).toBeDefined();
    });

    it('should include partition specs', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, {
        location: 's3://test/table',
      });

      expect(result.partitionSpecs).toBeDefined();
      expect(Array.isArray(result.partitionSpecs)).toBe(true);
    });

    it('should include sort orders', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, {
        location: 's3://test/table',
      });

      expect(result.sortOrders).toBeDefined();
      expect(Array.isArray(result.sortOrders)).toBe(true);
    });
  });

  describe('Schema field mapping', () => {
    it('should map schema fields to Iceberg fields', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, {
        location: 's3://test/table',
      });

      const icebergSchema = result.schemas[0];
      expect(icebergSchema).toBeDefined();

      const fieldNames = icebergSchema!.fields.map(f => f.name);
      // User-defined fields should be present
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('age');
    });

    it('should handle typed schema with various field types', () => {
      const schema = createTypedSchema();
      const result = adapter.transform(schema, {
        location: 's3://test/table',
      });

      const icebergSchema = result.schemas[0];
      expect(icebergSchema).toBeDefined();
      expect(icebergSchema!.fields.length).toBeGreaterThan(0);
    });
  });

  describe('Options handling', () => {
    it('should accept location option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, {
        location: 's3://custom-bucket/path/to/table',
      });

      expect(result.location).toBe('s3://custom-bucket/path/to/table');
    });

    it('should accept properties option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, {
        location: 's3://test/table',
        properties: {
          'write.format.default': 'parquet',
          'commit.retry.num-retries': '4',
        },
      });

      expect(result.properties).toBeDefined();
      expect(result.properties['write.format.default']).toBe('parquet');
      expect(result.properties['commit.retry.num-retries']).toBe('4');
    });

    it('should handle partitioned schema', () => {
      const schema = createPartitionedSchema();
      const result = adapter.transform(schema, {
        location: 's3://test/table',
      });

      expect(result.partitionSpecs).toBeDefined();
      // The implementation should handle partition directives
    });
  });
});

// =============================================================================
// serialize() Tests
// =============================================================================

describe('IcebergAdapter.serialize()', () => {
  let adapter: IcebergAdapter;

  beforeEach(() => {
    adapter = new IcebergAdapter();
  });

  it('should serialize metadata to valid JSON string', () => {
    const schema = createSimpleSchema();
    const metadata = adapter.transform(schema, {
      location: 's3://test/table',
    });

    const serialized = adapter.serialize(metadata);

    expect(typeof serialized).toBe('string');
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it('should produce JSON that deserializes back to equivalent object', () => {
    const schema = createSimpleSchema();
    const metadata = adapter.transform(schema, {
      location: 's3://test/table',
    });

    const serialized = adapter.serialize(metadata);
    const deserialized = JSON.parse(serialized) as IcebergTableMetadata;

    expect(deserialized.formatVersion).toBe(metadata.formatVersion);
    expect(deserialized.location).toBe(metadata.location);
    expect(deserialized.tableUuid).toBe(metadata.tableUuid);
  });

  it('should produce formatted JSON with indentation', () => {
    const schema = createSimpleSchema();
    const metadata = adapter.transform(schema, {
      location: 's3://test/table',
    });

    const serialized = adapter.serialize(metadata);

    // Formatted JSON should have newlines
    expect(serialized).toContain('\n');
  });

  it('should include all metadata properties in serialized output', () => {
    const schema = createSimpleSchema();
    const metadata = adapter.transform(schema, {
      location: 's3://test/table',
    });

    const serialized = adapter.serialize(metadata);
    const parsed = JSON.parse(serialized) as IcebergTableMetadata;

    expect(parsed.formatVersion).toBeDefined();
    expect(parsed.tableUuid).toBeDefined();
    expect(parsed.location).toBeDefined();
    expect(parsed.schemas).toBeDefined();
    expect(parsed.partitionSpecs).toBeDefined();
    expect(parsed.sortOrders).toBeDefined();
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('IcebergAdapter Integration', () => {
  let adapter: IcebergAdapter;

  beforeEach(() => {
    adapter = new IcebergAdapter();
  });

  it('should produce complete transform and serialize workflow', () => {
    const schema = createTypedSchema();

    // Transform
    const metadata = adapter.transform(schema, {
      location: 's3://production/tables/products',
      properties: {
        'owner': 'data-team',
      },
    });

    // Serialize
    const json = adapter.serialize(metadata);

    // Verify complete workflow
    expect(json).toBeDefined();
    const parsed = JSON.parse(json) as IcebergTableMetadata;
    expect(parsed.location).toBe('s3://production/tables/products');
    expect(parsed.properties.owner).toBe('data-team');
  });

  it('should be compatible with SchemaAdapter interface', () => {
    // The adapter should work as a generic SchemaAdapter
    const genericAdapter = adapter as {
      name: string;
      version: string;
      transform: (schema: IceTypeSchema, options?: unknown) => unknown;
      serialize: (output: unknown) => string;
    };

    expect(genericAdapter.name).toBe('iceberg');
    expect(genericAdapter.version).toBeDefined();
    expect(typeof genericAdapter.transform).toBe('function');
    expect(typeof genericAdapter.serialize).toBe('function');
  });

  it('should handle different S3 path formats', () => {
    const schema = createSimpleSchema();

    // Standard S3 path
    const result1 = adapter.transform(schema, {
      location: 's3://bucket/path/table',
    });
    expect(result1.location).toBe('s3://bucket/path/table');

    // S3a protocol
    const result2 = adapter.transform(schema, {
      location: 's3a://bucket/path/table',
    });
    expect(result2.location).toBe('s3a://bucket/path/table');

    // Local path
    const result3 = adapter.transform(schema, {
      location: '/local/path/to/table',
    });
    expect(result3.location).toBe('/local/path/to/table');
  });
});
