/**
 * Tests for Parquet schema generation from IceType schemas
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema } from '@icetype/core';
import {
  ParquetSchemaGenerator,
  createParquetSchemaGenerator,
  generateParquetSchema,
  generateParquetSchemaString,
  documentToParquetRow,
} from '../parquet.js';
import type { ParquetSchema, ParquetField } from '../types.js';

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
 * Create a schema with various field types for type mapping tests
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
    openTime: 'time',
    metadata: 'json',
    data: 'binary',
    rating: 'float',
    totalSales: 'long',
    altId: 'bigint',
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
    scores: 'double[]',
  });
}

/**
 * Create a schema with optional and required fields
 */
function createRepetitionSchema() {
  return parseSchema({
    $type: 'Account',
    id: 'uuid!',
    requiredField: 'string!',
    optionalField: 'string?',
    defaultField: 'string',
  });
}

// =============================================================================
// ParquetSchemaGenerator Tests
// =============================================================================

describe('ParquetSchemaGenerator', () => {
  let generator: ParquetSchemaGenerator;

  beforeEach(() => {
    generator = new ParquetSchemaGenerator();
  });

  describe('generateSchema()', () => {
    it('should create a valid Parquet schema', () => {
      const schema = createSimpleSchema();
      const parquetSchema = generator.generateSchema(schema);

      expect(parquetSchema.name).toBe(schema.name);
      expect(Array.isArray(parquetSchema.fields)).toBe(true);
    });

    it('should include system fields ($id, $type, $version, $createdAt, $updatedAt)', () => {
      const schema = createSimpleSchema();
      const parquetSchema = generator.generateSchema(schema);

      const fieldNames = parquetSchema.fields.map(f => f.name);

      expect(fieldNames).toContain('$id');
      expect(fieldNames).toContain('$type');
      expect(fieldNames).toContain('$version');
      expect(fieldNames).toContain('$createdAt');
      expect(fieldNames).toContain('$updatedAt');
    });

    it('should set system fields as REQUIRED', () => {
      const schema = createSimpleSchema();
      const parquetSchema = generator.generateSchema(schema);

      const systemFieldNames = ['$id', '$type', '$version', '$createdAt', '$updatedAt'];
      const systemFields = parquetSchema.fields.filter(f => systemFieldNames.includes(f.name));

      for (const field of systemFields) {
        expect(field.repetition).toBe('REQUIRED');
      }
    });

    it('should assign unique sequential field IDs starting from 1', () => {
      const schema = createSimpleSchema();
      const parquetSchema = generator.generateSchema(schema);

      const ids = parquetSchema.fields.map(f => f.fieldId).filter((id): id is number => id !== undefined);
      const sortedIds = [...ids].sort((a, b) => a - b);

      expect(sortedIds[0]).toBe(1);
      for (let i = 1; i < sortedIds.length; i++) {
        expect(sortedIds[i]).toBe(sortedIds[i - 1]! + 1);
      }
    });

    it('should include user-defined fields', () => {
      const schema = createSimpleSchema();
      const parquetSchema = generator.generateSchema(schema);

      const userFieldNames = parquetSchema.fields
        .filter(f => !f.name.startsWith('$'))
        .map(f => f.name);

      expect(userFieldNames).toContain('id');
      expect(userFieldNames).toContain('email');
      expect(userFieldNames).toContain('name');
      expect(userFieldNames).toContain('age');
    });
  });

  describe('Type mappings', () => {
    describe('string -> BYTE_ARRAY UTF8', () => {
      it('should map string type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const nameField = parquetSchema.fields.find(f => f.name === 'name');
        expect(nameField?.type).toBe('BYTE_ARRAY');
        expect(nameField?.convertedType).toBe('UTF8');
        expect(nameField?.logicalType?.type).toBe('STRING');
      });

      it('should map text type to BYTE_ARRAY UTF8', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const descField = parquetSchema.fields.find(f => f.name === 'description');
        expect(descField?.type).toBe('BYTE_ARRAY');
        expect(descField?.convertedType).toBe('UTF8');
      });
    });

    describe('int -> INT32', () => {
      it('should map int type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const qtyField = parquetSchema.fields.find(f => f.name === 'quantity');
        expect(qtyField?.type).toBe('INT32');
        expect(qtyField?.convertedType).toBe('INT_32');
        expect(qtyField?.logicalType?.type).toBe('INTEGER');
        expect(qtyField?.logicalType?.precision).toBe(32);
      });
    });

    describe('long/bigint -> INT64', () => {
      it('should map long type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const salesField = parquetSchema.fields.find(f => f.name === 'totalSales');
        expect(salesField?.type).toBe('INT64');
        expect(salesField?.convertedType).toBe('INT_64');
        expect(salesField?.logicalType?.type).toBe('INTEGER');
        expect(salesField?.logicalType?.precision).toBe(64);
      });

      it('should map bigint type to INT64', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const altIdField = parquetSchema.fields.find(f => f.name === 'altId');
        expect(altIdField?.type).toBe('INT64');
      });
    });

    describe('float -> FLOAT', () => {
      it('should map float type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const ratingField = parquetSchema.fields.find(f => f.name === 'rating');
        expect(ratingField?.type).toBe('FLOAT');
      });
    });

    describe('double -> DOUBLE', () => {
      it('should map double type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const priceField = parquetSchema.fields.find(f => f.name === 'price');
        expect(priceField?.type).toBe('DOUBLE');
      });
    });

    describe('boolean -> BOOLEAN', () => {
      it('should map boolean type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const activeField = parquetSchema.fields.find(f => f.name === 'isActive');
        expect(activeField?.type).toBe('BOOLEAN');
      });
    });

    describe('uuid -> FIXED_LEN_BYTE_ARRAY(16) UUID', () => {
      it('should map uuid type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const idField = parquetSchema.fields.find(f => f.name === 'id');
        expect(idField?.type).toBe('FIXED_LEN_BYTE_ARRAY');
        expect(idField?.typeLength).toBe(16);
        expect(idField?.convertedType).toBe('UUID');
        expect(idField?.logicalType?.type).toBe('UUID');
      });
    });

    describe('timestamp -> INT64 TIMESTAMP_MILLIS', () => {
      it('should map timestamp type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const createdField = parquetSchema.fields.find(f => f.name === 'createdAt');
        expect(createdField?.type).toBe('INT64');
        expect(createdField?.convertedType).toBe('TIMESTAMP_MILLIS');
        expect(createdField?.logicalType?.type).toBe('TIMESTAMP');
        expect(createdField?.logicalType?.isAdjustedToUTC).toBe(false);
        expect(createdField?.logicalType?.unit).toBe('MILLIS');
      });

      it('should map timestamptz with UTC adjustment', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const updatedField = parquetSchema.fields.find(f => f.name === 'updatedAtTz');
        expect(updatedField?.type).toBe('INT64');
        expect(updatedField?.convertedType).toBe('TIMESTAMP_MILLIS');
        expect(updatedField?.logicalType?.isAdjustedToUTC).toBe(true);
      });
    });

    describe('date -> INT32 DATE', () => {
      it('should map date type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const dateField = parquetSchema.fields.find(f => f.name === 'releaseDate');
        expect(dateField?.type).toBe('INT32');
        expect(dateField?.convertedType).toBe('DATE');
        expect(dateField?.logicalType?.type).toBe('DATE');
      });
    });

    describe('time -> INT32 TIME_MILLIS', () => {
      it('should map time type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const timeField = parquetSchema.fields.find(f => f.name === 'openTime');
        expect(timeField?.type).toBe('INT32');
        expect(timeField?.convertedType).toBe('TIME_MILLIS');
        expect(timeField?.logicalType?.type).toBe('TIME');
      });
    });

    describe('json -> BYTE_ARRAY JSON', () => {
      it('should map json type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const metaField = parquetSchema.fields.find(f => f.name === 'metadata');
        expect(metaField?.type).toBe('BYTE_ARRAY');
        expect(metaField?.convertedType).toBe('JSON');
        expect(metaField?.logicalType?.type).toBe('JSON');
      });
    });

    describe('binary -> BYTE_ARRAY', () => {
      it('should map binary type correctly', () => {
        const schema = createTypedSchema();
        const parquetSchema = generator.generateSchema(schema);

        const dataField = parquetSchema.fields.find(f => f.name === 'data');
        expect(dataField?.type).toBe('BYTE_ARRAY');
        expect(dataField?.convertedType).toBeUndefined();
      });
    });
  });

  describe('Required/Optional field handling', () => {
    it('should set required fields (!) to REQUIRED', () => {
      const schema = createRepetitionSchema();
      const parquetSchema = generator.generateSchema(schema);

      const requiredField = parquetSchema.fields.find(f => f.name === 'requiredField');
      expect(requiredField?.repetition).toBe('REQUIRED');
    });

    it('should set optional fields (?) to OPTIONAL', () => {
      const schema = createRepetitionSchema();
      const parquetSchema = generator.generateSchema(schema);

      const optionalField = parquetSchema.fields.find(f => f.name === 'optionalField');
      expect(optionalField?.repetition).toBe('OPTIONAL');
    });

    it('should set fields without modifiers to REQUIRED by default', () => {
      const schema = createRepetitionSchema();
      const parquetSchema = generator.generateSchema(schema);

      // Fields without explicit ? modifier default to REQUIRED
      const defaultField = parquetSchema.fields.find(f => f.name === 'defaultField');
      expect(defaultField?.repetition).toBe('REQUIRED');
    });
  });

  describe('Array types (LIST)', () => {
    it('should convert array types to LIST with proper structure', () => {
      const schema = createArraySchema();
      const parquetSchema = generator.generateSchema(schema);

      const tagsField = parquetSchema.fields.find(f => f.name === 'tags');
      expect(tagsField?.convertedType).toBe('LIST');
      expect(tagsField?.logicalType?.type).toBe('LIST');
      expect(tagsField?.children).toBeDefined();
    });

    it('should create correct LIST structure with list->element nesting', () => {
      const schema = createArraySchema();
      const parquetSchema = generator.generateSchema(schema);

      const tagsField = parquetSchema.fields.find(f => f.name === 'tags');
      expect(tagsField?.children?.length).toBe(1);

      const listGroup = tagsField?.children?.[0];
      expect(listGroup?.name).toBe('list');
      expect(listGroup?.repetition).toBe('REPEATED');
      expect(listGroup?.children?.length).toBe(1);

      const element = listGroup?.children?.[0];
      expect(element?.name).toBe('element');
      expect(element?.repetition).toBe('OPTIONAL');
    });

    it('should use correct element type for string arrays', () => {
      const schema = createArraySchema();
      const parquetSchema = generator.generateSchema(schema);

      const tagsField = parquetSchema.fields.find(f => f.name === 'tags');
      const element = tagsField?.children?.[0]?.children?.[0];

      expect(element?.type).toBe('BYTE_ARRAY');
      expect(element?.convertedType).toBe('UTF8');
    });

    it('should use correct element type for int arrays', () => {
      const schema = createArraySchema();
      const parquetSchema = generator.generateSchema(schema);

      const ratingsField = parquetSchema.fields.find(f => f.name === 'ratings');
      const element = ratingsField?.children?.[0]?.children?.[0];

      expect(element?.type).toBe('INT32');
    });

    it('should use correct element type for double arrays', () => {
      const schema = createArraySchema();
      const parquetSchema = generator.generateSchema(schema);

      const scoresField = parquetSchema.fields.find(f => f.name === 'scores');
      const element = scoresField?.children?.[0]?.children?.[0];

      expect(element?.type).toBe('DOUBLE');
    });
  });

  describe('toSchemaString()', () => {
    it('should produce valid message format', () => {
      const schema = createSimpleSchema();
      const parquetSchema = generator.generateSchema(schema);
      const schemaString = generator.toSchemaString(parquetSchema);

      expect(schemaString).toMatch(/^message \w+ \{/);
      expect(schemaString).toMatch(/\}$/);
    });

    it('should include field definitions', () => {
      const schema = createSimpleSchema();
      const parquetSchema = generator.generateSchema(schema);
      const schemaString = generator.toSchemaString(parquetSchema);

      expect(schemaString).toContain('REQUIRED BYTE_ARRAY $id');
      expect(schemaString).toContain('REQUIRED BYTE_ARRAY $type');
      expect(schemaString).toContain('REQUIRED INT32 $version');
    });

    it('should include converted types in parentheses', () => {
      const schema = createSimpleSchema();
      const parquetSchema = generator.generateSchema(schema);
      const schemaString = generator.toSchemaString(parquetSchema);

      expect(schemaString).toContain('(UTF8)');
      expect(schemaString).toContain('(INT_32)');
    });

    it('should handle LIST types with group structure', () => {
      const schema = createArraySchema();
      const parquetSchema = generator.generateSchema(schema);
      const schemaString = generator.toSchemaString(parquetSchema);

      expect(schemaString).toContain('group tags (LIST)');
      expect(schemaString).toContain('REPEATED group list');
      expect(schemaString).toContain('OPTIONAL BYTE_ARRAY element');
    });

    it('should include type length for fixed-length types', () => {
      const schema = createTypedSchema();
      const parquetSchema = generator.generateSchema(schema);
      const schemaString = generator.toSchemaString(parquetSchema);

      expect(schemaString).toContain('FIXED_LEN_BYTE_ARRAY(16) id');
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createParquetSchemaGenerator()', () => {
  it('should create a new generator instance', () => {
    const generator = createParquetSchemaGenerator();
    expect(generator).toBeInstanceOf(ParquetSchemaGenerator);
  });
});

describe('generateParquetSchema()', () => {
  it('should generate schema from IceType schema', () => {
    const schema = createSimpleSchema();
    const parquetSchema = generateParquetSchema(schema);

    expect(parquetSchema.name).toBe(schema.name);
    expect(parquetSchema.fields.length).toBeGreaterThan(0);
  });
});

describe('generateParquetSchemaString()', () => {
  it('should generate schema string from IceType schema', () => {
    const schema = createSimpleSchema();
    const schemaString = generateParquetSchemaString(schema);

    expect(schemaString).toMatch(/^message User \{/);
    expect(schemaString).toContain('$id');
  });
});

// =============================================================================
// Document Conversion Tests
// =============================================================================

describe('documentToParquetRow()', () => {
  it('should convert document fields to row format', () => {
    const schema = createSimpleSchema();
    const parquetSchema = generateParquetSchema(schema);

    const doc = {
      $id: 'test-id',
      $type: 'User',
      $version: 1,
      $createdAt: Date.now(),
      $updatedAt: Date.now(),
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User',
      age: 30,
    };

    const row = documentToParquetRow(doc, parquetSchema);

    expect(row.$id).toBe('test-id');
    expect(row.$type).toBe('User');
    expect(row.email).toBe('test@example.com');
    expect(row.age).toBe(30);
  });

  it('should handle null values', () => {
    const schema = createSimpleSchema();
    const parquetSchema = generateParquetSchema(schema);

    const doc = {
      $id: 'test-id',
      $type: 'User',
      $version: 1,
      $createdAt: Date.now(),
      $updatedAt: Date.now(),
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: null,
      age: null,
    };

    const row = documentToParquetRow(doc, parquetSchema);

    expect(row.name).toBeNull();
    expect(row.age).toBeNull();
  });

  it('should handle undefined values', () => {
    const schema = createSimpleSchema();
    const parquetSchema = generateParquetSchema(schema);

    const doc = {
      $id: 'test-id',
      $type: 'User',
      $version: 1,
      $createdAt: Date.now(),
      $updatedAt: Date.now(),
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
    };

    const row = documentToParquetRow(doc, parquetSchema);

    expect(row.name).toBeNull();
    expect(row.age).toBeNull();
  });

  it('should convert Date objects to timestamps', () => {
    const schema = parseSchema({
      $type: 'Event',
      createdAt: 'timestamp',
    });
    const parquetSchema = generateParquetSchema(schema);

    const now = new Date();
    const doc = {
      $id: 'test-id',
      $type: 'Event',
      $version: 1,
      $createdAt: now.getTime(),
      $updatedAt: now.getTime(),
      createdAt: now,
    };

    const row = documentToParquetRow(doc, parquetSchema);

    expect(row.createdAt).toBe(now.getTime());
  });

  it('should convert boolean values', () => {
    const schema = parseSchema({
      $type: 'Flag',
      enabled: 'boolean',
    });
    const parquetSchema = generateParquetSchema(schema);

    const doc = {
      $id: 'test-id',
      $type: 'Flag',
      $version: 1,
      $createdAt: Date.now(),
      $updatedAt: Date.now(),
      enabled: 1, // Truthy value
    };

    const row = documentToParquetRow(doc, parquetSchema);

    expect(row.enabled).toBe(true);
  });

  it('should convert integer values', () => {
    const schema = parseSchema({
      $type: 'Counter',
      count: 'int',
    });
    const parquetSchema = generateParquetSchema(schema);

    const doc = {
      $id: 'test-id',
      $type: 'Counter',
      $version: 1,
      $createdAt: Date.now(),
      $updatedAt: Date.now(),
      count: 3.7, // Float that should be floored
    };

    const row = documentToParquetRow(doc, parquetSchema);

    expect(row.count).toBe(3);
  });

  it('should stringify JSON objects', () => {
    const schema = parseSchema({
      $type: 'Config',
      settings: 'json',
    });
    const parquetSchema = generateParquetSchema(schema);

    const doc = {
      $id: 'test-id',
      $type: 'Config',
      $version: 1,
      $createdAt: Date.now(),
      $updatedAt: Date.now(),
      settings: { key: 'value', nested: { data: 123 } },
    };

    const row = documentToParquetRow(doc, parquetSchema);

    expect(row.settings).toBe('{"key":"value","nested":{"data":123}}');
  });

  it('should convert UUID format (remove dashes)', () => {
    const schema = parseSchema({
      $type: 'Entity',
      id: 'uuid!',
    });
    const parquetSchema = generateParquetSchema(schema);

    const doc = {
      $id: 'test-id',
      $type: 'Entity',
      $version: 1,
      $createdAt: Date.now(),
      $updatedAt: Date.now(),
      id: '550e8400-e29b-41d4-a716-446655440000',
    };

    const row = documentToParquetRow(doc, parquetSchema);

    expect(row.id).toBe('550e8400e29b41d4a716446655440000');
  });

  it('should handle array values', () => {
    const schema = createArraySchema();
    const parquetSchema = generateParquetSchema(schema);

    const doc = {
      $id: 'test-id',
      $type: 'Post',
      $version: 1,
      $createdAt: Date.now(),
      $updatedAt: Date.now(),
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test Post',
      tags: ['javascript', 'typescript'],
      ratings: [5, 4, 3],
      scores: [9.5, 8.7],
    };

    const row = documentToParquetRow(doc, parquetSchema);

    expect(row.tags).toEqual(['javascript', 'typescript']);
    expect(row.ratings).toEqual([5, 4, 3]);
    expect(row.scores).toEqual([9.5, 8.7]);
  });
});
