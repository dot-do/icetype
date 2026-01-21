/**
 * Snapshot Tests for IceType Generated Output
 *
 * These tests use Vitest snapshots to catch unintended changes in
 * generated output across all supported backends.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { parseSchema, type IceTypeSchema } from '@icetype/core';
import { generateTypeScriptInterface } from '@icetype/cli';
import {
  generateIcebergMetadata,
  generateParquetSchema,
  generateParquetSchemaString,
} from '@icetype/iceberg';
import { PostgresAdapter, transformToPostgresDDL } from '@icetype/postgres';
import { ClickHouseAdapter, transformToClickHouseDDL } from '@icetype/clickhouse';
import { DuckDBAdapter, transformToDuckDBDDL } from '@icetype/duckdb';
import { MySQLAdapter, transformToMySQLDDL } from '@icetype/mysql';

// =============================================================================
// Test Schema Definition
// =============================================================================

/**
 * Creates a comprehensive test schema with all field types for snapshot testing.
 * This schema exercises all IceType features:
 * - Basic primitive types (string, int, float, bool, uuid)
 * - Extended primitives (text, long, bigint, double, decimal with precision)
 * - Temporal types (timestamp, timestamptz, date, time)
 * - Complex types (json, binary)
 * - Array types (string[], int[], float[])
 * - Field modifiers (!, ?, #)
 * - Default values
 * - Schema directives ($partitionBy, $index, $fts, $vector)
 */
function createAllTypesSchema(name: string): IceTypeSchema {
  return parseSchema({
    $type: name,
    $partitionBy: ['tenantId'],
    $index: [['email'], ['createdAt'], ['category', 'status']],
    $fts: ['name', 'description', 'content'],
    $vector: { embedding: 1536, thumbnail: 256 },

    // Required UUID (primary key pattern)
    id: 'uuid!',

    // Required foreign key pattern
    tenantId: 'string!',

    // Indexed unique field
    email: 'string#',

    // Basic string types
    name: 'string!',
    description: 'text?',
    content: 'text',

    // Integer types
    count: 'int',
    quantity: 'int = 0',
    score: 'long?',
    bigNumber: 'bigint?',

    // Floating point types
    rate: 'float',
    percentage: 'float?',
    amount: 'double',
    largeAmount: 'double?',

    // Decimal with precision
    price: 'decimal(10,2)!',
    tax: 'decimal(10,4)?',
    balance: 'decimal(18,6)',

    // Boolean types
    isActive: 'boolean = true',
    isVerified: 'bool?',
    enabled: 'bool',

    // UUID types
    referenceId: 'uuid?',
    externalId: 'uuid',

    // Temporal types
    createdAt: 'timestamp!',
    updatedAt: 'timestamp?',
    publishedAt: 'timestamptz?',
    birthDate: 'date?',
    eventTime: 'time?',

    // Complex types
    metadata: 'json?',
    settings: 'json = {}',
    rawData: 'binary?',

    // Array types
    tags: 'string[]',
    scores: 'int[]',
    weights: 'float[]',
    categories: 'string[]?',

    // Vector fields (for AI/ML)
    embedding: 'float[]',
    thumbnail: 'float[]',

    // Status with default
    status: 'string = "active"',
    category: 'string',
  });
}

/**
 * Creates a simple schema for basic snapshot comparisons.
 */
function createSimpleSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'SimpleEntity',
    id: 'uuid!',
    name: 'string!',
    value: 'int?',
    createdAt: 'timestamp = now()',
  });
}

/**
 * Creates a schema specifically for relation testing.
 */
function createRelationSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'Post',
    $fts: ['title', 'content'],
    $index: [['authorId'], ['publishedAt']],
    id: 'uuid!',
    title: 'string!',
    content: 'text',
    authorId: 'uuid!',
    status: 'string = "draft"',
    publishedAt: 'timestamp?',
    tags: 'string[]',
    viewCount: 'int = 0',
  });
}

// =============================================================================
// Snapshot Tests
// =============================================================================

describe('Snapshot Tests: TypeScript Interface Generation', () => {
  it('should generate TypeScript interface for AllTypes schema', () => {
    const schema = createAllTypesSchema('TestEntity');
    const output = generateTypeScriptInterface(schema);
    expect(output).toMatchSnapshot();
  });

  it('should generate TypeScript interface for SimpleEntity schema', () => {
    const schema = createSimpleSchema();
    const output = generateTypeScriptInterface(schema);
    expect(output).toMatchSnapshot();
  });

  it('should generate TypeScript interface for Post schema', () => {
    const schema = createRelationSchema();
    const output = generateTypeScriptInterface(schema);
    expect(output).toMatchSnapshot();
  });
});

describe('Snapshot Tests: Iceberg Metadata Generation', () => {
  it('should generate Iceberg metadata for AllTypes schema', () => {
    const schema = createAllTypesSchema('TestEntity');
    const metadata = generateIcebergMetadata(schema, 's3://test-bucket/tables/test_entity');

    // Remove dynamic fields that change between runs
    const stableMetadata = {
      ...metadata,
      tableUuid: '<dynamic-uuid>',
      lastUpdatedMs: 0,
      lastColumnId: metadata.lastColumnId,
    };

    expect(stableMetadata).toMatchSnapshot();
  });

  it('should generate Iceberg metadata for SimpleEntity schema', () => {
    const schema = createSimpleSchema();
    const metadata = generateIcebergMetadata(schema, 's3://test-bucket/tables/simple_entity');

    const stableMetadata = {
      ...metadata,
      tableUuid: '<dynamic-uuid>',
      lastUpdatedMs: 0,
    };

    expect(stableMetadata).toMatchSnapshot();
  });

  it('should generate Iceberg metadata for Post schema', () => {
    const schema = createRelationSchema();
    const metadata = generateIcebergMetadata(schema, 's3://test-bucket/tables/posts');

    const stableMetadata = {
      ...metadata,
      tableUuid: '<dynamic-uuid>',
      lastUpdatedMs: 0,
    };

    expect(stableMetadata).toMatchSnapshot();
  });
});

describe('Snapshot Tests: Parquet Schema Generation', () => {
  it('should generate Parquet schema object for AllTypes schema', () => {
    const schema = createAllTypesSchema('TestEntity');
    const parquetSchema = generateParquetSchema(schema);
    expect(parquetSchema).toMatchSnapshot();
  });

  it('should generate Parquet schema string for AllTypes schema', () => {
    const schema = createAllTypesSchema('TestEntity');
    const parquetString = generateParquetSchemaString(schema);
    expect(parquetString).toMatchSnapshot();
  });

  it('should generate Parquet schema for SimpleEntity schema', () => {
    const schema = createSimpleSchema();
    const parquetSchema = generateParquetSchema(schema);
    expect(parquetSchema).toMatchSnapshot();
  });

  it('should generate Parquet schema string for SimpleEntity schema', () => {
    const schema = createSimpleSchema();
    const parquetString = generateParquetSchemaString(schema);
    expect(parquetString).toMatchSnapshot();
  });

  it('should generate Parquet schema for Post schema', () => {
    const schema = createRelationSchema();
    const parquetSchema = generateParquetSchema(schema);
    expect(parquetSchema).toMatchSnapshot();
  });
});

describe('Snapshot Tests: PostgreSQL DDL Generation', () => {
  it('should generate PostgreSQL DDL for AllTypes schema', () => {
    const schema = createAllTypesSchema('TestEntity');
    const sql = transformToPostgresDDL(schema, {
      ifNotExists: true,
      schema: 'public',
    });
    expect(sql).toMatchSnapshot();
  });

  it('should generate PostgreSQL DDL for SimpleEntity schema', () => {
    const schema = createSimpleSchema();
    const sql = transformToPostgresDDL(schema, {
      ifNotExists: true,
    });
    expect(sql).toMatchSnapshot();
  });

  it('should generate PostgreSQL DDL for Post schema', () => {
    const schema = createRelationSchema();
    const sql = transformToPostgresDDL(schema, {
      ifNotExists: true,
      schema: 'blog',
    });
    expect(sql).toMatchSnapshot();
  });

  it('should generate PostgreSQL DDL with adapter directly', () => {
    const schema = createAllTypesSchema('TestEntity');
    const adapter = new PostgresAdapter();
    const ddl = adapter.transform(schema, {
      ifNotExists: true,
      schema: 'analytics',
    });
    const sql = adapter.serialize(ddl);
    expect(sql).toMatchSnapshot();
  });
});

describe('Snapshot Tests: ClickHouse DDL Generation', () => {
  it('should generate ClickHouse DDL for AllTypes schema', () => {
    const schema = createAllTypesSchema('TestEntity');
    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema, {
      engine: 'ReplacingMergeTree',
      orderBy: ['id'],
      partitionBy: 'toYYYYMM(created_at)',
      database: 'analytics',
    });
    const sql = adapter.serialize(ddl);
    expect(sql).toMatchSnapshot();
  });

  it('should generate ClickHouse DDL for SimpleEntity schema', () => {
    const schema = createSimpleSchema();
    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema, {
      engine: 'MergeTree',
      orderBy: ['id'],
    });
    const sql = adapter.serialize(ddl);
    expect(sql).toMatchSnapshot();
  });

  it('should generate ClickHouse DDL for Post schema', () => {
    const schema = createRelationSchema();
    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema, {
      engine: 'ReplacingMergeTree',
      orderBy: ['id'],
      partitionBy: 'toYYYYMM(published_at)',
      database: 'blog',
    });
    const sql = adapter.serialize(ddl);
    expect(sql).toMatchSnapshot();
  });

  it('should generate ClickHouse DDL with SummingMergeTree engine', () => {
    const schema = createAllTypesSchema('MetricsEntity');
    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema, {
      engine: 'SummingMergeTree',
      orderBy: ['id', 'tenantId'],
      partitionBy: 'toYYYYMMDD(created_at)',
    });
    const sql = adapter.serialize(ddl);
    expect(sql).toMatchSnapshot();
  });
});

describe('Snapshot Tests: DuckDB DDL Generation', () => {
  it('should generate DuckDB DDL for AllTypes schema', () => {
    const schema = createAllTypesSchema('TestEntity');
    const sql = transformToDuckDBDDL(schema, {
      ifNotExists: true,
      schema: 'public',
    });
    expect(sql).toMatchSnapshot();
  });

  it('should generate DuckDB DDL for SimpleEntity schema', () => {
    const schema = createSimpleSchema();
    const sql = transformToDuckDBDDL(schema, {
      ifNotExists: true,
    });
    expect(sql).toMatchSnapshot();
  });

  it('should generate DuckDB DDL for Post schema', () => {
    const schema = createRelationSchema();
    const sql = transformToDuckDBDDL(schema, {
      ifNotExists: true,
      schema: 'blog',
    });
    expect(sql).toMatchSnapshot();
  });

  it('should generate DuckDB DDL with adapter directly', () => {
    const schema = createAllTypesSchema('TestEntity');
    const adapter = new DuckDBAdapter();
    const ddl = adapter.transform(schema, {
      ifNotExists: true,
      schema: 'analytics',
    });
    const sql = adapter.serialize(ddl);
    expect(sql).toMatchSnapshot();
  });
});

describe('Snapshot Tests: MySQL DDL Generation', () => {
  it('should generate MySQL DDL for AllTypes schema', () => {
    const schema = createAllTypesSchema('TestEntity');
    const sql = transformToMySQLDDL(schema, {
      ifNotExists: true,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
    });
    expect(sql).toMatchSnapshot();
  });

  it('should generate MySQL DDL for SimpleEntity schema', () => {
    const schema = createSimpleSchema();
    const sql = transformToMySQLDDL(schema, {
      ifNotExists: true,
    });
    expect(sql).toMatchSnapshot();
  });

  it('should generate MySQL DDL for Post schema', () => {
    const schema = createRelationSchema();
    const sql = transformToMySQLDDL(schema, {
      ifNotExists: true,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
    });
    expect(sql).toMatchSnapshot();
  });

  it('should generate MySQL DDL with adapter directly', () => {
    const schema = createAllTypesSchema('TestEntity');
    const adapter = new MySQLAdapter();
    const ddl = adapter.transform(schema, {
      ifNotExists: true,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
    });
    const sql = adapter.serialize(ddl);
    expect(sql).toMatchSnapshot();
  });
});

describe('Snapshot Tests: Cross-Backend Consistency', () => {
  /**
   * Test that the same schema produces consistent output when generated
   * multiple times (deterministic generation).
   */
  it('should generate consistent TypeScript output', () => {
    const schema = createAllTypesSchema('ConsistentEntity');
    const output1 = generateTypeScriptInterface(schema);
    const output2 = generateTypeScriptInterface(schema);
    expect(output1).toBe(output2);
    expect(output1).toMatchSnapshot();
  });

  it('should generate consistent Parquet schema output', () => {
    const schema = createAllTypesSchema('ConsistentEntity');
    const output1 = generateParquetSchemaString(schema);
    const output2 = generateParquetSchemaString(schema);
    expect(output1).toBe(output2);
    expect(output1).toMatchSnapshot();
  });

  it('should generate consistent PostgreSQL DDL output', () => {
    const schema = createAllTypesSchema('ConsistentEntity');
    const output1 = transformToPostgresDDL(schema, { ifNotExists: true });
    const output2 = transformToPostgresDDL(schema, { ifNotExists: true });
    expect(output1).toBe(output2);
    expect(output1).toMatchSnapshot();
  });

  it('should generate consistent ClickHouse DDL output', () => {
    const schema = createAllTypesSchema('ConsistentEntity');
    const adapter = new ClickHouseAdapter();
    const options = { engine: 'MergeTree' as const, orderBy: ['id'] };
    const ddl1 = adapter.transform(schema, options);
    const ddl2 = adapter.transform(schema, options);
    const output1 = adapter.serialize(ddl1);
    const output2 = adapter.serialize(ddl2);
    expect(output1).toBe(output2);
    expect(output1).toMatchSnapshot();
  });

  it('should generate consistent DuckDB DDL output', () => {
    const schema = createAllTypesSchema('ConsistentEntity');
    const output1 = transformToDuckDBDDL(schema, { ifNotExists: true });
    const output2 = transformToDuckDBDDL(schema, { ifNotExists: true });
    expect(output1).toBe(output2);
    expect(output1).toMatchSnapshot();
  });

  it('should generate consistent MySQL DDL output', () => {
    const schema = createAllTypesSchema('ConsistentEntity');
    const output1 = transformToMySQLDDL(schema, { ifNotExists: true });
    const output2 = transformToMySQLDDL(schema, { ifNotExists: true });
    expect(output1).toBe(output2);
    expect(output1).toMatchSnapshot();
  });
});
