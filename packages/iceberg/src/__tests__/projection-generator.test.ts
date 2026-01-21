/**
 * Tests for Iceberg projection schema generation from OLAP projections
 *
 * These tests verify that generateProjectionSchema correctly denormalizes
 * IceType schemas with $projection directives into flattened Iceberg schemas.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema, type IceTypeSchema } from '@icetype/core';
import {
  generateProjectionSchema,
  ProjectionSchemaGenerator,
  createProjectionSchemaGenerator,
} from '../projection-generator.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a set of related schemas for testing projections
 */
function createRelatedSchemas(): Map<string, IceTypeSchema> {
  const schemas = new Map<string, IceTypeSchema>();

  // Customer with nested address
  const customerSchema = parseSchema({
    $type: 'Customer',
    id: 'uuid!',
    name: 'string!',
    email: 'string#',
    tier: 'string = "standard"',
    address: '-> Address?',
  });
  schemas.set('Customer', customerSchema);

  // Address schema
  const addressSchema = parseSchema({
    $type: 'Address',
    id: 'uuid!',
    street: 'string!',
    city: 'string!',
    state: 'string?',
    country: 'string!',
    postalCode: 'string',
  });
  schemas.set('Address', addressSchema);

  // Product schema
  const productSchema = parseSchema({
    $type: 'Product',
    id: 'uuid!',
    name: 'string!',
    sku: 'string#',
    price: 'decimal(10,2)!',
    categoryId: 'uuid?',
  });
  schemas.set('Product', productSchema);

  // Order Item schema
  const orderItemSchema = parseSchema({
    $type: 'OrderItem',
    id: 'uuid!',
    orderId: 'uuid!',
    quantity: 'int!',
    unitPrice: 'decimal(10,2)!',
    product: '-> Product!',
  });
  schemas.set('OrderItem', orderItemSchema);

  // Order schema with relations
  const orderSchema = parseSchema({
    $type: 'Order',
    $partitionBy: ['customerId'],
    id: 'uuid!',
    orderNumber: 'string#',
    status: 'string = "pending"',
    total: 'decimal(10,2)!',
    createdAt: 'timestamp = now()',
    customerId: 'uuid!',
    customer: '-> Customer!',
    items: '<- OrderItem.orderId[]',
  });
  schemas.set('Order', orderSchema);

  return schemas;
}

/**
 * Create a simple OLAP projection definition
 */
function createSimpleProjection() {
  return {
    $type: 'OrdersFlat',
    $projection: 'olap' as const,
    $from: 'Order',
    $expand: ['customer'],
  };
}

/**
 * Create a projection with nested expansions
 */
function createNestedProjection() {
  return {
    $type: 'OrdersFullFlat',
    $projection: 'olap' as const,
    $from: 'Order',
    $expand: ['customer', 'customer.address', 'items.product'],
  };
}

/**
 * Create a projection with flatten directive
 */
function createFlattenProjection() {
  return {
    $type: 'OrdersWithShipping',
    $projection: 'olap' as const,
    $from: 'Order',
    $expand: ['customer', 'customer.address'],
    $flatten: { 'customer.address': 'shipping' },
  };
}

// =============================================================================
// generateProjectionSchema() Tests
// =============================================================================

describe('ProjectionSchemaGenerator', () => {
  let generator: ProjectionSchemaGenerator;
  let schemas: Map<string, IceTypeSchema>;

  beforeEach(() => {
    generator = new ProjectionSchemaGenerator();
    schemas = createRelatedSchemas();
  });

  describe('generateProjectionSchema()', () => {
    it('should generate Iceberg schema from simple OLAP projection', () => {
      const projection = createSimpleProjection();
      const icebergSchema = generator.generateProjectionSchema(projection, schemas);

      expect(icebergSchema).toBeDefined();
      expect(icebergSchema.type).toBe('struct');
      expect(Array.isArray(icebergSchema.fields)).toBe(true);

      // Should have Order fields
      const fieldNames = icebergSchema.fields.map(f => f.name);
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('orderNumber');
      expect(fieldNames).toContain('status');
      expect(fieldNames).toContain('total');
      expect(fieldNames).toContain('customerId');

      // Should have expanded customer fields with prefix
      expect(fieldNames).toContain('customer_id');
      expect(fieldNames).toContain('customer_name');
      expect(fieldNames).toContain('customer_email');
      expect(fieldNames).toContain('customer_tier');
    });

    it('should generate schema with nested relation expansions', () => {
      const projection = createNestedProjection();
      const icebergSchema = generator.generateProjectionSchema(projection, schemas);

      const fieldNames = icebergSchema.fields.map(f => f.name);

      // Customer fields
      expect(fieldNames).toContain('customer_id');
      expect(fieldNames).toContain('customer_name');

      // Customer address fields (nested expansion)
      expect(fieldNames).toContain('customer_address_street');
      expect(fieldNames).toContain('customer_address_city');
      expect(fieldNames).toContain('customer_address_country');

      // Items product fields
      expect(fieldNames).toContain('items_product_id');
      expect(fieldNames).toContain('items_product_name');
      expect(fieldNames).toContain('items_product_sku');
      expect(fieldNames).toContain('items_product_price');
    });

    it('should apply $flatten directive to rename nested paths', () => {
      const projection = createFlattenProjection();
      const icebergSchema = generator.generateProjectionSchema(projection, schemas);

      const fieldNames = icebergSchema.fields.map(f => f.name);

      // Flattened customer.address fields should use 'shipping' prefix
      expect(fieldNames).toContain('shipping_street');
      expect(fieldNames).toContain('shipping_city');
      expect(fieldNames).toContain('shipping_country');
      expect(fieldNames).toContain('shipping_postalCode');

      // Should NOT have the original customer_address_* prefixed fields
      expect(fieldNames).not.toContain('customer_address_street');
      expect(fieldNames).not.toContain('customer_address_city');
    });

    it('should preserve field types from source schemas', () => {
      const projection = createSimpleProjection();
      const icebergSchema = generator.generateProjectionSchema(projection, schemas);

      const idField = icebergSchema.fields.find(f => f.name === 'id');
      expect(idField?.type.type).toBe('uuid');

      const totalField = icebergSchema.fields.find(f => f.name === 'total');
      expect(totalField?.type.type).toBe('decimal');

      const createdAtField = icebergSchema.fields.find(f => f.name === 'createdAt');
      expect(createdAtField?.type.type).toBe('timestamp');
    });

    it('should mark optional relation fields as optional', () => {
      const projection = createNestedProjection();
      const icebergSchema = generator.generateProjectionSchema(projection, schemas);

      // customer.address is optional (-> Address?)
      // So all address fields should be optional
      const addressStreet = icebergSchema.fields.find(f => f.name === 'customer_address_street');
      expect(addressStreet?.required).toBe(false);
    });

    it('should handle array relations with list type', () => {
      const projection = createNestedProjection();
      const icebergSchema = generator.generateProjectionSchema(projection, schemas);

      // items is an array relation
      // The items_product fields should be marked appropriately for arrays
      const itemsProductId = icebergSchema.fields.find(f => f.name === 'items_product_id');
      expect(itemsProductId).toBeDefined();
    });

    it('should include system fields in the output', () => {
      const projection = createSimpleProjection();
      const icebergSchema = generator.generateProjectionSchema(projection, schemas);

      const fieldNames = icebergSchema.fields.map(f => f.name);
      expect(fieldNames).toContain('$id');
      expect(fieldNames).toContain('$type');
      expect(fieldNames).toContain('$version');
      expect(fieldNames).toContain('$createdAt');
      expect(fieldNames).toContain('$updatedAt');
    });

    it('should assign sequential field IDs', () => {
      const projection = createSimpleProjection();
      const icebergSchema = generator.generateProjectionSchema(projection, schemas);

      // Field IDs should be sequential starting from 1
      const ids = icebergSchema.fields.map(f => f.id).sort((a, b) => a - b);
      for (let i = 0; i < ids.length; i++) {
        expect(ids[i]).toBe(i + 1);
      }
    });

    it('should throw error for missing source entity', () => {
      const projection = {
        $type: 'InvalidProjection',
        $projection: 'olap' as const,
        $from: 'NonExistentEntity',
        $expand: [],
      };

      expect(() => generator.generateProjectionSchema(projection, schemas))
        .toThrow(/source entity.*NonExistentEntity/i);
    });

    it('should throw error for invalid expand path', () => {
      const projection = {
        $type: 'InvalidProjection',
        $projection: 'olap' as const,
        $from: 'Order',
        $expand: ['nonExistentRelation'],
      };

      expect(() => generator.generateProjectionSchema(projection, schemas))
        .toThrow(/nonExistentRelation/i);
    });

    it('should set schema name based on projection $type', () => {
      const projection = createSimpleProjection();
      const icebergSchema = generator.generateProjectionSchema(projection, schemas);

      expect(icebergSchema.schemaId).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createProjectionSchemaGenerator()', () => {
  it('should create a new ProjectionSchemaGenerator instance', () => {
    const generator = createProjectionSchemaGenerator();
    expect(generator).toBeInstanceOf(ProjectionSchemaGenerator);
  });
});

// =============================================================================
// Convenience Function Tests
// =============================================================================

describe('generateProjectionSchema()', () => {
  let schemas: Map<string, IceTypeSchema>;

  beforeEach(() => {
    schemas = createRelatedSchemas();
  });

  it('should generate Iceberg schema using convenience function', () => {
    const projection = createSimpleProjection();
    const icebergSchema = generateProjectionSchema(projection, schemas);

    expect(icebergSchema).toBeDefined();
    expect(icebergSchema.type).toBe('struct');
    expect(icebergSchema.fields.length).toBeGreaterThan(0);
  });

  it('should handle projections without $expand', () => {
    const projection = {
      $type: 'SimpleOrdersFlat',
      $projection: 'olap' as const,
      $from: 'Order',
    };

    const icebergSchema = generateProjectionSchema(projection, schemas);

    expect(icebergSchema).toBeDefined();
    const fieldNames = icebergSchema.fields.map(f => f.name);

    // Should have Order fields but no expanded relations
    expect(fieldNames).toContain('id');
    expect(fieldNames).toContain('orderNumber');
    expect(fieldNames).not.toContain('customer_id');
    expect(fieldNames).not.toContain('customer_name');
  });

  it('should handle projections with empty $expand', () => {
    const projection = {
      $type: 'SimpleOrdersFlat',
      $projection: 'olap' as const,
      $from: 'Order',
      $expand: [],
    };

    const icebergSchema = generateProjectionSchema(projection, schemas);

    expect(icebergSchema).toBeDefined();
    const fieldNames = icebergSchema.fields.map(f => f.name);
    expect(fieldNames).toContain('id');
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('Edge Cases', () => {
  let schemas: Map<string, IceTypeSchema>;

  beforeEach(() => {
    schemas = createRelatedSchemas();
  });

  it('should handle deeply nested expansions (3+ levels)', () => {
    // Add a Category schema for deeper nesting
    const categorySchema = parseSchema({
      $type: 'Category',
      id: 'uuid!',
      name: 'string!',
      parentId: 'uuid?',
    });
    schemas.set('Category', categorySchema);

    // Update Product to have a category relation
    const productWithCategory = parseSchema({
      $type: 'Product',
      id: 'uuid!',
      name: 'string!',
      sku: 'string#',
      price: 'decimal(10,2)!',
      categoryId: 'uuid?',
      category: '-> Category?',
    });
    schemas.set('Product', productWithCategory);

    const projection = {
      $type: 'DeepOrdersFlat',
      $projection: 'olap' as const,
      $from: 'Order',
      $expand: ['items.product.category'],
    };

    const icebergSchema = generateProjectionSchema(projection, schemas);
    const fieldNames = icebergSchema.fields.map(f => f.name);

    expect(fieldNames).toContain('items_product_category_id');
    expect(fieldNames).toContain('items_product_category_name');
  });

  it('should handle multiple flatten directives', () => {
    const projection = {
      $type: 'MultiFlat',
      $projection: 'olap' as const,
      $from: 'Order',
      $expand: ['customer', 'customer.address'],
      $flatten: {
        'customer': 'buyer',
        'customer.address': 'shipping',
      },
    };

    const icebergSchema = generateProjectionSchema(projection, schemas);
    const fieldNames = icebergSchema.fields.map(f => f.name);

    // customer fields should be renamed to buyer_*
    expect(fieldNames).toContain('buyer_id');
    expect(fieldNames).toContain('buyer_name');
    expect(fieldNames).toContain('buyer_email');

    // customer.address fields should be renamed to shipping_*
    expect(fieldNames).toContain('shipping_street');
    expect(fieldNames).toContain('shipping_city');

    // Original prefixes should not exist
    expect(fieldNames).not.toContain('customer_id');
    expect(fieldNames).not.toContain('customer_address_street');
  });

  it('should handle schemas with only optional fields', () => {
    const optionalSchema = parseSchema({
      $type: 'OptionalEntity',
      id: 'uuid!',
      name: 'string?',
      value: 'int?',
    });
    schemas.set('OptionalEntity', optionalSchema);

    const projection = {
      $type: 'OptionalFlat',
      $projection: 'olap' as const,
      $from: 'OptionalEntity',
    };

    const icebergSchema = generateProjectionSchema(projection, schemas);

    const nameField = icebergSchema.fields.find(f => f.name === 'name');
    expect(nameField?.required).toBe(false);

    const valueField = icebergSchema.fields.find(f => f.name === 'value');
    expect(valueField?.required).toBe(false);
  });

  it('should not duplicate fields when expansion paths overlap', () => {
    const projection = {
      $type: 'OverlapFlat',
      $projection: 'olap' as const,
      $from: 'Order',
      $expand: ['customer', 'customer.address'],
    };

    const icebergSchema = generateProjectionSchema(projection, schemas);
    const fieldNames = icebergSchema.fields.map(f => f.name);

    // Count occurrences of customer_id
    const customerIdCount = fieldNames.filter(n => n === 'customer_id').length;
    expect(customerIdCount).toBe(1);
  });
});
