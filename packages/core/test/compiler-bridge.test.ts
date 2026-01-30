/**
 * Compiler Bridge Tests
 *
 * Tests for the compiler bridge between GraphDL ParsedField and IceType FieldDefinition.
 * Covers parametric types, generic types, and default value handling.
 *
 * These tests create ParsedField objects manually (with the new fields that GraphDL
 * will add for parser unification) and verify the bridge correctly maps them to
 * IceType FieldDefinition objects.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import type { ParsedField, ParsedEntity } from '@graphdl/core';
import { entityToIceType } from '../src/compiler.js';

/**
 * Helper to create a minimal ParsedEntity from a map of ParsedFields.
 * This allows testing fieldToDefinition() indirectly via entityToIceType().
 */
function makeEntity(name: string, fields: Record<string, Partial<ParsedField>>): ParsedEntity {
  const fieldMap = new Map<string, ParsedField>();
  for (const [fieldName, partialField] of Object.entries(fields)) {
    fieldMap.set(fieldName, {
      name: fieldName,
      type: 'string',
      isArray: false,
      isOptional: false,
      isRelation: false,
      ...partialField,
    } as ParsedField);
  }
  return {
    name,
    fields: fieldMap,
  };
}

describe('Compiler Bridge', () => {
  // ===========================================================================
  // Parametric Type Handling
  // ===========================================================================
  describe('parametric type handling', () => {
    it('should map precision and scale from ParsedField to FieldDefinition for decimal', () => {
      const entity = makeEntity('Transaction', {
        amount: {
          type: 'decimal',
          precision: 10,
          scale: 2,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('amount')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('decimal');
      expect(field.precision).toBe(10);
      expect(field.scale).toBe(2);
    });

    it('should map length from ParsedField to FieldDefinition for varchar', () => {
      const entity = makeEntity('User', {
        name: {
          type: 'varchar',
          length: 255,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('name')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('varchar');
      expect(field.length).toBe(255);
    });

    it('should map length from ParsedField to FieldDefinition for char', () => {
      const entity = makeEntity('Country', {
        code: {
          type: 'char',
          length: 2,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('code')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('char');
      expect(field.length).toBe(2);
    });

    it('should map length from ParsedField to FieldDefinition for fixed', () => {
      const entity = makeEntity('Hash', {
        sha256: {
          type: 'fixed',
          length: 32,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('sha256')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('fixed');
      expect(field.length).toBe(32);
    });

    it('should handle decimal with only precision (no scale)', () => {
      const entity = makeEntity('Measurement', {
        value: {
          type: 'decimal',
          precision: 18,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('value')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('decimal');
      expect(field.precision).toBe(18);
      expect(field.scale).toBeUndefined();
    });

    it('should not set parametric fields when they are absent', () => {
      const entity = makeEntity('Simple', {
        label: {
          type: 'string',
        },
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('label')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('string');
      expect(field.precision).toBeUndefined();
      expect(field.scale).toBeUndefined();
      expect(field.length).toBeUndefined();
    });
  });

  // ===========================================================================
  // Generic Type Handling
  // ===========================================================================
  describe('generic type handling', () => {
    it('should map keyType and valueType from ParsedField for map type', () => {
      const entity = makeEntity('Config', {
        settings: {
          type: 'map',
          keyType: 'string',
          valueType: 'int',
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('settings')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('map');
      expect(field.keyType).toBe('string');
      expect(field.valueType).toBe('int');
    });

    it('should map structName from ParsedField for struct type', () => {
      const entity = makeEntity('Order', {
        shippingAddress: {
          type: 'struct',
          structName: 'Address',
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('shippingAddress')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('struct');
      expect(field.structName).toBe('Address');
    });

    it('should map enumName from ParsedField for enum type', () => {
      const entity = makeEntity('Task', {
        status: {
          type: 'enum',
          enumName: 'Status',
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('status')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('enum');
      expect(field.enumName).toBe('Status');
    });

    it('should map refTarget from ParsedField for ref type', () => {
      const entity = makeEntity('Comment', {
        parentRef: {
          type: 'ref',
          refTarget: 'Post',
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('parentRef')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('ref');
      expect(field.refTarget).toBe('Post');
    });

    it('should map elementType from ParsedField for list type', () => {
      const entity = makeEntity('Playlist', {
        trackIds: {
          type: 'list',
          elementType: 'string',
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('trackIds')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('list');
      expect(field.elementType).toBe('string');
    });

    it('should not set generic fields when they are absent', () => {
      const entity = makeEntity('Simple', {
        value: {
          type: 'int',
        },
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('value')!;

      expect(field).toBeDefined();
      expect(field.keyType).toBeUndefined();
      expect(field.valueType).toBeUndefined();
      expect(field.structName).toBeUndefined();
      expect(field.enumName).toBeUndefined();
      expect(field.refTarget).toBeUndefined();
      expect(field.elementType).toBeUndefined();
    });

    it('should handle map type with complex valueType', () => {
      const entity = makeEntity('Analytics', {
        counters: {
          type: 'map',
          keyType: 'string',
          valueType: 'long',
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('counters')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('map');
      expect(field.keyType).toBe('string');
      expect(field.valueType).toBe('long');
    });
  });

  // ===========================================================================
  // Default Value Handling
  // ===========================================================================
  describe('default value handling', () => {
    it('should map string default from ParsedField to defaultValue', () => {
      const entity = makeEntity('Account', {
        status: {
          type: 'string',
          default: 'active',
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('status')!;

      expect(field).toBeDefined();
      expect(field.defaultValue).toBe('active');
    });

    it('should map function default from ParsedField to defaultValue', () => {
      const entity = makeEntity('Event', {
        createdAt: {
          type: 'timestamp',
          default: { function: 'now' },
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('createdAt')!;

      expect(field).toBeDefined();
      expect(field.defaultValue).toEqual({ function: 'now' });
    });

    it('should map numeric default from ParsedField to defaultValue', () => {
      const entity = makeEntity('Counter', {
        count: {
          type: 'int',
          default: 42,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('count')!;

      expect(field).toBeDefined();
      expect(field.defaultValue).toBe(42);
    });

    it('should map boolean default from ParsedField to defaultValue', () => {
      const entity = makeEntity('Feature', {
        enabled: {
          type: 'boolean',
          default: false,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('enabled')!;

      expect(field).toBeDefined();
      expect(field.defaultValue).toBe(false);
    });

    it('should map null default from ParsedField to defaultValue', () => {
      const entity = makeEntity('Profile', {
        bio: {
          type: 'string',
          isOptional: true,
          default: null,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('bio')!;

      expect(field).toBeDefined();
      expect(field.defaultValue).toBeNull();
    });

    it('should not set defaultValue when default is absent', () => {
      const entity = makeEntity('Simple', {
        name: {
          type: 'string',
        },
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('name')!;

      expect(field).toBeDefined();
      expect(field.defaultValue).toBeUndefined();
    });
  });

  // ===========================================================================
  // Combined Scenarios
  // ===========================================================================
  describe('combined scenarios', () => {
    it('should handle parametric type with default value', () => {
      const entity = makeEntity('Product', {
        price: {
          type: 'decimal',
          precision: 10,
          scale: 2,
          default: 0,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('price')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('decimal');
      expect(field.precision).toBe(10);
      expect(field.scale).toBe(2);
      expect(field.defaultValue).toBe(0);
    });

    it('should handle generic type with modifiers', () => {
      const entity = makeEntity('Schema', {
        tags: {
          type: 'list',
          elementType: 'string',
          isArray: false,
          isOptional: true,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);
      const field = schema.fields.get('tags')!;

      expect(field).toBeDefined();
      expect(field.type).toBe('list');
      expect(field.elementType).toBe('string');
      expect(field.isOptional).toBe(true);
    });

    it('should handle entity with mixed field types', () => {
      const entity = makeEntity('FullEntity', {
        id: {
          type: 'uuid',
          isRequired: true,
          isUnique: true,
        },
        name: {
          type: 'varchar',
          length: 100,
        } as Partial<ParsedField>,
        amount: {
          type: 'decimal',
          precision: 18,
          scale: 4,
        } as Partial<ParsedField>,
        metadata: {
          type: 'map',
          keyType: 'string',
          valueType: 'json',
        } as Partial<ParsedField>,
        status: {
          type: 'enum',
          enumName: 'EntityStatus',
          default: 'draft',
        } as Partial<ParsedField>,
        items: {
          type: 'list',
          elementType: 'int',
          isArray: false,
        } as Partial<ParsedField>,
      });

      const schema = entityToIceType(entity);

      // Verify all fields were converted
      expect(schema.fields.size).toBe(6);

      // Check each field type
      const idField = schema.fields.get('id')!;
      expect(idField.type).toBe('uuid');
      expect(idField.isUnique).toBe(true);

      const nameField = schema.fields.get('name')!;
      expect(nameField.type).toBe('varchar');
      expect(nameField.length).toBe(100);

      const amountField = schema.fields.get('amount')!;
      expect(amountField.type).toBe('decimal');
      expect(amountField.precision).toBe(18);
      expect(amountField.scale).toBe(4);

      const metadataField = schema.fields.get('metadata')!;
      expect(metadataField.type).toBe('map');
      expect(metadataField.keyType).toBe('string');
      expect(metadataField.valueType).toBe('json');

      const statusField = schema.fields.get('status')!;
      expect(statusField.type).toBe('enum');
      expect(statusField.enumName).toBe('EntityStatus');
      expect(statusField.defaultValue).toBe('draft');

      const itemsField = schema.fields.get('items')!;
      expect(itemsField.type).toBe('list');
      expect(itemsField.elementType).toBe('int');
    });
  });
});
