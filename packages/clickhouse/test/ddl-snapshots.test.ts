/**
 * DDL Snapshot Tests for ClickHouse Adapter
 *
 * These tests verify DDL output stability by comparing against snapshots.
 * Any unintended changes to DDL generation will cause these tests to fail.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { parseSchema } from '@icetype/core';

import {
  transformToClickHouseDDL,
  ClickHouseAdapter,
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

describe('ClickHouse DDL Snapshots', () => {
  describe('Simple schema DDL output', () => {
    it('should match snapshot for simple schema', () => {
      const schema = createSimpleSchema();
      const ddl = transformToClickHouseDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with IF NOT EXISTS', () => {
      const schema = createSimpleSchema();
      const ddl = transformToClickHouseDDL(schema, { ifNotExists: true });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with custom ORDER BY', () => {
      const schema = createSimpleSchema();
      const ddl = transformToClickHouseDDL(schema, { orderBy: ['id', 'email'] });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with database name', () => {
      const schema = createSimpleSchema();
      const ddl = transformToClickHouseDDL(schema, { database: 'analytics' });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for simple schema with ReplacingMergeTree', () => {
      const schema = createSimpleSchema();
      const ddl = transformToClickHouseDDL(schema, { engine: 'ReplacingMergeTree' });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('Complex schema with relations DDL output', () => {
    it('should match snapshot for complex schema', () => {
      const schema = createComplexSchemaWithRelations();
      const ddl = transformToClickHouseDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for complex schema with all options', () => {
      const schema = createComplexSchemaWithRelations();
      const ddl = transformToClickHouseDDL(schema, {
        database: 'blog',
        ifNotExists: true,
        engine: 'ReplacingMergeTree',
        orderBy: ['id'],
      });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('All field types DDL output', () => {
    it('should match snapshot for all types schema', () => {
      const schema = createAllTypesSchema();
      const ddl = transformToClickHouseDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for all types schema with options', () => {
      const schema = createAllTypesSchema();
      const ddl = transformToClickHouseDDL(schema, {
        database: 'types_test',
        ifNotExists: true,
      });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('Indexes and constraints DDL output', () => {
    it('should match snapshot for indexed schema', () => {
      const schema = createIndexedSchema();
      const ddl = transformToClickHouseDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for indexed schema with partition', () => {
      const schema = createIndexedSchema();
      const ddl = transformToClickHouseDDL(schema, {
        partitionBy: 'toYYYYMM(created_at)',
        orderBy: ['id'],
      });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for indexed schema with TTL', () => {
      const schema = createIndexedSchema();
      const ddl = transformToClickHouseDDL(schema, {
        ttl: 'created_at + INTERVAL 30 DAY',
        orderBy: ['id'],
      });

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('Edge case DDL output', () => {
    it('should match snapshot for empty schema (minimal fields)', () => {
      const schema = parseSchema({
        $type: 'EmptyEntity',
        id: 'uuid!',
      });
      const ddl = transformToClickHouseDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with reserved words', () => {
      const schema = parseSchema({
        $type: 'Reserved',
        id: 'uuid!',
        select: 'string',
        from: 'string',
        where: 'string',
        order: 'string',
        group: 'string',
      });
      const ddl = transformToClickHouseDDL(schema);

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with special characters in name', () => {
      const schema = parseSchema({
        $type: 'My-Special_Entity',
        id: 'uuid!',
        name: 'string',
      });
      const ddl = transformToClickHouseDDL(schema);

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
      const ddl = transformToClickHouseDDL(schema);

      expect(ddl).toMatchSnapshot();
    });
  });

  describe('ClickHouse-specific features DDL output', () => {
    it('should match snapshot for schema with SummingMergeTree', () => {
      const schema = parseSchema({
        $type: 'Metrics',
        id: 'uuid!',
        date: 'date',
        count: 'int',
        total: 'double',
      });
      const ddl = transformToClickHouseDDL(schema, {
        engine: 'SummingMergeTree',
        orderBy: ['id', 'date'],
      });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with SETTINGS', () => {
      const schema = createSimpleSchema();
      const ddl = transformToClickHouseDDL(schema, {
        settings: {
          index_granularity: '8192',
          storage_policy: 'fast_ssd',
        },
      });

      expect(ddl).toMatchSnapshot();
    });

    it('should match snapshot for schema with partition by date', () => {
      const schema = parseSchema({
        $type: 'Events',
        id: 'uuid!',
        eventType: 'string',
        createdAt: 'timestamp!',
        data: 'json',
      });
      const ddl = transformToClickHouseDDL(schema, {
        partitionBy: 'toYYYYMM(created_at)',
        orderBy: ['created_at', 'id'],
      });

      expect(ddl).toMatchSnapshot();
    });
  });
});
