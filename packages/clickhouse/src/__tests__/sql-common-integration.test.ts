/**
 * Tests for ClickHouse integration with @icetype/sql-common
 *
 * These tests verify that the ClickHouse adapter uses the shared utilities
 * from @icetype/sql-common for common SQL operations like identifier escaping,
 * value formatting, and system column generation.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import {
  escapeIdentifier as sqlCommonEscapeIdentifier,
  formatDefaultValue as sqlCommonFormatDefaultValue,
  generateSystemColumns as sqlCommonGenerateSystemColumns,
  serializeColumn as sqlCommonSerializeColumn,
  type SqlColumn,
} from '@icetype/sql-common';

import {
  escapeIdentifier as clickhouseEscapeIdentifier,
  formatDefaultValue as clickhouseFormatDefaultValue,
  generateSystemColumns as clickhouseGenerateSystemColumns,
  serializeColumn as clickhouseSerializeColumn,
} from '../index.js';

// =============================================================================
// escapeIdentifier() Integration Tests
// =============================================================================

describe('ClickHouse escapeIdentifier() uses sql-common', () => {
  describe('should produce identical output to sql-common', () => {
    it('should escape simple identifiers the same way', () => {
      const identifiers = ['users', 'user_id', 'Users', '_private'];
      for (const id of identifiers) {
        expect(clickhouseEscapeIdentifier(id)).toBe(
          sqlCommonEscapeIdentifier(id, 'clickhouse')
        );
      }
    });

    it('should escape identifiers with $ the same way', () => {
      expect(clickhouseEscapeIdentifier('$id')).toBe(
        sqlCommonEscapeIdentifier('$id', 'clickhouse')
      );
      expect(clickhouseEscapeIdentifier('$type')).toBe(
        sqlCommonEscapeIdentifier('$type', 'clickhouse')
      );
      expect(clickhouseEscapeIdentifier('$version')).toBe(
        sqlCommonEscapeIdentifier('$version', 'clickhouse')
      );
    });

    it('should escape identifiers with special characters the same way', () => {
      const specialIds = ['user-name', 'table.name', 'my table', '123start'];
      for (const id of specialIds) {
        expect(clickhouseEscapeIdentifier(id)).toBe(
          sqlCommonEscapeIdentifier(id, 'clickhouse')
        );
      }
    });

    it('should escape backticks in identifiers the same way', () => {
      expect(clickhouseEscapeIdentifier('user`name')).toBe(
        sqlCommonEscapeIdentifier('user`name', 'clickhouse')
      );
    });
  });

  describe('ClickHouse-specific escaping uses backticks', () => {
    it('should use backticks for system fields', () => {
      expect(clickhouseEscapeIdentifier('$id')).toBe('`$id`');
      expect(clickhouseEscapeIdentifier('$type')).toBe('`$type`');
    });

    it('should use backticks for special characters', () => {
      expect(clickhouseEscapeIdentifier('user-name')).toBe('`user-name`');
    });
  });
});

// =============================================================================
// formatDefaultValue() Integration Tests
// =============================================================================

describe('ClickHouse formatDefaultValue() uses sql-common', () => {
  describe('should produce identical output to sql-common', () => {
    it('should format null the same way', () => {
      expect(clickhouseFormatDefaultValue(null, 'String')).toBe(
        sqlCommonFormatDefaultValue(null, 'String')
      );
    });

    it('should format strings the same way', () => {
      expect(clickhouseFormatDefaultValue('hello', 'String')).toBe(
        sqlCommonFormatDefaultValue('hello', 'String')
      );
      expect(clickhouseFormatDefaultValue("it's", 'String')).toBe(
        sqlCommonFormatDefaultValue("it's", 'String')
      );
    });

    it('should format numbers the same way', () => {
      expect(clickhouseFormatDefaultValue(42, 'Int32')).toBe(
        sqlCommonFormatDefaultValue(42, 'Int32')
      );
      expect(clickhouseFormatDefaultValue(3.14, 'Float64')).toBe(
        sqlCommonFormatDefaultValue(3.14, 'Float64')
      );
    });

    it('should format booleans the same way', () => {
      expect(clickhouseFormatDefaultValue(true, 'Bool')).toBe(
        sqlCommonFormatDefaultValue(true, 'Bool')
      );
      expect(clickhouseFormatDefaultValue(false, 'Bool')).toBe(
        sqlCommonFormatDefaultValue(false, 'Bool')
      );
    });

    it('should format dates the same way', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      expect(clickhouseFormatDefaultValue(date, 'DateTime64(3)')).toBe(
        sqlCommonFormatDefaultValue(date, 'DateTime64(3)')
      );
      expect(clickhouseFormatDefaultValue(date, 'Date')).toBe(
        sqlCommonFormatDefaultValue(date, 'Date')
      );
    });

    it('should format arrays and objects the same way', () => {
      expect(clickhouseFormatDefaultValue([1, 2, 3], 'Array(Int32)')).toBe(
        sqlCommonFormatDefaultValue([1, 2, 3], 'Array(Int32)')
      );
      expect(clickhouseFormatDefaultValue({ a: 1 }, 'JSON')).toBe(
        sqlCommonFormatDefaultValue({ a: 1 }, 'JSON')
      );
    });
  });
});

// =============================================================================
// generateSystemColumns() Integration Tests
// =============================================================================

describe('ClickHouse generateSystemColumns() uses sql-common', () => {
  describe('should produce identical output to sql-common', () => {
    it('should generate the same system columns as sql-common', () => {
      const clickhouseCols = clickhouseGenerateSystemColumns();
      const sqlCommonCols = sqlCommonGenerateSystemColumns('clickhouse');

      expect(clickhouseCols).toHaveLength(sqlCommonCols.length);

      for (let i = 0; i < clickhouseCols.length; i++) {
        const chCol = clickhouseCols[i];
        const scCol = sqlCommonCols[i];
        expect(chCol?.name).toBe(scCol?.name);
        expect(chCol?.type).toBe(scCol?.type);
        expect(chCol?.nullable).toBe(scCol?.nullable);
        // Note: ClickHouseColumn doesn't have primaryKey property,
        // so we just compare that the underlying SqlColumn has it
        expect((chCol as SqlColumn)?.primaryKey).toBe(scCol?.primaryKey);
        expect(chCol?.default).toBe(scCol?.default);
      }
    });

    it('should use ClickHouse-specific types (String, Int32, Int64)', () => {
      const columns = clickhouseGenerateSystemColumns();

      const idCol = columns.find((c) => c.name === '$id');
      expect(idCol?.type).toBe('String');

      const typeCol = columns.find((c) => c.name === '$type');
      expect(typeCol?.type).toBe('String');

      const versionCol = columns.find((c) => c.name === '$version');
      expect(versionCol?.type).toBe('Int32');

      const createdCol = columns.find((c) => c.name === '$createdAt');
      expect(createdCol?.type).toBe('Int64');

      const updatedCol = columns.find((c) => c.name === '$updatedAt');
      expect(updatedCol?.type).toBe('Int64');
    });
  });
});

// =============================================================================
// serializeColumn() Integration Tests
// =============================================================================

describe('ClickHouse serializeColumn() uses sql-common', () => {
  describe('should produce identical output to sql-common', () => {
    it('should serialize basic columns the same way', () => {
      const column: SqlColumn = {
        name: 'id',
        type: 'UUID',
        nullable: false,
      };
      expect(clickhouseSerializeColumn(column)).toBe(
        sqlCommonSerializeColumn(column, 'clickhouse')
      );
    });

    it('should serialize nullable columns the same way', () => {
      const column: SqlColumn = {
        name: 'description',
        type: 'String',
        nullable: true,
      };
      expect(clickhouseSerializeColumn(column)).toBe(
        sqlCommonSerializeColumn(column, 'clickhouse')
      );
    });

    it('should serialize columns with defaults the same way', () => {
      const column: SqlColumn = {
        name: 'version',
        type: 'Int32',
        nullable: false,
        default: '1',
      };
      expect(clickhouseSerializeColumn(column)).toBe(
        sqlCommonSerializeColumn(column, 'clickhouse')
      );
    });

    it('should serialize columns with special names ($ prefix) the same way', () => {
      const column: SqlColumn = {
        name: '$id',
        type: 'String',
        nullable: false,
      };
      expect(clickhouseSerializeColumn(column)).toBe(
        sqlCommonSerializeColumn(column, 'clickhouse')
      );
      // Verify backticks are used
      expect(clickhouseSerializeColumn(column)).toContain('`$id`');
    });

    it('should serialize columns with unique constraint the same way', () => {
      const column: SqlColumn = {
        name: 'email',
        type: 'String',
        nullable: false,
        unique: true,
      };
      expect(clickhouseSerializeColumn(column)).toBe(
        sqlCommonSerializeColumn(column, 'clickhouse')
      );
    });
  });
});
