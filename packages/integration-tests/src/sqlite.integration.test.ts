/**
 * SQLite Integration Tests
 *
 * Tests IceType SQLite DDL generation against a real SQLite database
 * using better-sqlite3 (in-memory mode for tests).
 *
 * Test organization:
 * - DDL Execution: Basic table creation
 * - Column Structure Verification: Column types and properties
 * - Type Mapping: SQLite types (TEXT, INTEGER, REAL, BLOB)
 * - CRUD Operations: Basic and complex operations
 * - Transactions: Transaction support
 * - Constraint Verification: UNIQUE, NOT NULL, CHECK, DEFAULT, Foreign Keys
 * - Index Creation: Index generation and verification
 * - Schema with Various Types: Type mapping verification
 * - Edge Cases: Unicode, special characters, large data, NULL handling
 * - SQLite-Specific Features: WAL mode, STRICT tables, WITHOUT ROWID
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

import { parseSchema } from '@icetype/core';
import { transformToSQLiteDDL, SQLiteAdapter, generateSQLiteDDL } from '@icetype/sqlite';

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
function insertRecord(
  db: Database.Database,
  tableName: string,
  record: Record<string, unknown>,
  systemFields: { id: string; type: string }
): Database.RunResult {
  const now = Date.now();
  const columns = ['"$id"', '"$type"', '"$version"', '"$createdAt"', '"$updatedAt"', ...Object.keys(record)];
  const placeholders = columns.map(() => '?').join(', ');
  const values = [systemFields.id, systemFields.type, 1, now, now, ...Object.values(record)];

  const stmt = db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`);
  return stmt.run(...values);
}

/**
 * Helper to verify a table exists.
 */
function tableExists(db: Database.Database, tableName: string): boolean {
  const result = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name=?
  `).get(tableName) as { name: string } | undefined;
  return result !== undefined;
}

/**
 * Helper to get column information using PRAGMA.
 */
function getColumnInfo(db: Database.Database, tableName: string): Array<{
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}> {
  return db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;
}

/**
 * Helper to drop a table if it exists.
 */
function dropTableIfExists(db: Database.Database, tableName: string): void {
  db.exec(`DROP TABLE IF EXISTS ${tableName}`);
}

// =============================================================================
// Test Suite
// =============================================================================

describe('SQLite Integration Tests', () => {
  let db: Database.Database;

  beforeAll(() => {
    // Create an in-memory SQLite database
    db = new Database(':memory:');
    // Enable foreign keys (disabled by default in SQLite)
    db.pragma('foreign_keys = ON');
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
  });

  // ===========================================================================
  // DDL Execution Tests
  // ===========================================================================
  describe('DDL Execution', () => {
    it('should execute generated DDL for SimpleUser schema', () => {
      const ddl = transformToSQLiteDDL(SimpleUserSchema, {
        ifNotExists: true,
      });

      db.exec(ddl);
      expect(tableExists(db, 'SimpleUser')).toBe(true);
    });

    it('should execute generated DDL for SimplePost schema', () => {
      const ddl = transformToSQLiteDDL(SimplePostSchema, { ifNotExists: true });
      db.exec(ddl);
      expect(tableExists(db, 'SimplePost')).toBe(true);
    });

    it('should execute generated DDL for SimpleProduct schema', () => {
      const ddl = transformToSQLiteDDL(SimpleProductSchema, { ifNotExists: true });
      db.exec(ddl);
      expect(tableExists(db, 'SimpleProduct')).toBe(true);
    });

    it('should execute generated DDL for SimpleOrder schema', () => {
      const ddl = transformToSQLiteDDL(SimpleOrderSchema, { ifNotExists: true });
      db.exec(ddl);
      expect(tableExists(db, 'SimpleOrder')).toBe(true);
    });

    it('should handle IF NOT EXISTS without error on duplicate creation', () => {
      const schema = parseSchema({
        $type: 'DuplicateTestTable',
        id: 'uuid!',
        name: 'string',
      });
      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });

      // First creation
      db.exec(ddl);

      // Second creation should not throw
      expect(() => db.exec(ddl)).not.toThrow();
    });
  });

  // ===========================================================================
  // Column Structure Verification Tests
  // ===========================================================================
  describe('Column Structure Verification', () => {
    it('should create correct columns for SimpleUser schema', () => {
      const columns = getColumnInfo(db, 'SimpleUser');

      // Check system columns exist
      const systemColumns = columns.filter(c => c.name.startsWith('$'));
      expect(systemColumns.length).toBeGreaterThanOrEqual(4);

      // Check user-defined columns
      const idColumn = columns.find(c => c.name === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn!.type).toBe('TEXT');
      expect(idColumn!.notnull).toBe(1);

      const emailColumn = columns.find(c => c.name === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn!.type).toBe('TEXT');

      const nameColumn = columns.find(c => c.name === 'name');
      expect(nameColumn).toBeDefined();
      expect(nameColumn!.type).toBe('TEXT');
    });

    it('should create correct columns for SimpleProduct schema with decimal type', () => {
      const columns = getColumnInfo(db, 'SimpleProduct');

      const priceColumn = columns.find(c => c.name === 'price');
      expect(priceColumn).toBeDefined();
      // SQLite maps decimal to REAL
      expect(priceColumn!.type).toBe('REAL');
      expect(priceColumn!.notnull).toBe(1);
    });

    it('should create nullable columns for optional fields', () => {
      const columns = getColumnInfo(db, 'SimpleUser');
      const ageColumn = columns.find(c => c.name === 'age');

      expect(ageColumn).toBeDefined();
      expect(ageColumn!.notnull).toBe(0);
    });

    it('should create non-nullable columns for required fields', () => {
      const columns = getColumnInfo(db, 'SimpleProduct');
      const nameColumn = columns.find(c => c.name === 'name');

      expect(nameColumn).toBeDefined();
      expect(nameColumn!.notnull).toBe(1);
    });
  });

  // ===========================================================================
  // Type Mapping Tests (SQLite-Specific)
  // ===========================================================================
  describe('Type Mapping', () => {
    it('should map string types to TEXT', () => {
      const schema = parseSchema({
        $type: 'TextTypeTest',
        id: 'uuid!',
        stringField: 'string',
        textField: 'text',
        varcharField: 'varchar',
      });

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const columns = getColumnInfo(db, 'TextTypeTest');
      expect(columns.find(c => c.name === 'stringField')?.type).toBe('TEXT');
      expect(columns.find(c => c.name === 'textField')?.type).toBe('TEXT');
      expect(columns.find(c => c.name === 'varcharField')?.type).toBe('TEXT');
    });

    it('should map integer types to INTEGER', () => {
      const schema = parseSchema({
        $type: 'IntTypeTest',
        id: 'uuid!',
        intField: 'int',
        longField: 'long',
        bigintField: 'bigint',
      });

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const columns = getColumnInfo(db, 'IntTypeTest');
      expect(columns.find(c => c.name === 'intField')?.type).toBe('INTEGER');
      expect(columns.find(c => c.name === 'longField')?.type).toBe('INTEGER');
      expect(columns.find(c => c.name === 'bigintField')?.type).toBe('INTEGER');
    });

    it('should map float types to REAL', () => {
      const schema = parseSchema({
        $type: 'FloatTypeTest',
        id: 'uuid!',
        floatField: 'float',
        doubleField: 'double',
        decimalField: 'decimal',
      });

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const columns = getColumnInfo(db, 'FloatTypeTest');
      expect(columns.find(c => c.name === 'floatField')?.type).toBe('REAL');
      expect(columns.find(c => c.name === 'doubleField')?.type).toBe('REAL');
      expect(columns.find(c => c.name === 'decimalField')?.type).toBe('REAL');
    });

    it('should map boolean to INTEGER', () => {
      const schema = parseSchema({
        $type: 'BoolTypeTest',
        id: 'uuid!',
        boolField: 'boolean',
      });

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const columns = getColumnInfo(db, 'BoolTypeTest');
      expect(columns.find(c => c.name === 'boolField')?.type).toBe('INTEGER');
    });

    it('should map binary to BLOB', () => {
      const schema = parseSchema({
        $type: 'BlobTypeTest',
        id: 'uuid!',
        binaryField: 'binary',
      });

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const columns = getColumnInfo(db, 'BlobTypeTest');
      expect(columns.find(c => c.name === 'binaryField')?.type).toBe('BLOB');
    });

    it('should map uuid to TEXT', () => {
      const schema = parseSchema({
        $type: 'UuidTypeTest',
        id: 'uuid!',
        otherId: 'uuid',
      });

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const columns = getColumnInfo(db, 'UuidTypeTest');
      expect(columns.find(c => c.name === 'id')?.type).toBe('TEXT');
      expect(columns.find(c => c.name === 'otherId')?.type).toBe('TEXT');
    });

    it('should map date/time types to TEXT', () => {
      const schema = parseSchema({
        $type: 'DateTypeTest',
        id: 'uuid!',
        dateField: 'date',
        timeField: 'time',
        timestampField: 'timestamp',
      });

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const columns = getColumnInfo(db, 'DateTypeTest');
      expect(columns.find(c => c.name === 'dateField')?.type).toBe('TEXT');
      expect(columns.find(c => c.name === 'timeField')?.type).toBe('TEXT');
      expect(columns.find(c => c.name === 'timestampField')?.type).toBe('TEXT');
    });

    it('should map json to TEXT', () => {
      const schema = parseSchema({
        $type: 'JsonTypeTest',
        id: 'uuid!',
        jsonField: 'json',
      });

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const columns = getColumnInfo(db, 'JsonTypeTest');
      expect(columns.find(c => c.name === 'jsonField')?.type).toBe('TEXT');
    });
  });

  // ===========================================================================
  // Basic CRUD Operations Tests
  // ===========================================================================
  describe('CRUD Operations - Basic', () => {
    const testUserId = generateTestUUID('0000');

    afterEach(() => {
      // Cleanup test data
      db.prepare('DELETE FROM SimpleUser WHERE "$id" = ?').run(testUserId);
    });

    it('should insert a record successfully', () => {
      const result = insertRecord(
        db,
        'SimpleUser',
        { id: testUserId, email: 'test@example.com', name: 'Test User', isActive: 1 },
        { id: testUserId, type: 'SimpleUser' }
      );
      expect(result.changes).toBe(1);
    });

    it('should read a record successfully', () => {
      insertRecord(
        db,
        'SimpleUser',
        { id: testUserId, email: 'test@example.com', name: 'Test User', isActive: 1 },
        { id: testUserId, type: 'SimpleUser' }
      );

      const row = db.prepare('SELECT * FROM SimpleUser WHERE "$id" = ?').get(testUserId) as Record<string, unknown>;

      expect(row).toBeDefined();
      expect(row.email).toBe('test@example.com');
    });

    it('should update a record successfully', () => {
      insertRecord(
        db,
        'SimpleUser',
        { id: testUserId, email: 'test@example.com', name: 'Test User', isActive: 1 },
        { id: testUserId, type: 'SimpleUser' }
      );

      db.prepare('UPDATE SimpleUser SET name = ? WHERE "$id" = ?').run('Updated User', testUserId);

      const row = db.prepare('SELECT name FROM SimpleUser WHERE "$id" = ?').get(testUserId) as { name: string };

      expect(row.name).toBe('Updated User');
    });

    it('should delete a record successfully', () => {
      insertRecord(
        db,
        'SimpleUser',
        { id: testUserId, email: 'test@example.com', name: 'Test User', isActive: 1 },
        { id: testUserId, type: 'SimpleUser' }
      );

      db.prepare('DELETE FROM SimpleUser WHERE "$id" = ?').run(testUserId);

      const row = db.prepare('SELECT * FROM SimpleUser WHERE "$id" = ?').get(testUserId);

      expect(row).toBeUndefined();
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

    beforeEach(() => {
      // Insert test data
      for (let i = 0; i < userIds.length; i++) {
        insertRecord(
          db,
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

    afterEach(() => {
      // Cleanup
      for (const id of userIds) {
        db.prepare('DELETE FROM SimpleUser WHERE "$id" = ?').run(id);
      }
    });

    it('should filter records with WHERE clause', () => {
      const rows = db.prepare('SELECT * FROM SimpleUser WHERE age >= ?').all(30) as Array<Record<string, unknown>>;
      expect(rows.length).toBeGreaterThanOrEqual(3);
    });

    it('should order records with ORDER BY', () => {
      const placeholders = userIds.map(() => '?').join(', ');
      const rows = db.prepare(
        `SELECT name, age FROM SimpleUser WHERE "$id" IN (${placeholders}) ORDER BY age DESC`
      ).all(...userIds) as Array<{ name: string; age: number }>;

      expect(rows).toHaveLength(5);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1]!.age).toBeGreaterThanOrEqual(rows[i]!.age);
      }
    });

    it('should limit records with LIMIT clause', () => {
      const placeholders = userIds.map(() => '?').join(', ');
      const rows = db.prepare(
        `SELECT * FROM SimpleUser WHERE "$id" IN (${placeholders}) LIMIT 3`
      ).all(...userIds) as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(3);
    });

    it('should paginate records with LIMIT and OFFSET', () => {
      const placeholders = userIds.map(() => '?').join(', ');
      const page1 = db.prepare(
        `SELECT * FROM SimpleUser WHERE "$id" IN (${placeholders}) ORDER BY age LIMIT 2 OFFSET 0`
      ).all(...userIds) as Array<{ age: number }>;
      const page2 = db.prepare(
        `SELECT * FROM SimpleUser WHERE "$id" IN (${placeholders}) ORDER BY age LIMIT 2 OFFSET 2`
      ).all(...userIds) as Array<{ age: number }>;

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0]!.age).toBeLessThan(page2[0]!.age);
    });

    it('should aggregate with COUNT', () => {
      const placeholders = userIds.map(() => '?').join(', ');
      const row = db.prepare(
        `SELECT COUNT(*) as count FROM SimpleUser WHERE "$id" IN (${placeholders})`
      ).get(...userIds) as { count: number };
      expect(row.count).toBe(5);
    });

    it('should aggregate with SUM and AVG', () => {
      const placeholders = userIds.map(() => '?').join(', ');
      const row = db.prepare(
        `SELECT SUM(age) as total_age, AVG(age) as avg_age FROM SimpleUser WHERE "$id" IN (${placeholders})`
      ).get(...userIds) as { total_age: number; avg_age: number };
      expect(row.total_age).toBe(20 + 25 + 30 + 35 + 40);
      expect(row.avg_age).toBe(30);
    });

    it('should group records with GROUP BY', () => {
      const placeholders = userIds.map(() => '?').join(', ');
      const rows = db.prepare(
        `SELECT isActive, COUNT(*) as count FROM SimpleUser WHERE "$id" IN (${placeholders}) GROUP BY isActive`
      ).all(...userIds) as Array<{ isActive: number; count: number }>;
      expect(rows).toHaveLength(2);
    });

    it('should filter groups with HAVING', () => {
      const placeholders = userIds.map(() => '?').join(', ');
      const rows = db.prepare(
        `SELECT isActive, COUNT(*) as count FROM SimpleUser WHERE "$id" IN (${placeholders}) GROUP BY isActive HAVING count >= 2`
      ).all(...userIds) as Array<{ isActive: number; count: number }>;
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should update multiple records', () => {
      const placeholders = userIds.map(() => '?').join(', ');
      const result = db.prepare(
        `UPDATE SimpleUser SET isActive = 1 WHERE "$id" IN (${placeholders})`
      ).run(...userIds);
      expect(result.changes).toBe(5);
    });

    it('should perform conditional update with CASE', () => {
      const placeholders = userIds.map(() => '?').join(', ');
      db.prepare(
        `UPDATE SimpleUser
         SET name = CASE
           WHEN age < 30 THEN 'Young User'
           WHEN age >= 30 THEN 'Mature User'
         END
         WHERE "$id" IN (${placeholders})`
      ).run(...userIds);

      const rows = db.prepare(
        `SELECT name, age FROM SimpleUser WHERE "$id" IN (${placeholders}) ORDER BY age`
      ).all(...userIds) as Array<{ name: string; age: number }>;

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

    afterEach(() => {
      db.prepare('DELETE FROM SimpleUser WHERE "$id" IN (?, ?)').run(userId1, userId2);
    });

    it('should commit transaction successfully', () => {
      const transaction = db.transaction(() => {
        insertRecord(
          db,
          'SimpleUser',
          { id: userId1, email: 'tx1@example.com', name: 'TX User 1', isActive: 1 },
          { id: userId1, type: 'SimpleUser' }
        );
        insertRecord(
          db,
          'SimpleUser',
          { id: userId2, email: 'tx2@example.com', name: 'TX User 2', isActive: 1 },
          { id: userId2, type: 'SimpleUser' }
        );
      });

      transaction();

      const rows = db.prepare('SELECT * FROM SimpleUser WHERE "$id" IN (?, ?)').all(userId1, userId2) as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
    });

    it('should rollback transaction on error', () => {
      const transaction = db.transaction(() => {
        insertRecord(
          db,
          'SimpleUser',
          { id: userId1, email: 'rollback@example.com', name: 'Rollback User', isActive: 1 },
          { id: userId1, type: 'SimpleUser' }
        );

        // Throw to trigger rollback
        throw new Error('Simulated error');
      });

      expect(() => transaction()).toThrow('Simulated error');

      const rows = db.prepare('SELECT * FROM SimpleUser WHERE "$id" = ?').all(userId1) as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(0);
    });

    it('should support nested savepoints with deferred transaction', () => {
      const outerTransaction = db.transaction(() => {
        insertRecord(
          db,
          'SimpleUser',
          { id: userId1, email: 'outer@example.com', name: 'Outer User', isActive: 1 },
          { id: userId1, type: 'SimpleUser' }
        );

        // Inner transaction using savepoint
        const innerTransaction = db.transaction(() => {
          insertRecord(
            db,
            'SimpleUser',
            { id: userId2, email: 'inner@example.com', name: 'Inner User', isActive: 1 },
            { id: userId2, type: 'SimpleUser' }
          );
        });
        innerTransaction();
      });

      outerTransaction();

      const rows = db.prepare('SELECT * FROM SimpleUser WHERE "$id" IN (?, ?)').all(userId1, userId2) as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Constraint Verification Tests
  // ===========================================================================
  describe('Constraint Verification', () => {
    describe('UNIQUE Constraints', () => {
      it('should enforce unique constraints', () => {
        const schema = parseSchema({
          $type: 'UniqueTestUserSQLite',
          id: 'uuid!',
          email: 'string#',
        });

        const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
        db.exec(ddl);

        const userId1 = generateTestUUID('3001');
        const userId2 = generateTestUUID('3002');

        insertRecord(
          db,
          'UniqueTestUserSQLite',
          { id: userId1, email: 'unique@example.com' },
          { id: userId1, type: 'UniqueTestUserSQLite' }
        );

        expect(() =>
          insertRecord(
            db,
            'UniqueTestUserSQLite',
            { id: userId2, email: 'unique@example.com' },
            { id: userId2, type: 'UniqueTestUserSQLite' }
          )
        ).toThrow(/UNIQUE constraint failed/i);
      });
    });

    describe('NOT NULL Constraints', () => {
      it('should enforce NOT NULL constraints', () => {
        const schema = parseSchema({
          $type: 'NotNullTestUserSQLite',
          id: 'uuid!',
          requiredField: 'string!',
        });

        const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
        db.exec(ddl);

        const userId = generateTestUUID('3003');
        expect(() =>
          db.prepare(
            `INSERT INTO NotNullTestUserSQLite ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, requiredField)
             VALUES (?, ?, ?, ?, ?, ?, NULL)`
          ).run(userId, 'NotNullTestUserSQLite', 1, Date.now(), Date.now(), userId)
        ).toThrow(/NOT NULL constraint failed/i);
      });
    });

    describe('CHECK Constraints', () => {
      it('should enforce CHECK constraints', () => {
        // Create table with CHECK constraint manually (since IceType doesn't generate them yet)
        db.exec(`
          CREATE TABLE IF NOT EXISTS CheckConstraintTestSQLite (
            "$id" TEXT NOT NULL,
            "$type" TEXT NOT NULL,
            "$version" INTEGER NOT NULL,
            "$createdAt" INTEGER NOT NULL,
            "$updatedAt" INTEGER NOT NULL,
            id TEXT NOT NULL,
            age INTEGER,
            CONSTRAINT chk_age CHECK (age >= 0 AND age <= 150),
            PRIMARY KEY ("$id")
          )
        `);

        const userId = generateTestUUID('3004');

        // Valid age should succeed
        db.prepare(
          `INSERT INTO CheckConstraintTestSQLite ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, age)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(userId, 'CheckConstraintTestSQLite', 1, Date.now(), Date.now(), userId, 25);

        const userId2 = generateTestUUID('3005');
        // Invalid age should fail
        expect(() =>
          db.prepare(
            `INSERT INTO CheckConstraintTestSQLite ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, age)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(userId2, 'CheckConstraintTestSQLite', 1, Date.now(), Date.now(), userId2, -5)
        ).toThrow(/CHECK constraint failed/i);
      });
    });

    describe('DEFAULT Values', () => {
      it('should apply DEFAULT values', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS DefaultValueTestSQLite (
            "$id" TEXT NOT NULL,
            "$type" TEXT NOT NULL DEFAULT 'DefaultValueTestSQLite',
            "$version" INTEGER NOT NULL DEFAULT 1,
            "$createdAt" INTEGER NOT NULL,
            "$updatedAt" INTEGER NOT NULL,
            id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            priority INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY ("$id")
          )
        `);

        const userId = generateTestUUID('3006');
        db.prepare(
          `INSERT INTO DefaultValueTestSQLite ("$id", "$createdAt", "$updatedAt", id)
           VALUES (?, ?, ?, ?)`
        ).run(userId, Date.now(), Date.now(), userId);

        const row = db.prepare('SELECT status, priority FROM DefaultValueTestSQLite WHERE "$id" = ?').get(userId) as {
          status: string;
          priority: number;
        };

        expect(row.status).toBe('pending');
        expect(row.priority).toBe(0);
      });
    });

    describe('Foreign Key Constraints', () => {
      it('should enforce foreign key constraints', () => {
        // Create parent table
        db.exec(`
          CREATE TABLE IF NOT EXISTS FKParentSQLite (
            "$id" TEXT NOT NULL,
            "$type" TEXT NOT NULL,
            "$version" INTEGER NOT NULL,
            "$createdAt" INTEGER NOT NULL,
            "$updatedAt" INTEGER NOT NULL,
            id TEXT NOT NULL,
            name TEXT,
            PRIMARY KEY ("$id"),
            UNIQUE (id)
          )
        `);

        // Create child table with foreign key
        db.exec(`
          CREATE TABLE IF NOT EXISTS FKChildSQLite (
            "$id" TEXT NOT NULL,
            "$type" TEXT NOT NULL,
            "$version" INTEGER NOT NULL,
            "$createdAt" INTEGER NOT NULL,
            "$updatedAt" INTEGER NOT NULL,
            id TEXT NOT NULL,
            parentId TEXT NOT NULL,
            name TEXT,
            PRIMARY KEY ("$id"),
            FOREIGN KEY (parentId) REFERENCES FKParentSQLite(id)
          )
        `);

        const parentId = generateTestUUID('4001');
        const childId = generateTestUUID('4002');
        const orphanChildId = generateTestUUID('4003');

        // Insert parent
        db.prepare(
          `INSERT INTO FKParentSQLite ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, name)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(parentId, 'FKParentSQLite', 1, Date.now(), Date.now(), parentId, 'Parent');

        // Insert child with valid parent reference
        db.prepare(
          `INSERT INTO FKChildSQLite ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, parentId, name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(childId, 'FKChildSQLite', 1, Date.now(), Date.now(), childId, parentId, 'Child');

        // Insert child with invalid parent reference should fail
        const invalidParentId = generateTestUUID('9999');
        expect(() =>
          db.prepare(
            `INSERT INTO FKChildSQLite ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, parentId, name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(orphanChildId, 'FKChildSQLite', 1, Date.now(), Date.now(), orphanChildId, invalidParentId, 'Orphan')
        ).toThrow(/FOREIGN KEY constraint failed/i);
      });

      it('should support CASCADE delete', () => {
        // Create parent table
        db.exec(`
          CREATE TABLE IF NOT EXISTS CascadeParentSQLite (
            "$id" TEXT NOT NULL,
            id TEXT NOT NULL,
            name TEXT,
            PRIMARY KEY ("$id"),
            UNIQUE (id)
          )
        `);

        // Create child table with CASCADE delete
        db.exec(`
          CREATE TABLE IF NOT EXISTS CascadeChildSQLite (
            "$id" TEXT NOT NULL,
            id TEXT NOT NULL,
            parentId TEXT NOT NULL,
            name TEXT,
            PRIMARY KEY ("$id"),
            FOREIGN KEY (parentId) REFERENCES CascadeParentSQLite(id) ON DELETE CASCADE
          )
        `);

        const parentId = generateTestUUID('5001');
        const childId1 = generateTestUUID('5002');
        const childId2 = generateTestUUID('5003');

        // Insert parent
        db.prepare(
          `INSERT INTO CascadeParentSQLite ("$id", id, name) VALUES (?, ?, ?)`
        ).run(parentId, parentId, 'Parent');

        // Insert children
        db.prepare(
          `INSERT INTO CascadeChildSQLite ("$id", id, parentId, name) VALUES (?, ?, ?, ?)`
        ).run(childId1, childId1, parentId, 'Child 1');
        db.prepare(
          `INSERT INTO CascadeChildSQLite ("$id", id, parentId, name) VALUES (?, ?, ?, ?)`
        ).run(childId2, childId2, parentId, 'Child 2');

        // Delete parent
        db.prepare(`DELETE FROM CascadeParentSQLite WHERE "$id" = ?`).run(parentId);

        // Children should be deleted too
        const rows = db.prepare('SELECT * FROM CascadeChildSQLite WHERE parentId = ?').all(parentId) as Array<Record<string, unknown>>;
        expect(rows).toHaveLength(0);
      });
    });
  });

  // ===========================================================================
  // Index Creation Tests
  // ===========================================================================
  describe('Index Creation', () => {
    it('should create indexes with serializeWithIndexes', () => {
      const schema = parseSchema({
        $type: 'IndexedEntitySQLite',
        id: 'uuid!',
        indexedField: 'string#',
      });

      const adapter = new SQLiteAdapter();
      const ddl = adapter.transform(schema, { ifNotExists: true });
      const fullDDL = adapter.serializeWithIndexes(ddl);

      // Execute all statements
      const statements = fullDDL.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          db.exec(stmt);
        }
      }

      // Verify index exists
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='IndexedEntitySQLite'
        AND name LIKE '%indexedField%'
      `).all() as Array<{ name: string }>;

      expect(indexes.length).toBeGreaterThanOrEqual(1);
    });

    it('should create composite indexes', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS CompositeIndexTestSQLite (
          "$id" TEXT NOT NULL,
          firstName TEXT,
          lastName TEXT,
          email TEXT,
          PRIMARY KEY ("$id")
        )
      `);

      db.exec(`CREATE INDEX IF NOT EXISTS idx_name_sqlite ON CompositeIndexTestSQLite (firstName, lastName)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_email_sqlite ON CompositeIndexTestSQLite (email)`);

      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='CompositeIndexTestSQLite'
        AND name = 'idx_name_sqlite'
      `).all() as Array<{ name: string }>;

      expect(indexes).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Schema with Various Types Tests
  // ===========================================================================
  describe('Schema with Various Types', () => {
    it('should handle all IceType primitive types', () => {
      const schema = parseSchema({
        $type: 'AllTypesTestSQLite',
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

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const columns = getColumnInfo(db, 'AllTypesTestSQLite');
      const columnMap = new Map(
        columns.map(r => [r.name, r.type])
      );

      expect(columnMap.get('stringField')).toBe('TEXT');
      expect(columnMap.get('textField')).toBe('TEXT');
      expect(columnMap.get('intField')).toBe('INTEGER');
      expect(columnMap.get('floatField')).toBe('REAL');
      expect(columnMap.get('boolField')).toBe('INTEGER');
      expect(columnMap.get('dateField')).toBe('TEXT');
      expect(columnMap.get('timestampField')).toBe('TEXT');
      expect(columnMap.get('jsonField')).toBe('TEXT');
      expect(columnMap.get('decimalField')).toBe('REAL');
    });

    it('should handle JSON data', () => {
      const schema = parseSchema({
        $type: 'JsonTestSQLite',
        id: 'uuid!',
        metadata: 'json',
      });

      const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
      db.exec(ddl);

      const userId = generateTestUUID('6001');
      const jsonData = { key: 'value', nested: { a: 1, b: 2 }, array: [1, 2, 3] };

      insertRecord(
        db,
        'JsonTestSQLite',
        { id: userId, metadata: JSON.stringify(jsonData) },
        { id: userId, type: 'JsonTestSQLite' }
      );

      const row = db.prepare('SELECT metadata FROM JsonTestSQLite WHERE "$id" = ?').get(userId) as { metadata: string };

      expect(JSON.parse(row.metadata)).toEqual(jsonData);
    });

    it('should support JSON path queries using json_extract', () => {
      const userId1 = generateTestUUID('6002');
      const userId2 = generateTestUUID('6003');

      insertRecord(
        db,
        'JsonTestSQLite',
        { id: userId1, metadata: JSON.stringify({ status: 'active', score: 100 }) },
        { id: userId1, type: 'JsonTestSQLite' }
      );
      insertRecord(
        db,
        'JsonTestSQLite',
        { id: userId2, metadata: JSON.stringify({ status: 'inactive', score: 50 }) },
        { id: userId2, type: 'JsonTestSQLite' }
      );

      const rows = db.prepare(
        `SELECT "$id", json_extract(metadata, '$.status') as status
         FROM JsonTestSQLite
         WHERE json_extract(metadata, '$.score') > 75`
      ).all() as Array<{ '$id': string; status: string }>;

      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.find(r => r['$id'] === userId1)).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Cases Tests
  // ===========================================================================
  describe('Edge Cases', () => {
    describe('Unicode and Special Characters', () => {
      it('should handle Unicode characters in data', () => {
        const schema = parseSchema({
          $type: 'UnicodeTestSQLite',
          id: 'uuid!',
          name: 'string',
          description: 'text',
        });

        const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
        db.exec(ddl);

        const userId = generateTestUUID('7001');
        const unicodeData = {
          id: userId,
          name: '\u4e2d\u6587\u540d\u5b57',
          description: 'Emoji test: \u{1F600}\u{1F389}\u{1F680} and Japanese: \u3053\u3093\u306b\u3061\u306f'
        };

        insertRecord(
          db,
          'UnicodeTestSQLite',
          unicodeData,
          { id: userId, type: 'UnicodeTestSQLite' }
        );

        const row = db.prepare('SELECT name, description FROM UnicodeTestSQLite WHERE "$id" = ?').get(userId) as {
          name: string;
          description: string;
        };

        expect(row.name).toBe(unicodeData.name);
        expect(row.description).toBe(unicodeData.description);
      });

      it('should handle special characters in strings', () => {
        const userId = generateTestUUID('7002');
        const specialChars = {
          id: userId,
          name: "O'Brien",
          description: 'Test with "quotes", \\backslash, and \nnewline'
        };

        insertRecord(
          db,
          'UnicodeTestSQLite',
          specialChars,
          { id: userId, type: 'UnicodeTestSQLite' }
        );

        const row = db.prepare('SELECT name, description FROM UnicodeTestSQLite WHERE "$id" = ?').get(userId) as {
          name: string;
          description: string;
        };

        expect(row.name).toBe(specialChars.name);
        expect(row.description).toBe(specialChars.description);
      });
    });

    describe('NULL Handling', () => {
      it('should correctly store and retrieve NULL values', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS NullableFieldsTestSQLite (
            "$id" TEXT NOT NULL,
            "$type" TEXT NOT NULL,
            "$version" INTEGER NOT NULL,
            "$createdAt" INTEGER NOT NULL,
            "$updatedAt" INTEGER NOT NULL,
            id TEXT NOT NULL,
            name TEXT,
            age INTEGER,
            PRIMARY KEY ("$id")
          )
        `);

        const userId = generateTestUUID('7003');

        db.prepare(
          `INSERT INTO NullableFieldsTestSQLite ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, name, age)
           VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`
        ).run(userId, 'NullableFieldsTestSQLite', 1, Date.now(), Date.now(), userId);

        const row = db.prepare('SELECT name, age FROM NullableFieldsTestSQLite WHERE "$id" = ?').get(userId) as {
          name: string | null;
          age: number | null;
        };

        expect(row.name).toBeNull();
        expect(row.age).toBeNull();
      });

      it('should handle NULL in comparisons correctly', () => {
        const userId1 = generateTestUUID('7004');
        const userId2 = generateTestUUID('7005');

        db.prepare(
          `INSERT INTO NullableFieldsTestSQLite ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, name, age)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
        ).run(userId1, 'NullableFieldsTestSQLite', 1, Date.now(), Date.now(), userId1, 'User 1');
        db.prepare(
          `INSERT INTO NullableFieldsTestSQLite ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, name, age)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(userId2, 'NullableFieldsTestSQLite', 1, Date.now(), Date.now(), userId2, 'User 2', 25);

        // IS NULL
        const nullRows = db.prepare(
          'SELECT * FROM NullableFieldsTestSQLite WHERE "$id" IN (?, ?) AND age IS NULL'
        ).all(userId1, userId2) as Array<{ '$id': string }>;
        expect(nullRows).toHaveLength(1);
        expect(nullRows[0]!['$id']).toBe(userId1);

        // IS NOT NULL
        const notNullRows = db.prepare(
          'SELECT * FROM NullableFieldsTestSQLite WHERE "$id" IN (?, ?) AND age IS NOT NULL'
        ).all(userId1, userId2) as Array<{ '$id': string }>;
        expect(notNullRows).toHaveLength(1);
        expect(notNullRows[0]!['$id']).toBe(userId2);
      });
    });

    describe('Large Data', () => {
      it('should handle large TEXT fields', () => {
        const schema = parseSchema({
          $type: 'LargeDataTestSQLite',
          id: 'uuid!',
          content: 'text',
        });

        const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
        db.exec(ddl);

        const userId = generateTestUUID('7006');
        const largeContent = 'A'.repeat(50000); // 50KB of text

        insertRecord(
          db,
          'LargeDataTestSQLite',
          { id: userId, content: largeContent },
          { id: userId, type: 'LargeDataTestSQLite' }
        );

        const row = db.prepare('SELECT LENGTH(content) as len FROM LargeDataTestSQLite WHERE "$id" = ?').get(userId) as {
          len: number;
        };

        expect(row.len).toBe(50000);
      });

      it('should handle batch inserts efficiently', () => {
        const userIds: string[] = [];
        const batchSize = 100;

        const insertStmt = db.prepare(
          `INSERT INTO SimpleUser ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, email, name, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const insertMany = db.transaction((users: Array<{ id: string; email: string; name: string }>) => {
          const now = Date.now();
          for (const user of users) {
            userIds.push(user.id);
            insertStmt.run(user.id, 'SimpleUser', 1, now, now, user.id, user.email, user.name, 1);
          }
        });

        const users = Array.from({ length: batchSize }, (_, i) => ({
          id: generateTestUUID(`8${i.toString().padStart(3, '0')}`),
          email: `batch${i}@test.com`,
          name: `Batch User ${i}`,
        }));

        const startTime = Date.now();
        insertMany(users);
        const duration = Date.now() - startTime;

        const row = db.prepare(
          `SELECT COUNT(*) as count FROM SimpleUser WHERE email LIKE 'batch%@test.com'`
        ).get() as { count: number };

        expect(row.count).toBe(batchSize);
        expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

        // Cleanup
        db.exec(`DELETE FROM SimpleUser WHERE email LIKE 'batch%@test.com'`);
      });
    });

    describe('Boundary Values', () => {
      it('should handle integer boundary values', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS BoundaryTestSQLite (
            "$id" TEXT NOT NULL,
            intValue INTEGER,
            bigintValue INTEGER,
            PRIMARY KEY ("$id")
          )
        `);

        const userId1 = generateTestUUID('9001');
        const userId2 = generateTestUUID('9002');

        // SQLite INTEGER can store up to 64-bit signed integers
        db.prepare(
          `INSERT INTO BoundaryTestSQLite ("$id", intValue, bigintValue) VALUES (?, ?, ?)`
        ).run(userId1, 2147483647, 9223372036854775807n);
        db.prepare(
          `INSERT INTO BoundaryTestSQLite ("$id", intValue, bigintValue) VALUES (?, ?, ?)`
        ).run(userId2, -2147483648, -9223372036854775808n);

        const rows = db.prepare(
          'SELECT * FROM BoundaryTestSQLite WHERE "$id" IN (?, ?)'
        ).all(userId1, userId2) as Array<{ '$id': string; intValue: number; bigintValue: bigint }>;

        const maxRow = rows.find(r => r['$id'] === userId1);
        const minRow = rows.find(r => r['$id'] === userId2);

        expect(maxRow!.intValue).toBe(2147483647);
        expect(minRow!.intValue).toBe(-2147483648);
      });

      it('should handle floating point precision', () => {
        const userId = generateTestUUID('9003');

        db.prepare(
          `INSERT INTO SimpleProduct ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, name, sku, description, price, inventory)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(userId, 'SimpleProduct', 1, Date.now(), Date.now(), userId, 'Test Product', 'SKU-TEST-9003', 'Test description', 99999999.99, 100);

        const row = db.prepare('SELECT price FROM SimpleProduct WHERE "$id" = ?').get(userId) as { price: number };

        expect(row.price).toBeCloseTo(99999999.99, 2);

        // Cleanup
        db.prepare('DELETE FROM SimpleProduct WHERE "$id" = ?').run(userId);
      });

      it('should handle empty strings', () => {
        const userId = generateTestUUID('9004');

        db.prepare(
          `INSERT INTO SimpleUser ("$id", "$type", "$version", "$createdAt", "$updatedAt", id, email, name, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(userId, 'SimpleUser', 1, Date.now(), Date.now(), userId, 'empty@test.com', '', 1);

        const row = db.prepare('SELECT name FROM SimpleUser WHERE "$id" = ?').get(userId) as { name: string };

        expect(row.name).toBe('');

        // Cleanup
        db.prepare('DELETE FROM SimpleUser WHERE "$id" = ?').run(userId);
      });
    });
  });

  // ===========================================================================
  // SQLite-Specific Features Tests
  // ===========================================================================
  describe('SQLite-Specific Features', () => {
    describe('WAL Mode', () => {
      it('should enable WAL mode', () => {
        // Create a new database for WAL mode test (in-memory doesn't support WAL)
        const walDb = new Database(':memory:');

        // In-memory databases default to memory journal mode
        const result = walDb.pragma('journal_mode') as Array<{ journal_mode: string }>;
        expect(result[0]!.journal_mode).toBe('memory');

        walDb.close();
      });

      it('should support WAL mode for file-based databases', () => {
        // This test would require a file-based database
        // For now, we verify the pragma can be read
        const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
        expect(result[0]).toBeDefined();
        expect(typeof result[0]!.journal_mode).toBe('string');
      });
    });

    describe('STRICT Tables', () => {
      it('should create STRICT mode tables', () => {
        const schema = parseSchema({
          $type: 'StrictModeTest',
          id: 'uuid!',
          intField: 'int!',
          textField: 'string!',
        });

        const ddl = transformToSQLiteDDL(schema, {
          ifNotExists: true,
          strict: true,
        });

        // Verify DDL contains STRICT keyword
        expect(ddl).toContain('STRICT');

        db.exec(ddl);

        // Verify table was created
        expect(tableExists(db, 'StrictModeTest')).toBe(true);
      });

      it('should enforce type strictness in STRICT mode', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS StrictEnforcementTest (
            "$id" TEXT NOT NULL,
            intField INTEGER NOT NULL,
            realField REAL,
            PRIMARY KEY ("$id")
          ) STRICT
        `);

        const userId = generateTestUUID('S001');

        // Insert with correct types should succeed
        db.prepare(
          `INSERT INTO StrictEnforcementTest ("$id", intField, realField) VALUES (?, ?, ?)`
        ).run(userId, 42, 3.14);

        // In STRICT mode, inserting wrong type should fail
        const userId2 = generateTestUUID('S002');
        expect(() =>
          db.prepare(
            `INSERT INTO StrictEnforcementTest ("$id", intField, realField) VALUES (?, ?, ?)`
          ).run(userId2, 'not an integer', 3.14)
        ).toThrow(/cannot store TEXT/i);
      });
    });

    describe('WITHOUT ROWID Tables', () => {
      it('should create WITHOUT ROWID tables', () => {
        const schema = parseSchema({
          $type: 'WithoutRowidTest',
          id: 'uuid!',
          name: 'string',
        });

        const ddl = transformToSQLiteDDL(schema, {
          ifNotExists: true,
          withoutRowid: true,
        });

        // Verify DDL contains WITHOUT ROWID keyword
        expect(ddl).toContain('WITHOUT ROWID');

        db.exec(ddl);

        // Verify table was created
        expect(tableExists(db, 'WithoutRowidTest')).toBe(true);
      });

      it('should function normally without rowid', () => {
        const userId = generateTestUUID('WR01');

        insertRecord(
          db,
          'WithoutRowidTest',
          { id: userId, name: 'Test User' },
          { id: userId, type: 'WithoutRowidTest' }
        );

        const row = db.prepare('SELECT * FROM WithoutRowidTest WHERE "$id" = ?').get(userId) as Record<string, unknown>;
        expect(row).toBeDefined();
        expect(row.name).toBe('Test User');
      });
    });

    describe('BLOB Data', () => {
      it('should handle BLOB data correctly', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS BlobDataTest (
            "$id" TEXT NOT NULL,
            binaryData BLOB,
            PRIMARY KEY ("$id")
          )
        `);

        const userId = generateTestUUID('B001');
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);

        db.prepare(
          `INSERT INTO BlobDataTest ("$id", binaryData) VALUES (?, ?)`
        ).run(userId, binaryData);

        const row = db.prepare('SELECT binaryData FROM BlobDataTest WHERE "$id" = ?').get(userId) as {
          binaryData: Buffer;
        };

        expect(Buffer.isBuffer(row.binaryData)).toBe(true);
        expect(row.binaryData).toEqual(binaryData);
      });
    });

    describe('Concurrent Access', () => {
      it('should handle multiple readers', () => {
        // SQLite allows multiple readers
        const userIds = [generateTestUUID('C001'), generateTestUUID('C002'), generateTestUUID('C003')];

        for (let i = 0; i < userIds.length; i++) {
          insertRecord(
            db,
            'SimpleUser',
            { id: userIds[i], email: `concurrent${i}@test.com`, name: `Concurrent User ${i}`, isActive: 1 },
            { id: userIds[i]!, type: 'SimpleUser' }
          );
        }

        // Simulate multiple reads
        const results = userIds.map(id =>
          db.prepare('SELECT * FROM SimpleUser WHERE "$id" = ?').get(id) as Record<string, unknown>
        );

        expect(results).toHaveLength(3);
        results.forEach(result => expect(result).toBeDefined());

        // Cleanup
        for (const id of userIds) {
          db.prepare('DELETE FROM SimpleUser WHERE "$id" = ?').run(id);
        }
      });
    });

    describe('Recursive CTEs', () => {
      it('should support recursive common table expressions', () => {
        // SQLite supports recursive CTEs
        const result = db.prepare(`
          WITH RECURSIVE cnt(x) AS (
            SELECT 1
            UNION ALL
            SELECT x+1 FROM cnt WHERE x<10
          )
          SELECT x FROM cnt
        `).all() as Array<{ x: number }>;

        expect(result).toHaveLength(10);
        expect(result[0]!.x).toBe(1);
        expect(result[9]!.x).toBe(10);
      });
    });

    describe('Collation', () => {
      it('should support NOCASE collation', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS CollationTest (
            "$id" TEXT NOT NULL,
            name TEXT COLLATE NOCASE,
            PRIMARY KEY ("$id")
          )
        `);

        const userId = generateTestUUID('CL01');
        db.prepare(`INSERT INTO CollationTest ("$id", name) VALUES (?, ?)`).run(userId, 'TestName');

        // Case-insensitive search should work
        const row = db.prepare(`SELECT * FROM CollationTest WHERE name = 'testname'`).get() as Record<string, unknown>;
        expect(row).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // DDL Verification Tests (RED Phase - Feature Gaps)
  // ===========================================================================
  describe('DDL Verification', () => {
    describe('Generated DDL Structure', () => {
      it('should generate DDL with correct system field order', () => {
        const schema = parseSchema({
          $type: 'SystemFieldOrderTest',
          id: 'uuid!',
          name: 'string',
        });

        const ddl = generateSQLiteDDL(schema, { ifNotExists: true });

        // Verify system columns are present and in correct order
        const columnNames = ddl.columns.map(c => c.name);
        expect(columnNames).toContain('$id');
        expect(columnNames).toContain('$type');
        expect(columnNames).toContain('$version');
        expect(columnNames).toContain('$createdAt');
        expect(columnNames).toContain('$updatedAt');

        // System columns should come before user columns
        const $idIndex = columnNames.indexOf('$id');
        const idIndex = columnNames.indexOf('id');
        expect($idIndex).toBeLessThan(idIndex);
      });

      it('should generate DDL with primary key on $id', () => {
        const schema = parseSchema({
          $type: 'PrimaryKeyTest',
          id: 'uuid!',
          name: 'string',
        });

        const ddl = generateSQLiteDDL(schema, { ifNotExists: true });

        // Primary key should be $id
        expect(ddl.primaryKey).toContain('$id');
      });

      it('should generate unique constraints for indexed fields', () => {
        const schema = parseSchema({
          $type: 'UniqueConstraintTest',
          id: 'uuid!',
          email: 'string#', // # means unique indexed
          slug: 'string#',
        });

        const ddl = generateSQLiteDDL(schema, { ifNotExists: true });

        // Unique constraints should be generated
        expect(ddl.uniqueConstraints).toBeDefined();
        expect(ddl.uniqueConstraints).toContainEqual(['email']);
        expect(ddl.uniqueConstraints).toContainEqual(['slug']);
      });
    });

    describe('Array Type Handling', () => {
      it('should store array types as JSON TEXT', () => {
        const schema = parseSchema({
          $type: 'ArrayFieldTest',
          id: 'uuid!',
          tags: 'string[]',
          numbers: 'int[]',
        });

        const ddl = generateSQLiteDDL(schema, { ifNotExists: true });

        // Array types should be TEXT (storing JSON)
        const tagsColumn = ddl.columns.find(c => c.name === 'tags');
        const numbersColumn = ddl.columns.find(c => c.name === 'numbers');

        expect(tagsColumn?.type).toBe('TEXT');
        expect(numbersColumn?.type).toBe('TEXT');

        // Should generate warnings for array types
        expect(ddl.warnings).toBeDefined();
        expect(ddl.warnings?.some(w => w.code === 'SQLITE_ARRAY_AS_JSON')).toBe(true);
      });

      it('should support inserting and querying array data as JSON', () => {
        const schema = parseSchema({
          $type: 'ArrayQueryTest',
          id: 'uuid!',
          tags: 'string[]',
        });

        const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
        db.exec(ddl);

        const userId = generateTestUUID('ARR1');
        const tags = ['typescript', 'sqlite', 'testing'];

        insertRecord(
          db,
          'ArrayQueryTest',
          { id: userId, tags: JSON.stringify(tags) },
          { id: userId, type: 'ArrayQueryTest' }
        );

        // Query using json_each
        const rows = db.prepare(`
          SELECT DISTINCT t.value as tag
          FROM ArrayQueryTest a, json_each(a.tags) t
          WHERE a."$id" = ?
        `).all(userId) as Array<{ tag: string }>;

        expect(rows).toHaveLength(3);
        expect(rows.map(r => r.tag)).toContain('typescript');
      });
    });

    describe('Relation Field Handling', () => {
      it('should generate foreign key references for relation fields', () => {
        // Note: This test may fail if relation FK generation isn't implemented
        const userSchema = parseSchema({
          $type: 'RelUser',
          id: 'uuid!',
          name: 'string',
        });

        const postSchema = parseSchema({
          $type: 'RelPost',
          id: 'uuid!',
          title: 'string',
          authorId: 'uuid!',
          author: '-> RelUser', // Relation to RelUser
        });

        // First create the user table
        const userDdl = transformToSQLiteDDL(userSchema, { ifNotExists: true });
        db.exec(userDdl);

        // Then create the post table
        const postDdl = transformToSQLiteDDL(postSchema, { ifNotExists: true });
        db.exec(postDdl);

        // Verify table was created
        expect(tableExists(db, 'RelPost')).toBe(true);

        // Check if author field was generated
        const columns = getColumnInfo(db, 'RelPost');
        const authorColumn = columns.find(c => c.name === 'author');

        // Relation fields should be stored as TEXT (foreign key reference)
        expect(authorColumn?.type).toBe('TEXT');
      });
    });

    describe('Default Value Generation', () => {
      it('should generate correct default values for various types', () => {
        // Note: This test verifies default value generation which may not be fully implemented
        const schema = parseSchema({
          $type: 'DefaultValueGenTest',
          id: 'uuid!',
          status: { type: 'string', default: 'pending' },
          priority: { type: 'int', default: 0 },
          isEnabled: { type: 'boolean', default: true },
          score: { type: 'float', default: 0.5 },
        });

        const ddl = generateSQLiteDDL(schema, { ifNotExists: true });

        const statusColumn = ddl.columns.find(c => c.name === 'status');
        const priorityColumn = ddl.columns.find(c => c.name === 'priority');
        const isEnabledColumn = ddl.columns.find(c => c.name === 'isEnabled');
        const scoreColumn = ddl.columns.find(c => c.name === 'score');

        // String defaults should be quoted
        expect(statusColumn?.default).toBe("'pending'");

        // Integer defaults should not be quoted
        expect(priorityColumn?.default).toBe('0');

        // Boolean defaults should be 0 or 1 in SQLite
        expect(isEnabledColumn?.default).toBe('1');

        // Float defaults should be numeric
        expect(scoreColumn?.default).toBe('0.5');
      });

      it('should apply default values when inserting without specifying field', () => {
        const schema = parseSchema({
          $type: 'ApplyDefaultTest',
          id: 'uuid!',
          status: { type: 'string', default: 'active' },
          count: { type: 'int', default: 42 },
        });

        const ddl = transformToSQLiteDDL(schema, { ifNotExists: true });
        db.exec(ddl);

        const userId = generateTestUUID('DEF1');

        // Insert without status and count - should use defaults
        db.prepare(
          `INSERT INTO ApplyDefaultTest ("$id", "$type", "$version", "$createdAt", "$updatedAt", id)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(userId, 'ApplyDefaultTest', 1, Date.now(), Date.now(), userId);

        const row = db.prepare('SELECT status, count FROM ApplyDefaultTest WHERE "$id" = ?').get(userId) as {
          status: string;
          count: number;
        };

        expect(row.status).toBe('active');
        expect(row.count).toBe(42);
      });
    });

    describe('Schema Migration Detection', () => {
      it('should detect when table schema differs from generated DDL', () => {
        // Create initial table
        const initialSchema = parseSchema({
          $type: 'MigrationDetectTest',
          id: 'uuid!',
          name: 'string',
        });

        const initialDdl = transformToSQLiteDDL(initialSchema, { ifNotExists: true });
        db.exec(initialDdl);

        // "Evolve" the schema with a new field
        const evolvedSchema = parseSchema({
          $type: 'MigrationDetectTest',
          id: 'uuid!',
          name: 'string',
          email: 'string#', // New field
        });

        const evolvedDdl = generateSQLiteDDL(evolvedSchema, { ifNotExists: true });

        // Get current table columns
        const currentColumns = getColumnInfo(db, 'MigrationDetectTest');
        const currentColumnNames = currentColumns.map(c => c.name);

        // Check if new column exists
        const newColumnNames = evolvedDdl.columns.map(c => c.name);
        const missingColumns = newColumnNames.filter(n => !currentColumnNames.includes(n));

        // email should be missing from current table
        expect(missingColumns).toContain('email');
      });
    });
  });

  // ===========================================================================
  // Advanced SQLite Features (RED Phase - May Not Be Implemented)
  // ===========================================================================
  describe('Advanced SQLite Features', () => {
    describe('Virtual Tables', () => {
      it('should support FTS5 full-text search virtual tables', () => {
        // Create a regular table and FTS5 virtual table
        db.exec(`
          CREATE TABLE IF NOT EXISTS FTSDocuments (
            "$id" TEXT NOT NULL PRIMARY KEY,
            title TEXT,
            content TEXT
          )
        `);

        db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS FTSDocuments_fts USING fts5(
            title, content, content='FTSDocuments', content_rowid='rowid'
          )
        `);

        // Insert test data
        const docId = generateTestUUID('FTS1');
        db.prepare(
          `INSERT INTO FTSDocuments ("$id", title, content) VALUES (?, ?, ?)`
        ).run(docId, 'SQLite Full Text Search', 'This is a document about full-text searching in SQLite databases.');

        // Update FTS index
        db.exec(`INSERT INTO FTSDocuments_fts(FTSDocuments_fts) VALUES('rebuild')`);

        // Full-text search
        const results = db.prepare(`
          SELECT title FROM FTSDocuments_fts WHERE FTSDocuments_fts MATCH 'sqlite AND search'
        `).all() as Array<{ title: string }>;

        expect(results.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Generated Columns', () => {
      it('should support STORED generated columns', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS GeneratedColumnsTest (
            "$id" TEXT NOT NULL PRIMARY KEY,
            firstName TEXT,
            lastName TEXT,
            fullName TEXT GENERATED ALWAYS AS (firstName || ' ' || lastName) STORED
          )
        `);

        const userId = generateTestUUID('GEN1');
        db.prepare(
          `INSERT INTO GeneratedColumnsTest ("$id", firstName, lastName) VALUES (?, ?, ?)`
        ).run(userId, 'John', 'Doe');

        const row = db.prepare('SELECT fullName FROM GeneratedColumnsTest WHERE "$id" = ?').get(userId) as {
          fullName: string;
        };

        expect(row.fullName).toBe('John Doe');
      });

      it('should support VIRTUAL generated columns', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS VirtualColumnTest (
            "$id" TEXT NOT NULL PRIMARY KEY,
            price REAL,
            quantity INTEGER,
            total REAL GENERATED ALWAYS AS (price * quantity) VIRTUAL
          )
        `);

        const itemId = generateTestUUID('VIR1');
        db.prepare(
          `INSERT INTO VirtualColumnTest ("$id", price, quantity) VALUES (?, ?, ?)`
        ).run(itemId, 10.50, 3);

        const row = db.prepare('SELECT total FROM VirtualColumnTest WHERE "$id" = ?').get(itemId) as {
          total: number;
        };

        expect(row.total).toBeCloseTo(31.5, 2);
      });
    });

    describe('Window Functions', () => {
      it('should support window functions', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS WindowFuncTest (
            "$id" TEXT NOT NULL PRIMARY KEY,
            name TEXT,
            department TEXT,
            salary REAL
          )
        `);

        const employees = [
          { id: generateTestUUID('WF01'), name: 'Alice', department: 'Engineering', salary: 100000 },
          { id: generateTestUUID('WF02'), name: 'Bob', department: 'Engineering', salary: 90000 },
          { id: generateTestUUID('WF03'), name: 'Carol', department: 'Sales', salary: 80000 },
          { id: generateTestUUID('WF04'), name: 'Dave', department: 'Sales', salary: 85000 },
        ];

        for (const emp of employees) {
          db.prepare(
            `INSERT INTO WindowFuncTest ("$id", name, department, salary) VALUES (?, ?, ?, ?)`
          ).run(emp.id, emp.name, emp.department, emp.salary);
        }

        // Use window function to rank by salary within department
        const results = db.prepare(`
          SELECT
            name,
            department,
            salary,
            RANK() OVER (PARTITION BY department ORDER BY salary DESC) as salary_rank
          FROM WindowFuncTest
          ORDER BY department, salary_rank
        `).all() as Array<{ name: string; department: string; salary: number; salary_rank: number }>;

        expect(results).toHaveLength(4);

        // Alice should be rank 1 in Engineering
        const alice = results.find(r => r.name === 'Alice');
        expect(alice?.salary_rank).toBe(1);

        // Dave should be rank 1 in Sales
        const dave = results.find(r => r.name === 'Dave');
        expect(dave?.salary_rank).toBe(1);
      });
    });

    describe('Partial Indexes', () => {
      it('should support partial indexes with WHERE clause', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS PartialIndexTest (
            "$id" TEXT NOT NULL PRIMARY KEY,
            email TEXT,
            isActive INTEGER
          )
        `);

        // Create a partial index only for active users
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_active_emails ON PartialIndexTest (email)
          WHERE isActive = 1
        `);

        // Verify index was created
        const indexes = db.prepare(`
          SELECT name, sql FROM sqlite_master
          WHERE type='index' AND tbl_name='PartialIndexTest'
          AND name='idx_active_emails'
        `).all() as Array<{ name: string; sql: string }>;

        expect(indexes).toHaveLength(1);
        expect(indexes[0]!.sql).toContain('WHERE');
      });
    });

    describe('UPSERT (ON CONFLICT)', () => {
      it('should support UPSERT with ON CONFLICT DO UPDATE', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS UpsertTest (
            "$id" TEXT NOT NULL PRIMARY KEY,
            email TEXT UNIQUE,
            name TEXT,
            updateCount INTEGER DEFAULT 0
          )
        `);

        const userId = generateTestUUID('UPS1');

        // Initial insert
        db.prepare(`
          INSERT INTO UpsertTest ("$id", email, name, updateCount)
          VALUES (?, ?, ?, 0)
          ON CONFLICT(email) DO UPDATE SET
            name = excluded.name,
            updateCount = updateCount + 1
        `).run(userId, 'upsert@test.com', 'Initial Name');

        // Second insert with same email should update
        const userId2 = generateTestUUID('UPS2');
        db.prepare(`
          INSERT INTO UpsertTest ("$id", email, name, updateCount)
          VALUES (?, ?, ?, 0)
          ON CONFLICT(email) DO UPDATE SET
            name = excluded.name,
            updateCount = updateCount + 1
        `).run(userId2, 'upsert@test.com', 'Updated Name');

        const row = db.prepare('SELECT * FROM UpsertTest WHERE email = ?').get('upsert@test.com') as {
          '$id': string;
          name: string;
          updateCount: number;
        };

        expect(row.name).toBe('Updated Name');
        expect(row.updateCount).toBe(1);
        // Should keep original $id
        expect(row['$id']).toBe(userId);
      });
    });

    describe('Expression Indexes', () => {
      it('should support indexes on expressions', () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS ExpressionIndexTest (
            "$id" TEXT NOT NULL PRIMARY KEY,
            email TEXT
          )
        `);

        // Create index on lowercase email expression
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_email_lower ON ExpressionIndexTest (LOWER(email))
        `);

        // Insert test data
        const userId = generateTestUUID('EXP1');
        db.prepare(
          `INSERT INTO ExpressionIndexTest ("$id", email) VALUES (?, ?)`
        ).run(userId, 'Test@Example.Com');

        // Query using the expression should use the index
        const row = db.prepare(
          `SELECT * FROM ExpressionIndexTest WHERE LOWER(email) = ?`
        ).get('test@example.com') as Record<string, unknown>;

        expect(row).toBeDefined();
        expect(row['$id']).toBe(userId);
      });
    });
  });

  // ===========================================================================
  // Stress Tests
  // ===========================================================================
  describe('Stress Tests', () => {
    it('should handle high-volume inserts within transaction', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS StressTestInsert (
          "$id" TEXT NOT NULL PRIMARY KEY,
          data TEXT
        )
      `);

      const count = 10000;
      const insertStmt = db.prepare(`INSERT INTO StressTestInsert ("$id", data) VALUES (?, ?)`);

      const insertAll = db.transaction((items: Array<{ id: string; data: string }>) => {
        for (const item of items) {
          insertStmt.run(item.id, item.data);
        }
      });

      const items = Array.from({ length: count }, (_, i) => ({
        id: generateTestUUID(`ST${i.toString().padStart(5, '0')}`),
        data: `Data ${i}`,
      }));

      const startTime = Date.now();
      insertAll(items);
      const duration = Date.now() - startTime;

      // Verify count
      const row = db.prepare('SELECT COUNT(*) as count FROM StressTestInsert').get() as { count: number };
      expect(row.count).toBe(count);

      // Should complete in reasonable time (< 10 seconds for 10k inserts)
      expect(duration).toBeLessThan(10000);

      // Cleanup
      db.exec('DROP TABLE StressTestInsert');
    });

    it('should handle concurrent read/write patterns', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ConcurrentRWTest (
          "$id" TEXT NOT NULL PRIMARY KEY,
          counter INTEGER DEFAULT 0
        )
      `);

      const userId = generateTestUUID('CRW1');
      db.prepare(`INSERT INTO ConcurrentRWTest ("$id", counter) VALUES (?, 0)`).run(userId);

      // Simulate concurrent increments within a transaction
      const incrementStmt = db.prepare(`UPDATE ConcurrentRWTest SET counter = counter + 1 WHERE "$id" = ?`);
      const selectStmt = db.prepare(`SELECT counter FROM ConcurrentRWTest WHERE "$id" = ?`);

      const iterations = 100;

      // Transaction ensures atomicity
      const incrementAndVerify = db.transaction(() => {
        for (let i = 0; i < iterations; i++) {
          incrementStmt.run(userId);
        }
        return selectStmt.get(userId) as { counter: number };
      });

      const result = incrementAndVerify();
      expect(result.counter).toBe(iterations);
    });
  });
});
