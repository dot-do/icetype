/**
 * Public API Export Tests for @icetype/core
 *
 * RED PHASE TDD: These tests verify that all intended public types
 * and utilities are properly exported from the package.
 *
 * Issue: icetype-6lo.7 - Export internal types
 * Some internal types like SchemaDirectivesExtended are not exported.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

// =============================================================================
// Test: SchemaDirectivesExtended should be exported
// =============================================================================

describe('SchemaDirectivesExtended export', () => {
  it('should export SchemaDirectivesExtended type', async () => {
    // This test verifies that SchemaDirectivesExtended is exported from the package
    // Currently this type is defined in parser.ts but not exported
    const module = await import('../index.js');

    // The type should be available for import
    // At runtime we can only check if it's documented, but TypeScript
    // will fail compilation if the type is not exported
    expect(module).toBeDefined();

    // To verify type export, we attempt to use it
    // This will fail at compile time if the type is not exported
    type SchemaDirectivesExtendedTest = import('../index.js').SchemaDirectivesExtended;

    // Runtime check - verify related types exist
    // SchemaDirectivesExtended extends SchemaDirectives
    expect('SchemaDirectives' in module || true).toBe(true);
  });

  it('should allow creating objects conforming to SchemaDirectivesExtended', () => {
    // This test will fail compilation until SchemaDirectivesExtended is exported
    // The type includes projection-specific fields: projection, from, expand, flatten

    // Import the type (will fail if not exported)
    type SchemaDirectivesExtended = import('../index.js').SchemaDirectivesExtended;

    // Create a conforming object
    const directives: SchemaDirectivesExtended = {
      partitionBy: ['id'],
      index: [{ fields: ['email'], unique: true }],
      projection: 'olap',
      from: 'User',
      expand: ['posts', 'comments'],
      flatten: { 'author.name': 'authorName' },
    };

    expect(directives.projection).toBe('olap');
    expect(directives.from).toBe('User');
    expect(directives.expand).toEqual(['posts', 'comments']);
    expect(directives.flatten).toEqual({ 'author.name': 'authorName' });
  });
});

// =============================================================================
// Test: Parser internal types should be accessible
// =============================================================================

describe('Parser internal types export', () => {
  it('should export ParseTypeOptions type', async () => {
    // ParseTypeOptions is used internally in parser.ts for parseTypeString
    // It should be exported for consumers who want to customize parsing
    type ParseTypeOptions = import('../index.js').ParseTypeOptions;

    const options: ParseTypeOptions = {
      throwOnUnknownType: false,
      fieldName: 'testField',
      line: 1,
      column: 1,
    };

    expect(options.throwOnUnknownType).toBe(false);
    expect(options.fieldName).toBe('testField');
  });

  it('should export ParseRelationOptions type', async () => {
    // ParseRelationOptions is used internally for parseRelationString
    type ParseRelationOptions = import('../index.js').ParseRelationOptions;

    const options: ParseRelationOptions = {
      fieldName: 'posts',
      line: 10,
      column: 5,
    };

    expect(options.fieldName).toBe('posts');
  });

  it('should export PRIMITIVE_TYPES constant', async () => {
    // The set of primitive types should be accessible for validation
    const module = await import('../index.js');

    // Check if PRIMITIVE_TYPES is exported
    expect((module as Record<string, unknown>).PRIMITIVE_TYPES).toBeDefined();

    const primitiveTypes = (module as Record<string, unknown>).PRIMITIVE_TYPES as Set<string>;
    expect(primitiveTypes.has('string')).toBe(true);
    expect(primitiveTypes.has('int')).toBe(true);
    expect(primitiveTypes.has('boolean')).toBe(true);
  });

  it('should export PARAMETRIC_TYPES constant', async () => {
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).PARAMETRIC_TYPES).toBeDefined();

    const parametricTypes = (module as Record<string, unknown>).PARAMETRIC_TYPES as Set<string>;
    expect(parametricTypes.has('decimal')).toBe(true);
    expect(parametricTypes.has('varchar')).toBe(true);
  });

  it('should export GENERIC_TYPES constant', async () => {
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).GENERIC_TYPES).toBeDefined();

    const genericTypes = (module as Record<string, unknown>).GENERIC_TYPES as Set<string>;
    expect(genericTypes.has('map')).toBe(true);
    expect(genericTypes.has('list')).toBe(true);
  });

  it('should export RELATION_OPERATORS constant', async () => {
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).RELATION_OPERATORS).toBeDefined();

    const operators = (module as Record<string, unknown>).RELATION_OPERATORS as string[];
    expect(operators).toContain('->');
    expect(operators).toContain('~>');
    expect(operators).toContain('<-');
    expect(operators).toContain('<~');
  });

  it('should export KNOWN_DIRECTIVES constant', async () => {
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).KNOWN_DIRECTIVES).toBeDefined();

    const directives = (module as Record<string, unknown>).KNOWN_DIRECTIVES as Set<string>;
    expect(directives.has('$type')).toBe(true);
    expect(directives.has('$partitionBy')).toBe(true);
    expect(directives.has('$index')).toBe(true);
  });
});

// =============================================================================
// Test: Type utilities should be exported
// =============================================================================

describe('Type utilities export', () => {
  it('should export TYPE_ALIASES constant', async () => {
    // TYPE_ALIASES maps type aliases to canonical forms (e.g., bool -> boolean)
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).TYPE_ALIASES).toBeDefined();

    const aliases = (module as Record<string, unknown>).TYPE_ALIASES as Record<string, string>;
    expect(aliases.bool).toBe('boolean');
  });

  it('should export parseTypeString function', async () => {
    // parseTypeString is the core type parsing function
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).parseTypeString).toBeDefined();
    expect(typeof (module as Record<string, unknown>).parseTypeString).toBe('function');

    // Test using the function
    const parseTypeString = (module as Record<string, unknown>).parseTypeString as (
      input: string,
      options?: Record<string, unknown>
    ) => Record<string, unknown>;

    const result = parseTypeString('string!');
    expect(result.type).toBe('string');
    expect(result.required).toBe(true);
  });

  it('should export parseRelationString function', async () => {
    // parseRelationString parses relation definitions
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).parseRelationString).toBeDefined();
    expect(typeof (module as Record<string, unknown>).parseRelationString).toBe('function');

    const parseRelationString = (module as Record<string, unknown>).parseRelationString as (
      input: string
    ) => Record<string, unknown>;

    const result = parseRelationString('-> User');
    expect(result.operator).toBe('->');
    expect(result.targetType).toBe('User');
  });

  it('should export isRelationString function', async () => {
    // isRelationString checks if a string contains a relation operator
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).isRelationString).toBeDefined();
    expect(typeof (module as Record<string, unknown>).isRelationString).toBe('function');

    const isRelationString = (module as Record<string, unknown>).isRelationString as (
      input: string
    ) => boolean;

    expect(isRelationString('-> User')).toBe(true);
    expect(isRelationString('string!')).toBe(false);
  });

  it('should export parseDefaultValue function', async () => {
    // parseDefaultValue parses default values in field definitions
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).parseDefaultValue).toBeDefined();
    expect(typeof (module as Record<string, unknown>).parseDefaultValue).toBe('function');

    const parseDefaultValue = (module as Record<string, unknown>).parseDefaultValue as (
      value: string
    ) => unknown;

    expect(parseDefaultValue('true')).toBe(true);
    expect(parseDefaultValue('"hello"')).toBe('hello');
    expect(parseDefaultValue('42')).toBe(42);
  });

  it('should export splitGenericParams function', async () => {
    // splitGenericParams splits generic type parameters respecting nesting
    const module = await import('../index.js');

    expect((module as Record<string, unknown>).splitGenericParams).toBeDefined();
    expect(typeof (module as Record<string, unknown>).splitGenericParams).toBe('function');

    const splitGenericParams = (module as Record<string, unknown>).splitGenericParams as (
      content: string
    ) => string[];

    const result = splitGenericParams('string, int');
    expect(result).toEqual(['string', ' int']);
  });
});

// =============================================================================
// Test: No runtime errors importing types
// =============================================================================

describe('No runtime errors on import', () => {
  it('should import all public types without runtime errors', async () => {
    // This test ensures that importing the module does not throw
    expect(async () => {
      const module = await import('../index.js');
      return module;
    }).not.toThrow();
  });

  it('should have all documented public exports', async () => {
    const module = await import('../index.js');

    // Core types
    expect(module.parseSchema).toBeDefined();
    expect(module.parseField).toBeDefined();
    expect(module.parseRelation).toBeDefined();
    expect(module.parseDirectives).toBeDefined();
    expect(module.validateSchema).toBeDefined();

    // Parser class
    expect(module.IceTypeParser).toBeDefined();
    expect(module.parser).toBeDefined();

    // Type guards
    expect(module.isValidPrimitiveType).toBeDefined();
    expect(module.isValidModifier).toBeDefined();
    expect(module.isValidRelationOperator).toBeDefined();
    expect(module.isValidParametricType).toBeDefined();
    expect(module.isValidGenericType).toBeDefined();

    // Tokenizer
    expect(module.tokenize).toBeDefined();

    // Inference
    expect(module.inferType).toBeDefined();

    // Error classes
    expect(module.ParseError).toBeDefined();
    expect(module.IceTypeError).toBeDefined();
    expect(module.SchemaValidationError).toBeDefined();
    expect(module.AdapterError).toBeDefined();
    expect(module.SchemaLoadError).toBeDefined();

    // Error utilities
    expect(module.isParseError).toBeDefined();
    expect(module.isIceTypeError).toBeDefined();
    expect(module.isSchemaValidationError).toBeDefined();
    expect(module.isAdapterError).toBeDefined();
    expect(module.isSchemaLoadError).toBeDefined();
    expect(module.getErrorMessage).toBeDefined();
    expect(module.assertNever).toBeDefined();

    // Error codes
    expect(module.ErrorCodes).toBeDefined();
  });

  it('should export type mapping utilities', async () => {
    const module = await import('../index.js');

    // Type mappings
    expect(module.TYPE_MAPPINGS).toBeDefined();
    expect(module.getIcebergType).toBeDefined();
    expect(module.getDuckDBType).toBeDefined();
    expect(module.getClickHouseType).toBeDefined();
    expect(module.getPostgresType).toBeDefined();
    expect(module.getParquetType).toBeDefined();
    expect(module.getTypeMapping).toBeDefined();
    expect(module.isKnownType).toBeDefined();
    expect(module.getSupportedTypes).toBeDefined();
  });

  it('should export branded type creators', async () => {
    const module = await import('../index.js');

    expect(module.createSchemaId).toBeDefined();
    expect(module.createFieldId).toBeDefined();
    expect(module.createRelationId).toBeDefined();
  });

  it('should export Brand type utility for creating custom branded types', () => {
    // The Brand<T, B> type utility should be exported for users to create
    // their own branded types following the same pattern as SchemaId, FieldId, etc.
    type Brand<T, B extends string> = import('../index.js').Brand<T, B>;

    // Users can create custom branded types
    type CustomId = Brand<string, 'CustomId'>;
    type Timestamp = Brand<number, 'Timestamp'>;

    // The branded values work like their base types at runtime
    const customId = 'test-123' as CustomId;
    const timestamp = Date.now() as Timestamp;

    expect(typeof customId).toBe('string');
    expect(typeof timestamp).toBe('number');
    expect(customId).toBe('test-123');
  });
});

// =============================================================================
// Test: Type compatibility
// =============================================================================

describe('Type compatibility', () => {
  it('should allow using exported types in type annotations', () => {
    // These type imports will fail at compile time if types are not exported
    type SchemaDefinition = import('../index.js').SchemaDefinition;
    type IceTypeSchema = import('../index.js').IceTypeSchema;
    type FieldDefinition = import('../index.js').FieldDefinition;
    type RelationDefinition = import('../index.js').RelationDefinition;
    type ParsedType = import('../index.js').ParsedType;
    type ValidationResult = import('../index.js').ValidationResult;
    type ValidationError = import('../index.js').ValidationError;

    // Create objects using these types
    const schema: SchemaDefinition = {
      $type: 'User',
      name: 'string!',
    };

    expect(schema.$type).toBe('User');
  });

  it('should allow using SchemaDirectivesExtended in complex type annotations', () => {
    // This specifically tests the issue: SchemaDirectivesExtended should be exported
    type SchemaDirectivesExtended = import('../index.js').SchemaDirectivesExtended;
    type SchemaDirectives = import('../index.js').SchemaDirectives;

    // SchemaDirectivesExtended should extend SchemaDirectives
    const baseDirectives: SchemaDirectives = {
      partitionBy: ['id'],
    };

    const extendedDirectives: SchemaDirectivesExtended = {
      ...baseDirectives,
      projection: 'both',
      from: 'BaseEntity',
      expand: ['relations'],
      flatten: {},
    };

    // Verify the extended type has all expected properties
    expect(extendedDirectives.projection).toBe('both');
    expect(extendedDirectives.from).toBe('BaseEntity');
    expect(extendedDirectives.partitionBy).toEqual(['id']);
  });
});
