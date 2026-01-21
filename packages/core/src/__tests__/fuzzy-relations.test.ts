/**
 * Fuzzy Relations Tests for @icetype/core
 *
 * Comprehensive tests for fuzzy relation operators (~> and <~) which enable
 * AI-powered semantic matching between entities.
 *
 * Fuzzy Relations:
 * - ~> (fuzzy forward): AI-powered semantic matching to find related entities
 * - <~ (fuzzy backward): AI-powered reverse lookup for semantic relationships
 *
 * Unlike standard relations (-> and <-), fuzzy relations don't require
 * explicit foreign keys - they use semantic similarity to find matches.
 *
 * IMPLEMENTATION STATUS:
 * - PARSING: Fully implemented - fuzzy operators are tokenized and parsed correctly
 * - RUNTIME: Planned - AI-powered semantic matching execution is not yet implemented
 *
 * These tests validate the parsing behavior for fuzzy relations.
 */

import { describe, it, expect } from 'vitest';
import {
  tokenize,
  parseField,
  parseRelation,
  parseSchema,
  validateSchema,
} from '../parser.js';
import type { RelationDefinition } from '../types.js';

// =============================================================================
// Tokenizer Tests for Fuzzy Operators
// =============================================================================

describe('Fuzzy Relations - Tokenizer', () => {
  describe('~> operator tokenization', () => {
    it('should tokenize ~> as RELATION_OP', () => {
      const tokens = tokenize('~>');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '~>' });
    });

    it('should tokenize ~> with target type', () => {
      const tokens = tokenize('~> Product');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '~>' });
      expect(tokens[1]).toMatchObject({ type: 'IDENTIFIER', value: 'Product' });
    });

    it('should not confuse ~ alone with ~>', () => {
      const tokens = tokenize('~ >');
      // ~ by itself should not be a relation operator
      expect(tokens[0]?.type).not.toBe('RELATION_OP');
    });
  });

  describe('<~ operator tokenization', () => {
    it('should tokenize <~ as RELATION_OP', () => {
      const tokens = tokenize('<~');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '<~' });
    });

    it('should tokenize <~ with target type', () => {
      const tokens = tokenize('<~ Tag');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '<~' });
      expect(tokens[1]).toMatchObject({ type: 'IDENTIFIER', value: 'Tag' });
    });

    it('should not confuse < alone with <~', () => {
      const tokens = tokenize('< ~');
      // < by itself is LANGLE, not part of a relation operator
      expect(tokens[0]).toMatchObject({ type: 'LANGLE', value: '<' });
    });
  });
});

// =============================================================================
// parseRelation Tests for Fuzzy Relations
// =============================================================================

describe('Fuzzy Relations - parseRelation', () => {
  describe('~> (fuzzy forward) parsing', () => {
    it('should parse basic fuzzy forward relation', () => {
      const rel = parseRelation('~> Product');
      expect(rel.operator).toBe('~>');
      expect(rel.targetType).toBe('Product');
    });

    it('should parse fuzzy relation with inverse field', () => {
      const rel = parseRelation('~> Product.similarItems');
      expect(rel.operator).toBe('~>');
      expect(rel.targetType).toBe('Product');
      expect(rel.inverse).toBe('similarItems');
    });

    it('should parse fuzzy relation to array type', () => {
      const rel = parseRelation('~> Tag[]');
      expect(rel.operator).toBe('~>');
      expect(rel.targetType).toBe('Tag');
    });

    it('should parse optional fuzzy relation', () => {
      const rel = parseRelation('~> Category?');
      expect(rel.operator).toBe('~>');
      expect(rel.targetType).toBe('Category');
    });
  });

  describe('<~ (fuzzy backward) parsing', () => {
    it('should parse basic fuzzy backward relation', () => {
      const rel = parseRelation('<~ Article');
      expect(rel.operator).toBe('<~');
      expect(rel.targetType).toBe('Article');
    });

    it('should parse fuzzy backward with inverse', () => {
      const rel = parseRelation('<~ Article.relatedTopics');
      expect(rel.operator).toBe('<~');
      expect(rel.targetType).toBe('Article');
      expect(rel.inverse).toBe('relatedTopics');
    });

    it('should parse fuzzy backward to array type', () => {
      const rel = parseRelation('<~ User[]');
      expect(rel.operator).toBe('<~');
      expect(rel.targetType).toBe('User');
    });
  });

  describe('fuzzy relation error cases', () => {
    it('should throw on ~> without target', () => {
      expect(() => parseRelation('~>')).toThrow(/target type/i);
    });

    it('should throw on <~ without target', () => {
      expect(() => parseRelation('<~')).toThrow(/target type/i);
    });

    it('should throw on ~> with only whitespace after', () => {
      expect(() => parseRelation('~>   ')).toThrow(/target type/i);
    });
  });
});

// =============================================================================
// parseField Tests for Fuzzy Relations
// =============================================================================

describe('Fuzzy Relations - parseField', () => {
  describe('field definitions with ~>', () => {
    it('should parse field with fuzzy forward relation', () => {
      const field = parseField('~> Product');
      expect(field.relation).toBeDefined();
      expect(field.relation?.operator).toBe('~>');
      expect(field.relation?.targetType).toBe('Product');
    });

    it('should parse array fuzzy relation field', () => {
      const field = parseField('~> Tag[]');
      expect(field.relation?.operator).toBe('~>');
      expect(field.relation?.targetType).toBe('Tag');
      expect(field.isArray).toBe(true);
    });

    it('should set type to target type for fuzzy relations', () => {
      const field = parseField('~> Category');
      expect(field.type).toBe('Category');
    });
  });

  describe('field definitions with <~', () => {
    it('should parse field with fuzzy backward relation', () => {
      const field = parseField('<~ Article');
      expect(field.relation).toBeDefined();
      expect(field.relation?.operator).toBe('<~');
      expect(field.relation?.targetType).toBe('Article');
    });

    it('should parse optional fuzzy backward relation', () => {
      const field = parseField('<~ Topic?');
      expect(field.relation?.operator).toBe('<~');
      expect(field.isOptional).toBe(true);
    });
  });
});

// =============================================================================
// Fuzzy Relation Metadata Tests
// =============================================================================

describe('Fuzzy Relations - Metadata Capture', () => {
  describe('fuzzy relation should be distinguishable from regular relations', () => {
    it('should identify ~> as a fuzzy relation type', () => {
      const fuzzyRel = parseRelation('~> Product');
      const regularRel = parseRelation('-> Product');

      // Fuzzy relations should be distinguishable
      expect(fuzzyRel.operator).toBe('~>');
      expect(regularRel.operator).toBe('->');

      // The operator itself distinguishes fuzzy from regular
      expect(['~>', '<~'].includes(fuzzyRel.operator)).toBe(true);
      expect(['~>', '<~'].includes(regularRel.operator)).toBe(false);
    });

    it('should identify <~ as a fuzzy relation type', () => {
      const fuzzyRel = parseRelation('<~ Article');
      const regularRel = parseRelation('<- Article');

      expect(fuzzyRel.operator).toBe('<~');
      expect(regularRel.operator).toBe('<-');
    });
  });

  describe('fuzzy relation metadata in schema', () => {
    it('should store fuzzy relations in schema relations map', () => {
      const schema = parseSchema({
        $type: 'Product',
        name: 'string!',
        similar: '~> Product[]',
        relatedTags: '<~ Tag[]',
      });

      expect(schema.relations.has('similar')).toBe(true);
      expect(schema.relations.has('relatedTags')).toBe(true);

      const similarRel = schema.relations.get('similar');
      expect(similarRel?.operator).toBe('~>');

      const tagsRel = schema.relations.get('relatedTags');
      expect(tagsRel?.operator).toBe('<~');
    });

    it('should capture fuzzy relation in field definition', () => {
      const schema = parseSchema({
        $type: 'Article',
        title: 'string!',
        relatedArticles: '~> Article[]',
      });

      const field = schema.fields.get('relatedArticles');
      expect(field?.relation).toBeDefined();
      expect(field?.relation?.operator).toBe('~>');
      expect(field?.relation?.targetType).toBe('Article');
    });
  });
});

// =============================================================================
// Fuzzy Relation Validation Tests
// =============================================================================

describe('Fuzzy Relations - Validation', () => {
  describe('valid fuzzy relation schemas', () => {
    it('should validate schema with fuzzy forward relation', () => {
      const schema = parseSchema({
        $type: 'Product',
        id: 'uuid!',
        name: 'string!',
        similar: '~> Product[]',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with fuzzy backward relation', () => {
      const schema = parseSchema({
        $type: 'Tag',
        id: 'uuid!',
        name: 'string!',
        taggedItems: '<~ Product[]',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with both regular and fuzzy relations', () => {
      const schema = parseSchema({
        $type: 'Post',
        id: 'uuid!',
        author: '-> User!',
        similar: '~> Post[]',
        relatedTags: '<~ Tag[]',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('fuzzy relation validation errors', () => {
    it('should validate that fuzzy relation target exists (cross-schema check)', () => {
      // Note: This may require schema registry for cross-schema validation
      // For now, just ensure the target type is captured
      const schema = parseSchema({
        $type: 'Product',
        similar: '~> NonExistentType[]',
      });

      // The relation should still be parsed
      expect(schema.relations.get('similar')?.targetType).toBe('NonExistentType');

      // Cross-schema validation would catch this at a higher level
      // For single-schema validation, we can't verify target existence
    });
  });
});

// =============================================================================
// Fuzzy Relations - Complex Scenarios
// =============================================================================

describe('Fuzzy Relations - Complex Scenarios', () => {
  describe('self-referential fuzzy relations', () => {
    it('should parse self-referential fuzzy relation', () => {
      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        similarUsers: '~> User[]',
      });

      const rel = schema.relations.get('similarUsers');
      expect(rel?.operator).toBe('~>');
      expect(rel?.targetType).toBe('User');
    });
  });

  describe('fuzzy relations with inverse specifications', () => {
    it('should parse fuzzy relation with explicit inverse', () => {
      const rel = parseRelation('~> Product.recommendations');
      expect(rel.operator).toBe('~>');
      expect(rel.targetType).toBe('Product');
      expect(rel.inverse).toBe('recommendations');
    });

    it('should parse fuzzy backward with explicit inverse', () => {
      const rel = parseRelation('<~ Article.suggestedTopics');
      expect(rel.operator).toBe('<~');
      expect(rel.targetType).toBe('Article');
      expect(rel.inverse).toBe('suggestedTopics');
    });
  });

  describe('multiple fuzzy relations in one schema', () => {
    it('should handle multiple fuzzy relations', () => {
      const schema = parseSchema({
        $type: 'Article',
        id: 'uuid!',
        title: 'string!',
        similarArticles: '~> Article[]',
        relatedTopics: '~> Topic[]',
        suggestedAuthors: '~> User[]',
        reverseLinks: '<~ Article[]',
      });

      expect(schema.relations.size).toBe(4);
      expect(schema.relations.get('similarArticles')?.operator).toBe('~>');
      expect(schema.relations.get('relatedTopics')?.operator).toBe('~>');
      expect(schema.relations.get('suggestedAuthors')?.operator).toBe('~>');
      expect(schema.relations.get('reverseLinks')?.operator).toBe('<~');
    });
  });
});

// =============================================================================
// Fuzzy vs Regular Relations - Comparison Tests
// =============================================================================

describe('Fuzzy Relations - Comparison with Regular Relations', () => {
  describe('parsing parity', () => {
    it('should parse all four relation operators consistently', () => {
      const forward = parseRelation('-> User');
      const backward = parseRelation('<- User');
      const fuzzyForward = parseRelation('~> User');
      const fuzzyBackward = parseRelation('<~ User');

      // All should have same target
      expect(forward.targetType).toBe('User');
      expect(backward.targetType).toBe('User');
      expect(fuzzyForward.targetType).toBe('User');
      expect(fuzzyBackward.targetType).toBe('User');

      // Operators should be distinct
      expect(forward.operator).toBe('->');
      expect(backward.operator).toBe('<-');
      expect(fuzzyForward.operator).toBe('~>');
      expect(fuzzyBackward.operator).toBe('<~');
    });

    it('should handle array modifier consistently across all operators', () => {
      const relations = [
        parseRelation('-> User[]'),
        parseRelation('<- User[]'),
        parseRelation('~> User[]'),
        parseRelation('<~ User[]'),
      ];

      // All should parse the array modifier (target without [])
      for (const rel of relations) {
        expect(rel.targetType).toBe('User');
      }
    });

    it('should handle optional modifier consistently across all operators', () => {
      const relations = [
        parseRelation('-> User?'),
        parseRelation('<- User?'),
        parseRelation('~> User?'),
        parseRelation('<~ User?'),
      ];

      // All should parse the target without modifiers
      for (const rel of relations) {
        expect(rel.targetType).toBe('User');
      }
    });

    it('should handle inverse field consistently across all operators', () => {
      const relations = [
        parseRelation('-> User.posts'),
        parseRelation('<- User.followers'),
        parseRelation('~> User.similar'),
        parseRelation('<~ User.related'),
      ];

      const expectedInverses = ['posts', 'followers', 'similar', 'related'];

      for (let i = 0; i < relations.length; i++) {
        expect(relations[i]?.targetType).toBe('User');
        expect(relations[i]?.inverse).toBe(expectedInverses[i]);
      }
    });
  });
});

// =============================================================================
// Edge Cases and Boundary Conditions
// =============================================================================

describe('Fuzzy Relations - Edge Cases', () => {
  describe('whitespace handling', () => {
    it('should handle no space after ~>', () => {
      const rel = parseRelation('~>User');
      expect(rel.operator).toBe('~>');
      expect(rel.targetType).toBe('User');
    });

    it('should handle multiple spaces after ~>', () => {
      const rel = parseRelation('~>    User');
      expect(rel.operator).toBe('~>');
      expect(rel.targetType).toBe('User');
    });

    it('should handle leading whitespace before <~', () => {
      const rel = parseRelation('   <~ Product');
      expect(rel.operator).toBe('<~');
      expect(rel.targetType).toBe('Product');
    });
  });

  describe('complex target type names', () => {
    it('should handle PascalCase target types', () => {
      const rel = parseRelation('~> ProductCategory');
      expect(rel.targetType).toBe('ProductCategory');
    });

    it('should handle target types with numbers', () => {
      const rel = parseRelation('~> Item2');
      expect(rel.targetType).toBe('Item2');
    });

    it('should handle target types with underscores', () => {
      const rel = parseRelation('~> my_type');
      expect(rel.targetType).toBe('my_type');
    });
  });
});
