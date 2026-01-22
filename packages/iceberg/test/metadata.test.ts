/**
 * Tests for Iceberg metadata generation from IceType schemas
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema } from '@icetype/core';
import {
  IcebergMetadataGenerator,
  createIcebergMetadataGenerator,
  generateIcebergMetadata,
} from '../src/metadata.js';
import type { IcebergTableMetadata } from '../src/types.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a simple test schema for basic testing
 */
function createSimpleSchema() {
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
function createPartitionedSchema() {
  return parseSchema({
    $type: 'Order',
    $partitionBy: ['tenantId', 'createdAt'],
    id: 'uuid!',
    tenantId: 'string!',
    amount: 'double',
    createdAt: 'timestamp',
  });
}

/**
 * Create a schema with various field types
 */
function createTypedSchema() {
  return parseSchema({
    $type: 'Product',
    id: 'uuid!',
    name: 'string!',
    description: 'text',
    price: 'double',
    quantity: 'int',
    isActive: 'boolean',
    createdAt: 'timestamp',
    updatedAtTz: 'timestamptz',
    releaseDate: 'date',
    metadata: 'json',
    data: 'binary',
  });
}

/**
 * Create a schema with array fields
 */
function createArraySchema() {
  return parseSchema({
    $type: 'Post',
    id: 'uuid!',
    title: 'string!',
    tags: 'string[]',
    ratings: 'int[]',
  });
}

// =============================================================================
// generateSchema() Tests
// =============================================================================

describe('IcebergMetadataGenerator', () => {
  let generator: IcebergMetadataGenerator;

  beforeEach(() => {
    generator = new IcebergMetadataGenerator();
  });

  describe('generateSchema()', () => {
    it('should create a valid Iceberg schema with struct type', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);

      expect(icebergSchema.type).toBe('struct');
      expect(icebergSchema.schemaId).toBe(schema.version);
      expect(Array.isArray(icebergSchema.fields)).toBe(true);
    });

    it('should include system fields ($id, $type, $version, $createdAt, $updatedAt)', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);

      const fieldNames = icebergSchema.fields.map(f => f.name);

      expect(fieldNames).toContain('$id');
      expect(fieldNames).toContain('$type');
      expect(fieldNames).toContain('$version');
      expect(fieldNames).toContain('$createdAt');
      expect(fieldNames).toContain('$updatedAt');
    });

    it('should set system fields as required', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);

      const systemFieldNames = ['$id', '$type', '$version', '$createdAt', '$updatedAt'];
      const systemFields = icebergSchema.fields.filter(f => systemFieldNames.includes(f.name));

      for (const field of systemFields) {
        expect(field.required).toBe(true);
      }
    });

    it('should set correct types for system fields', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);

      const fieldByName = (name: string) => icebergSchema.fields.find(f => f.name === name);

      expect(fieldByName('$id')?.type.type).toBe('string');
      expect(fieldByName('$type')?.type.type).toBe('string');
      expect(fieldByName('$version')?.type.type).toBe('int');
      expect(fieldByName('$createdAt')?.type.type).toBe('long');
      expect(fieldByName('$updatedAt')?.type.type).toBe('long');
    });

    it('should include identifier field IDs for $id field', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);

      const idField = icebergSchema.fields.find(f => f.name === '$id');
      expect(idField).toBeDefined();
      expect(icebergSchema.identifierFieldIds).toContain(idField!.id);
    });

    it('should assign unique sequential field IDs starting from 1', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);

      const ids = icebergSchema.fields.map(f => f.id);
      const sortedIds = [...ids].sort((a, b) => a - b);

      // Should start from 1 and be sequential
      expect(sortedIds[0]).toBe(1);
      for (let i = 1; i < sortedIds.length; i++) {
        expect(sortedIds[i]).toBe(sortedIds[i - 1]! + 1);
      }
    });

    it('should include user-defined fields after system fields', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);

      const userFieldNames = icebergSchema.fields
        .filter(f => !f.name.startsWith('$'))
        .map(f => f.name);

      expect(userFieldNames).toContain('id');
      expect(userFieldNames).toContain('email');
      expect(userFieldNames).toContain('name');
      expect(userFieldNames).toContain('age');
    });
  });

  describe('Field type mapping', () => {
    it('should map string type to Iceberg string', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const nameField = icebergSchema.fields.find(f => f.name === 'name');
      expect(nameField?.type.type).toBe('string');
    });

    it('should map text type to Iceberg string', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const descField = icebergSchema.fields.find(f => f.name === 'description');
      expect(descField?.type.type).toBe('string');
    });

    it('should map int type to Iceberg int', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const qtyField = icebergSchema.fields.find(f => f.name === 'quantity');
      expect(qtyField?.type.type).toBe('int');
    });

    it('should map double type to Iceberg double', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const priceField = icebergSchema.fields.find(f => f.name === 'price');
      expect(priceField?.type.type).toBe('double');
    });

    it('should map boolean type to Iceberg boolean', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const activeField = icebergSchema.fields.find(f => f.name === 'isActive');
      expect(activeField?.type.type).toBe('boolean');
    });

    it('should map uuid type to Iceberg uuid', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const idField = icebergSchema.fields.find(f => f.name === 'id');
      expect(idField?.type.type).toBe('uuid');
    });

    it('should map timestamp type to Iceberg timestamp', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const createdField = icebergSchema.fields.find(f => f.name === 'createdAt');
      expect(createdField?.type.type).toBe('timestamp');
    });

    it('should map timestamptz type to Iceberg timestamptz', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const updatedField = icebergSchema.fields.find(f => f.name === 'updatedAtTz');
      expect(updatedField?.type.type).toBe('timestamptz');
    });

    it('should map date type to Iceberg date', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const dateField = icebergSchema.fields.find(f => f.name === 'releaseDate');
      expect(dateField?.type.type).toBe('date');
    });

    it('should map json type to Iceberg string', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const metaField = icebergSchema.fields.find(f => f.name === 'metadata');
      expect(metaField?.type.type).toBe('string');
    });

    it('should map binary type to Iceberg binary', () => {
      const schema = createTypedSchema();
      const icebergSchema = generator.generateSchema(schema);

      const dataField = icebergSchema.fields.find(f => f.name === 'data');
      expect(dataField?.type.type).toBe('binary');
    });

    it('should map array types to Iceberg list', () => {
      const schema = createArraySchema();
      const icebergSchema = generator.generateSchema(schema);

      const tagsField = icebergSchema.fields.find(f => f.name === 'tags');
      expect(tagsField?.type.type).toBe('list');
      expect(tagsField?.type.elementType?.type).toBe('string');
    });

    it('should handle required vs optional fields', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);

      const idField = icebergSchema.fields.find(f => f.name === 'id');
      const ageField = icebergSchema.fields.find(f => f.name === 'age');

      expect(idField?.required).toBe(true);
      expect(ageField?.required).toBe(false);
    });
  });

  describe('generatePartitionSpec()', () => {
    it('should generate partition spec from $partitionBy directive', () => {
      const schema = createPartitionedSchema();
      const icebergSchema = generator.generateSchema(schema);
      const partitionSpec = generator.generatePartitionSpec(schema, icebergSchema);

      expect(partitionSpec.specId).toBe(0);
      expect(partitionSpec.fields.length).toBeGreaterThan(0);
    });

    it('should create identity transform for string partition fields', () => {
      const schema = createPartitionedSchema();
      const icebergSchema = generator.generateSchema(schema);
      const partitionSpec = generator.generatePartitionSpec(schema, icebergSchema);

      const tenantPartition = partitionSpec.fields.find(f => f.name === 'tenantId');
      expect(tenantPartition?.transform).toBe('identity');
    });

    it('should create day transform for timestamp partition fields', () => {
      const schema = createPartitionedSchema();
      const icebergSchema = generator.generateSchema(schema);
      const partitionSpec = generator.generatePartitionSpec(schema, icebergSchema);

      const createdAtPartition = partitionSpec.fields.find(f => f.name === 'createdAt');
      expect(createdAtPartition?.transform).toBe('day');
    });

    it('should default to $type partition when no partitionBy specified', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);
      const partitionSpec = generator.generatePartitionSpec(schema, icebergSchema);

      const typePartition = partitionSpec.fields.find(f => f.name === '$type');
      expect(typePartition).toBeDefined();
      expect(typePartition?.transform).toBe('identity');
    });

    it('should assign unique partition field IDs starting from 1000', () => {
      const schema = createPartitionedSchema();
      const icebergSchema = generator.generateSchema(schema);
      const partitionSpec = generator.generatePartitionSpec(schema, icebergSchema);

      for (const field of partitionSpec.fields) {
        expect(field.fieldId).toBeGreaterThanOrEqual(1000);
      }
    });

    it('should reference correct source field IDs', () => {
      const schema = createPartitionedSchema();
      const icebergSchema = generator.generateSchema(schema);
      const partitionSpec = generator.generatePartitionSpec(schema, icebergSchema);

      const tenantPartition = partitionSpec.fields.find(f => f.name === 'tenantId');
      const tenantField = icebergSchema.fields.find(f => f.name === 'tenantId');

      expect(tenantPartition?.sourceId).toBe(tenantField?.id);
    });
  });

  describe('generateSortOrder()', () => {
    it('should generate sort order with $createdAt field', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);
      const sortOrder = generator.generateSortOrder(schema, icebergSchema);

      expect(sortOrder.orderId).toBe(0);
      expect(sortOrder.fields.length).toBeGreaterThan(0);
    });

    it('should default to descending order on $createdAt', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);
      const sortOrder = generator.generateSortOrder(schema, icebergSchema);

      const createdAtSort = sortOrder.fields[0];
      expect(createdAtSort?.direction).toBe('desc');
    });

    it('should use nulls-last for null ordering', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);
      const sortOrder = generator.generateSortOrder(schema, icebergSchema);

      const createdAtSort = sortOrder.fields[0];
      expect(createdAtSort?.nullOrder).toBe('nulls-last');
    });

    it('should use identity transform for sort fields', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);
      const sortOrder = generator.generateSortOrder(schema, icebergSchema);

      const createdAtSort = sortOrder.fields[0];
      expect(createdAtSort?.transform).toBe('identity');
    });

    it('should reference correct source field ID', () => {
      const schema = createSimpleSchema();
      const icebergSchema = generator.generateSchema(schema);
      const sortOrder = generator.generateSortOrder(schema, icebergSchema);

      const createdAtField = icebergSchema.fields.find(f => f.name === '$createdAt');
      const createdAtSort = sortOrder.fields[0];

      expect(createdAtSort?.sourceId).toBe(createdAtField?.id);
    });
  });

  describe('generateTableMetadata()', () => {
    it('should produce valid format-version-2 metadata', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });

      expect(metadata.formatVersion).toBe(2);
    });

    it('should include table UUID', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });

      expect(metadata.tableUuid).toBeDefined();
      expect(typeof metadata.tableUuid).toBe('string');
      expect(metadata.tableUuid.length).toBeGreaterThan(0);
    });

    it('should use provided table UUID when specified', () => {
      const schema = createSimpleSchema();
      const customUuid = '12345678-1234-1234-1234-123456789012';
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
        tableUuid: customUuid,
      });

      expect(metadata.tableUuid).toBe(customUuid);
    });

    it('should set table location', () => {
      const schema = createSimpleSchema();
      const location = 's3://bucket/tables/users';
      const metadata = generator.generateTableMetadata(schema, { location });

      expect(metadata.location).toBe(location);
    });

    it('should include schema in schemas array', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });

      expect(metadata.schemas.length).toBe(1);
      expect(metadata.schemas[0]?.type).toBe('struct');
      expect(metadata.currentSchemaId).toBe(metadata.schemas[0]?.schemaId);
    });

    it('should include partition spec in partitionSpecs array', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });

      expect(metadata.partitionSpecs.length).toBe(1);
      expect(metadata.defaultSpecId).toBe(metadata.partitionSpecs[0]?.specId);
    });

    it('should include sort order in sortOrders array', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });

      expect(metadata.sortOrders.length).toBe(1);
      expect(metadata.defaultSortOrderId).toBe(metadata.sortOrders[0]?.orderId);
    });

    it('should set lastUpdatedMs to current timestamp', () => {
      const beforeTime = Date.now();
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });
      const afterTime = Date.now();

      expect(metadata.lastUpdatedMs).toBeGreaterThanOrEqual(beforeTime);
      expect(metadata.lastUpdatedMs).toBeLessThanOrEqual(afterTime);
    });

    it('should set lastSequenceNumber to 0 for new tables', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });

      expect(metadata.lastSequenceNumber).toBe(0);
    });

    it('should include default properties', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });

      expect(metadata.properties['write.format.default']).toBe('parquet');
      expect(metadata.properties['write.parquet.compression-codec']).toBe('snappy');
    });

    it('should include icetype source metadata', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });

      expect(metadata.properties['icetype.source.schema']).toBe(schema.name);
      expect(metadata.properties['icetype.source.version']).toBe(String(schema.version));
    });

    it('should merge custom properties', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
        properties: {
          'custom.property': 'value',
          'write.parquet.compression-codec': 'zstd', // Override default
        },
      });

      expect(metadata.properties['custom.property']).toBe('value');
      expect(metadata.properties['write.parquet.compression-codec']).toBe('zstd');
    });

    it('should track lastColumnId correctly', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });

      const maxFieldId = Math.max(...metadata.schemas[0]!.fields.map(f => f.id));
      expect(metadata.lastColumnId).toBe(maxFieldId);
    });

    it('should track lastPartitionId correctly', () => {
      const schema = createPartitionedSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/orders',
      });

      const maxPartitionId = Math.max(...metadata.partitionSpecs[0]!.fields.map(f => f.fieldId));
      expect(metadata.lastPartitionId).toBe(maxPartitionId);
    });
  });

  describe('serializeMetadata()', () => {
    it('should produce valid JSON string', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });
      const json = generator.serializeMetadata(metadata);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should produce pretty-printed JSON', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });
      const json = generator.serializeMetadata(metadata);

      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('should deserialize back to equivalent metadata', () => {
      const schema = createSimpleSchema();
      const metadata = generator.generateTableMetadata(schema, {
        location: 's3://bucket/tables/users',
      });
      const json = generator.serializeMetadata(metadata);
      const parsed = JSON.parse(json) as IcebergTableMetadata;

      expect(parsed.formatVersion).toBe(metadata.formatVersion);
      expect(parsed.tableUuid).toBe(metadata.tableUuid);
      expect(parsed.location).toBe(metadata.location);
      expect(parsed.schemas.length).toBe(metadata.schemas.length);
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createIcebergMetadataGenerator()', () => {
  it('should create a new generator instance', () => {
    const generator = createIcebergMetadataGenerator();
    expect(generator).toBeInstanceOf(IcebergMetadataGenerator);
  });
});

describe('generateIcebergMetadata()', () => {
  it('should generate metadata with location', () => {
    const schema = createSimpleSchema();
    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/users');

    expect(metadata.location).toBe('s3://bucket/tables/users');
    expect(metadata.formatVersion).toBe(2);
  });

  it('should accept optional properties', () => {
    const schema = createSimpleSchema();
    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/users', {
      'custom.key': 'custom-value',
    });

    expect(metadata.properties['custom.key']).toBe('custom-value');
  });
});
