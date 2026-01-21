/**
 * Tests for @icetype/test-utils
 *
 * Verifies that all schema factories and mock schemas work correctly.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import {
  // Factories
  createSimpleSchema,
  createTypedSchema,
  createAllTypesSchema,
  createArraySchema,
  createModifierSchema,
  createRelationSchema,
  createNumericSchema,
  createDefaultsSchema,
  createEmptySchema,
  // Mock schemas
  UserSchema,
  UserProfileSchema,
  PostSchema,
  CommentSchema,
  CategorySchema,
  ProductSchema,
  OrderSchema,
  OrderItemSchema,
  EventSchema,
  LogEntrySchema,
  ApiKeySchema,
  TenantSchema,
  mockSchemas,
  schemaNames,
} from '../index.js';

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('Schema Factory Functions', () => {
  describe('createSimpleSchema', () => {
    it('should create a schema with given name and fields', () => {
      const schema = createSimpleSchema('TestEntity', {
        id: 'uuid!',
        name: 'string',
      });

      expect(schema.name).toBe('TestEntity');
      expect(schema.fields.has('id')).toBe(true);
      expect(schema.fields.has('name')).toBe(true);
    });

    it('should handle field modifiers correctly', () => {
      const schema = createSimpleSchema('User', {
        id: 'uuid!',
        email: 'string#',
        nickname: 'string?',
      });

      expect(schema.fields.get('id')?.isUnique).toBe(true);
      expect(schema.fields.get('email')?.isUnique).toBe(true);
      expect(schema.fields.get('email')?.isIndexed).toBe(true);
      expect(schema.fields.get('nickname')?.isOptional).toBe(true);
    });

    it('should work with various type definitions', () => {
      const schema = createSimpleSchema('Mixed', {
        text: 'string',
        number: 'int',
        decimal: 'decimal(10,2)',
        list: 'string[]',
      });

      expect(schema.fields.get('text')?.type).toBe('string');
      expect(schema.fields.get('number')?.type).toBe('int');
      expect(schema.fields.get('decimal')?.type).toBe('decimal');
      expect(schema.fields.get('list')?.isArray).toBe(true);
    });
  });

  describe('createTypedSchema', () => {
    it('should create a schema with directives', () => {
      const schema = createTypedSchema(
        'Event',
        { id: 'uuid!', data: 'json' },
        { partitionBy: ['id'], index: [['data']] }
      );

      expect(schema.name).toBe('Event');
      expect(schema.directives.partitionBy).toEqual(['id']);
      expect(schema.directives.index).toBeDefined();
    });

    it('should support FTS directive', () => {
      const schema = createTypedSchema(
        'Article',
        { id: 'uuid!', title: 'string', content: 'text' },
        { fts: ['title', 'content'] }
      );

      expect(schema.directives.fts).toEqual(['title', 'content']);
    });

    it('should support vector directive', () => {
      const schema = createTypedSchema(
        'Document',
        { id: 'uuid!', embedding: 'json' },
        { vector: { embedding: 1536 } }
      );

      expect(schema.directives.vector).toBeDefined();
    });

    it('should work without options', () => {
      const schema = createTypedSchema('Simple', { id: 'uuid!' });
      expect(schema.name).toBe('Simple');
    });
  });

  describe('createAllTypesSchema', () => {
    it('should create a schema with all primitive types', () => {
      const schema = createAllTypesSchema();

      expect(schema.name).toBe('AllTypes');
      expect(schema.fields.has('stringField')).toBe(true);
      expect(schema.fields.has('textField')).toBe(true);
      expect(schema.fields.has('intField')).toBe(true);
      expect(schema.fields.has('longField')).toBe(true);
      expect(schema.fields.has('bigintField')).toBe(true);
      expect(schema.fields.has('floatField')).toBe(true);
      expect(schema.fields.has('doubleField')).toBe(true);
      expect(schema.fields.has('boolField')).toBe(true);
      expect(schema.fields.has('booleanField')).toBe(true);
      expect(schema.fields.has('uuidField')).toBe(true);
      expect(schema.fields.has('timestampField')).toBe(true);
      expect(schema.fields.has('timestamptzField')).toBe(true);
      expect(schema.fields.has('dateField')).toBe(true);
      expect(schema.fields.has('timeField')).toBe(true);
      expect(schema.fields.has('jsonField')).toBe(true);
      expect(schema.fields.has('binaryField')).toBe(true);
      expect(schema.fields.has('decimalField')).toBe(true);
    });

    it('should accept custom name', () => {
      const schema = createAllTypesSchema('CustomAllTypes');
      expect(schema.name).toBe('CustomAllTypes');
    });
  });

  describe('createArraySchema', () => {
    it('should create a schema with array fields', () => {
      const schema = createArraySchema();

      expect(schema.name).toBe('ArrayTypes');
      expect(schema.fields.get('tags')?.isArray).toBe(true);
      expect(schema.fields.get('scores')?.isArray).toBe(true);
    });

    it('should accept custom name', () => {
      const schema = createArraySchema('Tags');
      expect(schema.name).toBe('Tags');
    });
  });

  describe('createModifierSchema', () => {
    it('should create a schema demonstrating all modifiers', () => {
      const schema = createModifierSchema();

      expect(schema.name).toBe('Modifiers');
      expect(schema.fields.get('requiredField')?.isUnique).toBe(true);
      expect(schema.fields.get('optionalField')?.isOptional).toBe(true);
      expect(schema.fields.get('uniqueField')?.isIndexed).toBe(true);
    });
  });

  describe('createRelationSchema', () => {
    it('should create a schema with relation fields', () => {
      const schema = createRelationSchema();

      expect(schema.name).toBe('Relations');
      expect(schema.relations).toBeDefined();
      expect(schema.relations.size).toBeGreaterThan(0);
    });

    it('should include forward and backward relations', () => {
      const schema = createRelationSchema('Post');

      // Check that relations are parsed
      expect(schema.relations.size).toBeGreaterThan(0);
    });
  });

  describe('createNumericSchema', () => {
    it('should create a schema with various numeric types', () => {
      const schema = createNumericSchema();

      expect(schema.name).toBe('Numerics');
      expect(schema.fields.get('amount')?.type).toBe('decimal');
      expect(schema.fields.get('amount')?.precision).toBe(18);
      expect(schema.fields.get('amount')?.scale).toBe(2);
      expect(schema.fields.get('rate')?.type).toBe('float');
      expect(schema.fields.get('total')?.type).toBe('double');
    });
  });

  describe('createDefaultsSchema', () => {
    it('should create a schema with default values', () => {
      const schema = createDefaultsSchema();

      expect(schema.name).toBe('Defaults');
      expect(schema.fields.get('status')?.defaultValue).toBe('active');
      expect(schema.fields.get('count')?.defaultValue).toBe(0);
      expect(schema.fields.get('enabled')?.defaultValue).toBe(true);
    });
  });

  describe('createEmptySchema', () => {
    it('should create a schema with no user fields', () => {
      const schema = createEmptySchema('Empty');

      expect(schema.name).toBe('Empty');
      expect(schema.fields.size).toBe(0);
    });
  });
});

// =============================================================================
// Mock Schema Tests
// =============================================================================

describe('Pre-built Mock Schemas', () => {
  describe('UserSchema', () => {
    it('should have expected structure', () => {
      expect(UserSchema.name).toBe('User');
      expect(UserSchema.fields.has('id')).toBe(true);
      expect(UserSchema.fields.has('email')).toBe(true);
      expect(UserSchema.fields.has('name')).toBe(true);
      expect(UserSchema.fields.get('email')?.isIndexed).toBe(true);
    });
  });

  describe('UserProfileSchema', () => {
    it('should have expected structure', () => {
      expect(UserProfileSchema.name).toBe('UserProfile');
      expect(UserProfileSchema.fields.has('userId')).toBe(true);
      expect(UserProfileSchema.fields.has('bio')).toBe(true);
    });
  });

  describe('PostSchema', () => {
    it('should have expected structure with FTS', () => {
      expect(PostSchema.name).toBe('Post');
      expect(PostSchema.fields.has('title')).toBe(true);
      expect(PostSchema.fields.has('content')).toBe(true);
      expect(PostSchema.directives.fts).toContain('title');
      expect(PostSchema.directives.fts).toContain('content');
    });
  });

  describe('CommentSchema', () => {
    it('should have expected structure', () => {
      expect(CommentSchema.name).toBe('Comment');
      expect(CommentSchema.fields.has('content')).toBe(true);
      expect(CommentSchema.fields.has('postId')).toBe(true);
    });
  });

  describe('CategorySchema', () => {
    it('should have expected structure', () => {
      expect(CategorySchema.name).toBe('Category');
      expect(CategorySchema.fields.has('name')).toBe(true);
      expect(CategorySchema.fields.has('slug')).toBe(true);
    });
  });

  describe('ProductSchema', () => {
    it('should have expected structure with decimal fields', () => {
      expect(ProductSchema.name).toBe('Product');
      expect(ProductSchema.fields.get('price')?.type).toBe('decimal');
      expect(ProductSchema.fields.get('price')?.precision).toBe(10);
      expect(ProductSchema.fields.get('price')?.scale).toBe(2);
    });
  });

  describe('OrderSchema', () => {
    it('should have partition directive', () => {
      expect(OrderSchema.name).toBe('Order');
      expect(OrderSchema.directives.partitionBy).toContain('customerId');
    });
  });

  describe('OrderItemSchema', () => {
    it('should have expected structure', () => {
      expect(OrderItemSchema.name).toBe('OrderItem');
      expect(OrderItemSchema.fields.has('orderId')).toBe(true);
      expect(OrderItemSchema.fields.has('productId')).toBe(true);
    });
  });

  describe('EventSchema', () => {
    it('should have expected analytics structure', () => {
      expect(EventSchema.name).toBe('Event');
      expect(EventSchema.fields.has('eventType')).toBe(true);
      expect(EventSchema.fields.has('properties')).toBe(true);
      expect(EventSchema.directives.partitionBy).toContain('eventType');
    });
  });

  describe('LogEntrySchema', () => {
    it('should have expected structure', () => {
      expect(LogEntrySchema.name).toBe('LogEntry');
      expect(LogEntrySchema.fields.has('level')).toBe(true);
      expect(LogEntrySchema.fields.has('message')).toBe(true);
    });
  });

  describe('ApiKeySchema', () => {
    it('should have expected structure', () => {
      expect(ApiKeySchema.name).toBe('ApiKey');
      expect(ApiKeySchema.fields.has('key')).toBe(true);
      expect(ApiKeySchema.fields.has('scopes')).toBe(true);
    });
  });

  describe('TenantSchema', () => {
    it('should have expected structure', () => {
      expect(TenantSchema.name).toBe('Tenant');
      expect(TenantSchema.fields.has('name')).toBe(true);
      expect(TenantSchema.fields.has('slug')).toBe(true);
    });
  });

  describe('mockSchemas collection', () => {
    it('should contain all schemas', () => {
      expect(mockSchemas.User).toBe(UserSchema);
      expect(mockSchemas.Post).toBe(PostSchema);
      expect(mockSchemas.Product).toBe(ProductSchema);
      expect(mockSchemas.Order).toBe(OrderSchema);
      expect(mockSchemas.Event).toBe(EventSchema);
    });

    it('should have matching schemaNames', () => {
      expect(schemaNames.length).toBe(Object.keys(mockSchemas).length);
      for (const name of schemaNames) {
        expect(mockSchemas[name]).toBeDefined();
      }
    });
  });

  describe('All mock schemas are valid', () => {
    it.each(schemaNames)('%s schema should be parseable and have valid structure', (name) => {
      const schema = mockSchemas[name];
      expect(schema).toBeDefined();
      expect(schema.name).toBe(name);
      expect(schema.fields).toBeInstanceOf(Map);
      expect(schema.relations).toBeInstanceOf(Map);
      expect(typeof schema.directives).toBe('object');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Type Exports', () => {
  it('should export FieldSpec type that is distinct from core FieldDefinition', () => {
    // Import both types - they should not collide
    // FieldSpec from test-utils is a simple string type alias for field definitions
    // FieldDefinition from core is a complex interface with name, type, modifier, etc.

    // Test that FieldSpec (formerly FieldDefinition) is usable as a string
    // We use type assertion to verify this compiles correctly
    const fieldSpec = 'string!' as import('../factories.js').FieldSpec;
    expect(typeof fieldSpec).toBe('string');

    // Test that core FieldDefinition is a different type (object with properties)
    const schema = createSimpleSchema('TestType', {
      testField: 'string!',
    });
    const coreFieldDef = schema.fields.get('testField');
    expect(coreFieldDef).toBeDefined();
    expect(typeof coreFieldDef?.name).toBe('string');
    expect(typeof coreFieldDef?.type).toBe('string');
    expect(typeof coreFieldDef?.modifier).toBe('string');
    expect(typeof coreFieldDef?.isArray).toBe('boolean');
  });

  it('should allow importing both types in the same file without collision', () => {
    // This test ensures the type renaming prevents confusion
    // At compile time, TypeScript will verify that both types can be imported
    // without name collisions. The actual test just verifies the module structure.

    // FieldSpec is a type alias (string), so it won't exist at runtime
    // FieldDefinition is an interface, so it also won't exist at runtime
    // The key verification is that TypeScript compilation succeeds

    // Verify that the test-utils exports work correctly
    const schema = createSimpleSchema('TestSchema', { id: 'uuid!' });
    expect(schema.name).toBe('TestSchema');

    // Verify we can access the core FieldDefinition structure
    const field = schema.fields.get('id');
    expect(field).toBeDefined();
    expect(field?.name).toBe('id');
  });
});

describe('Integration Tests', () => {
  it('should allow creating schemas similar to mock schemas using factories', () => {
    const customUser = createSimpleSchema('CustomUser', {
      id: 'uuid!',
      email: 'string#',
      name: 'string',
    });

    // Both should have similar structure
    expect(customUser.fields.has('id')).toBe(true);
    expect(customUser.fields.has('email')).toBe(true);
    expect(customUser.fields.get('email')?.isIndexed).toBe(UserSchema.fields.get('email')?.isIndexed);
  });

  it('should support creating backend-specific test schemas', () => {
    // Schema suitable for ClickHouse with partitioning
    const clickhouseSchema = createTypedSchema(
      'AnalyticsEvent',
      {
        id: 'uuid!',
        eventType: 'string!',
        timestamp: 'timestamp!',
        data: 'json',
      },
      { partitionBy: ['eventType'] }
    );

    expect(clickhouseSchema.directives.partitionBy).toContain('eventType');

    // Schema suitable for Postgres with FTS
    const postgresSchema = createTypedSchema(
      'SearchableContent',
      {
        id: 'uuid!',
        title: 'string!',
        body: 'text',
      },
      { fts: ['title', 'body'] }
    );

    expect(postgresSchema.directives.fts).toContain('title');
  });
});
