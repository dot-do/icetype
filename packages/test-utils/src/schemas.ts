/**
 * Pre-built Mock Schemas
 *
 * Collection of commonly used test schemas representing typical
 * domain entities. Use these for consistent testing across packages.
 *
 * @packageDocumentation
 */

import { parseSchema, type IceTypeSchema } from '@icetype/core';

// =============================================================================
// User-related Schemas
// =============================================================================

/**
 * Standard User schema for authentication/identity testing.
 */
export const UserSchema: IceTypeSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  passwordHash: 'string?',
  avatarUrl: 'string?',
  isActive: 'boolean = true',
  role: 'string = "user"',
  createdAt: 'timestamp = now()',
  updatedAt: 'timestamp?',
  lastLoginAt: 'timestamp?',
  metadata: 'json?',
});

/**
 * User profile schema with extended user information.
 */
export const UserProfileSchema: IceTypeSchema = parseSchema({
  $type: 'UserProfile',
  id: 'uuid!',
  userId: 'uuid!',
  bio: 'text?',
  website: 'string?',
  location: 'string?',
  birthday: 'date?',
  preferences: 'json = {}',
});

// =============================================================================
// Content/CMS Schemas
// =============================================================================

/**
 * Blog post schema for content management testing.
 */
export const PostSchema: IceTypeSchema = parseSchema({
  $type: 'Post',
  $fts: ['title', 'content'],
  $index: [['publishedAt'], ['authorId']],
  id: 'uuid!',
  title: 'string!',
  slug: 'string#',
  content: 'text',
  excerpt: 'string?',
  authorId: 'uuid!',
  status: 'string = "draft"',
  publishedAt: 'timestamp?',
  createdAt: 'timestamp = now()',
  updatedAt: 'timestamp?',
  tags: 'string[]',
  metadata: 'json?',
});

/**
 * Comment schema for content discussions.
 */
export const CommentSchema: IceTypeSchema = parseSchema({
  $type: 'Comment',
  id: 'uuid!',
  postId: 'uuid!',
  authorId: 'uuid!',
  parentId: 'uuid?',
  content: 'text!',
  isApproved: 'boolean = false',
  createdAt: 'timestamp = now()',
  updatedAt: 'timestamp?',
});

/**
 * Category schema for content organization.
 */
export const CategorySchema: IceTypeSchema = parseSchema({
  $type: 'Category',
  id: 'uuid!',
  name: 'string!',
  slug: 'string#',
  description: 'text?',
  parentId: 'uuid?',
  sortOrder: 'int = 0',
});

// =============================================================================
// E-commerce Schemas
// =============================================================================

/**
 * Product schema for e-commerce testing.
 */
export const ProductSchema: IceTypeSchema = parseSchema({
  $type: 'Product',
  $fts: ['name', 'description'],
  $index: [['categoryId'], ['sku']],
  id: 'uuid!',
  name: 'string!',
  sku: 'string#',
  description: 'text',
  price: 'decimal(10,2)!',
  compareAtPrice: 'decimal(10,2)?',
  costPrice: 'decimal(10,2)?',
  categoryId: 'uuid?',
  inventory: 'int = 0',
  isActive: 'boolean = true',
  weight: 'float?',
  dimensions: 'json?',
  images: 'string[]',
  tags: 'string[]',
  createdAt: 'timestamp = now()',
  updatedAt: 'timestamp?',
});

/**
 * Order schema for e-commerce transactions.
 */
export const OrderSchema: IceTypeSchema = parseSchema({
  $type: 'Order',
  $partitionBy: ['customerId'],
  $index: [['status'], ['createdAt']],
  id: 'uuid!',
  orderNumber: 'string#',
  customerId: 'uuid!',
  status: 'string = "pending"',
  subtotal: 'decimal(10,2)!',
  tax: 'decimal(10,2) = 0',
  shipping: 'decimal(10,2) = 0',
  total: 'decimal(10,2)!',
  currency: 'string = "USD"',
  shippingAddress: 'json?',
  billingAddress: 'json?',
  notes: 'text?',
  createdAt: 'timestamp = now()',
  updatedAt: 'timestamp?',
  completedAt: 'timestamp?',
});

/**
 * Order line item schema.
 */
export const OrderItemSchema: IceTypeSchema = parseSchema({
  $type: 'OrderItem',
  id: 'uuid!',
  orderId: 'uuid!',
  productId: 'uuid!',
  productName: 'string!',
  sku: 'string',
  quantity: 'int!',
  unitPrice: 'decimal(10,2)!',
  totalPrice: 'decimal(10,2)!',
  metadata: 'json?',
});

// =============================================================================
// Event/Analytics Schemas
// =============================================================================

/**
 * Event schema for analytics/logging testing.
 */
export const EventSchema: IceTypeSchema = parseSchema({
  $type: 'Event',
  $partitionBy: ['eventType'],
  $index: [['timestamp'], ['userId']],
  id: 'uuid!',
  eventType: 'string!',
  userId: 'uuid?',
  sessionId: 'string?',
  timestamp: 'timestamp = now()',
  properties: 'json = {}',
  context: 'json?',
  source: 'string?',
  version: 'string?',
});

/**
 * Log entry schema for application logging.
 */
export const LogEntrySchema: IceTypeSchema = parseSchema({
  $type: 'LogEntry',
  $partitionBy: ['level'],
  id: 'uuid!',
  level: 'string!',
  message: 'text!',
  timestamp: 'timestamp = now()',
  service: 'string?',
  traceId: 'string?',
  spanId: 'string?',
  context: 'json?',
  stackTrace: 'text?',
});

// =============================================================================
// System/Infrastructure Schemas
// =============================================================================

/**
 * API key schema for authentication testing.
 */
export const ApiKeySchema: IceTypeSchema = parseSchema({
  $type: 'ApiKey',
  id: 'uuid!',
  key: 'string#',
  name: 'string!',
  userId: 'uuid!',
  scopes: 'string[]',
  isActive: 'boolean = true',
  expiresAt: 'timestamp?',
  lastUsedAt: 'timestamp?',
  createdAt: 'timestamp = now()',
});

/**
 * Tenant schema for multi-tenancy testing.
 */
export const TenantSchema: IceTypeSchema = parseSchema({
  $type: 'Tenant',
  id: 'uuid!',
  name: 'string!',
  slug: 'string#',
  plan: 'string = "free"',
  isActive: 'boolean = true',
  settings: 'json = {}',
  createdAt: 'timestamp = now()',
  updatedAt: 'timestamp?',
});

// =============================================================================
// Collection of all mock schemas
// =============================================================================

/**
 * Collection of all pre-built mock schemas.
 * Useful for iterating over schemas in tests.
 */
export const mockSchemas = {
  User: UserSchema,
  UserProfile: UserProfileSchema,
  Post: PostSchema,
  Comment: CommentSchema,
  Category: CategorySchema,
  Product: ProductSchema,
  Order: OrderSchema,
  OrderItem: OrderItemSchema,
  Event: EventSchema,
  LogEntry: LogEntrySchema,
  ApiKey: ApiKeySchema,
  Tenant: TenantSchema,
} as const;

/**
 * Array of all schema names for iteration.
 */
export const schemaNames = Object.keys(mockSchemas) as Array<keyof typeof mockSchemas>;
