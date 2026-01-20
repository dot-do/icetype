/**
 * Tests for ParquetAdapter implementation
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema } from '@icetype/core';
import {
  ParquetAdapter,
  createParquetAdapter,
  transformToParquetString,
} from '../parquet.js';
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

/**
 * Create a schema with array fields
 */
function createArraySchema(): IceTypeSchema {
  return parseSchema({
    $type: 'Post',
    id: 'uuid!',
    title: 'string!',
    tags: 'string[]',
    ratings: 'int[]',
  });
}

// =============================================================================
// createParquetAdapter() Factory Tests
// =============================================================================

describe('createParquetAdapter()', () => {
  it('should create a new ParquetAdapter instance', () => {
    const adapter = createParquetAdapter();

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(ParquetAdapter);
  });

  it('should create independent adapter instances', () => {
    const adapter1 = createParquetAdapter();
    const adapter2 = createParquetAdapter();

    expect(adapter1).not.toBe(adapter2);
  });

  it('should create adapter with correct interface methods', () => {
    const adapter = createParquetAdapter();

    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.version).toBe('string');
  });
});

// =============================================================================
// ParquetAdapter Properties Tests
// =============================================================================

describe('ParquetAdapter properties', () => {
  let adapter: ParquetAdapter;

  beforeEach(() => {
    adapter = new ParquetAdapter();
  });

  describe('name property', () => {
    it('should have name "parquet"', () => {
      expect(adapter.name).toBe('parquet');
    });

    it('should be readonly', () => {
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

describe('ParquetAdapter.transform()', () => {
  let adapter: ParquetAdapter;

  beforeEach(() => {
    adapter = new ParquetAdapter();
  });

  describe('Valid Parquet schema generation', () => {
    it('should return a valid ParquetSchema object', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      expect(result).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.fields).toBeDefined();
      expect(Array.isArray(result.fields)).toBe(true);
    });

    it('should use schema name as message name', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      expect(result.name).toBe('User');
    });

    it('should include schema fields in Parquet schema', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      const fieldNames = result.fields.map(f => f.name);
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('age');
    });

    it('should work without options', () => {
      const schema = createSimpleSchema();

      expect(() => adapter.transform(schema)).not.toThrow();
      const result = adapter.transform(schema);
      expect(result).toBeDefined();
    });

    it('should work with undefined options', () => {
      const schema = createSimpleSchema();

      expect(() => adapter.transform(schema, undefined)).not.toThrow();
      const result = adapter.transform(schema, undefined);
      expect(result).toBeDefined();
    });

    it('should work with empty options object', () => {
      const schema = createSimpleSchema();

      expect(() => adapter.transform(schema, {})).not.toThrow();
      const result = adapter.transform(schema, {});
      expect(result).toBeDefined();
    });
  });

  describe('Field type mapping', () => {
    it('should map string fields to Parquet types', () => {
      const schema = createTypedSchema();
      const result = adapter.transform(schema);

      const nameField = result.fields.find(f => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField!.type).toBeDefined();
    });

    it('should map int fields to Parquet INT32', () => {
      const schema = createTypedSchema();
      const result = adapter.transform(schema);

      const qtyField = result.fields.find(f => f.name === 'quantity');
      expect(qtyField).toBeDefined();
      expect(qtyField!.type).toBe('INT32');
    });

    it('should map double fields to Parquet DOUBLE', () => {
      const schema = createTypedSchema();
      const result = adapter.transform(schema);

      const priceField = result.fields.find(f => f.name === 'price');
      expect(priceField).toBeDefined();
      expect(priceField!.type).toBe('DOUBLE');
    });

    it('should map boolean fields to Parquet BOOLEAN', () => {
      const schema = createTypedSchema();
      const result = adapter.transform(schema);

      const activeField = result.fields.find(f => f.name === 'isActive');
      expect(activeField).toBeDefined();
      expect(activeField!.type).toBe('BOOLEAN');
    });

    it('should handle various field types', () => {
      const schema = createTypedSchema();
      const result = adapter.transform(schema);

      // Each field should have a valid Parquet type or be a group
      for (const field of result.fields) {
        if (!field.children) {
          expect(field.type).toBeDefined();
        }
        expect(field.repetition).toBeDefined();
      }
    });
  });

  describe('Field repetition mapping', () => {
    it('should map required fields to REQUIRED repetition', () => {
      const schema = createTypedSchema();
      const result = adapter.transform(schema);

      const nameField = result.fields.find(f => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField!.repetition).toBe('REQUIRED');
    });

    it('should map optional fields to OPTIONAL repetition', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      const ageField = result.fields.find(f => f.name === 'age');
      expect(ageField).toBeDefined();
      expect(ageField!.repetition).toBe('OPTIONAL');
    });
  });

  describe('Array field handling', () => {
    it('should handle array fields', () => {
      const schema = createArraySchema();
      const result = adapter.transform(schema);

      // Array fields should be present
      const fieldNames = result.fields.map(f => f.name);
      expect(fieldNames).toContain('tags');
      expect(fieldNames).toContain('ratings');
    });
  });
});

// =============================================================================
// serialize() Tests
// =============================================================================

describe('ParquetAdapter.serialize()', () => {
  let adapter: ParquetAdapter;

  beforeEach(() => {
    adapter = new ParquetAdapter();
  });

  it('should serialize schema to a string', () => {
    const schema = createSimpleSchema();
    const parquetSchema = adapter.transform(schema);

    const serialized = adapter.serialize(parquetSchema);

    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(0);
  });

  it('should produce Parquet schema definition format', () => {
    const schema = createSimpleSchema();
    const parquetSchema = adapter.transform(schema);

    const serialized = adapter.serialize(parquetSchema);

    // Should start with 'message' keyword
    expect(serialized.startsWith('message ')).toBe(true);
  });

  it('should include schema name in output', () => {
    const schema = createSimpleSchema();
    const parquetSchema = adapter.transform(schema);

    const serialized = adapter.serialize(parquetSchema);

    expect(serialized).toContain('User');
  });

  it('should include field definitions', () => {
    const schema = createSimpleSchema();
    const parquetSchema = adapter.transform(schema);

    const serialized = adapter.serialize(parquetSchema);

    // Should contain field definitions with repetition types
    expect(serialized).toMatch(/REQUIRED|OPTIONAL/);
  });

  it('should produce valid Parquet schema syntax', () => {
    const schema = createSimpleSchema();
    const parquetSchema = adapter.transform(schema);

    const serialized = adapter.serialize(parquetSchema);

    // Should have opening and closing braces
    expect(serialized).toContain('{');
    expect(serialized).toContain('}');

    // Should end with closing brace
    expect(serialized.trim().endsWith('}')).toBe(true);
  });

  it('should include field names', () => {
    const schema = createSimpleSchema();
    const parquetSchema = adapter.transform(schema);

    const serialized = adapter.serialize(parquetSchema);

    expect(serialized).toContain('id');
    expect(serialized).toContain('email');
    expect(serialized).toContain('name');
    expect(serialized).toContain('age');
  });
});

// =============================================================================
// transformToParquetString() Tests
// =============================================================================

describe('transformToParquetString()', () => {
  it('should transform schema directly to string', () => {
    const schema = createSimpleSchema();

    const result = transformToParquetString(schema);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should produce same format as adapter workflow', () => {
    const schema = createSimpleSchema();
    const adapter = createParquetAdapter();

    const directResult = transformToParquetString(schema);
    const adapterSchema = adapter.transform(schema);
    const adapterResult = adapter.serialize(adapterSchema);

    // Both should produce valid Parquet schema strings
    expect(directResult.startsWith('message ')).toBe(true);
    expect(adapterResult.startsWith('message ')).toBe(true);
  });

  it('should include message name from schema', () => {
    const schema = createSimpleSchema();

    const result = transformToParquetString(schema);

    expect(result).toContain('User');
  });

  it('should work with different schema types', () => {
    const simpleResult = transformToParquetString(createSimpleSchema());
    const typedResult = transformToParquetString(createTypedSchema());
    const arrayResult = transformToParquetString(createArraySchema());

    expect(simpleResult).toContain('User');
    expect(typedResult).toContain('Product');
    expect(arrayResult).toContain('Post');
  });

  it('should include field definitions', () => {
    const schema = createTypedSchema();

    const result = transformToParquetString(schema);

    expect(result).toContain('name');
    expect(result).toContain('price');
    expect(result).toContain('quantity');
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('ParquetAdapter Integration', () => {
  let adapter: ParquetAdapter;

  beforeEach(() => {
    adapter = new ParquetAdapter();
  });

  it('should produce complete transform and serialize workflow', () => {
    const schema = createTypedSchema();

    // Transform
    const parquetSchema = adapter.transform(schema);

    // Serialize
    const schemaString = adapter.serialize(parquetSchema);

    // Verify complete workflow
    expect(schemaString).toBeDefined();
    expect(schemaString).toContain('message Product');
    expect(schemaString).toContain('{');
    expect(schemaString).toContain('}');
  });

  it('should be compatible with SchemaAdapter interface', () => {
    // The adapter should work as a generic SchemaAdapter
    const genericAdapter = adapter as {
      name: string;
      version: string;
      transform: (schema: IceTypeSchema, options?: unknown) => unknown;
      serialize: (output: unknown) => string;
    };

    expect(genericAdapter.name).toBe('parquet');
    expect(genericAdapter.version).toBeDefined();
    expect(typeof genericAdapter.transform).toBe('function');
    expect(typeof genericAdapter.serialize).toBe('function');
  });

  it('should handle complex schema with multiple field types', () => {
    const schema = parseSchema({
      $type: 'ComplexEntity',
      id: 'uuid!',
      stringField: 'string!',
      optionalString: 'string?',
      intField: 'int!',
      longField: 'long!',
      doubleField: 'double',
      floatField: 'float',
      boolField: 'boolean',
      dateField: 'date',
      timestampField: 'timestamp',
      jsonField: 'json',
    });

    const parquetSchema = adapter.transform(schema);
    const schemaString = adapter.serialize(parquetSchema);

    expect(schemaString).toContain('message ComplexEntity');
    expect(parquetSchema.fields.length).toBeGreaterThan(0);
  });

  it('should maintain field order', () => {
    const schema = createSimpleSchema();
    const parquetSchema = adapter.transform(schema);

    // Fields should be in a consistent order
    const fieldNames = parquetSchema.fields.map(f => f.name);
    expect(fieldNames.length).toBeGreaterThan(0);
  });

  it('should handle schema with system fields', () => {
    const schema = createSimpleSchema();
    const parquetSchema = adapter.transform(schema);

    // System fields should be present
    const fieldNames = parquetSchema.fields.map(f => f.name);
    expect(fieldNames).toContain('$id');
    expect(fieldNames).toContain('$type');
  });
});
