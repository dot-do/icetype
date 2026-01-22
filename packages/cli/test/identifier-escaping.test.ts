/**
 * SQL Identifier Escaping Tests for CLI Commands
 *
 * Tests to verify that CLI commands properly escape SQL identifiers
 * to prevent SQL injection and handle special characters, spaces,
 * SQL keywords, etc.
 *
 * TDD: These tests should FAIL initially until the fix is applied.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a schema with a given name for testing identifier escaping
 */
function createSchemaWithName(name: string): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  fields.set('id', {
    name: 'id',
    type: 'uuid',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: true,
    isIndexed: false,
  });

  return {
    name,
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a schema with a field that has a given name for testing field escaping
 */
function createSchemaWithFieldName(
  tableName: string,
  fieldName: string
): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  fields.set('id', {
    name: 'id',
    type: 'uuid',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: true,
    isIndexed: false,
  });
  fields.set(fieldName, {
    name: fieldName,
    type: 'string',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: true, // Make it indexed to test index name escaping
  });

  return {
    name: tableName,
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// PostgreSQL Identifier Escaping Tests
// =============================================================================

describe('PostgreSQL identifier escaping', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('table names', () => {
    it('should escape table names with spaces', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithName('User Profile');

      const ddl = generatePostgresDDL(schema);

      // Table name with spaces should be quoted
      expect(ddl).toContain('"User Profile"');
      expect(ddl).not.toMatch(/CREATE TABLE User Profile/);
    });

    it('should escape table names with special characters', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithName('user-data');

      const ddl = generatePostgresDDL(schema);

      // Table name with hyphen should be quoted
      expect(ddl).toContain('"user-data"');
    });

    it('should escape SQL keywords as table names', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithName('select');

      const ddl = generatePostgresDDL(schema);

      // SQL keyword should be quoted (or at minimum, not break SQL)
      // The safest approach is to always quote identifiers
      expect(ddl).toContain('"select"');
    });

    it('should escape table names starting with numbers', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithName('123users');

      const ddl = generatePostgresDDL(schema);

      // Table name starting with number should be quoted
      expect(ddl).toContain('"123users"');
    });

    it('should escape double quotes in table names', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithName('User"Profile');

      const ddl = generatePostgresDDL(schema);

      // Double quotes inside identifier should be escaped as ""
      expect(ddl).toContain('"User""Profile"');
    });
  });

  describe('schema names', () => {
    it('should escape schema names with special characters', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithName('User');

      const ddl = generatePostgresDDL(schema, { schemaName: 'my-schema' });

      // Schema name with hyphen should be quoted
      expect(ddl).toContain('"my-schema"');
    });

    it('should escape SQL keywords as schema names', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithName('User');

      const ddl = generatePostgresDDL(schema, { schemaName: 'select' });

      // SQL keyword as schema name should be quoted
      expect(ddl).toContain('"select"');
    });

    it('should escape schema names with spaces', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithName('User');

      const ddl = generatePostgresDDL(schema, { schemaName: 'my schema' });

      // Schema name with spaces should be quoted
      expect(ddl).toContain('"my schema"');
    });
  });

  describe('field/column names', () => {
    it('should escape field names with spaces', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithFieldName('User', 'full name');

      const ddl = generatePostgresDDL(schema);

      // Field name with spaces should be quoted
      expect(ddl).toContain('"full name"');
    });

    it('should escape field names with special characters', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithFieldName('User', 'user-email');

      const ddl = generatePostgresDDL(schema);

      // Field name with hyphen should be quoted
      expect(ddl).toContain('"user-email"');
    });

    it('should escape SQL keywords as field names', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithFieldName('User', 'order');

      const ddl = generatePostgresDDL(schema);

      // SQL keyword as field name should be quoted
      expect(ddl).toContain('"order"');
    });
  });

  describe('index names', () => {
    it('should escape index names for tables with special characters', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithFieldName('User-Data', 'email');

      const ddl = generatePostgresDDL(schema);

      // Index name should be safely escaped
      // The index is on 'email' which is indexed
      expect(ddl).toContain('CREATE INDEX');
      // Index name should be quoted if it contains special chars
      expect(ddl).toMatch(/CREATE INDEX\s+(?:IF NOT EXISTS\s+)?"?idx_/);
    });

    it('should handle index names with special characters in column name', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithFieldName('User', 'user-email');

      const ddl = generatePostgresDDL(schema);

      // The index statement should properly quote the column name
      expect(ddl).toContain('("user-email")');
    });
  });

  describe('SQL injection prevention', () => {
    it('should prevent SQL injection via table name', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      // Attempt SQL injection via table name
      const schema = createSchemaWithName('users; DROP TABLE users; --');

      const ddl = generatePostgresDDL(schema);

      // Should be safely quoted, not execute the injection
      expect(ddl).toContain('"users; DROP TABLE users; --"');
      // Should NOT have an unquoted semicolon followed by DROP
      expect(ddl).not.toMatch(/CREATE TABLE[^"]*; DROP/);
    });

    it('should prevent SQL injection via schema name', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithName('User');

      const ddl = generatePostgresDDL(schema, {
        schemaName: 'public; DROP SCHEMA public; --',
      });

      // Should be safely quoted
      expect(ddl).toContain('"public; DROP SCHEMA public; --"');
    });

    it('should prevent SQL injection via field name', async () => {
      const { generatePostgresDDL } = await import('../commands/postgres.js');
      const schema = createSchemaWithFieldName(
        'User',
        'name; DROP TABLE users; --'
      );

      const ddl = generatePostgresDDL(schema);

      // Field name should be quoted
      expect(ddl).toContain('"name; DROP TABLE users; --"');
    });
  });
});

// =============================================================================
// ClickHouse Identifier Escaping Tests
// =============================================================================

describe('ClickHouse identifier escaping', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('escapeIdentifier function', () => {
    it('should escape identifiers with special characters', async () => {
      const { escapeIdentifier } = await import('@icetype/clickhouse');

      // ClickHouse uses backticks for escaping
      expect(escapeIdentifier('user-data')).toBe('`user-data`');
      expect(escapeIdentifier('my table')).toBe('`my table`');
    });

    it('should escape identifiers starting with numbers', async () => {
      const { escapeIdentifier } = await import('@icetype/clickhouse');

      expect(escapeIdentifier('123users')).toBe('`123users`');
    });

    it('should handle backticks in identifier names', async () => {
      const { escapeIdentifier } = await import('@icetype/clickhouse');

      // Backticks inside should be escaped as ``
      expect(escapeIdentifier('user`data')).toBe('`user``data`');
    });

    it('should not escape simple valid identifiers', async () => {
      const { escapeIdentifier } = await import('@icetype/clickhouse');

      // Simple alphanumeric identifiers don't need escaping
      expect(escapeIdentifier('users')).toBe('users');
      expect(escapeIdentifier('user_data')).toBe('user_data');
    });
  });

  describe('DDL generation with special characters', () => {
    it('should generate safe DDL for tables with special characters', async () => {
      const { ClickHouseAdapter } = await import('@icetype/clickhouse');
      const adapter = new ClickHouseAdapter();

      const schema = createSchemaWithName('user-events');
      const ddl = adapter.transform(schema, {
        engine: 'MergeTree',
        database: 'analytics',
      });
      const sql = adapter.serialize(ddl);

      // Table name should be properly escaped
      expect(sql).toContain('`user-events`');
    });

    it('should reject databases with special characters for security', async () => {
      const { ClickHouseAdapter, InvalidSchemaNameError } = await import('@icetype/clickhouse');
      const adapter = new ClickHouseAdapter();

      const schema = createSchemaWithName('User');
      const ddl = adapter.transform(schema, {
        engine: 'MergeTree',
        database: 'my-analytics',
      });

      // Database names with special characters should be rejected for security
      expect(() => adapter.serialize(ddl)).toThrow(InvalidSchemaNameError);
    });

    it('should accept databases with underscores', async () => {
      const { ClickHouseAdapter } = await import('@icetype/clickhouse');
      const adapter = new ClickHouseAdapter();

      const schema = createSchemaWithName('User');
      const ddl = adapter.transform(schema, {
        engine: 'MergeTree',
        database: 'my_analytics',
      });
      const sql = adapter.serialize(ddl);

      // Database name with underscores should work
      expect(sql).toContain('my_analytics');
    });
  });
});

// =============================================================================
// DuckDB Identifier Escaping Tests
// =============================================================================

describe('DuckDB identifier escaping', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('escapeIdentifier function', () => {
    it('should escape identifiers with special characters', async () => {
      const { escapeIdentifier } = await import('@icetype/duckdb');

      // DuckDB uses double quotes for escaping
      expect(escapeIdentifier('user-data')).toBe('"user-data"');
      expect(escapeIdentifier('my table')).toBe('"my table"');
    });

    it('should escape identifiers starting with numbers', async () => {
      const { escapeIdentifier } = await import('@icetype/duckdb');

      expect(escapeIdentifier('123users')).toBe('"123users"');
    });

    it('should handle double quotes in identifier names', async () => {
      const { escapeIdentifier } = await import('@icetype/duckdb');

      // Double quotes inside should be escaped as ""
      expect(escapeIdentifier('user"data')).toBe('"user""data"');
    });

    it('should escape $ prefixed identifiers', async () => {
      const { escapeIdentifier } = await import('@icetype/duckdb');

      // System fields start with $ and need escaping
      expect(escapeIdentifier('$id')).toBe('"$id"');
      expect(escapeIdentifier('$createdAt')).toBe('"$createdAt"');
    });

    it('should not escape simple valid identifiers', async () => {
      const { escapeIdentifier } = await import('@icetype/duckdb');

      // Simple alphanumeric identifiers don't need escaping
      expect(escapeIdentifier('users')).toBe('users');
      expect(escapeIdentifier('user_data')).toBe('user_data');
    });
  });

  describe('DDL generation with special characters', () => {
    it('should generate safe DDL for tables with special characters', async () => {
      const { DuckDBAdapter } = await import('@icetype/duckdb');
      const adapter = new DuckDBAdapter();

      const schema = createSchemaWithName('user-events');
      const ddl = adapter.transform(schema, {
        schema: 'analytics',
      });
      const sql = adapter.serialize(ddl);

      // Table name should be properly escaped
      expect(sql).toContain('"user-events"');
    });

    it('should reject schemas with special characters for security', async () => {
      const { DuckDBAdapter, InvalidSchemaNameError } = await import('@icetype/duckdb');
      const adapter = new DuckDBAdapter();

      const schema = createSchemaWithName('User');
      const ddl = adapter.transform(schema, {
        schema: 'my-analytics',
      });

      // Schema names with special characters should be rejected for security
      expect(() => adapter.serialize(ddl)).toThrow(InvalidSchemaNameError);
    });

    it('should accept schemas with underscores', async () => {
      const { DuckDBAdapter } = await import('@icetype/duckdb');
      const adapter = new DuckDBAdapter();

      const schema = createSchemaWithName('User');
      const ddl = adapter.transform(schema, {
        schema: 'my_analytics',
      });
      const sql = adapter.serialize(ddl);

      // Schema name with underscores should work (unquoted is fine for simple identifiers)
      expect(sql).toContain('my_analytics');
    });
  });
});

// =============================================================================
// Cross-Adapter Consistency Tests
// =============================================================================

describe('Cross-adapter escaping consistency', () => {
  const specialNames = [
    'user-data',
    'my table',
    '123users',
    'User Profile',
    'data.set',
  ];

  it('should escape identifiers with special characters in ClickHouse', async () => {
    const { escapeIdentifier } = await import('@icetype/clickhouse');

    for (const name of specialNames) {
      const result = escapeIdentifier(name);
      // ClickHouse uses backticks
      expect(result).toMatch(/^`.*`$/);
    }
  });

  it('should escape identifiers with special characters in DuckDB', async () => {
    const { escapeIdentifier } = await import('@icetype/duckdb');

    for (const name of specialNames) {
      const result = escapeIdentifier(name);
      // DuckDB uses double quotes
      expect(result).toMatch(/^".*"$/);
    }
  });
});
