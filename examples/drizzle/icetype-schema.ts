/**
 * IceType Schema Definitions for Drizzle Example
 *
 * This file demonstrates defining schemas in IceType's concise syntax
 * that can be transformed to Drizzle ORM schema files.
 *
 * IceType Syntax Reference:
 * - `!` - Required field (NOT NULL)
 * - `?` - Optional field (nullable)
 * - `#` - Indexed field (creates index)
 * - `[]` - Array type (PostgreSQL only)
 */

import { parseSchema } from '@icetype/core';

/**
 * User schema - represents application users
 *
 * Demonstrates:
 * - UUID primary key
 * - Unique indexed fields
 * - Optional fields
 * - Timestamp fields
 */
export const User = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  createdAt: 'timestamp',
});

/**
 * Post schema - represents blog posts or articles
 *
 * Demonstrates:
 * - UUID primary key (! = required + unique)
 * - Foreign key (authorId) - not unique since one author can have many posts
 * - Text fields for long content
 * - Boolean fields
 */
export const Post = parseSchema({
  $type: 'Post',
  id: 'uuid!',
  title: 'string',
  content: 'text',
  authorId: 'uuid',
  published: 'bool',
});

/**
 * Comment schema - represents user comments on posts
 *
 * Demonstrates:
 * - Multiple foreign keys
 * - Optional fields
 * - Timestamps
 *
 * Note: Fields with `!` are required AND unique in IceType.
 * For required-only fields, we use type without modifier then
 * enforce non-null in the application layer.
 */
export const Comment = parseSchema({
  $type: 'Comment',
  id: 'uuid!',
  content: 'text',
  postId: 'uuid',
  authorId: 'uuid',
  parentId: 'uuid?',
  createdAt: 'timestamp',
});

/**
 * Category schema - represents content categories
 *
 * Demonstrates:
 * - Simple string fields
 * - Optional text descriptions
 */
export const Category = parseSchema({
  $type: 'Category',
  id: 'uuid!',
  name: 'string!',
  slug: 'string!#',
  description: 'text?',
});

/**
 * All schemas for batch processing
 */
export const schemas = [User, Post, Comment, Category];
