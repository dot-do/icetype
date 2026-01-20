/**
 * Basic IceType Schema Example
 *
 * This file demonstrates how to define schemas using the IceType schema language.
 * IceType provides a concise, type-safe way to define your data models.
 *
 * Key syntax features:
 * - `!` - Required field (must be present)
 * - `?` - Optional field (can be null/undefined)
 * - `#` - Indexed field (for faster queries)
 * - `[]` - Array type
 * - `->` - Forward relation
 * - `<-` - Backward relation
 * - `~>` - Fuzzy/semantic relation (AI-powered)
 */

import type { SchemaDefinition } from '@icetype/core';

/**
 * User schema definition
 *
 * Represents a user in the system with authentication and profile data.
 */
export const UserSchema: SchemaDefinition = {
  // Schema metadata
  $type: 'User',

  // Partitioning strategy for distributed storage
  $partitionBy: ['tenantId'],

  // Secondary indexes for query optimization
  $index: [['email'], ['createdAt']],

  // Full-text search enabled fields
  $fts: ['name', 'bio'],

  // Required fields (marked with !)
  id: 'uuid!',           // Primary identifier
  email: 'string!#',     // Required and indexed
  name: 'string!',       // Display name
  tenantId: 'string!',   // Multi-tenant partition key

  // Optional fields (marked with ?)
  bio: 'text?',          // Long-form text, optional
  age: 'int?',           // Optional integer
  avatarUrl: 'string?',  // Optional profile image URL

  // Field with default value
  status: 'string = "active"',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
  lastLoginAt: 'timestamp?',

  // Backward relation - User has many Posts
  // This creates the inverse of Post.author
  posts: '<- Post.author[]',
};

/**
 * Post schema definition
 *
 * Represents a blog post or article written by a user.
 */
export const PostSchema: SchemaDefinition = {
  $type: 'Post',
  $partitionBy: ['authorId'],
  $index: [['authorId', 'createdAt'], ['status']],
  $fts: ['title', 'content'],

  // Required fields
  id: 'uuid!',
  title: 'string!',
  content: 'text!',
  authorId: 'string!',   // Foreign key to User

  // Forward relation - Post belongs to User
  author: '-> User',

  // Optional fields
  excerpt: 'string?',
  publishedAt: 'timestamp?',
  status: 'string = "draft"',

  // Array of tags
  tags: 'string[]',

  // Metadata
  viewCount: 'int = 0',
  likeCount: 'int = 0',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

/**
 * Comment schema definition
 *
 * Represents a comment on a post.
 */
export const CommentSchema: SchemaDefinition = {
  $type: 'Comment',
  $partitionBy: ['postId'],
  $index: [['postId', 'createdAt'], ['authorId']],

  id: 'uuid!',
  content: 'text!',
  postId: 'string!',
  authorId: 'string!',

  // Relations
  post: '-> Post',
  author: '-> User',

  // Optional parent for nested comments
  parentId: 'string?',
  parent: '-> Comment?',

  // Backward relation for replies
  replies: '<- Comment.parent[]',

  // Timestamps
  createdAt: 'timestamp!',
  updatedAt: 'timestamp!',
};

// Export all schemas as a collection
export const schemas = {
  User: UserSchema,
  Post: PostSchema,
  Comment: CommentSchema,
};
