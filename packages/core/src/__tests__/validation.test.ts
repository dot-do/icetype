/**
 * Schema Validation Tests for @icetype/core
 *
 * Tests for schema validation functionality.
 */

import { describe, it, expect } from 'vitest';
import { parseSchema, validateSchema } from '../parser.js';
import type { IceTypeSchema, ValidationResult } from '../types.js';

// =============================================================================
// Valid Schema Tests
// =============================================================================

describe('validateSchema', () => {
  describe('valid schemas', () => {
    it('should validate a minimal valid schema', () => {
      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with all primitive types', () => {
      const schema = parseSchema({
        $type: 'AllTypes',
        stringField: 'string',
        intField: 'int',
        floatField: 'float',
        boolField: 'bool',
        uuidField: 'uuid',
        timestampField: 'timestamp',
        dateField: 'date',
        jsonField: 'json',
        textField: 'text',
        binaryField: 'binary',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with modifiers', () => {
      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        email: 'string#',
        nickname: 'string?',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with arrays', () => {
      const schema = parseSchema({
        $type: 'Article',
        tags: 'string[]',
        scores: 'int[]',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with default values', () => {
      const schema = parseSchema({
        $type: 'Config',
        enabled: 'bool = true',
        count: 'int = 0',
        status: 'string = "active"',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with relations', () => {
      const schema = parseSchema({
        $type: 'Post',
        author: '-> User',
        comments: '<- Comment.post',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with valid directives', () => {
      const schema = parseSchema({
        $type: 'User',
        $partitionBy: ['id'],
        $index: [['email'], ['createdAt']],
        id: 'uuid!',
        email: 'string#',
        createdAt: 'timestamp',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with FTS directive', () => {
      const schema = parseSchema({
        $type: 'Article',
        $fts: ['title', 'content'],
        title: 'string',
        content: 'text',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with vector directive', () => {
      const schema = parseSchema({
        $type: 'Document',
        $vector: { embedding: 1536 },
        content: 'text',
        embedding: 'json',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // =============================================================================
  // Invalid Field Types Tests
  // =============================================================================

  describe('invalid field types', () => {
    it('should fail on unknown type', () => {
      const schema = parseSchema({
        $type: 'User',
        field: 'unknownType',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_TYPE')).toBe(true);
    });

    it('should report error path for unknown type', () => {
      const schema = parseSchema({
        $type: 'User',
        badField: 'nonexistent',
      });

      const result = validateSchema(schema);
      const error = result.errors.find((e) => e.code === 'UNKNOWN_TYPE');
      expect(error?.path).toBe('badField');
      expect(error?.message).toContain('Unknown type');
    });

    it('should report multiple unknown types', () => {
      const schema = parseSchema({
        $type: 'User',
        field1: 'badType1',
        field2: 'badType2',
        field3: 'string', // valid
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      const unknownTypeErrors = result.errors.filter((e) => e.code === 'UNKNOWN_TYPE');
      expect(unknownTypeErrors.length).toBe(2);
    });
  });

  // =============================================================================
  // Directive Validation Tests
  // =============================================================================

  describe('directive validation', () => {
    describe('partition field validation', () => {
      it('should fail when partition field does not exist', () => {
        const schema = parseSchema({
          $type: 'User',
          $partitionBy: ['nonExistentField'],
          id: 'uuid!',
        });

        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'UNKNOWN_PARTITION_FIELD')).toBe(true);
      });

      it('should report correct path for missing partition field', () => {
        const schema = parseSchema({
          $type: 'User',
          $partitionBy: ['missingKey'],
          id: 'uuid!',
        });

        const result = validateSchema(schema);
        const error = result.errors.find((e) => e.code === 'UNKNOWN_PARTITION_FIELD');
        expect(error?.path).toBe('$partitionBy.missingKey');
      });

      it('should validate multiple partition fields', () => {
        const schema = parseSchema({
          $type: 'User',
          $partitionBy: ['tenantId', 'missing'],
          tenantId: 'uuid!',
          id: 'uuid!',
        });

        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path === '$partitionBy.missing')).toBe(true);
      });
    });

    describe('index field validation', () => {
      it('should fail when index field does not exist', () => {
        const schema = parseSchema({
          $type: 'User',
          $index: [['nonExistentField']],
          id: 'uuid!',
        });

        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'UNKNOWN_INDEX_FIELD')).toBe(true);
      });

      it('should validate all fields in compound index', () => {
        const schema = parseSchema({
          $type: 'User',
          $index: [['status', 'missing']],
          status: 'string',
        });

        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path === '$index.missing')).toBe(true);
      });

      it('should validate multiple indexes', () => {
        const schema = parseSchema({
          $type: 'User',
          $index: [['email'], ['badField'], ['status']],
          email: 'string',
          status: 'string',
        });

        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        const indexErrors = result.errors.filter((e) => e.code === 'UNKNOWN_INDEX_FIELD');
        expect(indexErrors.length).toBe(1);
        expect(indexErrors[0]?.path).toBe('$index.badField');
      });
    });

    describe('FTS field validation', () => {
      it('should fail when FTS field does not exist', () => {
        const schema = parseSchema({
          $type: 'Article',
          $fts: ['nonExistent'],
          title: 'string',
        });

        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'UNKNOWN_FTS_FIELD')).toBe(true);
      });

      it('should report correct path for missing FTS field', () => {
        const schema = parseSchema({
          $type: 'Article',
          $fts: ['missing'],
          content: 'text',
        });

        const result = validateSchema(schema);
        const error = result.errors.find((e) => e.code === 'UNKNOWN_FTS_FIELD');
        expect(error?.path).toBe('$fts.missing');
      });
    });

    describe('vector field validation', () => {
      it('should fail when vector field does not exist', () => {
        const schema = parseSchema({
          $type: 'Document',
          $vector: { nonExistent: 1536 },
          content: 'text',
        });

        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'UNKNOWN_VECTOR_FIELD')).toBe(true);
      });

      it('should fail when vector dimensions are invalid', () => {
        const schema = parseSchema({
          $type: 'Document',
          $vector: { embedding: 0 },
          embedding: 'json',
        });

        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'INVALID_VECTOR_DIMENSIONS')).toBe(true);
      });

      it('should fail when vector dimensions are negative', () => {
        const schema = parseSchema({
          $type: 'Document',
          $vector: { embedding: -100 },
          embedding: 'json',
        });

        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'INVALID_VECTOR_DIMENSIONS')).toBe(true);
      });
    });
  });

  // =============================================================================
  // Warning Tests
  // =============================================================================

  describe('validation warnings', () => {
    it('should warn when schema name is not specified', () => {
      const schema = parseSchema({
        id: 'uuid!',
        name: 'string',
      });

      const result = validateSchema(schema);
      expect(result.warnings.some((w) => w.code === 'MISSING_SCHEMA_NAME')).toBe(true);
    });

    it('should not warn when schema name is specified', () => {
      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
      });

      const result = validateSchema(schema);
      expect(result.warnings.some((w) => w.code === 'MISSING_SCHEMA_NAME')).toBe(false);
    });
  });

  // =============================================================================
  // Relation Validation Tests
  // =============================================================================

  describe('relation validation', () => {
    it('should validate forward relations', () => {
      const schema = parseSchema({
        $type: 'Post',
        author: '-> User',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
    });

    it('should validate backward relations', () => {
      const schema = parseSchema({
        $type: 'User',
        posts: '<- Post.author',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
    });

    it('should validate fuzzy relations', () => {
      const schema = parseSchema({
        $type: 'Product',
        similar: '~> Product',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      const schema = parseSchema({
        $type: 'Empty',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle schema with only directives', () => {
      const schema = parseSchema({
        $type: 'DirectivesOnly',
        $partitionBy: [],
        $index: [],
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
    });

    it('should handle complex schema with many features', () => {
      const schema = parseSchema({
        $type: 'ComplexEntity',
        $partitionBy: ['tenantId'],
        $index: [['email'], ['status', 'createdAt']],
        $fts: ['title', 'description'],
        $vector: { embedding: 1536 },

        id: 'uuid!',
        tenantId: 'uuid!',
        email: 'string#',
        status: 'string = "draft"',
        title: 'string',
        description: 'text?',
        tags: 'string[]',
        metadata: 'json?',
        embedding: 'json',
        createdAt: 'timestamp = now()',
        author: '-> User',
        comments: '<- Comment.post',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // =============================================================================
  // Error Messages
  // =============================================================================

  describe('error messages', () => {
    it('should provide descriptive error messages', () => {
      const schema = parseSchema({
        $type: 'User',
        $partitionBy: ['missing'],
        id: 'uuid!',
      });

      const result = validateSchema(schema);
      const error = result.errors.find((e) => e.code === 'UNKNOWN_PARTITION_FIELD');
      expect(error?.message).toContain('missing');
      expect(error?.message).toContain('does not exist');
    });

    it('should include field name in type error', () => {
      const schema = parseSchema({
        $type: 'Test',
        badField: 'badType',
      });

      const result = validateSchema(schema);
      const error = result.errors.find((e) => e.code === 'UNKNOWN_TYPE');
      expect(error?.message).toContain('badtype');
    });
  });
});
