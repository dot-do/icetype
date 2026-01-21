/**
 * Unified Type Mappings Tests
 *
 * Tests for consolidating all type mappings into @icetype/core.
 *
 * The goal is to have a single `getTypeMapping(iceType, dialect)` function
 * that returns the correct type for any supported dialect.
 *
 * Currently type mappings are scattered across:
 * - packages/core/src/type-mappings.ts (partial - missing mysql, sqlite)
 * - packages/postgres/src/types.ts (ICETYPE_TO_POSTGRES)
 * - packages/mysql/src/types.ts (ICETYPE_TO_MYSQL)
 * - packages/sqlite/src/types.ts (ICETYPE_TO_SQLITE)
 * - packages/duckdb/src/types.ts (ICETYPE_TO_DUCKDB)
 * - packages/clickhouse/src/types.ts (ICETYPE_TO_CLICKHOUSE)
 *
 * This test file defines the expected unified API.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
// This import will fail because getUnifiedTypeMapping doesn't exist yet
import {
  getUnifiedTypeMapping,
  getAllDialects,
  getDialectMappings,
  type Dialect,
  type UnifiedTypeMapping,
} from '../unified-type-mappings.js';

// =============================================================================
// Supported Dialects
// =============================================================================

/**
 * All supported SQL dialects for type mapping.
 */
const ALL_DIALECTS: Dialect[] = [
  'postgres',
  'mysql',
  'sqlite',
  'clickhouse',
  'duckdb',
  'iceberg',
];

// =============================================================================
// Expected Type Mappings per Dialect
// =============================================================================

/**
 * Expected type mappings for each IceType primitive to each dialect.
 * This serves as the source of truth for what the unified API should return.
 */
const EXPECTED_MAPPINGS: Record<string, Record<Dialect, string>> = {
  // String types
  string: {
    postgres: 'TEXT',
    mysql: 'VARCHAR(255)',
    sqlite: 'TEXT',
    clickhouse: 'String',
    duckdb: 'VARCHAR',
    iceberg: 'string',
  },
  text: {
    postgres: 'TEXT',
    mysql: 'TEXT',
    sqlite: 'TEXT',
    clickhouse: 'String',
    duckdb: 'VARCHAR',
    iceberg: 'string',
  },
  varchar: {
    postgres: 'VARCHAR',
    mysql: 'VARCHAR(255)',
    sqlite: 'TEXT',
    clickhouse: 'String',
    duckdb: 'VARCHAR',
    iceberg: 'string',
  },

  // Integer types
  int: {
    postgres: 'INTEGER',
    mysql: 'INT',
    sqlite: 'INTEGER',
    clickhouse: 'Int32',
    duckdb: 'INTEGER',
    iceberg: 'int',
  },
  long: {
    postgres: 'BIGINT',
    mysql: 'BIGINT',
    sqlite: 'INTEGER',
    clickhouse: 'Int64',
    duckdb: 'BIGINT',
    iceberg: 'long',
  },
  bigint: {
    postgres: 'BIGINT',
    mysql: 'BIGINT',
    sqlite: 'INTEGER',
    clickhouse: 'Int64',
    duckdb: 'BIGINT',
    iceberg: 'long',
  },

  // Floating point types
  float: {
    postgres: 'REAL',
    mysql: 'FLOAT',
    sqlite: 'REAL',
    clickhouse: 'Float32',
    duckdb: 'REAL',
    iceberg: 'float',
  },
  double: {
    postgres: 'DOUBLE PRECISION',
    mysql: 'DOUBLE',
    sqlite: 'REAL',
    clickhouse: 'Float64',
    duckdb: 'DOUBLE',
    iceberg: 'double',
  },

  // Boolean
  bool: {
    postgres: 'BOOLEAN',
    mysql: 'TINYINT(1)',
    sqlite: 'INTEGER',
    clickhouse: 'Bool',
    duckdb: 'BOOLEAN',
    iceberg: 'boolean',
  },
  boolean: {
    postgres: 'BOOLEAN',
    mysql: 'TINYINT(1)',
    sqlite: 'INTEGER',
    clickhouse: 'Bool',
    duckdb: 'BOOLEAN',
    iceberg: 'boolean',
  },

  // UUID
  uuid: {
    postgres: 'UUID',
    mysql: 'CHAR(36)',
    sqlite: 'TEXT',
    clickhouse: 'UUID',
    duckdb: 'UUID',
    iceberg: 'uuid',
  },

  // Date/Time types
  timestamp: {
    postgres: 'TIMESTAMP',
    mysql: 'DATETIME',
    sqlite: 'TEXT',
    clickhouse: 'DateTime64(3)',
    duckdb: 'TIMESTAMP',
    iceberg: 'timestamp',
  },
  timestamptz: {
    postgres: 'TIMESTAMPTZ',
    mysql: 'DATETIME',
    sqlite: 'TEXT',
    clickhouse: 'DateTime64(3)',
    duckdb: 'TIMESTAMPTZ',
    iceberg: 'timestamptz',
  },
  date: {
    postgres: 'DATE',
    mysql: 'DATE',
    sqlite: 'TEXT',
    clickhouse: 'Date',
    duckdb: 'DATE',
    iceberg: 'date',
  },
  time: {
    postgres: 'TIME',
    mysql: 'TIME',
    sqlite: 'TEXT',
    clickhouse: 'String', // ClickHouse has no native TIME type
    duckdb: 'TIME',
    iceberg: 'time',
  },

  // Complex types
  json: {
    postgres: 'JSONB',
    mysql: 'JSON',
    sqlite: 'TEXT',
    clickhouse: 'JSON',
    duckdb: 'JSON',
    iceberg: 'string', // Iceberg stores JSON as string
  },
  binary: {
    postgres: 'BYTEA',
    mysql: 'BLOB',
    sqlite: 'BLOB',
    clickhouse: 'String', // Base64 encoded
    duckdb: 'BLOB',
    iceberg: 'binary',
  },
  decimal: {
    postgres: 'DECIMAL',
    mysql: 'DECIMAL(38, 9)',
    sqlite: 'REAL',
    clickhouse: 'Decimal(38, 9)',
    duckdb: 'DECIMAL',
    iceberg: 'decimal',
  },
};

// =============================================================================
// getUnifiedTypeMapping Tests
// =============================================================================

describe('getUnifiedTypeMapping', () => {
  describe('basic type mappings', () => {
    it('should map uuid to correct type per dialect', () => {
      expect(getUnifiedTypeMapping('uuid', 'postgres')).toBe('UUID');
      expect(getUnifiedTypeMapping('uuid', 'mysql')).toBe('CHAR(36)');
      expect(getUnifiedTypeMapping('uuid', 'sqlite')).toBe('TEXT');
      expect(getUnifiedTypeMapping('uuid', 'clickhouse')).toBe('UUID');
      expect(getUnifiedTypeMapping('uuid', 'duckdb')).toBe('UUID');
      expect(getUnifiedTypeMapping('uuid', 'iceberg')).toBe('uuid');
    });

    it('should map string to correct type per dialect', () => {
      expect(getUnifiedTypeMapping('string', 'postgres')).toBe('TEXT');
      expect(getUnifiedTypeMapping('string', 'mysql')).toBe('VARCHAR(255)');
      expect(getUnifiedTypeMapping('string', 'sqlite')).toBe('TEXT');
      expect(getUnifiedTypeMapping('string', 'clickhouse')).toBe('String');
      expect(getUnifiedTypeMapping('string', 'duckdb')).toBe('VARCHAR');
      expect(getUnifiedTypeMapping('string', 'iceberg')).toBe('string');
    });

    it('should map boolean types correctly per dialect', () => {
      // MySQL and SQLite use integers for booleans
      expect(getUnifiedTypeMapping('bool', 'mysql')).toBe('TINYINT(1)');
      expect(getUnifiedTypeMapping('bool', 'sqlite')).toBe('INTEGER');
      expect(getUnifiedTypeMapping('boolean', 'mysql')).toBe('TINYINT(1)');
      expect(getUnifiedTypeMapping('boolean', 'sqlite')).toBe('INTEGER');

      // Others have native boolean
      expect(getUnifiedTypeMapping('bool', 'postgres')).toBe('BOOLEAN');
      expect(getUnifiedTypeMapping('bool', 'clickhouse')).toBe('Bool');
      expect(getUnifiedTypeMapping('bool', 'duckdb')).toBe('BOOLEAN');
    });
  });

  describe('all IceType primitives for all dialects', () => {
    for (const [iceType, dialectMappings] of Object.entries(EXPECTED_MAPPINGS)) {
      describe(`${iceType} type`, () => {
        for (const dialect of ALL_DIALECTS) {
          it(`should map ${iceType} to ${dialectMappings[dialect]} for ${dialect}`, () => {
            expect(getUnifiedTypeMapping(iceType, dialect)).toBe(dialectMappings[dialect]);
          });
        }
      });
    }
  });

  describe('case insensitivity', () => {
    it('should handle uppercase IceType names', () => {
      expect(getUnifiedTypeMapping('STRING', 'postgres')).toBe('TEXT');
      expect(getUnifiedTypeMapping('UUID', 'mysql')).toBe('CHAR(36)');
      expect(getUnifiedTypeMapping('TIMESTAMP', 'sqlite')).toBe('TEXT');
    });

    it('should handle mixed case IceType names', () => {
      expect(getUnifiedTypeMapping('String', 'postgres')).toBe('TEXT');
      expect(getUnifiedTypeMapping('Uuid', 'mysql')).toBe('CHAR(36)');
      expect(getUnifiedTypeMapping('TimeStamp', 'duckdb')).toBe('TIMESTAMP');
    });
  });

  describe('parametric types', () => {
    it('should handle decimal with precision and scale', () => {
      expect(getUnifiedTypeMapping('decimal(10, 2)', 'postgres')).toBe('DECIMAL(10, 2)');
      expect(getUnifiedTypeMapping('decimal(10, 2)', 'mysql')).toBe('DECIMAL(10, 2)');
      expect(getUnifiedTypeMapping('decimal(10, 2)', 'clickhouse')).toBe('Decimal(10, 2)');
      expect(getUnifiedTypeMapping('decimal(10, 2)', 'duckdb')).toBe('DECIMAL(10, 2)');
      // SQLite doesn't support decimal, maps to REAL
      expect(getUnifiedTypeMapping('decimal(10, 2)', 'sqlite')).toBe('REAL');
      // Iceberg preserves parameters
      expect(getUnifiedTypeMapping('decimal(10, 2)', 'iceberg')).toBe('decimal(10, 2)');
    });

    it('should handle varchar with length', () => {
      expect(getUnifiedTypeMapping('varchar(100)', 'postgres')).toBe('VARCHAR(100)');
      expect(getUnifiedTypeMapping('varchar(100)', 'mysql')).toBe('VARCHAR(100)');
      // SQLite ignores length for TEXT affinity
      expect(getUnifiedTypeMapping('varchar(100)', 'sqlite')).toBe('TEXT');
      expect(getUnifiedTypeMapping('varchar(100)', 'duckdb')).toBe('VARCHAR(100)');
      expect(getUnifiedTypeMapping('varchar(100)', 'clickhouse')).toBe('String');
      expect(getUnifiedTypeMapping('varchar(100)', 'iceberg')).toBe('string');
    });

    it('should handle char with length', () => {
      expect(getUnifiedTypeMapping('char(10)', 'postgres')).toBe('CHAR(10)');
      expect(getUnifiedTypeMapping('char(10)', 'mysql')).toBe('CHAR(10)');
      expect(getUnifiedTypeMapping('char(10)', 'sqlite')).toBe('TEXT');
    });
  });

  describe('unknown types', () => {
    it('should throw UnknownTypeError for unknown IceType', () => {
      expect(() => getUnifiedTypeMapping('unknowntype', 'postgres')).toThrow();
      expect(() => getUnifiedTypeMapping('foobar', 'mysql')).toThrow();
    });

    it('should include helpful error message for unknown types', () => {
      try {
        getUnifiedTypeMapping('unknowntype', 'postgres');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('unknowntype');
        expect((error as Error).message).toContain('Unknown IceType');
      }
    });

    it('should throw for invalid dialect', () => {
      expect(() => getUnifiedTypeMapping('string', 'oracle' as Dialect)).toThrow();
      expect(() => getUnifiedTypeMapping('int', 'mssql' as Dialect)).toThrow();
    });
  });

  describe('alias types', () => {
    it('should treat bool and boolean as equivalent', () => {
      for (const dialect of ALL_DIALECTS) {
        expect(getUnifiedTypeMapping('bool', dialect)).toBe(
          getUnifiedTypeMapping('boolean', dialect)
        );
      }
    });

    it('should treat long and bigint as equivalent', () => {
      for (const dialect of ALL_DIALECTS) {
        expect(getUnifiedTypeMapping('long', dialect)).toBe(
          getUnifiedTypeMapping('bigint', dialect)
        );
      }
    });
  });
});

// =============================================================================
// getAllDialects Tests
// =============================================================================

describe('getAllDialects', () => {
  it('should return all supported dialects', () => {
    const dialects = getAllDialects();
    expect(dialects).toContain('postgres');
    expect(dialects).toContain('mysql');
    expect(dialects).toContain('sqlite');
    expect(dialects).toContain('clickhouse');
    expect(dialects).toContain('duckdb');
    expect(dialects).toContain('iceberg');
  });

  it('should return exactly 6 dialects', () => {
    const dialects = getAllDialects();
    expect(dialects).toHaveLength(6);
  });

  it('should return dialects in consistent order', () => {
    const dialects1 = getAllDialects();
    const dialects2 = getAllDialects();
    expect(dialects1).toEqual(dialects2);
  });
});

// =============================================================================
// getDialectMappings Tests
// =============================================================================

describe('getDialectMappings', () => {
  it('should return all type mappings for a dialect', () => {
    const postgresMappings = getDialectMappings('postgres');

    expect(postgresMappings['string']).toBe('TEXT');
    expect(postgresMappings['int']).toBe('INTEGER');
    expect(postgresMappings['uuid']).toBe('UUID');
    expect(postgresMappings['json']).toBe('JSONB');
  });

  it('should return all type mappings for mysql', () => {
    const mysqlMappings = getDialectMappings('mysql');

    expect(mysqlMappings['string']).toBe('VARCHAR(255)');
    expect(mysqlMappings['int']).toBe('INT');
    expect(mysqlMappings['uuid']).toBe('CHAR(36)');
    expect(mysqlMappings['bool']).toBe('TINYINT(1)');
  });

  it('should return all type mappings for sqlite', () => {
    const sqliteMappings = getDialectMappings('sqlite');

    expect(sqliteMappings['string']).toBe('TEXT');
    expect(sqliteMappings['int']).toBe('INTEGER');
    expect(sqliteMappings['uuid']).toBe('TEXT');
    expect(sqliteMappings['bool']).toBe('INTEGER');
    expect(sqliteMappings['json']).toBe('TEXT');
  });

  it('should include all IceType primitives', () => {
    const mappings = getDialectMappings('postgres');
    const expectedTypes = Object.keys(EXPECTED_MAPPINGS);

    for (const type of expectedTypes) {
      expect(mappings[type], `Missing mapping for ${type}`).toBeDefined();
    }
  });

  it('should throw for invalid dialect', () => {
    expect(() => getDialectMappings('oracle' as Dialect)).toThrow();
  });
});

// =============================================================================
// Type Compatibility Matrix Tests
// =============================================================================

describe('type compatibility matrix', () => {
  describe('numeric type widening', () => {
    it('should map int to smaller-or-equal size in all dialects', () => {
      // int should never map to something smaller than 32 bits
      const intMapping = getUnifiedTypeMapping('int', 'postgres');
      expect(intMapping).toBe('INTEGER'); // 32-bit in postgres
    });

    it('should map long/bigint to 64-bit integers where supported', () => {
      expect(getUnifiedTypeMapping('long', 'postgres')).toBe('BIGINT');
      expect(getUnifiedTypeMapping('long', 'mysql')).toBe('BIGINT');
      expect(getUnifiedTypeMapping('long', 'duckdb')).toBe('BIGINT');
      expect(getUnifiedTypeMapping('long', 'clickhouse')).toBe('Int64');
      // SQLite stores all integers in same INTEGER type
      expect(getUnifiedTypeMapping('long', 'sqlite')).toBe('INTEGER');
    });
  });

  describe('timestamp handling', () => {
    it('should handle timestamp without timezone consistently', () => {
      // All should support timestamp without timezone
      expect(getUnifiedTypeMapping('timestamp', 'postgres')).toBe('TIMESTAMP');
      expect(getUnifiedTypeMapping('timestamp', 'mysql')).toBe('DATETIME');
      expect(getUnifiedTypeMapping('timestamp', 'duckdb')).toBe('TIMESTAMP');
    });

    it('should handle timestamp with timezone where supported', () => {
      // postgres and duckdb have native timestamptz
      expect(getUnifiedTypeMapping('timestamptz', 'postgres')).toBe('TIMESTAMPTZ');
      expect(getUnifiedTypeMapping('timestamptz', 'duckdb')).toBe('TIMESTAMPTZ');
      // mysql doesn't have native timestamptz, uses DATETIME
      expect(getUnifiedTypeMapping('timestamptz', 'mysql')).toBe('DATETIME');
    });
  });

  describe('json handling', () => {
    it('should use native JSON type where available', () => {
      expect(getUnifiedTypeMapping('json', 'postgres')).toBe('JSONB');
      expect(getUnifiedTypeMapping('json', 'mysql')).toBe('JSON');
      expect(getUnifiedTypeMapping('json', 'duckdb')).toBe('JSON');
      expect(getUnifiedTypeMapping('json', 'clickhouse')).toBe('JSON');
    });

    it('should fall back to TEXT for databases without native JSON', () => {
      expect(getUnifiedTypeMapping('json', 'sqlite')).toBe('TEXT');
    });
  });

  describe('binary handling', () => {
    it('should use appropriate binary type per dialect', () => {
      expect(getUnifiedTypeMapping('binary', 'postgres')).toBe('BYTEA');
      expect(getUnifiedTypeMapping('binary', 'mysql')).toBe('BLOB');
      expect(getUnifiedTypeMapping('binary', 'sqlite')).toBe('BLOB');
      expect(getUnifiedTypeMapping('binary', 'duckdb')).toBe('BLOB');
      // ClickHouse stores binary as base64 string
      expect(getUnifiedTypeMapping('binary', 'clickhouse')).toBe('String');
    });
  });
});

// =============================================================================
// UnifiedTypeMapping interface Tests
// =============================================================================

describe('UnifiedTypeMapping interface', () => {
  it('should have correct structure with all dialects', () => {
    const mapping: UnifiedTypeMapping = {
      iceType: 'string',
      postgres: 'TEXT',
      mysql: 'VARCHAR(255)',
      sqlite: 'TEXT',
      clickhouse: 'String',
      duckdb: 'VARCHAR',
      iceberg: 'string',
    };

    expect(mapping.iceType).toBe('string');
    expect(mapping.postgres).toBeDefined();
    expect(mapping.mysql).toBeDefined();
    expect(mapping.sqlite).toBeDefined();
    expect(mapping.clickhouse).toBeDefined();
    expect(mapping.duckdb).toBeDefined();
    expect(mapping.iceberg).toBeDefined();
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  it('should handle empty string IceType', () => {
    expect(() => getUnifiedTypeMapping('', 'postgres')).toThrow();
  });

  it('should handle whitespace in IceType', () => {
    // Should trim whitespace
    expect(getUnifiedTypeMapping('  string  ', 'postgres')).toBe('TEXT');
  });

  it('should handle parametric types with whitespace', () => {
    expect(getUnifiedTypeMapping('decimal( 10 , 2 )', 'postgres')).toBe('DECIMAL(10, 2)');
    expect(getUnifiedTypeMapping('varchar( 100 )', 'mysql')).toBe('VARCHAR(100)');
  });

  it('should handle array types by returning base type for dialects without arrays', () => {
    // SQLite and others without native arrays should throw or return special handling
    expect(() => getUnifiedTypeMapping('string[]', 'sqlite')).toThrow();
    expect(() => getUnifiedTypeMapping('int[]', 'mysql')).toThrow();
  });

  it('should handle array types for dialects with native arrays', () => {
    // ClickHouse has native Array type
    expect(getUnifiedTypeMapping('string[]', 'clickhouse')).toBe('Array(String)');
    expect(getUnifiedTypeMapping('int[]', 'clickhouse')).toBe('Array(Int32)');
    // DuckDB also supports arrays
    expect(getUnifiedTypeMapping('string[]', 'duckdb')).toBe('VARCHAR[]');
    expect(getUnifiedTypeMapping('int[]', 'duckdb')).toBe('INTEGER[]');
    // Postgres supports arrays
    expect(getUnifiedTypeMapping('string[]', 'postgres')).toBe('TEXT[]');
    expect(getUnifiedTypeMapping('int[]', 'postgres')).toBe('INTEGER[]');
  });
});
