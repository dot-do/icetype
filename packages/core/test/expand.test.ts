/**
 * Relation Expansion Tests for @icetype/core
 *
 * Tests for expanding (denormalizing) relations in OLAP projections.
 * The expandRelations function takes a schema with relations and expands
 * them into flattened fields for analytical workloads.
 */

import { describe, it, expect } from 'vitest';
import { expandRelations, ExpandError, isExpandError } from '../src/expand.js';
import { parseSchema } from '../src/parser.js';
import type { IceTypeSchema } from '../src/types.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a map of schemas from an array of parsed schemas.
 */
function createSchemaMap(schemas: IceTypeSchema[]): Map<string, IceTypeSchema> {
  const map = new Map<string, IceTypeSchema>();
  for (const schema of schemas) {
    map.set(schema.name, schema);
  }
  return map;
}

// =============================================================================
// expandRelations Tests
// =============================================================================

describe('expandRelations', () => {
  describe('single relation expansion', () => {
    it('should expand a forward reference relation', () => {
      const customerSchema = parseSchema({
        $type: 'Customer',
        id: 'uuid!',
        name: 'string!',
        email: 'string',
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        customer: '-> Customer',
        total: 'decimal(10,2)',
      });

      const allSchemas = createSchemaMap([customerSchema, orderSchema]);
      const expanded = expandRelations(orderSchema, ['customer'], allSchemas);

      // Should have original fields plus expanded customer fields
      expect(expanded.fields.has('id')).toBe(true);
      expect(expanded.fields.has('total')).toBe(true);

      // Should have expanded customer fields with prefix
      expect(expanded.fields.has('customer_id')).toBe(true);
      expect(expanded.fields.has('customer_name')).toBe(true);
      expect(expanded.fields.has('customer_email')).toBe(true);

      // Check types are preserved
      expect(expanded.fields.get('customer_id')?.type).toBe('uuid');
      expect(expanded.fields.get('customer_name')?.type).toBe('string');
    });

    it('should handle optional forward reference relation', () => {
      const categorySchema = parseSchema({
        $type: 'Category',
        id: 'uuid!',
        name: 'string!',
      });

      const productSchema = parseSchema({
        $type: 'Product',
        id: 'uuid!',
        name: 'string!',
        category: '-> Category?',
      });

      const allSchemas = createSchemaMap([categorySchema, productSchema]);
      const expanded = expandRelations(productSchema, ['category'], allSchemas);

      // Expanded fields from optional relation should be optional
      expect(expanded.fields.get('category_id')?.isOptional).toBe(true);
      expect(expanded.fields.get('category_name')?.isOptional).toBe(true);
    });

    it('should expand a regular field (non-relation)', () => {
      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        status: 'string!',
        total: 'decimal(10,2)',
      });

      const allSchemas = createSchemaMap([orderSchema]);
      // Expanding a non-relation field should just include it
      const expanded = expandRelations(orderSchema, ['status'], allSchemas);

      expect(expanded.fields.has('id')).toBe(true);
      expect(expanded.fields.has('status')).toBe(true);
      expect(expanded.fields.has('total')).toBe(true);
    });
  });

  describe('nested relation expansion', () => {
    it('should expand nested relations (author.company)', () => {
      const companySchema = parseSchema({
        $type: 'Company',
        id: 'uuid!',
        name: 'string!',
        country: 'string',
      });

      const authorSchema = parseSchema({
        $type: 'Author',
        id: 'uuid!',
        name: 'string!',
        company: '-> Company',
      });

      const postSchema = parseSchema({
        $type: 'Post',
        id: 'uuid!',
        title: 'string!',
        author: '-> Author',
      });

      const allSchemas = createSchemaMap([companySchema, authorSchema, postSchema]);
      const expanded = expandRelations(postSchema, ['author', 'author.company'], allSchemas);

      // Original fields
      expect(expanded.fields.has('id')).toBe(true);
      expect(expanded.fields.has('title')).toBe(true);

      // First level expansion (author)
      expect(expanded.fields.has('author_id')).toBe(true);
      expect(expanded.fields.has('author_name')).toBe(true);

      // Nested expansion (author.company)
      expect(expanded.fields.has('author_company_id')).toBe(true);
      expect(expanded.fields.has('author_company_name')).toBe(true);
      expect(expanded.fields.has('author_company_country')).toBe(true);
    });

    it('should handle deeply nested relations (a.b.c)', () => {
      const countrySchema = parseSchema({
        $type: 'Country',
        id: 'uuid!',
        name: 'string!',
        code: 'string!',
      });

      const citySchema = parseSchema({
        $type: 'City',
        id: 'uuid!',
        name: 'string!',
        country: '-> Country',
      });

      const addressSchema = parseSchema({
        $type: 'Address',
        id: 'uuid!',
        street: 'string!',
        city: '-> City',
      });

      const userSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        address: '-> Address',
      });

      const allSchemas = createSchemaMap([countrySchema, citySchema, addressSchema, userSchema]);
      const expanded = expandRelations(
        userSchema,
        ['address', 'address.city', 'address.city.country'],
        allSchemas
      );

      // Check deeply nested expansion
      expect(expanded.fields.has('address_city_country_id')).toBe(true);
      expect(expanded.fields.has('address_city_country_name')).toBe(true);
      expect(expanded.fields.has('address_city_country_code')).toBe(true);
    });
  });

  describe('has-many expansion', () => {
    it('should expand has-many relations as array', () => {
      const tagSchema = parseSchema({
        $type: 'Tag',
        id: 'uuid!',
        name: 'string!',
      });

      const postTagSchema = parseSchema({
        $type: 'PostTag',
        id: 'uuid!',
        postId: 'uuid!',
        tag: '-> Tag',
      });

      const postSchema = parseSchema({
        $type: 'Post',
        id: 'uuid!',
        title: 'string!',
        tags: '<- PostTag.postId[]',
      });

      const allSchemas = createSchemaMap([tagSchema, postTagSchema, postSchema]);
      const expanded = expandRelations(postSchema, ['tags'], allSchemas);

      // Has-many should expand as array fields
      expect(expanded.fields.has('tags')).toBe(true);
      const tagsField = expanded.fields.get('tags');
      expect(tagsField?.isArray).toBe(true);
    });

    it('should handle has-many with nested expansion', () => {
      const categorySchema = parseSchema({
        $type: 'Category',
        id: 'uuid!',
        name: 'string!',
      });

      const itemSchema = parseSchema({
        $type: 'OrderItem',
        id: 'uuid!',
        orderId: 'uuid!',
        productName: 'string!',
        category: '-> Category',
        quantity: 'int!',
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        items: '<- OrderItem.orderId[]',
      });

      const allSchemas = createSchemaMap([categorySchema, itemSchema, orderSchema]);
      const expanded = expandRelations(orderSchema, ['items', 'items.category'], allSchemas);

      // items should be an array
      expect(expanded.fields.get('items')?.isArray).toBe(true);

      // Nested expansion within array - creates flattened nested fields
      expect(expanded.fields.has('items_category_id')).toBe(true);
      expect(expanded.fields.has('items_category_name')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw ExpandError when target schema is missing', () => {
      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        customer: '-> Customer', // Customer schema doesn't exist
      });

      const allSchemas = createSchemaMap([orderSchema]);

      expect(() => {
        expandRelations(orderSchema, ['customer'], allSchemas);
      }).toThrow(ExpandError);

      try {
        expandRelations(orderSchema, ['customer'], allSchemas);
      } catch (e) {
        expect(isExpandError(e)).toBe(true);
        expect((e as ExpandError).code).toContain('MISSING_SCHEMA');
        expect((e as ExpandError).message).toContain('Customer');
      }
    });

    it('should throw ExpandError when expansion path does not exist', () => {
      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        total: 'decimal(10,2)',
      });

      const allSchemas = createSchemaMap([orderSchema]);

      expect(() => {
        expandRelations(orderSchema, ['nonExistentField'], allSchemas);
      }).toThrow(ExpandError);
    });

    it('should throw ExpandError for nested path when intermediate field is not a relation', () => {
      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        total: 'decimal(10,2)', // Not a relation
      });

      const allSchemas = createSchemaMap([orderSchema]);

      expect(() => {
        expandRelations(orderSchema, ['total.somefield'], allSchemas);
      }).toThrow(ExpandError);

      try {
        expandRelations(orderSchema, ['total.somefield'], allSchemas);
      } catch (e) {
        expect((e as ExpandError).code).toContain('NOT_A_RELATION');
      }
    });
  });

  describe('circular reference detection', () => {
    it('should detect and throw error for direct circular references', () => {
      const personSchema = parseSchema({
        $type: 'Person',
        id: 'uuid!',
        name: 'string!',
        manager: '-> Person?', // Self-referencing
      });

      const allSchemas = createSchemaMap([personSchema]);

      // Expanding manager.manager would be circular
      expect(() => {
        expandRelations(personSchema, ['manager', 'manager.manager'], allSchemas);
      }).toThrow(ExpandError);

      try {
        expandRelations(personSchema, ['manager', 'manager.manager'], allSchemas);
      } catch (e) {
        expect((e as ExpandError).code).toContain('CIRCULAR_REFERENCE');
      }
    });

    it('should detect indirect circular references (A -> B -> A)', () => {
      const authorSchema = parseSchema({
        $type: 'Author',
        id: 'uuid!',
        name: 'string!',
        favoritePost: '-> Post?',
      });

      const postSchema = parseSchema({
        $type: 'Post',
        id: 'uuid!',
        title: 'string!',
        author: '-> Author',
      });

      const allSchemas = createSchemaMap([authorSchema, postSchema]);

      // Expanding author.favoritePost.author would be circular
      expect(() => {
        expandRelations(postSchema, ['author', 'author.favoritePost', 'author.favoritePost.author'], allSchemas);
      }).toThrow(ExpandError);

      try {
        expandRelations(postSchema, ['author', 'author.favoritePost', 'author.favoritePost.author'], allSchemas);
      } catch (e) {
        expect((e as ExpandError).code).toContain('CIRCULAR_REFERENCE');
      }
    });

    it('should allow same type if not in direct expansion path', () => {
      const userSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
      });

      // Two different relations to the same User type
      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        customer: '-> User',
        salesRep: '-> User',
      });

      const allSchemas = createSchemaMap([userSchema, orderSchema]);

      // This should NOT throw - expanding two different relations to the same type is fine
      const expanded = expandRelations(orderSchema, ['customer', 'salesRep'], allSchemas);

      expect(expanded.fields.has('customer_id')).toBe(true);
      expect(expanded.fields.has('customer_name')).toBe(true);
      expect(expanded.fields.has('salesRep_id')).toBe(true);
      expect(expanded.fields.has('salesRep_name')).toBe(true);
    });
  });

  describe('expanded schema metadata', () => {
    it('should preserve original schema name with _expanded suffix', () => {
      const customerSchema = parseSchema({
        $type: 'Customer',
        id: 'uuid!',
        name: 'string!',
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        customer: '-> Customer',
      });

      const allSchemas = createSchemaMap([customerSchema, orderSchema]);
      const expanded = expandRelations(orderSchema, ['customer'], allSchemas);

      expect(expanded.name).toBe('Order_expanded');
    });

    it('should not include relation fields from the original schema', () => {
      const customerSchema = parseSchema({
        $type: 'Customer',
        id: 'uuid!',
        name: 'string!',
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        customer: '-> Customer',
      });

      const allSchemas = createSchemaMap([customerSchema, orderSchema]);
      const expanded = expandRelations(orderSchema, ['customer'], allSchemas);

      // The original 'customer' relation field should be replaced by expanded fields
      // It should not exist as a relation reference anymore
      expect(expanded.relations.has('customer')).toBe(false);
    });
  });

  describe('preserving field modifiers', () => {
    it('should preserve required modifiers on expanded fields', () => {
      const customerSchema = parseSchema({
        $type: 'Customer',
        id: 'uuid!',
        name: 'string!', // Required
        email: 'string?', // Optional
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        customer: '-> Customer', // Required relation (default, no ? modifier)
      });

      const allSchemas = createSchemaMap([customerSchema, orderSchema]);
      const expanded = expandRelations(orderSchema, ['customer'], allSchemas);

      // Since relation is required and source field is required, expanded should be required
      expect(expanded.fields.get('customer_name')?.isOptional).toBe(false);
      // Source field is optional
      expect(expanded.fields.get('customer_email')?.isOptional).toBe(true);
    });

    it('should make all expanded fields optional when relation is optional', () => {
      const customerSchema = parseSchema({
        $type: 'Customer',
        id: 'uuid!',
        name: 'string!', // Required in source
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        customer: '-> Customer?', // Optional relation
      });

      const allSchemas = createSchemaMap([customerSchema, orderSchema]);
      const expanded = expandRelations(orderSchema, ['customer'], allSchemas);

      // All expanded fields should be optional since the relation is optional
      expect(expanded.fields.get('customer_id')?.isOptional).toBe(true);
      expect(expanded.fields.get('customer_name')?.isOptional).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty expansions array', () => {
      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        total: 'decimal(10,2)',
      });

      const allSchemas = createSchemaMap([orderSchema]);
      const expanded = expandRelations(orderSchema, [], allSchemas);

      // Should return a copy with _expanded suffix but same fields
      expect(expanded.name).toBe('Order_expanded');
      expect(expanded.fields.has('id')).toBe(true);
      expect(expanded.fields.has('total')).toBe(true);
    });

    it('should handle schema with no relations', () => {
      const simpleSchema = parseSchema({
        $type: 'Simple',
        id: 'uuid!',
        name: 'string!',
        value: 'int',
      });

      const allSchemas = createSchemaMap([simpleSchema]);
      const expanded = expandRelations(simpleSchema, [], allSchemas);

      expect(expanded.fields.size).toBe(3);
    });

    it('should deduplicate expansions', () => {
      const customerSchema = parseSchema({
        $type: 'Customer',
        id: 'uuid!',
        name: 'string!',
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        customer: '-> Customer',
      });

      const allSchemas = createSchemaMap([customerSchema, orderSchema]);
      // Duplicate expansion paths should be handled gracefully
      const expanded = expandRelations(orderSchema, ['customer', 'customer'], allSchemas);

      // Should not create duplicate fields
      expect(expanded.fields.has('customer_id')).toBe(true);
      expect(expanded.fields.has('customer_name')).toBe(true);
    });
  });
});

// =============================================================================
// isExpandError Tests
// =============================================================================

describe('isExpandError', () => {
  it('should return true for ExpandError instances', () => {
    const error = new ExpandError('test error', { code: 'EXPAND_MISSING_SCHEMA' });
    expect(isExpandError(error)).toBe(true);
  });

  it('should return false for regular Error instances', () => {
    const error = new Error('regular error');
    expect(isExpandError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isExpandError(null)).toBe(false);
    expect(isExpandError(undefined)).toBe(false);
    expect(isExpandError('string')).toBe(false);
    expect(isExpandError(123)).toBe(false);
  });
});
