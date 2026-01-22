/**
 * Type Mappings Tests
 *
 * Tests for the centralized type mapping system that provides
 * consistent type translations across all backend adapters.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import {
  TYPE_MAPPINGS,
  getIcebergType,
  getDuckDBType,
  getClickHouseType,
  getPostgresType,
  getParquetType,
  getTypeMapping,
  isKnownType,
  getSupportedTypes,
  type TypeMapping,
} from '../src/type-mappings.js';

// =============================================================================
// TYPE_MAPPINGS Tests
// =============================================================================

describe('TYPE_MAPPINGS', () => {
  it('should have mappings for all primitive types', () => {
    const primitives = [
      'string',
      'text',
      'int',
      'long',
      'bigint',
      'float',
      'double',
      'bool',
      'boolean',
      'uuid',
      'timestamp',
      'timestamptz',
      'date',
      'time',
      'json',
      'binary',
      'decimal',
      'varchar',
    ];
    for (const type of primitives) {
      expect(TYPE_MAPPINGS[type], `Missing mapping for type: ${type}`).toBeDefined();
    }
  });

  it('should have all required backend types for each mapping', () => {
    for (const [typeName, mapping] of Object.entries(TYPE_MAPPINGS)) {
      expect(mapping.iceberg, `${typeName}: missing iceberg`).toBeDefined();
      expect(mapping.parquet, `${typeName}: missing parquet`).toBeDefined();
      expect(mapping.duckdb, `${typeName}: missing duckdb`).toBeDefined();
      expect(mapping.clickhouse, `${typeName}: missing clickhouse`).toBeDefined();
      expect(mapping.postgres, `${typeName}: missing postgres`).toBeDefined();
    }
  });

  describe('string type mapping', () => {
    it('should map string to correct backend types', () => {
      expect(getIcebergType('string')).toBe('string');
      expect(getParquetType('string')).toBe('BYTE_ARRAY');
      expect(getDuckDBType('string')).toBe('VARCHAR');
      expect(getClickHouseType('string')).toBe('String');
      expect(getPostgresType('string')).toBe('TEXT');
    });
  });

  describe('text type mapping', () => {
    it('should map text to correct backend types', () => {
      expect(getIcebergType('text')).toBe('string');
      expect(getParquetType('text')).toBe('BYTE_ARRAY');
      expect(getDuckDBType('text')).toBe('VARCHAR');
      expect(getClickHouseType('text')).toBe('String');
      expect(getPostgresType('text')).toBe('TEXT');
    });
  });

  describe('int type mapping', () => {
    it('should map int to correct backend types', () => {
      expect(getIcebergType('int')).toBe('int');
      expect(getParquetType('int')).toBe('INT32');
      expect(getDuckDBType('int')).toBe('INTEGER');
      expect(getClickHouseType('int')).toBe('Int32');
      expect(getPostgresType('int')).toBe('INTEGER');
    });
  });

  describe('long type mapping', () => {
    it('should map long to correct backend types', () => {
      expect(getIcebergType('long')).toBe('long');
      expect(getParquetType('long')).toBe('INT64');
      expect(getDuckDBType('long')).toBe('BIGINT');
      expect(getClickHouseType('long')).toBe('Int64');
      expect(getPostgresType('long')).toBe('BIGINT');
    });
  });

  describe('bigint type mapping', () => {
    it('should map bigint to correct backend types (same as long)', () => {
      expect(getIcebergType('bigint')).toBe('long');
      expect(getParquetType('bigint')).toBe('INT64');
      expect(getDuckDBType('bigint')).toBe('BIGINT');
      expect(getClickHouseType('bigint')).toBe('Int64');
      expect(getPostgresType('bigint')).toBe('BIGINT');
    });
  });

  describe('float type mapping', () => {
    it('should map float to correct backend types', () => {
      expect(getIcebergType('float')).toBe('float');
      expect(getParquetType('float')).toBe('FLOAT');
      expect(getDuckDBType('float')).toBe('REAL');
      expect(getClickHouseType('float')).toBe('Float32');
      expect(getPostgresType('float')).toBe('REAL');
    });
  });

  describe('double type mapping', () => {
    it('should map double to correct backend types', () => {
      expect(getIcebergType('double')).toBe('double');
      expect(getParquetType('double')).toBe('DOUBLE');
      expect(getDuckDBType('double')).toBe('DOUBLE');
      expect(getClickHouseType('double')).toBe('Float64');
      expect(getPostgresType('double')).toBe('DOUBLE PRECISION');
    });
  });

  describe('bool/boolean type mapping', () => {
    it('should map bool to correct backend types', () => {
      expect(getIcebergType('bool')).toBe('boolean');
      expect(getParquetType('bool')).toBe('BOOLEAN');
      expect(getDuckDBType('bool')).toBe('BOOLEAN');
      expect(getClickHouseType('bool')).toBe('Bool');
      expect(getPostgresType('bool')).toBe('BOOLEAN');
    });

    it('should map boolean to same types as bool', () => {
      expect(getTypeMapping('boolean')).toEqual(getTypeMapping('bool'));
    });
  });

  describe('uuid type mapping', () => {
    it('should map uuid to correct backend types', () => {
      expect(getIcebergType('uuid')).toBe('uuid');
      expect(getParquetType('uuid')).toBe('FIXED_LEN_BYTE_ARRAY');
      expect(getDuckDBType('uuid')).toBe('UUID');
      expect(getClickHouseType('uuid')).toBe('UUID');
      expect(getPostgresType('uuid')).toBe('UUID');
    });
  });

  describe('timestamp type mapping', () => {
    it('should map timestamp to correct backend types', () => {
      expect(getIcebergType('timestamp')).toBe('timestamp');
      expect(getParquetType('timestamp')).toBe('INT64');
      expect(getDuckDBType('timestamp')).toBe('TIMESTAMP');
      expect(getClickHouseType('timestamp')).toBe('DateTime64(3)');
      expect(getPostgresType('timestamp')).toBe('TIMESTAMP');
    });
  });

  describe('timestamptz type mapping', () => {
    it('should map timestamptz to correct backend types', () => {
      expect(getIcebergType('timestamptz')).toBe('timestamptz');
      expect(getParquetType('timestamptz')).toBe('INT64');
      expect(getDuckDBType('timestamptz')).toBe('TIMESTAMPTZ');
      expect(getClickHouseType('timestamptz')).toBe('DateTime64(3)');
      expect(getPostgresType('timestamptz')).toBe('TIMESTAMPTZ');
    });
  });

  describe('date type mapping', () => {
    it('should map date to correct backend types', () => {
      expect(getIcebergType('date')).toBe('date');
      expect(getParquetType('date')).toBe('INT32');
      expect(getDuckDBType('date')).toBe('DATE');
      expect(getClickHouseType('date')).toBe('Date');
      expect(getPostgresType('date')).toBe('DATE');
    });
  });

  describe('time type mapping', () => {
    it('should map time to correct backend types', () => {
      expect(getIcebergType('time')).toBe('time');
      expect(getParquetType('time')).toBe('INT32');
      expect(getDuckDBType('time')).toBe('TIME');
      expect(getClickHouseType('time')).toBe('String');
      expect(getPostgresType('time')).toBe('TIME');
    });
  });

  describe('json type mapping', () => {
    it('should map json to correct backend types', () => {
      expect(getIcebergType('json')).toBe('string');
      expect(getParquetType('json')).toBe('BYTE_ARRAY');
      expect(getDuckDBType('json')).toBe('JSON');
      expect(getClickHouseType('json')).toBe('JSON');
      expect(getPostgresType('json')).toBe('JSONB');
    });
  });

  describe('binary type mapping', () => {
    it('should map binary to correct backend types', () => {
      expect(getIcebergType('binary')).toBe('binary');
      expect(getParquetType('binary')).toBe('BYTE_ARRAY');
      expect(getDuckDBType('binary')).toBe('BLOB');
      expect(getClickHouseType('binary')).toBe('String');
      expect(getPostgresType('binary')).toBe('BYTEA');
    });
  });

  describe('decimal type mapping', () => {
    it('should map decimal to correct backend types', () => {
      expect(getIcebergType('decimal')).toBe('decimal');
      expect(getParquetType('decimal')).toBe('BYTE_ARRAY');
      expect(getDuckDBType('decimal')).toBe('DECIMAL');
      expect(getClickHouseType('decimal')).toBe('Decimal(38, 9)');
      expect(getPostgresType('decimal')).toBe('DECIMAL');
    });
  });

  describe('varchar type mapping', () => {
    it('should map varchar to correct backend types', () => {
      expect(getIcebergType('varchar')).toBe('string');
      expect(getParquetType('varchar')).toBe('BYTE_ARRAY');
      expect(getDuckDBType('varchar')).toBe('VARCHAR');
      expect(getClickHouseType('varchar')).toBe('String');
      expect(getPostgresType('varchar')).toBe('VARCHAR');
    });
  });
});

// =============================================================================
// getIcebergType Tests
// =============================================================================

describe('getIcebergType', () => {
  it('should return iceberg type for valid icetype', () => {
    expect(getIcebergType('string')).toBe('string');
    expect(getIcebergType('int')).toBe('int');
    expect(getIcebergType('long')).toBe('long');
    expect(getIcebergType('boolean')).toBe('boolean');
    expect(getIcebergType('uuid')).toBe('uuid');
    expect(getIcebergType('timestamp')).toBe('timestamp');
    expect(getIcebergType('date')).toBe('date');
  });

  it('should be case-insensitive', () => {
    expect(getIcebergType('STRING')).toBe('string');
    expect(getIcebergType('Int')).toBe('int');
    expect(getIcebergType('UUID')).toBe('uuid');
  });

  it('should return string for unknown types', () => {
    expect(getIcebergType('unknown')).toBe('string');
    expect(getIcebergType('custom')).toBe('string');
  });
});

// =============================================================================
// getDuckDBType Tests
// =============================================================================

describe('getDuckDBType', () => {
  it('should return duckdb type for valid icetype', () => {
    expect(getDuckDBType('string')).toBe('VARCHAR');
    expect(getDuckDBType('int')).toBe('INTEGER');
    expect(getDuckDBType('long')).toBe('BIGINT');
    expect(getDuckDBType('boolean')).toBe('BOOLEAN');
    expect(getDuckDBType('uuid')).toBe('UUID');
    expect(getDuckDBType('timestamp')).toBe('TIMESTAMP');
    expect(getDuckDBType('json')).toBe('JSON');
  });

  it('should be case-insensitive', () => {
    expect(getDuckDBType('STRING')).toBe('VARCHAR');
    expect(getDuckDBType('Int')).toBe('INTEGER');
    expect(getDuckDBType('JSON')).toBe('JSON');
  });

  it('should return VARCHAR for unknown types', () => {
    expect(getDuckDBType('unknown')).toBe('VARCHAR');
    expect(getDuckDBType('custom')).toBe('VARCHAR');
  });
});

// =============================================================================
// getClickHouseType Tests
// =============================================================================

describe('getClickHouseType', () => {
  it('should return clickhouse type for valid icetype', () => {
    expect(getClickHouseType('string')).toBe('String');
    expect(getClickHouseType('int')).toBe('Int32');
    expect(getClickHouseType('long')).toBe('Int64');
    expect(getClickHouseType('boolean')).toBe('Bool');
    expect(getClickHouseType('uuid')).toBe('UUID');
    expect(getClickHouseType('timestamp')).toBe('DateTime64(3)');
    expect(getClickHouseType('json')).toBe('JSON');
  });

  it('should be case-insensitive', () => {
    expect(getClickHouseType('STRING')).toBe('String');
    expect(getClickHouseType('Int')).toBe('Int32');
    expect(getClickHouseType('Boolean')).toBe('Bool');
  });

  it('should return String for unknown types', () => {
    expect(getClickHouseType('unknown')).toBe('String');
    expect(getClickHouseType('custom')).toBe('String');
  });
});

// =============================================================================
// getPostgresType Tests
// =============================================================================

describe('getPostgresType', () => {
  it('should return postgres type for valid icetype', () => {
    expect(getPostgresType('string')).toBe('TEXT');
    expect(getPostgresType('int')).toBe('INTEGER');
    expect(getPostgresType('long')).toBe('BIGINT');
    expect(getPostgresType('boolean')).toBe('BOOLEAN');
    expect(getPostgresType('uuid')).toBe('UUID');
    expect(getPostgresType('timestamp')).toBe('TIMESTAMP');
    expect(getPostgresType('json')).toBe('JSONB');
    expect(getPostgresType('binary')).toBe('BYTEA');
  });

  it('should be case-insensitive', () => {
    expect(getPostgresType('STRING')).toBe('TEXT');
    expect(getPostgresType('Int')).toBe('INTEGER');
    expect(getPostgresType('Json')).toBe('JSONB');
  });

  it('should return TEXT for unknown types', () => {
    expect(getPostgresType('unknown')).toBe('TEXT');
    expect(getPostgresType('custom')).toBe('TEXT');
  });
});

// =============================================================================
// getParquetType Tests
// =============================================================================

describe('getParquetType', () => {
  it('should return parquet type for valid icetype', () => {
    expect(getParquetType('string')).toBe('BYTE_ARRAY');
    expect(getParquetType('int')).toBe('INT32');
    expect(getParquetType('long')).toBe('INT64');
    expect(getParquetType('boolean')).toBe('BOOLEAN');
    expect(getParquetType('float')).toBe('FLOAT');
    expect(getParquetType('double')).toBe('DOUBLE');
    expect(getParquetType('uuid')).toBe('FIXED_LEN_BYTE_ARRAY');
  });

  it('should be case-insensitive', () => {
    expect(getParquetType('STRING')).toBe('BYTE_ARRAY');
    expect(getParquetType('Int')).toBe('INT32');
    expect(getParquetType('Boolean')).toBe('BOOLEAN');
  });

  it('should return BYTE_ARRAY for unknown types', () => {
    expect(getParquetType('unknown')).toBe('BYTE_ARRAY');
    expect(getParquetType('custom')).toBe('BYTE_ARRAY');
  });
});

// =============================================================================
// getTypeMapping Tests
// =============================================================================

describe('getTypeMapping', () => {
  it('should return complete mapping for known types', () => {
    const mapping = getTypeMapping('string');
    expect(mapping).toBeDefined();
    expect(mapping?.iceberg).toBe('string');
    expect(mapping?.parquet).toBe('BYTE_ARRAY');
    expect(mapping?.duckdb).toBe('VARCHAR');
    expect(mapping?.clickhouse).toBe('String');
    expect(mapping?.postgres).toBe('TEXT');
  });

  it('should return undefined for unknown types', () => {
    expect(getTypeMapping('unknown')).toBeUndefined();
    expect(getTypeMapping('custom')).toBeUndefined();
  });

  it('should be case-insensitive', () => {
    expect(getTypeMapping('STRING')).toBeDefined();
    expect(getTypeMapping('Int')).toBeDefined();
  });
});

// =============================================================================
// isKnownType Tests
// =============================================================================

describe('isKnownType', () => {
  it('should return true for known types', () => {
    expect(isKnownType('string')).toBe(true);
    expect(isKnownType('int')).toBe(true);
    expect(isKnownType('uuid')).toBe(true);
    expect(isKnownType('timestamp')).toBe(true);
  });

  it('should return false for unknown types', () => {
    expect(isKnownType('unknown')).toBe(false);
    expect(isKnownType('custom')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isKnownType('STRING')).toBe(true);
    expect(isKnownType('Int')).toBe(true);
    expect(isKnownType('UUID')).toBe(true);
  });
});

// =============================================================================
// getSupportedTypes Tests
// =============================================================================

describe('getSupportedTypes', () => {
  it('should return all supported type names', () => {
    const types = getSupportedTypes();
    expect(types).toContain('string');
    expect(types).toContain('int');
    expect(types).toContain('uuid');
    expect(types).toContain('timestamp');
    expect(types).toContain('json');
    expect(types.length).toBeGreaterThan(10);
  });
});

// =============================================================================
// TypeMapping interface Tests
// =============================================================================

describe('TypeMapping interface', () => {
  it('should have the correct shape', () => {
    const mapping: TypeMapping = {
      iceberg: 'string',
      parquet: 'BYTE_ARRAY',
      duckdb: 'VARCHAR',
      clickhouse: 'String',
      postgres: 'TEXT',
    };

    expect(mapping).toBeDefined();
    expect(typeof mapping.iceberg).toBe('string');
    expect(typeof mapping.parquet).toBe('string');
    expect(typeof mapping.duckdb).toBe('string');
    expect(typeof mapping.clickhouse).toBe('string');
    expect(typeof mapping.postgres).toBe('string');
  });
});
