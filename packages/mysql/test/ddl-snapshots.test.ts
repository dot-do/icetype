/**
 * DDL Snapshot Tests for MySQL Adapter
 *
 * These tests verify DDL output stability by comparing against snapshots.
 * Any unintended changes to DDL generation will cause these tests to fail.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { parseSchema } from '@icetype/core';

import {
  transformToMySQLDDL,
  MySQLAdapter,
} from '../src/index.js';

// =============================================================================
// Test Schemas
// =============================================================================

/**
 * Simple schema for basic DDL snapshot
 */
function createSimpleSchema() {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    name: 'string',
    age: 'int?',
  });
}

/**
 * Complex schema with relations for DDL snapshot
 */
function createComplexSchemaWithRelations() {
  return parseSchema({
    $type: 'Post',
    id: 'uuid!',
    title: 'string!',
    content: 'text',
    authorId: 'string!',
    categoryId: 'string?',
    publishedAt: 'timestamp?',
    viewCount: 'int',
    isPublished: 'boolean',
    metadata: 'json',
  });
}

/**
 * Schema with all supported field types for DDL snapshot
 */
function createAllTypesSchema() {
  return parseSchema({
    $type: 'AllTypes',
    // String types
    stringField: 'string',
    textField: 'text',
    // Integer types
    intField: 'int',
    longField: 'long',
    bigintField: 'bigint',
    // Floating point types
    floatField: 'float',
    doubleField: 'double',
    // Boolean types
    boolField: 'bool',
    booleanField: 'boolean',
    // UUID
    uuidField: 'uuid',
    // Date/Time types
    timestampField: 'timestamp',
    timestamptzField: 'timestamptz',
    dateField: 'date',
    timeField: 'time',
    // JSON
    jsonField: 'json',
    // Binary
    binaryField: 'binary',
    // Decimal
    decimalField: 'decimal',
  });
}

/**
 * Schema with indexes and constraints for DDL snapshot
 */
function createIndexedSchema() {
  return parseSchema({
    $type: 'Product',
    id: 'uuid!',
    sku: 'string#',
    name: 'string!',
    price: 'decimal!',
    quantity: 'int',
    isActive: 'boolean',
    createdAt: 'timestamp',
  });
}

// =============================================================================
// Snapshot Tests
// =============================================================================

describe('MySQL DDL Snapshots', () => {
  describe('Simple schema DDL output', () => {
    it('should match snapshot for simple schema', () => {
      const schema = createSimpleSchema();
      const ddl = transformToMySQLDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with IF NOT EXISTS', () => {
      const schema = createSimpleSchema();
      const ddl = transformToMySQLDDL(schema, { ifNotExists: true });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with custom table name', () => {
      const schema = createSimpleSchema();
      const ddl = transformToMySQLDDL(schema, { tableName: 'users_table' });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema without system fields', () => {
      const schema = createSimpleSchema();
      const ddl = transformToMySQLDDL(schema, { includeSystemFields: false });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with charset and collation', () => {
      const schema = createSimpleSchema();
      const ddl = transformToMySQLDDL(schema, {
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
      });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('Complex schema with relations DDL output', () => {
    it('should match snapshot for complex schema', () => {
      const schema = createComplexSchemaWithRelations();
      const ddl = transformToMySQLDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for complex schema with all options', () => {
      const schema = createComplexSchemaWithRelations();
      const ddl = transformToMySQLDDL(schema, {
        ifNotExists: true,
        includeSystemFields: true,
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
      });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('All field types DDL output', () => {
    it('should match snapshot for all types schema', () => {
      const schema = createAllTypesSchema();
      const ddl = transformToMySQLDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for all types schema with options', () => {
      const schema = createAllTypesSchema();
      const ddl = transformToMySQLDDL(schema, {
        ifNotExists: true,
        engine: 'InnoDB',
      });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('Indexes and constraints DDL output', () => {
    it('should match snapshot for indexed schema', () => {
      const schema = createIndexedSchema();
      const ddl = transformToMySQLDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for indexed schema with indexes', () => {
      const schema = createIndexedSchema();
      const adapter = new MySQLAdapter();
      const ddlStructure = adapter.transform(schema);
      const ddl = adapter.serializeWithIndexes(ddlStructure);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for indexed schema without system fields', () => {
      const schema = createIndexedSchema();
      const adapter = new MySQLAdapter();
      const ddlStructure = adapter.transform(schema, { includeSystemFields: false });
      const ddl = adapter.serializeWithIndexes(ddlStructure);

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('Edge case DDL output', () => {
    it('should match snapshot for empty schema (only system fields)', () => {
      const schema = parseSchema({
        $type: 'EmptyEntity',
      });
      const ddl = transformToMySQLDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with reserved words', () => {
      const schema = parseSchema({
        $type: 'Reserved',
        select: 'string',
        from: 'string',
        where: 'string',
        order: 'string',
        group: 'string',
      });
      const ddl = transformToMySQLDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with special characters in name', () => {
      const schema = parseSchema({
        $type: 'My-Special_Entity',
        id: 'uuid!',
        name: 'string',
      });
      const ddl = transformToMySQLDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with all modifiers', () => {
      const schema = parseSchema({
        $type: 'Modifiers',
        requiredField: 'string!',
        optionalField: 'string?',
        uniqueField: 'string#',
        requiredUnique: 'string!#',
      });
      const ddl = transformToMySQLDDL(schema);

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('MySQL-specific features DDL output', () => {
    it('should match snapshot for schema with MyISAM engine', () => {
      const schema = createSimpleSchema();
      const ddl = transformToMySQLDDL(schema, { engine: 'MyISAM' });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with table comment', () => {
      const schema = createSimpleSchema();
      const ddl = transformToMySQLDDL(schema, {
        comment: 'User accounts table',
      });

      expect(ddl).toMatchSnapshot();
    });
  });
});
