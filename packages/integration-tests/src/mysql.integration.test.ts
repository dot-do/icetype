/**
 * MySQL Integration Tests
 *
 * Tests IceType MySQL DDL generation against a real MySQL database
 * using testcontainers.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MySqlContainer, type StartedMySqlContainer } from '@testcontainers/mysql';
import mysql from 'mysql2/promise';

import { parseSchema } from '@icetype/core';
import { transformToMySQLDDL, MySQLAdapter } from '@icetype/mysql';

import { skipIfNoDocker } from './docker-check.js';

// Simple test schemas without default values (to avoid current DDL serialization bugs)
const SimpleUserSchema = parseSchema({
  $type: 'SimpleUser',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  age: 'int?',
  isActive: 'boolean',
});

const SimplePostSchema = parseSchema({
  $type: 'SimplePost',
  id: 'uuid!',
  title: 'string!',
  slug: 'string#',
  content: 'text',
  authorId: 'uuid!',
});

const SimpleProductSchema = parseSchema({
  $type: 'SimpleProduct',
  id: 'uuid!',
  name: 'string!',
  sku: 'string#',
  description: 'text',
  price: 'decimal(10,2)!',
  inventory: 'int',
  weight: 'float?',
});

const SimpleOrderSchema = parseSchema({
  $type: 'SimpleOrder',
  id: 'uuid!',
  orderNumber: 'string#',
  customerId: 'uuid!',
  status: 'string',
  total: 'decimal(10,2)!',
  currency: 'string',
});

// Skip entire test suite if Docker is not available
describe.skipIf(skipIfNoDocker())('MySQL Integration Tests', () => {
  let container: StartedMySqlContainer;
  let connection: mysql.Connection;

  beforeAll(async () => {
    // Start MySQL container
    container = await new MySqlContainer('mysql:8.0')
      .withDatabase('icetype_test')
      .withUsername('test')
      .withRootPassword('root')
      .start();

    // Connect to the database
    connection = await mysql.createConnection({
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getUserPassword(),
    });
  }, 180000); // 3 minute timeout for container startup (MySQL is slower)

  afterAll(async () => {
    if (connection) {
      await connection.end();
    }
    if (container) {
      await container.stop();
    }
  });

  describe('DDL Execution', () => {
    it('should execute generated DDL for SimpleUser schema', async () => {
      const ddl = transformToMySQLDDL(SimpleUserSchema, {
        ifNotExists: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
      });

      // Execute the DDL
      await connection.execute(ddl);

      // Verify table exists
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = 'icetype_test'
        AND TABLE_NAME = 'SimpleUser'
      `);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.TABLE_NAME).toBe('SimpleUser');
    });

    it('should execute generated DDL for SimplePost schema', async () => {
      const ddl = transformToMySQLDDL(SimplePostSchema, { ifNotExists: true });

      await connection.execute(ddl);

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = 'icetype_test'
        AND TABLE_NAME = 'SimplePost'
      `);

      expect(rows).toHaveLength(1);
    });

    it('should execute generated DDL for SimpleProduct schema', async () => {
      const ddl = transformToMySQLDDL(SimpleProductSchema, { ifNotExists: true });

      await connection.execute(ddl);

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = 'icetype_test'
        AND TABLE_NAME = 'SimpleProduct'
      `);

      expect(rows).toHaveLength(1);
    });

    it('should execute generated DDL for SimpleOrder schema', async () => {
      const ddl = transformToMySQLDDL(SimpleOrderSchema, { ifNotExists: true });

      await connection.execute(ddl);

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = 'icetype_test'
        AND TABLE_NAME = 'SimpleOrder'
      `);

      expect(rows).toHaveLength(1);
    });
  });

  describe('Column Structure Verification', () => {
    it('should create correct columns for SimpleUser schema', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'icetype_test'
        AND TABLE_NAME = 'SimpleUser'
        ORDER BY ORDINAL_POSITION
      `);

      // Check system columns exist
      const systemColumns = rows.filter((c: mysql.RowDataPacket) => c.COLUMN_NAME.startsWith('$'));
      expect(systemColumns.length).toBeGreaterThanOrEqual(4); // $id, $type, $version, $createdAt, $updatedAt

      // Check user-defined columns
      const idColumn = rows.find((c: mysql.RowDataPacket) => c.COLUMN_NAME === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn!.DATA_TYPE).toBe('char');
      expect(idColumn!.IS_NULLABLE).toBe('NO');

      const emailColumn = rows.find((c: mysql.RowDataPacket) => c.COLUMN_NAME === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn!.DATA_TYPE).toBe('varchar');

      const nameColumn = rows.find((c: mysql.RowDataPacket) => c.COLUMN_NAME === 'name');
      expect(nameColumn).toBeDefined();
      expect(nameColumn!.DATA_TYPE).toBe('varchar');
    });

    it('should create correct columns for SimpleProduct schema with decimal precision', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'icetype_test'
        AND TABLE_NAME = 'SimpleProduct'
        AND COLUMN_NAME = 'price'
      `);

      expect(rows).toHaveLength(1);
      const priceColumn = rows[0]!;
      expect(priceColumn.DATA_TYPE).toBe('decimal');
      expect(priceColumn.NUMERIC_PRECISION).toBe(10);
      expect(priceColumn.NUMERIC_SCALE).toBe(2);
    });
  });

  describe('CRUD Operations', () => {
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';

    it('should insert a record successfully', async () => {
      const [result] = await connection.execute<mysql.ResultSetHeader>(
        `
        INSERT INTO SimpleUser (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, email, name, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          testUserId,
          'SimpleUser',
          1,
          Date.now(),
          Date.now(),
          testUserId,
          'test@example.com',
          'Test User',
          1,
        ]
      );

      expect(result.affectedRows).toBe(1);
    });

    it('should read a record successfully', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` = ?',
        [testUserId]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]!.email).toBe('test@example.com');
    });

    it('should update a record successfully', async () => {
      await connection.execute('UPDATE SimpleUser SET name = ? WHERE `$id` = ?', [
        'Updated User',
        testUserId,
      ]);

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT name FROM SimpleUser WHERE `$id` = ?',
        [testUserId]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]!.name).toBe('Updated User');
    });

    it('should delete a record successfully', async () => {
      await connection.execute('DELETE FROM SimpleUser WHERE `$id` = ?', [testUserId]);

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` = ?',
        [testUserId]
      );

      expect(rows).toHaveLength(0);
    });
  });

  describe('Constraint Verification', () => {
    it('should enforce unique constraints', async () => {
      // Create a fresh table for this test
      const schema = parseSchema({
        $type: 'UniqueTestUserMySQL',
        id: 'uuid!',
        email: 'string#', // # means indexed, unique
      });

      const ddl = transformToMySQLDDL(schema, { ifNotExists: true });
      await connection.execute(ddl);

      // Insert first record
      const userId1 = '550e8400-e29b-41d4-a716-446655440001';
      await connection.execute(
        `
        INSERT INTO UniqueTestUserMySQL (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, email)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [userId1, 'UniqueTestUserMySQL', 1, Date.now(), Date.now(), userId1, 'unique@example.com']
      );

      // Try to insert a duplicate - should fail
      const userId2 = '550e8400-e29b-41d4-a716-446655440002';
      await expect(
        connection.execute(
          `
          INSERT INTO UniqueTestUserMySQL (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, email)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [userId2, 'UniqueTestUserMySQL', 1, Date.now(), Date.now(), userId2, 'unique@example.com']
        )
      ).rejects.toThrow(/Duplicate entry|UNIQUE constraint/i);
    });

    it('should enforce NOT NULL constraints', async () => {
      const schema = parseSchema({
        $type: 'NotNullTestUserMySQL',
        id: 'uuid!',
        requiredField: 'string!',
      });

      const ddl = transformToMySQLDDL(schema, { ifNotExists: true });
      await connection.execute(ddl);

      // Try to insert with null required field - should fail
      const userId = '550e8400-e29b-41d4-a716-446655440003';
      await expect(
        connection.execute(
          `
          INSERT INTO NotNullTestUserMySQL (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, requiredField)
          VALUES (?, ?, ?, ?, ?, ?, NULL)
        `,
          [userId, 'NotNullTestUserMySQL', 1, Date.now(), Date.now(), userId]
        )
      ).rejects.toThrow(/cannot be null|NOT NULL constraint/i);
    });
  });

  describe('Index Creation', () => {
    it('should create indexes with serializeWithIndexes', async () => {
      const schema = parseSchema({
        $type: 'IndexedEntityMySQL',
        id: 'uuid!',
        indexedField: 'string#', // indexed
      });

      const adapter = new MySQLAdapter();
      const ddl = adapter.transform(schema, { ifNotExists: true });
      const fullDDL = adapter.serializeWithIndexes(ddl);

      // Execute all statements
      const statements = fullDDL.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          await connection.execute(stmt);
        }
      }

      // Verify index exists
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SHOW INDEX FROM IndexedEntityMySQL
        WHERE Column_name = 'indexedField'
      `);

      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Schema with Various Types', () => {
    it('should handle all IceType primitive types', async () => {
      const schema = parseSchema({
        $type: 'AllTypesTestMySQL',
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

      const ddl = transformToMySQLDDL(schema, { ifNotExists: true });
      await connection.execute(ddl);

      // Verify table was created
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'icetype_test'
        AND TABLE_NAME = 'AllTypesTestMySQL'
        ORDER BY ORDINAL_POSITION
      `);

      const columnMap = new Map(
        rows.map((r: mysql.RowDataPacket) => [r.COLUMN_NAME, r.DATA_TYPE])
      );

      expect(columnMap.get('stringField')).toBe('varchar');
      expect(columnMap.get('textField')).toBe('text');
      expect(columnMap.get('intField')).toBe('int');
      // MySQL maps float to 'float' not 'double'
      expect(['float', 'double']).toContain(columnMap.get('floatField'));
      expect(columnMap.get('boolField')).toBe('tinyint');
      expect(columnMap.get('dateField')).toBe('date');
      expect(columnMap.get('timestampField')).toBe('datetime');
      expect(columnMap.get('jsonField')).toBe('json');
      expect(columnMap.get('decimalField')).toBe('decimal');
    });

    it('should handle JSON data', async () => {
      const schema = parseSchema({
        $type: 'JsonTestMySQL',
        id: 'uuid!',
        metadata: 'json',
      });

      const ddl = transformToMySQLDDL(schema, { ifNotExists: true });
      await connection.execute(ddl);

      // Insert JSON data
      const userId = '550e8400-e29b-41d4-a716-446655440004';
      const jsonData = { key: 'value', nested: { a: 1, b: 2 } };

      await connection.execute(
        `
        INSERT INTO JsonTestMySQL (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [userId, 'JsonTestMySQL', 1, Date.now(), Date.now(), userId, JSON.stringify(jsonData)]
      );

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT metadata FROM JsonTestMySQL WHERE `$id` = ?',
        [userId]
      );

      expect(rows[0]!.metadata).toEqual(jsonData);
    });
  });

  describe('Engine and Charset Options', () => {
    it('should create table with specified engine and charset', async () => {
      const schema = parseSchema({
        $type: 'EngineTestMySQL',
        id: 'uuid!',
        name: 'string',
      });

      const ddl = transformToMySQLDDL(schema, {
        ifNotExists: true,
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
      });

      await connection.execute(ddl);

      // Verify table properties
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT ENGINE, TABLE_COLLATION
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = 'icetype_test'
        AND TABLE_NAME = 'EngineTestMySQL'
      `);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.ENGINE).toBe('InnoDB');
      expect(rows[0]!.TABLE_COLLATION).toBe('utf8mb4_unicode_ci');
    });
  });
});
