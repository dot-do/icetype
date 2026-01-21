/**
 * MySQL Integration Tests
 *
 * Tests IceType MySQL DDL generation against a real MySQL database
 * using testcontainers.
 *
 * Test organization:
 * - DDL Execution: Basic table creation
 * - Column Structure Verification: Column types and properties
 * - CRUD Operations: Basic and complex operations
 * - Transactions: Transaction support and isolation
 * - Constraint Verification: UNIQUE, NOT NULL, CHECK, DEFAULT, Foreign Keys
 * - Index Creation: Index generation and verification
 * - Schema with Various Types: Type mapping verification
 * - Edge Cases: Unicode, special characters, large data, NULL handling
 * - Connection Pooling: Pool creation and management
 * - Engine and Charset Options: MySQL-specific options
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { MySqlContainer, type StartedMySqlContainer } from '@testcontainers/mysql';
import mysql from 'mysql2/promise';

import { parseSchema } from '@icetype/core';
import { transformToMySQLDDL, MySQLAdapter } from '@icetype/mysql';

import { skipIfNoDocker } from './docker-check.js';

// =============================================================================
// Test Schemas
// =============================================================================

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

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Helper to generate UUIDs for tests.
 */
function generateTestUUID(suffix: string): string {
  return `550e8400-e29b-41d4-a716-44665544${suffix}`;
}

/**
 * Helper to insert a record with system fields.
 */
async function insertRecord(
  connection: mysql.Connection,
  tableName: string,
  record: Record<string, unknown>,
  systemFields: { id: string; type: string }
): Promise<mysql.ResultSetHeader> {
  const now = Date.now();
  const columns = ['`$id`', '`$type`', '`$version`', '`$createdAt`', '`$updatedAt`', ...Object.keys(record)];
  const placeholders = columns.map(() => '?').join(', ');
  const values = [systemFields.id, systemFields.type, 1, now, now, ...Object.values(record)];

  const [result] = await connection.execute<mysql.ResultSetHeader>(
    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );
  return result;
}

/**
 * Helper to verify a table exists.
 */
async function tableExists(
  connection: mysql.Connection,
  tableName: string,
  database: string
): Promise<boolean> {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ?
    AND TABLE_NAME = ?
  `, [database, tableName]);
  return rows.length > 0;
}

/**
 * Helper to get column information.
 */
async function getColumnInfo(
  connection: mysql.Connection,
  tableName: string,
  database: string
): Promise<mysql.RowDataPacket[]> {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
           NUMERIC_PRECISION, NUMERIC_SCALE, CHARACTER_MAXIMUM_LENGTH
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ?
    AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `, [database, tableName]);
  return rows;
}

/**
 * Helper to drop a table if it exists.
 */
async function dropTableIfExists(connection: mysql.Connection, tableName: string): Promise<void> {
  await connection.execute(`DROP TABLE IF EXISTS ${tableName}`);
}

// =============================================================================
// Test Suite
// =============================================================================

describe.skipIf(skipIfNoDocker())('MySQL Integration Tests', () => {
  let container: StartedMySqlContainer;
  let connection: mysql.Connection;
  const DATABASE_NAME = 'icetype_test';

  beforeAll(async () => {
    // Start MySQL container
    container = await new MySqlContainer('mysql:8.0')
      .withDatabase(DATABASE_NAME)
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

  // ===========================================================================
  // DDL Execution Tests
  // ===========================================================================
  describe('DDL Execution', () => {
    it('should execute generated DDL for SimpleUser schema', async () => {
      const ddl = transformToMySQLDDL(SimpleUserSchema, {
        ifNotExists: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
      });

      await connection.execute(ddl);
      expect(await tableExists(connection, 'SimpleUser', DATABASE_NAME)).toBe(true);
    });

    it('should execute generated DDL for SimplePost schema', async () => {
      const ddl = transformToMySQLDDL(SimplePostSchema, { ifNotExists: true });
      await connection.execute(ddl);
      expect(await tableExists(connection, 'SimplePost', DATABASE_NAME)).toBe(true);
    });

    it('should execute generated DDL for SimpleProduct schema', async () => {
      const ddl = transformToMySQLDDL(SimpleProductSchema, { ifNotExists: true });
      await connection.execute(ddl);
      expect(await tableExists(connection, 'SimpleProduct', DATABASE_NAME)).toBe(true);
    });

    it('should execute generated DDL for SimpleOrder schema', async () => {
      const ddl = transformToMySQLDDL(SimpleOrderSchema, { ifNotExists: true });
      await connection.execute(ddl);
      expect(await tableExists(connection, 'SimpleOrder', DATABASE_NAME)).toBe(true);
    });

    it('should handle IF NOT EXISTS without error on duplicate creation', async () => {
      const schema = parseSchema({
        $type: 'DuplicateTestTable',
        id: 'uuid!',
        name: 'string',
      });
      const ddl = transformToMySQLDDL(schema, { ifNotExists: true });

      // First creation
      await connection.execute(ddl);

      // Second creation should not throw
      await expect(connection.execute(ddl)).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // Column Structure Verification Tests
  // ===========================================================================
  describe('Column Structure Verification', () => {
    it('should create correct columns for SimpleUser schema', async () => {
      const columns = await getColumnInfo(connection, 'SimpleUser', DATABASE_NAME);

      // Check system columns exist
      const systemColumns = columns.filter((c: mysql.RowDataPacket) => c.COLUMN_NAME.startsWith('$'));
      expect(systemColumns.length).toBeGreaterThanOrEqual(4);

      // Check user-defined columns
      const idColumn = columns.find((c: mysql.RowDataPacket) => c.COLUMN_NAME === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn!.DATA_TYPE).toBe('char');
      expect(idColumn!.IS_NULLABLE).toBe('NO');

      const emailColumn = columns.find((c: mysql.RowDataPacket) => c.COLUMN_NAME === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn!.DATA_TYPE).toBe('varchar');

      const nameColumn = columns.find((c: mysql.RowDataPacket) => c.COLUMN_NAME === 'name');
      expect(nameColumn).toBeDefined();
      expect(nameColumn!.DATA_TYPE).toBe('varchar');
    });

    it('should create correct columns for SimpleProduct schema with decimal precision', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'SimpleProduct'
        AND COLUMN_NAME = 'price'
      `, [DATABASE_NAME]);

      expect(rows).toHaveLength(1);
      const priceColumn = rows[0]!;
      expect(priceColumn.DATA_TYPE).toBe('decimal');
      expect(priceColumn.NUMERIC_PRECISION).toBe(10);
      expect(priceColumn.NUMERIC_SCALE).toBe(2);
    });

    it('should create nullable columns for optional fields', async () => {
      const columns = await getColumnInfo(connection, 'SimpleUser', DATABASE_NAME);
      const ageColumn = columns.find((c: mysql.RowDataPacket) => c.COLUMN_NAME === 'age');

      expect(ageColumn).toBeDefined();
      expect(ageColumn!.IS_NULLABLE).toBe('YES');
    });

    it('should create non-nullable columns for required fields', async () => {
      const columns = await getColumnInfo(connection, 'SimpleProduct', DATABASE_NAME);
      const nameColumn = columns.find((c: mysql.RowDataPacket) => c.COLUMN_NAME === 'name');

      expect(nameColumn).toBeDefined();
      expect(nameColumn!.IS_NULLABLE).toBe('NO');
    });
  });

  // ===========================================================================
  // Basic CRUD Operations Tests
  // ===========================================================================
  describe('CRUD Operations - Basic', () => {
    const testUserId = generateTestUUID('0000');

    afterEach(async () => {
      // Cleanup test data
      await connection.execute('DELETE FROM SimpleUser WHERE `$id` = ?', [testUserId]);
    });

    it('should insert a record successfully', async () => {
      const result = await insertRecord(
        connection,
        'SimpleUser',
        { id: testUserId, email: 'test@example.com', name: 'Test User', isActive: 1 },
        { id: testUserId, type: 'SimpleUser' }
      );
      expect(result.affectedRows).toBe(1);
    });

    it('should read a record successfully', async () => {
      await insertRecord(
        connection,
        'SimpleUser',
        { id: testUserId, email: 'test@example.com', name: 'Test User', isActive: 1 },
        { id: testUserId, type: 'SimpleUser' }
      );

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` = ?',
        [testUserId]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]!.email).toBe('test@example.com');
    });

    it('should update a record successfully', async () => {
      await insertRecord(
        connection,
        'SimpleUser',
        { id: testUserId, email: 'test@example.com', name: 'Test User', isActive: 1 },
        { id: testUserId, type: 'SimpleUser' }
      );

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
      await insertRecord(
        connection,
        'SimpleUser',
        { id: testUserId, email: 'test@example.com', name: 'Test User', isActive: 1 },
        { id: testUserId, type: 'SimpleUser' }
      );

      await connection.execute('DELETE FROM SimpleUser WHERE `$id` = ?', [testUserId]);

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` = ?',
        [testUserId]
      );

      expect(rows).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Complex CRUD Operations Tests
  // ===========================================================================
  describe('CRUD Operations - Complex Queries', () => {
    const userIds = [
      generateTestUUID('1001'),
      generateTestUUID('1002'),
      generateTestUUID('1003'),
      generateTestUUID('1004'),
      generateTestUUID('1005'),
    ];

    beforeEach(async () => {
      // Insert test data
      for (let i = 0; i < userIds.length; i++) {
        await insertRecord(
          connection,
          'SimpleUser',
          {
            id: userIds[i],
            email: `user${i}@example.com`,
            name: `User ${i}`,
            age: 20 + i * 5,
            isActive: i % 2 === 0 ? 1 : 0
          },
          { id: userIds[i]!, type: 'SimpleUser' }
        );
      }
    });

    afterEach(async () => {
      // Cleanup
      for (const id of userIds) {
        await connection.execute('DELETE FROM SimpleUser WHERE `$id` = ?', [id]);
      }
    });

    it('should filter records with WHERE clause', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE age >= ?',
        [30]
      );
      expect(rows.length).toBeGreaterThanOrEqual(3);
    });

    it('should order records with ORDER BY', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT name, age FROM SimpleUser WHERE `$id` IN (?, ?, ?, ?, ?) ORDER BY age DESC',
        userIds
      );

      expect(rows).toHaveLength(5);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1]!.age).toBeGreaterThanOrEqual(rows[i]!.age);
      }
    });

    it('should limit records with LIMIT clause', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` IN (?, ?, ?, ?, ?) LIMIT 3',
        userIds
      );
      expect(rows).toHaveLength(3);
    });

    it('should paginate records with LIMIT and OFFSET', async () => {
      const [page1] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` IN (?, ?, ?, ?, ?) ORDER BY age LIMIT 2 OFFSET 0',
        userIds
      );
      const [page2] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` IN (?, ?, ?, ?, ?) ORDER BY age LIMIT 2 OFFSET 2',
        userIds
      );

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0]!.age).toBeLessThan(page2[0]!.age);
    });

    it('should aggregate with COUNT', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM SimpleUser WHERE `$id` IN (?, ?, ?, ?, ?)',
        userIds
      );
      expect(rows[0]!.count).toBe(5);
    });

    it('should aggregate with SUM and AVG', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT SUM(age) as total_age, AVG(age) as avg_age FROM SimpleUser WHERE `$id` IN (?, ?, ?, ?, ?)',
        userIds
      );
      // MySQL returns aggregates as strings, so we convert for comparison
      expect(Number(rows[0]!.total_age)).toBe(20 + 25 + 30 + 35 + 40);
      expect(Number(rows[0]!.avg_age)).toBe(30);
    });

    it('should group records with GROUP BY', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT isActive, COUNT(*) as count FROM SimpleUser WHERE `$id` IN (?, ?, ?, ?, ?) GROUP BY isActive',
        userIds
      );
      expect(rows).toHaveLength(2);
    });

    it('should filter groups with HAVING', async () => {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT isActive, COUNT(*) as count FROM SimpleUser WHERE `$id` IN (?, ?, ?, ?, ?) GROUP BY isActive HAVING count >= 2',
        userIds
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should update multiple records', async () => {
      const [result] = await connection.execute<mysql.ResultSetHeader>(
        'UPDATE SimpleUser SET isActive = 1 WHERE `$id` IN (?, ?, ?, ?, ?)',
        userIds
      );
      expect(result.affectedRows).toBe(5);
    });

    it('should perform conditional update with CASE', async () => {
      await connection.execute(
        `UPDATE SimpleUser
         SET name = CASE
           WHEN age < 30 THEN 'Young User'
           WHEN age >= 30 THEN 'Mature User'
         END
         WHERE \`$id\` IN (?, ?, ?, ?, ?)`,
        userIds
      );

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT name, age FROM SimpleUser WHERE `$id` IN (?, ?, ?, ?, ?) ORDER BY age',
        userIds
      );

      expect(rows[0]!.name).toBe('Young User');
      expect(rows[2]!.name).toBe('Mature User');
    });
  });

  // ===========================================================================
  // Transaction Tests
  // ===========================================================================
  describe('Transactions', () => {
    const userId1 = generateTestUUID('2001');
    const userId2 = generateTestUUID('2002');

    afterEach(async () => {
      await connection.execute('DELETE FROM SimpleUser WHERE `$id` IN (?, ?)', [userId1, userId2]);
    });

    it('should commit transaction successfully', async () => {
      await connection.beginTransaction();

      try {
        await insertRecord(
          connection,
          'SimpleUser',
          { id: userId1, email: 'tx1@example.com', name: 'TX User 1', isActive: 1 },
          { id: userId1, type: 'SimpleUser' }
        );
        await insertRecord(
          connection,
          'SimpleUser',
          { id: userId2, email: 'tx2@example.com', name: 'TX User 2', isActive: 1 },
          { id: userId2, type: 'SimpleUser' }
        );

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` IN (?, ?)',
        [userId1, userId2]
      );
      expect(rows).toHaveLength(2);
    });

    it('should rollback transaction on error', async () => {
      await connection.beginTransaction();

      try {
        await insertRecord(
          connection,
          'SimpleUser',
          { id: userId1, email: 'rollback@example.com', name: 'Rollback User', isActive: 1 },
          { id: userId1, type: 'SimpleUser' }
        );

        // Simulate error by rolling back
        await connection.rollback();
      } catch {
        await connection.rollback();
      }

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` = ?',
        [userId1]
      );
      expect(rows).toHaveLength(0);
    });

    it('should maintain transaction isolation', async () => {
      // Create a second connection to test isolation
      const connection2 = await mysql.createConnection({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getUserPassword(),
      });

      try {
        // Start transaction on first connection
        await connection.beginTransaction();
        await insertRecord(
          connection,
          'SimpleUser',
          { id: userId1, email: 'isolation@example.com', name: 'Isolation User', isActive: 1 },
          { id: userId1, type: 'SimpleUser' }
        );

        // Second connection should not see uncommitted data (default REPEATABLE READ)
        const [rows] = await connection2.execute<mysql.RowDataPacket[]>(
          'SELECT * FROM SimpleUser WHERE `$id` = ?',
          [userId1]
        );
        expect(rows).toHaveLength(0);

        await connection.commit();

        // Now second connection should see committed data
        const [rowsAfterCommit] = await connection2.execute<mysql.RowDataPacket[]>(
          'SELECT * FROM SimpleUser WHERE `$id` = ?',
          [userId1]
        );
        expect(rowsAfterCommit).toHaveLength(1);
      } finally {
        await connection2.end();
      }
    });
  });

  // ===========================================================================
  // Constraint Verification Tests
  // ===========================================================================
  describe('Constraint Verification', () => {
    describe('UNIQUE Constraints', () => {
      it('should enforce unique constraints', async () => {
        const schema = parseSchema({
          $type: 'UniqueTestUserMySQL',
          id: 'uuid!',
          email: 'string#',
        });

        const ddl = transformToMySQLDDL(schema, { ifNotExists: true });
        await connection.execute(ddl);

        const userId1 = generateTestUUID('3001');
        const userId2 = generateTestUUID('3002');

        await insertRecord(
          connection,
          'UniqueTestUserMySQL',
          { id: userId1, email: 'unique@example.com' },
          { id: userId1, type: 'UniqueTestUserMySQL' }
        );

        await expect(
          insertRecord(
            connection,
            'UniqueTestUserMySQL',
            { id: userId2, email: 'unique@example.com' },
            { id: userId2, type: 'UniqueTestUserMySQL' }
          )
        ).rejects.toThrow(/Duplicate entry|UNIQUE constraint/i);
      });
    });

    describe('NOT NULL Constraints', () => {
      it('should enforce NOT NULL constraints', async () => {
        const schema = parseSchema({
          $type: 'NotNullTestUserMySQL',
          id: 'uuid!',
          requiredField: 'string!',
        });

        const ddl = transformToMySQLDDL(schema, { ifNotExists: true });
        await connection.execute(ddl);

        const userId = generateTestUUID('3003');
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

    describe('CHECK Constraints', () => {
      it('should enforce CHECK constraints (MySQL 8.0.16+)', async () => {
        // Create table with CHECK constraint manually (since IceType doesn't generate them yet)
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS CheckConstraintTest (
            \`$id\` VARCHAR(255) NOT NULL,
            \`$type\` VARCHAR(255) NOT NULL,
            \`$version\` INT NOT NULL,
            \`$createdAt\` BIGINT NOT NULL,
            \`$updatedAt\` BIGINT NOT NULL,
            id CHAR(36) NOT NULL,
            age INT,
            CONSTRAINT chk_age CHECK (age >= 0 AND age <= 150),
            PRIMARY KEY (\`$id\`)
          ) ENGINE=InnoDB
        `);

        const userId = generateTestUUID('3004');

        // Valid age should succeed
        await connection.execute(
          `INSERT INTO CheckConstraintTest (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, age)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, 'CheckConstraintTest', 1, Date.now(), Date.now(), userId, 25]
        );

        const userId2 = generateTestUUID('3005');
        // Invalid age should fail
        await expect(
          connection.execute(
            `INSERT INTO CheckConstraintTest (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, age)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId2, 'CheckConstraintTest', 1, Date.now(), Date.now(), userId2, -5]
          )
        ).rejects.toThrow(/Check constraint.*violated|CONSTRAINT/i);
      });
    });

    describe('DEFAULT Values', () => {
      it('should apply DEFAULT values', async () => {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS DefaultValueTest (
            \`$id\` VARCHAR(255) NOT NULL,
            \`$type\` VARCHAR(255) NOT NULL DEFAULT 'DefaultValueTest',
            \`$version\` INT NOT NULL DEFAULT 1,
            \`$createdAt\` BIGINT NOT NULL,
            \`$updatedAt\` BIGINT NOT NULL,
            id CHAR(36) NOT NULL,
            status VARCHAR(255) NOT NULL DEFAULT 'pending',
            priority INT NOT NULL DEFAULT 0,
            PRIMARY KEY (\`$id\`)
          ) ENGINE=InnoDB
        `);

        const userId = generateTestUUID('3006');
        await connection.execute(
          `INSERT INTO DefaultValueTest (\`$id\`, \`$createdAt\`, \`$updatedAt\`, id)
           VALUES (?, ?, ?, ?)`,
          [userId, Date.now(), Date.now(), userId]
        );

        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT status, priority FROM DefaultValueTest WHERE `$id` = ?',
          [userId]
        );

        expect(rows[0]!.status).toBe('pending');
        expect(rows[0]!.priority).toBe(0);
      });
    });

    describe('Foreign Key Constraints', () => {
      it('should enforce foreign key constraints', async () => {
        // Create parent table
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS FKParent (
            \`$id\` VARCHAR(255) NOT NULL,
            \`$type\` VARCHAR(255) NOT NULL,
            \`$version\` INT NOT NULL,
            \`$createdAt\` BIGINT NOT NULL,
            \`$updatedAt\` BIGINT NOT NULL,
            id CHAR(36) NOT NULL,
            name VARCHAR(255),
            PRIMARY KEY (\`$id\`),
            UNIQUE KEY (id)
          ) ENGINE=InnoDB
        `);

        // Create child table with foreign key
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS FKChild (
            \`$id\` VARCHAR(255) NOT NULL,
            \`$type\` VARCHAR(255) NOT NULL,
            \`$version\` INT NOT NULL,
            \`$createdAt\` BIGINT NOT NULL,
            \`$updatedAt\` BIGINT NOT NULL,
            id CHAR(36) NOT NULL,
            parentId CHAR(36) NOT NULL,
            name VARCHAR(255),
            PRIMARY KEY (\`$id\`),
            CONSTRAINT fk_parent FOREIGN KEY (parentId) REFERENCES FKParent(id)
          ) ENGINE=InnoDB
        `);

        const parentId = generateTestUUID('4001');
        const childId = generateTestUUID('4002');
        const orphanChildId = generateTestUUID('4003');

        // Insert parent
        await connection.execute(
          `INSERT INTO FKParent (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, name)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [parentId, 'FKParent', 1, Date.now(), Date.now(), parentId, 'Parent']
        );

        // Insert child with valid parent reference
        await connection.execute(
          `INSERT INTO FKChild (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, parentId, name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [childId, 'FKChild', 1, Date.now(), Date.now(), childId, parentId, 'Child']
        );

        // Insert child with invalid parent reference should fail
        const invalidParentId = generateTestUUID('9999');
        await expect(
          connection.execute(
            `INSERT INTO FKChild (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, parentId, name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orphanChildId, 'FKChild', 1, Date.now(), Date.now(), orphanChildId, invalidParentId, 'Orphan']
          )
        ).rejects.toThrow(/foreign key constraint|FOREIGN KEY/i);
      });

      it('should support CASCADE delete', async () => {
        // Create parent table
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS CascadeParent (
            \`$id\` VARCHAR(255) NOT NULL,
            id CHAR(36) NOT NULL,
            name VARCHAR(255),
            PRIMARY KEY (\`$id\`),
            UNIQUE KEY (id)
          ) ENGINE=InnoDB
        `);

        // Create child table with CASCADE delete
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS CascadeChild (
            \`$id\` VARCHAR(255) NOT NULL,
            id CHAR(36) NOT NULL,
            parentId CHAR(36) NOT NULL,
            name VARCHAR(255),
            PRIMARY KEY (\`$id\`),
            CONSTRAINT fk_cascade_parent FOREIGN KEY (parentId) REFERENCES CascadeParent(id) ON DELETE CASCADE
          ) ENGINE=InnoDB
        `);

        const parentId = generateTestUUID('5001');
        const childId1 = generateTestUUID('5002');
        const childId2 = generateTestUUID('5003');

        // Insert parent
        await connection.execute(
          `INSERT INTO CascadeParent (\`$id\`, id, name) VALUES (?, ?, ?)`,
          [parentId, parentId, 'Parent']
        );

        // Insert children
        await connection.execute(
          `INSERT INTO CascadeChild (\`$id\`, id, parentId, name) VALUES (?, ?, ?, ?)`,
          [childId1, childId1, parentId, 'Child 1']
        );
        await connection.execute(
          `INSERT INTO CascadeChild (\`$id\`, id, parentId, name) VALUES (?, ?, ?, ?)`,
          [childId2, childId2, parentId, 'Child 2']
        );

        // Delete parent
        await connection.execute(`DELETE FROM CascadeParent WHERE \`$id\` = ?`, [parentId]);

        // Children should be deleted too
        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT * FROM CascadeChild WHERE parentId = ?',
          [parentId]
        );
        expect(rows).toHaveLength(0);
      });
    });
  });

  // ===========================================================================
  // Index Creation Tests
  // ===========================================================================
  describe('Index Creation', () => {
    it('should create indexes with serializeWithIndexes', async () => {
      const schema = parseSchema({
        $type: 'IndexedEntityMySQL',
        id: 'uuid!',
        indexedField: 'string#',
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

    it('should create composite indexes', async () => {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS CompositeIndexTest (
          \`$id\` VARCHAR(255) NOT NULL,
          firstName VARCHAR(255),
          lastName VARCHAR(255),
          email VARCHAR(255),
          PRIMARY KEY (\`$id\`),
          INDEX idx_name (firstName, lastName),
          INDEX idx_email (email)
        ) ENGINE=InnoDB
      `);

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SHOW INDEX FROM CompositeIndexTest
        WHERE Key_name = 'idx_name'
      `);

      expect(rows).toHaveLength(2); // Two columns in composite index
    });
  });

  // ===========================================================================
  // Schema with Various Types Tests
  // ===========================================================================
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

      const columns = await getColumnInfo(connection, 'AllTypesTestMySQL', DATABASE_NAME);
      const columnMap = new Map(
        columns.map((r: mysql.RowDataPacket) => [r.COLUMN_NAME, r.DATA_TYPE])
      );

      expect(columnMap.get('stringField')).toBe('varchar');
      expect(columnMap.get('textField')).toBe('text');
      expect(columnMap.get('intField')).toBe('int');
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

      const userId = generateTestUUID('6001');
      const jsonData = { key: 'value', nested: { a: 1, b: 2 }, array: [1, 2, 3] };

      await insertRecord(
        connection,
        'JsonTestMySQL',
        { id: userId, metadata: JSON.stringify(jsonData) },
        { id: userId, type: 'JsonTestMySQL' }
      );

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT metadata FROM JsonTestMySQL WHERE `$id` = ?',
        [userId]
      );

      expect(rows[0]!.metadata).toEqual(jsonData);
    });

    it('should support JSON path queries', async () => {
      const userId1 = generateTestUUID('6002');
      const userId2 = generateTestUUID('6003');

      await insertRecord(
        connection,
        'JsonTestMySQL',
        { id: userId1, metadata: JSON.stringify({ status: 'active', score: 100 }) },
        { id: userId1, type: 'JsonTestMySQL' }
      );
      await insertRecord(
        connection,
        'JsonTestMySQL',
        { id: userId2, metadata: JSON.stringify({ status: 'inactive', score: 50 }) },
        { id: userId2, type: 'JsonTestMySQL' }
      );

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT \`$id\`, JSON_EXTRACT(metadata, '$.status') as status
         FROM JsonTestMySQL
         WHERE JSON_EXTRACT(metadata, '$.score') > 75`
      );

      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.find((r: mysql.RowDataPacket) => r['$id'] === userId1)).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Cases Tests
  // ===========================================================================
  describe('Edge Cases', () => {
    describe('Unicode and Special Characters', () => {
      it('should handle Unicode characters in data', async () => {
        const schema = parseSchema({
          $type: 'UnicodeTestMySQL',
          id: 'uuid!',
          name: 'string',
          description: 'text',
        });

        const ddl = transformToMySQLDDL(schema, {
          ifNotExists: true,
          charset: 'utf8mb4',
          collation: 'utf8mb4_unicode_ci'
        });
        await connection.execute(ddl);

        const userId = generateTestUUID('7001');
        const unicodeData = {
          id: userId,
          name: '\u4e2d\u6587\u540d\u5b57',
          description: 'Emoji test: \u{1F600}\u{1F389}\u{1F680} and Japanese: \u3053\u3093\u306b\u3061\u306f'
        };

        await insertRecord(
          connection,
          'UnicodeTestMySQL',
          unicodeData,
          { id: userId, type: 'UnicodeTestMySQL' }
        );

        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT name, description FROM UnicodeTestMySQL WHERE `$id` = ?',
          [userId]
        );

        expect(rows[0]!.name).toBe(unicodeData.name);
        expect(rows[0]!.description).toBe(unicodeData.description);
      });

      it('should handle special characters in strings', async () => {
        const userId = generateTestUUID('7002');
        const specialChars = {
          id: userId,
          name: "O'Brien",
          description: 'Test with "quotes", \\backslash, and \nnewline'
        };

        await insertRecord(
          connection,
          'UnicodeTestMySQL',
          specialChars,
          { id: userId, type: 'UnicodeTestMySQL' }
        );

        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT name, description FROM UnicodeTestMySQL WHERE `$id` = ?',
          [userId]
        );

        expect(rows[0]!.name).toBe(specialChars.name);
        expect(rows[0]!.description).toBe(specialChars.description);
      });
    });

    describe('NULL Handling', () => {
      it('should correctly store and retrieve NULL values', async () => {
        // Create a schema that allows nullable fields for this test
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS NullableFieldsTest (
            \`$id\` VARCHAR(255) NOT NULL,
            \`$type\` VARCHAR(255) NOT NULL,
            \`$version\` INT NOT NULL,
            \`$createdAt\` BIGINT NOT NULL,
            \`$updatedAt\` BIGINT NOT NULL,
            id CHAR(36) NOT NULL,
            name VARCHAR(255),
            age INT,
            PRIMARY KEY (\`$id\`)
          ) ENGINE=InnoDB
        `);

        const userId = generateTestUUID('7003');

        await connection.execute(
          `INSERT INTO NullableFieldsTest (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, name, age)
           VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
          [userId, 'NullableFieldsTest', 1, Date.now(), Date.now(), userId]
        );

        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT name, age FROM NullableFieldsTest WHERE `$id` = ?',
          [userId]
        );

        expect(rows[0]!.name).toBeNull();
        expect(rows[0]!.age).toBeNull();
      });

      it('should handle NULL in comparisons correctly', async () => {
        // Use the table created in the previous test that allows NULLs
        const userId1 = generateTestUUID('7004');
        const userId2 = generateTestUUID('7005');

        await connection.execute(
          `INSERT INTO NullableFieldsTest (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, name, age)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
          [userId1, 'NullableFieldsTest', 1, Date.now(), Date.now(), userId1, 'User 1']
        );
        await connection.execute(
          `INSERT INTO NullableFieldsTest (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, name, age)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId2, 'NullableFieldsTest', 1, Date.now(), Date.now(), userId2, 'User 2', 25]
        );

        // IS NULL
        const [nullRows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT * FROM NullableFieldsTest WHERE `$id` IN (?, ?) AND age IS NULL',
          [userId1, userId2]
        );
        expect(nullRows).toHaveLength(1);
        expect(nullRows[0]!['$id']).toBe(userId1);

        // IS NOT NULL
        const [notNullRows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT * FROM NullableFieldsTest WHERE `$id` IN (?, ?) AND age IS NOT NULL',
          [userId1, userId2]
        );
        expect(notNullRows).toHaveLength(1);
        expect(notNullRows[0]!['$id']).toBe(userId2);
      });
    });

    describe('Large Data', () => {
      it('should handle large TEXT fields', async () => {
        const schema = parseSchema({
          $type: 'LargeDataTestMySQL',
          id: 'uuid!',
          content: 'text',
        });

        const ddl = transformToMySQLDDL(schema, { ifNotExists: true });
        await connection.execute(ddl);

        const userId = generateTestUUID('7006');
        const largeContent = 'A'.repeat(50000); // 50KB of text

        await insertRecord(
          connection,
          'LargeDataTestMySQL',
          { id: userId, content: largeContent },
          { id: userId, type: 'LargeDataTestMySQL' }
        );

        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT LENGTH(content) as len FROM LargeDataTestMySQL WHERE `$id` = ?',
          [userId]
        );

        expect(rows[0]!.len).toBe(50000);
      });

      it('should handle batch inserts efficiently', async () => {
        const userIds: string[] = [];
        const batchSize = 100;

        const values: unknown[] = [];
        const placeholders: string[] = [];

        for (let i = 0; i < batchSize; i++) {
          const userId = generateTestUUID(`8${i.toString().padStart(3, '0')}`);
          userIds.push(userId);
          placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?)');
          values.push(
            userId, 'SimpleUser', 1, Date.now(), Date.now(),
            userId, `batch${i}@test.com`, `Batch User ${i}`, 1
          );
        }

        const startTime = Date.now();
        await connection.execute(
          `INSERT INTO SimpleUser (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, email, name, isActive)
           VALUES ${placeholders.join(', ')}`,
          values
        );
        const duration = Date.now() - startTime;

        const [countRows] = await connection.execute<mysql.RowDataPacket[]>(
          `SELECT COUNT(*) as count FROM SimpleUser WHERE email LIKE 'batch%@test.com'`
        );

        expect(countRows[0]!.count).toBe(batchSize);
        expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

        // Cleanup
        await connection.execute(`DELETE FROM SimpleUser WHERE email LIKE 'batch%@test.com'`);
      });
    });

    describe('Boundary Values', () => {
      it('should handle integer boundary values', async () => {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS BoundaryTestMySQL (
            \`$id\` VARCHAR(255) NOT NULL,
            intValue INT,
            bigintValue BIGINT,
            PRIMARY KEY (\`$id\`)
          ) ENGINE=InnoDB
        `);

        const userId1 = generateTestUUID('9001');
        const userId2 = generateTestUUID('9002');

        // INT max/min
        await connection.execute(
          `INSERT INTO BoundaryTestMySQL (\`$id\`, intValue, bigintValue) VALUES (?, ?, ?)`,
          [userId1, 2147483647, 9223372036854775807n]
        );
        await connection.execute(
          `INSERT INTO BoundaryTestMySQL (\`$id\`, intValue, bigintValue) VALUES (?, ?, ?)`,
          [userId2, -2147483648, -9223372036854775808n]
        );

        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT * FROM BoundaryTestMySQL WHERE `$id` IN (?, ?)',
          [userId1, userId2]
        );

        const maxRow = rows.find((r: mysql.RowDataPacket) => r['$id'] === userId1);
        const minRow = rows.find((r: mysql.RowDataPacket) => r['$id'] === userId2);

        expect(maxRow!.intValue).toBe(2147483647);
        expect(minRow!.intValue).toBe(-2147483648);
      });

      it('should handle decimal precision correctly', async () => {
        const userId = generateTestUUID('9003');

        await connection.execute(
          `INSERT INTO SimpleProduct (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, name, sku, description, price, inventory)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, 'SimpleProduct', 1, Date.now(), Date.now(), userId, 'Test Product', 'SKU-TEST-9003', 'Test description', '99999999.99', 100]
        );

        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT price FROM SimpleProduct WHERE `$id` = ?',
          [userId]
        );

        expect(parseFloat(rows[0]!.price)).toBe(99999999.99);

        // Cleanup
        await connection.execute('DELETE FROM SimpleProduct WHERE `$id` = ?', [userId]);
      });

      it('should handle empty strings', async () => {
        const userId = generateTestUUID('9004');

        await connection.execute(
          `INSERT INTO SimpleUser (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, email, name, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, 'SimpleUser', 1, Date.now(), Date.now(), userId, 'empty@test.com', '', 1]
        );

        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
          'SELECT name FROM SimpleUser WHERE `$id` = ?',
          [userId]
        );

        expect(rows[0]!.name).toBe('');

        // Cleanup
        await connection.execute('DELETE FROM SimpleUser WHERE `$id` = ?', [userId]);
      });
    });
  });

  // ===========================================================================
  // Connection Pooling Tests
  // ===========================================================================
  describe('Connection Pooling', () => {
    let pool: mysql.Pool;

    beforeAll(() => {
      pool = mysql.createPool({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getUserPassword(),
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0,
      });
    });

    afterAll(async () => {
      if (pool) {
        await pool.end();
      }
    });

    it('should execute queries using connection pool', async () => {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT 1 + 1 as result'
      );
      expect(rows[0]!.result).toBe(2);
    });

    it('should handle concurrent queries from pool', async () => {
      const queries = Array.from({ length: 20 }, (_, i) =>
        pool.execute<mysql.RowDataPacket[]>(`SELECT ${i} as num`)
      );

      const results = await Promise.all(queries);

      results.forEach((result, i) => {
        const [rows] = result;
        expect(rows[0]!.num).toBe(i);
      });
    });

    it('should release connections back to pool', async () => {
      // Get a connection from pool
      const conn = await pool.getConnection();

      // Execute a query
      const [rows] = await conn.execute<mysql.RowDataPacket[]>('SELECT 1 as test');
      expect(rows[0]!.test).toBe(1);

      // Release connection back to pool
      conn.release();

      // Should be able to get another connection
      const conn2 = await pool.getConnection();
      const [rows2] = await conn2.execute<mysql.RowDataPacket[]>('SELECT 2 as test');
      expect(rows2[0]!.test).toBe(2);
      conn2.release();
    });

    it('should handle pool connection timeout gracefully', async () => {
      // Create a small pool to test limits
      const smallPool = mysql.createPool({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getUserPassword(),
        connectionLimit: 2,
        waitForConnections: true,
        queueLimit: 0,
      });

      try {
        // Get all connections
        const conn1 = await smallPool.getConnection();
        const conn2 = await smallPool.getConnection();

        // Third connection should wait
        const conn3Promise = smallPool.getConnection();

        // Release one connection to allow the third to proceed
        conn1.release();

        const conn3 = await conn3Promise;
        expect(conn3).toBeDefined();

        conn2.release();
        conn3.release();
      } finally {
        await smallPool.end();
      }
    });

    it('should support prepared statements with pool', async () => {
      const userId = generateTestUUID('P001');

      // Insert using prepared statement
      await pool.execute(
        `INSERT INTO SimpleUser (\`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`, id, email, name, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, 'SimpleUser', 1, Date.now(), Date.now(), userId, 'pool@test.com', 'Pool User', 1]
      );

      // Read using prepared statement
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM SimpleUser WHERE `$id` = ?',
        [userId]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]!.email).toBe('pool@test.com');

      // Cleanup
      await pool.execute('DELETE FROM SimpleUser WHERE `$id` = ?', [userId]);
    });
  });

  // ===========================================================================
  // Engine and Charset Options Tests
  // ===========================================================================
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

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT ENGINE, TABLE_COLLATION
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'EngineTestMySQL'
      `, [DATABASE_NAME]);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.ENGINE).toBe('InnoDB');
      expect(rows[0]!.TABLE_COLLATION).toBe('utf8mb4_unicode_ci');
    });

    it('should support different storage engines', async () => {
      // Test MEMORY engine (for temporary data)
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS MemoryEngineTest (
          id INT AUTO_INCREMENT,
          data VARCHAR(255),
          PRIMARY KEY (id)
        ) ENGINE=MEMORY
      `);

      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT ENGINE
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'MemoryEngineTest'
      `, [DATABASE_NAME]);

      expect(rows[0]!.ENGINE).toBe('MEMORY');
    });
  });
});
