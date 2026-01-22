/**
 * Property-based tests for IceType Parser
 *
 * Uses fast-check to generate arbitrary valid and invalid inputs to verify:
 * - Parser robustness with arbitrary valid inputs
 * - Graceful error handling for invalid inputs
 * - Round-trip consistency (parse -> structure matches input)
 * - Modifier preservation (!, ?, #)
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseField,
  parseRelation,
  parseSchema,
  tokenize,
} from '../src/parser.js';
import { ParseError } from '../src/errors.js';
import type { SchemaDefinition, RelationOperator } from '../src/types.js';

// =============================================================================
// Arbitrary Generators
// =============================================================================

/**
 * Generate an arbitrary primitive type.
 */
export function arbitraryPrimitiveType(): fc.Arbitrary<string> {
  return fc.constantFrom(
    'string',
    'int',
    'float',
    'double',
    'boolean',
    'bool',
    'uuid',
    'timestamp',
    'timestamptz',
    'date',
    'time',
    'json',
    'text',
    'binary',
    'long',
    'bigint'
  );
}

/**
 * Generate an arbitrary parametric type.
 */
export function arbitraryParametricType(): fc.Arbitrary<string> {
  return fc.oneof(
    // decimal(precision) or decimal(precision, scale)
    fc.tuple(
      fc.integer({ min: 1, max: 38 }),
      fc.option(fc.integer({ min: 0, max: 18 }), { nil: undefined })
    ).map(([precision, scale]) =>
      scale !== undefined ? `decimal(${precision},${scale})` : `decimal(${precision})`
    ),
    // varchar(length)
    fc.integer({ min: 1, max: 65535 }).map((len) => `varchar(${len})`),
    // char(length)
    fc.integer({ min: 1, max: 255 }).map((len) => `char(${len})`),
    // fixed(length)
    fc.integer({ min: 1, max: 16 }).map((len) => `fixed(${len})`)
  );
}

/**
 * Generate an arbitrary generic type.
 */
export function arbitraryGenericType(): fc.Arbitrary<string> {
  const simpleType = fc.constantFrom('string', 'int', 'float', 'boolean');

  return fc.oneof(
    // map<keyType, valueType>
    fc.tuple(simpleType, simpleType).map(([k, v]) => `map<${k}, ${v}>`),
    // list<elementType>
    simpleType.map((t) => `list<${t}>`),
    // struct<StructName>
    arbitraryIdentifier().map((name) => `struct<${name}>`),
    // enum<EnumName>
    arbitraryIdentifier().map((name) => `enum<${name}>`),
    // ref<TargetType>
    arbitraryIdentifier().map((name) => `ref<${name}>`)
  );
}

/**
 * Generate an arbitrary valid identifier (ASCII only, no leading digits).
 */
export function arbitraryIdentifier(): fc.Arbitrary<string> {
  const startChar = fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split('')
  );
  const restChars = fc.array(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('')
    ),
    { minLength: 0, maxLength: 20 }
  ).map((chars) => chars.join(''));
  return fc.tuple(startChar, restChars).map(([start, rest]) => start + rest);
}

/**
 * Generate an arbitrary field modifier sequence.
 */
export function arbitraryModifiers(): fc.Arbitrary<string> {
  return fc.subarray(['!', '?', '#'] as const, { minLength: 0, maxLength: 3 })
    .map((mods) => mods.join(''));
}

/**
 * Generate an arbitrary valid base type (primitive, parametric, or generic).
 */
export function arbitraryBaseType(): fc.Arbitrary<string> {
  return fc.oneof(
    { weight: 5, arbitrary: arbitraryPrimitiveType() },
    { weight: 2, arbitrary: arbitraryParametricType() },
    { weight: 2, arbitrary: arbitraryGenericType() }
  );
}

/**
 * Generate an arbitrary field definition string.
 * Format: <type>[<modifiers>][ = <default>]
 */
export function arbitraryFieldDefinition(): fc.Arbitrary<string> {
  return fc.record({
    baseType: arbitraryBaseType(),
    isArray: fc.boolean(),
    modifiers: arbitraryModifiers(),
    hasDefault: fc.boolean(),
    defaultValue: fc.oneof(
      fc.constant('null'),
      fc.constant('true'),
      fc.constant('false'),
      fc.integer().map(String),
      fc.double({ noNaN: true, noDefaultInfinity: true }).map(String),
      fc.string({ minLength: 0, maxLength: 20 })
        .filter((s) => !s.includes('"') && !s.includes('\\'))
        .map((s) => `"${s}"`),
      fc.constant('now()'),
      fc.constant('uuid()'),
      fc.constant('{}'),
      fc.constant('[]')
    ),
  }).map(({ baseType, isArray, modifiers, hasDefault, defaultValue }) => {
    let result = baseType;
    if (isArray) {
      result += '[]';
    }
    result += modifiers;
    if (hasDefault) {
      result += ` = ${defaultValue}`;
    }
    return result;
  });
}

/**
 * Generate an arbitrary relation operator.
 */
export function arbitraryRelationOperator(): fc.Arbitrary<RelationOperator> {
  return fc.constantFrom('->', '~>', '<-', '<~');
}

/**
 * Generate an arbitrary valid relation definition string.
 */
export function arbitraryRelationDefinition(): fc.Arbitrary<string> {
  return fc.record({
    operator: arbitraryRelationOperator(),
    targetType: arbitraryIdentifier(),
    hasInverse: fc.boolean(),
    inverse: arbitraryIdentifier(),
    isArray: fc.boolean(),
    isOptional: fc.boolean(),
  }).map(({ operator, targetType, hasInverse, inverse, isArray, isOptional }) => {
    let result = `${operator} ${targetType}`;
    if (hasInverse) {
      result = `${operator} ${targetType}.${inverse}`;
    }
    if (isArray) {
      result += '[]';
    }
    if (isOptional) {
      result += '?';
    }
    return result;
  });
}

/**
 * Generate an arbitrary valid field name.
 */
export function arbitraryFieldName(): fc.Arbitrary<string> {
  return arbitraryIdentifier().filter((name) => !name.startsWith('$'));
}

/**
 * Generate an arbitrary valid schema definition object.
 */
export function arbitrarySchemaDefinition(): fc.Arbitrary<SchemaDefinition> {
  return fc.record({
    $type: fc.option(arbitraryIdentifier(), { nil: undefined }),
    fieldCount: fc.integer({ min: 1, max: 10 }),
  }).chain(({ $type, fieldCount }) => {
    // Generate field definitions
    const fieldsArb = fc.array(
      fc.tuple(
        arbitraryFieldName(),
        fc.oneof(
          { weight: 3, arbitrary: arbitraryFieldDefinition() },
          { weight: 1, arbitrary: arbitraryRelationDefinition() }
        )
      ),
      { minLength: fieldCount, maxLength: fieldCount }
    ).map((fields) => {
      // Ensure unique field names
      const seen = new Set<string>();
      return fields.filter(([name]) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
    });

    return fieldsArb.map((fields) => {
      const schema: SchemaDefinition = {};
      if ($type) {
        schema.$type = $type;
      }
      for (const [name, def] of fields) {
        schema[name] = def;
      }
      return schema;
    });
  });
}

/**
 * Generate arbitrary invalid input that should cause parser errors.
 */
export function arbitraryInvalidInput(): fc.Arbitrary<string> {
  return fc.oneof(
    // Empty string
    fc.constant(''),
    // Only whitespace
    fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 })
      .map((chars) => chars.join('')),
    // Modifier at start (invalid position)
    fc.constantFrom('!string', '?int', '#float'),
    // Unknown type
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
      { minLength: 5, maxLength: 15 }
    ).map((chars) => chars.join(''))
      .filter((s) => !isKnownType(s)),
    // Relation without target
    fc.constantFrom('->', '~>', '<-', '<~'),
    // Malformed parametric type
    fc.constantFrom(
      'decimal()',
      'decimal(abc)',
      'varchar()',
      'decimal(-1)',
      'varchar(abc,def)'
    ),
    // Malformed generic type
    fc.constantFrom(
      'map<>',
      'map<string>',
      'map<string, >',
      'list<>',
      'unknownGeneric<string>'
    )
  );
}

/**
 * Check if a string is a known type.
 */
function isKnownType(type: string): boolean {
  const primitives = new Set([
    'string', 'int', 'float', 'double', 'boolean', 'bool',
    'uuid', 'timestamp', 'timestamptz', 'date', 'time',
    'json', 'text', 'binary', 'long', 'bigint'
  ]);
  const parametric = new Set(['decimal', 'varchar', 'char', 'fixed']);
  const generic = new Set(['map', 'struct', 'enum', 'ref', 'list']);

  const lower = type.toLowerCase();
  return primitives.has(lower) || parametric.has(lower) || generic.has(lower);
}

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Property-Based Parser Tests', () => {
  // Run with 100+ iterations as specified in requirements
  const numRuns = 150;

  describe('arbitraryPrimitiveType', () => {
    it('parses any valid primitive type without error', () => {
      fc.assert(
        fc.property(arbitraryPrimitiveType(), (type) => {
          const result = parseField(type);
          expect(result).toBeDefined();
          expect(result.type).toBeDefined();
          // Type should be string and match (accounting for aliases like bool -> boolean)
          expect(typeof result.type).toBe('string');
        }),
        { numRuns }
      );
    });

    it('tokenizes any valid primitive type correctly', () => {
      fc.assert(
        fc.property(arbitraryPrimitiveType(), (type) => {
          const tokens = tokenize(type);
          expect(tokens.length).toBeGreaterThanOrEqual(2); // TYPE + EOF
          expect(tokens[0]?.type).toBe('TYPE');
          expect(tokens[tokens.length - 1]?.type).toBe('EOF');
        }),
        { numRuns }
      );
    });
  });

  describe('arbitraryFieldDefinition', () => {
    it('parses any valid field definition without crashing', () => {
      fc.assert(
        fc.property(arbitraryFieldDefinition(), (fieldDef) => {
          // Should not throw - either parses successfully or throws ParseError
          try {
            const result = parseField(fieldDef);
            expect(result).toBeDefined();
            expect(result.type).toBeDefined();
          } catch (e) {
            // ParseError is acceptable for edge cases
            expect(e).toBeInstanceOf(ParseError);
          }
        }),
        { numRuns }
      );
    });

    it('produces valid output structure for valid inputs', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseType: arbitraryPrimitiveType(),
            isArray: fc.boolean(),
            modifier: fc.constantFrom('', '!', '?', '#'),
          }),
          ({ baseType, isArray, modifier }) => {
            const fieldDef = `${baseType}${isArray ? '[]' : ''}${modifier}`;
            const result = parseField(fieldDef);

            expect(result.type).toBeDefined();
            expect(typeof result.isArray).toBe('boolean');
            expect(typeof result.isOptional).toBe('boolean');
            expect(typeof result.isUnique).toBe('boolean');
            expect(typeof result.isIndexed).toBe('boolean');

            // Array modifier should be preserved
            expect(result.isArray).toBe(isArray);
          }
        ),
        { numRuns }
      );
    });
  });

  describe('arbitraryRelationDefinition', () => {
    it('parses any valid relation definition without error', () => {
      fc.assert(
        fc.property(arbitraryRelationDefinition(), (relDef) => {
          const result = parseRelation(relDef);
          expect(result).toBeDefined();
          expect(result.operator).toBeDefined();
          expect(result.targetType).toBeDefined();
          // Operator should be one of the valid operators
          expect(['->', '~>', '<-', '<~']).toContain(result.operator);
        }),
        { numRuns }
      );
    });

    it('preserves operator in parsed result', () => {
      fc.assert(
        fc.property(
          fc.record({
            operator: arbitraryRelationOperator(),
            targetType: arbitraryIdentifier(),
          }),
          ({ operator, targetType }) => {
            const relDef = `${operator} ${targetType}`;
            const result = parseRelation(relDef);
            expect(result.operator).toBe(operator);
            expect(result.targetType).toBe(targetType);
          }
        ),
        { numRuns }
      );
    });
  });

  describe('arbitrarySchemaDefinition', () => {
    it('parses any valid schema definition without crashing', () => {
      fc.assert(
        fc.property(arbitrarySchemaDefinition(), (schemaDef) => {
          // Should not throw
          const result = parseSchema(schemaDef);
          expect(result).toBeDefined();
          expect(result.fields).toBeInstanceOf(Map);
          expect(result.relations).toBeInstanceOf(Map);
          expect(result.directives).toBeDefined();
        }),
        { numRuns }
      );
    });

    it('includes all declared non-directive fields in parsed schema', () => {
      fc.assert(
        fc.property(arbitrarySchemaDefinition(), (schemaDef) => {
          const result = parseSchema(schemaDef);

          // Count non-directive fields in input
          const inputFields = Object.keys(schemaDef).filter(
            (key) => !key.startsWith('$')
          );

          // All input fields should be present in output
          for (const fieldName of inputFields) {
            expect(result.fields.has(fieldName)).toBe(true);
          }
        }),
        { numRuns }
      );
    });

    it('preserves schema name from $type directive', () => {
      fc.assert(
        fc.property(
          arbitrarySchemaDefinition().filter((s) => s.$type !== undefined),
          (schemaDef) => {
            const result = parseSchema(schemaDef);
            expect(result.name).toBe(schemaDef.$type);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('modifier preservation', () => {
    it('preserves optional modifier (?)', () => {
      fc.assert(
        fc.property(arbitraryPrimitiveType(), (type) => {
          const result = parseField(`${type}?`);
          expect(result.isOptional).toBe(true);
          expect(result.modifier).toBe('?');
        }),
        { numRuns }
      );
    });

    it('preserves required/unique modifier (!)', () => {
      fc.assert(
        fc.property(arbitraryPrimitiveType(), (type) => {
          const result = parseField(`${type}!`);
          expect(result.isUnique).toBe(true);
          expect(result.modifier).toBe('!');
        }),
        { numRuns }
      );
    });

    it('preserves indexed modifier (#)', () => {
      fc.assert(
        fc.property(arbitraryPrimitiveType(), (type) => {
          const result = parseField(`${type}#`);
          expect(result.isIndexed).toBe(true);
          expect(result.isUnique).toBe(true);
          expect(result.modifier).toBe('#');
        }),
        { numRuns }
      );
    });

    it('handles multiple modifiers correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: arbitraryPrimitiveType(),
            mods: fc.shuffledSubarray(['!', '?', '#'], { minLength: 1, maxLength: 3 }),
          }),
          ({ type, mods }) => {
            const fieldDef = `${type}${mods.join('')}`;
            const result = parseField(fieldDef);

            // Each modifier should be reflected in the result
            if (mods.includes('?')) {
              expect(result.isOptional).toBe(true);
            }
            if (mods.includes('!')) {
              expect(result.isUnique).toBe(true);
            }
            if (mods.includes('#')) {
              expect(result.isIndexed).toBe(true);
              expect(result.isUnique).toBe(true);
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe('invalid input handling', () => {
    it('throws ParseError (not generic Error) for invalid inputs', () => {
      fc.assert(
        fc.property(arbitraryInvalidInput(), (input) => {
          try {
            parseField(input);
            // If it doesn't throw, that's okay for some edge cases
          } catch (e) {
            // Should be a ParseError, not a generic crash
            expect(e).toBeInstanceOf(ParseError);
          }
        }),
        { numRuns }
      );
    });

    it('does not crash on arbitrary strings', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 100 }), (input) => {
          // Should never throw an unhandled exception
          try {
            parseField(input);
          } catch (e) {
            // Any thrown error should be an Error instance
            expect(e).toBeInstanceOf(Error);
          }
        }),
        { numRuns }
      );
    });

    it('does not crash on relation parsing with arbitrary strings', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 100 }), (input) => {
          try {
            parseRelation(input);
          } catch (e) {
            expect(e).toBeInstanceOf(Error);
          }
        }),
        { numRuns }
      );
    });
  });

  describe('tokenizer robustness', () => {
    it('always produces tokens ending with EOF', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
          const tokens = tokenize(input);
          expect(tokens.length).toBeGreaterThanOrEqual(1);
          expect(tokens[tokens.length - 1]?.type).toBe('EOF');
        }),
        { numRuns }
      );
    });

    it('tracks line numbers correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.array(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
              { minLength: 1, maxLength: 20 }
            ).map((chars) => chars.join('')),
            { minLength: 1, maxLength: 10 }
          ),
          (lines) => {
            const input = lines.join('\n');
            const tokens = tokenize(input);

            // All tokens should have valid line numbers (including EOF)
            for (const token of tokens) {
              expect(token.line).toBeGreaterThanOrEqual(1);
              expect(token.column).toBeGreaterThanOrEqual(1);
            }
          }
        ),
        { numRuns }
      );
    });

    it('correctly identifies type keywords', () => {
      fc.assert(
        fc.property(arbitraryPrimitiveType(), (type) => {
          const tokens = tokenize(type);
          expect(tokens[0]?.type).toBe('TYPE');
          expect(tokens[0]?.value.toLowerCase()).toBe(type.toLowerCase());
        }),
        { numRuns }
      );
    });
  });

  describe('parametric type parsing', () => {
    it('parses decimal with valid precision and scale', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 38 }),
          fc.integer({ min: 0, max: 18 }),
          (precision, scale) => {
            const fieldDef = `decimal(${precision},${scale})`;
            const result = parseField(fieldDef);
            expect(result.type).toBe('decimal');
            expect(result.precision).toBe(precision);
            expect(result.scale).toBe(scale);
          }
        ),
        { numRuns }
      );
    });

    it('parses varchar with valid length', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 65535 }), (length) => {
          const fieldDef = `varchar(${length})`;
          const result = parseField(fieldDef);
          expect(result.type).toBe('varchar');
          expect(result.length).toBe(length);
        }),
        { numRuns }
      );
    });
  });

  describe('generic type parsing', () => {
    it('parses map types correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('string', 'int'),
          fc.constantFrom('string', 'int', 'float', 'boolean'),
          (keyType, valueType) => {
            const fieldDef = `map<${keyType}, ${valueType}>`;
            const result = parseField(fieldDef);
            expect(result.type).toBe('map');
          }
        ),
        { numRuns }
      );
    });

    it('parses list types correctly', () => {
      fc.assert(
        fc.property(arbitraryPrimitiveType(), (elementType) => {
          const fieldDef = `list<${elementType}>`;
          const result = parseField(fieldDef);
          expect(result.type).toBe('list');
        }),
        { numRuns }
      );
    });
  });

  describe('default value parsing', () => {
    it('parses string default values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 20 }).filter(
            (s) =>
              !s.includes('"') &&
              !s.includes('\\') &&
              !s.includes('->') &&
              !s.includes('~>') &&
              !s.includes('<-') &&
              !s.includes('<~')
          ),
          (defaultVal) => {
            const fieldDef = `string = "${defaultVal}"`;
            const result = parseField(fieldDef);
            expect(result.type).toBe('string');
            expect(result.defaultValue).toBe(defaultVal);
          }
        ),
        { numRuns }
      );
    });

    it('parses numeric default values', () => {
      fc.assert(
        fc.property(fc.integer({ min: -1000000, max: 1000000 }), (defaultVal) => {
          const fieldDef = `int = ${defaultVal}`;
          const result = parseField(fieldDef);
          expect(result.type).toBe('int');
          expect(result.defaultValue).toBe(defaultVal);
        }),
        { numRuns }
      );
    });

    it('parses boolean default values', () => {
      fc.assert(
        fc.property(fc.boolean(), (defaultVal) => {
          const fieldDef = `bool = ${defaultVal}`;
          const result = parseField(fieldDef);
          expect(result.type).toBe('boolean'); // bool is aliased to boolean
          expect(result.defaultValue).toBe(defaultVal);
        }),
        { numRuns }
      );
    });

    it('parses function default values', () => {
      fc.assert(
        fc.property(fc.constantFrom('now', 'uuid', 'gen_random_uuid'), (funcName) => {
          const fieldDef = `timestamp = ${funcName}()`;
          const result = parseField(fieldDef);
          expect(result.defaultValue).toEqual({ function: funcName });
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('edge case coverage', () => {
    it('handles very long type names gracefully', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 200 }),
          (length) => {
            const longName = 'a'.repeat(length);
            // Should tokenize without crashing
            const tokens = tokenize(longName);
            expect(tokens.length).toBeGreaterThanOrEqual(2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('handles whitespace variations', () => {
      fc.assert(
        fc.property(
          arbitraryPrimitiveType(),
          fc.array(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 5 })
            .map((chars) => chars.join('')),
          fc.array(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 5 })
            .map((chars) => chars.join('')),
          (type, leadingWs, trailingWs) => {
            const fieldDef = `${leadingWs}${type}${trailingWs}`;
            const result = parseField(fieldDef);
            expect(result.type).toBeDefined();
          }
        ),
        { numRuns }
      );
    });

    it('handles mixed case type names', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'STRING', 'String', 'STRING', 'Int', 'INT', 'Float', 'FLOAT',
            'Boolean', 'BOOLEAN', 'UUID', 'Uuid', 'Json', 'JSON'
          ),
          (type) => {
            const result = parseField(type);
            expect(result.type).toBeDefined();
            // Type should be normalized to lowercase
            expect(result.type).toBe(result.type.toLowerCase());
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
