/**
 * Integration Smoke Tests for IceType
 *
 * These tests verify the full workflow across packages to ensure
 * cross-package compatibility and integration.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

// Import from package exports (not internal paths)
import { parseSchema, validateSchema } from '@icetype/core';
import { generateIcebergMetadata, generateParquetSchema, generateParquetSchemaString } from '@icetype/iceberg';
import { createAdapterRegistry } from '@icetype/adapters';
import { IcebergAdapter, ParquetAdapter } from '@icetype/iceberg';
import { ClickHouseAdapter } from '@icetype/clickhouse';
import { DuckDBAdapter, transformToDuckDBDDL } from '@icetype/duckdb';
import { PostgresAdapter, transformToPostgresDDL, createPostgresAdapter } from '@icetype/postgres';
import { generateTypeScriptInterface } from '@icetype/cli';

// Import PostgreSQL adapter from main icetype package for re-export verification
import {
  PostgresAdapter as PostgresAdapterFromMain,
  transformToPostgresDDL as transformToPostgresDDLFromMain,
  createPostgresAdapter as createPostgresAdapterFromMain,
} from 'icetype';

// =============================================================================
// Test Schemas
// =============================================================================

/**
 * A realistic user schema for testing
 */
const userSchemaDefinition = {
  $type: 'User',
  $partitionBy: ['tenantId'],
  $index: [['email'], ['createdAt']],
  $fts: ['name', 'bio'],
  $vector: { embedding: 1536 },

  id: 'uuid!',
  tenantId: 'string!',
  email: 'string#',
  name: 'string',
  bio: 'text?',
  age: 'int?',
  balance: 'decimal(10,2)',
  isActive: 'boolean = true',
  tags: 'string[]',
  embedding: 'float[]',
  createdAt: 'timestamp!',
  updatedAt: 'timestamp',
};

/**
 * An order schema with relations for testing
 */
const orderSchemaDefinition = {
  $type: 'Order',
  $partitionBy: ['customerId'],

  id: 'uuid!',
  customerId: 'string!',
  status: 'string = "pending"',
  totalAmount: 'decimal(12,2)!',
  itemCount: 'int!',
  notes: 'text?',
  metadata: 'json?',
  createdAt: 'timestamp!',
};

/**
 * A product schema for testing various field types
 */
const productSchemaDefinition = {
  $type: 'Product',
  $fts: ['name', 'description'],

  id: 'uuid!',
  sku: 'string#',
  name: 'string!',
  description: 'text',
  price: 'decimal(10,2)!',
  quantity: 'int = 0',
  weight: 'float?',
  isAvailable: 'bool = true',
  categories: 'string[]',
  publishedAt: 'date?',
  expiresAt: 'timestamp?',
};

// =============================================================================
// 1. Schema Parsing to TypeScript Generation Flow
// =============================================================================

describe('Schema Parsing to TypeScript Generation Flow', () => {
  it('should parse a schema and generate TypeScript interface with correct types', () => {
    // Step 1: Parse the schema
    const schema = parseSchema(userSchemaDefinition);

    // Verify schema was parsed correctly
    expect(schema.name).toBe('User');
    expect(schema.fields.size).toBeGreaterThan(0);
    expect(schema.fields.has('id')).toBe(true);
    expect(schema.fields.has('email')).toBe(true);

    // Step 2: Generate TypeScript interface
    const tsInterface = generateTypeScriptInterface(schema);

    // Step 3: Verify output contains correct types
    expect(tsInterface).toContain('export interface User');
    expect(tsInterface).toContain('id: string'); // uuid maps to string
    expect(tsInterface).toContain('email: string');
    expect(tsInterface).toContain('name: string');
    expect(tsInterface).toContain('bio?: string'); // optional field
    expect(tsInterface).toContain('age?: number'); // optional int
    expect(tsInterface).toContain('balance: number'); // decimal maps to number
    expect(tsInterface).toContain('isActive: boolean');
    expect(tsInterface).toContain('tags: string[]');
    expect(tsInterface).toContain('createdAt: number'); // timestamp maps to number

    // Also generates Input type
    expect(tsInterface).toContain('export interface UserInput');
  });

  it('should handle various field types correctly', () => {
    const schema = parseSchema(productSchemaDefinition);
    const tsInterface = generateTypeScriptInterface(schema);

    expect(tsInterface).toContain('export interface Product');
    expect(tsInterface).toContain('sku: string');
    expect(tsInterface).toContain('price: number');
    expect(tsInterface).toContain('quantity: number');
    expect(tsInterface).toContain('weight?: number'); // optional float
    expect(tsInterface).toContain('isAvailable: boolean');
    expect(tsInterface).toContain('categories: string[]');
    expect(tsInterface).toContain('publishedAt?: number'); // optional date
    expect(tsInterface).toContain('expiresAt?: number'); // optional timestamp
  });

  it('should validate the parsed schema', () => {
    const schema = parseSchema(userSchemaDefinition);
    const validation = validateSchema(schema);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

// =============================================================================
// 2. Schema to Iceberg Metadata Flow
// =============================================================================

describe('Schema to Iceberg Metadata Flow', () => {
  it('should parse schema with partitioning directives and generate Iceberg metadata', () => {
    // Step 1: Parse the schema
    const schema = parseSchema(userSchemaDefinition);

    // Verify partitioning directives are parsed
    expect(schema.directives.partitionBy).toEqual(['tenantId']);

    // Step 2: Generate Iceberg metadata
    const metadata = generateIcebergMetadata(schema, 's3://test-bucket/tables/users');

    // Step 3: Verify table metadata structure
    expect(metadata.formatVersion).toBe(2);
    expect(metadata.location).toBe('s3://test-bucket/tables/users');
    expect(metadata.tableUuid).toBeDefined();
    expect(typeof metadata.tableUuid).toBe('string');

    // Verify schemas array
    expect(metadata.schemas).toHaveLength(1);
    expect(metadata.schemas[0]).toBeDefined();
    expect(metadata.schemas[0]!.type).toBe('struct');
    expect(metadata.schemas[0]!.fields.length).toBeGreaterThan(0);

    // Verify partition specs
    expect(metadata.partitionSpecs).toHaveLength(1);
    expect(metadata.partitionSpecs[0]).toBeDefined();

    // Verify sort orders
    expect(metadata.sortOrders).toHaveLength(1);

    // Verify properties
    expect(metadata.properties).toBeDefined();
    expect(metadata.properties['write.format.default']).toBe('parquet');
    expect(metadata.properties['icetype.source.schema']).toBe('User');
  });

  it('should include system fields in Iceberg schema', () => {
    const schema = parseSchema(orderSchemaDefinition);
    const metadata = generateIcebergMetadata(schema, 's3://test-bucket/tables/orders');

    const icebergSchema = metadata.schemas[0];
    expect(icebergSchema).toBeDefined();

    const fieldNames = icebergSchema!.fields.map(f => f.name);

    // System fields
    expect(fieldNames).toContain('$id');
    expect(fieldNames).toContain('$type');
    expect(fieldNames).toContain('$version');
    expect(fieldNames).toContain('$createdAt');
    expect(fieldNames).toContain('$updatedAt');

    // User fields
    expect(fieldNames).toContain('id');
    expect(fieldNames).toContain('customerId');
    expect(fieldNames).toContain('status');
    expect(fieldNames).toContain('totalAmount');
  });

  it('should handle schemas without explicit partitioning', () => {
    const schema = parseSchema(productSchemaDefinition);
    const metadata = generateIcebergMetadata(schema, 's3://test-bucket/tables/products');

    // Should default to partitioning by $type
    expect(metadata.partitionSpecs).toHaveLength(1);
    const partitionSpec = metadata.partitionSpecs[0];
    expect(partitionSpec).toBeDefined();
    expect(partitionSpec!.fields.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// 3. Schema to ClickHouse DDL Flow
// =============================================================================

describe('Schema to ClickHouse DDL Flow', () => {
  it('should parse schema, transform to ClickHouse DDL, and serialize to DDL string', () => {
    // Step 1: Parse the schema
    const schema = parseSchema(userSchemaDefinition);

    // Step 2: Transform to ClickHouse DDL
    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema, {
      engine: 'ReplacingMergeTree',
      orderBy: ['id'],
      partitionBy: 'toYYYYMM(created_at)',
      database: 'analytics',
    });

    // Verify DDL structure
    expect(ddl.tableName).toBe('user'); // snake_case
    expect(ddl.database).toBe('analytics');
    expect(ddl.engine).toBe('ReplacingMergeTree');
    expect(ddl.orderBy).toEqual(['id']);
    expect(ddl.partitionBy).toBe('toYYYYMM(created_at)');
    expect(ddl.columns.length).toBeGreaterThan(0);

    // Step 3: Serialize to DDL string
    const sql = adapter.serialize(ddl);

    // Step 4: Verify DDL syntax
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('analytics.user');
    expect(sql).toContain('ENGINE = ReplacingMergeTree()');
    expect(sql).toContain('ORDER BY (id)');
    expect(sql).toContain('PARTITION BY toYYYYMM(created_at)');

    // Verify column definitions
    expect(sql).toContain('UUID'); // id field
    expect(sql).toContain('String'); // string fields
    expect(sql).toContain('Nullable'); // optional fields
    expect(sql).toContain('DateTime64'); // timestamp fields
    expect(sql).toContain('Array(String)'); // tags array
  });

  it('should handle various ClickHouse types correctly', () => {
    const schema = parseSchema(productSchemaDefinition);
    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema, {
      engine: 'MergeTree',
      orderBy: ['id'],
    });

    const sql = adapter.serialize(ddl);

    expect(sql).toContain('UUID'); // id
    expect(sql).toContain('String'); // sku, name, description
    expect(sql).toContain('Decimal'); // price
    expect(sql).toContain('Int32'); // quantity
    expect(sql).toContain('Float32'); // weight (float maps to Float32 in ClickHouse)
    expect(sql).toContain('Bool'); // isAvailable
    expect(sql).toContain('Array(String)'); // categories
    expect(sql).toContain('Date'); // publishedAt
  });

  it('should infer partition expression from schema directives', () => {
    const schema = parseSchema({
      $type: 'Event',
      $partitionBy: ['eventDate'],
      id: 'uuid!',
      eventDate: 'timestamp!',
      eventType: 'string!',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema, {
      engine: 'MergeTree',
      orderBy: ['id'],
    });

    // Should auto-infer YYYYMM partition for timestamp field
    expect(ddl.partitionBy).toContain('toYYYYMM');
  });
});

// =============================================================================
// 4. Schema to DuckDB DDL Flow
// =============================================================================

describe('Schema to DuckDB DDL Flow', () => {
  it('should parse schema, transform to DuckDB DDL, and serialize to DDL string', () => {
    // Step 1: Parse the schema
    const schema = parseSchema(userSchemaDefinition);

    // Step 2: Transform to DuckDB DDL
    const adapter = new DuckDBAdapter();
    const ddl = adapter.transform(schema, {
      ifNotExists: true,
      schema: 'public',
    });

    // Verify DDL structure
    expect(ddl.tableName).toBe('User');
    expect(ddl.schemaName).toBe('public');
    expect(ddl.ifNotExists).toBe(true);
    expect(ddl.columns.length).toBeGreaterThan(0);

    // Step 3: Serialize to DDL string
    const sql = adapter.serialize(ddl);

    // Step 4: Verify DDL syntax
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    // DuckDB uses unquoted schema.table format
    expect(sql).toContain('public.User');

    // System columns
    expect(sql).toContain('"$id"');
    expect(sql).toContain('"$type"');
    expect(sql).toContain('"$version"');
    expect(sql).toContain('"$createdAt"');
    expect(sql).toContain('"$updatedAt"');

    // User columns with proper types
    expect(sql).toContain('UUID');
    expect(sql).toContain('VARCHAR');
    expect(sql).toContain('INTEGER');
    expect(sql).toContain('DECIMAL');
    expect(sql).toContain('BOOLEAN');
    expect(sql).toContain('TIMESTAMP');
    expect(sql).toContain('VARCHAR[]'); // tags array
  });

  it('should handle convenience function transformToDuckDBDDL', () => {
    const schema = parseSchema(orderSchemaDefinition);
    const sql = transformToDuckDBDDL(schema, { ifNotExists: true });

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    // DuckDB uses unquoted table names by default
    expect(sql).toContain('Order');
    expect(sql).toContain('id');
    expect(sql).toContain('customerId');
    expect(sql).toContain('status');
    expect(sql).toContain('totalAmount');
    expect(sql).toContain('DECIMAL');
  });

  it('should include unique constraints for indexed fields', () => {
    const schema = parseSchema(productSchemaDefinition);
    const adapter = new DuckDBAdapter();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    // sku has # modifier, should have unique constraint
    expect(sql).toContain('UNIQUE');
  });
});

// =============================================================================
// 5. Schema to PostgreSQL DDL Flow
// =============================================================================

describe('Schema to PostgreSQL DDL Flow', () => {
  it('should parse schema, transform to PostgreSQL DDL, and serialize to DDL string', () => {
    // Step 1: Parse the schema
    const schema = parseSchema(userSchemaDefinition);

    // Step 2: Transform to PostgreSQL DDL
    const adapter = new PostgresAdapter();
    const ddl = adapter.transform(schema, {
      ifNotExists: true,
      schema: 'public',
    });

    // Verify DDL structure
    expect(ddl.tableName).toBe('User');
    expect(ddl.schemaName).toBe('public');
    expect(ddl.ifNotExists).toBe(true);
    expect(ddl.columns.length).toBeGreaterThan(0);

    // Step 3: Serialize to DDL string
    const sql = adapter.serialize(ddl);

    // Step 4: Verify DDL syntax
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('"public"."User"');

    // System columns
    expect(sql).toContain('"$id"');
    expect(sql).toContain('"$type"');
    expect(sql).toContain('"$version"');
    expect(sql).toContain('"$createdAt"');
    expect(sql).toContain('"$updatedAt"');

    // User columns with proper types
    expect(sql).toContain('UUID');
    expect(sql).toContain('TEXT');
    expect(sql).toContain('INTEGER');
    expect(sql).toContain('DECIMAL');
    expect(sql).toContain('BOOLEAN');
    expect(sql).toContain('TIMESTAMP');
    expect(sql).toContain('TEXT[]'); // tags array
  });

  it('should handle convenience function transformToPostgresDDL', () => {
    const schema = parseSchema(orderSchemaDefinition);
    const sql = transformToPostgresDDL(schema, { ifNotExists: true });

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('"Order"');
    expect(sql).toContain('id');
    expect(sql).toContain('customerId');
    expect(sql).toContain('status');
    expect(sql).toContain('totalAmount');
    expect(sql).toContain('DECIMAL');
  });

  it('should create adapter via createPostgresAdapter factory', () => {
    const adapter = createPostgresAdapter();
    expect(adapter).toBeInstanceOf(PostgresAdapter);
    expect(adapter.name).toBe('postgres');
  });

  it('should include unique constraints for indexed fields', () => {
    const schema = parseSchema(productSchemaDefinition);
    const adapter = new PostgresAdapter();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    // sku has # modifier, should have unique constraint
    expect(sql).toContain('UNIQUE');
  });
});

// =============================================================================
// 6. Adapter Registry Integration
// =============================================================================

describe('Adapter Registry Integration', () => {
  it('should register multiple adapters and retrieve them', () => {
    // Step 1: Create registry and register adapters
    const registry = createAdapterRegistry();
    const icebergAdapter = new IcebergAdapter();
    const parquetAdapter = new ParquetAdapter();

    registry.register(icebergAdapter);
    registry.register(parquetAdapter);

    // Step 2: Retrieve adapters
    const retrievedIceberg = registry.get('iceberg');
    const retrievedParquet = registry.get('parquet');

    expect(retrievedIceberg).toBeDefined();
    expect(retrievedParquet).toBeDefined();
    expect(retrievedIceberg?.name).toBe('iceberg');
    expect(retrievedParquet?.name).toBe('parquet');
  });

  it('should list all registered adapters', () => {
    const registry = createAdapterRegistry();
    registry.register(new IcebergAdapter());
    registry.register(new ParquetAdapter());

    const adapters = registry.list();
    expect(adapters).toContain('iceberg');
    expect(adapters).toContain('parquet');
    expect(adapters).toHaveLength(2);
  });

  it('should use IcebergAdapter to produce valid output', () => {
    const registry = createAdapterRegistry();
    registry.register(new IcebergAdapter());

    const schema = parseSchema(userSchemaDefinition);
    const adapter = registry.get('iceberg');

    expect(adapter).toBeDefined();
    if (!adapter) return;

    const metadata = adapter.transform(schema, {
      location: 's3://test-bucket/tables/users',
    });

    // Verify output
    expect(metadata).toBeDefined();
    const serialized = adapter.serialize(metadata);
    expect(serialized).toBeDefined();
    expect(typeof serialized).toBe('string');

    // Verify it's valid JSON
    const parsed = JSON.parse(serialized);
    expect(parsed.location).toBe('s3://test-bucket/tables/users');
  });

  it('should use ParquetAdapter to produce valid output', () => {
    const registry = createAdapterRegistry();
    const parquetAdapter = new ParquetAdapter();
    registry.register(parquetAdapter);

    const schema = parseSchema(orderSchemaDefinition);

    // Use the adapter directly to get proper typing
    const parquetSchema = parquetAdapter.transform(schema);

    // Verify output
    expect(parquetSchema).toBeDefined();
    expect(parquetSchema.name).toBe('Order');
    expect(parquetSchema.fields.length).toBeGreaterThan(0);

    const serialized = parquetAdapter.serialize(parquetSchema);
    expect(serialized).toContain('message Order');
    expect(serialized).toContain('REQUIRED');
    expect(serialized).toContain('BYTE_ARRAY');

    // Also verify the registry retrieval works
    const retrievedAdapter = registry.get('parquet');
    expect(retrievedAdapter).toBeDefined();
    expect(retrievedAdapter?.name).toBe('parquet');
  });

  it('should prevent duplicate adapter registration', () => {
    const registry = createAdapterRegistry();
    registry.register(new IcebergAdapter());

    expect(() => {
      registry.register(new IcebergAdapter());
    }).toThrow(/already registered/);
  });

  it('should support unregistering adapters', () => {
    const registry = createAdapterRegistry();
    registry.register(new IcebergAdapter());
    registry.register(new ParquetAdapter());

    expect(registry.has('iceberg')).toBe(true);
    expect(registry.has('parquet')).toBe(true);

    const removed = registry.unregister('iceberg');
    expect(removed).toBe(true);
    expect(registry.has('iceberg')).toBe(false);
    expect(registry.has('parquet')).toBe(true);
  });
});

// =============================================================================
// Full Pipeline Tests
// =============================================================================

describe('Full Pipeline Integration', () => {
  it('should transform the same schema to multiple output formats', () => {
    // Parse schema once
    const schema = parseSchema(userSchemaDefinition);

    // Transform to TypeScript
    const tsInterface = generateTypeScriptInterface(schema);
    expect(tsInterface).toContain('export interface User');

    // Transform to Iceberg metadata
    const icebergMetadata = generateIcebergMetadata(schema, 's3://bucket/users');
    expect(icebergMetadata.schemas[0]?.fields.length).toBeGreaterThan(5);

    // Transform to Parquet schema
    const parquetSchema = generateParquetSchema(schema);
    expect(parquetSchema.name).toBe('User');

    // Transform to Parquet schema string
    const parquetString = generateParquetSchemaString(schema);
    expect(parquetString).toContain('message User');

    // Transform to ClickHouse DDL
    const clickhouseAdapter = new ClickHouseAdapter();
    const clickhouseDDL = clickhouseAdapter.transform(schema, {
      engine: 'MergeTree',
      orderBy: ['id'],
    });
    const clickhouseSQL = clickhouseAdapter.serialize(clickhouseDDL);
    expect(clickhouseSQL).toContain('CREATE TABLE');

    // Transform to DuckDB DDL
    const duckdbSQL = transformToDuckDBDDL(schema);
    expect(duckdbSQL).toContain('CREATE TABLE');

    // Transform to PostgreSQL DDL
    const postgresSQL = transformToPostgresDDL(schema);
    expect(postgresSQL).toContain('CREATE TABLE');
  });

  it('should handle complex schemas with all field types', () => {
    const complexSchema = parseSchema({
      $type: 'ComplexEntity',
      $partitionBy: ['createdDate'],
      $index: [['name'], ['category', 'status']],
      $fts: ['name', 'description', 'content'],
      $vector: { embedding: 768, thumbnail: 256 },

      // Basic types
      id: 'uuid!',
      name: 'string!',
      description: 'text?',
      content: 'text',

      // Numeric types
      count: 'int',
      score: 'float?',
      price: 'decimal(12,4)!',
      bigNumber: 'bigint?',

      // Boolean
      isEnabled: 'boolean = true',

      // Temporal types
      createdDate: 'date!',
      lastUpdated: 'timestamp',
      eventTime: 'time?',

      // Complex types
      tags: 'string[]',
      scores: 'int[]',
      embedding: 'float[]',
      thumbnail: 'float[]',
      metadata: 'json?',
      rawData: 'binary?',

      // Categorical
      status: 'string = "active"',
      category: 'string#',
    });

    // Validate the schema
    const validation = validateSchema(complexSchema);
    expect(validation.valid).toBe(true);

    // All transformations should work
    expect(() => generateTypeScriptInterface(complexSchema)).not.toThrow();
    expect(() => generateIcebergMetadata(complexSchema, 's3://bucket/complex')).not.toThrow();
    expect(() => generateParquetSchema(complexSchema)).not.toThrow();

    const chAdapter = new ClickHouseAdapter();
    expect(() => chAdapter.transform(complexSchema, { engine: 'MergeTree', orderBy: ['id'] })).not.toThrow();

    expect(() => transformToDuckDBDDL(complexSchema)).not.toThrow();

    expect(() => transformToPostgresDDL(complexSchema)).not.toThrow();
  });
});

// =============================================================================
// Main Package Export Tests
// =============================================================================

describe('Main icetype Package Exports', () => {
  it('should export PostgresAdapter from main icetype package', () => {
    expect(PostgresAdapterFromMain).toBeDefined();
    expect(PostgresAdapterFromMain).toBe(PostgresAdapter);
  });

  it('should export transformToPostgresDDL from main icetype package', () => {
    expect(transformToPostgresDDLFromMain).toBeDefined();
    expect(transformToPostgresDDLFromMain).toBe(transformToPostgresDDL);
  });

  it('should export createPostgresAdapter from main icetype package', () => {
    expect(createPostgresAdapterFromMain).toBeDefined();
    expect(createPostgresAdapterFromMain).toBe(createPostgresAdapter);
  });

  it('should generate PostgreSQL DDL using main package exports', () => {
    const schema = parseSchema({
      $type: 'TestEntity',
      id: 'uuid!',
      name: 'string',
      value: 'int?',
    });

    const sql = transformToPostgresDDLFromMain(schema, { ifNotExists: true });
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('TestEntity');
    expect(sql).toContain('UUID');
  });
});
