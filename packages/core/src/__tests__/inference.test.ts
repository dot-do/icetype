/**
 * Type Inference Tests for @icetype/core
 *
 * Tests for the inferType function which infers IceType types from JavaScript values.
 */

import { describe, it, expect } from 'vitest';
import { inferType } from '../parser.js';

// =============================================================================
// Basic Type Inference Tests
// =============================================================================

describe('inferType', () => {
  describe('string inference', () => {
    it('should infer "hello" as string', () => {
      expect(inferType('hello')).toBe('string');
    });

    it('should infer empty string as string', () => {
      expect(inferType('')).toBe('string');
    });

    it('should infer long text as string', () => {
      expect(inferType('This is a longer piece of text with multiple words.')).toBe('string');
    });

    it('should infer string with numbers as string', () => {
      expect(inferType('abc123')).toBe('string');
    });

    it('should infer string with special characters as string', () => {
      expect(inferType('hello@world.com')).toBe('string');
    });
  });

  describe('integer inference', () => {
    it('should infer 42 as int', () => {
      expect(inferType(42)).toBe('int');
    });

    it('should infer 0 as int', () => {
      expect(inferType(0)).toBe('int');
    });

    it('should infer negative integers as int', () => {
      expect(inferType(-100)).toBe('int');
    });

    it('should infer maximum 32-bit integer as int', () => {
      expect(inferType(2147483647)).toBe('int');
    });

    it('should infer minimum 32-bit integer as int', () => {
      expect(inferType(-2147483648)).toBe('int');
    });
  });

  describe('bigint inference', () => {
    it('should infer numbers larger than max int32 as bigint', () => {
      expect(inferType(2147483648)).toBe('bigint');
    });

    it('should infer numbers smaller than min int32 as bigint', () => {
      expect(inferType(-2147483649)).toBe('bigint');
    });

    it('should infer very large numbers as bigint', () => {
      expect(inferType(9007199254740991)).toBe('bigint');
    });

    it('should infer JavaScript bigint as bigint', () => {
      expect(inferType(BigInt('9007199254740991'))).toBe('bigint');
    });
  });

  describe('float inference', () => {
    it('should infer 3.14 as float', () => {
      expect(inferType(3.14)).toBe('float');
    });

    it('should infer 0.1 as float', () => {
      expect(inferType(0.1)).toBe('float');
    });

    it('should infer negative floats as float', () => {
      expect(inferType(-3.14)).toBe('float');
    });

    it('should infer very small floats as float', () => {
      expect(inferType(0.0001)).toBe('float');
    });

    it('should infer scientific notation resulting in large int as bigint', () => {
      // 1.5e10 = 15000000000 which is > max int32, so it's bigint
      expect(inferType(1.5e10)).toBe('bigint');
    });

    it('should infer small scientific notation as float', () => {
      expect(inferType(1.5e-10)).toBe('float');
    });
  });

  describe('boolean inference', () => {
    it('should infer true as bool', () => {
      expect(inferType(true)).toBe('bool');
    });

    it('should infer false as bool', () => {
      expect(inferType(false)).toBe('bool');
    });
  });

  describe('date inference', () => {
    it('should infer "2024-01-15" as date', () => {
      expect(inferType('2024-01-15')).toBe('date');
    });

    it('should infer date with different values as date', () => {
      expect(inferType('2000-12-31')).toBe('date');
    });

    it('should infer date at year boundaries as date', () => {
      expect(inferType('1999-01-01')).toBe('date');
    });

    it('should not infer partial date as date', () => {
      expect(inferType('2024-01')).toBe('string');
    });

    it('should not infer invalid date format as date', () => {
      expect(inferType('01-15-2024')).toBe('string');
    });
  });

  describe('timestamp inference', () => {
    it('should infer "2024-01-15T10:30:00Z" as timestamp', () => {
      expect(inferType('2024-01-15T10:30:00Z')).toBe('timestamp');
    });

    it('should infer ISO timestamp without Z as timestamp', () => {
      expect(inferType('2024-01-15T10:30:00')).toBe('timestamp');
    });

    it('should infer timestamp with milliseconds as timestamp', () => {
      expect(inferType('2024-01-15T10:30:00.123Z')).toBe('timestamp');
    });

    it('should infer timestamp with timezone offset as timestamp', () => {
      expect(inferType('2024-01-15T10:30:00+05:00')).toBe('timestamp');
    });

    it('should infer Date object as timestamp', () => {
      expect(inferType(new Date())).toBe('timestamp');
    });

    it('should infer specific Date object as timestamp', () => {
      expect(inferType(new Date('2024-01-15T10:30:00Z'))).toBe('timestamp');
    });
  });

  describe('uuid inference', () => {
    it('should infer valid UUID v4 as uuid', () => {
      expect(inferType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
    });

    it('should infer UUID with uppercase as uuid', () => {
      expect(inferType('550E8400-E29B-41D4-A716-446655440000')).toBe('uuid');
    });

    it('should infer UUID with mixed case as uuid', () => {
      expect(inferType('550e8400-E29B-41d4-A716-446655440000')).toBe('uuid');
    });

    it('should infer different valid UUIDs as uuid', () => {
      expect(inferType('123e4567-e89b-12d3-a456-426614174000')).toBe('uuid');
      expect(inferType('00000000-0000-0000-0000-000000000000')).toBe('uuid');
      expect(inferType('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe('uuid');
    });

    it('should not infer invalid UUID as uuid', () => {
      expect(inferType('550e8400-e29b-41d4-a716')).toBe('string'); // too short
      expect(inferType('not-a-uuid')).toBe('string');
      expect(inferType('550e8400e29b41d4a716446655440000')).toBe('string'); // no dashes
    });
  });

  describe('time inference', () => {
    it('should infer time string as time', () => {
      expect(inferType('10:30:00')).toBe('time');
    });

    it('should infer midnight as time', () => {
      expect(inferType('00:00:00')).toBe('time');
    });

    it('should infer end of day as time', () => {
      expect(inferType('23:59:59')).toBe('time');
    });

    it('should not infer partial time as time', () => {
      expect(inferType('10:30')).toBe('string');
    });
  });

  describe('array inference', () => {
    it('should infer [1, 2, 3] as int[]', () => {
      expect(inferType([1, 2, 3])).toBe('int[]');
    });

    it('should infer string array as string[]', () => {
      expect(inferType(['a', 'b', 'c'])).toBe('string[]');
    });

    it('should infer float array as float[]', () => {
      expect(inferType([1.1, 2.2, 3.3])).toBe('float[]');
    });

    it('should infer boolean array as bool[]', () => {
      expect(inferType([true, false, true])).toBe('bool[]');
    });

    it('should infer empty array as json[]', () => {
      expect(inferType([])).toBe('json[]');
    });

    it('should infer array of objects as json[]', () => {
      expect(inferType([{ a: 1 }, { b: 2 }])).toBe('json[]');
    });

    it('should infer nested arrays as json[][]', () => {
      expect(inferType([[1, 2], [3, 4]])).toBe('int[][]');
    });

    it('should infer array of dates as date[]', () => {
      expect(inferType(['2024-01-15', '2024-01-16'])).toBe('date[]');
    });

    it('should infer array of timestamps as timestamp[]', () => {
      expect(inferType(['2024-01-15T10:30:00Z', '2024-01-16T10:30:00Z'])).toBe('timestamp[]');
    });

    it('should infer array of UUIDs as uuid[]', () => {
      expect(inferType(['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'])).toBe('uuid[]');
    });
  });

  describe('object inference', () => {
    it('should infer plain object as json', () => {
      expect(inferType({ foo: 'bar' })).toBe('json');
    });

    it('should infer empty object as json', () => {
      expect(inferType({})).toBe('json');
    });

    it('should infer nested object as json', () => {
      expect(inferType({ a: { b: { c: 1 } } })).toBe('json');
    });

    it('should infer object with mixed values as json', () => {
      expect(inferType({ str: 'hello', num: 42, bool: true })).toBe('json');
    });
  });

  describe('null and undefined', () => {
    it('should infer null as json?', () => {
      expect(inferType(null)).toBe('json?');
    });

    it('should infer undefined as json?', () => {
      expect(inferType(undefined)).toBe('json?');
    });
  });

  describe('binary inference', () => {
    it('should infer Uint8Array as binary', () => {
      expect(inferType(new Uint8Array([1, 2, 3]))).toBe('binary');
    });

    it('should infer empty Uint8Array as binary', () => {
      expect(inferType(new Uint8Array())).toBe('binary');
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('should handle special float values', () => {
      expect(inferType(Infinity)).toBe('float');
      expect(inferType(-Infinity)).toBe('float');
      expect(inferType(NaN)).toBe('float');
    });

    it('should handle zero', () => {
      expect(inferType(0)).toBe('int');
      expect(inferType(-0)).toBe('int');
    });

    it('should handle strings that look like numbers', () => {
      expect(inferType('42')).toBe('string');
      expect(inferType('3.14')).toBe('string');
    });

    it('should handle strings that look like booleans', () => {
      expect(inferType('true')).toBe('string');
      expect(inferType('false')).toBe('string');
    });

    it('should handle mixed type arrays based on first element', () => {
      // inferType uses first element to determine array type
      expect(inferType([1, 'two', 3])).toBe('int[]');
      expect(inferType(['one', 2, 'three'])).toBe('string[]');
    });

    it('should handle single-element arrays', () => {
      expect(inferType([42])).toBe('int[]');
      expect(inferType(['hello'])).toBe('string[]');
      expect(inferType([true])).toBe('bool[]');
    });
  });

  // =============================================================================
  // Real-World Examples
  // =============================================================================

  describe('real-world examples', () => {
    it('should correctly infer user data types', () => {
      expect(inferType('john@example.com')).toBe('string');
      expect(inferType(28)).toBe('int');
      expect(inferType(true)).toBe('bool');
      expect(inferType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
      expect(inferType('2024-01-15T10:30:00Z')).toBe('timestamp');
    });

    it('should correctly infer product data types', () => {
      expect(inferType('Widget Pro')).toBe('string');
      expect(inferType(29.99)).toBe('float');
      expect(inferType(100)).toBe('int');
      expect(inferType(['electronics', 'gadgets'])).toBe('string[]');
      expect(inferType({ color: 'blue', size: 'large' })).toBe('json');
    });

    it('should correctly infer order data types', () => {
      expect(inferType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
      expect(inferType([1, 2, 3, 4])).toBe('int[]');
      expect(inferType(159.99)).toBe('float');
      expect(inferType('2024-01-15')).toBe('date');
      expect(inferType('pending')).toBe('string');
    });

    it('should correctly infer analytics data types', () => {
      expect(inferType(1000000)).toBe('int');
      expect(inferType(9999999999)).toBe('bigint');
      expect(inferType(0.0523)).toBe('float');
      expect(inferType([0.1, 0.2, 0.3, 0.4])).toBe('float[]');
    });
  });
});
