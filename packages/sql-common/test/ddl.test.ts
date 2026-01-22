/**
 * Tests for shared SQL DDL utilities
 *
 * These tests cover the common DDL generation functionality
 * that is shared across DuckDB, PostgreSQL, and ClickHouse adapters.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import {
  escapeIdentifier,
  formatDefaultValue,
  serializeColumn,
  generateSystemColumns,
  generateIndexStatements,
  validateSchemaName,
  InvalidSchemaNameError,
  type SqlDialect,
  type SqlColumn,
} from '../src/index.js';

// =============================================================================
// escapeIdentifier() Tests
// =============================================================================

describe('escapeIdentifier()', () => {
  describe('for all dialects', () => {
    const dialects: SqlDialect[] = ['duckdb', 'postgres', 'clickhouse'];

    dialects.forEach((dialect) => {
      describe(`dialect: ${dialect}`, () => {
        it('should return simple identifiers unchanged', () => {
          expect(escapeIdentifier('users', dialect)).toBe('users');
          expect(escapeIdentifier('user_id', dialect)).toBe('user_id');
          expect(escapeIdentifier('Users', dialect)).toBe('Users');
          expect(escapeIdentifier('_private', dialect)).toBe('_private');
        });

        it('should escape identifiers starting with $', () => {
          const escaped = escapeIdentifier('$id', dialect);
          expect(escaped).not.toBe('$id');
          expect(escaped).toContain('$id');
        });

        it('should escape identifiers with special characters', () => {
          const escaped = escapeIdentifier('user-name', dialect);
          expect(escaped).not.toBe('user-name');
          expect(escaped).toContain('user-name');
        });

        it('should escape identifiers starting with a digit', () => {
          const escaped = escapeIdentifier('123table', dialect);
          expect(escaped).not.toBe('123table');
          expect(escaped).toContain('123table');
        });
      });
    });
  });

  describe('dialect-specific escaping', () => {
    it('should use double quotes for DuckDB', () => {
      expect(escapeIdentifier('$id', 'duckdb')).toBe('"$id"');
      expect(escapeIdentifier('user-name', 'duckdb')).toBe('"user-name"');
    });

    it('should use double quotes for PostgreSQL', () => {
      expect(escapeIdentifier('$id', 'postgres')).toBe('"$id"');
      expect(escapeIdentifier('user-name', 'postgres')).toBe('"user-name"');
    });

    it('should use backticks for ClickHouse', () => {
      expect(escapeIdentifier('$id', 'clickhouse')).toBe('`$id`');
      expect(escapeIdentifier('user-name', 'clickhouse')).toBe('`user-name`');
    });

    it('should escape embedded quote characters correctly', () => {
      // DuckDB/Postgres: double quotes inside double quotes become ""
      expect(escapeIdentifier('user"name', 'duckdb')).toBe('"user""name"');
      expect(escapeIdentifier('user"name', 'postgres')).toBe('"user""name"');

      // ClickHouse: backticks inside backticks become ``
      expect(escapeIdentifier('user`name', 'clickhouse')).toBe('`user``name`');
    });
  });

  describe('SQL reserved keywords (postgres)', () => {
    it('should escape SQL reserved keywords in PostgreSQL', () => {
      expect(escapeIdentifier('select', 'postgres')).toBe('"select"');
      expect(escapeIdentifier('table', 'postgres')).toBe('"table"');
      expect(escapeIdentifier('user', 'postgres')).toBe('"user"');
      expect(escapeIdentifier('order', 'postgres')).toBe('"order"');
    });
  });
});

// =============================================================================
// formatDefaultValue() Tests
// =============================================================================

describe('formatDefaultValue()', () => {
  describe('null values', () => {
    it('should return NULL for null', () => {
      expect(formatDefaultValue(null, 'TEXT')).toBe('NULL');
    });
  });

  describe('string values', () => {
    it('should wrap strings in single quotes', () => {
      expect(formatDefaultValue('hello', 'TEXT')).toBe("'hello'");
      expect(formatDefaultValue('', 'TEXT')).toBe("''");
    });

    it('should escape single quotes in strings', () => {
      expect(formatDefaultValue("it's", 'TEXT')).toBe("'it''s'");
      expect(formatDefaultValue("a'b'c", 'TEXT')).toBe("'a''b''c'");
    });
  });

  describe('number values', () => {
    it('should return numbers as strings', () => {
      expect(formatDefaultValue(42, 'INTEGER')).toBe('42');
      expect(formatDefaultValue(3.14, 'REAL')).toBe('3.14');
      expect(formatDefaultValue(-100, 'INTEGER')).toBe('-100');
      expect(formatDefaultValue(0, 'INTEGER')).toBe('0');
    });
  });

  describe('boolean values', () => {
    it('should return TRUE or FALSE', () => {
      expect(formatDefaultValue(true, 'BOOLEAN')).toBe('TRUE');
      expect(formatDefaultValue(false, 'BOOLEAN')).toBe('FALSE');
    });
  });

  describe('Date values', () => {
    it('should format dates as ISO strings for TIMESTAMP types', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const result = formatDefaultValue(date, 'TIMESTAMP');
      expect(result).toBe("'2024-01-15T10:30:00.000Z'");
    });

    it('should format dates as date-only for DATE types', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const result = formatDefaultValue(date, 'DATE');
      expect(result).toBe("'2024-01-15'");
    });
  });

  describe('array and object values', () => {
    it('should JSON serialize arrays', () => {
      const result = formatDefaultValue([1, 2, 3], 'JSON');
      expect(result).toBe("'[1,2,3]'");
    });

    it('should JSON serialize objects', () => {
      const result = formatDefaultValue({ a: 1, b: 2 }, 'JSON');
      expect(result).toBe("'{\"a\":1,\"b\":2}'");
    });

    it('should escape single quotes in JSON', () => {
      const result = formatDefaultValue({ name: "it's" }, 'JSON');
      expect(result).toBe("'{\"name\":\"it''s\"}'");
    });
  });
});

// =============================================================================
// serializeColumn() Tests
// =============================================================================

describe('serializeColumn()', () => {
  describe('basic column serialization', () => {
    it('should serialize a simple non-nullable column', () => {
      const column: SqlColumn = {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
      };
      expect(serializeColumn(column, 'duckdb')).toBe('id INTEGER NOT NULL');
      expect(serializeColumn(column, 'postgres')).toBe('id INTEGER NOT NULL');
    });

    it('should serialize a nullable column without NOT NULL', () => {
      const column: SqlColumn = {
        name: 'description',
        type: 'TEXT',
        nullable: true,
      };
      expect(serializeColumn(column, 'duckdb')).toBe('description TEXT');
      expect(serializeColumn(column, 'postgres')).toBe('description TEXT');
    });
  });

  describe('column with unique constraint', () => {
    it('should add UNIQUE for unique columns', () => {
      const column: SqlColumn = {
        name: 'email',
        type: 'TEXT',
        nullable: false,
        unique: true,
      };
      expect(serializeColumn(column, 'duckdb')).toBe('email TEXT NOT NULL UNIQUE');
      expect(serializeColumn(column, 'postgres')).toBe('email TEXT NOT NULL UNIQUE');
    });
  });

  describe('column with default value', () => {
    it('should add DEFAULT clause', () => {
      const column: SqlColumn = {
        name: 'version',
        type: 'INTEGER',
        nullable: false,
        default: '1',
      };
      expect(serializeColumn(column, 'duckdb')).toBe('version INTEGER NOT NULL DEFAULT 1');
      expect(serializeColumn(column, 'postgres')).toBe('version INTEGER NOT NULL DEFAULT 1');
    });
  });

  describe('column with special characters in name', () => {
    it('should escape column names starting with $', () => {
      const column: SqlColumn = {
        name: '$id',
        type: 'TEXT',
        nullable: false,
      };
      expect(serializeColumn(column, 'duckdb')).toBe('"$id" TEXT NOT NULL');
      expect(serializeColumn(column, 'postgres')).toBe('"$id" TEXT NOT NULL');
      expect(serializeColumn(column, 'clickhouse')).toBe('`$id` TEXT NOT NULL');
    });
  });
});

// =============================================================================
// generateSystemColumns() Tests
// =============================================================================

describe('generateSystemColumns()', () => {
  describe('for DuckDB', () => {
    it('should generate standard system columns', () => {
      const columns = generateSystemColumns('duckdb');

      expect(columns).toHaveLength(5);

      // Check $id column
      const idCol = columns.find((c) => c.name === '$id');
      expect(idCol).toBeDefined();
      expect(idCol?.type).toBe('VARCHAR');
      expect(idCol?.nullable).toBe(false);
      expect(idCol?.primaryKey).toBe(true);

      // Check $type column
      const typeCol = columns.find((c) => c.name === '$type');
      expect(typeCol).toBeDefined();
      expect(typeCol?.nullable).toBe(false);

      // Check $version column
      const versionCol = columns.find((c) => c.name === '$version');
      expect(versionCol).toBeDefined();
      expect(versionCol?.type).toBe('INTEGER');
      expect(versionCol?.default).toBe('1');

      // Check $createdAt column
      const createdCol = columns.find((c) => c.name === '$createdAt');
      expect(createdCol).toBeDefined();
      expect(createdCol?.type).toBe('BIGINT');

      // Check $updatedAt column
      const updatedCol = columns.find((c) => c.name === '$updatedAt');
      expect(updatedCol).toBeDefined();
      expect(updatedCol?.type).toBe('BIGINT');
    });
  });

  describe('for PostgreSQL', () => {
    it('should generate standard system columns with TEXT type', () => {
      const columns = generateSystemColumns('postgres');

      expect(columns).toHaveLength(5);

      // PostgreSQL uses TEXT instead of VARCHAR for $id
      const idCol = columns.find((c) => c.name === '$id');
      expect(idCol).toBeDefined();
      expect(idCol?.type).toBe('TEXT');
      expect(idCol?.primaryKey).toBe(true);

      const typeCol = columns.find((c) => c.name === '$type');
      expect(typeCol?.type).toBe('TEXT');
    });
  });

  describe('for ClickHouse', () => {
    it('should generate standard system columns with ClickHouse types', () => {
      const columns = generateSystemColumns('clickhouse');

      expect(columns).toHaveLength(5);

      // ClickHouse uses String type
      const idCol = columns.find((c) => c.name === '$id');
      expect(idCol).toBeDefined();
      expect(idCol?.type).toBe('String');

      const typeCol = columns.find((c) => c.name === '$type');
      expect(typeCol?.type).toBe('String');

      const versionCol = columns.find((c) => c.name === '$version');
      expect(versionCol?.type).toBe('Int32');
    });
  });
});

// =============================================================================
// generateIndexStatements() Tests
// =============================================================================

describe('generateIndexStatements()', () => {
  describe('for DuckDB', () => {
    it('should generate index statements for unique columns', () => {
      const columns: SqlColumn[] = [
        { name: 'id', type: 'VARCHAR', nullable: false },
        { name: 'email', type: 'VARCHAR', nullable: false, unique: true },
        { name: 'name', type: 'VARCHAR', nullable: true },
      ];

      const statements = generateIndexStatements('users', undefined, columns, 'duckdb');

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CREATE INDEX');
      expect(statements[0]).toContain('idx_users_email');
      expect(statements[0]).toContain('users');
      expect(statements[0]).toContain('email');
    });

    it('should use schema name in index statements', () => {
      const columns: SqlColumn[] = [
        { name: 'email', type: 'VARCHAR', nullable: false, unique: true },
      ];

      const statements = generateIndexStatements('users', 'main', columns, 'duckdb');

      expect(statements[0]).toContain('main');
      expect(statements[0]).toContain('users');
    });
  });

  describe('for PostgreSQL', () => {
    it('should generate PostgreSQL-compatible index statements', () => {
      const columns: SqlColumn[] = [
        { name: 'email', type: 'TEXT', nullable: false, unique: true },
      ];

      const statements = generateIndexStatements('users', undefined, columns, 'postgres');

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('CREATE INDEX');
      expect(statements[0]).toContain('IF NOT EXISTS');
    });
  });

  describe('for ClickHouse', () => {
    it('should not generate index statements (ClickHouse handles indexes differently)', () => {
      const columns: SqlColumn[] = [
        { name: 'email', type: 'String', nullable: false, unique: true },
      ];

      const statements = generateIndexStatements('users', undefined, columns, 'clickhouse');

      // ClickHouse uses ORDER BY and materialized indexes differently
      expect(statements).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should return empty array when no unique columns', () => {
      const columns: SqlColumn[] = [
        { name: 'id', type: 'VARCHAR', nullable: false },
        { name: 'name', type: 'VARCHAR', nullable: true },
      ];

      const statements = generateIndexStatements('users', undefined, columns, 'duckdb');
      expect(statements).toHaveLength(0);
    });

    it('should handle column names with $ by replacing in index name', () => {
      const columns: SqlColumn[] = [
        { name: '$email', type: 'VARCHAR', nullable: false, unique: true },
      ];

      const statements = generateIndexStatements('users', undefined, columns, 'duckdb');

      // Index name should have $ replaced with _
      expect(statements[0]).toContain('idx_users__email');
      // But the column reference in the statement still uses the escaped column name
      expect(statements[0]).toContain('"$email"');
    });
  });
});

// =============================================================================
// validateSchemaName() Tests
// =============================================================================

describe('validateSchemaName()', () => {
  describe('valid schema names', () => {
    it('should accept simple schema names', () => {
      expect(() => validateSchemaName('public')).not.toThrow();
      expect(() => validateSchemaName('main')).not.toThrow();
      expect(() => validateSchemaName('analytics')).not.toThrow();
      expect(() => validateSchemaName('my_schema')).not.toThrow();
    });

    it('should accept schema names starting with underscore', () => {
      expect(() => validateSchemaName('_private')).not.toThrow();
      expect(() => validateSchemaName('_internal_schema')).not.toThrow();
    });

    it('should accept schema names with numbers', () => {
      expect(() => validateSchemaName('schema1')).not.toThrow();
      expect(() => validateSchemaName('v2_schema')).not.toThrow();
      expect(() => validateSchemaName('my_schema_123')).not.toThrow();
    });

    it('should accept qualified names with dots', () => {
      expect(() => validateSchemaName('catalog.schema')).not.toThrow();
      expect(() => validateSchemaName('my_catalog.my_schema')).not.toThrow();
      expect(() => validateSchemaName('db.schema.table')).not.toThrow();
    });

    it('should accept uppercase schema names', () => {
      expect(() => validateSchemaName('PUBLIC')).not.toThrow();
      expect(() => validateSchemaName('MySchema')).not.toThrow();
    });
  });

  describe('invalid schema names', () => {
    it('should reject empty schema names', () => {
      expect(() => validateSchemaName('')).toThrow(InvalidSchemaNameError);
    });

    it('should reject schema names starting with numbers', () => {
      expect(() => validateSchemaName('123schema')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('1_schema')).toThrow(InvalidSchemaNameError);
    });

    it('should reject schema names with special characters', () => {
      expect(() => validateSchemaName('my-schema')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('my schema')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('schema@name')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('schema$name')).toThrow(InvalidSchemaNameError);
    });

    it('should reject trailing or leading dots', () => {
      expect(() => validateSchemaName('.schema')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('schema.')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('.schema.')).toThrow(InvalidSchemaNameError);
    });

    it('should reject consecutive dots', () => {
      expect(() => validateSchemaName('catalog..schema')).toThrow(InvalidSchemaNameError);
    });
  });

  describe('SQL injection prevention', () => {
    it('should reject SQL injection with semicolon', () => {
      expect(() => validateSchemaName('public; DROP TABLE users; --')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('schema;DELETE')).toThrow(InvalidSchemaNameError);
    });

    it('should reject SQL injection with comment markers', () => {
      expect(() => validateSchemaName('public--comment')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('public/*comment*/')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('schema/* DROP TABLE */')).toThrow(InvalidSchemaNameError);
    });

    it('should reject SQL injection with quotes', () => {
      expect(() => validateSchemaName("public'; DROP TABLE users; --")).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('public"; DROP TABLE users; --')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName("schema' OR '1'='1")).toThrow(InvalidSchemaNameError);
    });

    it('should reject control characters and unicode attacks', () => {
      expect(() => validateSchemaName('schema\u0000')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('schema\n')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('schema\t')).toThrow(InvalidSchemaNameError);
      expect(() => validateSchemaName('schema\r')).toThrow(InvalidSchemaNameError);
    });

    it('should reject backtick injection (ClickHouse)', () => {
      expect(() => validateSchemaName('schema`; DROP TABLE users; --')).toThrow(InvalidSchemaNameError);
    });
  });
});
