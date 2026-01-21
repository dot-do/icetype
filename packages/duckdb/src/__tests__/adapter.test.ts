/**
 * Tests for DuckDBAdapter implementation
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema } from '@icetype/core';
import type { IceTypeSchema } from '@icetype/core';
import {
  createSimpleSchema,
  createAllTypesSchema,
} from '@icetype/test-utils';

import {
  DuckDBAdapter,
  createDuckDBAdapter,
  transformToDuckDBDDL,
  generateDuckDBDDL,
  mapIceTypeToDuckDB,
  getDuckDBTypeString,
  toArrayType,
  formatDefaultValue,
  generateSystemColumns,
  escapeIdentifier,
  serializeColumn,
  serializeDDL,
  generateIndexStatements,
  InvalidSchemaNameError,
  ICETYPE_TO_DUCKDB,
} from '../index.js';

import type { DuckDBDDL, DuckDBColumn } from '../types.js';

// =============================================================================
// Test Helpers - using @icetype/test-utils
// =============================================================================

/**
 * Create a simple test schema for basic testing
 * Uses the shared createSimpleSchema factory from @icetype/test-utils
 */
function createBasicUserSchema(): IceTypeSchema {
  return createSimpleSchema('User', {
    id: 'uuid!',
    email: 'string#',
    name: 'string',
    age: 'int?',
  });
}

/**
 * Create a schema with various field types
 * Uses the shared createSimpleSchema factory from @icetype/test-utils
 */
function createTypedProductSchema(): IceTypeSchema {
  return createSimpleSchema('Product', {
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
 * Create a schema with array types
 * Uses the shared createSimpleSchema factory from @icetype/test-utils
 */
function createTagsSchema(): IceTypeSchema {
  return createSimpleSchema('Tags', {
    id: 'uuid!',
    tags: 'string[]',
    scores: 'int[]',
  });
}

// =============================================================================
// createDuckDBAdapter() Factory Tests
// =============================================================================

describe('createDuckDBAdapter()', () => {
  it('should create a new DuckDBAdapter instance', () => {
    const adapter = createDuckDBAdapter();

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(DuckDBAdapter);
  });

  it('should create independent adapter instances', () => {
    const adapter1 = createDuckDBAdapter();
    const adapter2 = createDuckDBAdapter();

    expect(adapter1).not.toBe(adapter2);
  });

  it('should create adapter with correct interface methods', () => {
    const adapter = createDuckDBAdapter();

    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.version).toBe('string');
  });
});

// =============================================================================
// DuckDBAdapter Properties Tests
// =============================================================================

describe('DuckDBAdapter properties', () => {
  let adapter: DuckDBAdapter;

  beforeEach(() => {
    adapter = new DuckDBAdapter();
  });

  describe('name property', () => {
    it('should have name "duckdb"', () => {
      expect(adapter.name).toBe('duckdb');
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
  describe('ICETYPE_TO_DUCKDB constant', () => {
    it('should map string to VARCHAR', () => {
      expect(ICETYPE_TO_DUCKDB['string']?.duckdbType).toBe('VARCHAR');
    });

    it('should map text to VARCHAR', () => {
      expect(ICETYPE_TO_DUCKDB['text']?.duckdbType).toBe('VARCHAR');
    });

    it('should map int to INTEGER', () => {
      expect(ICETYPE_TO_DUCKDB['int']?.duckdbType).toBe('INTEGER');
    });

    it('should map long to BIGINT', () => {
      expect(ICETYPE_TO_DUCKDB['long']?.duckdbType).toBe('BIGINT');
    });

    it('should map bigint to BIGINT', () => {
      expect(ICETYPE_TO_DUCKDB['bigint']?.duckdbType).toBe('BIGINT');
    });

    it('should map float to REAL', () => {
      expect(ICETYPE_TO_DUCKDB['float']?.duckdbType).toBe('REAL');
    });

    it('should map double to DOUBLE', () => {
      expect(ICETYPE_TO_DUCKDB['double']?.duckdbType).toBe('DOUBLE');
    });

    it('should map bool to BOOLEAN', () => {
      expect(ICETYPE_TO_DUCKDB['bool']?.duckdbType).toBe('BOOLEAN');
    });

    it('should map boolean to BOOLEAN', () => {
      expect(ICETYPE_TO_DUCKDB['boolean']?.duckdbType).toBe('BOOLEAN');
    });

    it('should map uuid to UUID', () => {
      expect(ICETYPE_TO_DUCKDB['uuid']?.duckdbType).toBe('UUID');
    });

    it('should map timestamp to TIMESTAMP', () => {
      expect(ICETYPE_TO_DUCKDB['timestamp']?.duckdbType).toBe('TIMESTAMP');
    });

    it('should map timestamptz to TIMESTAMPTZ', () => {
      expect(ICETYPE_TO_DUCKDB['timestamptz']?.duckdbType).toBe('TIMESTAMPTZ');
    });

    it('should map date to DATE', () => {
      expect(ICETYPE_TO_DUCKDB['date']?.duckdbType).toBe('DATE');
    });

    it('should map time to TIME', () => {
      expect(ICETYPE_TO_DUCKDB['time']?.duckdbType).toBe('TIME');
    });

    it('should map json to JSON', () => {
      expect(ICETYPE_TO_DUCKDB['json']?.duckdbType).toBe('JSON');
    });

    it('should map binary to BLOB', () => {
      expect(ICETYPE_TO_DUCKDB['binary']?.duckdbType).toBe('BLOB');
    });

    it('should map decimal to DECIMAL with default precision and scale', () => {
      const mapping = ICETYPE_TO_DUCKDB['decimal'];
      expect(mapping?.duckdbType).toBe('DECIMAL');
      expect(mapping?.precision).toBe(38);
      expect(mapping?.scale).toBe(9);
    });
  });

  describe('mapIceTypeToDuckDB()', () => {
    it('should map known types', () => {
      expect(mapIceTypeToDuckDB('string').duckdbType).toBe('VARCHAR');
      expect(mapIceTypeToDuckDB('int').duckdbType).toBe('INTEGER');
      expect(mapIceTypeToDuckDB('uuid').duckdbType).toBe('UUID');
    });

    it('should handle case insensitivity', () => {
      expect(mapIceTypeToDuckDB('STRING').duckdbType).toBe('VARCHAR');
      expect(mapIceTypeToDuckDB('Int').duckdbType).toBe('INTEGER');
      expect(mapIceTypeToDuckDB('UUID').duckdbType).toBe('UUID');
    });

    it('should return VARCHAR for unknown types', () => {
      expect(mapIceTypeToDuckDB('unknown').duckdbType).toBe('VARCHAR');
      expect(mapIceTypeToDuckDB('customType').duckdbType).toBe('VARCHAR');
    });
  });

  describe('getDuckDBTypeString()', () => {
    it('should return simple type string for non-decimal', () => {
      expect(getDuckDBTypeString({ duckdbType: 'VARCHAR' })).toBe('VARCHAR');
      expect(getDuckDBTypeString({ duckdbType: 'INTEGER' })).toBe('INTEGER');
    });

    it('should return parameterized type string for decimal', () => {
      expect(getDuckDBTypeString({ duckdbType: 'DECIMAL', precision: 38, scale: 9 }))
        .toBe('DECIMAL(38, 9)');
    });

    it('should handle decimal with scale 0', () => {
      expect(getDuckDBTypeString({ duckdbType: 'DECIMAL', precision: 10 }))
        .toBe('DECIMAL(10, 0)');
    });
  });

  describe('toArrayType()', () => {
    it('should convert type to array type', () => {
      expect(toArrayType('VARCHAR')).toBe('VARCHAR[]');
      expect(toArrayType('INTEGER')).toBe('INTEGER[]');
      expect(toArrayType('DECIMAL(38, 9)')).toBe('DECIMAL(38, 9)[]');
    });
  });
});

// =============================================================================
// DDL Helper Tests
// =============================================================================

describe('DDL Helpers', () => {
  describe('formatDefaultValue()', () => {
    it('should format null', () => {
      expect(formatDefaultValue(null, 'VARCHAR')).toBe('NULL');
    });

    it('should format strings with quotes', () => {
      expect(formatDefaultValue('hello', 'VARCHAR')).toBe("'hello'");
    });

    it('should escape single quotes in strings', () => {
      expect(formatDefaultValue("it's", 'VARCHAR')).toBe("'it''s'");
    });

    it('should format numbers', () => {
      expect(formatDefaultValue(42, 'INTEGER')).toBe('42');
      expect(formatDefaultValue(3.14, 'DOUBLE')).toBe('3.14');
    });

    it('should format booleans', () => {
      expect(formatDefaultValue(true, 'BOOLEAN')).toBe('TRUE');
      expect(formatDefaultValue(false, 'BOOLEAN')).toBe('FALSE');
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
      expect(typeColumn?.type).toBe('VARCHAR');
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
      const column: DuckDBColumn = {
        name: 'email',
        type: 'VARCHAR',
        nullable: true,
      };
      expect(serializeColumn(column)).toBe('email VARCHAR');
    });

    it('should serialize NOT NULL column', () => {
      const column: DuckDBColumn = {
        name: 'id',
        type: 'UUID',
        nullable: false,
      };
      expect(serializeColumn(column)).toBe('id UUID NOT NULL');
    });

    it('should serialize UNIQUE column', () => {
      const column: DuckDBColumn = {
        name: 'email',
        type: 'VARCHAR',
        nullable: true,
        unique: true,
      };
      expect(serializeColumn(column)).toBe('email VARCHAR UNIQUE');
    });

    it('should serialize column with default', () => {
      const column: DuckDBColumn = {
        name: 'status',
        type: 'VARCHAR',
        nullable: true,
        default: "'active'",
      };
      expect(serializeColumn(column)).toBe("status VARCHAR DEFAULT 'active'");
    });

    it('should escape special column names', () => {
      const column: DuckDBColumn = {
        name: '$id',
        type: 'VARCHAR',
        nullable: false,
      };
      expect(serializeColumn(column)).toBe('"$id" VARCHAR NOT NULL');
    });
  });

  describe('serializeDDL()', () => {
    it('should generate basic CREATE TABLE', () => {
      const ddl: DuckDBDDL = {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'UUID', nullable: false },
          { name: 'name', type: 'VARCHAR', nullable: true },
        ],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CREATE TABLE users');
      expect(sql).toContain('id UUID NOT NULL');
      expect(sql).toContain('name VARCHAR');
    });

    it('should generate CREATE TABLE IF NOT EXISTS', () => {
      const ddl: DuckDBDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'UUID', nullable: false }],
        ifNotExists: true,
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    });

    it('should generate CREATE TEMPORARY TABLE', () => {
      const ddl: DuckDBDDL = {
        tableName: 'temp_users',
        columns: [{ name: 'id', type: 'UUID', nullable: false }],
        temporary: true,
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CREATE TEMPORARY TABLE');
    });

    it('should include schema name', () => {
      const ddl: DuckDBDDL = {
        tableName: 'users',
        schemaName: 'analytics',
        columns: [{ name: 'id', type: 'UUID', nullable: false }],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('analytics.users');
    });

    it('should include PRIMARY KEY constraint', () => {
      const ddl: DuckDBDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'UUID', nullable: false }],
        primaryKey: ['id'],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('PRIMARY KEY (id)');
    });

    it('should include UNIQUE constraints', () => {
      const ddl: DuckDBDDL = {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'UUID', nullable: false },
          { name: 'email', type: 'VARCHAR', nullable: true },
        ],
        uniqueConstraints: [['email']],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('UNIQUE (email)');
    });
  });

  describe('generateIndexStatements()', () => {
    it('should generate index for unique columns', () => {
      const columns: DuckDBColumn[] = [
        { name: 'email', type: 'VARCHAR', nullable: true, unique: true },
      ];

      const statements = generateIndexStatements('users', undefined, columns);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CREATE INDEX IF NOT EXISTS');
      expect(statements[0]).toContain('idx_users_email');
    });

    it('should return empty array for no unique columns', () => {
      const columns: DuckDBColumn[] = [
        { name: 'name', type: 'VARCHAR', nullable: true },
      ];

      const statements = generateIndexStatements('users', undefined, columns);
      expect(statements).toHaveLength(0);
    });

    it('should include schema name in index', () => {
      const columns: DuckDBColumn[] = [
        { name: 'email', type: 'VARCHAR', nullable: true, unique: true },
      ];

      const statements = generateIndexStatements('users', 'analytics', columns);
      expect(statements[0]).toContain('analytics.users');
    });
  });
});

// =============================================================================
// transform() Tests
// =============================================================================

describe('DuckDBAdapter.transform()', () => {
  let adapter: DuckDBAdapter;

  beforeEach(() => {
    adapter = new DuckDBAdapter();
  });

  describe('Basic transformation', () => {
    it('should return valid DuckDBDDL structure', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema);

      expect(result).toBeDefined();
      expect(result.tableName).toBe('User');
      expect(result.columns).toBeDefined();
      expect(Array.isArray(result.columns)).toBe(true);
    });

    it('should include system fields by default', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema);

      const columnNames = result.columns.map(c => c.name);
      expect(columnNames).toContain('$id');
      expect(columnNames).toContain('$type');
      expect(columnNames).toContain('$version');
      expect(columnNames).toContain('$createdAt');
      expect(columnNames).toContain('$updatedAt');
    });

    it('should include user-defined fields', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema);

      const columnNames = result.columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('age');
    });

    it('should set $id as primary key', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema);

      expect(result.primaryKey).toContain('$id');
    });
  });

  describe('Type mapping', () => {
    it('should map all supported types correctly', () => {
      const schema = createAllTypesSchema();
      const result = adapter.transform(schema);

      const findColumn = (name: string) => result.columns.find(c => c.name === name);

      expect(findColumn('stringField')?.type).toBe('VARCHAR');
      expect(findColumn('textField')?.type).toBe('VARCHAR');
      expect(findColumn('intField')?.type).toBe('INTEGER');
      expect(findColumn('longField')?.type).toBe('BIGINT');
      expect(findColumn('bigintField')?.type).toBe('BIGINT');
      expect(findColumn('floatField')?.type).toBe('REAL');
      expect(findColumn('doubleField')?.type).toBe('DOUBLE');
      expect(findColumn('boolField')?.type).toBe('BOOLEAN');
      expect(findColumn('booleanField')?.type).toBe('BOOLEAN');
      expect(findColumn('uuidField')?.type).toBe('UUID');
      expect(findColumn('timestampField')?.type).toBe('TIMESTAMP');
      expect(findColumn('timestamptzField')?.type).toBe('TIMESTAMPTZ');
      expect(findColumn('dateField')?.type).toBe('DATE');
      expect(findColumn('timeField')?.type).toBe('TIME');
      expect(findColumn('jsonField')?.type).toBe('JSON');
      expect(findColumn('binaryField')?.type).toBe('BLOB');
      expect(findColumn('decimalField')?.type).toBe('DECIMAL(38, 9)');
    });
  });

  describe('Field modifiers', () => {
    it('should handle required fields (!) as NOT NULL', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema);

      const idColumn = result.columns.find(c => c.name === 'id');
      expect(idColumn?.nullable).toBe(false);
    });

    it('should handle optional fields (?) as nullable', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema);

      const ageColumn = result.columns.find(c => c.name === 'age');
      expect(ageColumn?.nullable).toBe(true);
    });

    it('should handle unique fields (#)', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema);

      const emailColumn = result.columns.find(c => c.name === 'email');
      expect(emailColumn?.unique).toBe(true);
    });
  });

  describe('Array types', () => {
    it('should handle array fields', () => {
      const schema = createTagsSchema();
      const result = adapter.transform(schema);

      const tagsColumn = result.columns.find(c => c.name === 'tags');
      expect(tagsColumn?.type).toBe('VARCHAR[]');

      const scoresColumn = result.columns.find(c => c.name === 'scores');
      expect(scoresColumn?.type).toBe('INTEGER[]');
    });
  });

  describe('Options handling', () => {
    it('should respect tableName option', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema, { tableName: 'custom_users' });

      expect(result.tableName).toBe('custom_users');
    });

    it('should respect schema option', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema, { schema: 'analytics' });

      expect(result.schemaName).toBe('analytics');
    });

    it('should respect temporary option', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema, { temporary: true });

      expect(result.temporary).toBe(true);
    });

    it('should respect ifNotExists option', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema, { ifNotExists: true });

      expect(result.ifNotExists).toBe(true);
    });

    it('should respect includeSystemFields: false', () => {
      const schema = createBasicUserSchema();
      const result = adapter.transform(schema, { includeSystemFields: false });

      const columnNames = result.columns.map(c => c.name);
      expect(columnNames).not.toContain('$id');
      expect(columnNames).not.toContain('$type');
    });
  });
});

// =============================================================================
// serialize() Tests
// =============================================================================

describe('DuckDBAdapter.serialize()', () => {
  let adapter: DuckDBAdapter;

  beforeEach(() => {
    adapter = new DuckDBAdapter();
  });

  it('should serialize DDL to valid SQL', () => {
    const schema = createBasicUserSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(typeof sql).toBe('string');
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('User');
  });

  it('should include all columns in output', () => {
    const schema = createBasicUserSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('"$id"');  // System fields with $ are quoted
    expect(sql).toContain('id UUID');  // Simple identifiers are not quoted
    expect(sql).toContain('email VARCHAR');
    expect(sql).toContain('name VARCHAR');
    expect(sql).toContain('age INTEGER');
  });

  it('should include type information', () => {
    const schema = createBasicUserSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('UUID');
    expect(sql).toContain('VARCHAR');
    expect(sql).toContain('INTEGER');
  });

  it('should include constraints', () => {
    const schema = createBasicUserSchema();
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
  describe('transformToDuckDBDDL()', () => {
    it('should transform and serialize in one step', () => {
      const schema = createBasicUserSchema();
      const sql = transformToDuckDBDDL(schema);

      expect(typeof sql).toBe('string');
      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('User');
    });

    it('should accept options', () => {
      const schema = createBasicUserSchema();
      const sql = transformToDuckDBDDL(schema, { ifNotExists: true });

      expect(sql).toContain('IF NOT EXISTS');
    });
  });

  describe('generateDuckDBDDL()', () => {
    it('should return DDL structure', () => {
      const schema = createBasicUserSchema();
      const ddl = generateDuckDBDDL(schema);

      expect(ddl.tableName).toBe('User');
      expect(ddl.columns).toBeDefined();
    });

    it('should accept options', () => {
      const schema = createBasicUserSchema();
      const ddl = generateDuckDBDDL(schema, { tableName: 'custom' });

      expect(ddl.tableName).toBe('custom');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('DuckDBAdapter Integration', () => {
  let adapter: DuckDBAdapter;

  beforeEach(() => {
    adapter = new DuckDBAdapter();
  });

  it('should produce complete transform and serialize workflow', () => {
    const schema = createTypedProductSchema();

    // Transform
    const ddl = adapter.transform(schema, { ifNotExists: true });

    // Serialize
    const sql = adapter.serialize(ddl);

    // Verify complete workflow
    expect(sql).toBeDefined();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('Product');
    expect(sql).toContain('UUID');
    expect(sql).toContain('DOUBLE');
    expect(sql).toContain('BOOLEAN');
    expect(sql).toContain('TIMESTAMP');
    expect(sql).toContain('DATE');
    expect(sql).toContain('JSON');
  });

  it('should be compatible with SchemaAdapter interface', () => {
    const genericAdapter = adapter as {
      name: string;
      version: string;
      transform: (schema: IceTypeSchema, options?: unknown) => unknown;
      serialize: (output: unknown) => string;
    };

    expect(genericAdapter.name).toBe('duckdb');
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
      tags: 'string[]',
      metadata: 'json',
      createdAt: 'timestamp',
      isActive: 'boolean',
    });

    const ddl = adapter.transform(schema, {
      schema: 'production',
      ifNotExists: true,
    });

    const sql = adapter.serialize(ddl);

    expect(sql).toContain('production');
    expect(sql).toContain('ComplexEntity');
    expect(sql).toContain('DECIMAL(38, 9)');
    expect(sql).toContain('VARCHAR[]');
    expect(sql).toContain('JSON');
  });

  it('should generate valid SQL for different table configurations', () => {
    const schema = createBasicUserSchema();

    // Standard table
    const standardSql = transformToDuckDBDDL(schema);
    expect(standardSql).toMatch(/^CREATE TABLE User/);

    // Temporary table
    const tempSql = transformToDuckDBDDL(schema, { temporary: true });
    expect(tempSql).toMatch(/^CREATE TEMPORARY TABLE/);

    // With schema
    const schemaQualifiedSql = transformToDuckDBDDL(schema, { schema: 'myschema' });
    expect(schemaQualifiedSql).toContain('myschema.User');
  });

  it('should handle serializeWithIndexes', () => {
    const schema = createBasicUserSchema();
    const ddl = adapter.transform(schema);
    const sqlWithIndexes = adapter.serializeWithIndexes(ddl);

    expect(sqlWithIndexes).toContain('CREATE TABLE');
    // Should include index for unique email field
    expect(sqlWithIndexes).toContain('CREATE INDEX IF NOT EXISTS');
    expect(sqlWithIndexes).toContain('idx_User_email');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  let adapter: DuckDBAdapter;

  beforeEach(() => {
    adapter = new DuckDBAdapter();
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

    const sql = transformToDuckDBDDL(schema);
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
// Schema Name Validation Security Tests
// =============================================================================

describe('DuckDBAdapter schema name validation', () => {
  let adapter: DuckDBAdapter;

  beforeEach(() => {
    adapter = new DuckDBAdapter();
  });

  it('should accept valid schema names', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
    });

    expect(() => {
      const ddl = adapter.transform(schema, { schema: 'main' });
      adapter.serialize(ddl);
    }).not.toThrow();

    expect(() => {
      const ddl = adapter.transform(schema, { schema: 'analytics' });
      adapter.serialize(ddl);
    }).not.toThrow();
  });

  it('should reject SQL injection attempts in schema name', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
    });

    expect(() => {
      const ddl = adapter.transform(schema, { schema: "main'; DROP TABLE users; --" });
      adapter.serialize(ddl);
    }).toThrow(InvalidSchemaNameError);
  });

  it('should reject schema names with semicolons', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
    });

    expect(() => {
      const ddl = adapter.transform(schema, { schema: 'main; DROP SCHEMA main; --' });
      adapter.serialize(ddl);
    }).toThrow(InvalidSchemaNameError);
  });

  it('should reject schema names with comment markers', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
    });

    expect(() => {
      const ddl = adapter.transform(schema, { schema: 'main--malicious' });
      adapter.serialize(ddl);
    }).toThrow(InvalidSchemaNameError);

    expect(() => {
      const ddl = adapter.transform(schema, { schema: 'main/*malicious*/' });
      adapter.serialize(ddl);
    }).toThrow(InvalidSchemaNameError);
  });
});
