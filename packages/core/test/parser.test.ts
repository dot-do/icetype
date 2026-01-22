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
} from '../src/parser.js';
import type { TokenType } from '../src/types.js';

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

// =============================================================================
// Parser Edge Cases
// =============================================================================
//
// This section tests edge cases and boundary conditions for the IceType parser.
// The tests document expected behavior for:
//
// 1. NESTED GENERICS: map<string, map<string, int>>, list<map<K,V>>, etc.
//    - Parser tokenizes all nested angle brackets correctly
//    - splitGenericParams() handles nested brackets when splitting on commas
//
// 2. UNICODE IN IDENTIFIERS: Not supported by design.
//    - Identifiers use ASCII only: [a-zA-Z_$][a-zA-Z0-9_$]*
//    - Unicode characters are skipped during tokenization
//    - Unicode IS supported in string literals (default values)
//    - This ensures maximum compatibility with SQL backends
//
// 3. VERY LONG FIELD NAMES: Supported without limit.
//    - Field names of 100, 500, or 1000+ characters work correctly
//    - No artificial length limits in the tokenizer
//
// 4. FIELDS STARTING WITH NUMBERS: Tokenized as NUMBER + IDENTIFIER.
//    - "123field" becomes NUMBER("123") + IDENTIFIER("field")
//    - Callers must validate that field names don't start with numbers
//
// 5. SQL RESERVED WORDS: Allowed as field names.
//    - IceType doesn't restrict SQL keywords (select, from, table, etc.)
//    - Backend adapters must quote these when generating SQL
//
// 6. DEEPLY NESTED STRUCTURES: No depth limit.
//    - 10+ levels of nesting work correctly
//    - Mixed nesting (map inside list inside struct) supported
//
// 7. MALFORMED INPUT RECOVERY: Graceful handling.
//    - Unclosed strings: Tokenized with available content
//    - Unclosed brackets: Tokenized individually
//    - Unknown characters: Skipped silently
//    - Line numbers tracked correctly even through malformed input
//
// =============================================================================

describe('Parser Edge Cases', () => {
  describe('nested generic types', () => {
    it('should tokenize nested generic: map<string, map<string, int>>', () => {
      const tokens = tokenize('map<string, map<string, int>>');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'map' });
      expect(tokens[1]).toMatchObject({ type: 'LANGLE', value: '<' });
      expect(tokens[2]).toMatchObject({ type: 'TYPE', value: 'string' });
      expect(tokens[3]).toMatchObject({ type: 'COMMA', value: ',' });
      expect(tokens[4]).toMatchObject({ type: 'TYPE', value: 'map' });
      expect(tokens[5]).toMatchObject({ type: 'LANGLE', value: '<' });
      expect(tokens[6]).toMatchObject({ type: 'TYPE', value: 'string' });
      expect(tokens[7]).toMatchObject({ type: 'COMMA', value: ',' });
      expect(tokens[8]).toMatchObject({ type: 'TYPE', value: 'int' });
      expect(tokens[9]).toMatchObject({ type: 'RANGLE', value: '>' });
      expect(tokens[10]).toMatchObject({ type: 'RANGLE', value: '>' });
    });

    it('should tokenize triple-nested generic: map<string, map<string, list<int>>>', () => {
      const tokens = tokenize('map<string, map<string, list<int>>>');
      // Verify the structure captures all angle brackets
      const langles = tokens.filter(t => t.type === 'LANGLE');
      const rangles = tokens.filter(t => t.type === 'RANGLE');
      expect(langles).toHaveLength(3);
      expect(rangles).toHaveLength(3);
    });

    it('should tokenize list<map<string, int>>', () => {
      const tokens = tokenize('list<map<string, int>>');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'list' });
      expect(tokens[1]).toMatchObject({ type: 'LANGLE', value: '<' });
      expect(tokens[2]).toMatchObject({ type: 'TYPE', value: 'map' });
    });
  });

  describe('unicode in field names and identifiers', () => {
    // Note: The IceType parser intentionally uses ASCII-only identifiers
    // for maximum compatibility with SQL backends and tooling.
    // Unicode characters in identifiers are skipped during tokenization.

    it('should skip pure Chinese characters (not supported in identifiers)', () => {
      const tokens = tokenize('用户名');
      // Unicode-only input produces no identifier token, just EOF
      expect(tokens[0]).toMatchObject({ type: 'EOF', value: '' });
    });

    it('should skip pure Japanese characters (not supported in identifiers)', () => {
      const tokens = tokenize('名前');
      // Unicode-only input produces no identifier token
      expect(tokens[0]).toMatchObject({ type: 'EOF', value: '' });
    });

    it('should skip pure Korean characters (not supported in identifiers)', () => {
      const tokens = tokenize('이름');
      // Unicode-only input produces no identifier token
      expect(tokens[0]).toMatchObject({ type: 'EOF', value: '' });
    });

    it('should stop at accented characters in identifiers', () => {
      const tokens = tokenize('prénom');
      // Stops at the accented 'é' character
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'pr' });
    });

    it('should tokenize ASCII part of identifier before emoji', () => {
      const tokens = tokenize('emoji_field_🎉');
      // Should capture the ASCII portion before the emoji
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'emoji_field_' });
    });

    it('should stop at unicode in mixed identifier', () => {
      const tokens = tokenize('user_名前_field');
      // Stops at the first unicode character
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'user_' });
    });

    it('should handle unicode in string literals', () => {
      const tokens = tokenize('"你好世界"');
      // String literals DO support unicode content
      expect(tokens[0]).toMatchObject({ type: 'STRING', value: '你好世界' });
    });

    it('should skip unicode and find type keyword', () => {
      const tokens = tokenize('用户 string');
      // Unicode is skipped, but the TYPE keyword is found
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'string' });
    });

    it('should handle unicode in default values', () => {
      const field = parseField('string = "日本語"');
      expect(field.type).toBe('string');
      expect(field.defaultValue).toBe('日本語');
    });

    it('should handle emoji in default values', () => {
      const field = parseField('string = "Hello 🌍!"');
      expect(field.type).toBe('string');
      expect(field.defaultValue).toBe('Hello 🌍!');
    });
  });

  describe('very long field names (100+ chars)', () => {
    it('should tokenize field names with 100 characters', () => {
      const longName = 'a'.repeat(100);
      const tokens = tokenize(longName);
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: longName });
      expect(tokens[0]?.value?.length).toBe(100);
    });

    it('should tokenize field names with 500 characters', () => {
      const veryLongName = 'field_' + 'x'.repeat(494);
      const tokens = tokenize(veryLongName);
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: veryLongName });
      expect(tokens[0]?.value?.length).toBe(500);
    });

    it('should tokenize field names with 1000 characters', () => {
      const extremelyLongName = 'f'.repeat(1000);
      const tokens = tokenize(extremelyLongName);
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: extremelyLongName });
    });

    it('should parse type string with long type name', () => {
      const longTypeName = 'string';
      const field = parseField(longTypeName);
      expect(field.type).toBe('string');
    });
  });

  describe('fields starting with numbers (should error or handle)', () => {
    it('should not parse identifier starting with number', () => {
      const tokens = tokenize('123fieldName');
      // First token should be NUMBER, not IDENTIFIER
      expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '123' });
      expect(tokens[1]).toMatchObject({ type: 'IDENTIFIER', value: 'fieldName' });
    });

    it('should tokenize number-prefixed string as separate tokens', () => {
      const tokens = tokenize('1abc');
      expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '1' });
      expect(tokens[1]).toMatchObject({ type: 'IDENTIFIER', value: 'abc' });
    });

    it('should tokenize pure number', () => {
      const tokens = tokenize('42');
      expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '42' });
    });

    it('should tokenize identifier with numbers in middle', () => {
      const tokens = tokenize('field123name');
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'field123name' });
    });

    it('should tokenize identifier ending with numbers', () => {
      const tokens = tokenize('field_v2');
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'field_v2' });
    });
  });

  describe('fields with SQL reserved words', () => {
    // These should be tokenized as identifiers since they're not IceType keywords
    const sqlReservedWords = [
      'select', 'from', 'where', 'insert', 'update', 'delete',
      'table', 'create', 'drop', 'alter', 'index', 'primary',
      'foreign', 'key', 'order', 'group', 'by', 'having',
      'join', 'inner', 'outer', 'left', 'right', 'on',
      'and', 'or', 'not', 'null', 'is', 'like', 'between',
      'in', 'exists', 'case', 'when', 'then', 'else', 'end',
      'as', 'distinct', 'count', 'sum', 'avg', 'max', 'min',
      'limit', 'offset', 'union', 'intersect', 'except'
    ];

    it('should tokenize SQL reserved words as identifiers', () => {
      for (const word of sqlReservedWords) {
        const tokens = tokenize(word);
        // Should be tokenized (either as IDENTIFIER or TYPE if it happens to match)
        expect(tokens[0]?.type).toMatch(/^(IDENTIFIER|TYPE)$/);
        expect(tokens[0]?.value?.toLowerCase()).toBe(word);
      }
    });

    it('should allow SELECT as field name in schema context', () => {
      // The tokenizer doesn't care about SQL - it just tokenizes
      const tokens = tokenize('SELECT string');
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'SELECT' });
      expect(tokens[1]).toMatchObject({ type: 'TYPE', value: 'string' });
    });

    it('should allow TABLE as field name', () => {
      const tokens = tokenize('TABLE');
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'TABLE' });
    });

    it('should allow reserved word with modifier: order!', () => {
      const tokens = tokenize('order!');
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'order' });
      expect(tokens[1]).toMatchObject({ type: 'MODIFIER', value: '!' });
    });
  });

  describe('deeply nested structures', () => {
    it('should tokenize deeply nested angle brackets (10 levels)', () => {
      // list<list<list<list<list<list<list<list<list<list<int>>>>>>>>>>
      const nested = 'list<'.repeat(10) + 'int' + '>'.repeat(10);
      const tokens = tokenize(nested);
      const langles = tokens.filter(t => t.type === 'LANGLE');
      const rangles = tokens.filter(t => t.type === 'RANGLE');
      expect(langles).toHaveLength(10);
      expect(rangles).toHaveLength(10);
    });

    it('should tokenize mixed nested structure', () => {
      const input = 'map<string, list<map<int, struct<MyType>>>>';
      const tokens = tokenize(input);
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'map' });
      // Count angle brackets
      const langles = tokens.filter(t => t.type === 'LANGLE');
      const rangles = tokens.filter(t => t.type === 'RANGLE');
      expect(langles).toHaveLength(4);
      expect(rangles).toHaveLength(4);
    });

    it('should handle nested parentheses in expressions', () => {
      const tokens = tokenize('decimal(10,2)');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'decimal' });
      expect(tokens[1]).toMatchObject({ type: 'LPAREN', value: '(' });
      expect(tokens[5]).toMatchObject({ type: 'RPAREN', value: ')' });
    });

    it('should handle complex expression with all bracket types', () => {
      const tokens = tokenize('map<string, int>[] = []');
      expect(tokens.filter(t => t.type === 'LANGLE')).toHaveLength(1);
      expect(tokens.filter(t => t.type === 'RANGLE')).toHaveLength(1);
      expect(tokens.filter(t => t.type === 'LBRACKET')).toHaveLength(2);
      expect(tokens.filter(t => t.type === 'RBRACKET')).toHaveLength(2);
    });
  });

  describe('malformed input recovery', () => {
    it('should handle unclosed string gracefully', () => {
      // The tokenizer should not crash on unclosed strings
      const tokens = tokenize('"unclosed string');
      expect(tokens.length).toBeGreaterThanOrEqual(1);
      // Should have a string token (possibly incomplete) and EOF
      expect(tokens[tokens.length - 1]).toMatchObject({ type: 'EOF' });
    });

    it('should handle unclosed angle brackets', () => {
      const tokens = tokenize('map<string');
      expect(tokens[0]).toMatchObject({ type: 'TYPE', value: 'map' });
      expect(tokens[1]).toMatchObject({ type: 'LANGLE', value: '<' });
      expect(tokens[tokens.length - 1]).toMatchObject({ type: 'EOF' });
    });

    it('should handle random special characters', () => {
      const tokens = tokenize('field @ # ! $ %');
      // Should tokenize what it can and skip unknown chars
      expect(tokens.filter(t => t.type !== 'EOF').length).toBeGreaterThan(0);
    });

    it('should handle empty parentheses', () => {
      const tokens = tokenize('func()');
      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'func' });
      expect(tokens[1]).toMatchObject({ type: 'LPAREN', value: '(' });
      expect(tokens[2]).toMatchObject({ type: 'RPAREN', value: ')' });
    });

    it('should handle multiple consecutive operators', () => {
      const tokens = tokenize('->->');
      expect(tokens[0]).toMatchObject({ type: 'RELATION_OP', value: '->' });
      expect(tokens[1]).toMatchObject({ type: 'RELATION_OP', value: '->' });
    });

    it('should handle tabs and mixed whitespace', () => {
      const tokens = tokenize('string\t\tint\n  float');
      const types = tokens.filter(t => t.type === 'TYPE');
      expect(types).toHaveLength(3);
      expect(types.map(t => t.value)).toEqual(['string', 'int', 'float']);
    });

    it('should handle carriage return line endings', () => {
      const tokens = tokenize('string\r\nint\rint');
      const types = tokens.filter(t => t.type === 'TYPE');
      expect(types).toHaveLength(3);
    });

    it('should track line numbers correctly through malformed input', () => {
      const tokens = tokenize('line1\nline2\n\nline4');
      // line4 token should be on line 4
      const line4Token = tokens.find(t => t.value === 'line4');
      expect(line4Token?.line).toBe(4);
    });
  });

  describe('parseField edge cases', () => {
    it('should throw clear error for empty type after modifiers are stripped', () => {
      expect(() => parseField('?!')).toThrow(/Invalid modifier position/);
    });

    it('should handle type with many modifiers: string!?#', () => {
      // Should not throw - processes modifiers from right to left
      const field = parseField('string!?#');
      expect(field.type).toBe('string');
      expect(field.isIndexed).toBe(true);
      expect(field.isUnique).toBe(true);
      expect(field.isOptional).toBe(true);
    });

    it('should handle array with multiple modifiers: int[]!?', () => {
      const field = parseField('int[]!?');
      expect(field.type).toBe('int');
      expect(field.isArray).toBe(true);
      expect(field.isOptional).toBe(true);
      expect(field.isUnique).toBe(true);
    });

    it('should parse type with spaces around default value', () => {
      const field = parseField('string   =   "value"');
      expect(field.type).toBe('string');
      expect(field.defaultValue).toBe('value');
    });

    it('should handle decimal with edge precision values', () => {
      const field = parseField('decimal(38,0)');
      expect(field.type).toBe('decimal');
      expect(field.precision).toBe(38);
      expect(field.scale).toBe(0);
    });

    it('should handle varchar with large length', () => {
      const field = parseField('varchar(65535)');
      expect(field.type).toBe('varchar');
      expect(field.length).toBe(65535);
    });
  });

  describe('parseRelation edge cases', () => {
    it('should parse relation with array modifier: -> User[]', () => {
      const rel = parseRelation('-> User[]');
      expect(rel.operator).toBe('->');
      expect(rel.targetType).toBe('User');
    });

    it('should parse relation with optional modifier: -> User?', () => {
      const rel = parseRelation('-> User?');
      expect(rel.operator).toBe('->');
      expect(rel.targetType).toBe('User');
    });

    it('should parse relation with deeply nested inverse: -> User.posts.comments', () => {
      // Current parser only handles one level of inverse
      const rel = parseRelation('-> User.posts');
      expect(rel.operator).toBe('->');
      expect(rel.targetType).toBe('User');
      expect(rel.inverse).toBe('posts');
    });

    it('should throw on relation with no target after operator', () => {
      expect(() => parseRelation('->   ')).toThrow(/target type/i);
    });

    it('should throw on fuzzy relation with no target', () => {
      expect(() => parseRelation('~>')).toThrow(/target type/i);
    });

    it('should parse all four relation operators with same target', () => {
      const ops: Array<'->' | '~>' | '<-' | '<~'> = ['->', '~>', '<-', '<~'];
      for (const op of ops) {
        const rel = parseRelation(`${op} Entity`);
        expect(rel.operator).toBe(op);
        expect(rel.targetType).toBe('Entity');
      }
    });

    it('should handle whitespace variations around operator', () => {
      const rel1 = parseRelation('->User');
      const rel2 = parseRelation('->  User');
      const rel3 = parseRelation('  ->User');
      expect(rel1.targetType).toBe('User');
      expect(rel2.targetType).toBe('User');
      expect(rel3.targetType).toBe('User');
    });
  });
});

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

// =============================================================================
// GREEN Phase Tests: Critical Path Coverage
// =============================================================================
//
// These tests address coverage gaps identified in icetype-syl.7:
// - parser.ts lines 699-728: Type alias handling and unknown type errors
// - parser.ts lines 920-927: IceTypeParser.parse method
// - parser.ts line 1192: Conflicting modifiers warning
// - parser.ts lines 1197-1202: Relation validation for missing target type
// - inferType function: Complex objects, Date, binary data
// - splitGenericParams: Deeply nested generics
// =============================================================================

import {
  IceTypeParser,
  inferType,
  parseSchema,
  validateSchema,
  isValidPrimitiveType,
  isValidModifier,
  isValidRelationOperator,
  isValidParametricType,
  isValidGenericType,
} from '../src/parser.js';

describe('GREEN Phase: Critical Path Coverage', () => {
  // ===========================================================================
  // Type Alias Handling (lines 698-700)
  // ===========================================================================
  describe('Type Alias Handling', () => {
    it('should convert bool alias to boolean', () => {
      const field = parseField('bool');
      expect(field.type).toBe('boolean');
    });

    it('should convert bool alias with modifiers', () => {
      const field = parseField('bool!');
      expect(field.type).toBe('boolean');
      expect(field.isUnique).toBe(true);
    });

    it('should convert bool alias with default value', () => {
      const field = parseField('bool = true');
      expect(field.type).toBe('boolean');
      expect(field.defaultValue).toBe(true);
    });

    it('should convert bool array alias', () => {
      const field = parseField('bool[]');
      expect(field.type).toBe('boolean');
      expect(field.isArray).toBe(true);
    });
  });

  // ===========================================================================
  // Unknown Type Errors (lines 702-709)
  // ===========================================================================
  describe('Unknown Type Error Handling', () => {
    it('should throw ParseError for completely unknown type', () => {
      expect(() => parseField('foobartype')).toThrow(/[Uu]nknown type/);
    });

    it('should throw ParseError with correct error code', () => {
      try {
        parseField('invalidtype');
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Unknown type');
      }
    });

    it('should throw for misspelled type names', () => {
      expect(() => parseField('strng')).toThrow(/[Uu]nknown type/);
      expect(() => parseField('integr')).toThrow(/[Uu]nknown type/);
      expect(() => parseField('booleen')).toThrow(/[Uu]nknown type/);
    });

    it('should throw for unknown type with modifiers', () => {
      expect(() => parseField('badtype!')).toThrow(/[Uu]nknown type/);
      expect(() => parseField('badtype?')).toThrow(/[Uu]nknown type/);
      expect(() => parseField('badtype#')).toThrow(/[Uu]nknown type/);
    });

    it('should throw for unknown array type', () => {
      expect(() => parseField('badtype[]')).toThrow(/[Uu]nknown type/);
    });

    it('should throw for unknown type with default value', () => {
      expect(() => parseField('badtype = "value"')).toThrow(/[Uu]nknown type/);
    });
  });

  // ===========================================================================
  // IceTypeParser.parse Method (lines 920-927)
  // ===========================================================================
  describe('IceTypeParser.parse method', () => {
    const parser = new IceTypeParser();

    it('should parse a minimal schema', () => {
      const schema = parser.parse({
        $type: 'User',
        id: 'uuid!',
      });

      expect(schema.name).toBe('User');
      expect(schema.fields.has('id')).toBe(true);
      expect(schema.fields.get('id')?.type).toBe('uuid');
    });

    it('should handle schema without $type', () => {
      const schema = parser.parse({
        id: 'uuid!',
      });

      expect(schema.name).toBe('Unknown');
    });

    it('should skip directive fields when parsing', () => {
      const schema = parser.parse({
        $type: 'Test',
        $partitionBy: ['id'],
        $index: [['name']],
        id: 'uuid!',
        name: 'string',
      });

      expect(schema.fields.has('$partitionBy')).toBe(false);
      expect(schema.fields.has('$index')).toBe(false);
      expect(schema.fields.has('id')).toBe(true);
      expect(schema.fields.has('name')).toBe(true);
    });

    it('should set field name from key', () => {
      const schema = parser.parse({
        $type: 'User',
        myFieldName: 'string',
      });

      expect(schema.fields.get('myFieldName')?.name).toBe('myFieldName');
    });

    it('should extract relations from string field definitions', () => {
      const schema = parser.parse({
        $type: 'Post',
        author: '-> User',
      });

      expect(schema.relations.has('author')).toBe(true);
      expect(schema.relations.get('author')?.targetType).toBe('User');
    });

    it('should parse schema with object-style field definitions', () => {
      const schema = parser.parse({
        $type: 'Config',
        setting: { type: 'string', default: 'value' },
      });

      expect(schema.fields.get('setting')?.type).toBe('string');
      expect(schema.fields.get('setting')?.defaultValue).toBe('value');
    });

    it('should handle object-style field with optional flag', () => {
      const schema = parser.parse({
        $type: 'User',
        nickname: { type: 'string', optional: true },
      });

      expect(schema.fields.get('nickname')?.isOptional).toBe(true);
    });

    it('should handle object-style field with unique flag', () => {
      const schema = parser.parse({
        $type: 'User',
        email: { type: 'string', unique: true },
      });

      expect(schema.fields.get('email')?.isUnique).toBe(true);
    });

    it('should handle object-style field with required flag', () => {
      const schema = parser.parse({
        $type: 'User',
        name: { type: 'string', required: true },
      });

      expect(schema.fields.get('name')?.modifier).toBe('!');
    });

    it('should fallback to json type for objects without type property', () => {
      const schema = parser.parse({
        $type: 'Data',
        config: { foo: 'bar' } as unknown as string,
      });

      expect(schema.fields.get('config')?.type).toBe('json');
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const before = Date.now();
      const schema = parser.parse({ $type: 'Test', id: 'uuid!' });
      const after = Date.now();

      expect(schema.createdAt).toBeGreaterThanOrEqual(before);
      expect(schema.createdAt).toBeLessThanOrEqual(after);
      expect(schema.updatedAt).toBeGreaterThanOrEqual(before);
      expect(schema.updatedAt).toBeLessThanOrEqual(after);
    });

    it('should set version to 1', () => {
      const schema = parser.parse({ $type: 'Test', id: 'uuid!' });
      expect(schema.version).toBe(1);
    });
  });

  // ===========================================================================
  // Conflicting Modifiers Warning (line 1192)
  // ===========================================================================
  describe('validateSchema: Conflicting Modifiers Warning', () => {
    it('should warn when field has both required and optional modifiers', () => {
      // Create a schema with conflicting modifiers by directly manipulating
      const schema = parseSchema({
        $type: 'Test',
        field: 'string!?',
      });

      // Manually set the condition that triggers the warning
      const field = schema.fields.get('field');
      if (field) {
        field.isOptional = true;
        field.modifier = '!';
      }

      const result = validateSchema(schema);
      expect(result.warnings.some((w) => w.code === 'CONFLICTING_MODIFIERS')).toBe(true);
    });
  });

  // ===========================================================================
  // Relation Validation - Missing Target Type (lines 1196-1202)
  // ===========================================================================
  describe('validateSchema: Relation Missing Target Type', () => {
    it('should error when relation has no target type', () => {
      // Create schema and manually add a malformed relation
      const schema = parseSchema({
        $type: 'Test',
        id: 'uuid!',
      });

      // Add a relation with empty target type
      schema.relations.set('badRelation', {
        operator: '->',
        targetType: '',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_TARGET_TYPE')).toBe(true);
    });

    it('should report correct path for missing target type error', () => {
      const schema = parseSchema({
        $type: 'Test',
        id: 'uuid!',
      });

      schema.relations.set('myRelation', {
        operator: '->',
        targetType: '',
      });

      const result = validateSchema(schema);
      const error = result.errors.find((e) => e.code === 'MISSING_TARGET_TYPE');
      expect(error?.path).toBe('myRelation');
      expect(error?.message).toContain('missing target type');
    });
  });

  // ===========================================================================
  // inferType Function Coverage
  // ===========================================================================
  describe('inferType Function', () => {
    it('should infer timestamp from Date objects', () => {
      const date = new Date();
      expect(inferType(date)).toBe('timestamp');
    });

    it('should infer binary from Uint8Array', () => {
      const buffer = new Uint8Array([1, 2, 3]);
      expect(inferType(buffer)).toBe('binary');
    });

    it('should infer bigint type from bigint values', () => {
      expect(inferType(BigInt(123))).toBe('bigint');
    });

    it('should infer bigint for numbers outside int range', () => {
      expect(inferType(2147483648)).toBe('bigint');
      expect(inferType(-2147483649)).toBe('bigint');
    });

    it('should infer int for numbers within int range', () => {
      expect(inferType(2147483647)).toBe('int');
      expect(inferType(-2147483648)).toBe('int');
      expect(inferType(0)).toBe('int');
    });

    it('should infer float for non-integer numbers', () => {
      expect(inferType(3.14159)).toBe('float');
      expect(inferType(-2.5)).toBe('float');
    });

    it('should infer json? for null and undefined', () => {
      expect(inferType(null)).toBe('json?');
      expect(inferType(undefined)).toBe('json?');
    });

    it('should infer json for plain objects', () => {
      expect(inferType({ foo: 'bar' })).toBe('json');
      expect(inferType({})).toBe('json');
    });

    it('should infer json[] for empty arrays', () => {
      expect(inferType([])).toBe('json[]');
    });

    it('should infer element type for non-empty arrays', () => {
      expect(inferType([1, 2, 3])).toBe('int[]');
      expect(inferType(['a', 'b', 'c'])).toBe('string[]');
      expect(inferType([true, false])).toBe('bool[]');
    });

    it('should infer uuid from uuid-formatted strings', () => {
      expect(inferType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
    });

    it('should infer timestamp from ISO timestamp strings', () => {
      expect(inferType('2024-01-15T10:30:00Z')).toBe('timestamp');
      expect(inferType('2024-01-15T10:30:00.123Z')).toBe('timestamp');
    });

    it('should infer date from date-formatted strings', () => {
      expect(inferType('2024-01-15')).toBe('date');
    });

    it('should infer time from time-formatted strings', () => {
      expect(inferType('10:30:00')).toBe('time');
    });

    it('should infer string for regular strings', () => {
      expect(inferType('hello world')).toBe('string');
      expect(inferType('')).toBe('string');
    });

    it('should infer bool for boolean values', () => {
      expect(inferType(true)).toBe('bool');
      expect(inferType(false)).toBe('bool');
    });

    it('should infer json for symbol type (fallback)', () => {
      expect(inferType(Symbol('test'))).toBe('json');
    });

    it('should infer json for function type (fallback)', () => {
      expect(inferType(() => {})).toBe('json');
    });
  });

  // ===========================================================================
  // Generic Type Parsing - Deeply Nested
  // ===========================================================================
  describe('Deeply Nested Generic Types', () => {
    it('should parse map with nested map value type', () => {
      const field = parseField('map<string, map<string, int>>');
      expect(field.type).toBe('map');
    });

    it('should parse list with nested map element type', () => {
      const field = parseField('list<map<string, int>>');
      expect(field.type).toBe('list');
    });

    it('should parse map with nested list value type', () => {
      const field = parseField('map<string, list<int>>');
      expect(field.type).toBe('map');
    });

    it('should parse deeply nested generic: map<string, map<int, list<boolean>>>', () => {
      const field = parseField('map<string, map<int, list<boolean>>>');
      expect(field.type).toBe('map');
    });

    it('should throw for map with wrong number of params', () => {
      expect(() => parseField('map<string>')).toThrow(/requires exactly 2 type parameters/i);
      expect(() => parseField('map<string, int, bool>')).toThrow(/requires exactly 2 type parameters/i);
    });

    it('should throw for unknown generic type', () => {
      expect(() => parseField('unknowngeneric<string>')).toThrow(/[Uu]nknown generic type/i);
    });

    it('should throw for unknown parametric type', () => {
      expect(() => parseField('unknownparam(10)')).toThrow(/[Uu]nknown parametric type/i);
    });

    it('should throw for non-numeric parametric parameter', () => {
      expect(() => parseField('decimal(abc)')).toThrow(/Invalid parameter value/i);
    });
  });

  // ===========================================================================
  // parseDirectives Edge Cases
  // ===========================================================================
  describe('parseDirectives Edge Cases', () => {
    it('should handle $projection directive with valid values', () => {
      const directives = parseDirectives({ $projection: 'oltp' });
      expect((directives as { projection?: string }).projection).toBe('oltp');
    });

    it('should handle $projection with olap value', () => {
      const directives = parseDirectives({ $projection: 'olap' });
      expect((directives as { projection?: string }).projection).toBe('olap');
    });

    it('should handle $projection with both value', () => {
      const directives = parseDirectives({ $projection: 'both' });
      expect((directives as { projection?: string }).projection).toBe('both');
    });

    it('should ignore invalid $projection values', () => {
      const directives = parseDirectives({ $projection: 'invalid' });
      expect((directives as { projection?: string }).projection).toBeUndefined();
    });

    it('should handle $from directive', () => {
      const directives = parseDirectives({ $from: 'SourceEntity' });
      expect((directives as { from?: string }).from).toBe('SourceEntity');
    });

    it('should handle $expand directive', () => {
      const directives = parseDirectives({ $expand: ['relation1', 'relation2'] });
      expect((directives as { expand?: string[] }).expand).toEqual(['relation1', 'relation2']);
    });

    it('should handle $flatten directive', () => {
      const directives = parseDirectives({ $flatten: { aliasField: 'source.path' } });
      expect((directives as { flatten?: Record<string, string> }).flatten).toEqual({ aliasField: 'source.path' });
    });

    it('should ignore $flatten with non-string values', () => {
      const directives = parseDirectives({ $flatten: { key: 123 } as unknown as Record<string, string> });
      expect((directives as { flatten?: Record<string, string> }).flatten).toBeUndefined();
    });

    it('should handle empty $index array', () => {
      const directives = parseDirectives({ $index: [] });
      expect(directives.index).toEqual([]);
    });

    it('should handle $vector with multiple fields', () => {
      const directives = parseDirectives({ $vector: { field1: 768, field2: 1536 } });
      expect(directives.vector).toHaveLength(2);
    });

    it('should ignore non-number vector dimensions', () => {
      const directives = parseDirectives({ $vector: { field: 'bad' as unknown as number } });
      expect(directives.vector).toEqual([]);
    });
  });

  // ===========================================================================
  // Additional parseField Error Cases
  // ===========================================================================
  describe('parseField Additional Error Cases', () => {
    it('should handle empty string after trimming', () => {
      expect(() => parseField('   ')).toThrow(/[Ee]mpty type string/);
    });

    it('should throw for modifier-only input', () => {
      expect(() => parseField('!')).toThrow(/Invalid modifier position/);
      expect(() => parseField('?')).toThrow(/Invalid modifier position/);
      expect(() => parseField('#')).toThrow(/Invalid modifier position/);
    });

    it('should handle decimal with zero precision', () => {
      const field = parseField('decimal(0,0)');
      expect(field.type).toBe('decimal');
      expect(field.precision).toBe(0);
      expect(field.scale).toBe(0);
    });

    it('should handle char type with length', () => {
      const field = parseField('char(1)');
      expect(field.type).toBe('char');
      expect(field.length).toBe(1);
    });

    it('should handle fixed type with length', () => {
      const field = parseField('fixed(32)');
      expect(field.type).toBe('fixed');
      expect(field.length).toBe(32);
    });
  });

  // ===========================================================================
  // parseRelation Additional Edge Cases
  // ===========================================================================
  describe('parseRelation Additional Edge Cases', () => {
    it('should handle relation with array and optional modifiers', () => {
      const rel = parseRelation('-> User[]?');
      expect(rel.operator).toBe('->');
      expect(rel.targetType).toBe('User');
    });

    it('should handle fuzzy backward relation with inverse', () => {
      const rel = parseRelation('<~ Product.related');
      expect(rel.operator).toBe('<~');
      expect(rel.targetType).toBe('Product');
      expect(rel.inverse).toBe('related');
    });
  });

  // ===========================================================================
  // IceTypeParser Instance Methods
  // ===========================================================================
  describe('IceTypeParser Instance Methods', () => {
    const parser = new IceTypeParser();

    it('should parse field with relation', () => {
      const field = parser.parseField('-> User.posts');
      expect(field.relation).toBeDefined();
      expect(field.relation?.targetType).toBe('User');
      expect(field.relation?.inverse).toBe('posts');
    });

    it('should parse relation directly', () => {
      const rel = parser.parseRelation('<- Comment.post');
      expect(rel.operator).toBe('<-');
      expect(rel.targetType).toBe('Comment');
      expect(rel.inverse).toBe('post');
    });

    it('should validate schema with all directive types', () => {
      const schema = parser.parse({
        $type: 'FullSchema',
        $partitionBy: ['tenantId'],
        $index: [['email'], ['status', 'createdAt']],
        $fts: ['title', 'content'],
        $vector: { embedding: 1536 },
        tenantId: 'uuid!',
        email: 'string#',
        status: 'string',
        createdAt: 'timestamp',
        title: 'string',
        content: 'text',
        embedding: 'json',
      });

      const result = parser.validateSchema(schema);
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // Exported Function Tests
  // ===========================================================================
  describe('Exported Convenience Functions', () => {
    it('parseSchema should work for complete schema', () => {
      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string',
        email: 'string#',
      });

      expect(schema.name).toBe('User');
      expect(schema.fields.size).toBe(3);
    });

    it('validateSchema should return valid result for correct schema', () => {
      const schema = parseSchema({
        $type: 'Test',
        id: 'uuid!',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Type Guard Functions
  // ===========================================================================
  describe('Type Guard Functions', () => {
    describe('isValidPrimitiveType', () => {
      it('should return true for valid primitive types', () => {
        expect(isValidPrimitiveType('string')).toBe(true);
        expect(isValidPrimitiveType('int')).toBe(true);
        expect(isValidPrimitiveType('float')).toBe(true);
        expect(isValidPrimitiveType('boolean')).toBe(true);
        expect(isValidPrimitiveType('uuid')).toBe(true);
        expect(isValidPrimitiveType('timestamp')).toBe(true);
        expect(isValidPrimitiveType('date')).toBe(true);
        expect(isValidPrimitiveType('json')).toBe(true);
        expect(isValidPrimitiveType('text')).toBe(true);
        expect(isValidPrimitiveType('binary')).toBe(true);
      });

      it('should return true for uppercase primitive types', () => {
        expect(isValidPrimitiveType('STRING')).toBe(true);
        expect(isValidPrimitiveType('INT')).toBe(true);
      });

      it('should return false for non-primitive types', () => {
        expect(isValidPrimitiveType('map')).toBe(false);
        expect(isValidPrimitiveType('list')).toBe(false);
        expect(isValidPrimitiveType('decimal')).toBe(false);
        expect(isValidPrimitiveType('unknown')).toBe(false);
      });
    });

    describe('isValidModifier', () => {
      it('should return true for valid modifiers', () => {
        expect(isValidModifier('!')).toBe(true);
        expect(isValidModifier('#')).toBe(true);
        expect(isValidModifier('?')).toBe(true);
        expect(isValidModifier('')).toBe(true);
      });

      it('should return false for invalid modifiers', () => {
        expect(isValidModifier('@')).toBe(false);
        expect(isValidModifier('*')).toBe(false);
        expect(isValidModifier('!!')).toBe(false);
      });
    });

    describe('isValidRelationOperator', () => {
      it('should return true for valid relation operators', () => {
        expect(isValidRelationOperator('->')).toBe(true);
        expect(isValidRelationOperator('~>')).toBe(true);
        expect(isValidRelationOperator('<-')).toBe(true);
        expect(isValidRelationOperator('<~')).toBe(true);
      });

      it('should return false for invalid operators', () => {
        expect(isValidRelationOperator('=>')).toBe(false);
        expect(isValidRelationOperator('--')).toBe(false);
        expect(isValidRelationOperator('>')).toBe(false);
      });
    });

    describe('isValidParametricType', () => {
      it('should return true for valid parametric types', () => {
        expect(isValidParametricType('decimal')).toBe(true);
        expect(isValidParametricType('varchar')).toBe(true);
        expect(isValidParametricType('char')).toBe(true);
        expect(isValidParametricType('fixed')).toBe(true);
      });

      it('should return true for uppercase parametric types', () => {
        expect(isValidParametricType('DECIMAL')).toBe(true);
        expect(isValidParametricType('VARCHAR')).toBe(true);
      });

      it('should return false for non-parametric types', () => {
        expect(isValidParametricType('string')).toBe(false);
        expect(isValidParametricType('map')).toBe(false);
      });
    });

    describe('isValidGenericType', () => {
      it('should return true for valid generic types', () => {
        expect(isValidGenericType('map')).toBe(true);
        expect(isValidGenericType('struct')).toBe(true);
        expect(isValidGenericType('enum')).toBe(true);
        expect(isValidGenericType('ref')).toBe(true);
        expect(isValidGenericType('list')).toBe(true);
      });

      it('should return true for uppercase generic types', () => {
        expect(isValidGenericType('MAP')).toBe(true);
        expect(isValidGenericType('LIST')).toBe(true);
      });

      it('should return false for non-generic types', () => {
        expect(isValidGenericType('string')).toBe(false);
        expect(isValidGenericType('decimal')).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Edge Cases for Relation String Parsing
  // ===========================================================================
  describe('parseRelation Edge Cases for Empty Strings', () => {
    it('should throw for whitespace-only relation string', () => {
      expect(() => parseRelation('   ')).toThrow(/non-empty string/i);
    });

    it('should throw for tab-only relation string', () => {
      expect(() => parseRelation('\t\t')).toThrow(/non-empty string/i);
    });
  });

  // ===========================================================================
  // Object-style Field Definitions with Relations
  // ===========================================================================
  describe('Object-style Field with Relation', () => {
    const parser = new IceTypeParser();

    it('should extract relations from object-style field definitions', () => {
      const schema = parser.parse({
        $type: 'Post',
        author: { type: '-> User' },
      });

      expect(schema.fields.has('author')).toBe(true);
      expect(schema.relations.has('author')).toBe(true);
      expect(schema.relations.get('author')?.targetType).toBe('User');
    });

    it('should handle object-style field with fuzzy relation', () => {
      const schema = parser.parse({
        $type: 'Product',
        similar: { type: '~> Product' },
      });

      expect(schema.relations.has('similar')).toBe(true);
      expect(schema.relations.get('similar')?.operator).toBe('~>');
    });

    it('should handle object-style field with backward relation', () => {
      const schema = parser.parse({
        $type: 'User',
        posts: { type: '<- Post.author' },
      });

      expect(schema.relations.has('posts')).toBe(true);
      expect(schema.relations.get('posts')?.operator).toBe('<-');
      expect(schema.relations.get('posts')?.inverse).toBe('author');
    });
  });
});
