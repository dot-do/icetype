/**
 * Basic IceType Schema Example
 *
 * This file demonstrates how to define schemas using the IceType schema language.
 * IceType provides a concise, type-safe way to define your data models.
 *
 * Key syntax features:
 * - `!` - Required field (must be present)
 * - `?` - Optional field (can be null/undefined)
 * - `#` - Indexed/unique field (for faster queries)
 * - `[]` - Array type
 * - `->` - Forward relation
 * - `<-` - Backward relation
 */

import type { SchemaDefinition } from '@icetype/core';

/**
 * User schema definition
 *
 * Represents a user in the system with basic profile data.
 */
export const UserSchema: SchemaDefinition = {
  // Schema metadata - identifies this entity type
  $type: 'User',

  // Partitioning strategy for distributed storage
  $partitionBy: ['id'],

  // Secondary indexes for query optimization
  $index: [['email'], ['createdAt']],

  // Primary key - required UUID
  id: 'uuid!',

  // User profile fields
  email: 'string!#',     // Required, unique, and indexed
  name: 'string!',       // Required display name
  bio: 'text?',          // Optional long-form text

  // Status with default value
  status: 'string = "active"',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',

  // Backward relation - User has many Posts
  posts: '<- Post.author[]',
};

/**
 * Post schema definition
 *
 * Represents a blog post written by a user.
 */
export const PostSchema: SchemaDefinition = {
  $type: 'Post',
  $partitionBy: ['authorId'],
  $index: [['authorId', 'createdAt'], ['slug']],

  // Primary key
  id: 'uuid!',

  // Post content
  title: 'string!',
  slug: 'string!#',      // URL-friendly identifier, unique
  content: 'text!',

  // Author relation
  authorId: 'string!',   // Foreign key to User
  author: '-> User',     // Forward relation to User

  // Optional fields
  excerpt: 'string?',
  publishedAt: 'timestamp?',

  // Array of tags
  tags: 'string[]',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

// Export all schemas as a collection
export const schemas = {
  User: UserSchema,
  Post: PostSchema,
};
