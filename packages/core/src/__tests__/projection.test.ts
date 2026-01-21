/**
 * Projection Directive Tests for @icetype/core
 *
 * Tests for projection schema directives: $projection, $from, $expand, $flatten
 *
 * Projections allow defining denormalized/materialized views of source entities
 * for OLAP workloads, with automatic flattening of relations.
 */

import { describe, it, expect } from 'vitest';
import {
  parseProjectionDirectives,
  isProjection,
  validateProjection,
  getProjectionSource,
} from '../projection.js';
import { parseSchema } from '../parser.js';
import type { IceTypeSchema } from '../types.js';

// =============================================================================
// parseProjectionDirectives Tests
// =============================================================================

describe('parseProjectionDirectives', () => {
  describe('$projection directive', () => {
    it('should parse $projection: "oltp"', () => {
      const result = parseProjectionDirectives({
        $type: 'UserView',
        $projection: 'oltp',
      });
      expect(result).not.toBeNull();
      expect(result?.projection).toBe('oltp');
    });

    it('should parse $projection: "olap"', () => {
      const result = parseProjectionDirectives({
        $type: 'UserAnalytics',
        $projection: 'olap',
      });
      expect(result).not.toBeNull();
      expect(result?.projection).toBe('olap');
    });

    it('should parse $projection: "both"', () => {
      const result = parseProjectionDirectives({
        $type: 'UserMixed',
        $projection: 'both',
      });
      expect(result).not.toBeNull();
      expect(result?.projection).toBe('both');
    });

    it('should return null for schemas without $projection', () => {
      const result = parseProjectionDirectives({
        $type: 'User',
        name: 'string',
      });
      expect(result).toBeNull();
    });

    it('should reject invalid $projection values', () => {
      expect(() =>
        parseProjectionDirectives({
          $type: 'BadView',
          $projection: 'invalid',
        })
      ).toThrow(/invalid.*projection/i);
    });
  });

  describe('$from directive', () => {
    it('should parse $from with source entity name', () => {
      const result = parseProjectionDirectives({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
      });
      expect(result).not.toBeNull();
      expect(result?.from).toBe('Order');
    });

    it('should allow projection without $from (standalone projection)', () => {
      const result = parseProjectionDirectives({
        $type: 'MetricsView',
        $projection: 'olap',
      });
      expect(result).not.toBeNull();
      expect(result?.from).toBeUndefined();
    });

    it('should reject non-string $from values', () => {
      expect(() =>
        parseProjectionDirectives({
          $type: 'BadView',
          $projection: 'olap',
          $from: 123 as unknown as string,
        })
      ).toThrow(/\$from.*string/i);
    });
  });

  describe('$expand directive', () => {
    it('should parse $expand with single relation path', () => {
      const result = parseProjectionDirectives({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
        $expand: ['user'],
      });
      expect(result).not.toBeNull();
      expect(result?.expand).toEqual(['user']);
    });

    it('should parse $expand with multiple relation paths', () => {
      const result = parseProjectionDirectives({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
        $expand: ['user', 'items', 'shipping'],
      });
      expect(result).not.toBeNull();
      expect(result?.expand).toEqual(['user', 'items', 'shipping']);
    });

    it('should parse $expand with nested relation paths', () => {
      const result = parseProjectionDirectives({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
        $expand: ['user', 'items.product', 'items.product.category'],
      });
      expect(result).not.toBeNull();
      expect(result?.expand).toEqual(['user', 'items.product', 'items.product.category']);
    });

    it('should allow projection without $expand', () => {
      const result = parseProjectionDirectives({
        $type: 'SimpleView',
        $projection: 'oltp',
        $from: 'User',
      });
      expect(result).not.toBeNull();
      expect(result?.expand).toBeUndefined();
    });

    it('should reject non-array $expand values', () => {
      expect(() =>
        parseProjectionDirectives({
          $type: 'BadView',
          $projection: 'olap',
          $expand: 'user' as unknown as string[],
        })
      ).toThrow(/\$expand.*array/i);
    });

    it('should reject $expand with non-string elements', () => {
      expect(() =>
        parseProjectionDirectives({
          $type: 'BadView',
          $projection: 'olap',
          $expand: ['user', 123 as unknown as string],
        })
      ).toThrow(/\$expand.*string/i);
    });
  });

  describe('$flatten directive', () => {
    it('should parse $flatten with explicit field mappings', () => {
      const result = parseProjectionDirectives({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
        $flatten: {
          user_email: 'user.email',
          user_name: 'user.name',
        },
      });
      expect(result).not.toBeNull();
      expect(result?.flatten).toEqual({
        user_email: 'user.email',
        user_name: 'user.name',
      });
    });

    it('should parse $flatten with nested paths', () => {
      const result = parseProjectionDirectives({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
        $flatten: {
          product_category_name: 'items.product.category.name',
        },
      });
      expect(result).not.toBeNull();
      expect(result?.flatten?.['product_category_name']).toBe('items.product.category.name');
    });

    it('should allow projection without $flatten', () => {
      const result = parseProjectionDirectives({
        $type: 'SimpleView',
        $projection: 'oltp',
      });
      expect(result).not.toBeNull();
      expect(result?.flatten).toBeUndefined();
    });

    it('should reject non-object $flatten values', () => {
      expect(() =>
        parseProjectionDirectives({
          $type: 'BadView',
          $projection: 'olap',
          $flatten: ['user.email'] as unknown as Record<string, string>,
        })
      ).toThrow(/\$flatten.*object/i);
    });

    it('should reject $flatten with non-string values', () => {
      expect(() =>
        parseProjectionDirectives({
          $type: 'BadView',
          $projection: 'olap',
          $flatten: {
            user_id: 123 as unknown as string,
          },
        })
      ).toThrow(/\$flatten.*string/i);
    });
  });

  describe('combined directives', () => {
    it('should parse all projection directives together', () => {
      const result = parseProjectionDirectives({
        $type: 'OrderAnalyticsView',
        $projection: 'olap',
        $from: 'Order',
        $expand: ['user', 'items.product'],
        $flatten: {
          user_email: 'user.email',
          product_name: 'items.product.name',
        },
      });

      expect(result).not.toBeNull();
      expect(result?.projection).toBe('olap');
      expect(result?.from).toBe('Order');
      expect(result?.expand).toEqual(['user', 'items.product']);
      expect(result?.flatten).toEqual({
        user_email: 'user.email',
        product_name: 'items.product.name',
      });
    });
  });
});

// =============================================================================
// isProjection Type Guard Tests
// =============================================================================

describe('isProjection', () => {
  it('should return true for schema with $projection directive', () => {
    const schema = parseSchema({
      $type: 'UserView',
      $projection: 'olap',
      $from: 'User',
      id: 'uuid!',
      name: 'string',
    });
    expect(isProjection(schema)).toBe(true);
  });

  it('should return false for regular schema without $projection', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      name: 'string',
    });
    expect(isProjection(schema)).toBe(false);
  });

  it('should return true for oltp projection', () => {
    const schema = parseSchema({
      $type: 'UserCache',
      $projection: 'oltp',
      id: 'uuid!',
    });
    expect(isProjection(schema)).toBe(true);
  });

  it('should return true for both projection', () => {
    const schema = parseSchema({
      $type: 'UserHybrid',
      $projection: 'both',
      id: 'uuid!',
    });
    expect(isProjection(schema)).toBe(true);
  });
});

// =============================================================================
// validateProjection Tests
// =============================================================================

describe('validateProjection', () => {
  // Helper to create a map of schemas
  function createSchemaMap(schemas: IceTypeSchema[]): Map<string, IceTypeSchema> {
    const map = new Map<string, IceTypeSchema>();
    for (const schema of schemas) {
      map.set(schema.name, schema);
    }
    return map;
  }

  describe('source entity validation', () => {
    it('should validate when source entity exists', () => {
      const userSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        email: 'string',
        name: 'string',
      });

      const viewSchema = parseSchema({
        $type: 'UserView',
        $projection: 'olap',
        $from: 'User',
        id: 'uuid!',
      });

      const allSchemas = createSchemaMap([userSchema, viewSchema]);
      const result = validateProjection(viewSchema, allSchemas);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when source entity does not exist', () => {
      const viewSchema = parseSchema({
        $type: 'UserView',
        $projection: 'olap',
        $from: 'NonExistentEntity',
        id: 'uuid!',
      });

      const allSchemas = createSchemaMap([viewSchema]);
      const result = validateProjection(viewSchema, allSchemas);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_SOURCE_ENTITY')).toBe(true);
      expect(result.errors.some((e) => e.message.includes('NonExistentEntity'))).toBe(true);
    });

    it('should pass validation for standalone projection (no $from)', () => {
      const viewSchema = parseSchema({
        $type: 'MetricsView',
        $projection: 'olap',
        totalOrders: 'int',
        revenue: 'decimal(10,2)',
      });

      const allSchemas = createSchemaMap([viewSchema]);
      const result = validateProjection(viewSchema, allSchemas);

      expect(result.valid).toBe(true);
    });
  });

  describe('$expand path validation', () => {
    it('should validate when expand path exists in source schema', () => {
      const userSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        email: 'string',
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        user: '-> User',
        total: 'decimal(10,2)',
      });

      const viewSchema = parseSchema({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
        $expand: ['user'],
        id: 'uuid!',
      });

      const allSchemas = createSchemaMap([userSchema, orderSchema, viewSchema]);
      const result = validateProjection(viewSchema, allSchemas);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when expand path does not exist in source schema', () => {
      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        total: 'decimal(10,2)',
      });

      const viewSchema = parseSchema({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
        $expand: ['nonExistentRelation'],
        id: 'uuid!',
      });

      const allSchemas = createSchemaMap([orderSchema, viewSchema]);
      const result = validateProjection(viewSchema, allSchemas);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_EXPAND_PATH')).toBe(true);
      expect(result.errors.some((e) => e.message.includes('nonExistentRelation'))).toBe(true);
    });

    it('should validate nested expand paths', () => {
      const categorySchema = parseSchema({
        $type: 'Category',
        id: 'uuid!',
        name: 'string',
      });

      const productSchema = parseSchema({
        $type: 'Product',
        id: 'uuid!',
        name: 'string',
        category: '-> Category',
      });

      const orderItemSchema = parseSchema({
        $type: 'OrderItem',
        id: 'uuid!',
        product: '-> Product',
        quantity: 'int',
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        items: '<- OrderItem.order',
      });

      const viewSchema = parseSchema({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
        $expand: ['items', 'items.product', 'items.product.category'],
        id: 'uuid!',
      });

      const allSchemas = createSchemaMap([
        categorySchema,
        productSchema,
        orderItemSchema,
        orderSchema,
        viewSchema,
      ]);
      const result = validateProjection(viewSchema, allSchemas);

      expect(result.valid).toBe(true);
    });

    it('should fail on invalid nested expand path', () => {
      const productSchema = parseSchema({
        $type: 'Product',
        id: 'uuid!',
        name: 'string',
      });

      const orderSchema = parseSchema({
        $type: 'Order',
        id: 'uuid!',
        product: '-> Product',
      });

      const viewSchema = parseSchema({
        $type: 'OrderView',
        $projection: 'olap',
        $from: 'Order',
        $expand: ['product.nonExistent'],
        id: 'uuid!',
      });

      const allSchemas = createSchemaMap([productSchema, orderSchema, viewSchema]);
      const result = validateProjection(viewSchema, allSchemas);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_EXPAND_PATH')).toBe(true);
    });
  });

  describe('multiple validation errors', () => {
    it('should report all validation errors', () => {
      const viewSchema = parseSchema({
        $type: 'BadView',
        $projection: 'olap',
        $from: 'NonExistent',
        $expand: ['badPath1', 'badPath2'],
        id: 'uuid!',
      });

      const allSchemas = createSchemaMap([viewSchema]);
      const result = validateProjection(viewSchema, allSchemas);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('non-projection schema', () => {
    it('should return valid for non-projection schemas', () => {
      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string',
      });

      const allSchemas = createSchemaMap([schema]);
      const result = validateProjection(schema, allSchemas);

      // Non-projection schemas should pass projection validation (no projection to validate)
      expect(result.valid).toBe(true);
    });
  });
});

// =============================================================================
// getProjectionSource Tests
// =============================================================================

describe('getProjectionSource', () => {
  it('should return source entity name for projection schema', () => {
    const schema = parseSchema({
      $type: 'OrderView',
      $projection: 'olap',
      $from: 'Order',
      id: 'uuid!',
    });

    expect(getProjectionSource(schema)).toBe('Order');
  });

  it('should return undefined for projection without $from', () => {
    const schema = parseSchema({
      $type: 'MetricsView',
      $projection: 'olap',
      totalOrders: 'int',
    });

    expect(getProjectionSource(schema)).toBeUndefined();
  });

  it('should return undefined for non-projection schema', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      name: 'string',
    });

    expect(getProjectionSource(schema)).toBeUndefined();
  });
});
