/**
 * ice init command
 *
 * Initializes an IceType project with a basic schema file.
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const SCHEMA_TEMPLATE = `/**
 * IceType Schema Definition
 *
 * Define your data models using IceType's concise schema language:
 *
 * Field modifiers:
 *   ! - required/unique (e.g., 'uuid!')
 *   # - indexed (e.g., 'string#')
 *   ? - optional (e.g., 'int?')
 *   [] - array (e.g., 'string[]')
 *
 * Relation operators:
 *   -> - forward relation (e.g., '-> Organization')
 *   ~> - fuzzy forward (e.g., '~> Tag[]')
 *   <- - backward relation (e.g., '<- Post.author[]')
 *   <~ - fuzzy backward
 *
 * @see https://icetype.dev/docs/schema
 */

import { parseSchema } from '@icetype/core';

export const User = parseSchema({
  $type: 'User',
  $partitionBy: ['tenantId'],
  $index: [['email'], ['createdAt']],
  $fts: ['name', 'bio'],

  // Core fields
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  bio: 'text?',

  // Metadata
  tenantId: 'string!',
  role: 'string = "user"',
  status: 'string = "active"',

  // Relations
  posts: '<- Post.author[]',
  organization: '-> Organization?',
});

export const Post = parseSchema({
  $type: 'Post',
  $partitionBy: ['tenantId'],
  $index: [['slug'], ['publishedAt']],
  $fts: ['title', 'content'],

  id: 'uuid!',
  slug: 'string#',
  title: 'string',
  content: 'text',
  publishedAt: 'timestamp?',

  // Metadata
  tenantId: 'string!',
  status: 'string = "draft"',

  // Relations
  author: '-> User!',
  tags: '~> Tag[]',
});

export const Organization = parseSchema({
  $type: 'Organization',
  $index: [['slug']],

  id: 'uuid!',
  slug: 'string#',
  name: 'string',

  // Relations
  members: '<- User.organization[]',
});

export const Tag = parseSchema({
  $type: 'Tag',
  $index: [['slug']],

  id: 'uuid!',
  slug: 'string#',
  name: 'string',
});
`;

const PACKAGE_JSON_ADDITIONS = {
  dependencies: {
    '@icetype/core': '^0.1.0',
    '@icetype/iceberg': '^0.1.0',
  },
  devDependencies: {
    'icetype': '^0.1.0',
  },
};

export async function init(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      dir: { type: 'string', short: 'd', default: '.' },
      force: { type: 'boolean', short: 'f', default: false },
    },
  });

  const dir = typeof values.dir === 'string' ? values.dir : '.';
  const force = values.force === true;

  // Create directory if needed
  if (dir !== '.' && !existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: Failed to create directory '${dir}': ${message}`);
      process.exit(1);
    }
  }

  // Create schema file
  const schemaPath = join(dir, 'schema.ts');
  if (existsSync(schemaPath) && !force) {
    console.log(`Schema file already exists: ${schemaPath}`);
    console.log('Use --force to overwrite');
  } else {
    try {
      writeFileSync(schemaPath, SCHEMA_TEMPLATE);
      console.log(`Created schema file: ${schemaPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: Failed to write schema file '${schemaPath}': ${message}`);
      console.error('Check that the directory exists and you have write permissions.');
      process.exit(1);
    }
  }

  console.log(`
IceType project initialized!

Next steps:
  1. Edit schema.ts to define your data models
  2. Run 'ice generate' to generate TypeScript types
  3. Run 'ice validate' to check schema syntax

Documentation: https://icetype.dev/docs
`);
}
