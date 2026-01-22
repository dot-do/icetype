/**
 * Branded Type Validation Tests for @icetype/core
 *
 * RED PHASE TDD: These tests expect validation behavior that does NOT exist yet.
 * The factory functions currently use type assertions without validation.
 *
 * Expected behavior (to be implemented):
 * - createSchemaId: validates input is a non-empty string matching identifier pattern
 * - createFieldId: validates input is a non-negative integer
 * - createSchemaVersion: already validates semver components (✓ implemented)
 *
 * @see https://github.com/dot-do/icetype/issues/icetype-6lo.4
 */

import { describe, it, expect } from 'vitest';
import {
  createSchemaId,
  createFieldId,
  createRelationId,
  type SchemaId,
  type FieldId,
  type RelationId,
} from '../src/types.js';
import {
  createSchemaVersion,
  parseSchemaVersion,
  type SchemaVersion,
} from '../src/version.js';

// =============================================================================
// createSchemaId Validation Tests
// =============================================================================

describe('createSchemaId validation', () => {
  describe('valid inputs', () => {
    it('should accept a valid identifier string', () => {
      const id = createSchemaId('UserSchema');
      expect(id).toBe('UserSchema');
    });

    it('should accept alphanumeric identifiers', () => {
      const id = createSchemaId('User123');
      expect(id).toBe('User123');
    });

    it('should accept identifiers with underscores', () => {
      const id = createSchemaId('user_schema');
      expect(id).toBe('user_schema');
    });

    it('should accept identifiers with hyphens', () => {
      const id = createSchemaId('user-schema');
      expect(id).toBe('user-schema');
    });
  });

  describe('invalid inputs - should throw descriptive errors', () => {
    it('should throw for empty string', () => {
      expect(() => createSchemaId('')).toThrow();
    });

    it('should throw descriptive error for empty string', () => {
      expect(() => createSchemaId('')).toThrow(/empty|required|invalid/i);
    });

    it('should throw for whitespace-only string', () => {
      expect(() => createSchemaId('   ')).toThrow();
    });

    it('should throw for string starting with number', () => {
      // Schema identifiers should follow typical identifier rules
      expect(() => createSchemaId('123schema')).toThrow();
    });

    it('should throw for string with only whitespace and special characters', () => {
      expect(() => createSchemaId('\t\n')).toThrow();
    });

    it('should throw descriptive error message indicating the problem', () => {
      try {
        createSchemaId('');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        // Error message should be descriptive
        expect(message.length).toBeGreaterThan(10);
        expect(message.toLowerCase()).toMatch(/schema|id|empty|invalid|identifier/);
      }
    });
  });
});

// =============================================================================
// createFieldId Validation Tests
// =============================================================================

describe('createFieldId validation', () => {
  describe('valid inputs', () => {
    it('should accept zero', () => {
      const id = createFieldId(0);
      expect(id).toBe(0);
    });

    it('should accept positive integers', () => {
      const id = createFieldId(42);
      expect(id).toBe(42);
    });

    it('should accept large positive integers', () => {
      const id = createFieldId(Number.MAX_SAFE_INTEGER);
      expect(id).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('invalid inputs - should throw for non-negative integers', () => {
    it('should throw for negative numbers', () => {
      expect(() => createFieldId(-1)).toThrow();
    });

    it('should throw for negative large numbers', () => {
      expect(() => createFieldId(-100)).toThrow();
    });

    it('should throw descriptive error for negative numbers', () => {
      expect(() => createFieldId(-1)).toThrow(/negative|non-negative|invalid/i);
    });

    it('should throw for floating point numbers', () => {
      expect(() => createFieldId(3.14)).toThrow();
    });

    it('should throw for negative floating point numbers', () => {
      expect(() => createFieldId(-3.14)).toThrow();
    });

    it('should throw descriptive error for floating point', () => {
      expect(() => createFieldId(3.14)).toThrow(/integer|whole|invalid/i);
    });

    it('should throw for NaN', () => {
      expect(() => createFieldId(NaN)).toThrow();
    });

    it('should throw descriptive error for NaN', () => {
      expect(() => createFieldId(NaN)).toThrow(/nan|finite|invalid|number/i);
    });

    it('should throw for Infinity', () => {
      expect(() => createFieldId(Infinity)).toThrow();
    });

    it('should throw for negative Infinity', () => {
      expect(() => createFieldId(-Infinity)).toThrow();
    });

    it('should throw descriptive error for Infinity', () => {
      expect(() => createFieldId(Infinity)).toThrow(/infinity|finite|invalid/i);
    });

    it('should throw descriptive error message indicating the problem', () => {
      try {
        createFieldId(-5);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        // Error message should be descriptive
        expect(message.length).toBeGreaterThan(10);
        expect(message.toLowerCase()).toMatch(/field|id|negative|invalid|non-negative/);
      }
    });
  });
});

// =============================================================================
// createSchemaVersion Validation Tests (should already pass - GREEN)
// =============================================================================

describe('createSchemaVersion validation', () => {
  describe('valid inputs', () => {
    it('should accept valid semver components', () => {
      const version = createSchemaVersion(1, 2, 3);
      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
    });

    it('should accept zero for all components', () => {
      const version = createSchemaVersion(0, 0, 0);
      expect(version.major).toBe(0);
      expect(version.minor).toBe(0);
      expect(version.patch).toBe(0);
    });
  });

  describe('invalid inputs - should throw descriptive errors', () => {
    it('should throw for negative major version', () => {
      expect(() => createSchemaVersion(-1, 0, 0)).toThrow();
    });

    it('should throw for negative minor version', () => {
      expect(() => createSchemaVersion(0, -1, 0)).toThrow();
    });

    it('should throw for negative patch version', () => {
      expect(() => createSchemaVersion(0, 0, -1)).toThrow();
    });

    it('should throw descriptive error for negative major', () => {
      expect(() => createSchemaVersion(-1, 0, 0)).toThrow(/major|negative|non-negative/i);
    });

    it('should throw descriptive error for negative minor', () => {
      expect(() => createSchemaVersion(0, -1, 0)).toThrow(/minor|negative|non-negative/i);
    });

    it('should throw descriptive error for negative patch', () => {
      expect(() => createSchemaVersion(0, 0, -1)).toThrow(/patch|negative|non-negative/i);
    });

    it('should throw for non-integer major', () => {
      expect(() => createSchemaVersion(1.5, 0, 0)).toThrow();
    });

    it('should throw for non-integer minor', () => {
      expect(() => createSchemaVersion(0, 1.5, 0)).toThrow();
    });

    it('should throw for non-integer patch', () => {
      expect(() => createSchemaVersion(0, 0, 1.5)).toThrow();
    });

    it('should throw descriptive error for non-integer', () => {
      expect(() => createSchemaVersion(1.5, 0, 0)).toThrow(/integer|whole/i);
    });

    it('should throw for NaN major', () => {
      expect(() => createSchemaVersion(NaN, 0, 0)).toThrow();
    });

    it('should throw for NaN minor', () => {
      expect(() => createSchemaVersion(0, NaN, 0)).toThrow();
    });

    it('should throw for NaN patch', () => {
      expect(() => createSchemaVersion(0, 0, NaN)).toThrow();
    });

    it('should throw for Infinity major', () => {
      expect(() => createSchemaVersion(Infinity, 0, 0)).toThrow();
    });

    it('should throw for Infinity minor', () => {
      expect(() => createSchemaVersion(0, Infinity, 0)).toThrow();
    });

    it('should throw for Infinity patch', () => {
      expect(() => createSchemaVersion(0, 0, Infinity)).toThrow();
    });
  });
});

// =============================================================================
// parseSchemaVersion Validation Tests (should already pass - GREEN)
// =============================================================================

describe('parseSchemaVersion validation', () => {
  describe('valid inputs', () => {
    it('should parse valid semver string', () => {
      const version = parseSchemaVersion('1.2.3');
      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
    });
  });

  describe('invalid inputs - should throw descriptive errors', () => {
    it('should throw for empty string', () => {
      expect(() => parseSchemaVersion('')).toThrow();
    });

    it('should throw descriptive error for empty string', () => {
      expect(() => parseSchemaVersion('')).toThrow(/empty|required|invalid/i);
    });

    it('should throw for invalid format', () => {
      expect(() => parseSchemaVersion('1.2')).toThrow();
    });

    it('should throw descriptive error for invalid format', () => {
      expect(() => parseSchemaVersion('1.2')).toThrow(/format|invalid|expected/i);
    });

    it('should throw for non-numeric parts', () => {
      expect(() => parseSchemaVersion('a.b.c')).toThrow();
    });

    it('should throw for version with prefix', () => {
      expect(() => parseSchemaVersion('v1.2.3')).toThrow();
    });

    it('should throw for version with prerelease suffix', () => {
      expect(() => parseSchemaVersion('1.2.3-beta')).toThrow();
    });

    it('should throw for too many parts', () => {
      expect(() => parseSchemaVersion('1.2.3.4')).toThrow();
    });
  });
});

// =============================================================================
// createRelationId Validation Tests
// =============================================================================

describe('createRelationId validation', () => {
  describe('valid inputs', () => {
    it('should accept a valid relation identifier', () => {
      const id = createRelationId('user-posts');
      expect(id).toBe('user-posts');
    });

    it('should accept relation identifiers with arrows', () => {
      const id = createRelationId('user->posts');
      expect(id).toBe('user->posts');
    });
  });

  describe('invalid inputs - should throw descriptive errors', () => {
    it('should throw for empty string', () => {
      expect(() => createRelationId('')).toThrow();
    });

    it('should throw descriptive error for empty string', () => {
      expect(() => createRelationId('')).toThrow(/empty|required|invalid/i);
    });

    it('should throw for whitespace-only string', () => {
      expect(() => createRelationId('   ')).toThrow();
    });
  });
});

// =============================================================================
// Error Type and Structure Tests
// =============================================================================

describe('Error types and structure', () => {
  describe('createSchemaId errors', () => {
    it('should throw Error instance', () => {
      try {
        createSchemaId('');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should have meaningful error message', () => {
      try {
        createSchemaId('');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBeTruthy();
        expect((error as Error).message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createFieldId errors', () => {
    it('should throw Error instance', () => {
      try {
        createFieldId(-1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should have meaningful error message', () => {
      try {
        createFieldId(-1);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBeTruthy();
        expect((error as Error).message.length).toBeGreaterThan(0);
      }
    });

    it('should include the invalid value in error message', () => {
      try {
        createFieldId(-42);
        expect.fail('Should have thrown');
      } catch (error) {
        // The error message should include the actual invalid value for debugging
        expect((error as Error).message).toContain('-42');
      }
    });
  });

  describe('createRelationId errors', () => {
    it('should throw Error instance', () => {
      try {
        createRelationId('');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should have meaningful error message', () => {
      try {
        createRelationId('');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBeTruthy();
        expect((error as Error).message.length).toBeGreaterThan(0);
      }
    });
  });
});
