/**
 * Adapter Types Tests for @icetype/adapters
 *
 * Tests for the SchemaAdapter interface contract.
 */

import { describe, it, expect } from 'vitest';
import type {
  SchemaAdapter,
  AdapterRegistry,
  IcebergAdapterOptions,
  ParquetAdapterOptions,
} from '../src/types.js';
import type { IceTypeSchema } from '@icetype/core';

// =============================================================================
// SchemaAdapter Interface Contract Tests
// =============================================================================

describe('SchemaAdapter interface', () => {
  describe('required properties', () => {
    it('should require name property', () => {
      const adapter: SchemaAdapter = {
        name: 'test-adapter',
        version: '1.0.0',
        transform: () => ({}),
        serialize: () => '',
      };

      expect(adapter.name).toBe('test-adapter');
    });

    it('should require version property', () => {
      const adapter: SchemaAdapter = {
        name: 'test',
        version: '2.5.1',
        transform: () => ({}),
        serialize: () => '',
      };

      expect(adapter.version).toBe('2.5.1');
    });

    it('should require transform method', () => {
      const mockSchema: IceTypeSchema = {
        $type: 'TestEntity',
        fields: {},
        directives: {},
      };

      const adapter: SchemaAdapter<{ result: string }> = {
        name: 'test',
        version: '1.0.0',
        transform: (schema) => ({ result: schema.$type }),
        serialize: () => '',
      };

      const output = adapter.transform(mockSchema);
      expect(output.result).toBe('TestEntity');
    });

    it('should require serialize method', () => {
      const adapter: SchemaAdapter<{ data: string }> = {
        name: 'test',
        version: '1.0.0',
        transform: () => ({ data: 'test' }),
        serialize: (output) => JSON.stringify(output),
      };

      const serialized = adapter.serialize({ data: 'hello' });
      expect(serialized).toBe('{"data":"hello"}');
    });
  });

  describe('optional properties', () => {
    it('should allow optional serializeWithIndexes method', () => {
      const adapter: SchemaAdapter<{ sql: string; indexes: string[] }> = {
        name: 'sql-adapter',
        version: '1.0.0',
        transform: () => ({ sql: 'CREATE TABLE', indexes: ['CREATE INDEX'] }),
        serialize: (output) => output.sql,
        serializeWithIndexes: (output) => [output.sql, ...output.indexes].join(';\n'),
      };

      const output = { sql: 'CREATE TABLE t', indexes: ['CREATE INDEX idx'] };
      expect(adapter.serialize(output)).toBe('CREATE TABLE t');
      expect(adapter.serializeWithIndexes?.(output)).toBe('CREATE TABLE t;\nCREATE INDEX idx');
    });

    it('should work without serializeWithIndexes', () => {
      const adapter: SchemaAdapter = {
        name: 'basic',
        version: '1.0.0',
        transform: () => ({}),
        serialize: () => 'output',
      };

      expect(adapter.serializeWithIndexes).toBeUndefined();
    });
  });

  describe('generic type parameters', () => {
    it('should accept typed output', () => {
      interface MyOutput {
        tableName: string;
        columns: string[];
      }

      const adapter: SchemaAdapter<MyOutput> = {
        name: 'typed-output',
        version: '1.0.0',
        transform: (schema): MyOutput => ({
          tableName: schema.$type,
          columns: Object.keys(schema.fields),
        }),
        serialize: (output) => output.columns.join(','),
      };

      const schema: IceTypeSchema = {
        $type: 'User',
        fields: { id: { type: 'uuid' }, name: { type: 'string' } },
        directives: {},
      };

      const output = adapter.transform(schema);
      expect(output.tableName).toBe('User');
      expect(output.columns).toContain('id');
      expect(output.columns).toContain('name');
    });

    it('should accept typed options', () => {
      interface MyOptions {
        prefix: string;
        includeTimestamps: boolean;
      }

      const adapter: SchemaAdapter<string, MyOptions> = {
        name: 'options-adapter',
        version: '1.0.0',
        transform: (schema, options) => {
          const prefix = options?.prefix ?? '';
          return `${prefix}${schema.$type}`;
        },
        serialize: (output) => output,
      };

      const schema: IceTypeSchema = {
        $type: 'Product',
        fields: {},
        directives: {},
      };

      expect(adapter.transform(schema, { prefix: 'tbl_', includeTimestamps: true })).toBe('tbl_Product');
      expect(adapter.transform(schema)).toBe('Product');
    });
  });

  describe('transform method behavior', () => {
    it('should receive IceTypeSchema as first argument', () => {
      let receivedSchema: IceTypeSchema | undefined;

      const adapter: SchemaAdapter = {
        name: 'test',
        version: '1.0.0',
        transform: (schema) => {
          receivedSchema = schema;
          return {};
        },
        serialize: () => '',
      };

      const inputSchema: IceTypeSchema = {
        $type: 'TestType',
        fields: { field1: { type: 'string' } },
        directives: { $partitionBy: 'field1' },
      };

      adapter.transform(inputSchema);

      expect(receivedSchema).toBeDefined();
      expect(receivedSchema?.$type).toBe('TestType');
      expect(receivedSchema?.fields.field1).toBeDefined();
      expect(receivedSchema?.directives.$partitionBy).toBe('field1');
    });

    it('should receive options as optional second argument', () => {
      let receivedOptions: unknown;

      const adapter: SchemaAdapter<unknown, { setting: string }> = {
        name: 'test',
        version: '1.0.0',
        transform: (_, options) => {
          receivedOptions = options;
          return {};
        },
        serialize: () => '',
      };

      const schema: IceTypeSchema = { $type: 'T', fields: {}, directives: {} };

      adapter.transform(schema, { setting: 'value' });
      expect(receivedOptions).toEqual({ setting: 'value' });

      adapter.transform(schema);
      expect(receivedOptions).toBeUndefined();
    });
  });
});

// =============================================================================
// AdapterRegistry Interface Contract Tests
// =============================================================================

describe('AdapterRegistry interface', () => {
  it('should define register method accepting SchemaAdapter', () => {
    // This test verifies the interface contract at compile time
    const registry: AdapterRegistry = {
      register: (_adapter: SchemaAdapter) => {},
      get: () => undefined,
      list: () => [],
      has: () => false,
      unregister: () => false,
      clear: () => {},
    };

    expect(typeof registry.register).toBe('function');
  });

  it('should define get method returning SchemaAdapter or undefined', () => {
    const mockAdapter: SchemaAdapter = {
      name: 'mock',
      version: '1.0.0',
      transform: () => ({}),
      serialize: () => '',
    };

    const registry: AdapterRegistry = {
      register: () => {},
      get: (name) => (name === 'mock' ? mockAdapter : undefined),
      list: () => ['mock'],
      has: (name) => name === 'mock',
      unregister: () => false,
      clear: () => {},
    };

    expect(registry.get('mock')).toBe(mockAdapter);
    expect(registry.get('other')).toBeUndefined();
  });

  it('should define list method returning string array', () => {
    const registry: AdapterRegistry = {
      register: () => {},
      get: () => undefined,
      list: () => ['adapter1', 'adapter2'],
      has: () => false,
      unregister: () => false,
      clear: () => {},
    };

    const result = registry.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(['adapter1', 'adapter2']);
  });

  it('should define has method returning boolean', () => {
    const registry: AdapterRegistry = {
      register: () => {},
      get: () => undefined,
      list: () => [],
      has: (name) => name === 'exists',
      unregister: () => false,
      clear: () => {},
    };

    expect(registry.has('exists')).toBe(true);
    expect(registry.has('missing')).toBe(false);
  });

  it('should define unregister method returning boolean', () => {
    const registry: AdapterRegistry = {
      register: () => {},
      get: () => undefined,
      list: () => [],
      has: () => false,
      unregister: (name) => name === 'removable',
      clear: () => {},
    };

    expect(registry.unregister('removable')).toBe(true);
    expect(registry.unregister('missing')).toBe(false);
  });

  it('should define clear method returning void', () => {
    let cleared = false;
    const registry: AdapterRegistry = {
      register: () => {},
      get: () => undefined,
      list: () => [],
      has: () => false,
      unregister: () => false,
      clear: () => {
        cleared = true;
      },
    };

    const result = registry.clear();
    expect(result).toBeUndefined();
    expect(cleared).toBe(true);
  });
});

// =============================================================================
// IcebergAdapterOptions Interface Tests
// =============================================================================

describe('IcebergAdapterOptions interface', () => {
  it('should require location property', () => {
    const options: IcebergAdapterOptions = {
      location: 's3://my-bucket/tables/users',
    };

    expect(options.location).toBe('s3://my-bucket/tables/users');
  });

  it('should allow optional tableUuid property', () => {
    const options: IcebergAdapterOptions = {
      location: 's3://bucket/table',
      tableUuid: '550e8400-e29b-41d4-a716-446655440000',
    };

    expect(options.tableUuid).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should allow optional properties map', () => {
    const options: IcebergAdapterOptions = {
      location: 's3://bucket/table',
      properties: {
        'write.format.default': 'parquet',
        'write.target-file-size-bytes': '536870912',
      },
    };

    expect(options.properties?.['write.format.default']).toBe('parquet');
  });

  it('should work with only required properties', () => {
    const options: IcebergAdapterOptions = {
      location: 'gs://my-gcs-bucket/warehouse/table',
    };

    expect(options.tableUuid).toBeUndefined();
    expect(options.properties).toBeUndefined();
  });
});

// =============================================================================
// ParquetAdapterOptions Interface Tests
// =============================================================================

describe('ParquetAdapterOptions interface', () => {
  it('should allow optional format property', () => {
    const objectFormat: ParquetAdapterOptions = {
      format: 'object',
    };

    const stringFormat: ParquetAdapterOptions = {
      format: 'string',
    };

    expect(objectFormat.format).toBe('object');
    expect(stringFormat.format).toBe('string');
  });

  it('should allow empty options', () => {
    const options: ParquetAdapterOptions = {};

    expect(options.format).toBeUndefined();
  });

  it('should only accept valid format values', () => {
    // This is a compile-time check - the following should be the only valid values
    const validFormats: Array<ParquetAdapterOptions['format']> = ['object', 'string', undefined];
    expect(validFormats).toContain('object');
    expect(validFormats).toContain('string');
    expect(validFormats).toContain(undefined);
  });
});
