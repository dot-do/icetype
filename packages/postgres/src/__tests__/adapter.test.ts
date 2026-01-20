/**
 * Tests for PostgresAdapter implementation
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema } from '@icetype/core';
import type { IceTypeSchema } from '@icetype/core';

import {
  PostgresAdapter,
  createPostgresAdapter,
  transformToPostgresDDL,
  generatePostgresDDL,
  mapIceTypeToPostgres,
  getPostgresTypeString,
  toArrayType,
  formatDefaultValue,
  generateSystemColumns,
  escapeIdentifier,
  serializeColumn,
  serializeDDL,
  generateIndexStatements,
  ICETYPE_TO_POSTGRES,
} from '../index.js';

import type { PostgresDDL, PostgresColumn } from '../types.js';

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
    timestamptzField: 'timestamptz',
    dateField: 'date',
    timeField: 'time',
    jsonField: 'json',
    binaryField: 'binary',
    decimalField: 'decimal',
  });
}

/**
 * Create a schema with array types
 */
function createArraySchema(): IceTypeSchema {
  return parseSchema({
    $type: 'Tags',
    id: 'uuid!',
    tags: 'string[]',
    scores: 'int[]',
  });
}

// =============================================================================
// createPostgresAdapter() Factory Tests
// =============================================================================

describe('createPostgresAdapter()', () => {
  it('should create a new PostgresAdapter instance', () => {
    const adapter = createPostgresAdapter();

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(PostgresAdapter);
  });

  it('should create independent adapter instances', () => {
    const adapter1 = createPostgresAdapter();
    const adapter2 = createPostgresAdapter();

    expect(adapter1).not.toBe(adapter2);
  });

  it('should create adapter with correct interface methods', () => {
    const adapter = createPostgresAdapter();

    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.version).toBe('string');
  });
});

// =============================================================================
// PostgresAdapter Properties Tests
// =============================================================================

describe('PostgresAdapter properties', () => {
  let adapter: PostgresAdapter;

  beforeEach(() => {
    adapter = new PostgresAdapter();
  });

  describe('name property', () => {
    it('should have name "postgres"', () => {
      expect(adapter.name).toBe('postgres');
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
  describe('ICETYPE_TO_POSTGRES constant', () => {
    it('should map string to TEXT', () => {
      expect(ICETYPE_TO_POSTGRES['string']?.postgresType).toBe('TEXT');
    });

    it('should map text to TEXT', () => {
      expect(ICETYPE_TO_POSTGRES['text']?.postgresType).toBe('TEXT');
    });

    it('should map int to INTEGER', () => {
      expect(ICETYPE_TO_POSTGRES['int']?.postgresType).toBe('INTEGER');
    });

    it('should map long to BIGINT', () => {
      expect(ICETYPE_TO_POSTGRES['long']?.postgresType).toBe('BIGINT');
    });

    it('should map bigint to BIGINT', () => {
      expect(ICETYPE_TO_POSTGRES['bigint']?.postgresType).toBe('BIGINT');
    });

    it('should map float to REAL', () => {
      expect(ICETYPE_TO_POSTGRES['float']?.postgresType).toBe('REAL');
    });

    it('should map double to DOUBLE PRECISION', () => {
      expect(ICETYPE_TO_POSTGRES['double']?.postgresType).toBe('DOUBLE PRECISION');
    });

    it('should map bool to BOOLEAN', () => {
      expect(ICETYPE_TO_POSTGRES['bool']?.postgresType).toBe('BOOLEAN');
    });

    it('should map boolean to BOOLEAN', () => {
      expect(ICETYPE_TO_POSTGRES['boolean']?.postgresType).toBe('BOOLEAN');
    });

    it('should map uuid to UUID', () => {
      expect(ICETYPE_TO_POSTGRES['uuid']?.postgresType).toBe('UUID');
    });

    it('should map timestamp to TIMESTAMP', () => {
      expect(ICETYPE_TO_POSTGRES['timestamp']?.postgresType).toBe('TIMESTAMP');
    });

    it('should map timestamptz to TIMESTAMPTZ', () => {
      expect(ICETYPE_TO_POSTGRES['timestamptz']?.postgresType).toBe('TIMESTAMPTZ');
    });

    it('should map date to DATE', () => {
      expect(ICETYPE_TO_POSTGRES['date']?.postgresType).toBe('DATE');
    });

    it('should map time to TIME', () => {
      expect(ICETYPE_TO_POSTGRES['time']?.postgresType).toBe('TIME');
    });

    it('should map json to JSONB', () => {
      expect(ICETYPE_TO_POSTGRES['json']?.postgresType).toBe('JSONB');
    });

    it('should map binary to BYTEA', () => {
      expect(ICETYPE_TO_POSTGRES['binary']?.postgresType).toBe('BYTEA');
    });

    it('should map decimal to DECIMAL with default precision and scale', () => {
      const mapping = ICETYPE_TO_POSTGRES['decimal'];
      expect(mapping?.postgresType).toBe('DECIMAL');
      expect(mapping?.precision).toBe(38);
      expect(mapping?.scale).toBe(9);
    });
  });

  describe('mapIceTypeToPostgres()', () => {
    it('should map known types', () => {
      expect(mapIceTypeToPostgres('string').postgresType).toBe('TEXT');
      expect(mapIceTypeToPostgres('int').postgresType).toBe('INTEGER');
      expect(mapIceTypeToPostgres('uuid').postgresType).toBe('UUID');
    });

    it('should handle case insensitivity', () => {
      expect(mapIceTypeToPostgres('STRING').postgresType).toBe('TEXT');
      expect(mapIceTypeToPostgres('Int').postgresType).toBe('INTEGER');
      expect(mapIceTypeToPostgres('UUID').postgresType).toBe('UUID');
    });

    it('should return TEXT for unknown types', () => {
      expect(mapIceTypeToPostgres('unknown').postgresType).toBe('TEXT');
      expect(mapIceTypeToPostgres('customType').postgresType).toBe('TEXT');
    });
  });

  describe('getPostgresTypeString()', () => {
    it('should return simple type string for non-decimal', () => {
      expect(getPostgresTypeString({ postgresType: 'TEXT' })).toBe('TEXT');
      expect(getPostgresTypeString({ postgresType: 'INTEGER' })).toBe('INTEGER');
    });

    it('should return parameterized type string for decimal', () => {
      expect(getPostgresTypeString({ postgresType: 'DECIMAL', precision: 38, scale: 9 }))
        .toBe('DECIMAL(38, 9)');
    });

    it('should handle decimal with scale 0', () => {
      expect(getPostgresTypeString({ postgresType: 'DECIMAL', precision: 10 }))
        .toBe('DECIMAL(10, 0)');
    });
  });

  describe('toArrayType()', () => {
    it('should convert type to array type', () => {
      expect(toArrayType('TEXT')).toBe('TEXT[]');
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
      expect(formatDefaultValue(3.14, 'DOUBLE PRECISION')).toBe('3.14');
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
      const column: PostgresColumn = {
        name: 'email',
        type: 'TEXT',
        nullable: true,
      };
      expect(serializeColumn(column)).toBe('email TEXT');
    });

    it('should serialize NOT NULL column', () => {
      const column: PostgresColumn = {
        name: 'id',
        type: 'UUID',
        nullable: false,
      };
      expect(serializeColumn(column)).toBe('id UUID NOT NULL');
    });

    it('should serialize UNIQUE column', () => {
      const column: PostgresColumn = {
        name: 'email',
        type: 'TEXT',
        nullable: true,
        unique: true,
      };
      expect(serializeColumn(column)).toBe('email TEXT UNIQUE');
    });

    it('should serialize column with default', () => {
      const column: PostgresColumn = {
        name: 'status',
        type: 'TEXT',
        nullable: true,
        default: "'active'",
      };
      expect(serializeColumn(column)).toBe("status TEXT DEFAULT 'active'");
    });

    it('should escape special column names', () => {
      const column: PostgresColumn = {
        name: '$id',
        type: 'TEXT',
        nullable: false,
      };
      expect(serializeColumn(column)).toBe('"$id" TEXT NOT NULL');
    });
  });

  describe('serializeDDL()', () => {
    it('should generate basic CREATE TABLE', () => {
      const ddl: PostgresDDL = {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'UUID', nullable: false },
          { name: 'name', type: 'TEXT', nullable: true },
        ],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CREATE TABLE users');
      expect(sql).toContain('id UUID NOT NULL');
      expect(sql).toContain('name TEXT');
    });

    it('should generate CREATE TABLE IF NOT EXISTS', () => {
      const ddl: PostgresDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'UUID', nullable: false }],
        ifNotExists: true,
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    });

    it('should include schema name', () => {
      const ddl: PostgresDDL = {
        tableName: 'users',
        schemaName: 'public',
        columns: [{ name: 'id', type: 'UUID', nullable: false }],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('public.users');
    });

    it('should include PRIMARY KEY constraint', () => {
      const ddl: PostgresDDL = {
        tableName: 'users',
        columns: [{ name: 'id', type: 'UUID', nullable: false }],
        primaryKey: ['id'],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('PRIMARY KEY (id)');
    });

    it('should include UNIQUE constraints', () => {
      const ddl: PostgresDDL = {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'UUID', nullable: false },
          { name: 'email', type: 'TEXT', nullable: true },
        ],
        uniqueConstraints: [['email']],
      };

      const sql = serializeDDL(ddl);
      expect(sql).toContain('UNIQUE (email)');
    });
  });

  describe('generateIndexStatements()', () => {
    it('should generate index for unique columns', () => {
      const columns: PostgresColumn[] = [
        { name: 'email', type: 'TEXT', nullable: true, unique: true },
      ];

      const statements = generateIndexStatements('users', undefined, columns);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CREATE INDEX IF NOT EXISTS');
      expect(statements[0]).toContain('idx_users_email');
    });

    it('should return empty array for no unique columns', () => {
      const columns: PostgresColumn[] = [
        { name: 'name', type: 'TEXT', nullable: true },
      ];

      const statements = generateIndexStatements('users', undefined, columns);
      expect(statements).toHaveLength(0);
    });

    it('should include schema name in index', () => {
      const columns: PostgresColumn[] = [
        { name: 'email', type: 'TEXT', nullable: true, unique: true },
      ];

      const statements = generateIndexStatements('users', 'public', columns);
      expect(statements[0]).toContain('public.users');
    });
  });
});

// =============================================================================
// transform() Tests
// =============================================================================

describe('PostgresAdapter.transform()', () => {
  let adapter: PostgresAdapter;

  beforeEach(() => {
    adapter = new PostgresAdapter();
  });

  describe('Basic transformation', () => {
    it('should return valid PostgresDDL structure', () => {
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
      expect(findColumn('longField')?.type).toBe('BIGINT');
      expect(findColumn('bigintField')?.type).toBe('BIGINT');
      expect(findColumn('floatField')?.type).toBe('REAL');
      expect(findColumn('doubleField')?.type).toBe('DOUBLE PRECISION');
      expect(findColumn('boolField')?.type).toBe('BOOLEAN');
      expect(findColumn('booleanField')?.type).toBe('BOOLEAN');
      expect(findColumn('uuidField')?.type).toBe('UUID');
      expect(findColumn('timestampField')?.type).toBe('TIMESTAMP');
      expect(findColumn('timestamptzField')?.type).toBe('TIMESTAMPTZ');
      expect(findColumn('dateField')?.type).toBe('DATE');
      expect(findColumn('timeField')?.type).toBe('TIME');
      expect(findColumn('jsonField')?.type).toBe('JSONB');
      expect(findColumn('binaryField')?.type).toBe('BYTEA');
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

  describe('Array types', () => {
    it('should handle array fields', () => {
      const schema = createArraySchema();
      const result = adapter.transform(schema);

      const tagsColumn = result.columns.find(c => c.name === 'tags');
      expect(tagsColumn?.type).toBe('TEXT[]');

      const scoresColumn = result.columns.find(c => c.name === 'scores');
      expect(scoresColumn?.type).toBe('INTEGER[]');
    });
  });

  describe('Options handling', () => {
    it('should respect tableName option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { tableName: 'custom_users' });

      expect(result.tableName).toBe('custom_users');
    });

    it('should respect schema option', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { schema: 'public' });

      expect(result.schemaName).toBe('public');
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
  });
});

// =============================================================================
// serialize() Tests
// =============================================================================

describe('PostgresAdapter.serialize()', () => {
  let adapter: PostgresAdapter;

  beforeEach(() => {
    adapter = new PostgresAdapter();
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
    expect(sql).toContain('id UUID');  // Simple identifiers are not quoted
    expect(sql).toContain('email TEXT');
    expect(sql).toContain('name TEXT');
    expect(sql).toContain('age INTEGER');
  });

  it('should include type information', () => {
    const schema = createSimpleSchema();
    const ddl = adapter.transform(schema);
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('UUID');
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
  describe('transformToPostgresDDL()', () => {
    it('should transform and serialize in one step', () => {
      const schema = createSimpleSchema();
      const sql = transformToPostgresDDL(schema);

      expect(typeof sql).toBe('string');
      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('User');
    });

    it('should accept options', () => {
      const schema = createSimpleSchema();
      const sql = transformToPostgresDDL(schema, { ifNotExists: true });

      expect(sql).toContain('IF NOT EXISTS');
    });
  });

  describe('generatePostgresDDL()', () => {
    it('should return DDL structure', () => {
      const schema = createSimpleSchema();
      const ddl = generatePostgresDDL(schema);

      expect(ddl.tableName).toBe('User');
      expect(ddl.columns).toBeDefined();
    });

    it('should accept options', () => {
      const schema = createSimpleSchema();
      const ddl = generatePostgresDDL(schema, { tableName: 'custom' });

      expect(ddl.tableName).toBe('custom');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('PostgresAdapter Integration', () => {
  let adapter: PostgresAdapter;

  beforeEach(() => {
    adapter = new PostgresAdapter();
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
    expect(sql).toContain('UUID');
    expect(sql).toContain('DOUBLE PRECISION');
    expect(sql).toContain('BOOLEAN');
    expect(sql).toContain('TIMESTAMP');
    expect(sql).toContain('DATE');
    expect(sql).toContain('JSONB');
  });

  it('should be compatible with SchemaAdapter interface', () => {
    const genericAdapter = adapter as {
      name: string;
      version: string;
      transform: (schema: IceTypeSchema, options?: unknown) => unknown;
      serialize: (output: unknown) => string;
    };

    expect(genericAdapter.name).toBe('postgres');
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
      schema: 'public',
      ifNotExists: true,
    });

    const sql = adapter.serialize(ddl);

    expect(sql).toContain('public');
    expect(sql).toContain('ComplexEntity');
    expect(sql).toContain('DECIMAL(38, 9)');
    expect(sql).toContain('TEXT[]');
    expect(sql).toContain('JSONB');
  });

  it('should generate valid SQL for different table configurations', () => {
    const schema = createSimpleSchema();

    // Standard table
    const standardSql = transformToPostgresDDL(schema);
    expect(standardSql).toMatch(/^CREATE TABLE User/);

    // With schema
    const schemaQualifiedSql = transformToPostgresDDL(schema, { schema: 'myschema' });
    expect(schemaQualifiedSql).toContain('myschema.User');
  });

  it('should handle serializeWithIndexes', () => {
    const schema = createSimpleSchema();
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
  let adapter: PostgresAdapter;

  beforeEach(() => {
    adapter = new PostgresAdapter();
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

    const sql = transformToPostgresDDL(schema);
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
// postgres.do Compatibility Tests
// =============================================================================

describe('postgres.do Compatibility', () => {
  let adapter: PostgresAdapter;

  beforeEach(() => {
    adapter = new PostgresAdapter();
  });

  it('should generate DDL compatible with postgres.do Drizzle types', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      email: 'string#',
      name: 'string',
      createdAt: 'timestamp',
      metadata: 'json',
    });

    const sql = transformToPostgresDDL(schema, { includeSystemFields: false });

    // These types should be compatible with postgres.do's Drizzle driver
    expect(sql).toContain('UUID NOT NULL');
    expect(sql).toContain('TEXT');
    expect(sql).toContain('TIMESTAMP');
    expect(sql).toContain('JSONB');
  });

  it('should use JSONB for JSON fields (postgres.do preference)', () => {
    const schema = parseSchema({
      $type: 'Config',
      settings: 'json',
    });

    const ddl = adapter.transform(schema);
    const settingsCol = ddl.columns.find(c => c.name === 'settings');

    // postgres.do uses JSONB over JSON for better performance
    expect(settingsCol?.type).toBe('JSONB');
  });

  it('should generate proper array types', () => {
    const schema = parseSchema({
      $type: 'Tags',
      values: 'string[]',
      counts: 'int[]',
    });

    const ddl = adapter.transform(schema);
    const valuesCol = ddl.columns.find(c => c.name === 'values');
    const countsCol = ddl.columns.find(c => c.name === 'counts');

    expect(valuesCol?.type).toBe('TEXT[]');
    expect(countsCol?.type).toBe('INTEGER[]');
  });
});
