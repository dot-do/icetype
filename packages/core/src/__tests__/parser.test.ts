/**
 * Parser Tests for @icetype/core
 *
 * Tests for the tokenizer and type/relation parsing functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  tokenize,
  parseField,
  parseRelation,
  parseDirectives,
} from '../parser.js';
import type { TokenType } from '../types.js';

// =============================================================================
// Tokenizer Tests
// =============================================================================

describe('tokenize', () => {
  describe('basic tokens', () => {
    it('should tokenize identifiers', () => {
      const tokens = tokenize('fieldName');
      expect(tokens).toHaveLength(2); // identifier + EOF
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'fieldName' });
    });

    it('should tokenize type keywords', () => {
      const tokens = tokenize('string');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'string' });
    });

    it('should tokenize multiple type keywords', () => {
      const types = ['string', 'int', 'float', 'bool', 'uuid', 'timestamp', 'date', 'json'];
      for (const type of types) {
        const tokens = tokenize(type);
        expect(tokens[0]).toMatchObject({ type: 'TYPE', value: type });
      }
    });

    it('should tokenize directives', () => {
      const tokens = tokenize('$type');
      expect(tokens[0]).toMatchObject({ type: 'DIRECTIVE', value: '$type' });
    });

    it('should tokenize various directives', () => {
      const directives = ['$type', '$partitionBy', '$index', '$fts', '$vector'];
      for (const directive of directives) {
        const tokens = tokenize(directive);
        expect(tokens[0]).toMatchObject({ type: 'DIRECTIVE', value: directive });
      }
    });

    it('should tokenize numbers', () => {
      const tokens = tokenize('42');
      expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '42' });
    });

    it('should tokenize negative numbers', () => {
      const tokens = tokenize('-123');
      expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '-123' });
    });

    it('should tokenize floating point numbers', () => {
      const tokens = tokenize('3.14');
      expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '3.14' });
    });

    it('should tokenize double-quoted strings', () => {
      const tokens = tokenize('"hello world"');
      expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'hello world' });
    });

    it('should tokenize single-quoted strings', () => {
      const tokens = tokenize("'hello world'");
      expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'hello world' });
    });

    it('should handle escaped quotes in strings', () => {
      const tokens = tokenize('"hello \\"world\\""');
      expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'hello "world"' });
    });
  });

  describe('modifiers', () => {
    it('should tokenize required modifier (!)', () => {
      const tokens = tokenize('!');
      expect(tokens[0]).toMatchObject({ type: 'MODIFIER', value: '!' });
    });

    it('should tokenize indexed modifier (#)', () => {
      const tokens = tokenize('#');
      expect(tokens[0]).toMatchObject({ type: 'MODIFIER', value: '#' });
    });

    it('should tokenize optional modifier (?)', () => {
      const tokens = tokenize('?');
      expect(tokens[0]).toMatchObject({ type: 'MODIFIER', value: '?' });
    });
  });

  describe('relation operators', () => {
    it('should tokenize forward relation (->)', () => {
      const tokens = tokenize('->');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '->' });
    });

    it('should tokenize fuzzy relation (~>)', () => {
      const tokens = tokenize('~>');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '~>' });
    });

    it('should tokenize backward relation (<-)', () => {
      const tokens = tokenize('<-');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '<-' });
    });

    it('should tokenize fuzzy backward relation (<~)', () => {
      const tokens = tokenize('<~');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '<~' });
    });
  });

  describe('brackets and punctuation', () => {
    it('should tokenize brackets', () => {
      const tokens = tokenize('[]{}()');
      const expectedTypes: TokenType[] = ['LBRACKET', 'RBRACKET', 'LBRACE', 'RBRACE', 'LPAREN', 'RPAREN'];
      for (let i = 0; i < expectedTypes.length; i++) {
        expect(tokens[i]?.type).toBe(expectedTypes[i]);
      }
    });

    it('should tokenize angle brackets', () => {
      const tokens = tokenize('<>');
      expect(tokens[0]).toMatchObject({ type: 'LANGLE', value: '<' });
      expect(tokens[1]).toMatchObject({ type: 'RANGLE', value: '>' });
    });

    it('should tokenize comma', () => {
      const tokens = tokenize(',');
      expect(tokens[0]).toMatchObject({ type: 'COMMA', value: ',' });
    });

    it('should tokenize colon', () => {
      const tokens = tokenize(':');
      expect(tokens[0]).toMatchObject({ type: 'COLON', value: ':' });
    });

    it('should tokenize equals', () => {
      const tokens = tokenize('=');
      expect(tokens[0]).toMatchObject({ type: 'EQUALS', value: '=' });
    });

    it('should tokenize pipe', () => {
      const tokens = tokenize('|');
      expect(tokens[0]).toMatchObject({ type: 'PIPE', value: '|' });
    });
  });

  describe('whitespace handling', () => {
    it('should skip whitespace', () => {
      const tokens = tokenize('  string  ');
      expect(tokens).toHaveLength(2); // TYPE + EOF
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'string' });
    });

    it('should handle newlines', () => {
      const tokens = tokenize('string\nint');
      expect(tokens).toHaveLength(3); // TYPE + TYPE + EOF
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'string' });
      expect(tokens[1]).toMatchObject({ type: 'TYPE', value: 'int' });
    });

    it('should track line numbers across newlines', () => {
      const tokens = tokenize('string\nint');
      expect(tokens[0]?.line).toBe(1);
      expect(tokens[1]?.line).toBe(2);
    });
  });

  describe('complex expressions', () => {
    it('should tokenize type with modifier', () => {
      const tokens = tokenize('string!');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'string' });
      expect(tokens[1]).toMatchObject({ type: 'MODIFIER', value: '!' });
    });

    it('should tokenize array type', () => {
      const tokens = tokenize('string[]');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'string' });
      expect(tokens[1]).toMatchObject({ type: 'LBRACKET', value: '[' });
      expect(tokens[2]).toMatchObject({ type: 'RBRACKET', value: ']' });
    });

    it('should tokenize parametric type', () => {
      const tokens = tokenize('decimal(10,2)');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'decimal' });
      expect(tokens[1]).toMatchObject({ type: 'LPAREN', value: '(' });
      expect(tokens[2]).toMatchObject({ type: 'NUMBER', value: '10' });
      expect(tokens[3]).toMatchObject({ type: 'COMMA', value: ',' });
      expect(tokens[4]).toMatchObject({ type: 'NUMBER', value: '2' });
      expect(tokens[5]).toMatchObject({ type: 'RPAREN', value: ')' });
    });

    it('should tokenize generic type', () => {
      const tokens = tokenize('map<string, int>');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'map' });
      expect(tokens[1]).toMatchObject({ type: 'LANGLE', value: '<' });
      expect(tokens[2]).toMatchObject({ type: 'TYPE', value: 'string' });
      expect(tokens[3]).toMatchObject({ type: 'COMMA', value: ',' });
      expect(tokens[4]).toMatchObject({ type: 'TYPE', value: 'int' });
      expect(tokens[5]).toMatchObject({ type: 'RANGLE', value: '>' });
    });

    it('should tokenize type with default value', () => {
      const tokens = tokenize('string = "default"');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'string' });
      expect(tokens[1]).toMatchObject({ type: 'EQUALS', value: '=' });
      expect(tokens[2]).toMatchObject({ type: 'STRING', value: 'default' });
    });

    it('should tokenize relation expression', () => {
      const tokens = tokenize('-> User');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '->' });
      expect(tokens[1]).toMatchObject({ type: 'IDENTIFIER', value: 'User' });
    });
  });

  describe('EOF token', () => {
    it('should always end with EOF', () => {
      const tokens = tokenize('');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: 'EOF', value: '' });
    });

    it('should include EOF at end of non-empty input', () => {
      const tokens = tokenize('string');
      expect(tokens[tokens.length - 1]).toMatchObject({ type: 'EOF', value: '' });
    });
  });
});

// =============================================================================
// parseField Tests (Type String Parsing)
// =============================================================================

describe('parseField', () => {
  describe('primitive types', () => {
    it('should parse basic string type', () => {
      const field = parseField('string');
      expect(field.type).toBe('string');
      expect(field.isOptional).toBe(false);
      expect(field.isUnique).toBe(false);
      expect(field.isIndexed).toBe(false);
      expect(field.isArray).toBe(false);
    });

    it('should parse int type', () => {
      const field = parseField('int');
      expect(field.type).toBe('int');
    });

    it('should parse float type', () => {
      const field = parseField('float');
      expect(field.type).toBe('float');
    });

    it('should parse bool type', () => {
      const field = parseField('bool');
      expect(field.type).toBe('boolean'); // aliased
    });

    it('should parse boolean type', () => {
      const field = parseField('boolean');
      expect(field.type).toBe('boolean');
    });

    it('should parse uuid type', () => {
      const field = parseField('uuid');
      expect(field.type).toBe('uuid');
    });

    it('should parse timestamp type', () => {
      const field = parseField('timestamp');
      expect(field.type).toBe('timestamp');
    });

    it('should parse date type', () => {
      const field = parseField('date');
      expect(field.type).toBe('date');
    });

    it('should parse json type', () => {
      const field = parseField('json');
      expect(field.type).toBe('json');
    });
  });

  describe('modifiers', () => {
    it('should parse optional modifier (?)', () => {
      const field = parseField('int?');
      expect(field.type).toBe('int');
      expect(field.isOptional).toBe(true);
      expect(field.modifier).toBe('?');
    });

    it('should parse required/unique modifier (!)', () => {
      const field = parseField('uuid!');
      expect(field.type).toBe('uuid');
      expect(field.isUnique).toBe(true);
      expect(field.modifier).toBe('!');
    });

    it('should parse indexed modifier (#)', () => {
      const field = parseField('string#');
      expect(field.type).toBe('string');
      expect(field.isIndexed).toBe(true);
      expect(field.isUnique).toBe(true);
      expect(field.modifier).toBe('#');
    });

    it('should handle multiple modifiers', () => {
      const field = parseField('string!?');
      // Both unique and optional set
      expect(field.isUnique).toBe(true);
      expect(field.isOptional).toBe(true);
    });
  });

  describe('array types', () => {
    it('should parse string array', () => {
      const field = parseField('string[]');
      expect(field.type).toBe('string');
      expect(field.isArray).toBe(true);
    });

    it('should parse int array', () => {
      const field = parseField('int[]');
      expect(field.type).toBe('int');
      expect(field.isArray).toBe(true);
    });

    it('should parse array with modifier', () => {
      const field = parseField('string[]?');
      expect(field.type).toBe('string');
      expect(field.isArray).toBe(true);
      expect(field.isOptional).toBe(true);
    });
  });

  describe('default values', () => {
    it('should parse string default value', () => {
      const field = parseField('string = "default"');
      expect(field.type).toBe('string');
      expect(field.defaultValue).toBe('default');
    });

    it('should parse single-quoted default value', () => {
      const field = parseField("string = 'default'");
      expect(field.defaultValue).toBe('default');
    });

    it('should parse integer default value', () => {
      const field = parseField('int = 42');
      expect(field.type).toBe('int');
      expect(field.defaultValue).toBe(42);
    });

    it('should parse boolean true default value', () => {
      const field = parseField('bool = true');
      expect(field.defaultValue).toBe(true);
    });

    it('should parse boolean false default value', () => {
      const field = parseField('bool = false');
      expect(field.defaultValue).toBe(false);
    });

    it('should parse null default value', () => {
      const field = parseField('string? = null');
      expect(field.defaultValue).toBe(null);
    });

    it('should parse function default value', () => {
      const field = parseField('uuid = uuid()');
      expect(field.defaultValue).toEqual({ function: 'uuid' });
    });

    it('should parse now() function default', () => {
      const field = parseField('timestamp = now()');
      expect(field.defaultValue).toEqual({ function: 'now' });
    });

    it('should parse empty object default', () => {
      const field = parseField('json = {}');
      expect(field.defaultValue).toEqual({});
    });

    it('should parse empty array default', () => {
      const field = parseField('json = []');
      expect(field.defaultValue).toEqual([]);
    });
  });

  describe('parametric types', () => {
    it('should parse decimal with precision and scale', () => {
      const field = parseField('decimal(10,2)');
      expect(field.type).toBe('decimal');
      expect(field.precision).toBe(10);
      expect(field.scale).toBe(2);
    });

    it('should parse decimal with precision only', () => {
      const field = parseField('decimal(10)');
      expect(field.type).toBe('decimal');
      expect(field.precision).toBe(10);
      expect(field.scale).toBe(0);
    });

    it('should parse varchar with length', () => {
      const field = parseField('varchar(255)');
      expect(field.type).toBe('varchar');
      expect(field.length).toBe(255);
    });

    it('should parse char with length', () => {
      const field = parseField('char(10)');
      expect(field.type).toBe('char');
      expect(field.length).toBe(10);
    });
  });

  describe('error cases', () => {
    it('should throw on empty type string', () => {
      expect(() => parseField('')).toThrow('Empty type string');
    });

    it('should throw on whitespace-only type string', () => {
      expect(() => parseField('   ')).toThrow('Empty type string');
    });

    it('should throw on modifier at start', () => {
      expect(() => parseField('!string')).toThrow('Invalid modifier position');
    });

    it('should throw on unknown type', () => {
      expect(() => parseField('unknownType')).toThrow(/[Uu]nknown type/);
    });
  });
});

// =============================================================================
// parseRelation Tests
// =============================================================================

describe('parseRelation', () => {
  describe('forward relations (->)', () => {
    it('should parse basic forward relation', () => {
      const rel = parseRelation('-> User');
      expect(rel.operator).toBe('->');
      expect(rel.targetType).toBe('User');
    });

    it('should parse forward relation with inverse', () => {
      const rel = parseRelation('-> User.posts');
      expect(rel.operator).toBe('->');
      expect(rel.targetType).toBe('User');
      expect(rel.inverse).toBe('posts');
    });
  });

  describe('fuzzy relations (~>)', () => {
    it('should parse fuzzy forward relation', () => {
      const rel = parseRelation('~> Product');
      expect(rel.operator).toBe('~>');
      expect(rel.targetType).toBe('Product');
    });

    it('should parse fuzzy relation with inverse', () => {
      const rel = parseRelation('~> Product.similarItems');
      expect(rel.operator).toBe('~>');
      expect(rel.targetType).toBe('Product');
      expect(rel.inverse).toBe('similarItems');
    });
  });

  describe('backward relations (<-)', () => {
    it('should parse backward relation', () => {
      const rel = parseRelation('<- Comment');
      expect(rel.operator).toBe('<-');
      expect(rel.targetType).toBe('Comment');
    });

    it('should parse backward relation with inverse', () => {
      const rel = parseRelation('<- Comment.author');
      expect(rel.operator).toBe('<-');
      expect(rel.targetType).toBe('Comment');
      expect(rel.inverse).toBe('author');
    });
  });

  describe('fuzzy backward relations (<~)', () => {
    it('should parse fuzzy backward relation', () => {
      const rel = parseRelation('<~ Tag');
      expect(rel.operator).toBe('<~');
      expect(rel.targetType).toBe('Tag');
    });

    it('should parse fuzzy backward with inverse', () => {
      const rel = parseRelation('<~ Tag.relatedPosts');
      expect(rel.operator).toBe('<~');
      expect(rel.targetType).toBe('Tag');
      expect(rel.inverse).toBe('relatedPosts');
    });
  });

  describe('error cases', () => {
    it('should throw on empty string', () => {
      expect(() => parseRelation('')).toThrow(/non-empty string/);
    });

    it('should throw on missing operator', () => {
      expect(() => parseRelation('User')).toThrow(/relation operator/i);
    });

    it('should throw on operator without target', () => {
      expect(() => parseRelation('->')).toThrow(/target type/i);
    });
  });
});

// =============================================================================
// parseDirectives Tests
// =============================================================================

describe('parseDirectives', () => {
  describe('$type directive', () => {
    it('should ignore $type (handled separately)', () => {
      const directives = parseDirectives({ $type: 'User' });
      // $type is not stored in directives, it's used as the schema name
      expect(directives.partitionBy).toBeUndefined();
    });
  });

  describe('$partitionBy directive', () => {
    it('should parse single partition key', () => {
      const directives = parseDirectives({ $partitionBy: ['id'] });
      expect(directives.partitionBy).toEqual(['id']);
    });

    it('should parse multiple partition keys', () => {
      const directives = parseDirectives({ $partitionBy: ['tenantId', 'userId'] });
      expect(directives.partitionBy).toEqual(['tenantId', 'userId']);
    });

    it('should ignore non-array partition value', () => {
      const directives = parseDirectives({ $partitionBy: 'id' as unknown as string[] });
      expect(directives.partitionBy).toBeUndefined();
    });
  });

  describe('$index directive', () => {
    it('should parse single index', () => {
      const directives = parseDirectives({ $index: [['email']] });
      expect(directives.index).toHaveLength(1);
      expect(directives.index?.[0]?.fields).toEqual(['email']);
    });

    it('should parse multiple indexes', () => {
      const directives = parseDirectives({
        $index: [['email'], ['createdAt'], ['status', 'createdAt']],
      });
      expect(directives.index).toHaveLength(3);
      expect(directives.index?.[0]?.fields).toEqual(['email']);
      expect(directives.index?.[1]?.fields).toEqual(['createdAt']);
      expect(directives.index?.[2]?.fields).toEqual(['status', 'createdAt']);
    });

    it('should mark indexes as non-unique by default', () => {
      const directives = parseDirectives({ $index: [['email']] });
      expect(directives.index?.[0]?.unique).toBe(false);
    });
  });

  describe('$fts directive', () => {
    it('should parse FTS fields', () => {
      const directives = parseDirectives({ $fts: ['title', 'content'] });
      expect(directives.fts).toEqual(['title', 'content']);
    });

    it('should parse single FTS field', () => {
      const directives = parseDirectives({ $fts: ['description'] });
      expect(directives.fts).toEqual(['description']);
    });
  });

  describe('$vector directive', () => {
    it('should parse vector config', () => {
      const directives = parseDirectives({
        $vector: { embedding: 1536 },
      });
      expect(directives.vector).toHaveLength(1);
      expect(directives.vector?.[0]?.field).toBe('embedding');
      expect(directives.vector?.[0]?.dimensions).toBe(1536);
    });

    it('should parse multiple vector fields', () => {
      const directives = parseDirectives({
        $vector: { embedding: 1536, thumbnail: 512 },
      });
      expect(directives.vector).toHaveLength(2);
      const embedField = directives.vector?.find((v) => v.field === 'embedding');
      const thumbField = directives.vector?.find((v) => v.field === 'thumbnail');
      expect(embedField?.dimensions).toBe(1536);
      expect(thumbField?.dimensions).toBe(512);
    });
  });

  describe('multiple directives', () => {
    it('should parse all directives together', () => {
      const directives = parseDirectives({
        $type: 'Article',
        $partitionBy: ['authorId'],
        $index: [['slug'], ['publishedAt']],
        $fts: ['title', 'content'],
        $vector: { embedding: 1536 },
      });

      expect(directives.partitionBy).toEqual(['authorId']);
      expect(directives.index).toHaveLength(2);
      expect(directives.fts).toEqual(['title', 'content']);
      expect(directives.vector).toHaveLength(1);
    });
  });

  describe('unknown directives', () => {
    it('should ignore unknown directives', () => {
      const directives = parseDirectives({
        $unknownDirective: 'value',
        $partitionBy: ['id'],
      });
      expect(directives.partitionBy).toEqual(['id']);
      // Should not throw or include unknown directive
      expect(Object.keys(directives)).not.toContain('unknownDirective');
    });
  });

  describe('non-directive fields', () => {
    it('should ignore non-directive fields', () => {
      const directives = parseDirectives({
        $partitionBy: ['id'],
        regularField: 'string',
        anotherField: 'int',
      });
      expect(directives.partitionBy).toEqual(['id']);
      expect(Object.keys(directives)).toHaveLength(1);
    });
  });
});
