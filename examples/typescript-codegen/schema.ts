/**
 * TypeScript Code Generation Schema Example
 *
 * This file defines schemas that demonstrate the full range of IceType
 * features and how they map to TypeScript types.
 */

import type { SchemaDefinition } from '@icetype/core';

/**
 * User schema with various field types
 *
 * Demonstrates:
 * - Required vs optional fields
 * - Different primitive types
 * - Default values
 * - Relations
 */
export const UserSchema: SchemaDefinition = {
  $type: 'User',
  $partitionBy: ['organizationId'],
  $index: [['email'], ['organizationId', 'role']],
  $fts: ['name', 'bio'],

  // Required string fields
  id: 'uuid!',
  email: 'string!#',      // Required, unique, indexed
  name: 'string!',

  // Optional string fields
  bio: 'text?',
  avatarUrl: 'string?',
  phoneNumber: 'string?',

  // Numeric fields
  age: 'int?',
  loginCount: 'int = 0',
  rating: 'float?',
  balance: 'decimal(10,2)?',

  // Boolean fields
  isActive: 'boolean = true',
  isVerified: 'boolean = false',
  isAdmin: 'bool?',

  // Timestamp fields
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
  lastLoginAt: 'timestamp?',
  birthDate: 'date?',

  // JSON fields (flexible data)
  preferences: 'json?',
  metadata: 'json?',

  // Binary field
  avatar: 'binary?',

  // Organization context
  organizationId: 'string!',
  role: 'string = "member"',

  // Relations
  organization: '-> Organization',
  posts: '<- Post.author[]',
  comments: '<- Comment.author[]',
};

/**
 * Organization schema
 *
 * Demonstrates:
 * - Self-contained entity
 * - Array fields
 * - Backward relations
 */
export const OrganizationSchema: SchemaDefinition = {
  $type: 'Organization',
  $partitionBy: ['id'],
  $index: [['slug'], ['plan']],

  id: 'uuid!',
  name: 'string!',
  slug: 'string!#',       // URL-friendly identifier

  // Organization details
  description: 'text?',
  website: 'string?',
  logoUrl: 'string?',

  // Plan and billing
  plan: 'string = "free"',
  maxUsers: 'int = 5',
  maxStorage: 'long = 1073741824',  // 1 GB in bytes

  // Feature flags (as JSON)
  features: 'json?',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',

  // Relations
  members: '<- User.organization[]',
};

/**
 * Post schema
 *
 * Demonstrates:
 * - Array of strings (tags)
 * - Forward relations
 * - Content fields
 */
export const PostSchema: SchemaDefinition = {
  $type: 'Post',
  $partitionBy: ['authorId'],
  $index: [['authorId', 'publishedAt'], ['status']],
  $fts: ['title', 'content', 'excerpt'],

  id: 'uuid!',
  title: 'string!',
  slug: 'string!#',
  content: 'text!',
  excerpt: 'string?',

  // Author relation
  authorId: 'string!',
  author: '-> User',

  // Categorization
  tags: 'string[]',
  categoryId: 'string?',
  category: '-> Category?',

  // Status and publishing
  status: 'string = "draft"',
  publishedAt: 'timestamp?',

  // Metrics
  viewCount: 'int = 0',
  likeCount: 'int = 0',
  commentCount: 'int = 0',

  // SEO
  metaTitle: 'string?',
  metaDescription: 'string?',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',

  // Relations
  comments: '<- Comment.post[]',
};

/**
 * Comment schema
 *
 * Demonstrates:
 * - Nested relations (replies)
 * - Self-referencing relations
 */
export const CommentSchema: SchemaDefinition = {
  $type: 'Comment',
  $partitionBy: ['postId'],
  $index: [['postId', 'createdAt'], ['authorId']],

  id: 'uuid!',
  content: 'text!',

  // Post relation
  postId: 'string!',
  post: '-> Post',

  // Author relation
  authorId: 'string!',
  author: '-> User',

  // Nested comments (replies)
  parentId: 'string?',
  parent: '-> Comment?',
  replies: '<- Comment.parent[]',

  // Moderation
  isApproved: 'boolean = true',
  isHidden: 'boolean = false',

  // Metrics
  likeCount: 'int = 0',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

/**
 * Category schema
 *
 * Demonstrates:
 * - Hierarchical data (parent categories)
 * - Simple entity structure
 */
export const CategorySchema: SchemaDefinition = {
  $type: 'Category',
  $partitionBy: ['id'],
  $index: [['slug'], ['parentId']],

  id: 'uuid!',
  name: 'string!',
  slug: 'string!#',
  description: 'text?',

  // Hierarchy
  parentId: 'string?',
  parent: '-> Category?',
  children: '<- Category.parent[]',

  // Display
  sortOrder: 'int = 0',
  isVisible: 'boolean = true',
  iconUrl: 'string?',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',

  // Posts in this category
  posts: '<- Post.category[]',
};

// Export all schemas
export const schemas = {
  User: UserSchema,
  Organization: OrganizationSchema,
  Post: PostSchema,
  Comment: CommentSchema,
  Category: CategorySchema,
};
