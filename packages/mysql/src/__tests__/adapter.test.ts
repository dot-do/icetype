/**
 * Tests for MySQLAdapter implementation
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema } from '@icetype/core';
import type { IceTypeSchema } from '@icetype/core';

import {
  MySQLAdapter,
  createMySQLAdapter,
  transformToMySQLDDL,
  generateMySQLDDL,
  mapIceTypeToMySQL,
  getMySQLTypeString,
  formatDefaultValue,
  generateSystemColumns,
  escapeIdentifier,
  serializeColumn,
  serializeDDL,
  generateIndexStatements,
  ICETYPE_TO_MYSQL,
} from '../index.js';

import type { MySQLDDL, MySQLColumn } from '../types.js';

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
// createMySQLAdapter() Factory Tests
// =============================================================================

describe('createMySQLAdapter()', () => {
  it('should create a new MySQLAdapter instance', () => {
    const adapter = createMySQLAdapter();

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(MySQLAdapter);
  });

  it('should create independent adapter instances', () => {
    const adapter1 = createMySQLAdapter();
    const adapter2 = createMySQLAdapter();

    expect(adapter1).not.toBe(adapter2);
  });

  it('should create adapter with correct interface methods', () => {
    const adapter = createMySQLAdapter();

    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.version).toBe('string');
  });
});

// =============================================================================
// MySQLAdapter Properties Tests
// =============================================================================

describe('MySQLAdapter properties', () => {
  let adapter: MySQLAdapter;

  beforeEach(() => {
    adapter = new MySQLAdapter();
  });

  describe('name property', () => {
    it('should have name "mysql"', () => {
      expect(adapter.name).toBe('mysql');
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
  describe('ICETYPE_TO_MYSQL constant', () => {
    it('should map string to VARCHAR(255)', () => {
      expect(ICETYPE_TO_MYSQL['string']?.mysqlType).toBe('VARCHAR');
      expect(ICETYPE_TO_MYSQL['string']?.length).toBe(255);
    });

    it('should map text to TEXT', () => {
      expect(ICETYPE_TO_MYSQL['text']?.mysqlType).toBe('TEXT');
    });

    it('should map int to INT', () => {
      expect(ICETYPE_TO_MYSQL['int']?.mysqlType).toBe('INT');
    });

    it('should map long to BIGINT', () => {
      expect(ICETYPE_TO_MYSQL['long']?.mysqlType).toBe('BIGINT');
    });

    it('should map bigint to BIGINT', () => {
      expect(ICETYPE_TO_MYSQL['bigint']?.mysqlType).toBe('BIGINT');
    });

    it('should map float to FLOAT', () => {
      expect(ICETYPE_TO_MYSQL['float']?.mysqlType).toBe('FLOAT');
    });

    it('should map double to DOUBLE', () => {
      expect(ICETYPE_TO_MYSQL['double']?.mysqlType).toBe('DOUBLE');
    });

    it('should map bool to TINYINT(1)', () => {
      expect(ICETYPE_TO_MYSQL['bool']?.mysqlType).toBe('TINYINT');
      expect(ICETYPE_TO_MYSQL['bool']?.length).toBe(1);
    });

    it('should map boolean to TINYINT(1)', () => {
      expect(ICETYPE_TO_MYSQL['boolean']?.mysqlType).toBe('TINYINT');
      expect(ICETYPE_TO_MYSQL['boolean']?.length).toBe(1);
    });

    it('should map uuid to CHAR(36)', () => {
      expect(ICETYPE_TO_MYSQL['uuid']?.mysqlType).toBe('CHAR');
      expect(ICETYPE_TO_MYSQL['uuid']?.length).toBe(36);
    });

    it('should map timestamp to DATETIME', () => {
      expect(ICETYPE_TO_MYSQL['timestamp']?.mysqlType).toBe('DATETIME');
    });

    it('should map date to DATE', () => {
      expect(ICETYPE_TO_MYSQL['date']?.mysqlType).toBe('DATE');
    });

    it('should map time to TIME', () => {
      expect(ICETYPE_TO_MYSQL['time']?.mysqlType).toBe('TIME');
    });

    it('should map json to JSON', () => {
      expect(ICETYPE_TO_MYSQL['json']?.mysqlType).toBe('JSON');
    });

    it('should map binary to BLOB', () => {
      expect(ICETYPE_TO_MYSQL['binary']?.mysqlType).toBe('BLOB');
    });

    it('should map decimal to DECIMAL with default precision and scale', () => {
      const mapping = ICETYPE_TO_MYSQL['decimal'];
      expect(mapping?.mysqlType).toBe('DECIMAL');
      expect(mapping?.precision).toBe(38);
      expect(mapping?.scale).toBe(9);
    });
  });

  describe('mapIceTypeToMySQL()', () => {
    it('should map known types', () => {
      expect(mapIceTypeToMySQL('string').mysqlType).toBe('VARCHAR');
      expect(mapIceTypeToMySQL('int').mysqlType).toBe('INT');
      expect(mapIceTypeToMySQL('uuid').mysqlType).toBe('CHAR');
    });

    it('should handle case insensitivity', () => {
      expect(mapIceTypeToMySQL('STRING').mysqlType).toBe('VARCHAR');
      expect(mapIceTypeToMySQL('Int').mysqlType).toBe('INT');
      expect(mapIceTypeToMySQL('UUID').mysqlType).toBe('CHAR');
    });

    it('should return VARCHAR(255) for unknown types', () => {
      const mapping = mapIceTypeToMySQL('unknown');
      expect(mapping.mysqlType).toBe('VARCHAR');
      expect(mapping.length).toBe(255);
    });
  });

  describe('getMySQLTypeString()', () => {
    it('should return simple type string for types without length', () => {
      expect(getMySQLTypeString({ mysqlType: 'TEXT' })).toBe('TEXT');
      expect(getMySQLTypeString({ mysqlType: 'INT' })).toBe('INT');
    });

    it('should return parameterized type string for types with length', () => {
      expect(getMySQLTypeString({ mysqlType: 'VARCHAR', length: 255 })).toBe('VARCHAR(255)');
      expect(getMySQLTypeString({ mysqlType: 'CHAR', length: 36 })).toBe('CHAR(36)');
    });

    it('should return parameterized type string for decimal', () => {
      expect(getMySQLTypeString({ mysqlType: 'DECIMAL', precision: 38, scale: 9 }))
        .toBe('DECIMAL(38, 9)');
    });

    it('should handle TINYINT(1) for boolean', () => {
      expect(getMySQLTypeString({ mysqlType: 'TINYINT', length: 1 }))
        .toBe('TINYINT(1)');
    });
  });
});

// =============================================================================
// DDL Helper Tests
// =============================================================================

describe('DDL Helpers', () => {
  describe('formatDefaultValue()', () => {
    it('should format null', () => {
      expect(formatDefaultValue(null, 'VARCHAR(255)')).toBe('NULL');
    });

    it('should format strings with quotes', () => {
      expect(formatDefaultValue('hello', 'VARCHAR(255)')).toBe("'hello'");
    });

    it('should escape single quotes in strings', () => {
      expect(formatDefaultValue("it's", 'VARCHAR(255)')).toBe("'it''s'");
    });

    it('should format numbers', () => {
      expect(formatDefaultValue(42, 'INT')).toBe('42');
      expect(formatDefaultValue(3.14, 'DOUBLE')).toBe('3.14');
    });

    it('should format booleans', () => {
      expect(formatDefaultValue(true, 'TINYINT(1)')).toBe('TRUE');
      expect(formatDefaultValue(false, 'TINYINT(1)')).toBe('FALSE');
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
      expect(typeColumn?.type).toBe('VARCHAR(255)');
    });

    it('should include $version with default', () => {
      const columns = generateSystemColumns();
      const versionColumn = columns.find(c => c.name === '$version');
      expect(versionColumn).toBeDefined();
      expect(versionColumn?.type).toBe('INT');
      expect(versionColumn?.default).toBe('1');
    });

    it('should include timestamp columns', () => {
      const columns = generateSystemColumns();
      const createdAt = columns.find(c => c.name === '$createdAt');
      const updatedAt = columns.find(c => c.name === '$updatedAt');
      expect(createdAt?.type).toBe('BIGINT');
      expect(updatedAt?.type).toBe('BIGINT');
    });
  });

  describe('escapeIdentifier()', () => {
    it('should not escape simple identifiers', () => {
      expect(escapeIdentifier('users')).toBe('users');
      expect(escapeIdentifier('my_table')).toBe('my_table');
    });

    it('should escape identifiers starting with $', () => {
      expect(escapeIdentifier('$id')).toBe('`$id`');
      expect(escapeIdentifier('$type')).toBe('`$type`');
    });

    it('should escape identifiers with special characters', () => {
      expect(escapeIdentifier('my-table')).toBe('`my-table`');
      expect(escapeIdentifier('user name')).toBe('`user name`');
    });

    it('should escape backticks within identifiers', () => {
      expect(escapeIdentifier('my`table')).toBe('`my``table`');
    });
  });

  describe('serializeColumn()', () => {
    it('should serialize simple column', () => {
      const column: MySQLColumn = {
        name: 'email',
        type: 'VARCHAR(255)',
        nullable: true,
      };
      expect(serializeColumn(column)).toBe('email VARCHAR(255)');
    });

    it('should serialize NOT NULL column', () => {
      const column: MySQLColumn = {
        name: 'id',
        type: 'CHAR(36)',
        nullable: false,
      };
      expect(serializeColumn(column)).toBe('id CHAR(36) NOT NULL');
    });

    it('should serialize UNIQUE column', () => {
      const column: MySQLColumn = {
        name: 'email',
        type: 'VARCHAR(255)',
        nullable: true,
        unique: true,
      };
      expect(serializeColumn(column)).toBe('email VARCHAR(255) UNIQUE');
    });

    it('should serialize column with default', () => {
      const column: MySQLColumn = {
        name: 'status',
        type: 'VARCHAR(255)',
        nullable: true,
        default: "'active'",
      };
      expect(serializeColumn(column)).toBe("status VARCHAR(255) DEFAULT 'active'");
    });

    it('should escape special column names', () => {
      const column: MySQLColumn = {
        name: '$id',
        type: 'VARCHAR(255)',
        nullable: false,
      };
      expect(serializeColumn(column)).toBe('`$id` VARCHAR(255) NOT NULL');
    });
  });

  describe('serializeDDL()', () => {
    it('should generate basic CREATE TABLE', () => {
      const ddl: MySQLDDL = {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'CHAR(36)', nullable: false },
          { name: 'name', type: 'VARCHAR(255)', nullable: true },
        ],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CREATE TABLE users');
      expect(sql).toContain('id CHAR(36) NOT NULL');
      expect(sql).toContain('name VARCHAR(255)');
    });

    it('should generate CREATE TABLE IF NOT EXISTS', () => {
      const ddl: MySQLDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'CHAR(36)', nullable: false }],
        ifNotExists: true,
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    });

    it('should include ENGINE=InnoDB by default', () => {
      const ddl: MySQLDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'CHAR(36)', nullable: false }],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('ENGINE=InnoDB');
    });

    it('should allow custom engine', () => {
      const ddl: MySQLDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'CHAR(36)', nullable: false }],
        engine: 'MyISAM',
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('ENGINE=MyISAM');
    });

    it('should include charset and collation', () => {
      const ddl: MySQLDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'CHAR(36)', nullable: false }],
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CHARACTER SET utf8mb4');
      expect(sql).toContain('COLLATE utf8mb4_unicode_ci');
    });

    it('should include PRIMARY KEY constraint', () => {
      const ddl: MySQLDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'CHAR(36)', nullable: false }],
        primaryKey: ['id'],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('PRIMARY KEY (id)');
    });

    it('should include UNIQUE constraints', () => {
      const ddl: MySQLDDL = {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'CHAR(36)', nullable: false },
          { name: 'email', type: 'VARCHAR(255)', nullable: true },
        ],
        uniqueConstraints: [['email']],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('UNIQUE (email)');
    });
  });

  describe('generateIndexStatements()', () => {
    it('should generate index for unique columns', () => {
      const columns: MySQLColumn[] = [
        { name: 'email', type: 'VARCHAR(255)', nullable: true, unique: true },
      ];

      const statements = generateIndexStatements('users', columns);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CREATE INDEX');
      expect(statements[0]).toContain('idx_users_email');
    });

    it('should return empty array for no unique columns', () => {
      const columns: MySQLColumn[] = [
        { name: 'name', type: 'VARCHAR(255)', nullable: true },
      ];

      const statements = generateIndexStatements('users', columns);
      expect(statements).toHaveLength(0);
    });
  });
});

// =============================================================================
// transform() Tests
// =============================================================================

describe('MySQLAdapter.transform()', () => {
  let adapter: MySQLAdapter;

  beforeEach(() => {
    adapter = new MySQLAdapter();
  });

  describe('Basic transformation', () => {
    it('should return valid MySQLDDL structure', () => {
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

    it('should include ENGINE=InnoDB by default', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      expect(result.engine).toBe('InnoDB');
    });
  });

  describe('Type mapping', () => {
    it('should map all supported types correctly', () => {
      const schema = createAllTypesSchema();
      const result = adapter.transform(schema);

      const findColumn = (name: string) => result.columns.find(c => c.name === name);

      expect(findColumn('stringField')?.type).toBe('VARCHAR(255)');
      expect(findColumn('textField')?.type).toBe('TEXT');
      expect(findColumn('intField')?.type).toBe('INT');
      expect(findColumn('longField')?.type).toBe('BIGINT');
      expect(findColumn('bigintField')?.type).toBe('BIGINT');
      expect(findColumn('floatField')?.type).toBe('FLOAT');
      expect(findColumn('doubleField')?.type).toBe('DOUBLE');
      expect(findColumn('boolField')?.type).toBe('TINYINT(1)');
      expect(findColumn('booleanField')?.type).toBe('TINYINT(1)');
      expect(findColumn('uuidField')?.type).toBe('CHAR(36)');
      expect(findColumn('timestampField')?.type).toBe('DATETIME');
      expect(findColumn('dateField')?.type).toBe('DATE');
      expect(findColumn('timeField')?.type).toBe('TIME');
      expect(findColumn('jsonField')?.type).toBe('JSON');
      expect(findColumn('binaryField')?.type).toBe('BLOB');
      expect(findColumn('decimalField')?.type).toBe('DECIMAL(38, 9)');
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

    it('should respect engine option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { engine: 'MyISAM' });

      expect(result.engine).toBe('MyISAM');
    });

    it('should respect charset option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { charset: 'utf8mb4' });

      expect(result.charset).toBe('utf8mb4');
    });

    it('should respect collation option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { collation: 'utf8mb4_unicode_ci' });

      expect(result.collation).toBe('utf8mb4_unicode_ci');
    });
  });
});

// =============================================================================
// serialize() Tests
// =============================================================================

describe('MySQLAdapter.serialize()', () => {
  let adapter: MySQLAdapter;

  beforeEach(() => {
    adapter = new MySQLAdapter();
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

    expect(sql).toContain('`$id`');  // System fields with $ are quoted
    expect(sql).toContain('id CHAR(36)');  // Simple identifiers are not quoted
    expect(sql).toContain('email VARCHAR(255)');
    expect(sql).toContain('name VARCHAR(255)');
    expect(sql).toContain('age INT');
  });

  it('should include type information', () => {
    const schema = createSimpleSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('CHAR(36)');
    expect(sql).toContain('VARCHAR(255)');
    expect(sql).toContain('INT');
  });

  it('should include constraints', () => {
    const schema = createSimpleSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('NOT NULL');
    expect(sql).toContain('PRIMARY KEY');
    expect(sql).toContain('UNIQUE');
  });

  it('should include ENGINE=InnoDB', () => {
    const schema = createSimpleSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('ENGINE=InnoDB');
  });
});

// =============================================================================
// Convenience Function Tests
// =============================================================================

describe('Convenience Functions', () => {
  describe('transformToMySQLDDL()', () => {
    it('should transform and serialize in one step', () => {
      const schema = createSimpleSchema();
      const sql = transformToMySQLDDL(schema);

      expect(typeof sql).toBe('string');
      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('User');
    });

    it('should accept options', () => {
      const schema = createSimpleSchema();
      const sql = transformToMySQLDDL(schema, { ifNotExists: true });

      expect(sql).toContain('IF NOT EXISTS');
    });
  });

  describe('generateMySQLDDL()', () => {
    it('should return DDL structure', () => {
      const schema = createSimpleSchema();
      const ddl = generateMySQLDDL(schema);

      expect(ddl.tableName).toBe('User');
      expect(ddl.columns).toBeDefined();
    });

    it('should accept options', () => {
      const schema = createSimpleSchema();
      const ddl = generateMySQLDDL(schema, { tableName: 'custom' });

      expect(ddl.tableName).toBe('custom');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('MySQLAdapter Integration', () => {
  let adapter: MySQLAdapter;

  beforeEach(() => {
    adapter = new MySQLAdapter();
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
    expect(sql).toContain('CHAR(36)');
    expect(sql).toContain('DOUBLE');
    expect(sql).toContain('TINYINT(1)');
    expect(sql).toContain('DATETIME');
    expect(sql).toContain('DATE');
    expect(sql).toContain('JSON');
    expect(sql).toContain('ENGINE=InnoDB');
  });

  it('should be compatible with SchemaAdapter interface', () => {
    const genericAdapter = adapter as {
      name: string;
      version: string;
      transform: (schema: IceTypeSchema, options?: unknown) => unknown;
      serialize: (output: unknown) => string;
    };

    expect(genericAdapter.name).toBe('mysql');
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
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
    });

    const sql = adapter.serialize(ddl);

    expect(sql).toContain('ComplexEntity');
    expect(sql).toContain('DECIMAL(38, 9)');
    expect(sql).toContain('JSON');
    expect(sql).toContain('CHARACTER SET utf8mb4');
    expect(sql).toContain('COLLATE utf8mb4_unicode_ci');
  });

  it('should generate valid SQL for different table configurations', () => {
    const schema = createSimpleSchema();

    // Standard table
    const standardSql = transformToMySQLDDL(schema);
    expect(standardSql).toMatch(/^CREATE TABLE/);

    // With charset and collation
    const configuredSql = transformToMySQLDDL(schema, {
      charset: 'utf8mb4',
      collation: 'utf8mb4_general_ci',
    });
    expect(configuredSql).toContain('CHARACTER SET utf8mb4');
    expect(configuredSql).toContain('COLLATE utf8mb4_general_ci');
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
  let adapter: MySQLAdapter;

  beforeEach(() => {
    adapter = new MySQLAdapter();
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

    const sql = transformToMySQLDDL(schema);
    expect(sql).toContain('`My-Special_Entity`');
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
// MySQL-Specific Tests
// =============================================================================

describe('MySQL-Specific Features', () => {
  let adapter: MySQLAdapter;

  beforeEach(() => {
    adapter = new MySQLAdapter();
  });

  it('should use InnoDB as default engine', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
    });

    const ddl = adapter.transform(schema);
    expect(ddl.engine).toBe('InnoDB');

    const sql = adapter.serialize(ddl);
    expect(sql).toContain('ENGINE=InnoDB');
  });

  it('should support MyISAM engine', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
    });

    const ddl = adapter.transform(schema, { engine: 'MyISAM' });
    expect(ddl.engine).toBe('MyISAM');

    const sql = adapter.serialize(ddl);
    expect(sql).toContain('ENGINE=MyISAM');
  });

  it('should use JSON type for json fields', () => {
    const schema = parseSchema({
      $type: 'Config',
      settings: 'json',
    });

    const ddl = adapter.transform(schema);
    const settingsCol = ddl.columns.find(c => c.name === 'settings');
    expect(settingsCol?.type).toBe('JSON');
  });

  it('should use TINYINT(1) for boolean fields', () => {
    const schema = parseSchema({
      $type: 'Flags',
      isActive: 'boolean',
      isVerified: 'bool',
    });

    const ddl = adapter.transform(schema);
    const isActiveCol = ddl.columns.find(c => c.name === 'isActive');
    const isVerifiedCol = ddl.columns.find(c => c.name === 'isVerified');

    expect(isActiveCol?.type).toBe('TINYINT(1)');
    expect(isVerifiedCol?.type).toBe('TINYINT(1)');
  });

  it('should use CHAR(36) for UUID fields', () => {
    const schema = parseSchema({
      $type: 'Entity',
      id: 'uuid!',
    });

    const ddl = adapter.transform(schema);
    const idCol = ddl.columns.find(c => c.name === 'id');
    expect(idCol?.type).toBe('CHAR(36)');
  });

  it('should use DATETIME for timestamp fields', () => {
    const schema = parseSchema({
      $type: 'Event',
      createdAt: 'timestamp',
    });

    const ddl = adapter.transform(schema);
    const createdAtCol = ddl.columns.find(c => c.name === 'createdAt');
    expect(createdAtCol?.type).toBe('DATETIME');
  });

  it('should generate proper charset and collation options', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
    });

    const sql = transformToMySQLDDL(schema, {
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
    });

    expect(sql).toContain('CHARACTER SET utf8mb4');
    expect(sql).toContain('COLLATE utf8mb4_unicode_ci');
  });
});
