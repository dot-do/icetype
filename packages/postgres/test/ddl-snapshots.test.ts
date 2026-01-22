/**
 * DDL Snapshot Tests for PostgreSQL Adapter
 *
 * These tests verify DDL output stability by comparing against snapshots.
 * Any unintended changes to DDL generation will cause these tests to fail.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { parseSchema } from '@icetype/core';

import {
  transformToPostgresDDL,
  PostgresAdapter,
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
    tags: 'string[]',
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
    // Array types
    stringArray: 'string[]',
    intArray: 'int[]',
    uuidArray: 'uuid[]',
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

describe('PostgreSQL DDL Snapshots', () => {
  describe('Simple schema DDL output', () => {
    it('should match snapshot for simple schema', () => {
      const schema = createSimpleSchema();
      const ddl = transformToPostgresDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with IF NOT EXISTS', () => {
      const schema = createSimpleSchema();
      const ddl = transformToPostgresDDL(schema, { ifNotExists: true });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with custom table name', () => {
      const schema = createSimpleSchema();
      const ddl = transformToPostgresDDL(schema, { tableName: 'users_table' });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with schema name', () => {
      const schema = createSimpleSchema();
      const ddl = transformToPostgresDDL(schema, { schema: 'public' });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema without system fields', () => {
      const schema = createSimpleSchema();
      const ddl = transformToPostgresDDL(schema, { includeSystemFields: false });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('Complex schema with relations DDL output', () => {
    it('should match snapshot for complex schema', () => {
      const schema = createComplexSchemaWithRelations();
      const ddl = transformToPostgresDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for complex schema with all options', () => {
      const schema = createComplexSchemaWithRelations();
      const ddl = transformToPostgresDDL(schema, {
        schema: 'blog',
        ifNotExists: true,
        includeSystemFields: true,
      });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('All field types DDL output', () => {
    it('should match snapshot for all types schema', () => {
      const schema = createAllTypesSchema();
      const ddl = transformToPostgresDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for all types schema with options', () => {
      const schema = createAllTypesSchema();
      const ddl = transformToPostgresDDL(schema, {
        schema: 'types_test',
        ifNotExists: true,
      });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('Indexes and constraints DDL output', () => {
    it('should match snapshot for indexed schema', () => {
      const schema = createIndexedSchema();
      const ddl = transformToPostgresDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for indexed schema with indexes', () => {
      const schema = createIndexedSchema();
      const adapter = new PostgresAdapter();
      const ddlStructure = adapter.transform(schema);
      const ddl = adapter.serializeWithIndexes(ddlStructure);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for indexed schema without system fields', () => {
      const schema = createIndexedSchema();
      const adapter = new PostgresAdapter();
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
      const ddl = transformToPostgresDDL(schema);

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
      const ddl = transformToPostgresDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with special characters in name', () => {
      const schema = parseSchema({
        $type: 'My-Special_Entity',
        id: 'uuid!',
        name: 'string',
      });
      const ddl = transformToPostgresDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with all modifiers', () => {
      const schema = parseSchema({
        $type: 'Modifiers',
        requiredField: 'string!',
        optionalField: 'string?',
        uniqueField: 'string#',
        requiredUnique: 'string!#',
        arrayField: 'string[]',
      });
      const ddl = transformToPostgresDDL(schema);

      expect(ddl).toMatchSnapshot();
    });
  });
});
