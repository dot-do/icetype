/**
 * ClickHouse Adapter Tests
 *
 * Comprehensive tests for the ClickHouse adapter including:
 * - Type mappings
 * - DDL generation
 * - Engine configurations
 * - Edge cases
 */

import { describe, it, expect } from 'vitest';
import { parseSchema } from '@icetype/core';
import {
  ClickHouseAdapter,
  createClickHouseAdapter,
  getClickHouseType,
  wrapNullable,
  getArrayType,
  escapeIdentifier,
  escapeString,
  escapeSettingKey,
  escapeSettingValue,
  InvalidSettingKeyError,
  InvalidSettingValueError,
  InvalidSchemaNameError,
  generateColumnDDL,
  generateEngineDDL,
  generateCreateTableDDL,
  generateDropTableDDL,
  generateAddColumnDDL,
  generateDropColumnDDL,
  isValidEngine,
  inferOrderBy,
  ICETYPE_TO_CLICKHOUSE,
  transformToClickHouseDDL,
  generateClickHouseDDL,
} from '../index.js';
import type { ClickHouseDDL, ClickHouseColumn } from '../types.js';

// =============================================================================
// Type Mapping Tests
// =============================================================================

describe('Type Mappings', () => {
  it('should map string types to String', () => {
    expect(getClickHouseType('string')).toBe('String');
    expect(getClickHouseType('text')).toBe('String');
    expect(getClickHouseType('varchar')).toBe('String');
    expect(getClickHouseType('char')).toBe('String');
  });

  it('should map integer types correctly', () => {
    expect(getClickHouseType('int')).toBe('Int32');
    expect(getClickHouseType('long')).toBe('Int64');
    expect(getClickHouseType('bigint')).toBe('Int64');
  });

  it('should map floating point types correctly', () => {
    expect(getClickHouseType('float')).toBe('Float32');
    expect(getClickHouseType('double')).toBe('Float64');
  });

  it('should map boolean type', () => {
    expect(getClickHouseType('bool')).toBe('Bool');
    expect(getClickHouseType('boolean')).toBe('Bool');
  });

  it('should map uuid type', () => {
    expect(getClickHouseType('uuid')).toBe('UUID');
  });

  it('should map timestamp types', () => {
    expect(getClickHouseType('timestamp')).toBe('DateTime64(3)');
    expect(getClickHouseType('timestamptz')).toBe('DateTime64(3)');
  });

  it('should map date type', () => {
    expect(getClickHouseType('date')).toBe('Date');
  });

  it('should map time to String (no native Time in ClickHouse)', () => {
    expect(getClickHouseType('time')).toBe('String');
  });

  it('should map json type', () => {
    expect(getClickHouseType('json')).toBe('JSON');
  });

  it('should map binary to String (base64)', () => {
    expect(getClickHouseType('binary')).toBe('String');
  });

  it('should map decimal with default precision', () => {
    expect(getClickHouseType('decimal')).toBe('Decimal(38, 9)');
  });

  it('should map decimal with custom precision and scale', () => {
    expect(getClickHouseType('decimal', 10, 2)).toBe('Decimal(10, 2)');
    expect(getClickHouseType('decimal', 18, 6)).toBe('Decimal(18, 6)');
    expect(getClickHouseType('decimal', 5)).toBe('Decimal(5, 0)');
  });

  it('should return String for unknown types', () => {
    expect(getClickHouseType('unknown')).toBe('String');
    expect(getClickHouseType('custom')).toBe('String');
  });

  it('should handle case-insensitive type names', () => {
    expect(getClickHouseType('STRING')).toBe('String');
    expect(getClickHouseType('Int')).toBe('Int32');
    expect(getClickHouseType('UUID')).toBe('UUID');
  });
});

// =============================================================================
// Nullable Wrapper Tests
// =============================================================================

describe('wrapNullable', () => {
  it('should wrap type in Nullable when nullable is true', () => {
    expect(wrapNullable('String', true)).toBe('Nullable(String)');
    expect(wrapNullable('Int32', true)).toBe('Nullable(Int32)');
  });

  it('should not wrap when nullable is false', () => {
    expect(wrapNullable('String', false)).toBe('String');
    expect(wrapNullable('Int32', false)).toBe('Int32');
  });

  it('should not double-wrap Nullable', () => {
    expect(wrapNullable('Nullable(String)', true)).toBe('Nullable(String)');
  });
});

// =============================================================================
// Array Type Tests
// =============================================================================

describe('getArrayType', () => {
  it('should create Array type', () => {
    expect(getArrayType('String')).toBe('Array(String)');
    expect(getArrayType('Int32')).toBe('Array(Int32)');
    expect(getArrayType('UUID')).toBe('Array(UUID)');
  });
});

// =============================================================================
// Identifier Escaping Tests
// =============================================================================

describe('escapeIdentifier', () => {
  it('should not escape simple identifiers', () => {
    expect(escapeIdentifier('users')).toBe('users');
    expect(escapeIdentifier('created_at')).toBe('created_at');
    expect(escapeIdentifier('userId')).toBe('userId');
  });

  it('should escape identifiers with special characters', () => {
    expect(escapeIdentifier('my-table')).toBe('`my-table`');
    expect(escapeIdentifier('my table')).toBe('`my table`');
    expect(escapeIdentifier('table.name')).toBe('`table.name`');
  });

  it('should escape identifiers starting with numbers', () => {
    expect(escapeIdentifier('123table')).toBe('`123table`');
  });

  it('should escape backticks within identifiers', () => {
    expect(escapeIdentifier('my`table')).toBe('`my``table`');
  });
});

// =============================================================================
// String Escaping Tests
// =============================================================================

describe('escapeString', () => {
  it('should wrap string in single quotes', () => {
    expect(escapeString('hello')).toBe("'hello'");
  });

  it('should escape single quotes', () => {
    expect(escapeString("it's")).toBe("'it''s'");
    expect(escapeString("'test'")).toBe("'''test'''");
  });
});

// =============================================================================
// Setting Key Escaping Tests
// =============================================================================

describe('escapeSettingKey', () => {
  it('should accept valid setting keys', () => {
    expect(escapeSettingKey('index_granularity')).toBe('index_granularity');
    expect(escapeSettingKey('storage_policy')).toBe('storage_policy');
    expect(escapeSettingKey('max_threads')).toBe('max_threads');
    expect(escapeSettingKey('_internal_setting')).toBe('_internal_setting');
    expect(escapeSettingKey('setting123')).toBe('setting123');
  });

  it('should reject empty keys', () => {
    expect(() => escapeSettingKey('')).toThrow(InvalidSettingKeyError);
  });

  it('should reject keys starting with numbers', () => {
    expect(() => escapeSettingKey('123setting')).toThrow(InvalidSettingKeyError);
    expect(() => escapeSettingKey('1_index')).toThrow(InvalidSettingKeyError);
  });

  it('should reject keys with special characters', () => {
    expect(() => escapeSettingKey('setting-name')).toThrow(InvalidSettingKeyError);
    expect(() => escapeSettingKey('setting.name')).toThrow(InvalidSettingKeyError);
    expect(() => escapeSettingKey('setting name')).toThrow(InvalidSettingKeyError);
    expect(() => escapeSettingKey('setting;DROP')).toThrow(InvalidSettingKeyError);
  });

  it('should reject SQL injection attempts in keys', () => {
    expect(() => escapeSettingKey("key'; DROP TABLE users; --")).toThrow(InvalidSettingKeyError);
    expect(() => escapeSettingKey('key=1; --')).toThrow(InvalidSettingKeyError);
    expect(() => escapeSettingKey('key/**/=')).toThrow(InvalidSettingKeyError);
    expect(() => escapeSettingKey("key' OR '1'='1")).toThrow(InvalidSettingKeyError);
  });

  it('should reject unicode/special characters', () => {
    expect(() => escapeSettingKey('setting\u0000')).toThrow(InvalidSettingKeyError);
    expect(() => escapeSettingKey('setting\n')).toThrow(InvalidSettingKeyError);
    expect(() => escapeSettingKey('setting\t')).toThrow(InvalidSettingKeyError);
  });
});

// =============================================================================
// Setting Value Escaping Tests
// =============================================================================

describe('escapeSettingValue', () => {
  it('should handle numeric strings', () => {
    expect(escapeSettingValue('8192')).toBe('8192');
    expect(escapeSettingValue('3.14')).toBe('3.14');
    expect(escapeSettingValue('-100')).toBe('-100');
    expect(escapeSettingValue('-3.5')).toBe('-3.5');
  });

  it('should handle actual numbers', () => {
    expect(escapeSettingValue(8192)).toBe('8192');
    expect(escapeSettingValue(3.14)).toBe('3.14');
    expect(escapeSettingValue(-100)).toBe('-100');
    expect(escapeSettingValue(0)).toBe('0');
  });

  it('should handle booleans', () => {
    expect(escapeSettingValue(true)).toBe('1');
    expect(escapeSettingValue(false)).toBe('0');
  });

  it('should escape string values', () => {
    expect(escapeSettingValue('fast_ssd')).toBe("'fast_ssd'");
    expect(escapeSettingValue('my policy')).toBe("'my policy'");
  });

  it('should escape single quotes in string values', () => {
    expect(escapeSettingValue("it's a test")).toBe("'it''s a test'");
    expect(escapeSettingValue("test'value")).toBe("'test''value'");
  });

  it('should handle pre-quoted strings safely', () => {
    // Should re-escape to ensure safety
    expect(escapeSettingValue("'fast_ssd'")).toBe("'fast_ssd'");
    expect(escapeSettingValue("'test''value'")).toBe("'test''''value'");
  });

  it('should reject invalid number values', () => {
    expect(() => escapeSettingValue(NaN)).toThrow(InvalidSettingValueError);
    expect(() => escapeSettingValue(Infinity)).toThrow(InvalidSettingValueError);
    expect(() => escapeSettingValue(-Infinity)).toThrow(InvalidSettingValueError);
  });

  it('should handle SQL injection attempts in string values', () => {
    // These should be safely escaped
    const malicious1 = escapeSettingValue("'; DROP TABLE users; --");
    expect(malicious1).toBe("'''; DROP TABLE users; --'");

    const malicious2 = escapeSettingValue("value' OR '1'='1");
    expect(malicious2).toBe("'value'' OR ''1''=''1'");

    const malicious3 = escapeSettingValue("1; DELETE FROM settings");
    expect(malicious3).toBe("'1; DELETE FROM settings'");
  });

  it('should handle special characters in string values', () => {
    expect(escapeSettingValue('value\nwith\nnewlines')).toBe("'value\nwith\nnewlines'");
    expect(escapeSettingValue('value\twith\ttabs')).toBe("'value\twith\ttabs'");
  });
});

// =============================================================================
// Settings Integration Tests
// =============================================================================

describe('generateCreateTableDDL with validated settings', () => {
  it('should generate SETTINGS with escaped values', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
      settings: {
        index_granularity: '8192',
        storage_policy: 'fast_ssd',
      },
    };

    const sql = generateCreateTableDDL(ddl);
    expect(sql).toContain('SETTINGS');
    expect(sql).toContain('index_granularity = 8192');
    expect(sql).toContain("storage_policy = 'fast_ssd'");
  });

  it('should throw on invalid setting keys', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
      settings: {
        'invalid-key': '8192',
      },
    };

    expect(() => generateCreateTableDDL(ddl)).toThrow(InvalidSettingKeyError);
  });

  it('should throw on SQL injection in setting keys', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
      settings: {
        "key'; DROP TABLE users; --": 'value',
      },
    };

    expect(() => generateCreateTableDDL(ddl)).toThrow(InvalidSettingKeyError);
  });

  it('should escape SQL injection attempts in setting values', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
      settings: {
        storage_policy: "'; DROP TABLE users; --",
      },
    };

    const sql = generateCreateTableDDL(ddl);
    // The malicious value should be escaped
    expect(sql).toContain("storage_policy = '''; DROP TABLE users; --'");
    // Should NOT contain unescaped injection
    expect(sql).not.toContain("storage_policy = '; DROP TABLE users; --");
  });
});

// =============================================================================
// Column DDL Generation Tests
// =============================================================================

describe('generateColumnDDL', () => {
  it('should generate basic column DDL', () => {
    const column: ClickHouseColumn = {
      name: 'id',
      type: 'UUID',
      nullable: false,
    };
    expect(generateColumnDDL(column)).toBe('id UUID');
  });

  it('should include default value', () => {
    const column: ClickHouseColumn = {
      name: 'created_at',
      type: 'DateTime64(3)',
      nullable: false,
      default: 'now()',
    };
    expect(generateColumnDDL(column)).toBe('created_at DateTime64(3) DEFAULT now()');
  });

  it('should include codec', () => {
    const column: ClickHouseColumn = {
      name: 'data',
      type: 'String',
      nullable: false,
      codec: 'ZSTD(3)',
    };
    expect(generateColumnDDL(column)).toBe('data String CODEC(ZSTD(3))');
  });

  it('should include comment', () => {
    const column: ClickHouseColumn = {
      name: 'email',
      type: 'String',
      nullable: false,
      comment: 'User email address',
    };
    expect(generateColumnDDL(column)).toBe("email String COMMENT 'User email address'");
  });

  it('should include TTL', () => {
    const column: ClickHouseColumn = {
      name: 'temp_data',
      type: 'String',
      nullable: true,
      ttl: 'created_at + INTERVAL 1 DAY',
    };
    expect(generateColumnDDL(column)).toBe('temp_data String TTL created_at + INTERVAL 1 DAY');
  });
});

// =============================================================================
// Engine DDL Generation Tests
// =============================================================================

describe('generateEngineDDL', () => {
  it('should generate MergeTree engine', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [],
      engine: 'MergeTree',
      orderBy: ['id'],
    };
    expect(generateEngineDDL(ddl)).toBe('ENGINE = MergeTree()');
  });

  it('should generate ReplacingMergeTree without version', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [],
      engine: 'ReplacingMergeTree',
      orderBy: ['id'],
    };
    expect(generateEngineDDL(ddl)).toBe('ENGINE = ReplacingMergeTree()');
  });

  it('should generate ReplacingMergeTree with version column', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [],
      engine: 'ReplacingMergeTree',
      orderBy: ['id'],
      versionColumn: 'version',
    };
    expect(generateEngineDDL(ddl)).toBe('ENGINE = ReplacingMergeTree(version)');
  });

  it('should generate SummingMergeTree without columns', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [],
      engine: 'SummingMergeTree',
      orderBy: ['id'],
    };
    expect(generateEngineDDL(ddl)).toBe('ENGINE = SummingMergeTree()');
  });

  it('should generate SummingMergeTree with sum columns', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [],
      engine: 'SummingMergeTree',
      orderBy: ['id'],
      sumColumns: ['count', 'total'],
    };
    expect(generateEngineDDL(ddl)).toBe('ENGINE = SummingMergeTree(count, total)');
  });

  it('should generate AggregatingMergeTree', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [],
      engine: 'AggregatingMergeTree',
      orderBy: ['id'],
    };
    expect(generateEngineDDL(ddl)).toBe('ENGINE = AggregatingMergeTree()');
  });

  it('should generate CollapsingMergeTree with sign column', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [],
      engine: 'CollapsingMergeTree',
      orderBy: ['id'],
      signColumn: 'sign',
    };
    expect(generateEngineDDL(ddl)).toBe('ENGINE = CollapsingMergeTree(sign)');
  });
});

// =============================================================================
// Full CREATE TABLE DDL Tests
// =============================================================================

describe('generateCreateTableDDL', () => {
  it('should generate basic CREATE TABLE', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'UUID', nullable: false },
        { name: 'name', type: 'String', nullable: false },
      ],
      engine: 'MergeTree',
      orderBy: ['id'],
    };

    const sql = generateCreateTableDDL(ddl);
    expect(sql).toContain('CREATE TABLE users');
    expect(sql).toContain('id UUID');
    expect(sql).toContain('name String');
    expect(sql).toContain('ENGINE = MergeTree()');
    expect(sql).toContain('ORDER BY (id)');
  });

  it('should include IF NOT EXISTS when specified', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
      ifNotExists: true,
    };

    const sql = generateCreateTableDDL(ddl);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
  });

  it('should include database name', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      database: 'analytics',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
    };

    const sql = generateCreateTableDDL(ddl);
    expect(sql).toContain('analytics.users');
  });

  it('should include PARTITION BY', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'events',
      columns: [
        { name: 'id', type: 'UUID', nullable: false },
        { name: 'created_at', type: 'DateTime64(3)', nullable: false },
      ],
      engine: 'MergeTree',
      orderBy: ['id'],
      partitionBy: 'toYYYYMM(created_at)',
    };

    const sql = generateCreateTableDDL(ddl);
    expect(sql).toContain('PARTITION BY toYYYYMM(created_at)');
  });

  it('should include PRIMARY KEY when different from ORDER BY', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'UUID', nullable: false },
        { name: 'tenant_id', type: 'String', nullable: false },
      ],
      engine: 'MergeTree',
      orderBy: ['tenant_id', 'id'],
      primaryKey: ['id'],
    };

    const sql = generateCreateTableDDL(ddl);
    expect(sql).toContain('PRIMARY KEY (id)');
    expect(sql).toContain('ORDER BY (tenant_id, id)');
  });

  it('should include SETTINGS', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
      settings: {
        index_granularity: '8192',
        storage_policy: 'fast_ssd',
      },
    };

    const sql = generateCreateTableDDL(ddl);
    expect(sql).toContain('SETTINGS');
    expect(sql).toContain('index_granularity = 8192');
    expect(sql).toContain("storage_policy = 'fast_ssd'");
  });

  it('should include TTL', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'logs',
      columns: [
        { name: 'id', type: 'UUID', nullable: false },
        { name: 'created_at', type: 'DateTime64(3)', nullable: false },
      ],
      engine: 'MergeTree',
      orderBy: ['id'],
      ttl: 'created_at + INTERVAL 30 DAY',
    };

    const sql = generateCreateTableDDL(ddl);
    expect(sql).toContain('TTL created_at + INTERVAL 30 DAY');
  });

  it('should use tuple() when no ORDER BY', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: [],
    };

    const sql = generateCreateTableDDL(ddl);
    expect(sql).toContain('ORDER BY tuple()');
  });
});

// =============================================================================
// DROP TABLE Tests
// =============================================================================

describe('generateDropTableDDL', () => {
  it('should generate DROP TABLE with IF EXISTS', () => {
    const sql = generateDropTableDDL('users');
    expect(sql).toBe('DROP TABLE IF EXISTS users');
  });

  it('should generate DROP TABLE without IF EXISTS', () => {
    const sql = generateDropTableDDL('users', undefined, false);
    expect(sql).toBe('DROP TABLE users');
  });

  it('should include database name', () => {
    const sql = generateDropTableDDL('users', 'analytics');
    expect(sql).toBe('DROP TABLE IF EXISTS analytics.users');
  });
});

// =============================================================================
// ALTER TABLE Tests
// =============================================================================

describe('generateAddColumnDDL', () => {
  it('should generate ADD COLUMN', () => {
    const column: ClickHouseColumn = {
      name: 'email',
      type: 'String',
      nullable: false,
    };
    const sql = generateAddColumnDDL('users', column);
    expect(sql).toBe('ALTER TABLE users ADD COLUMN email String');
  });

  it('should include AFTER clause', () => {
    const column: ClickHouseColumn = {
      name: 'email',
      type: 'String',
      nullable: false,
    };
    const sql = generateAddColumnDDL('users', column, undefined, 'name');
    expect(sql).toBe('ALTER TABLE users ADD COLUMN email String AFTER name');
  });
});

describe('generateDropColumnDDL', () => {
  it('should generate DROP COLUMN', () => {
    const sql = generateDropColumnDDL('users', 'email');
    expect(sql).toBe('ALTER TABLE users DROP COLUMN email');
  });

  it('should include database name', () => {
    const sql = generateDropColumnDDL('users', 'email', 'analytics');
    expect(sql).toBe('ALTER TABLE analytics.users DROP COLUMN email');
  });
});

// =============================================================================
// Engine Validation Tests
// =============================================================================

describe('isValidEngine', () => {
  it('should validate known engines', () => {
    expect(isValidEngine('MergeTree')).toBe(true);
    expect(isValidEngine('ReplacingMergeTree')).toBe(true);
    expect(isValidEngine('SummingMergeTree')).toBe(true);
    expect(isValidEngine('AggregatingMergeTree')).toBe(true);
    expect(isValidEngine('CollapsingMergeTree')).toBe(true);
  });

  it('should reject invalid engines', () => {
    expect(isValidEngine('InvalidEngine')).toBe(false);
    expect(isValidEngine('Memory')).toBe(false);
    expect(isValidEngine('')).toBe(false);
  });
});

// =============================================================================
// inferOrderBy Tests
// =============================================================================

describe('inferOrderBy', () => {
  it('should use existing orderBy if specified', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['created_at'],
    };
    expect(inferOrderBy(ddl)).toEqual(['created_at']);
  });

  it('should infer id column', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [
        { name: 'name', type: 'String', nullable: false },
        { name: 'id', type: 'UUID', nullable: false },
      ],
      engine: 'MergeTree',
      orderBy: [],
    };
    expect(inferOrderBy(ddl)).toEqual(['id']);
  });

  it('should infer timestamp column if no id', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [
        { name: 'name', type: 'String', nullable: false },
        { name: 'created_at', type: 'DateTime64(3)', nullable: false },
      ],
      engine: 'MergeTree',
      orderBy: [],
    };
    expect(inferOrderBy(ddl)).toEqual(['created_at']);
  });

  it('should use first column as fallback', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'test',
      columns: [
        { name: 'name', type: 'String', nullable: false },
        { name: 'email', type: 'String', nullable: false },
      ],
      engine: 'MergeTree',
      orderBy: [],
    };
    expect(inferOrderBy(ddl)).toEqual(['name']);
  });
});

// =============================================================================
// Adapter Tests
// =============================================================================

describe('ClickHouseAdapter', () => {
  it('should have correct name and version', () => {
    const adapter = new ClickHouseAdapter();
    expect(adapter.name).toBe('clickhouse');
    expect(adapter.version).toBe('0.1.0');
  });

  it('should transform basic schema', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      name: 'string',
      email: 'string#',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema);

    expect(ddl.tableName).toBe('user');
    expect(ddl.engine).toBe('MergeTree');
    expect(ddl.columns).toHaveLength(3);
  });

  it('should transform schema with options', () => {
    const schema = parseSchema({
      $type: 'Event',
      id: 'uuid!',
      created_at: 'timestamp!',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema, {
      engine: 'ReplacingMergeTree',
      orderBy: ['id'],
      partitionBy: 'toYYYYMM(created_at)',
      database: 'events_db',
    });

    expect(ddl.engine).toBe('ReplacingMergeTree');
    expect(ddl.orderBy).toEqual(['id']);
    expect(ddl.partitionBy).toBe('toYYYYMM(created_at)');
    expect(ddl.database).toBe('events_db');
  });

  it('should handle nullable fields', () => {
    const schema = parseSchema({
      $type: 'Product',
      id: 'uuid!',
      description: 'string?',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema);

    const descCol = ddl.columns.find((c) => c.name === 'description');
    expect(descCol?.type).toBe('Nullable(String)');
    expect(descCol?.nullable).toBe(true);
  });

  it('should handle array fields', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      tags: 'string[]',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema);

    const tagsCol = ddl.columns.find((c) => c.name === 'tags');
    expect(tagsCol?.type).toBe('Array(String)');
  });

  it('should convert camelCase to snake_case', () => {
    const schema = parseSchema({
      $type: 'UserProfile',
      userId: 'uuid!',
      createdAt: 'timestamp!',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema);

    expect(ddl.tableName).toBe('user_profile');
    expect(ddl.columns.some((c) => c.name === 'user_id')).toBe(true);
    expect(ddl.columns.some((c) => c.name === 'created_at')).toBe(true);
  });

  it('should serialize DDL to SQL', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      name: 'string',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema, { orderBy: ['id'] });
    const sql = adapter.serialize(ddl);

    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('user');
    expect(sql).toContain('id UUID');
    expect(sql).toContain('name String');
    expect(sql).toContain('ENGINE = MergeTree()');
    expect(sql).toContain('ORDER BY (id)');
  });

  it('should skip relation fields', () => {
    const schema = parseSchema({
      $type: 'Post',
      id: 'uuid!',
      title: 'string',
      author: '-> User',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema);

    // Should only have id and title, not author (relation)
    expect(ddl.columns).toHaveLength(2);
    expect(ddl.columns.find((c) => c.name === 'author')).toBeUndefined();
  });

  it('should infer partition from schema directives', () => {
    const schema = parseSchema({
      $type: 'Event',
      $partitionBy: ['createdAt'],
      id: 'uuid!',
      createdAt: 'timestamp!',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema);

    // Should infer partition by the DateTime field
    expect(ddl.partitionBy).toBe('toYYYYMM(created_at)');
  });

  it('should handle decimal types with precision', () => {
    const schema = parseSchema({
      $type: 'Product',
      id: 'uuid!',
      price: 'decimal(10,2)',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema);

    const priceCol = ddl.columns.find((c) => c.name === 'price');
    expect(priceCol?.type).toBe('Decimal(10, 2)');
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createClickHouseAdapter', () => {
  it('should create a new adapter instance', () => {
    const adapter = createClickHouseAdapter();
    expect(adapter).toBeInstanceOf(ClickHouseAdapter);
    expect(adapter.name).toBe('clickhouse');
  });
});

// =============================================================================
// Type Mapping Constants Tests
// =============================================================================

describe('ICETYPE_TO_CLICKHOUSE', () => {
  it('should have all documented mappings', () => {
    expect(ICETYPE_TO_CLICKHOUSE['string']).toBe('String');
    expect(ICETYPE_TO_CLICKHOUSE['text']).toBe('String');
    expect(ICETYPE_TO_CLICKHOUSE['int']).toBe('Int32');
    expect(ICETYPE_TO_CLICKHOUSE['long']).toBe('Int64');
    expect(ICETYPE_TO_CLICKHOUSE['bigint']).toBe('Int64');
    expect(ICETYPE_TO_CLICKHOUSE['float']).toBe('Float32');
    expect(ICETYPE_TO_CLICKHOUSE['double']).toBe('Float64');
    expect(ICETYPE_TO_CLICKHOUSE['bool']).toBe('Bool');
    expect(ICETYPE_TO_CLICKHOUSE['boolean']).toBe('Bool');
    expect(ICETYPE_TO_CLICKHOUSE['uuid']).toBe('UUID');
    expect(ICETYPE_TO_CLICKHOUSE['timestamp']).toBe('DateTime64(3)');
    expect(ICETYPE_TO_CLICKHOUSE['date']).toBe('Date');
    expect(ICETYPE_TO_CLICKHOUSE['json']).toBe('JSON');
    expect(ICETYPE_TO_CLICKHOUSE['binary']).toBe('String');
    expect(ICETYPE_TO_CLICKHOUSE['decimal']).toBe('Decimal(38, 9)');
  });
});

// =============================================================================
// Convenience Function Tests
// =============================================================================

describe('transformToClickHouseDDL', () => {
  it('should exist as an exported function', () => {
    expect(typeof transformToClickHouseDDL).toBe('function');
  });

  it('should produce valid ClickHouse DDL string', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      name: 'string',
      email: 'string#',
    });

    const sql = transformToClickHouseDDL(schema);

    expect(typeof sql).toBe('string');
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('user');
    expect(sql).toContain('id UUID');
    expect(sql).toContain('name String');
    expect(sql).toContain('email String');
    expect(sql).toContain('ENGINE = MergeTree()');
    expect(sql).toContain('ORDER BY');
  });

  it('should work like adapter.transform() + adapter.serialize()', () => {
    const schema = parseSchema({
      $type: 'Event',
      id: 'uuid!',
      created_at: 'timestamp!',
      data: 'json?',
    });

    const adapter = new ClickHouseAdapter();
    const ddl = adapter.transform(schema);
    const expectedSql = adapter.serialize(ddl);

    const actualSql = transformToClickHouseDDL(schema);

    expect(actualSql).toBe(expectedSql);
  });

  it('should pass options through correctly', () => {
    const schema = parseSchema({
      $type: 'Event',
      id: 'uuid!',
      created_at: 'timestamp!',
    });

    const sql = transformToClickHouseDDL(schema, {
      engine: 'ReplacingMergeTree',
      orderBy: ['id'],
      partitionBy: 'toYYYYMM(created_at)',
      database: 'events_db',
      ifNotExists: true,
    });

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS events_db.event');
    expect(sql).toContain('ENGINE = ReplacingMergeTree()');
    expect(sql).toContain('PARTITION BY toYYYYMM(created_at)');
    expect(sql).toContain('ORDER BY (id)');
  });

  it('should handle complex options like settings and TTL', () => {
    const schema = parseSchema({
      $type: 'Logs',
      id: 'uuid!',
      message: 'string',
      created_at: 'timestamp!',
    });

    const sql = transformToClickHouseDDL(schema, {
      engine: 'MergeTree',
      orderBy: ['id'],
      ttl: 'created_at + INTERVAL 30 DAY',
      settings: {
        index_granularity: '8192',
      },
    });

    expect(sql).toContain('TTL created_at + INTERVAL 30 DAY');
    expect(sql).toContain('SETTINGS');
    expect(sql).toContain('index_granularity = 8192');
  });
});

// =============================================================================
// generateClickHouseDDL Tests
// =============================================================================

describe('generateClickHouseDDL', () => {
  it('should exist as an exported function', () => {
    expect(typeof generateClickHouseDDL).toBe('function');
  });

  it('should return a ClickHouseDDL structure (not a string)', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      name: 'string',
    });

    const ddl = generateClickHouseDDL(schema);

    expect(typeof ddl).toBe('object');
    expect(ddl.tableName).toBe('user');
    expect(ddl.engine).toBe('MergeTree');
    expect(Array.isArray(ddl.columns)).toBe(true);
    expect(Array.isArray(ddl.orderBy)).toBe(true);
  });

  it('should pass options through to the DDL structure', () => {
    const schema = parseSchema({
      $type: 'Event',
      id: 'uuid!',
      created_at: 'timestamp!',
    });

    const ddl = generateClickHouseDDL(schema, {
      engine: 'ReplacingMergeTree',
      orderBy: ['id'],
      database: 'analytics',
    });

    expect(ddl.engine).toBe('ReplacingMergeTree');
    expect(ddl.orderBy).toEqual(['id']);
    expect(ddl.database).toBe('analytics');
  });
});

// =============================================================================
// Database Name Validation Security Tests
// =============================================================================

describe('ClickHouse database name validation', () => {
  it('should accept valid database names', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      database: 'analytics',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
    };

    expect(() => generateCreateTableDDL(ddl)).not.toThrow();
  });

  it('should accept database names with underscores', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      database: 'my_analytics_db',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
    };

    expect(() => generateCreateTableDDL(ddl)).not.toThrow();
  });

  it('should reject SQL injection attempts in database name', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      database: "analytics'; DROP DATABASE analytics; --",
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
    };

    expect(() => generateCreateTableDDL(ddl)).toThrow(InvalidSchemaNameError);
  });

  it('should reject database names with semicolons', () => {
    const ddl: ClickHouseDDL = {
      tableName: 'users',
      database: 'analytics; DROP DATABASE analytics; --',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
    };

    expect(() => generateCreateTableDDL(ddl)).toThrow(InvalidSchemaNameError);
  });

  it('should reject database names with comment markers', () => {
    const ddl1: ClickHouseDDL = {
      tableName: 'users',
      database: 'analytics--malicious',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
    };

    expect(() => generateCreateTableDDL(ddl1)).toThrow(InvalidSchemaNameError);

    const ddl2: ClickHouseDDL = {
      tableName: 'users',
      database: 'analytics/*malicious*/',
      columns: [{ name: 'id', type: 'UUID', nullable: false }],
      engine: 'MergeTree',
      orderBy: ['id'],
    };

    expect(() => generateCreateTableDDL(ddl2)).toThrow(InvalidSchemaNameError);
  });

  it('should reject database names in DROP TABLE', () => {
    expect(() => {
      generateDropTableDDL('users', "analytics'; DROP DATABASE analytics; --");
    }).toThrow(InvalidSchemaNameError);
  });

  it('should reject database names in ADD COLUMN', () => {
    const column: ClickHouseColumn = {
      name: 'email',
      type: 'String',
      nullable: false,
    };

    expect(() => {
      generateAddColumnDDL('users', column, "analytics'; DROP DATABASE analytics; --");
    }).toThrow(InvalidSchemaNameError);
  });

  it('should reject database names in DROP COLUMN', () => {
    expect(() => {
      generateDropColumnDDL('users', 'email', "analytics'; DROP DATABASE analytics; --");
    }).toThrow(InvalidSchemaNameError);
  });
});
