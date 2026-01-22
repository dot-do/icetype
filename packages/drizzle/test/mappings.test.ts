/**
 * Tests for Drizzle Type Mappings
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import {
  DRIZZLE_TYPE_MAPPINGS,
  getDrizzleType,
  getDrizzleImportPath,
  getTableFunction,
  isKnownDrizzleType,
  getRequiredTypeImports,
} from '../src/mappings.js';

// =============================================================================
// DRIZZLE_TYPE_MAPPINGS Tests
// =============================================================================

describe('DRIZZLE_TYPE_MAPPINGS', () => {
  describe('String types', () => {
    it('should map string for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['string']?.pg).toBe('varchar');
      expect(DRIZZLE_TYPE_MAPPINGS['string']?.mysql).toBe('varchar');
      expect(DRIZZLE_TYPE_MAPPINGS['string']?.sqlite).toBe('text');
    });

    it('should map text for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['text']?.pg).toBe('text');
      expect(DRIZZLE_TYPE_MAPPINGS['text']?.mysql).toBe('text');
      expect(DRIZZLE_TYPE_MAPPINGS['text']?.sqlite).toBe('text');
    });

    it('should map varchar for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['varchar']?.pg).toBe('varchar');
      expect(DRIZZLE_TYPE_MAPPINGS['varchar']?.mysql).toBe('varchar');
      expect(DRIZZLE_TYPE_MAPPINGS['varchar']?.sqlite).toBe('text');
    });

    it('should map char for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['char']?.pg).toBe('char');
      expect(DRIZZLE_TYPE_MAPPINGS['char']?.mysql).toBe('char');
      expect(DRIZZLE_TYPE_MAPPINGS['char']?.sqlite).toBe('text');
    });
  });

  describe('Integer types', () => {
    it('should map int for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['int']?.pg).toBe('integer');
      expect(DRIZZLE_TYPE_MAPPINGS['int']?.mysql).toBe('int');
      expect(DRIZZLE_TYPE_MAPPINGS['int']?.sqlite).toBe('integer');
    });

    it('should map long for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['long']?.pg).toBe('bigint');
      expect(DRIZZLE_TYPE_MAPPINGS['long']?.mysql).toBe('bigint');
      expect(DRIZZLE_TYPE_MAPPINGS['long']?.sqlite).toBe('integer');
    });

    it('should map bigint for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['bigint']?.pg).toBe('bigint');
      expect(DRIZZLE_TYPE_MAPPINGS['bigint']?.mysql).toBe('bigint');
      expect(DRIZZLE_TYPE_MAPPINGS['bigint']?.sqlite).toBe('integer');
    });

    it('should map smallint for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['smallint']?.pg).toBe('smallint');
      expect(DRIZZLE_TYPE_MAPPINGS['smallint']?.mysql).toBe('smallint');
      expect(DRIZZLE_TYPE_MAPPINGS['smallint']?.sqlite).toBe('integer');
    });
  });

  describe('Floating point types', () => {
    it('should map float for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['float']?.pg).toBe('real');
      expect(DRIZZLE_TYPE_MAPPINGS['float']?.mysql).toBe('float');
      expect(DRIZZLE_TYPE_MAPPINGS['float']?.sqlite).toBe('real');
    });

    it('should map double for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['double']?.pg).toBe('doublePrecision');
      expect(DRIZZLE_TYPE_MAPPINGS['double']?.mysql).toBe('double');
      expect(DRIZZLE_TYPE_MAPPINGS['double']?.sqlite).toBe('real');
    });

    it('should map decimal for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['decimal']?.pg).toBe('decimal');
      expect(DRIZZLE_TYPE_MAPPINGS['decimal']?.mysql).toBe('decimal');
      expect(DRIZZLE_TYPE_MAPPINGS['decimal']?.sqlite).toBe('real');
    });
  });

  describe('Boolean types', () => {
    it('should map bool for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['bool']?.pg).toBe('boolean');
      expect(DRIZZLE_TYPE_MAPPINGS['bool']?.mysql).toBe('boolean');
      expect(DRIZZLE_TYPE_MAPPINGS['bool']?.sqlite).toBe('integer');
    });

    it('should map boolean for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['boolean']?.pg).toBe('boolean');
      expect(DRIZZLE_TYPE_MAPPINGS['boolean']?.mysql).toBe('boolean');
      expect(DRIZZLE_TYPE_MAPPINGS['boolean']?.sqlite).toBe('integer');
    });
  });

  describe('Identifier types', () => {
    it('should map uuid for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['uuid']?.pg).toBe('uuid');
      expect(DRIZZLE_TYPE_MAPPINGS['uuid']?.mysql).toBe('varchar');
      expect(DRIZZLE_TYPE_MAPPINGS['uuid']?.sqlite).toBe('text');
    });

    it('should map serial for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['serial']?.pg).toBe('serial');
      expect(DRIZZLE_TYPE_MAPPINGS['serial']?.mysql).toBe('serial');
      expect(DRIZZLE_TYPE_MAPPINGS['serial']?.sqlite).toBe('integer');
    });
  });

  describe('Date/Time types', () => {
    it('should map timestamp for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['timestamp']?.pg).toBe('timestamp');
      expect(DRIZZLE_TYPE_MAPPINGS['timestamp']?.mysql).toBe('timestamp');
      expect(DRIZZLE_TYPE_MAPPINGS['timestamp']?.sqlite).toBe('text');
    });

    it('should map date for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['date']?.pg).toBe('date');
      expect(DRIZZLE_TYPE_MAPPINGS['date']?.mysql).toBe('date');
      expect(DRIZZLE_TYPE_MAPPINGS['date']?.sqlite).toBe('text');
    });

    it('should map time for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['time']?.pg).toBe('time');
      expect(DRIZZLE_TYPE_MAPPINGS['time']?.mysql).toBe('time');
      expect(DRIZZLE_TYPE_MAPPINGS['time']?.sqlite).toBe('text');
    });
  });

  describe('Complex types', () => {
    it('should map json for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['json']?.pg).toBe('json');
      expect(DRIZZLE_TYPE_MAPPINGS['json']?.mysql).toBe('json');
      expect(DRIZZLE_TYPE_MAPPINGS['json']?.sqlite).toBe('text');
    });

    it('should map jsonb for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['jsonb']?.pg).toBe('jsonb');
      expect(DRIZZLE_TYPE_MAPPINGS['jsonb']?.mysql).toBe('json');
      expect(DRIZZLE_TYPE_MAPPINGS['jsonb']?.sqlite).toBe('text');
    });

    it('should map binary for all dialects', () => {
      expect(DRIZZLE_TYPE_MAPPINGS['binary']?.pg).toBe('bytea');
      expect(DRIZZLE_TYPE_MAPPINGS['binary']?.mysql).toBe('blob');
      expect(DRIZZLE_TYPE_MAPPINGS['binary']?.sqlite).toBe('blob');
    });
  });
});

// =============================================================================
// getDrizzleType() Tests
// =============================================================================

describe('getDrizzleType()', () => {
  describe('PostgreSQL mappings', () => {
    it('should return correct type for string', () => {
      expect(getDrizzleType('string', 'pg')).toBe('varchar');
    });

    it('should return correct type for int', () => {
      expect(getDrizzleType('int', 'pg')).toBe('integer');
    });

    it('should return correct type for uuid', () => {
      expect(getDrizzleType('uuid', 'pg')).toBe('uuid');
    });

    it('should return correct type for boolean', () => {
      expect(getDrizzleType('boolean', 'pg')).toBe('boolean');
    });

    it('should return correct type for timestamp', () => {
      expect(getDrizzleType('timestamp', 'pg')).toBe('timestamp');
    });

    it('should return correct type for json', () => {
      expect(getDrizzleType('json', 'pg')).toBe('json');
    });

    it('should return correct type for double', () => {
      expect(getDrizzleType('double', 'pg')).toBe('doublePrecision');
    });
  });

  describe('MySQL mappings', () => {
    it('should return correct type for string', () => {
      expect(getDrizzleType('string', 'mysql')).toBe('varchar');
    });

    it('should return correct type for int', () => {
      expect(getDrizzleType('int', 'mysql')).toBe('int');
    });

    it('should return correct type for uuid', () => {
      expect(getDrizzleType('uuid', 'mysql')).toBe('varchar');
    });

    it('should return correct type for boolean', () => {
      expect(getDrizzleType('boolean', 'mysql')).toBe('boolean');
    });

    it('should return correct type for double', () => {
      expect(getDrizzleType('double', 'mysql')).toBe('double');
    });
  });

  describe('SQLite mappings', () => {
    it('should return correct type for string', () => {
      expect(getDrizzleType('string', 'sqlite')).toBe('text');
    });

    it('should return correct type for int', () => {
      expect(getDrizzleType('int', 'sqlite')).toBe('integer');
    });

    it('should return correct type for uuid', () => {
      expect(getDrizzleType('uuid', 'sqlite')).toBe('text');
    });

    it('should return correct type for boolean', () => {
      expect(getDrizzleType('boolean', 'sqlite')).toBe('integer');
    });

    it('should return correct type for timestamp', () => {
      expect(getDrizzleType('timestamp', 'sqlite')).toBe('text');
    });

    it('should return correct type for json', () => {
      expect(getDrizzleType('json', 'sqlite')).toBe('text');
    });
  });

  describe('Unknown types', () => {
    it('should return text for unknown type in pg', () => {
      expect(getDrizzleType('unknown_type', 'pg')).toBe('text');
    });

    it('should return text for unknown type in mysql', () => {
      expect(getDrizzleType('unknown_type', 'mysql')).toBe('text');
    });

    it('should return text for unknown type in sqlite', () => {
      expect(getDrizzleType('unknown_type', 'sqlite')).toBe('text');
    });
  });

  describe('Case insensitivity', () => {
    it('should handle uppercase types', () => {
      expect(getDrizzleType('STRING', 'pg')).toBe('varchar');
      expect(getDrizzleType('INT', 'pg')).toBe('integer');
      expect(getDrizzleType('UUID', 'pg')).toBe('uuid');
    });

    it('should handle mixed case types', () => {
      expect(getDrizzleType('String', 'pg')).toBe('varchar');
      expect(getDrizzleType('Int', 'pg')).toBe('integer');
      expect(getDrizzleType('Boolean', 'pg')).toBe('boolean');
    });
  });
});

// =============================================================================
// getDrizzleImportPath() Tests
// =============================================================================

describe('getDrizzleImportPath()', () => {
  it('should return pg-core path for pg', () => {
    expect(getDrizzleImportPath('pg')).toBe('drizzle-orm/pg-core');
  });

  it('should return mysql-core path for mysql', () => {
    expect(getDrizzleImportPath('mysql')).toBe('drizzle-orm/mysql-core');
  });

  it('should return sqlite-core path for sqlite', () => {
    expect(getDrizzleImportPath('sqlite')).toBe('drizzle-orm/sqlite-core');
  });
});

// =============================================================================
// getTableFunction() Tests
// =============================================================================

describe('getTableFunction()', () => {
  it('should return pgTable for pg', () => {
    expect(getTableFunction('pg')).toBe('pgTable');
  });

  it('should return mysqlTable for mysql', () => {
    expect(getTableFunction('mysql')).toBe('mysqlTable');
  });

  it('should return sqliteTable for sqlite', () => {
    expect(getTableFunction('sqlite')).toBe('sqliteTable');
  });
});

// =============================================================================
// isKnownDrizzleType() Tests
// =============================================================================

describe('isKnownDrizzleType()', () => {
  it('should return true for known types', () => {
    expect(isKnownDrizzleType('string')).toBe(true);
    expect(isKnownDrizzleType('int')).toBe(true);
    expect(isKnownDrizzleType('uuid')).toBe(true);
    expect(isKnownDrizzleType('boolean')).toBe(true);
    expect(isKnownDrizzleType('timestamp')).toBe(true);
    expect(isKnownDrizzleType('json')).toBe(true);
  });

  it('should return false for unknown types', () => {
    expect(isKnownDrizzleType('unknown')).toBe(false);
    expect(isKnownDrizzleType('custom')).toBe(false);
    expect(isKnownDrizzleType('')).toBe(false);
  });

  it('should handle case insensitivity', () => {
    expect(isKnownDrizzleType('STRING')).toBe(true);
    expect(isKnownDrizzleType('String')).toBe(true);
    expect(isKnownDrizzleType('INT')).toBe(true);
  });
});

// =============================================================================
// getRequiredTypeImports() Tests
// =============================================================================

describe('getRequiredTypeImports()', () => {
  it('should return unique types for pg', () => {
    const types = ['string', 'int', 'uuid'];
    const imports = getRequiredTypeImports(types, 'pg');

    expect(imports).toContain('varchar');
    expect(imports).toContain('integer');
    expect(imports).toContain('uuid');
    expect(imports.length).toBe(3);
  });

  it('should deduplicate types', () => {
    const types = ['string', 'string', 'varchar', 'text'];
    const imports = getRequiredTypeImports(types, 'pg');

    // string and varchar both map to varchar, text maps to text
    expect(imports).toContain('varchar');
    expect(imports).toContain('text');
    expect(imports.length).toBe(2);
  });

  it('should return sorted array', () => {
    const types = ['uuid', 'int', 'string'];
    const imports = getRequiredTypeImports(types, 'pg');

    const sorted = [...imports].sort();
    expect(imports).toEqual(sorted);
  });

  it('should handle MySQL dialect correctly', () => {
    const types = ['uuid', 'int', 'boolean'];
    const imports = getRequiredTypeImports(types, 'mysql');

    expect(imports).toContain('varchar'); // uuid maps to varchar in mysql
    expect(imports).toContain('int');
    expect(imports).toContain('boolean');
  });

  it('should handle SQLite dialect correctly', () => {
    const types = ['uuid', 'int', 'boolean', 'json'];
    const imports = getRequiredTypeImports(types, 'sqlite');

    // uuid, json, boolean all map to text or integer in sqlite
    expect(imports).toContain('text');
    expect(imports).toContain('integer');
  });

  it('should handle empty array', () => {
    const imports = getRequiredTypeImports([], 'pg');
    expect(imports).toEqual([]);
  });
});
