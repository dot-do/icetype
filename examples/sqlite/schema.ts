/**
 * SQLite Schema Example
 *
 * This file defines schemas optimized for SQLite, a lightweight
 * embedded database. SQLite is great for:
 *
 * - Local/embedded applications
 * - Mobile apps and IoT devices
 * - Edge computing (e.g., Cloudflare D1)
 * - Single-user applications and prototyping
 */

import type { SchemaDefinition } from '@icetype/core';

/**
 * Note Schema
 *
 * A simple note-taking schema with tags stored as JSON.
 */
export const NoteSchema: SchemaDefinition = {
  $type: 'Note',

  $index: [
    ['createdAt'],
    ['updatedAt'],
  ],

  // Primary key (unique identifier)
  id: 'uuid!',

  // Note content (required but not unique)
  title: 'string',
  content: 'text?',

  // Tags stored as JSON array (SQLite stores JSON as TEXT)
  tags: 'json?',

  // Status
  isPinned: 'boolean = false',
  isArchived: 'boolean = false',

  // Timestamps (required but not unique)
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
};

/**
 * Task Schema
 *
 * A task/todo list schema with priority and due dates.
 */
export const TaskSchema: SchemaDefinition = {
  $type: 'Task',

  $index: [
    ['status', 'dueDate'],
    ['priority'],
    ['createdAt'],
  ],

  // Primary key (unique identifier)
  id: 'uuid!',

  // Task details (required but not unique)
  title: 'string',
  description: 'text?',

  // Status tracking
  status: 'string = "pending"',  // 'pending', 'in_progress', 'completed', 'cancelled'
  priority: 'int = 0',           // 0=low, 1=medium, 2=high, 3=urgent

  // Due date (SQLite stores as TEXT in ISO8601 format)
  dueDate: 'date?',
  completedAt: 'timestamp?',

  // Organization
  category: 'string?',

  // Timestamps (required but not unique)
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
};

/**
 * Setting Schema
 *
 * A key-value settings/preferences schema with JSON support.
 */
export const SettingSchema: SchemaDefinition = {
  $type: 'Setting',

  // Primary key (unique setting key, indexed for fast lookup)
  key: 'string#',

  // Value can be any JSON-serializable data (required but not unique)
  value: 'json',

  // Metadata
  description: 'string?',
  category: 'string?',

  // Type hint for the UI
  valueType: 'string = "string"',  // 'string', 'number', 'boolean', 'json'

  // Timestamps (required but not unique)
  updatedAt: 'timestamp',
};

/**
 * Session Schema
 *
 * A user session schema for authentication tracking.
 */
export const SessionSchema: SchemaDefinition = {
  $type: 'Session',

  $index: [
    ['userId'],
    ['expiresAt'],
  ],

  // Primary key (unique session token)
  id: 'uuid!',

  // Session data (required but not unique - a user can have multiple sessions)
  userId: 'uuid',
  userAgent: 'string?',
  ipAddress: 'string?',

  // Session metadata (stored as JSON)
  metadata: 'json?',

  // Expiration (required but not unique)
  expiresAt: 'timestamp',
  lastAccessedAt: 'timestamp',

  // Timestamps (required but not unique)
  createdAt: 'timestamp',
};

// Export all schemas
export const schemas = {
  Note: NoteSchema,
  Task: TaskSchema,
  Setting: SettingSchema,
  Session: SessionSchema,
};
