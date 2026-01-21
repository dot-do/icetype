/**
 * MySQL Schema Example
 *
 * This file defines schemas optimized for MySQL, a popular relational
 * database. MySQL is great for:
 *
 * - High-performance transactional workloads
 * - Web applications with LAMP/LEMP stacks
 * - Horizontal scaling with replication
 * - InnoDB storage engine with ACID compliance
 */

import type { SchemaDefinition } from '@icetype/core';
import { parseSchema } from '@icetype/core';

/**
 * User Schema
 *
 * Core user entity with authentication fields and profile data.
 * Demonstrates common MySQL patterns like indexed email for lookups.
 */
export const UserSchema: SchemaDefinition = {
  $type: 'User',

  $index: [
    ['email'],
    ['createdAt'],
  ],

  // Primary key
  id: 'uuid!',

  // Authentication
  email: 'string!#',          // Unique indexed email
  name: 'string',
  age: 'int?',

  // Profile
  bio: 'text?',
  avatarUrl: 'string?',

  // Status
  isActive: 'boolean = true',
  role: 'string = "user"',    // 'user', 'admin', 'moderator'

  // Timestamps
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
};

/**
 * Product Schema
 *
 * E-commerce product catalog with pricing and inventory tracking.
 * Uses decimal for precise monetary calculations.
 */
export const ProductSchema: SchemaDefinition = {
  $type: 'Product',

  $index: [
    ['sku'],
    ['category'],
    ['price'],
  ],

  // Primary key
  id: 'uuid!',

  // Product details
  sku: 'string!#',            // Unique SKU
  name: 'string!',
  description: 'text?',
  category: 'string!',

  // Pricing (use decimal for money)
  price: 'decimal(10,2)!',
  costPrice: 'decimal(10,2)?',
  currency: 'string = "USD"',

  // Inventory
  quantityInStock: 'int = 0',
  reorderPoint: 'int = 10',

  // Status
  isActive: 'boolean = true',
  isFeatured: 'boolean = false',

  // Metadata (stored as JSON in MySQL 5.7+)
  attributes: 'json?',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

/**
 * Order Schema
 *
 * Order records linking users and products.
 * Uses JSON for flexible address storage.
 */
export const OrderSchema: SchemaDefinition = {
  $type: 'Order',

  $index: [
    ['userId', 'createdAt'],
    ['status', 'createdAt'],
    ['orderNumber'],
  ],

  // Primary key
  id: 'uuid!',
  orderNumber: 'string!#',    // Human-readable order number

  // User reference
  userId: 'uuid!',

  // Order details
  status: 'string = "pending"',  // 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
  orderDate: 'date!',

  // Monetary values
  subtotal: 'decimal(10,2)!',
  taxAmount: 'decimal(10,2)!',
  shippingAmount: 'decimal(10,2) = 0',
  discountAmount: 'decimal(10,2) = 0',
  totalAmount: 'decimal(10,2)!',
  currency: 'string = "USD"',

  // Addresses (JSON for flexible structure)
  shippingAddress: 'json?',
  billingAddress: 'json?',

  // Tracking
  trackingNumber: 'string?',
  shippedAt: 'timestamp?',
  deliveredAt: 'timestamp?',

  // Notes
  customerNotes: 'text?',
  internalNotes: 'text?',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

/**
 * OrderItem Schema
 *
 * Line items for orders, demonstrating normalized relational design.
 */
export const OrderItemSchema: SchemaDefinition = {
  $type: 'OrderItem',

  $index: [
    ['orderId'],
    ['productId'],
  ],

  // Primary key
  id: 'uuid!',

  // Relations
  orderId: 'uuid!',
  productId: 'uuid!',

  // Item details
  sku: 'string!',
  name: 'string!',
  quantity: 'int!',

  // Pricing (captured at time of order)
  unitPrice: 'decimal(10,2)!',
  totalPrice: 'decimal(10,2)!',

  // Optional discount
  discountPercent: 'decimal(5,2) = 0',

  // Timestamps
  createdAt: 'timestamp!',
};

// Export all schemas
export const schemas = {
  User: UserSchema,
  Product: ProductSchema,
  Order: OrderSchema,
  OrderItem: OrderItemSchema,
};
