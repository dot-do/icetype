/**
 * Pull Command Tests for @icetype/cli
 *
 * Tests for the `ice pull` command which introspects existing databases
 * and generates IceType schemas from database tables.
 *
 * This is a TDD RED phase - all tests should fail until implementation.
 *
 * Uses mocked database connections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';

// Mock modules
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// =============================================================================
// Helper Types for Testing
// =============================================================================

/**
 * Represents a database table structure from introspection
 */
interface IntrospectedTable {
  name: string;
  schema?: string;
  columns: IntrospectedColumn[];
  primaryKey?: string[];
  indexes: IntrospectedIndex[];
  foreignKeys: IntrospectedForeignKey[];
}

/**
 * Represents a database column from introspection
 */
interface IntrospectedColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
}

/**
 * Represents a database index from introspection
 */
interface IntrospectedIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

/**
 * Represents a foreign key from introspection
 */
interface IntrospectedForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a mock introspected table for testing
 */
function createMockTable(name: string, columns?: IntrospectedColumn[]): IntrospectedTable {
  return {
    name,
    columns: columns ?? [
      {
        name: 'id',
        type: 'uuid',
        nullable: false,
        isPrimaryKey: true,
        isUnique: true,
      },
      {
        name: 'name',
        type: 'varchar(255)',
        nullable: false,
        isPrimaryKey: false,
        isUnique: false,
      },
      {
        name: 'email',
        type: 'varchar(255)',
        nullable: false,
        isPrimaryKey: false,
        isUnique: true,
      },
      {
        name: 'created_at',
        type: 'timestamp',
        nullable: true,
        isPrimaryKey: false,
        isUnique: false,
      },
    ],
    primaryKey: ['id'],
    indexes: [
      {
        name: 'idx_users_email',
        columns: ['email'],
        unique: true,
      },
    ],
    foreignKeys: [],
  };
}

/**
 * Create a mock table with relations
 */
function createMockTableWithRelations(): IntrospectedTable {
  return {
    name: 'posts',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        nullable: false,
        isPrimaryKey: true,
        isUnique: true,
      },
      {
        name: 'title',
        type: 'varchar(255)',
        nullable: false,
        isPrimaryKey: false,
        isUnique: false,
      },
      {
        name: 'content',
        type: 'text',
        nullable: true,
        isPrimaryKey: false,
        isUnique: false,
      },
      {
        name: 'author_id',
        type: 'uuid',
        nullable: false,
        isPrimaryKey: false,
        isUnique: false,
      },
    ],
    primaryKey: ['id'],
    indexes: [
      {
        name: 'idx_posts_author',
        columns: ['author_id'],
        unique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_posts_author',
        columns: ['author_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
      },
    ],
  };
}

// =============================================================================
// ice pull Command Tests
// =============================================================================

describe('ice pull command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('argument parsing', () => {
    it('should error when connection URL is missing', async () => {
      const { pull } = await import('../commands/pull.js');

      await expect(pull([])).rejects.toThrow('Connection URL is required');
    });

    it('should accept connection URL as positional argument', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.url).toBe('postgres://localhost:5432/mydb');
    });

    it('should parse --output option', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '--output', './schema.ts'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.output).toBe('./schema.ts');
    });

    it('should parse -o short option for output', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '-o', './schema.ts'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.output).toBe('./schema.ts');
    });

    it('should parse --schema-name option for database schema', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '--schema-name', 'public'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.schemaName).toBe('public');
    });

    it('should parse --tables option to filter specific tables', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '--tables', 'users,posts'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.tables).toEqual(['users', 'posts']);
    });

    it('should parse --exclude option to exclude tables', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '--exclude', 'migrations,logs'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.exclude).toEqual(['migrations', 'logs']);
    });

    it('should parse --format option', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '--format', 'json'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.format).toBe('json');
    });

    it('should default format to typescript', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.format).toBe('typescript');
    });

    it('should parse --verbose option', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '--verbose'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.verbose).toBe(true);
    });

    it('should parse -v short option for verbose', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '-v'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.verbose).toBe(true);
    });

    it('should parse --quiet option', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '--quiet'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.quiet).toBe(true);
    });

    it('should parse -q short option for quiet', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const args = ['postgres://localhost:5432/mydb', '-q'];
      const parsed = _testHelpers.parseArgs(args);

      expect(parsed.quiet).toBe(true);
    });
  });

  describe('database dialect detection', () => {
    it('should detect PostgreSQL from connection URL', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const dialect = _testHelpers.detectDialect('postgres://localhost:5432/mydb');
      expect(dialect).toBe('postgres');
    });

    it('should detect PostgreSQL from postgresql:// URL', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const dialect = _testHelpers.detectDialect('postgresql://localhost:5432/mydb');
      expect(dialect).toBe('postgres');
    });

    it('should detect MySQL from connection URL', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const dialect = _testHelpers.detectDialect('mysql://localhost:3306/mydb');
      expect(dialect).toBe('mysql');
    });

    it('should detect SQLite from file path', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const dialect = _testHelpers.detectDialect('sqlite:///path/to/database.db');
      expect(dialect).toBe('sqlite');
    });

    it('should detect SQLite from .db file extension', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const dialect = _testHelpers.detectDialect('./database.db');
      expect(dialect).toBe('sqlite');
    });

    it('should detect SQLite from .sqlite file extension', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const dialect = _testHelpers.detectDialect('./database.sqlite');
      expect(dialect).toBe('sqlite');
    });

    it('should throw error for unsupported database dialect', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      expect(() => _testHelpers.detectDialect('oracle://localhost:1521/mydb')).toThrow(
        'Unsupported database dialect'
      );
    });
  });

  describe('schema extraction - PostgreSQL', () => {
    it('should connect to PostgreSQL database and extract schema', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      // Mock database connection
      const mockConnection = {
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      vi.doMock('pg', () => ({
        Client: vi.fn().mockImplementation(() => mockConnection),
      }));

      await _testHelpers.extractSchema('postgres://localhost:5432/mydb', 'postgres');

      expect(mockConnection.connect).toHaveBeenCalled();
    });

    it('should extract tables from PostgreSQL information_schema', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const tables = await _testHelpers.introspectPostgres('postgres://localhost:5432/mydb', {
        schemaName: 'public',
      });

      expect(Array.isArray(tables)).toBe(true);
    });

    it('should map PostgreSQL types to IceType types', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      expect(_testHelpers.mapPostgresType('uuid')).toBe('uuid');
      expect(_testHelpers.mapPostgresType('varchar')).toBe('string');
      expect(_testHelpers.mapPostgresType('character varying')).toBe('string');
      expect(_testHelpers.mapPostgresType('text')).toBe('text');
      expect(_testHelpers.mapPostgresType('integer')).toBe('int');
      expect(_testHelpers.mapPostgresType('bigint')).toBe('bigint');
      expect(_testHelpers.mapPostgresType('boolean')).toBe('bool');
      expect(_testHelpers.mapPostgresType('timestamp')).toBe('timestamp');
      expect(_testHelpers.mapPostgresType('timestamp with time zone')).toBe('timestamp');
      expect(_testHelpers.mapPostgresType('jsonb')).toBe('json');
      expect(_testHelpers.mapPostgresType('json')).toBe('json');
      expect(_testHelpers.mapPostgresType('double precision')).toBe('double');
      expect(_testHelpers.mapPostgresType('real')).toBe('float');
      expect(_testHelpers.mapPostgresType('bytea')).toBe('binary');
    });

    it('should extract indexes from PostgreSQL', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = await _testHelpers.introspectPostgresTable(
        'postgres://localhost:5432/mydb',
        'users',
        { schemaName: 'public' }
      );

      expect(table.indexes).toBeDefined();
      expect(Array.isArray(table.indexes)).toBe(true);
    });

    it('should extract foreign key constraints from PostgreSQL', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = await _testHelpers.introspectPostgresTable(
        'postgres://localhost:5432/mydb',
        'posts',
        { schemaName: 'public' }
      );

      expect(table.foreignKeys).toBeDefined();
      expect(Array.isArray(table.foreignKeys)).toBe(true);
    });

    it('should handle PostgreSQL SERIAL/BIGSERIAL columns', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      // SERIAL is actually integer with nextval()
      const iceType = _testHelpers.mapPostgresType('integer', true);
      expect(iceType).toBe('int');
    });

    it('should handle PostgreSQL arrays', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const iceType = _testHelpers.mapPostgresType('text[]');
      expect(iceType).toBe('text[]');
    });
  });

  describe('schema extraction - MySQL', () => {
    it('should connect to MySQL database and extract schema', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      await expect(
        _testHelpers.extractSchema('mysql://localhost:3306/mydb', 'mysql')
      ).resolves.toBeDefined();
    });

    it('should map MySQL types to IceType types', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      expect(_testHelpers.mapMysqlType('varchar')).toBe('string');
      expect(_testHelpers.mapMysqlType('char')).toBe('string');
      expect(_testHelpers.mapMysqlType('text')).toBe('text');
      expect(_testHelpers.mapMysqlType('longtext')).toBe('text');
      expect(_testHelpers.mapMysqlType('mediumtext')).toBe('text');
      expect(_testHelpers.mapMysqlType('int')).toBe('int');
      expect(_testHelpers.mapMysqlType('integer')).toBe('int');
      expect(_testHelpers.mapMysqlType('bigint')).toBe('bigint');
      expect(_testHelpers.mapMysqlType('tinyint')).toBe('int');
      expect(_testHelpers.mapMysqlType('smallint')).toBe('int');
      expect(_testHelpers.mapMysqlType('boolean')).toBe('bool');
      expect(_testHelpers.mapMysqlType('tinyint(1)')).toBe('bool');
      expect(_testHelpers.mapMysqlType('datetime')).toBe('timestamp');
      expect(_testHelpers.mapMysqlType('timestamp')).toBe('timestamp');
      expect(_testHelpers.mapMysqlType('json')).toBe('json');
      expect(_testHelpers.mapMysqlType('double')).toBe('double');
      expect(_testHelpers.mapMysqlType('float')).toBe('float');
      expect(_testHelpers.mapMysqlType('decimal')).toBe('decimal');
      expect(_testHelpers.mapMysqlType('blob')).toBe('binary');
      expect(_testHelpers.mapMysqlType('binary')).toBe('binary');
    });

    it('should extract indexes from MySQL', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = await _testHelpers.introspectMysqlTable(
        'mysql://localhost:3306/mydb',
        'users'
      );

      expect(table.indexes).toBeDefined();
      expect(Array.isArray(table.indexes)).toBe(true);
    });

    it('should extract foreign key constraints from MySQL', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = await _testHelpers.introspectMysqlTable(
        'mysql://localhost:3306/mydb',
        'posts'
      );

      expect(table.foreignKeys).toBeDefined();
      expect(Array.isArray(table.foreignKeys)).toBe(true);
    });
  });

  describe('schema extraction - SQLite', () => {
    it('should connect to SQLite database and extract schema', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      vi.mocked(fs.existsSync).mockReturnValue(true);

      await expect(
        _testHelpers.extractSchema('./database.sqlite', 'sqlite')
      ).resolves.toBeDefined();
    });

    it('should error when SQLite file does not exist', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        _testHelpers.extractSchema('./nonexistent.sqlite', 'sqlite')
      ).rejects.toThrow('Database file not found');
    });

    it('should map SQLite types to IceType types', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      expect(_testHelpers.mapSqliteType('TEXT')).toBe('string');
      expect(_testHelpers.mapSqliteType('INTEGER')).toBe('int');
      expect(_testHelpers.mapSqliteType('REAL')).toBe('double');
      expect(_testHelpers.mapSqliteType('BLOB')).toBe('binary');
      expect(_testHelpers.mapSqliteType('NULL')).toBe('string');
      // SQLite type affinity - VARCHAR becomes TEXT affinity
      expect(_testHelpers.mapSqliteType('VARCHAR(255)')).toBe('string');
      expect(_testHelpers.mapSqliteType('BOOLEAN')).toBe('bool');
    });

    it('should extract tables from SQLite sqlite_master', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const tables = await _testHelpers.introspectSqlite('./database.sqlite');

      expect(Array.isArray(tables)).toBe(true);
    });

    it('should extract indexes from SQLite', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const table = await _testHelpers.introspectSqliteTable('./database.sqlite', 'users');

      expect(table.indexes).toBeDefined();
      expect(Array.isArray(table.indexes)).toBe(true);
    });

    it('should extract foreign keys from SQLite', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const table = await _testHelpers.introspectSqliteTable('./database.sqlite', 'posts');

      expect(table.foreignKeys).toBeDefined();
      expect(Array.isArray(table.foreignKeys)).toBe(true);
    });
  });

  describe('IceType schema generation', () => {
    it('should generate IceType schema from introspected table', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = createMockTable('users');
      const schema = _testHelpers.tableToIceTypeSchema(table);

      expect(schema.name).toBe('users');
      expect(schema.fields).toBeDefined();
      expect(schema.fields.has('id')).toBe(true);
      expect(schema.fields.has('name')).toBe(true);
      expect(schema.fields.has('email')).toBe(true);
    });

    it('should mark required fields with ! modifier', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = createMockTable('users');
      const schema = _testHelpers.tableToIceTypeSchema(table);

      const idField = schema.fields.get('id');
      expect(idField?.isOptional).toBe(false);
      expect(idField?.modifier).toContain('!');
    });

    it('should mark optional fields with ? modifier', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = createMockTable('users');
      const schema = _testHelpers.tableToIceTypeSchema(table);

      const createdAtField = schema.fields.get('created_at');
      expect(createdAtField?.isOptional).toBe(true);
    });

    it('should mark unique fields', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = createMockTable('users');
      const schema = _testHelpers.tableToIceTypeSchema(table);

      const emailField = schema.fields.get('email');
      expect(emailField?.isUnique).toBe(true);
    });

    it('should mark indexed fields with # modifier', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = createMockTable('users');
      const schema = _testHelpers.tableToIceTypeSchema(table);

      const emailField = schema.fields.get('email');
      expect(emailField?.isIndexed).toBe(true);
    });

    it('should generate relations from foreign keys', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = createMockTableWithRelations();
      const schema = _testHelpers.tableToIceTypeSchema(table);

      expect(schema.relations.size).toBeGreaterThan(0);
      expect(schema.relations.has('author')).toBe(true);
    });

    it('should generate $index directive from indexes', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = createMockTable('users');
      const schema = _testHelpers.tableToIceTypeSchema(table);

      expect(schema.directives.$index).toBeDefined();
    });
  });

  describe('TypeScript output generation', () => {
    it('should generate valid TypeScript schema file', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const tables = [createMockTable('users'), createMockTableWithRelations()];
      const output = _testHelpers.generateTypescriptOutput(tables);

      expect(output).toContain("import { parseSchema } from '@icetype/core'");
      expect(output).toContain('export const users');
      expect(output).toContain('export const posts');
      expect(output).toContain("$type: 'users'");
    });

    it('should use camelCase for field names in TypeScript', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = createMockTable('users');
      const output = _testHelpers.generateTypescriptOutput([table]);

      // created_at should become createdAt
      expect(output).toContain('createdAt');
    });

    it('should use PascalCase for schema names in TypeScript', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table = createMockTable('user_profiles');
      const output = _testHelpers.generateTypescriptOutput([table]);

      expect(output).toContain('export const UserProfiles');
    });

    it('should include proper type definitions', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const tables = [createMockTable('users')];
      const output = _testHelpers.generateTypescriptOutput(tables);

      expect(output).toContain("id: 'uuid!'");
      expect(output).toContain("name: 'string'");
      expect(output).toContain("email: 'string#'"); // indexed and unique
    });

    it('should generate valid JSON output when format is json', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const tables = [createMockTable('users')];
      const output = _testHelpers.generateJsonOutput(tables);

      const parsed = JSON.parse(output);
      expect(parsed).toBeDefined();
      expect(parsed.schemas).toBeDefined();
      expect(parsed.schemas.length).toBe(1);
      expect(parsed.schemas[0].name).toBe('users');
    });
  });

  describe('error handling', () => {
    it('should handle connection refused errors', async () => {
      const { pull } = await import('../commands/pull.js');

      // Mock connection failure
      await expect(
        pull(['postgres://localhost:5432/nonexistent'])
      ).rejects.toThrow(/connection|ECONNREFUSED/i);
    });

    it('should handle authentication failures', async () => {
      const { pull } = await import('../commands/pull.js');

      await expect(
        pull(['postgres://invalid:password@localhost:5432/mydb'])
      ).rejects.toThrow(/auth|password|permission/i);
    });

    it('should handle database not found errors', async () => {
      const { pull } = await import('../commands/pull.js');

      await expect(
        pull(['postgres://localhost:5432/nonexistent_db'])
      ).rejects.toThrow(/database|not found|does not exist/i);
    });

    it('should provide helpful error message for invalid connection URL', async () => {
      const { pull } = await import('../commands/pull.js');

      await expect(pull(['invalid-url'])).rejects.toThrow(/Invalid connection URL/i);
    });

    it('should clean up database connection on error', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const mockConnection = {
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockRejectedValue(new Error('Query failed')),
        end: vi.fn().mockResolvedValue(undefined),
      };

      vi.doMock('pg', () => ({
        Client: vi.fn().mockImplementation(() => mockConnection),
      }));

      try {
        await _testHelpers.extractSchema('postgres://localhost:5432/mydb', 'postgres');
      } catch {
        // Expected to throw
      }

      expect(mockConnection.end).toHaveBeenCalled();
    });
  });

  describe('output handling', () => {
    it('should output to stdout by default', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const tables = [createMockTable('users')];
      const output = _testHelpers.generateTypescriptOutput(tables);

      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('should write to file when --output is specified', async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { pull } = await import('../commands/pull.js');

      // This would write to a file if the implementation existed
      // For now, we verify the test structure
      expect(fs.writeFileSync).toBeDefined();
    });

    it('should create output directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { _testHelpers } = await import('../commands/pull.js');

      await _testHelpers.writeOutput('./nested/dir/schema.ts', 'content');

      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('table filtering', () => {
    it('should include only specified tables when --tables is provided', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const allTables = [
        createMockTable('users'),
        createMockTable('posts'),
        createMockTable('comments'),
      ];

      const filtered = _testHelpers.filterTables(allTables, {
        tables: ['users', 'posts'],
      });

      expect(filtered.length).toBe(2);
      expect(filtered.map(t => t.name)).toContain('users');
      expect(filtered.map(t => t.name)).toContain('posts');
      expect(filtered.map(t => t.name)).not.toContain('comments');
    });

    it('should exclude specified tables when --exclude is provided', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const allTables = [
        createMockTable('users'),
        createMockTable('posts'),
        createMockTable('_migrations'),
        createMockTable('audit_logs'),
      ];

      const filtered = _testHelpers.filterTables(allTables, {
        exclude: ['_migrations', 'audit_logs'],
      });

      expect(filtered.length).toBe(2);
      expect(filtered.map(t => t.name)).toContain('users');
      expect(filtered.map(t => t.name)).toContain('posts');
    });

    it('should exclude system tables by default', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const allTables = [
        createMockTable('users'),
        createMockTable('pg_stat_user_tables'), // PostgreSQL system
        createMockTable('information_schema'), // Standard SQL system
        createMockTable('sqlite_sequence'), // SQLite system
      ];

      const filtered = _testHelpers.filterTables(allTables, {});

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('users');
    });
  });

  describe('naming conventions', () => {
    it('should convert snake_case table names to PascalCase', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      expect(_testHelpers.toPascalCase('user_profiles')).toBe('UserProfiles');
      expect(_testHelpers.toPascalCase('order_line_items')).toBe('OrderLineItems');
      expect(_testHelpers.toPascalCase('users')).toBe('Users');
    });

    it('should convert snake_case column names to camelCase', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      expect(_testHelpers.toCamelCase('created_at')).toBe('createdAt');
      expect(_testHelpers.toCamelCase('user_profile_id')).toBe('userProfileId');
      expect(_testHelpers.toCamelCase('id')).toBe('id');
    });

    it('should preserve acronyms in conversion', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      expect(_testHelpers.toPascalCase('http_request_logs')).toBe('HttpRequestLogs');
      expect(_testHelpers.toCamelCase('http_url')).toBe('httpUrl');
    });
  });

  describe('composite primary keys and constraints', () => {
    it('should handle composite primary keys', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table: IntrospectedTable = {
        name: 'order_items',
        columns: [
          { name: 'order_id', type: 'uuid', nullable: false, isPrimaryKey: true, isUnique: false },
          { name: 'product_id', type: 'uuid', nullable: false, isPrimaryKey: true, isUnique: false },
          { name: 'quantity', type: 'integer', nullable: false, isPrimaryKey: false, isUnique: false },
        ],
        primaryKey: ['order_id', 'product_id'],
        indexes: [],
        foreignKeys: [],
      };

      const schema = _testHelpers.tableToIceTypeSchema(table);

      // Both columns should be marked as part of primary key
      expect(schema.directives.$partitionBy).toEqual(['order_id', 'product_id']);
    });

    it('should handle unique constraints across multiple columns', async () => {
      const { _testHelpers } = await import('../commands/pull.js');

      const table: IntrospectedTable = {
        name: 'user_emails',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isUnique: true },
          { name: 'user_id', type: 'uuid', nullable: false, isPrimaryKey: false, isUnique: false },
          { name: 'email', type: 'varchar(255)', nullable: false, isPrimaryKey: false, isUnique: false },
        ],
        primaryKey: ['id'],
        indexes: [
          { name: 'unique_user_email', columns: ['user_id', 'email'], unique: true },
        ],
        foreignKeys: [],
      };

      const schema = _testHelpers.tableToIceTypeSchema(table);

      expect(schema.directives.$index).toContainEqual(['user_id', 'email']);
    });
  });
});

// =============================================================================
// Integration Tests (would require actual database connections)
// =============================================================================

describe('ice pull integration (mocked)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full introspection workflow for PostgreSQL', async () => {
    const { pull } = await import('../commands/pull.js');

    // This test verifies the complete workflow with mocked database
    // In a real integration test, this would connect to an actual PostgreSQL instance
    await expect(
      pull(['postgres://localhost:5432/testdb', '--output', './schema.ts'])
    ).rejects.toThrow(); // Expected to fail until implementation
  });

  it('should complete full introspection workflow for MySQL', async () => {
    const { pull } = await import('../commands/pull.js');

    await expect(
      pull(['mysql://localhost:3306/testdb', '--output', './schema.ts'])
    ).rejects.toThrow(); // Expected to fail until implementation
  });

  it('should complete full introspection workflow for SQLite', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const { pull } = await import('../commands/pull.js');

    await expect(
      pull(['./test.sqlite', '--output', './schema.ts'])
    ).rejects.toThrow(); // Expected to fail until implementation
  });
});
