/**
 * Parser Error Recovery Tests for @icetype/core
 *
 * Tests verifying that the parser produces helpful, informative error messages
 * for malformed schemas. These tests ensure:
 *
 * 1. Error messages are clear and actionable
 * 2. Error codes are appropriate for each error type
 * 3. Line/column information is included when available
 * 4. Error paths identify the problematic field/directive
 * 5. The parser recovers gracefully without crashing
 *
 * @see Issue: icetype-e2u - Add parser error recovery tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseField,
  parseRelation,
  parseSchema,
  validateSchema,
  parseDirectives,
  tokenize,
  parseTypeString,
  parseRelationString,
  IceTypeParser,
} from '../src/parser.js';
import { ParseError, isParseError } from '../src/errors.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Assert that an error is a ParseError with expected properties.
 * Note: The parser uses short error code names (e.g., 'EMPTY_TYPE') not the
 * full ErrorCodes enum values (e.g., 'ICETYPE_1001').
 */
function assertParseError(
  fn: () => void,
  expectedMessagePattern: RegExp,
  options?: {
    codeContains?: string;
    hasLineInfo?: boolean;
    hasPath?: boolean;
  }
): void {
  try {
    fn();
    expect.fail('Expected function to throw a ParseError');
  } catch (error) {
    expect(isParseError(error)).toBe(true);
    if (!isParseError(error)) return;

    expect(error.message).toMatch(expectedMessagePattern);

    if (options?.codeContains) {
      expect(error.code).toContain(options.codeContains);
    }

    if (options?.hasLineInfo) {
      expect(error.line).toBeGreaterThanOrEqual(1);
      expect(error.column).toBeGreaterThanOrEqual(1);
    }

    if (options?.hasPath) {
      expect(error.path).toBeDefined();
    }
  }
}

// =============================================================================
// Missing Field Types
// =============================================================================

describe('Parser Error Recovery: Missing Field Types', () => {
  describe('empty type strings', () => {
    it('should provide helpful error for empty string', () => {
      assertParseError(
        () => parseField(''),
        /[Ee]mpty type string/,
        { codeContains: 'EMPTY_TYPE' }
      );
    });

    it('should provide helpful error for whitespace-only string', () => {
      assertParseError(
        () => parseField('   '),
        /[Ee]mpty type string/,
        { codeContains: 'EMPTY_TYPE' }
      );
    });

    it('should provide helpful error for tab-only string', () => {
      assertParseError(
        () => parseField('\t\t'),
        /[Ee]mpty type string/,
        { codeContains: 'EMPTY_TYPE' }
      );
    });

    it('should provide helpful error for newline-only string', () => {
      assertParseError(
        () => parseField('\n'),
        /[Ee]mpty type string/,
        { codeContains: 'EMPTY_TYPE' }
      );
    });
  });

  describe('modifier-only inputs (type missing)', () => {
    it('should error for lone ! modifier', () => {
      assertParseError(
        () => parseField('!'),
        /[Ii]nvalid modifier position/,
        { codeContains: 'INVALID_MODIFIER_POSITION' }
      );
    });

    it('should error for lone ? modifier', () => {
      assertParseError(
        () => parseField('?'),
        /[Ii]nvalid modifier position/,
        { codeContains: 'INVALID_MODIFIER_POSITION' }
      );
    });

    it('should error for lone # modifier', () => {
      assertParseError(
        () => parseField('#'),
        /[Ii]nvalid modifier position/,
        { codeContains: 'INVALID_MODIFIER_POSITION' }
      );
    });

    it('should error for modifier at start of type', () => {
      assertParseError(
        () => parseField('!string'),
        /[Ii]nvalid modifier position/,
        { codeContains: 'INVALID_MODIFIER_POSITION' }
      );
    });

    it('should error for multiple modifiers without type', () => {
      assertParseError(
        () => parseField('!?'),
        /[Ii]nvalid modifier position/,
        { codeContains: 'INVALID_MODIFIER_POSITION' }
      );
    });

    it('should error for all three modifiers without type', () => {
      assertParseError(
        () => parseField('!?#'),
        /[Ii]nvalid modifier position/,
        { codeContains: 'INVALID_MODIFIER_POSITION' }
      );
    });
  });
});

// =============================================================================
// Invalid Type Names
// =============================================================================

describe('Parser Error Recovery: Invalid Type Names', () => {
  describe('unknown primitive types', () => {
    it('should error for completely unknown type', () => {
      assertParseError(
        () => parseField('unknownType'),
        /[Uu]nknown type/,
        { codeContains: 'UNKNOWN_TYPE' }
      );
    });

    it('should error for misspelled string type', () => {
      assertParseError(
        () => parseField('strng'),
        /[Uu]nknown type.*strng/i
      );
    });

    it('should error for misspelled int type', () => {
      assertParseError(
        () => parseField('integr'),
        /[Uu]nknown type.*integr/i
      );
    });

    it('should error for misspelled boolean type', () => {
      assertParseError(
        () => parseField('booleen'),
        /[Uu]nknown type.*booleen/i
      );
    });

    it('should error for misspelled timestamp type', () => {
      assertParseError(
        () => parseField('timestmp'),
        /[Uu]nknown type.*timestmp/i
      );
    });

    it('should error for unknown type with modifiers', () => {
      assertParseError(
        () => parseField('badtype!'),
        /[Uu]nknown type.*badtype/i
      );
    });

    it('should error for unknown type with optional modifier', () => {
      assertParseError(
        () => parseField('badtype?'),
        /[Uu]nknown type.*badtype/i
      );
    });

    it('should error for unknown type with indexed modifier', () => {
      assertParseError(
        () => parseField('badtype#'),
        /[Uu]nknown type.*badtype/i
      );
    });

    it('should error for unknown array type', () => {
      assertParseError(
        () => parseField('badtype[]'),
        /[Uu]nknown type.*badtype/i
      );
    });

    it('should error for unknown type with default value', () => {
      assertParseError(
        () => parseField('badtype = "value"'),
        /[Uu]nknown type.*badtype/i
      );
    });
  });

  describe('unknown generic types', () => {
    it('should error for unknown generic type', () => {
      assertParseError(
        () => parseField('unknowngeneric<string>'),
        /[Uu]nknown generic type.*unknowngeneric/i,
        { codeContains: 'UNKNOWN_GENERIC_TYPE' }
      );
    });

    it('should error for misspelled map type', () => {
      assertParseError(
        () => parseField('mapp<string, int>'),
        /[Uu]nknown generic type.*mapp/i
      );
    });

    it('should error for misspelled list type', () => {
      assertParseError(
        () => parseField('lst<string>'),
        /[Uu]nknown generic type.*lst/i
      );
    });

    it('should error for misspelled struct type', () => {
      assertParseError(
        () => parseField('strct<MyType>'),
        /[Uu]nknown generic type.*strct/i
      );
    });
  });

  describe('unknown parametric types', () => {
    it('should error for unknown parametric type', () => {
      assertParseError(
        () => parseField('unknownparam(10)'),
        /[Uu]nknown parametric type.*unknownparam/i,
        { codeContains: 'UNKNOWN_PARAMETRIC_TYPE' }
      );
    });

    it('should error for misspelled decimal type', () => {
      assertParseError(
        () => parseField('deciml(10,2)'),
        /[Uu]nknown parametric type.*deciml/i
      );
    });

    it('should error for misspelled varchar type', () => {
      assertParseError(
        () => parseField('varchr(255)'),
        /[Uu]nknown parametric type.*varchr/i
      );
    });
  });
});

// =============================================================================
// Malformed Relation Syntax
// =============================================================================

describe('Parser Error Recovery: Malformed Relation Syntax', () => {
  describe('missing relation components', () => {
    it('should error for empty relation string', () => {
      assertParseError(
        () => parseRelation(''),
        /non-empty string/i,
        { codeContains: 'EMPTY_RELATION' }
      );
    });

    it('should error for whitespace-only relation string', () => {
      assertParseError(
        () => parseRelation('   '),
        /non-empty string/i,
        { codeContains: 'EMPTY_RELATION' }
      );
    });

    it('should error for missing operator', () => {
      assertParseError(
        () => parseRelation('User'),
        /relation operator/i,
        { codeContains: 'MISSING_RELATION_OPERATOR' }
      );
    });

    it('should error for forward operator without target', () => {
      assertParseError(
        () => parseRelation('->'),
        /target type/i,
        { codeContains: 'MISSING_TARGET_TYPE' }
      );
    });

    it('should error for forward operator with only whitespace', () => {
      assertParseError(
        () => parseRelation('->   '),
        /target type/i,
        { codeContains: 'MISSING_TARGET_TYPE' }
      );
    });

    it('should error for backward operator without target', () => {
      assertParseError(
        () => parseRelation('<-'),
        /target type/i,
        { codeContains: 'MISSING_TARGET_TYPE' }
      );
    });

    it('should error for fuzzy forward operator without target', () => {
      assertParseError(
        () => parseRelation('~>'),
        /target type/i,
        { codeContains: 'MISSING_TARGET_TYPE' }
      );
    });

    it('should error for fuzzy backward operator without target', () => {
      assertParseError(
        () => parseRelation('<~'),
        /target type/i,
        { codeContains: 'MISSING_TARGET_TYPE' }
      );
    });
  });

  describe('invalid operator syntax', () => {
    it('should error for single hyphen (not a valid operator)', () => {
      assertParseError(
        () => parseRelation('- User'),
        /relation operator/i
      );
    });

    it('should error for wrong arrow direction', () => {
      assertParseError(
        () => parseRelation('<> User'),
        /relation operator/i
      );
    });

    it('should parse double forward arrows as operator plus target', () => {
      // '->> User' is parsed as '-> > User', the first operator matches
      // and '> User' becomes the target type (which is valid but likely unintended)
      const rel = parseRelation('->> User');
      expect(rel.operator).toBe('->');
      expect(rel.targetType).toBe('> User');  // The rest becomes target
    });
  });

  describe('parseRelationString with options', () => {
    it('should include field name in error context when provided', () => {
      try {
        parseRelationString('', { fieldName: 'authorId' });
        expect.fail('Expected to throw');
      } catch (error) {
        expect(isParseError(error)).toBe(true);
        if (isParseError(error)) {
          expect(error.path).toBe('authorId');
          expect(error.message).toContain('authorId');
        }
      }
    });

    it('should include line/column in error when provided', () => {
      try {
        parseRelationString('', { line: 5, column: 10 });
        expect.fail('Expected to throw');
      } catch (error) {
        expect(isParseError(error)).toBe(true);
        if (isParseError(error)) {
          expect(error.line).toBe(5);
          expect(error.column).toBe(10);
        }
      }
    });
  });
});

// =============================================================================
// Invalid Modifiers
// =============================================================================

describe('Parser Error Recovery: Invalid Modifiers', () => {
  describe('modifier position errors', () => {
    it('should error for modifier before type name', () => {
      assertParseError(
        () => parseField('!string'),
        /[Ii]nvalid modifier position/
      );
    });

    it('should error for optional modifier before type', () => {
      assertParseError(
        () => parseField('?string'),
        /[Ii]nvalid modifier position/
      );
    });

    it('should error for index modifier before type', () => {
      assertParseError(
        () => parseField('#string'),
        /[Ii]nvalid modifier position/
      );
    });
  });

  describe('parseTypeString with options for context', () => {
    it('should include field name in error message', () => {
      try {
        parseTypeString('!string', { fieldName: 'email' });
        expect.fail('Expected to throw');
      } catch (error) {
        expect(isParseError(error)).toBe(true);
        if (isParseError(error)) {
          expect(error.path).toBe('email');
        }
      }
    });

    it('should include line/column in error when provided', () => {
      try {
        parseTypeString('', { line: 10, column: 5, fieldName: 'field' });
        expect.fail('Expected to throw');
      } catch (error) {
        expect(isParseError(error)).toBe(true);
        if (isParseError(error)) {
          expect(error.line).toBe(10);
          expect(error.column).toBe(5);
        }
      }
    });
  });
});

// =============================================================================
// Syntax Errors in Directives
// =============================================================================

describe('Parser Error Recovery: Directive Validation', () => {
  describe('schema validation errors for invalid directives', () => {
    it('should warn when partition field does not exist', () => {
      const schema = parseSchema({
        $type: 'Test',
        $partitionBy: ['nonExistentField'],
        id: 'uuid!',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_PARTITION_FIELD')).toBe(true);
      expect(result.errors.some((e) => e.path?.includes('nonExistentField'))).toBe(true);
    });

    it('should warn when index field does not exist', () => {
      const schema = parseSchema({
        $type: 'Test',
        $index: [['nonExistentField']],
        id: 'uuid!',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_INDEX_FIELD')).toBe(true);
    });

    it('should warn when FTS field does not exist', () => {
      const schema = parseSchema({
        $type: 'Test',
        $fts: ['nonExistentField'],
        id: 'uuid!',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_FTS_FIELD')).toBe(true);
    });

    it('should warn when vector field does not exist', () => {
      const schema = parseSchema({
        $type: 'Test',
        $vector: { nonExistentField: 1536 },
        id: 'uuid!',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_VECTOR_FIELD')).toBe(true);
    });

    it('should error when vector dimensions are invalid', () => {
      const schema = parseSchema({
        $type: 'Test',
        embedding: 'json',
        $vector: { embedding: -1 },
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_VECTOR_DIMENSIONS')).toBe(true);
    });

    it('should error when vector dimensions are zero', () => {
      const schema = parseSchema({
        $type: 'Test',
        embedding: 'json',
        $vector: { embedding: 0 },
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_VECTOR_DIMENSIONS')).toBe(true);
    });
  });

  describe('parseDirectives error handling', () => {
    it('should silently ignore non-array $partitionBy', () => {
      const directives = parseDirectives({
        $partitionBy: 'notAnArray' as unknown as string[],
      });
      expect(directives.partitionBy).toBeUndefined();
    });

    it('should silently ignore non-array $index', () => {
      const directives = parseDirectives({
        $index: 'notAnArray' as unknown as string[][],
      });
      expect(directives.index).toBeUndefined();
    });

    it('should silently ignore non-array $fts', () => {
      const directives = parseDirectives({
        $fts: 'notAnArray' as unknown as string[],
      });
      expect(directives.fts).toBeUndefined();
    });

    it('should ignore unknown directives', () => {
      const directives = parseDirectives({
        $unknownDirective: 'value',
        $anotherUnknown: [1, 2, 3],
      });
      expect(Object.keys(directives)).toHaveLength(0);
    });
  });
});

// =============================================================================
// Parametric Type Errors
// =============================================================================

describe('Parser Error Recovery: Parametric Type Errors', () => {
  describe('invalid parameters', () => {
    it('should error for non-numeric decimal precision', () => {
      assertParseError(
        () => parseField('decimal(abc)'),
        /[Ii]nvalid parameter value.*abc/,
        { codeContains: 'INVALID_PARAM_VALUE' }
      );
    });

    it('should error for non-numeric decimal scale', () => {
      assertParseError(
        () => parseField('decimal(10, xyz)'),
        /[Ii]nvalid parameter value.*xyz/,
        { codeContains: 'INVALID_PARAM_VALUE' }
      );
    });

    it('should error for non-numeric varchar length', () => {
      assertParseError(
        () => parseField('varchar(abc)'),
        /[Ii]nvalid parameter value.*abc/,
        { codeContains: 'INVALID_PARAM_VALUE' }
      );
    });

    it('should error for empty parentheses on decimal - treated as unknown type', () => {
      // Note: 'decimal()' with empty parens doesn't match the parametric pattern
      // so it's treated as an unknown type (not matching primitive or parametric regex)
      assertParseError(
        () => parseField('decimal()'),
        /[Uu]nknown type/
      );
    });
  });

  describe('map type parameter errors', () => {
    it('should error for map with single parameter', () => {
      assertParseError(
        () => parseField('map<string>'),
        /requires exactly 2 type parameters/i,
        { codeContains: 'INVALID_MAP_PARAMS' }
      );
    });

    it('should error for map with three parameters', () => {
      assertParseError(
        () => parseField('map<string, int, bool>'),
        /requires exactly 2 type parameters/i,
        { codeContains: 'INVALID_MAP_PARAMS' }
      );
    });

    it('should error for map with empty parameters - treated as unknown type', () => {
      // Note: 'map<>' doesn't match the generic pattern correctly
      // since >$ at position 4 means it's 'map<' + '>' which becomes unknown
      assertParseError(
        () => parseField('map<>'),
        /[Uu]nknown type/
      );
    });
  });
});

// =============================================================================
// Error Message Quality Tests
// =============================================================================

describe('Parser Error Recovery: Error Message Quality', () => {
  describe('error messages should be descriptive', () => {
    it('should mention the problematic type in unknown type errors', () => {
      try {
        parseField('foobar');
        expect.fail('Expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('foobar');
      }
    });

    it('should mention the operator in relation errors', () => {
      try {
        parseRelation('->');
        expect.fail('Expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('->');
      }
    });

    it('should include line/column in ParseError messages', () => {
      const error = new ParseError('Test error', { line: 5, column: 10 });
      expect(error.message).toContain('line 5');
      expect(error.message).toContain('column 10');
    });

    it('should include path in ParseError messages when provided', () => {
      const error = new ParseError('Test error', { line: 1, column: 1, path: 'user.email' });
      expect(error.message).toContain('user.email');
    });
  });

  describe('ParseError formatWithSource', () => {
    it('should show source context with pointer to error location', () => {
      const source = 'line one\nline two with error\nline three';
      const error = new ParseError('Error found', { line: 2, column: 10 });
      const formatted = error.formatWithSource(source);

      expect(formatted).toContain('line two with error');
      expect(formatted).toContain('^');
    });

    it('should handle source with line out of range gracefully', () => {
      const source = 'only one line';
      const error = new ParseError('Error found', { line: 5, column: 1 });
      const formatted = error.formatWithSource(source);

      // Should still show the message, just without source context
      expect(formatted).toContain('Error found');
    });

    it('should handle undefined source gracefully', () => {
      const error = new ParseError('Error found', { line: 1, column: 1 });
      const formatted = error.formatWithSource();

      expect(formatted).toBe(error.message);
    });
  });
});

// =============================================================================
// Schema Validation Error Recovery
// =============================================================================

describe('Parser Error Recovery: Schema Validation', () => {
  describe('conflicting modifiers', () => {
    it('should warn about conflicting required and optional modifiers', () => {
      const schema = parseSchema({
        $type: 'Test',
        field: 'string!?',
      });

      // Manually set conflicting state to trigger validation warning
      const field = schema.fields.get('field');
      if (field) {
        field.isOptional = true;
        field.modifier = '!';
      }

      const result = validateSchema(schema);
      expect(result.warnings.some((w) => w.code === 'CONFLICTING_MODIFIERS')).toBe(true);
    });
  });

  describe('missing target type in relations', () => {
    it('should error when relation has empty target type', () => {
      const schema = parseSchema({
        $type: 'Test',
        id: 'uuid!',
      });

      // Add a malformed relation directly
      schema.relations.set('badRelation', {
        operator: '->',
        targetType: '',
      });

      const result = validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_TARGET_TYPE')).toBe(true);
      expect(result.errors.some((e) => e.path === 'badRelation')).toBe(true);
    });
  });

  describe('missing schema name warning', () => {
    it('should warn when schema name is not specified', () => {
      const schema = parseSchema({
        id: 'uuid!',
        // Note: no $type specified
      });

      const result = validateSchema(schema);
      expect(result.warnings.some((w) => w.code === 'MISSING_SCHEMA_NAME')).toBe(true);
    });
  });
});

// =============================================================================
// Tokenizer Recovery
// =============================================================================

describe('Parser Error Recovery: Tokenizer Robustness', () => {
  describe('unclosed strings', () => {
    it('should not crash on unclosed double-quoted string', () => {
      const tokens = tokenize('"unclosed string');
      expect(tokens.length).toBeGreaterThanOrEqual(1);
      expect(tokens[tokens.length - 1].type).toBe('EOF');
    });

    it('should not crash on unclosed single-quoted string', () => {
      const tokens = tokenize("'unclosed string");
      expect(tokens.length).toBeGreaterThanOrEqual(1);
      expect(tokens[tokens.length - 1].type).toBe('EOF');
    });
  });

  describe('unclosed brackets', () => {
    it('should tokenize unclosed angle bracket', () => {
      const tokens = tokenize('map<string');
      expect(tokens.some((t) => t.type === 'LANGLE')).toBe(true);
      expect(tokens[tokens.length - 1].type).toBe('EOF');
    });

    it('should tokenize unclosed square bracket', () => {
      const tokens = tokenize('string[');
      expect(tokens.some((t) => t.type === 'LBRACKET')).toBe(true);
      expect(tokens[tokens.length - 1].type).toBe('EOF');
    });

    it('should tokenize unclosed parenthesis', () => {
      const tokens = tokenize('decimal(10');
      expect(tokens.some((t) => t.type === 'LPAREN')).toBe(true);
      expect(tokens[tokens.length - 1].type).toBe('EOF');
    });
  });

  describe('unknown characters', () => {
    it('should skip unknown characters gracefully', () => {
      const tokens = tokenize('string @ int');
      // Should tokenize string and int, skipping @
      const types = tokens.filter((t) => t.type === 'TYPE');
      expect(types.length).toBe(2);
      expect(types[0].value).toBe('string');
      expect(types[1].value).toBe('int');
    });

    it('should skip unicode characters in identifiers', () => {
      const tokens = tokenize('field_name');
      expect(tokens[0].type).toBe('IDENTIFIER');
      expect(tokens[0].value).toBe('field_name');
    });
  });

  describe('line number tracking through errors', () => {
    it('should track line numbers correctly', () => {
      const tokens = tokenize('line1\nline2\n\nline4');
      const line4Token = tokens.find((t) => t.value === 'line4');
      expect(line4Token?.line).toBe(4);
    });

    it('should handle CRLF line endings', () => {
      const tokens = tokenize('line1\r\nline2\r\nline3');
      const line3Token = tokens.find((t) => t.value === 'line3');
      expect(line3Token?.line).toBe(3);
    });

    it('should handle mixed line endings', () => {
      const tokens = tokenize('line1\nline2\r\nline3\rline4');
      const types = tokens.filter((t) => t.type === 'IDENTIFIER');
      expect(types[3]?.line).toBe(4);
    });
  });
});

// =============================================================================
// IceTypeParser Instance Error Handling
// =============================================================================

describe('Parser Error Recovery: IceTypeParser Class', () => {
  const parser = new IceTypeParser();

  describe('parseField error handling', () => {
    it('should propagate ParseError from parseField', () => {
      expect(() => parser.parseField('')).toThrow(ParseError);
    });

    it('should include field context when parsing relations', () => {
      const field = parser.parseField('-> User');
      expect(field.relation).toBeDefined();
      expect(field.relation?.targetType).toBe('User');
    });
  });

  describe('parseRelation error handling', () => {
    it('should propagate ParseError from parseRelation', () => {
      expect(() => parser.parseRelation('')).toThrow();
    });
  });

  describe('validateSchema comprehensive errors', () => {
    it('should collect multiple validation errors', () => {
      const schema = parseSchema({
        $type: 'Test',
        $partitionBy: ['nonExistent1'],
        $index: [['nonExistent2']],
        $fts: ['nonExistent3'],
        id: 'uuid!',
      });

      const result = parser.validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// =============================================================================
// Edge Cases for Error Recovery
// =============================================================================

describe('Parser Error Recovery: Edge Cases', () => {
  describe('extremely long inputs', () => {
    it('should handle very long invalid type names', () => {
      const longTypeName = 'a'.repeat(1000);
      assertParseError(
        () => parseField(longTypeName),
        /[Uu]nknown type/
      );
    });

    it('should handle very long relation target names gracefully', () => {
      const longTarget = 'Entity' + 'x'.repeat(500);
      const rel = parseRelation(`-> ${longTarget}`);
      expect(rel.targetType).toBe(longTarget);
    });
  });

  describe('special characters in errors', () => {
    it('should handle special regex characters in type names', () => {
      // These should not crash and should produce clear errors
      assertParseError(
        () => parseField('type.with.dots'),
        /[Uu]nknown type/
      );
    });
  });

  describe('rapid successive errors', () => {
    it('should handle many errors in sequence without state corruption', () => {
      const invalidInputs = [
        '',
        '!',
        '?',
        '->',
        'badtype',
        'map<>',
        'decimal(abc)',
      ];

      for (const input of invalidInputs) {
        expect(() => parseField(input)).toThrow();
      }

      // Parser should still work correctly after errors
      const validField = parseField('string');
      expect(validField.type).toBe('string');
    });
  });
});
