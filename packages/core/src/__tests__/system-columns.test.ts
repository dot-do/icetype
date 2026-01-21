/**
 * System Columns Tests for @icetype/core
 *
 * These tests verify that system column constants and helper functions
 * are properly defined and work correctly.
 *
 * System columns are special columns that IceType adds to every table:
 * - $id: Primary key identifier (uuid)
 * - $type: Entity type name (string)
 * - $version: Row version for optimistic locking (int)
 * - $createdAt: Creation timestamp as epoch ms (bigint)
 * - $updatedAt: Last update timestamp as epoch ms (bigint)
 *
 * This module should be the single source of truth for system column
 * definitions, replacing hardcoded values across adapters.
 *
 * @see https://github.com/dot-do/icetype/issues/icetype-hzm.7
 */

import { describe, it, expect } from 'vitest';
import {
  SYSTEM_COLUMNS,
  getSystemColumn,
  isSystemColumn,
  type SystemColumnDefinition,
  type SystemColumnName,
} from '../index.js';

// =============================================================================
// SYSTEM_COLUMNS Constant Tests
// =============================================================================

describe('SYSTEM_COLUMNS', () => {
  it('should be defined', () => {
    expect(SYSTEM_COLUMNS).toBeDefined();
  });

  it('should be an object', () => {
    expect(typeof SYSTEM_COLUMNS).toBe('object');
    expect(SYSTEM_COLUMNS).not.toBeNull();
  });

  it('should include $id column', () => {
    expect(SYSTEM_COLUMNS.$id).toBeDefined();
  });

  it('should include $type column', () => {
    expect(SYSTEM_COLUMNS.$type).toBeDefined();
  });

  it('should include $version column', () => {
    expect(SYSTEM_COLUMNS.$version).toBeDefined();
  });

  it('should include $createdAt column', () => {
    expect(SYSTEM_COLUMNS.$createdAt).toBeDefined();
  });

  it('should include $updatedAt column', () => {
    expect(SYSTEM_COLUMNS.$updatedAt).toBeDefined();
  });

  it('should have exactly 5 system columns', () => {
    const columnNames = Object.keys(SYSTEM_COLUMNS);
    expect(columnNames).toHaveLength(5);
    expect(columnNames).toEqual(
      expect.arrayContaining(['$id', '$type', '$version', '$createdAt', '$updatedAt'])
    );
  });
});

// =============================================================================
// System Column Definition Structure Tests
// =============================================================================

describe('System Column Definitions', () => {
  describe('$id column', () => {
    it('should have name property set to "$id"', () => {
      expect(SYSTEM_COLUMNS.$id.name).toBe('$id');
    });

    it('should have type property set to "uuid"', () => {
      expect(SYSTEM_COLUMNS.$id.type).toBe('uuid');
    });

    it('should have nullable property set to false', () => {
      expect(SYSTEM_COLUMNS.$id.nullable).toBe(false);
    });

    it('should have primaryKey property set to true', () => {
      expect(SYSTEM_COLUMNS.$id.primaryKey).toBe(true);
    });
  });

  describe('$type column', () => {
    it('should have name property set to "$type"', () => {
      expect(SYSTEM_COLUMNS.$type.name).toBe('$type');
    });

    it('should have type property set to "string"', () => {
      expect(SYSTEM_COLUMNS.$type.type).toBe('string');
    });

    it('should have nullable property set to false', () => {
      expect(SYSTEM_COLUMNS.$type.nullable).toBe(false);
    });

    it('should not have primaryKey property or have it set to false', () => {
      expect(SYSTEM_COLUMNS.$type.primaryKey).toBeFalsy();
    });
  });

  describe('$version column', () => {
    it('should have name property set to "$version"', () => {
      expect(SYSTEM_COLUMNS.$version.name).toBe('$version');
    });

    it('should have type property set to "int"', () => {
      expect(SYSTEM_COLUMNS.$version.type).toBe('int');
    });

    it('should have nullable property set to false', () => {
      expect(SYSTEM_COLUMNS.$version.nullable).toBe(false);
    });

    it('should have defaultValue property set to 1', () => {
      expect(SYSTEM_COLUMNS.$version.defaultValue).toBe(1);
    });
  });

  describe('$createdAt column', () => {
    it('should have name property set to "$createdAt"', () => {
      expect(SYSTEM_COLUMNS.$createdAt.name).toBe('$createdAt');
    });

    it('should have type property set to "bigint"', () => {
      expect(SYSTEM_COLUMNS.$createdAt.type).toBe('bigint');
    });

    it('should have nullable property set to false', () => {
      expect(SYSTEM_COLUMNS.$createdAt.nullable).toBe(false);
    });
  });

  describe('$updatedAt column', () => {
    it('should have name property set to "$updatedAt"', () => {
      expect(SYSTEM_COLUMNS.$updatedAt.name).toBe('$updatedAt');
    });

    it('should have type property set to "bigint"', () => {
      expect(SYSTEM_COLUMNS.$updatedAt.type).toBe('bigint');
    });

    it('should have nullable property set to false', () => {
      expect(SYSTEM_COLUMNS.$updatedAt.nullable).toBe(false);
    });
  });
});

// =============================================================================
// getSystemColumn() Helper Function Tests
// =============================================================================

describe('getSystemColumn()', () => {
  it('should be a function', () => {
    expect(typeof getSystemColumn).toBe('function');
  });

  it('should return $id column for "$id"', () => {
    const column = getSystemColumn('$id');
    expect(column).toBeDefined();
    expect(column?.name).toBe('$id');
    expect(column?.type).toBe('uuid');
    expect(column?.nullable).toBe(false);
  });

  it('should return $type column for "$type"', () => {
    const column = getSystemColumn('$type');
    expect(column).toBeDefined();
    expect(column?.name).toBe('$type');
    expect(column?.type).toBe('string');
  });

  it('should return $version column for "$version"', () => {
    const column = getSystemColumn('$version');
    expect(column).toBeDefined();
    expect(column?.name).toBe('$version');
    expect(column?.type).toBe('int');
  });

  it('should return $createdAt column for "$createdAt"', () => {
    const column = getSystemColumn('$createdAt');
    expect(column).toBeDefined();
    expect(column?.name).toBe('$createdAt');
    expect(column?.type).toBe('bigint');
  });

  it('should return $updatedAt column for "$updatedAt"', () => {
    const column = getSystemColumn('$updatedAt');
    expect(column).toBeDefined();
    expect(column?.name).toBe('$updatedAt');
    expect(column?.type).toBe('bigint');
  });

  it('should return undefined for non-system column names', () => {
    expect(getSystemColumn('name')).toBeUndefined();
    expect(getSystemColumn('email')).toBeUndefined();
    expect(getSystemColumn('id')).toBeUndefined();
    expect(getSystemColumn('type')).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(getSystemColumn('')).toBeUndefined();
  });

  it('should return undefined for invalid $ prefixed names', () => {
    expect(getSystemColumn('$invalid')).toBeUndefined();
    expect(getSystemColumn('$foo')).toBeUndefined();
    expect(getSystemColumn('$ID')).toBeUndefined(); // Case sensitive
  });

  it('should handle whitespace in name', () => {
    expect(getSystemColumn(' $id')).toBeUndefined();
    expect(getSystemColumn('$id ')).toBeUndefined();
    expect(getSystemColumn(' $id ')).toBeUndefined();
  });
});

// =============================================================================
// isSystemColumn() Helper Function Tests
// =============================================================================

describe('isSystemColumn()', () => {
  it('should be a function', () => {
    expect(typeof isSystemColumn).toBe('function');
  });

  it('should return true for "$id"', () => {
    expect(isSystemColumn('$id')).toBe(true);
  });

  it('should return true for "$type"', () => {
    expect(isSystemColumn('$type')).toBe(true);
  });

  it('should return true for "$version"', () => {
    expect(isSystemColumn('$version')).toBe(true);
  });

  it('should return true for "$createdAt"', () => {
    expect(isSystemColumn('$createdAt')).toBe(true);
  });

  it('should return true for "$updatedAt"', () => {
    expect(isSystemColumn('$updatedAt')).toBe(true);
  });

  it('should return false for regular field names', () => {
    expect(isSystemColumn('name')).toBe(false);
    expect(isSystemColumn('email')).toBe(false);
    expect(isSystemColumn('userId')).toBe(false);
  });

  it('should return false for "id" (without $)', () => {
    expect(isSystemColumn('id')).toBe(false);
  });

  it('should return false for "type" (without $)', () => {
    expect(isSystemColumn('type')).toBe(false);
  });

  it('should return false for "version" (without $)', () => {
    expect(isSystemColumn('version')).toBe(false);
  });

  it('should return false for "createdAt" (without $)', () => {
    expect(isSystemColumn('createdAt')).toBe(false);
  });

  it('should return false for "updatedAt" (without $)', () => {
    expect(isSystemColumn('updatedAt')).toBe(false);
  });

  it('should return false for invalid $ prefixed names', () => {
    expect(isSystemColumn('$invalid')).toBe(false);
    expect(isSystemColumn('$foo')).toBe(false);
    expect(isSystemColumn('$bar')).toBe(false);
  });

  it('should be case sensitive', () => {
    expect(isSystemColumn('$ID')).toBe(false);
    expect(isSystemColumn('$Type')).toBe(false);
    expect(isSystemColumn('$VERSION')).toBe(false);
    expect(isSystemColumn('$CREATEDAT')).toBe(false);
    expect(isSystemColumn('$UPDATEDAT')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isSystemColumn('')).toBe(false);
  });

  it('should return false for strings with whitespace', () => {
    expect(isSystemColumn(' $id')).toBe(false);
    expect(isSystemColumn('$id ')).toBe(false);
    expect(isSystemColumn(' $id ')).toBe(false);
  });

  it('should return false for null-like string', () => {
    expect(isSystemColumn('null')).toBe(false);
    expect(isSystemColumn('undefined')).toBe(false);
  });
});

// =============================================================================
// Type Safety Tests (compile-time verified)
// =============================================================================

describe('Type Safety', () => {
  it('SystemColumnDefinition should have required properties', () => {
    // This test verifies the type structure at runtime
    const expectedProps = ['name', 'type', 'nullable'];

    for (const key of Object.keys(SYSTEM_COLUMNS) as SystemColumnName[]) {
      const column = SYSTEM_COLUMNS[key];
      for (const prop of expectedProps) {
        expect(column).toHaveProperty(prop);
      }
    }
  });

  it('all system column types should be valid IceType primitives', () => {
    const validTypes = ['uuid', 'string', 'int', 'bigint', 'timestamp'];

    for (const key of Object.keys(SYSTEM_COLUMNS) as SystemColumnName[]) {
      const column = SYSTEM_COLUMNS[key];
      expect(validTypes).toContain(column.type);
    }
  });

  it('SystemColumnName type should cover all system columns', () => {
    const systemColumnNames: SystemColumnName[] = [
      '$id',
      '$type',
      '$version',
      '$createdAt',
      '$updatedAt',
    ];

    expect(Object.keys(SYSTEM_COLUMNS).sort()).toEqual(systemColumnNames.sort());
  });
});

// =============================================================================
// Integration with Existing Types Tests
// =============================================================================

describe('Integration with IceType', () => {
  it('system column types should align with PrimitiveType', () => {
    // Verify that system column types are valid IceType primitive types
    // This ensures compatibility with the rest of the schema system
    const iceTypePrimitives = [
      'string', 'text', 'int', 'long', 'bigint', 'float', 'double',
      'bool', 'boolean', 'timestamp', 'timestamptz', 'date', 'time',
      'uuid', 'json', 'binary',
    ];

    for (const key of Object.keys(SYSTEM_COLUMNS) as SystemColumnName[]) {
      const column = SYSTEM_COLUMNS[key];
      expect(iceTypePrimitives).toContain(column.type);
    }
  });

  it('getSystemColumn should return same reference as SYSTEM_COLUMNS', () => {
    // Ensure getSystemColumn returns the exact same object reference
    // This is important for identity comparisons
    expect(getSystemColumn('$id')).toBe(SYSTEM_COLUMNS.$id);
    expect(getSystemColumn('$type')).toBe(SYSTEM_COLUMNS.$type);
    expect(getSystemColumn('$version')).toBe(SYSTEM_COLUMNS.$version);
    expect(getSystemColumn('$createdAt')).toBe(SYSTEM_COLUMNS.$createdAt);
    expect(getSystemColumn('$updatedAt')).toBe(SYSTEM_COLUMNS.$updatedAt);
  });
});

// =============================================================================
// Immutability Tests
// =============================================================================

describe('Immutability', () => {
  it('SYSTEM_COLUMNS should be frozen (read-only)', () => {
    expect(Object.isFrozen(SYSTEM_COLUMNS)).toBe(true);
  });

  it('individual column definitions should be frozen', () => {
    for (const key of Object.keys(SYSTEM_COLUMNS) as SystemColumnName[]) {
      expect(Object.isFrozen(SYSTEM_COLUMNS[key])).toBe(true);
    }
  });

  it('should not allow modification of SYSTEM_COLUMNS', () => {
    // TypeScript would prevent this at compile time, but verify at runtime
    expect(() => {
      // @ts-expect-error - Testing runtime immutability
      SYSTEM_COLUMNS.$id = { name: 'modified', type: 'string', nullable: true };
    }).toThrow();
  });

  it('should not allow modification of column definitions', () => {
    expect(() => {
      // @ts-expect-error - Testing runtime immutability
      SYSTEM_COLUMNS.$id.name = 'modified';
    }).toThrow();
  });

  it('should not allow adding new system columns', () => {
    expect(() => {
      // @ts-expect-error - Testing runtime immutability
      SYSTEM_COLUMNS.$newColumn = { name: '$newColumn', type: 'string', nullable: true };
    }).toThrow();
  });
});

// =============================================================================
// SYSTEM_COLUMN_NAMES Array Tests
// =============================================================================

describe('SYSTEM_COLUMN_NAMES', () => {
  // This tests an optional exported array of system column names
  // which can be useful for iteration and validation
  it('should export SYSTEM_COLUMN_NAMES array', async () => {
    const { SYSTEM_COLUMN_NAMES } = await import('../index.js');
    expect(SYSTEM_COLUMN_NAMES).toBeDefined();
    expect(Array.isArray(SYSTEM_COLUMN_NAMES)).toBe(true);
  });

  it('SYSTEM_COLUMN_NAMES should contain all system column names', async () => {
    const { SYSTEM_COLUMN_NAMES } = await import('../index.js');
    expect(SYSTEM_COLUMN_NAMES).toHaveLength(5);
    expect(SYSTEM_COLUMN_NAMES).toContain('$id');
    expect(SYSTEM_COLUMN_NAMES).toContain('$type');
    expect(SYSTEM_COLUMN_NAMES).toContain('$version');
    expect(SYSTEM_COLUMN_NAMES).toContain('$createdAt');
    expect(SYSTEM_COLUMN_NAMES).toContain('$updatedAt');
  });

  it('SYSTEM_COLUMN_NAMES should be frozen', async () => {
    const { SYSTEM_COLUMN_NAMES } = await import('../index.js');
    expect(Object.isFrozen(SYSTEM_COLUMN_NAMES)).toBe(true);
  });
});
