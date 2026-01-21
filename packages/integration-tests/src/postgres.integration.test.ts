/**
 * PostgreSQL Integration Tests
 *
 * Tests IceType PostgreSQL DDL generation against a real PostgreSQL database
 * using testcontainers.
 *
 * Note: PostgreSQL lowercases unquoted identifiers, so table names like
 * "SimpleUser" become "simpleuser" in the database. Tests account for this.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

import { parseSchema } from '@icetype/core';
import { transformToPostgresDDL, PostgresAdapter } from '@icetype/postgres';

import { skipIfNoDocker } from './docker-check.js';

const { Client } = pg;

// Simple test schemas without default values (to avoid current DDL serialization bugs)
// Note: Using lowercase type names because PostgreSQL lowercases unquoted identifiers
const SimpleUserSchema = parseSchema({
  $type: 'testuser',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  age: 'int?',
  isActive: 'boolean',
});

const SimplePostSchema = parseSchema({
  $type: 'testpost',
  id: 'uuid!',
  title: 'string!',
  slug: 'string#',
  content: 'text',
  authorId: 'uuid!',
  tags: 'string[]',
});

const SimpleProductSchema = parseSchema({
  $type: 'testproduct',
  id: 'uuid!',
  name: 'string!',
  sku: 'string#',
  description: 'text',
  price: 'decimal(10,2)!',
  inventory: 'int',
  weight: 'float?',
});

const SimpleOrderSchema = parseSchema({
  $type: 'testorder',
  id: 'uuid!',
  orderNumber: 'string#',
  customerId: 'uuid!',
  status: 'string',
  total: 'decimal(10,2)!',
  currency: 'string',
});

// Skip entire test suite if Docker is not available
describe.skipIf(skipIfNoDocker())('PostgreSQL Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let client: pg.Client;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('icetype_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    // Connect to the database
    client = new Client({
      connectionString: container.getConnectionUri(),
    });
    await client.connect();
  }, 120000); // 2 minute timeout for container startup

  afterAll(async () => {
    if (client) {
      await client.end();
    }
    if (container) {
      await container.stop();
    }
  });

  describe('DDL Execution', () => {
    it('should execute generated DDL for User schema', async () => {
      const ddl = transformToPostgresDDL(SimpleUserSchema, { ifNotExists: true });

      // Execute the DDL
      await client.query(ddl);

      // Verify table exists
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'testuser'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].table_name).toBe('testuser');
    });

    it('should execute generated DDL for Post schema', async () => {
      const ddl = transformToPostgresDDL(SimplePostSchema, { ifNotExists: true });

      await client.query(ddl);

      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'testpost'
      `);

      expect(result.rows).toHaveLength(1);
    });

    it('should execute generated DDL for Product schema', async () => {
      const ddl = transformToPostgresDDL(SimpleProductSchema, { ifNotExists: true });

      await client.query(ddl);

      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'testproduct'
      `);

      expect(result.rows).toHaveLength(1);
    });

    it('should execute generated DDL for Order schema', async () => {
      const ddl = transformToPostgresDDL(SimpleOrderSchema, { ifNotExists: true });

      await client.query(ddl);

      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'testorder'
      `);

      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Column Structure Verification', () => {
    it('should create correct columns for User schema', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'testuser'
        ORDER BY ordinal_position
      `);

      const columns = result.rows;

      // Check system columns exist
      const systemColumns = columns.filter((c: { column_name: string }) =>
        c.column_name.startsWith('$')
      );
      expect(systemColumns.length).toBeGreaterThanOrEqual(4); // $id, $type, $version, $createdAt, $updatedAt

      // Check user-defined columns
      const idColumn = columns.find((c: { column_name: string }) => c.column_name === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn.data_type).toBe('uuid');
      expect(idColumn.is_nullable).toBe('NO');

      const emailColumn = columns.find((c: { column_name: string }) => c.column_name === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn.data_type).toBe('text');

      const nameColumn = columns.find((c: { column_name: string }) => c.column_name === 'name');
      expect(nameColumn).toBeDefined();
      expect(nameColumn.data_type).toBe('text');
    });

    it('should create correct columns for Product schema with decimal precision', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'testproduct'
        AND column_name = 'price'
      `);

      expect(result.rows).toHaveLength(1);
      const priceColumn = result.rows[0];
      expect(priceColumn.data_type).toBe('numeric');
      expect(priceColumn.numeric_precision).toBe(10);
      expect(priceColumn.numeric_scale).toBe(2);
    });
  });

  describe('CRUD Operations', () => {
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';

    it('should insert a record successfully', async () => {
      const result = await client.query(
        `
        INSERT INTO testuser ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, email, name, isactive)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
        [
          testUserId,
          'testuser',
          1,
          Date.now(),
          Date.now(),
          testUserId,
          'test@example.com',
          'Test User',
          true,
        ]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBe('test@example.com');
      expect(result.rows[0].name).toBe('Test User');
    });

    it('should read a record successfully', async () => {
      const result = await client.query(`SELECT * FROM testuser WHERE "$id" = $1`, [testUserId]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBe('test@example.com');
    });

    it('should update a record successfully', async () => {
      await client.query(`UPDATE testuser SET name = $1 WHERE "$id" = $2`, [
        'Updated User',
        testUserId,
      ]);

      const result = await client.query(`SELECT name FROM testuser WHERE "$id" = $1`, [testUserId]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Updated User');
    });

    it('should delete a record successfully', async () => {
      await client.query(`DELETE FROM testuser WHERE "$id" = $1`, [testUserId]);

      const result = await client.query(`SELECT * FROM testuser WHERE "$id" = $1`, [testUserId]);

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Constraint Verification', () => {
    it('should enforce unique constraints', async () => {
      // First, create a fresh table for this test
      const schema = parseSchema({
        $type: 'uniquetestuser',
        id: 'uuid!',
        email: 'string#', // # means indexed, unique
      });

      const ddl = transformToPostgresDDL(schema, { ifNotExists: true });
      await client.query(ddl);

      // Insert first record
      const userId1 = '550e8400-e29b-41d4-a716-446655440001';
      await client.query(
        `
        INSERT INTO uniquetestuser ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, email)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [userId1, 'uniquetestuser', 1, Date.now(), Date.now(), userId1, 'unique@example.com']
      );

      // Try to insert a duplicate - should fail
      const userId2 = '550e8400-e29b-41d4-a716-446655440002';
      await expect(
        client.query(
          `
          INSERT INTO uniquetestuser ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, email)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [userId2, 'uniquetestuser', 1, Date.now(), Date.now(), userId2, 'unique@example.com']
        )
      ).rejects.toThrow(/unique constraint|duplicate key/i);
    });

    it('should enforce NOT NULL constraints', async () => {
      const schema = parseSchema({
        $type: 'notnulltestuser',
        id: 'uuid!',
        requiredfield: 'string!',
      });

      const ddl = transformToPostgresDDL(schema, { ifNotExists: true });
      await client.query(ddl);

      // Try to insert with null required field - should fail
      const userId = '550e8400-e29b-41d4-a716-446655440003';
      await expect(
        client.query(
          `
          INSERT INTO notnulltestuser ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, requiredfield)
          VALUES ($1, $2, $3, $4, $5, $6, NULL)
        `,
          [userId, 'notnulltestuser', 1, Date.now(), Date.now(), userId]
        )
      ).rejects.toThrow(/null value|not-null constraint/i);
    });
  });

  describe('Index Creation', () => {
    it('should create indexes with serializeWithIndexes', async () => {
      const schema = parseSchema({
        $type: 'indexedentity',
        id: 'uuid!',
        indexedField: 'string#', // indexed
      });

      const adapter = new PostgresAdapter();
      const ddl = adapter.transform(schema, { ifNotExists: true });
      const fullDDL = adapter.serializeWithIndexes(ddl);

      // Execute all statements
      const statements = fullDDL.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          await client.query(stmt);
        }
      }

      // Verify index exists
      const result = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'indexedentity'
        AND indexname LIKE '%indexedfield%'
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Schema with Various Types', () => {
    it('should handle all IceType primitive types', async () => {
      const schema = parseSchema({
        $type: 'alltypestest',
        id: 'uuid!',
        stringField: 'string',
        textField: 'text',
        intField: 'int',
        floatField: 'float',
        boolField: 'boolean',
        dateField: 'date',
        timestampField: 'timestamp',
        jsonField: 'json',
        decimalField: 'decimal(18,4)',
      });

      const ddl = transformToPostgresDDL(schema, { ifNotExists: true });
      await client.query(ddl);

      // Verify table was created
      const result = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'alltypestest'
        ORDER BY ordinal_position
      `);

      const columnMap = new Map(
        result.rows.map((r: { column_name: string; data_type: string }) => [
          r.column_name,
          r.data_type,
        ])
      );

      expect(columnMap.get('stringfield')).toBe('text');
      expect(columnMap.get('textfield')).toBe('text');
      expect(columnMap.get('intfield')).toBe('integer');
      // PostgreSQL may use 'real' (FLOAT4) or 'double precision' (FLOAT8) for float
      expect(['real', 'double precision']).toContain(columnMap.get('floatfield'));
      expect(columnMap.get('boolfield')).toBe('boolean');
      expect(columnMap.get('datefield')).toBe('date');
      expect(columnMap.get('timestampfield')).toBe('timestamp without time zone');
      expect(columnMap.get('jsonfield')).toBe('jsonb');
      expect(columnMap.get('decimalfield')).toBe('numeric');
    });

    it('should handle array types', async () => {
      const schema = parseSchema({
        $type: 'arraytypestest',
        id: 'uuid!',
        tags: 'string[]',
      });

      const ddl = transformToPostgresDDL(schema, { ifNotExists: true });
      await client.query(ddl);

      // Verify we can insert array data
      const userId = '550e8400-e29b-41d4-a716-446655440004';
      await client.query(
        `
        INSERT INTO arraytypestest ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [userId, 'arraytypestest', 1, Date.now(), Date.now(), userId, ['tag1', 'tag2', 'tag3']]
      );

      const result = await client.query(`SELECT tags FROM arraytypestest WHERE "$id" = $1`, [
        userId,
      ]);

      expect(result.rows[0].tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });
});
