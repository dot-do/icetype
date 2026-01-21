/**
 * Tests for foreign key DDL generation
 *
 * These tests cover foreign key extraction from IceType schemas
 * and DDL generation for various SQL dialects.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { parseSchema, type IceTypeSchema } from '@icetype/core';

import {
  extractForeignKeys,
  serializeForeignKey,
  type ForeignKeyDefinition,
} from '../index.js';

// =============================================================================
// Test Schemas
// =============================================================================

/**
 * User schema - base entity for relations
 */
const UserSchema: IceTypeSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
});

/**
 * Post schema with forward relation to User
 */
const PostSchema: IceTypeSchema = parseSchema({
  $type: 'Post',
  id: 'uuid!',
  title: 'string!',
  content: 'text',
  author: '-> User',
  category: '-> Category?',
});

/**
 * Category schema
 */
const CategorySchema: IceTypeSchema = parseSchema({
  $type: 'Category',
  id: 'uuid!',
  name: 'string!',
});

/**
 * Comment schema with multiple relations
 */
const CommentSchema: IceTypeSchema = parseSchema({
  $type: 'Comment',
  id: 'uuid!',
  content: 'text!',
  post: '-> Post',
  author: '-> User',
});

/**
 * Tag schema with fuzzy relation (should be skipped)
 */
const TagSchema: IceTypeSchema = parseSchema({
  $type: 'Tag',
  id: 'uuid!',
  name: 'string!',
  relatedContent: '~> Post',
});

/**
 * Author schema with backward relation (array)
 */
const AuthorSchema: IceTypeSchema = parseSchema({
  $type: 'Author',
  id: 'uuid!',
  name: 'string!',
  posts: '<- Post.author',
});

// Helper to create all schemas map
function createAllSchemas(...schemas: IceTypeSchema[]): Map<string, IceTypeSchema> {
  const map = new Map<string, IceTypeSchema>();
  for (const schema of schemas) {
    map.set(schema.name, schema);
  }
  return map;
}

// =============================================================================
// extractForeignKeys() Tests
// =============================================================================

describe('extractForeignKeys()', () => {
  describe('finding relation fields', () => {
    it('should find forward relation fields (->)', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema);
      const fks = extractForeignKeys(PostSchema, allSchemas);

      expect(fks.length).toBeGreaterThanOrEqual(1);
      const authorFk = fks.find((fk) => fk.columns.includes('author_id') || fk.columns.includes('authorId'));
      expect(authorFk).toBeDefined();
      expect(authorFk?.referencedTable).toBe('User');
    });

    it('should handle optional relations', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema, CategorySchema);
      const fks = extractForeignKeys(PostSchema, allSchemas);

      const categoryFk = fks.find(
        (fk) => fk.columns.includes('category_id') || fk.columns.includes('categoryId')
      );
      expect(categoryFk).toBeDefined();
      expect(categoryFk?.referencedTable).toBe('Category');
    });

    it('should find multiple relations in same schema', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema, CommentSchema);
      const fks = extractForeignKeys(CommentSchema, allSchemas);

      expect(fks.length).toBe(2);

      const postFk = fks.find((fk) => fk.referencedTable === 'Post');
      const authorFk = fks.find((fk) => fk.referencedTable === 'User');

      expect(postFk).toBeDefined();
      expect(authorFk).toBeDefined();
    });
  });

  describe('generating FK for forward relations (->)', () => {
    it('should generate FK for -> User relation', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema);
      const fks = extractForeignKeys(PostSchema, allSchemas);

      const authorFk = fks.find((fk) => fk.referencedTable === 'User');
      expect(authorFk).toBeDefined();
      expect(authorFk?.referencedColumns).toEqual(['id']);
    });

    it('should use correct column name for FK', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema);
      const fks = extractForeignKeys(PostSchema, allSchemas);

      const authorFk = fks.find((fk) => fk.referencedTable === 'User');
      expect(authorFk).toBeDefined();
      // Column should be the field name with _id suffix or camelCase with Id
      expect(authorFk?.columns[0]).toMatch(/author[_]?[iI]d/);
    });
  });

  describe('handling array relations ([Order])', () => {
    it('should not generate FK for backward relations (<-)', () => {
      const allSchemas = createAllSchemas(AuthorSchema, PostSchema);
      const fks = extractForeignKeys(AuthorSchema, allSchemas);

      // Backward relations don't create FKs on this table
      // The FK should be on the other side (Post.author -> Author)
      expect(fks.length).toBe(0);
    });
  });

  describe('ON DELETE options', () => {
    it('should handle ON DELETE CASCADE option', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema);
      const fks = extractForeignKeys(PostSchema, allSchemas, { onDelete: 'CASCADE' });

      const authorFk = fks.find((fk) => fk.referencedTable === 'User');
      expect(authorFk?.onDelete).toBe('CASCADE');
    });

    it('should handle ON DELETE SET NULL option', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema);
      const fks = extractForeignKeys(PostSchema, allSchemas, { onDelete: 'SET NULL' });

      const authorFk = fks.find((fk) => fk.referencedTable === 'User');
      expect(authorFk?.onDelete).toBe('SET NULL');
    });
  });

  describe('ON UPDATE options', () => {
    it('should handle ON UPDATE CASCADE option', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema);
      const fks = extractForeignKeys(PostSchema, allSchemas, { onUpdate: 'CASCADE' });

      const authorFk = fks.find((fk) => fk.referencedTable === 'User');
      expect(authorFk?.onUpdate).toBe('CASCADE');
    });
  });

  describe('fuzzy relations (~>)', () => {
    it('should skip FK for fuzzy relations (~> - semantic, not referential)', () => {
      const allSchemas = createAllSchemas(PostSchema, TagSchema);
      const fks = extractForeignKeys(TagSchema, allSchemas);

      // Fuzzy relations should NOT generate foreign keys
      expect(fks.length).toBe(0);
    });
  });

  describe('validation', () => {
    it('should validate referenced table exists', () => {
      // PostSchema references Category, but Category is not in allSchemas
      const allSchemas = createAllSchemas(UserSchema, PostSchema);
      const fks = extractForeignKeys(PostSchema, allSchemas);

      // Should only include FK for User (which exists), not Category (which doesn't)
      const categoryFk = fks.find((fk) => fk.referencedTable === 'Category');
      expect(categoryFk).toBeUndefined();
    });

    it('should include FK when referenced table exists', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema, CategorySchema);
      const fks = extractForeignKeys(PostSchema, allSchemas);

      const categoryFk = fks.find((fk) => fk.referencedTable === 'Category');
      expect(categoryFk).toBeDefined();
    });
  });

  describe('constraint naming', () => {
    it('should generate meaningful constraint names', () => {
      const allSchemas = createAllSchemas(UserSchema, PostSchema);
      const fks = extractForeignKeys(PostSchema, allSchemas);

      const authorFk = fks.find((fk) => fk.referencedTable === 'User');
      expect(authorFk?.constraintName).toBeDefined();
      expect(authorFk?.constraintName).toContain('Post');
      expect(authorFk?.constraintName).toMatch(/author|user/i);
    });
  });
});

// =============================================================================
// serializeForeignKey() Tests
// =============================================================================

describe('serializeForeignKey()', () => {
  const baseFk: ForeignKeyDefinition = {
    columns: ['author_id'],
    referencedTable: 'User',
    referencedColumns: ['id'],
    constraintName: 'fk_Post_author',
  };

  describe('basic FK serialization', () => {
    it('should serialize basic FK for PostgreSQL', () => {
      const sql = serializeForeignKey(baseFk, 'postgres');

      expect(sql).toContain('FOREIGN KEY');
      expect(sql).toContain('author_id');
      expect(sql).toContain('REFERENCES');
      expect(sql).toContain('User');
      expect(sql).toContain('id');
    });

    it('should serialize basic FK for MySQL', () => {
      const sql = serializeForeignKey(baseFk, 'mysql');

      expect(sql).toContain('FOREIGN KEY');
      expect(sql).toContain('author_id');
      expect(sql).toContain('REFERENCES');
      expect(sql).toContain('User');
    });

    it('should serialize basic FK for SQLite', () => {
      const sql = serializeForeignKey(baseFk, 'sqlite');

      expect(sql).toContain('FOREIGN KEY');
      expect(sql).toContain('author_id');
      expect(sql).toContain('REFERENCES');
      expect(sql).toContain('User');
    });

    it('should serialize basic FK for DuckDB', () => {
      const sql = serializeForeignKey(baseFk, 'duckdb');

      expect(sql).toContain('FOREIGN KEY');
      expect(sql).toContain('author_id');
      expect(sql).toContain('REFERENCES');
      expect(sql).toContain('User');
    });
  });

  describe('constraint name', () => {
    it('should include CONSTRAINT name when provided', () => {
      const fk: ForeignKeyDefinition = {
        ...baseFk,
        constraintName: 'fk_Post_author_User',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('CONSTRAINT');
      expect(sql).toContain('fk_Post_author_User');
    });

    it('should omit CONSTRAINT when not provided', () => {
      const fk: ForeignKeyDefinition = {
        columns: ['author_id'],
        referencedTable: 'User',
        referencedColumns: ['id'],
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).not.toMatch(/CONSTRAINT\s+\w/);
    });
  });

  describe('ON DELETE actions', () => {
    it('should include ON DELETE CASCADE', () => {
      const fk: ForeignKeyDefinition = {
        ...baseFk,
        onDelete: 'CASCADE',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('ON DELETE CASCADE');
    });

    it('should include ON DELETE SET NULL', () => {
      const fk: ForeignKeyDefinition = {
        ...baseFk,
        onDelete: 'SET NULL',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('ON DELETE SET NULL');
    });

    it('should include ON DELETE SET DEFAULT', () => {
      const fk: ForeignKeyDefinition = {
        ...baseFk,
        onDelete: 'SET DEFAULT',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('ON DELETE SET DEFAULT');
    });

    it('should include ON DELETE RESTRICT', () => {
      const fk: ForeignKeyDefinition = {
        ...baseFk,
        onDelete: 'RESTRICT',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('ON DELETE RESTRICT');
    });

    it('should include ON DELETE NO ACTION', () => {
      const fk: ForeignKeyDefinition = {
        ...baseFk,
        onDelete: 'NO ACTION',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('ON DELETE NO ACTION');
    });
  });

  describe('ON UPDATE actions', () => {
    it('should include ON UPDATE CASCADE', () => {
      const fk: ForeignKeyDefinition = {
        ...baseFk,
        onUpdate: 'CASCADE',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('ON UPDATE CASCADE');
    });

    it('should include ON UPDATE SET NULL', () => {
      const fk: ForeignKeyDefinition = {
        ...baseFk,
        onUpdate: 'SET NULL',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('ON UPDATE SET NULL');
    });
  });

  describe('combined ON DELETE and ON UPDATE', () => {
    it('should include both ON DELETE and ON UPDATE', () => {
      const fk: ForeignKeyDefinition = {
        ...baseFk,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('ON DELETE CASCADE');
      expect(sql).toContain('ON UPDATE CASCADE');
    });
  });

  describe('composite foreign keys', () => {
    it('should handle multiple columns', () => {
      const fk: ForeignKeyDefinition = {
        columns: ['tenant_id', 'user_id'],
        referencedTable: 'TenantUser',
        referencedColumns: ['tenant_id', 'user_id'],
        constraintName: 'fk_composite',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      expect(sql).toContain('tenant_id');
      expect(sql).toContain('user_id');
      expect(sql).toMatch(/FOREIGN KEY\s*\([^)]*tenant_id[^)]*,\s*[^)]*user_id/);
    });
  });

  describe('identifier escaping', () => {
    it('should escape identifiers with special characters', () => {
      const fk: ForeignKeyDefinition = {
        columns: ['$user_id'],
        referencedTable: 'User',
        referencedColumns: ['$id'],
        constraintName: 'fk_special',
      };
      const sql = serializeForeignKey(fk, 'postgres');

      // PostgreSQL uses double quotes for escaping
      expect(sql).toContain('"$user_id"');
      expect(sql).toContain('"$id"');
    });

    it('should use backticks for MySQL/ClickHouse', () => {
      const fk: ForeignKeyDefinition = {
        columns: ['$user_id'],
        referencedTable: 'User',
        referencedColumns: ['$id'],
        constraintName: 'fk_special',
      };
      const sql = serializeForeignKey(fk, 'mysql');

      // MySQL uses backticks for escaping
      expect(sql).toContain('`$user_id`');
      expect(sql).toContain('`$id`');
    });
  });

  describe('ClickHouse handling', () => {
    it('should return empty string for ClickHouse (no FK support)', () => {
      const sql = serializeForeignKey(baseFk, 'clickhouse');

      // ClickHouse does not support foreign keys
      expect(sql).toBe('');
    });
  });
});
