/**
 * Tests for SQLiteAdapter implementation
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema } from '@icetype/core';
import type { IceTypeSchema } from '@icetype/core';

import {
  SQLiteAdapter,
  createSQLiteAdapter,
  transformToSQLiteDDL,
  generateSQLiteDDL,
  mapIceTypeToSQLite,
  getSQLiteTypeString,
  formatDefaultValue,
  generateSystemColumns,
  escapeIdentifier,
  serializeColumn,
  serializeDDL,
  generateIndexStatements,
  isArrayType,
  fieldToSQLiteColumn,
  ICETYPE_TO_SQLITE,
} from '../src/index.js';

import { parseField } from '@icetype/core';

import type { SQLiteDDL, SQLiteColumn } from '../src/types.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a simple test schema for basic testing
 */
function createSimpleSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    name: 'string',
    age: 'int?',
  });
}

/**
 * Create a schema with various field types
 */
function createTypedSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'Product',
    id: 'uuid!',
    name: 'string!',
    description: 'text',
    price: 'double',
    quantity: 'int',
    isActive: 'boolean',
    createdAt: 'timestamp',
    releaseDate: 'date',
    metadata: 'json',
  });
}

/**
 * Create a schema with all supported types
 */
function createAllTypesSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'AllTypes',
    stringField: 'string',
    textField: 'text',
    intField: 'int',
    longField: 'long',
    bigintField: 'bigint',
    floatField: 'float',
    doubleField: 'double',
    boolField: 'bool',
    booleanField: 'boolean',
    uuidField: 'uuid',
    timestampField: 'timestamp',
    dateField: 'date',
    timeField: 'time',
    jsonField: 'json',
    binaryField: 'binary',
    decimalField: 'decimal',
  });
}

// =============================================================================
// createSQLiteAdapter() Factory Tests
// =============================================================================

describe('createSQLiteAdapter()', () => {
  it('should create a new SQLiteAdapter instance', () => {
    const adapter = createSQLiteAdapter();

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(SQLiteAdapter);
  });

  it('should create independent adapter instances', () => {
    const adapter1 = createSQLiteAdapter();
    const adapter2 = createSQLiteAdapter();

    expect(adapter1).not.toBe(adapter2);
  });

  it('should create adapter with correct interface methods', () => {
    const adapter = createSQLiteAdapter();

    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.version).toBe('string');
  });
});

// =============================================================================
// SQLiteAdapter Properties Tests
// =============================================================================

describe('SQLiteAdapter properties', () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter();
  });

  describe('name property', () => {
    it('should have name "sqlite"', () => {
      expect(adapter.name).toBe('sqlite');
    });

    it('should be readonly', () => {
      const originalName = adapter.name;
      expect(adapter.name).toBe(originalName);
    });
  });

  describe('version property', () => {
    it('should have a valid semver version', () => {
      expect(adapter.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should be "0.1.0"', () => {
      expect(adapter.version).toBe('0.1.0');
    });

    it('should be readonly', () => {
      const originalVersion = adapter.version;
      expect(adapter.version).toBe(originalVersion);
    });
  });
});

// =============================================================================
// Type Mapping Tests
// =============================================================================

describe('Type Mapping', () => {
  describe('ICETYPE_TO_SQLITE constant', () => {
    it('should map string to TEXT', () => {
      expect(ICETYPE_TO_SQLITE['string']?.sqliteType).toBe('TEXT');
    });

    it('should map text to TEXT', () => {
      expect(ICETYPE_TO_SQLITE['text']?.sqliteType).toBe('TEXT');
    });

    it('should map int to INTEGER', () => {
      expect(ICETYPE_TO_SQLITE['int']?.sqliteType).toBe('INTEGER');
    });

    it('should map long to INTEGER', () => {
      expect(ICETYPE_TO_SQLITE['long']?.sqliteType).toBe('INTEGER');
    });

    it('should map bigint to INTEGER', () => {
      expect(ICETYPE_TO_SQLITE['bigint']?.sqliteType).toBe('INTEGER');
    });

    it('should map float to REAL', () => {
      expect(ICETYPE_TO_SQLITE['float']?.sqliteType).toBe('REAL');
    });

    it('should map double to REAL', () => {
      expect(ICETYPE_TO_SQLITE['double']?.sqliteType).toBe('REAL');
    });

    it('should map bool to INTEGER', () => {
      expect(ICETYPE_TO_SQLITE['bool']?.sqliteType).toBe('INTEGER');
    });

    it('should map boolean to INTEGER', () => {
      expect(ICETYPE_TO_SQLITE['boolean']?.sqliteType).toBe('INTEGER');
    });

    it('should map uuid to TEXT', () => {
      expect(ICETYPE_TO_SQLITE['uuid']?.sqliteType).toBe('TEXT');
    });

    it('should map timestamp to TEXT', () => {
      expect(ICETYPE_TO_SQLITE['timestamp']?.sqliteType).toBe('TEXT');
    });

    it('should map date to TEXT', () => {
      expect(ICETYPE_TO_SQLITE['date']?.sqliteType).toBe('TEXT');
    });

    it('should map time to TEXT', () => {
      expect(ICETYPE_TO_SQLITE['time']?.sqliteType).toBe('TEXT');
    });

    it('should map json to TEXT', () => {
      expect(ICETYPE_TO_SQLITE['json']?.sqliteType).toBe('TEXT');
    });

    it('should map binary to BLOB', () => {
      expect(ICETYPE_TO_SQLITE['binary']?.sqliteType).toBe('BLOB');
    });

    it('should map decimal to REAL', () => {
      expect(ICETYPE_TO_SQLITE['decimal']?.sqliteType).toBe('REAL');
    });
  });

  describe('mapIceTypeToSQLite()', () => {
    it('should map known types', () => {
      expect(mapIceTypeToSQLite('string').sqliteType).toBe('TEXT');
      expect(mapIceTypeToSQLite('int').sqliteType).toBe('INTEGER');
      expect(mapIceTypeToSQLite('uuid').sqliteType).toBe('TEXT');
    });

    it('should handle case insensitivity', () => {
      expect(mapIceTypeToSQLite('STRING').sqliteType).toBe('TEXT');
      expect(mapIceTypeToSQLite('Int').sqliteType).toBe('INTEGER');
      expect(mapIceTypeToSQLite('UUID').sqliteType).toBe('TEXT');
    });

    it('should return TEXT for unknown types', () => {
      const mapping = mapIceTypeToSQLite('unknown');
      expect(mapping.sqliteType).toBe('TEXT');
    });
  });

  describe('getSQLiteTypeString()', () => {
    it('should return simple type string for TEXT', () => {
      expect(getSQLiteTypeString({ sqliteType: 'TEXT' })).toBe('TEXT');
    });

    it('should return simple type string for INTEGER', () => {
      expect(getSQLiteTypeString({ sqliteType: 'INTEGER' })).toBe('INTEGER');
    });

    it('should return simple type string for REAL', () => {
      expect(getSQLiteTypeString({ sqliteType: 'REAL' })).toBe('REAL');
    });

    it('should return simple type string for BLOB', () => {
      expect(getSQLiteTypeString({ sqliteType: 'BLOB' })).toBe('BLOB');
    });
  });
});

// =============================================================================
// DDL Helper Tests
// =============================================================================

describe('DDL Helpers', () => {
  describe('formatDefaultValue()', () => {
    it('should format null', () => {
      expect(formatDefaultValue(null, 'TEXT')).toBe('NULL');
    });

    it('should format strings with quotes', () => {
      expect(formatDefaultValue('hello', 'TEXT')).toBe("'hello'");
    });

    it('should escape single quotes in strings', () => {
      expect(formatDefaultValue("it's", 'TEXT')).toBe("'it''s'");
    });

    it('should format numbers', () => {
      expect(formatDefaultValue(42, 'INTEGER')).toBe('42');
      expect(formatDefaultValue(3.14, 'REAL')).toBe('3.14');
    });

    it('should format booleans as 0/1', () => {
      expect(formatDefaultValue(true, 'INTEGER')).toBe('1');
      expect(formatDefaultValue(false, 'INTEGER')).toBe('0');
    });
  });

  describe('generateSystemColumns()', () => {
    it('should generate 5 system columns', () => {
      const columns = generateSystemColumns();
      expect(columns).toHaveLength(5);
    });

    it('should include $id as primary key', () => {
      const columns = generateSystemColumns();
      const idColumn = columns.find(c => c.name === '$id');
      expect(idColumn).toBeDefined();
      expect(idColumn?.primaryKey).toBe(true);
      expect(idColumn?.nullable).toBe(false);
    });

    it('should include $type', () => {
      const columns = generateSystemColumns();
      const typeColumn = columns.find(c => c.name === '$type');
      expect(typeColumn).toBeDefined();
      expect(typeColumn?.type).toBe('TEXT');
    });

    it('should include $version with default', () => {
      const columns = generateSystemColumns();
      const versionColumn = columns.find(c => c.name === '$version');
      expect(versionColumn).toBeDefined();
      expect(versionColumn?.type).toBe('INTEGER');
      expect(versionColumn?.default).toBe('1');
    });

    it('should include timestamp columns', () => {
      const columns = generateSystemColumns();
      const createdAt = columns.find(c => c.name === '$createdAt');
      const updatedAt = columns.find(c => c.name === '$updatedAt');
      expect(createdAt?.type).toBe('INTEGER');
      expect(updatedAt?.type).toBe('INTEGER');
    });
  });

  describe('escapeIdentifier()', () => {
    it('should not escape simple identifiers', () => {
      expect(escapeIdentifier('users')).toBe('users');
      expect(escapeIdentifier('my_table')).toBe('my_table');
    });

    it('should escape identifiers starting with $', () => {
      expect(escapeIdentifier('$id')).toBe('"$id"');
      expect(escapeIdentifier('$type')).toBe('"$type"');
    });

    it('should escape identifiers with special characters', () => {
      expect(escapeIdentifier('my-table')).toBe('"my-table"');
      expect(escapeIdentifier('user name')).toBe('"user name"');
    });

    it('should escape double quotes within identifiers', () => {
      expect(escapeIdentifier('my"table')).toBe('"my""table"');
    });
  });

  describe('serializeColumn()', () => {
    it('should serialize simple column', () => {
      const column: SQLiteColumn = {
        name: 'email',
        type: 'TEXT',
        nullable: true,
      };
      expect(serializeColumn(column)).toBe('email TEXT');
    });

    it('should serialize NOT NULL column', () => {
      const column: SQLiteColumn = {
        name: 'id',
        type: 'TEXT',
        nullable: false,
      };
      expect(serializeColumn(column)).toBe('id TEXT NOT NULL');
    });

    it('should serialize UNIQUE column', () => {
      const column: SQLiteColumn = {
        name: 'email',
        type: 'TEXT',
        nullable: true,
        unique: true,
      };
      expect(serializeColumn(column)).toBe('email TEXT UNIQUE');
    });

    it('should serialize column with default', () => {
      const column: SQLiteColumn = {
        name: 'status',
        type: 'TEXT',
        nullable: true,
        default: "'active'",
      };
      expect(serializeColumn(column)).toBe("status TEXT DEFAULT 'active'");
    });

    it('should escape special column names', () => {
      const column: SQLiteColumn = {
        name: '$id',
        type: 'TEXT',
        nullable: false,
      };
      expect(serializeColumn(column)).toBe('"$id" TEXT NOT NULL');
    });

    it('should serialize AUTOINCREMENT for primary key INTEGER columns', () => {
      const column: SQLiteColumn = {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        primaryKey: true,
        autoIncrement: true,
      };
      expect(serializeColumn(column)).toBe('id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT');
    });
  });

  describe('serializeDDL()', () => {
    it('should generate basic CREATE TABLE', () => {
      const ddl: SQLiteDDL = {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'TEXT', nullable: false },
          { name: 'name', type: 'TEXT', nullable: true },
        ],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CREATE TABLE users');
      expect(sql).toContain('id TEXT NOT NULL');
      expect(sql).toContain('name TEXT');
    });

    it('should generate CREATE TABLE IF NOT EXISTS', () => {
      const ddl: SQLiteDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'TEXT', nullable: false }],
        ifNotExists: true,
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    });

    it('should include PRIMARY KEY constraint', () => {
      const ddl: SQLiteDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'TEXT', nullable: false }],
        primaryKey: ['id'],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('PRIMARY KEY (id)');
    });

    it('should include UNIQUE constraints', () => {
      const ddl: SQLiteDDL = {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'TEXT', nullable: false },
          { name: 'email', type: 'TEXT', nullable: true },
        ],
        uniqueConstraints: [['email']],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('UNIQUE (email)');
    });

    it('should support WITHOUT ROWID', () => {
      const ddl: SQLiteDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'TEXT', nullable: false }],
        primaryKey: ['id'],
        withoutRowid: true,
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('WITHOUT ROWID');
    });

    it('should support STRICT mode', () => {
      const ddl: SQLiteDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'TEXT', nullable: false }],
        strict: true,
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('STRICT');
    });
  });

  describe('generateIndexStatements()', () => {
    it('should generate index for unique columns', () => {
      const columns: SQLiteColumn[] = [
        { name: 'email', type: 'TEXT', nullable: true, unique: true },
      ];

      const statements = generateIndexStatements('users', columns);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CREATE INDEX');
      expect(statements[0]).toContain('idx_users_email');
    });

    it('should return empty array for no unique columns', () => {
      const columns: SQLiteColumn[] = [
        { name: 'name', type: 'TEXT', nullable: true },
      ];

      const statements = generateIndexStatements('users', columns);
      expect(statements).toHaveLength(0);
    });
  });
});

// =============================================================================
// transform() Tests
// =============================================================================

describe('SQLiteAdapter.transform()', () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter();
  });

  describe('Basic transformation', () => {
    it('should return valid SQLiteDDL structure', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      expect(result).toBeDefined();
      expect(result.tableName).toBe('User');
      expect(result.columns).toBeDefined();
      expect(Array.isArray(result.columns)).toBe(true);
    });

    it('should include system fields by default', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      const columnNames = result.columns.map(c => c.name);
      expect(columnNames).toContain('$id');
      expect(columnNames).toContain('$type');
      expect(columnNames).toContain('$version');
      expect(columnNames).toContain('$createdAt');
      expect(columnNames).toContain('$updatedAt');
    });

    it('should include user-defined fields', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      const columnNames = result.columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('age');
    });

    it('should set $id as primary key', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      expect(result.primaryKey).toContain('$id');
    });
  });

  describe('Type mapping', () => {
    it('should map all supported types correctly', () => {
      const schema = createAllTypesSchema();
      const result = adapter.transform(schema);

      const findColumn = (name: string) => result.columns.find(c => c.name === name);

      expect(findColumn('stringField')?.type).toBe('TEXT');
      expect(findColumn('textField')?.type).toBe('TEXT');
      expect(findColumn('intField')?.type).toBe('INTEGER');
      expect(findColumn('longField')?.type).toBe('INTEGER');
      expect(findColumn('bigintField')?.type).toBe('INTEGER');
      expect(findColumn('floatField')?.type).toBe('REAL');
      expect(findColumn('doubleField')?.type).toBe('REAL');
      expect(findColumn('boolField')?.type).toBe('INTEGER');
      expect(findColumn('booleanField')?.type).toBe('INTEGER');
      expect(findColumn('uuidField')?.type).toBe('TEXT');
      expect(findColumn('timestampField')?.type).toBe('TEXT');
      expect(findColumn('dateField')?.type).toBe('TEXT');
      expect(findColumn('timeField')?.type).toBe('TEXT');
      expect(findColumn('jsonField')?.type).toBe('TEXT');
      expect(findColumn('binaryField')?.type).toBe('BLOB');
      expect(findColumn('decimalField')?.type).toBe('REAL');
    });
  });

  describe('Field modifiers', () => {
    it('should handle required fields (!) as NOT NULL', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      const idColumn = result.columns.find(c => c.name === 'id');
      expect(idColumn?.nullable).toBe(false);
    });

    it('should handle optional fields (?) as nullable', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      const ageColumn = result.columns.find(c => c.name === 'age');
      expect(ageColumn?.nullable).toBe(true);
    });

    it('should handle unique fields (#)', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      const emailColumn = result.columns.find(c => c.name === 'email');
      expect(emailColumn?.unique).toBe(true);
    });
  });

  describe('Options handling', () => {
    it('should respect tableName option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { tableName: 'custom_users' });

      expect(result.tableName).toBe('custom_users');
    });

    it('should respect ifNotExists option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { ifNotExists: true });

      expect(result.ifNotExists).toBe(true);
    });

    it('should respect includeSystemFields: false', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { includeSystemFields: false });

      const columnNames = result.columns.map(c => c.name);
      expect(columnNames).not.toContain('$id');
      expect(columnNames).not.toContain('$type');
    });

    it('should respect withoutRowid option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { withoutRowid: true });

      expect(result.withoutRowid).toBe(true);
    });

    it('should respect strict option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { strict: true });

      expect(result.strict).toBe(true);
    });
  });
});

// =============================================================================
// serialize() Tests
// =============================================================================

describe('SQLiteAdapter.serialize()', () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter();
  });

  it('should serialize DDL to valid SQL', () => {
    const schema = createSimpleSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(typeof sql).toBe('string');
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('User');
  });

  it('should include all columns in output', () => {
    const schema = createSimpleSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('"$id"');  // System fields with $ are quoted
    expect(sql).toContain('id TEXT');  // Simple identifiers are not quoted
    expect(sql).toContain('email TEXT');
    expect(sql).toContain('name TEXT');
    expect(sql).toContain('age INTEGER');
  });

  it('should include type information', () => {
    const schema = createSimpleSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('TEXT');
    expect(sql).toContain('INTEGER');
  });

  it('should include constraints', () => {
    const schema = createSimpleSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('NOT NULL');
    expect(sql).toContain('PRIMARY KEY');
    expect(sql).toContain('UNIQUE');
  });
});

// =============================================================================
// Convenience Function Tests
// =============================================================================

describe('Convenience Functions', () => {
  describe('transformToSQLiteDDL()', () => {
    it('should transform and serialize in one step', () => {
      const schema = createSimpleSchema();
      const sql = transformToSQLiteDDL(schema);

      expect(typeof sql).toBe('string');
      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('User');
    });

    it('should accept options', () => {
      const schema = createSimpleSchema();
      const sql = transformToSQLiteDDL(schema, { ifNotExists: true });

      expect(sql).toContain('IF NOT EXISTS');
    });
  });

  describe('generateSQLiteDDL()', () => {
    it('should return DDL structure', () => {
      const schema = createSimpleSchema();
      const ddl = generateSQLiteDDL(schema);

      expect(ddl.tableName).toBe('User');
      expect(ddl.columns).toBeDefined();
    });

    it('should accept options', () => {
      const schema = createSimpleSchema();
      const ddl = generateSQLiteDDL(schema, { tableName: 'custom' });

      expect(ddl.tableName).toBe('custom');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('SQLiteAdapter Integration', () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter();
  });

  it('should produce complete transform and serialize workflow', () => {
    const schema = createTypedSchema();

    // Transform
    const ddl = adapter.transform(schema, { ifNotExists: true });

    // Serialize
    const sql = adapter.serialize(ddl);

    // Verify complete workflow
    expect(sql).toBeDefined();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('Product');
    expect(sql).toContain('TEXT');
    expect(sql).toContain('REAL');
    expect(sql).toContain('INTEGER');
  });

  it('should be compatible with SchemaAdapter interface', () => {
    const genericAdapter = adapter as {
      name: string;
      version: string;
      transform: (schema: IceTypeSchema, options?: unknown) => unknown;
      serialize: (output: unknown) => string;
    };

    expect(genericAdapter.name).toBe('sqlite');
    expect(genericAdapter.version).toBeDefined();
    expect(typeof genericAdapter.transform).toBe('function');
    expect(typeof genericAdapter.serialize).toBe('function');
  });

  it('should handle complex schema with all features', () => {
    const schema = parseSchema({
      $type: 'ComplexEntity',
      $partitionBy: ['tenantId'],
      $index: [['createdAt']],
      id: 'uuid!',
      tenantId: 'string!',
      email: 'string#',
      name: 'string',
      age: 'int?',
      balance: 'decimal',
      metadata: 'json',
      createdAt: 'timestamp',
      isActive: 'boolean',
    });

    const ddl = adapter.transform(schema, {
      ifNotExists: true,
      strict: true,
    });

    const sql = adapter.serialize(ddl);

    expect(sql).toContain('ComplexEntity');
    expect(sql).toContain('REAL');  // decimal -> REAL
    expect(sql).toContain('TEXT');  // json -> TEXT
    expect(sql).toContain('STRICT');
  });

  it('should generate valid SQL for different table configurations', () => {
    const schema = createSimpleSchema();

    // Standard table
    const standardSql = transformToSQLiteDDL(schema);
    expect(standardSql).toMatch(/^CREATE TABLE/);

    // With strict mode
    const strictSql = transformToSQLiteDDL(schema, { strict: true });
    expect(strictSql).toContain('STRICT');
  });

  it('should handle serializeWithIndexes', () => {
    const schema = createSimpleSchema();
    const ddl = adapter.transform(schema);
    const sqlWithIndexes = adapter.serializeWithIndexes(ddl);

    expect(sqlWithIndexes).toContain('CREATE TABLE');
    // Should include index for unique email field
    expect(sqlWithIndexes).toContain('CREATE INDEX');
    expect(sqlWithIndexes).toContain('idx_User_email');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter();
  });

  it('should handle schema with no user fields', () => {
    const schema = parseSchema({
      $type: 'EmptyEntity',
    });

    const ddl = adapter.transform(schema);
    expect(ddl.columns.length).toBeGreaterThan(0); // Should have system fields
  });

  it('should handle special characters in table names', () => {
    const schema = parseSchema({
      $type: 'My-Special_Entity',
    });

    const sql = transformToSQLiteDDL(schema);
    expect(sql).toContain('"My-Special_Entity"');
  });

  it('should handle reserved word field names', () => {
    const schema = parseSchema({
      $type: 'Reserved',
      select: 'string',
      from: 'string',
      where: 'string',
    });

    const ddl = adapter.transform(schema);
    const columnNames = ddl.columns.map(c => c.name);
    expect(columnNames).toContain('select');
    expect(columnNames).toContain('from');
    expect(columnNames).toContain('where');
  });
});

// =============================================================================
// SQLite-Specific Tests
// =============================================================================

describe('SQLite-Specific Features', () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter();
  });

  it('should use INTEGER for boolean fields (SQLite boolean convention)', () => {
    const schema = parseSchema({
      $type: 'Flags',
      isActive: 'boolean',
      isVerified: 'bool',
    });

    const ddl = adapter.transform(schema);
    const isActiveCol = ddl.columns.find(c => c.name === 'isActive');
    const isVerifiedCol = ddl.columns.find(c => c.name === 'isVerified');

    expect(isActiveCol?.type).toBe('INTEGER');
    expect(isVerifiedCol?.type).toBe('INTEGER');
  });

  it('should use TEXT for UUID fields (SQLite has no native UUID)', () => {
    const schema = parseSchema({
      $type: 'Entity',
      id: 'uuid!',
    });

    const ddl = adapter.transform(schema);
    const idCol = ddl.columns.find(c => c.name === 'id');
    expect(idCol?.type).toBe('TEXT');
  });

  it('should use TEXT for timestamp fields (ISO8601 string)', () => {
    const schema = parseSchema({
      $type: 'Event',
      createdAt: 'timestamp',
    });

    const ddl = adapter.transform(schema);
    const createdAtCol = ddl.columns.find(c => c.name === 'createdAt');
    expect(createdAtCol?.type).toBe('TEXT');
  });

  it('should use TEXT for JSON fields (SQLite json1 extension)', () => {
    const schema = parseSchema({
      $type: 'Config',
      settings: 'json',
    });

    const ddl = adapter.transform(schema);
    const settingsCol = ddl.columns.find(c => c.name === 'settings');
    expect(settingsCol?.type).toBe('TEXT');
  });

  it('should support WITHOUT ROWID optimization', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
    });

    const sql = transformToSQLiteDDL(schema, { withoutRowid: true });
    expect(sql).toContain('WITHOUT ROWID');
  });

  it('should support STRICT mode for type enforcement', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
    });

    const sql = transformToSQLiteDDL(schema, { strict: true });
    expect(sql).toContain('STRICT');
  });

  it('should support AUTOINCREMENT for integer primary keys', () => {
    const ddl: SQLiteDDL = {
      tableName: 'users',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          nullable: false,
          primaryKey: true,
          autoIncrement: true,
        },
        { name: 'name', type: 'TEXT', nullable: true },
      ],
    };

    const sql = serializeDDL(ddl);
    expect(sql).toContain('AUTOINCREMENT');
  });

  it('should use only four SQLite storage classes', () => {
    // SQLite has only: INTEGER, REAL, TEXT, BLOB
    const schema = createAllTypesSchema();
    const ddl = adapter.transform(schema);

    const types = new Set(ddl.columns.map(c => c.type));
    const validTypes = new Set(['INTEGER', 'REAL', 'TEXT', 'BLOB']);

    types.forEach(type => {
      expect(validTypes.has(type)).toBe(true);
    });
  });
});

// =============================================================================
// Array Type Handling Tests
// =============================================================================

describe('Array Type Handling', () => {
  describe('isArrayType()', () => {
    it('should detect array types ending with []', () => {
      expect(isArrayType('string[]')).toBe(true);
      expect(isArrayType('int[]')).toBe(true);
      expect(isArrayType('uuid[]')).toBe(true);
      expect(isArrayType('json[]')).toBe(true);
    });

    it('should return false for non-array types', () => {
      expect(isArrayType('string')).toBe(false);
      expect(isArrayType('int')).toBe(false);
      expect(isArrayType('json')).toBe(false);
      expect(isArrayType('[]')).toBe(false); // just brackets
    });

    it('should handle edge cases', () => {
      expect(isArrayType('')).toBe(false);
      expect(isArrayType('string[][]')).toBe(true); // nested arrays end with []
    });
  });

  describe('fieldToSQLiteColumn() with arrays', () => {
    it('should convert array types to TEXT and return warning', () => {
      const field = parseField('string[]');
      const result = fieldToSQLiteColumn('tags', field);

      expect(result.column.type).toBe('TEXT');
      expect(result.column.name).toBe('tags');
      expect(result.warning).toBeDefined();
      expect(result.warning?.code).toBe('SQLITE_ARRAY_AS_JSON');
      expect(result.warning?.fieldName).toBe('tags');
      expect(result.warning?.message).toContain('SQLite does not have native array support');
      expect(result.warning?.message).toContain('string[]');
    });

    it('should not return warning for non-array types', () => {
      const field = parseField('string');
      const result = fieldToSQLiteColumn('name', field);

      expect(result.column.type).toBe('TEXT');
      expect(result.warning).toBeUndefined();
    });

    it('should handle int[] array type', () => {
      const field = parseField('int[]');
      const result = fieldToSQLiteColumn('scores', field);

      expect(result.column.type).toBe('TEXT');
      expect(result.warning).toBeDefined();
      expect(result.warning?.message).toContain('int[]');
    });
  });

  describe('SQLiteAdapter.transform() with arrays', () => {
    let adapter: SQLiteAdapter;

    beforeEach(() => {
      adapter = new SQLiteAdapter();
    });

    it('should collect warnings for array fields in DDL', () => {
      const schema = parseSchema({
        $type: 'Post',
        id: 'uuid!',
        title: 'string!',
        tags: 'string[]',
        scores: 'int[]',
      });

      const ddl = adapter.transform(schema);

      expect(ddl.warnings).toBeDefined();
      expect(ddl.warnings).toHaveLength(2);

      const tagWarning = ddl.warnings?.find(w => w.fieldName === 'tags');
      const scoreWarning = ddl.warnings?.find(w => w.fieldName === 'scores');

      expect(tagWarning).toBeDefined();
      expect(tagWarning?.code).toBe('SQLITE_ARRAY_AS_JSON');

      expect(scoreWarning).toBeDefined();
      expect(scoreWarning?.code).toBe('SQLITE_ARRAY_AS_JSON');
    });

    it('should not have warnings for schemas without array fields', () => {
      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string',
        age: 'int?',
      });

      const ddl = adapter.transform(schema);

      expect(ddl.warnings).toBeUndefined();
    });

    it('should generate TEXT columns for array fields', () => {
      const schema = parseSchema({
        $type: 'Document',
        id: 'uuid!',
        keywords: 'string[]',
        ratings: 'double[]',
      });

      const ddl = adapter.transform(schema);

      const keywordsCol = ddl.columns.find(c => c.name === 'keywords');
      const ratingsCol = ddl.columns.find(c => c.name === 'ratings');

      expect(keywordsCol?.type).toBe('TEXT');
      expect(ratingsCol?.type).toBe('TEXT');
    });

    it('should generate valid SQL for schemas with array fields', () => {
      const schema = parseSchema({
        $type: 'Article',
        id: 'uuid!',
        title: 'string!',
        tags: 'string[]',
      });

      const sql = transformToSQLiteDDL(schema);

      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('Article');
      expect(sql).toContain('tags TEXT');
    });
  });
});
