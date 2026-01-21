/**
 * Type Guard Functions Tests for @icetype/core
 *
 * Tests for branded type creation functions.
 * These functions create type-safe identifiers for schemas, fields, and relations.
 */

import { describe, it, expect } from 'vitest';
import {
  createSchemaId,
  createFieldId,
  createRelationId,
  type SchemaId,
  type FieldId,
  type RelationId,
} from '../types.js';

// =============================================================================
// createSchemaId Tests
// =============================================================================

describe('createSchemaId', () => {
  it('should create a SchemaId from a valid string', () => {
    const id = createSchemaId('user-schema');
    expect(id).toBe('user-schema');
    // TypeScript ensures the returned value is branded as SchemaId
    const schemaId: SchemaId = id;
    expect(schemaId).toBe('user-schema');
  });

  it('should throw for empty string', () => {
    expect(() => createSchemaId('')).toThrow('Invalid SchemaId');
  });

  it('should create a SchemaId from a string with special characters', () => {
    const id = createSchemaId('user_schema-v2.1');
    expect(id).toBe('user_schema-v2.1');
  });

  it('should create a SchemaId from a string with unicode characters', () => {
    const id = createSchemaId('schema-\u00e9v\u00e9nement');
    expect(id).toBe('schema-\u00e9v\u00e9nement');
  });

  it('should create a SchemaId from a string with numbers', () => {
    const id = createSchemaId('schema123');
    expect(id).toBe('schema123');
  });

  it('should create a SchemaId from a very long string', () => {
    const longString = 'a'.repeat(1000);
    const id = createSchemaId(longString);
    expect(id).toBe(longString);
    expect(id.length).toBe(1000);
  });

  it('should create a SchemaId from a string with whitespace', () => {
    const id = createSchemaId('  spaced schema  ');
    expect(id).toBe('  spaced schema  ');
  });

  it('should create a SchemaId from a string with newlines', () => {
    const id = createSchemaId('schema\nwith\nnewlines');
    expect(id).toBe('schema\nwith\nnewlines');
  });

  it('should preserve string type at runtime', () => {
    const id = createSchemaId('test');
    expect(typeof id).toBe('string');
  });
});

// =============================================================================
// createFieldId Tests
// =============================================================================

describe('createFieldId', () => {
  it('should create a FieldId from a positive number', () => {
    const id = createFieldId(42);
    expect(id).toBe(42);
    // TypeScript ensures the returned value is branded as FieldId
    const fieldId: FieldId = id;
    expect(fieldId).toBe(42);
  });

  it('should create a FieldId from zero', () => {
    const id = createFieldId(0);
    expect(id).toBe(0);
  });

  it('should throw for negative number', () => {
    expect(() => createFieldId(-1)).toThrow('Invalid FieldId');
  });

  it('should create a FieldId from a very large number', () => {
    const id = createFieldId(Number.MAX_SAFE_INTEGER);
    expect(id).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should throw for very small (negative) number', () => {
    expect(() => createFieldId(Number.MIN_SAFE_INTEGER)).toThrow('Invalid FieldId');
  });

  it('should throw for floating point number', () => {
    expect(() => createFieldId(3.14)).toThrow('Invalid FieldId');
  });

  it('should throw for NaN', () => {
    expect(() => createFieldId(NaN)).toThrow('Invalid FieldId');
  });

  it('should throw for Infinity', () => {
    expect(() => createFieldId(Infinity)).toThrow('Invalid FieldId');
  });

  it('should throw for negative Infinity', () => {
    expect(() => createFieldId(-Infinity)).toThrow('Invalid FieldId');
  });

  it('should preserve number type at runtime', () => {
    const id = createFieldId(42);
    expect(typeof id).toBe('number');
  });
});

// =============================================================================
// createRelationId Tests
// =============================================================================

describe('createRelationId', () => {
  it('should create a RelationId from a valid string', () => {
    const id = createRelationId('user-posts');
    expect(id).toBe('user-posts');
    // TypeScript ensures the returned value is branded as RelationId
    const relationId: RelationId = id;
    expect(relationId).toBe('user-posts');
  });

  it('should throw for empty string', () => {
    expect(() => createRelationId('')).toThrow('Invalid RelationId');
  });

  it('should create a RelationId from a string with special characters', () => {
    const id = createRelationId('user->posts');
    expect(id).toBe('user->posts');
  });

  it('should create a RelationId from a string with unicode characters', () => {
    const id = createRelationId('relation-\u00e9l\u00e8ve-cours');
    expect(id).toBe('relation-\u00e9l\u00e8ve-cours');
  });

  it('should create a RelationId from a string with relation operators', () => {
    const id = createRelationId('author~>books<-publisher');
    expect(id).toBe('author~>books<-publisher');
  });

  it('should create a RelationId from a very long string', () => {
    const longString = 'rel_'.repeat(250);
    const id = createRelationId(longString);
    expect(id).toBe(longString);
    expect(id.length).toBe(1000);
  });

  it('should create a RelationId from a string with whitespace', () => {
    const id = createRelationId('  spaced relation  ');
    expect(id).toBe('  spaced relation  ');
  });

  it('should preserve string type at runtime', () => {
    const id = createRelationId('test');
    expect(typeof id).toBe('string');
  });
});

// =============================================================================
// Type Guard Runtime Behavior Tests
// =============================================================================

describe('Type Guard Runtime Behavior', () => {
  it('should maintain string identity for SchemaId', () => {
    const original = 'test-schema';
    const id = createSchemaId(original);
    expect(id === original).toBe(true);
  });

  it('should maintain number identity for FieldId', () => {
    const original = 42;
    const id = createFieldId(original);
    expect(id === original).toBe(true);
  });

  it('should maintain string identity for RelationId', () => {
    const original = 'test-relation';
    const id = createRelationId(original);
    expect(id === original).toBe(true);
  });

  it('should allow SchemaId in string operations', () => {
    const id = createSchemaId('user');
    expect(id.toUpperCase()).toBe('USER');
    expect(id.length).toBe(4);
    expect(id.startsWith('us')).toBe(true);
  });

  it('should allow FieldId in number operations', () => {
    const id = createFieldId(10);
    expect(id + 5).toBe(15);
    expect(id * 2).toBe(20);
    expect(Math.sqrt(id)).toBeCloseTo(3.162, 2);
  });

  it('should allow RelationId in string operations', () => {
    const id = createRelationId('user-posts');
    expect(id.split('-')).toEqual(['user', 'posts']);
    expect(id.includes('posts')).toBe(true);
    expect(id.replace('user', 'author')).toBe('author-posts');
  });

  it('should allow comparison between branded and unbranded values', () => {
    const schemaId = createSchemaId('test');
    const fieldId = createFieldId(42);
    const relationId = createRelationId('rel');

    // These comparisons work because branded types are structurally compatible
    expect(schemaId === 'test').toBe(true);
    expect(fieldId === 42).toBe(true);
    expect(relationId === 'rel').toBe(true);
  });
});

// =============================================================================
// Edge Cases and Boundary Tests
// =============================================================================

describe('Edge Cases', () => {
  describe('SchemaId edge cases', () => {
    it('should handle null-like string values', () => {
      const id = createSchemaId('null');
      expect(id).toBe('null');
    });

    it('should handle undefined-like string values', () => {
      const id = createSchemaId('undefined');
      expect(id).toBe('undefined');
    });

    it('should throw for string with only whitespace', () => {
      expect(() => createSchemaId('   ')).toThrow('Invalid SchemaId');
    });

    it('should handle string with null character', () => {
      const id = createSchemaId('test\0schema');
      expect(id).toBe('test\0schema');
      expect(id.length).toBe(11);
    });
  });

  describe('FieldId edge cases', () => {
    it('should handle -0', () => {
      const id = createFieldId(-0);
      expect(id).toBe(-0);
      expect(Object.is(id, -0)).toBe(true);
    });

    it('should throw for Number.EPSILON (not an integer)', () => {
      expect(() => createFieldId(Number.EPSILON)).toThrow('Invalid FieldId');
    });

    it('should handle numbers beyond safe integer range', () => {
      const beyondSafe = Number.MAX_SAFE_INTEGER + 1;
      const id = createFieldId(beyondSafe);
      // Note: This may lose precision due to JavaScript's number handling
      expect(id).toBe(beyondSafe);
    });
  });

  describe('RelationId edge cases', () => {
    it('should handle JSON-like strings', () => {
      const id = createRelationId('{"type": "relation"}');
      expect(id).toBe('{"type": "relation"}');
    });

    it('should handle SQL-like strings', () => {
      const id = createRelationId("SELECT * FROM users; --");
      expect(id).toBe("SELECT * FROM users; --");
    });

    it('should handle HTML-like strings', () => {
      const id = createRelationId('<script>alert("xss")</script>');
      expect(id).toBe('<script>alert("xss")</script>');
    });
  });
});

// =============================================================================
// Type Discrimination Tests (compile-time verified at runtime)
// =============================================================================

describe('Type Discrimination', () => {
  it('should not mix SchemaId and RelationId at runtime type checks', () => {
    const schemaId = createSchemaId('schema');
    const relationId = createRelationId('relation');

    // Both are strings at runtime
    expect(typeof schemaId).toBe('string');
    expect(typeof relationId).toBe('string');

    // But they hold different values
    expect(schemaId).not.toBe(relationId);
  });

  it('should distinguish FieldId from string IDs by type', () => {
    const fieldId = createFieldId(1);
    const schemaId = createSchemaId('schema1');

    expect(typeof fieldId).toBe('number');
    expect(typeof schemaId).toBe('string');
  });
});
