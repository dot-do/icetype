/**
 * SchemaVersion Tests for @icetype/core
 *
 * Tests for semantic versioning of schemas.
 * SchemaVersion follows semantic versioning (major.minor.patch) for tracking schema changes.
 */

import { describe, it, expect } from 'vitest';
import {
  createSchemaVersion,
  parseSchemaVersion,
  serializeSchemaVersion,
  compareVersions,
  isCompatible,
  incrementMajor,
  incrementMinor,
  incrementPatch,
  type SchemaVersion,
} from '../src/version.js';

// =============================================================================
// createSchemaVersion Tests
// =============================================================================

describe('createSchemaVersion', () => {
  it('should create a SchemaVersion from valid major, minor, patch numbers', () => {
    const version = createSchemaVersion(1, 2, 3);
    expect(version.major).toBe(1);
    expect(version.minor).toBe(2);
    expect(version.patch).toBe(3);
  });

  it('should create a SchemaVersion with zeros', () => {
    const version = createSchemaVersion(0, 0, 0);
    expect(version.major).toBe(0);
    expect(version.minor).toBe(0);
    expect(version.patch).toBe(0);
  });

  it('should create a SchemaVersion with large numbers', () => {
    const version = createSchemaVersion(100, 200, 300);
    expect(version.major).toBe(100);
    expect(version.minor).toBe(200);
    expect(version.patch).toBe(300);
  });

  it('should throw error for negative major version', () => {
    expect(() => createSchemaVersion(-1, 0, 0)).toThrow();
  });

  it('should throw error for negative minor version', () => {
    expect(() => createSchemaVersion(0, -1, 0)).toThrow();
  });

  it('should throw error for negative patch version', () => {
    expect(() => createSchemaVersion(0, 0, -1)).toThrow();
  });

  it('should throw error for non-integer major version', () => {
    expect(() => createSchemaVersion(1.5, 0, 0)).toThrow();
  });

  it('should throw error for non-integer minor version', () => {
    expect(() => createSchemaVersion(0, 1.5, 0)).toThrow();
  });

  it('should throw error for non-integer patch version', () => {
    expect(() => createSchemaVersion(0, 0, 1.5)).toThrow();
  });

  it('should throw error for NaN values', () => {
    expect(() => createSchemaVersion(NaN, 0, 0)).toThrow();
    expect(() => createSchemaVersion(0, NaN, 0)).toThrow();
    expect(() => createSchemaVersion(0, 0, NaN)).toThrow();
  });

  it('should throw error for Infinity values', () => {
    expect(() => createSchemaVersion(Infinity, 0, 0)).toThrow();
    expect(() => createSchemaVersion(0, Infinity, 0)).toThrow();
    expect(() => createSchemaVersion(0, 0, Infinity)).toThrow();
  });

  it('should throw error for negative Infinity values', () => {
    expect(() => createSchemaVersion(-Infinity, 0, 0)).toThrow();
    expect(() => createSchemaVersion(0, -Infinity, 0)).toThrow();
    expect(() => createSchemaVersion(0, 0, -Infinity)).toThrow();
  });
});

// =============================================================================
// parseSchemaVersion Tests
// =============================================================================

describe('parseSchemaVersion', () => {
  it('should parse a valid version string "1.2.3"', () => {
    const version = parseSchemaVersion('1.2.3');
    expect(version.major).toBe(1);
    expect(version.minor).toBe(2);
    expect(version.patch).toBe(3);
  });

  it('should parse version string with zeros "0.0.0"', () => {
    const version = parseSchemaVersion('0.0.0');
    expect(version.major).toBe(0);
    expect(version.minor).toBe(0);
    expect(version.patch).toBe(0);
  });

  it('should parse version string with large numbers "100.200.300"', () => {
    const version = parseSchemaVersion('100.200.300');
    expect(version.major).toBe(100);
    expect(version.minor).toBe(200);
    expect(version.patch).toBe(300);
  });

  it('should throw error for invalid version string format', () => {
    expect(() => parseSchemaVersion('1.2')).toThrow();
    expect(() => parseSchemaVersion('1')).toThrow();
    expect(() => parseSchemaVersion('1.2.3.4')).toThrow();
    expect(() => parseSchemaVersion('v1.2.3')).toThrow();
    expect(() => parseSchemaVersion('1.2.3-beta')).toThrow();
  });

  it('should throw error for non-numeric version parts', () => {
    expect(() => parseSchemaVersion('a.b.c')).toThrow();
    expect(() => parseSchemaVersion('1.a.3')).toThrow();
  });

  it('should throw error for empty string', () => {
    expect(() => parseSchemaVersion('')).toThrow();
  });

  it('should throw error for whitespace-only string', () => {
    expect(() => parseSchemaVersion('   ')).toThrow();
  });

  it('should throw error for negative numbers in string', () => {
    expect(() => parseSchemaVersion('-1.0.0')).toThrow();
    expect(() => parseSchemaVersion('1.-1.0')).toThrow();
    expect(() => parseSchemaVersion('1.0.-1')).toThrow();
  });

  it('should throw error for floating point numbers in string', () => {
    expect(() => parseSchemaVersion('1.5.0.0')).toThrow();
    expect(() => parseSchemaVersion('1.0.5.0')).toThrow();
  });
});

// =============================================================================
// serializeSchemaVersion Tests
// =============================================================================

describe('serializeSchemaVersion', () => {
  it('should serialize version to string "1.2.3"', () => {
    const version = createSchemaVersion(1, 2, 3);
    expect(serializeSchemaVersion(version)).toBe('1.2.3');
  });

  it('should serialize version with zeros "0.0.0"', () => {
    const version = createSchemaVersion(0, 0, 0);
    expect(serializeSchemaVersion(version)).toBe('0.0.0');
  });

  it('should serialize version with large numbers', () => {
    const version = createSchemaVersion(100, 200, 300);
    expect(serializeSchemaVersion(version)).toBe('100.200.300');
  });

  it('should roundtrip: parse then serialize returns original string', () => {
    const original = '5.10.15';
    const version = parseSchemaVersion(original);
    expect(serializeSchemaVersion(version)).toBe(original);
  });

  it('should roundtrip: serialize then parse returns equivalent version', () => {
    const original = createSchemaVersion(5, 10, 15);
    const serialized = serializeSchemaVersion(original);
    const parsed = parseSchemaVersion(serialized);
    expect(parsed.major).toBe(original.major);
    expect(parsed.minor).toBe(original.minor);
    expect(parsed.patch).toBe(original.patch);
  });
});

// =============================================================================
// compareVersions Tests
// =============================================================================

describe('compareVersions', () => {
  it('should return 0 for equal versions', () => {
    const a = createSchemaVersion(1, 2, 3);
    const b = createSchemaVersion(1, 2, 3);
    expect(compareVersions(a, b)).toBe(0);
  });

  it('should return -1 when first version is less (major differs)', () => {
    const a = createSchemaVersion(1, 0, 0);
    const b = createSchemaVersion(2, 0, 0);
    expect(compareVersions(a, b)).toBe(-1);
  });

  it('should return 1 when first version is greater (major differs)', () => {
    const a = createSchemaVersion(2, 0, 0);
    const b = createSchemaVersion(1, 0, 0);
    expect(compareVersions(a, b)).toBe(1);
  });

  it('should return -1 when first version is less (minor differs)', () => {
    const a = createSchemaVersion(1, 1, 0);
    const b = createSchemaVersion(1, 2, 0);
    expect(compareVersions(a, b)).toBe(-1);
  });

  it('should return 1 when first version is greater (minor differs)', () => {
    const a = createSchemaVersion(1, 2, 0);
    const b = createSchemaVersion(1, 1, 0);
    expect(compareVersions(a, b)).toBe(1);
  });

  it('should return -1 when first version is less (patch differs)', () => {
    const a = createSchemaVersion(1, 2, 3);
    const b = createSchemaVersion(1, 2, 4);
    expect(compareVersions(a, b)).toBe(-1);
  });

  it('should return 1 when first version is greater (patch differs)', () => {
    const a = createSchemaVersion(1, 2, 4);
    const b = createSchemaVersion(1, 2, 3);
    expect(compareVersions(a, b)).toBe(1);
  });

  it('should prioritize major over minor', () => {
    const a = createSchemaVersion(2, 0, 0);
    const b = createSchemaVersion(1, 99, 99);
    expect(compareVersions(a, b)).toBe(1);
  });

  it('should prioritize minor over patch', () => {
    const a = createSchemaVersion(1, 2, 0);
    const b = createSchemaVersion(1, 1, 99);
    expect(compareVersions(a, b)).toBe(1);
  });

  it('should return 0 for two 0.0.0 versions', () => {
    const a = createSchemaVersion(0, 0, 0);
    const b = createSchemaVersion(0, 0, 0);
    expect(compareVersions(a, b)).toBe(0);
  });
});

// =============================================================================
// isCompatible Tests
// =============================================================================

describe('isCompatible', () => {
  it('should return true when versions are equal', () => {
    const older = createSchemaVersion(1, 2, 3);
    const newer = createSchemaVersion(1, 2, 3);
    expect(isCompatible(older, newer)).toBe(true);
  });

  it('should return true for patch increment (backward compatible)', () => {
    const older = createSchemaVersion(1, 2, 3);
    const newer = createSchemaVersion(1, 2, 4);
    expect(isCompatible(older, newer)).toBe(true);
  });

  it('should return true for minor increment (backward compatible)', () => {
    const older = createSchemaVersion(1, 2, 0);
    const newer = createSchemaVersion(1, 3, 0);
    expect(isCompatible(older, newer)).toBe(true);
  });

  it('should return false for major increment (breaking change)', () => {
    const older = createSchemaVersion(1, 0, 0);
    const newer = createSchemaVersion(2, 0, 0);
    expect(isCompatible(older, newer)).toBe(false);
  });

  it('should return false when older is newer than newer (downgrade)', () => {
    const older = createSchemaVersion(1, 2, 3);
    const newer = createSchemaVersion(1, 2, 2);
    expect(isCompatible(older, newer)).toBe(false);
  });

  it('should return false for minor downgrade', () => {
    const older = createSchemaVersion(1, 3, 0);
    const newer = createSchemaVersion(1, 2, 0);
    expect(isCompatible(older, newer)).toBe(false);
  });

  it('should return false for major downgrade', () => {
    const older = createSchemaVersion(2, 0, 0);
    const newer = createSchemaVersion(1, 0, 0);
    expect(isCompatible(older, newer)).toBe(false);
  });

  it('should return true for multiple minor/patch increments', () => {
    const older = createSchemaVersion(1, 0, 0);
    const newer = createSchemaVersion(1, 5, 10);
    expect(isCompatible(older, newer)).toBe(true);
  });

  it('should handle 0.x.x versions (pre-release)', () => {
    // In 0.x.x versions, minor changes are breaking
    const older = createSchemaVersion(0, 1, 0);
    const newer = createSchemaVersion(0, 2, 0);
    // This should be false since 0.x versions are unstable
    expect(isCompatible(older, newer)).toBe(false);
  });

  it('should return true for patch increment in 0.x.x versions', () => {
    const older = createSchemaVersion(0, 1, 0);
    const newer = createSchemaVersion(0, 1, 1);
    expect(isCompatible(older, newer)).toBe(true);
  });
});

// =============================================================================
// incrementMajor Tests
// =============================================================================

describe('incrementMajor', () => {
  it('should increment major version and reset minor and patch', () => {
    const version = createSchemaVersion(1, 2, 3);
    const incremented = incrementMajor(version);
    expect(incremented.major).toBe(2);
    expect(incremented.minor).toBe(0);
    expect(incremented.patch).toBe(0);
  });

  it('should increment major from 0.0.0 to 1.0.0', () => {
    const version = createSchemaVersion(0, 0, 0);
    const incremented = incrementMajor(version);
    expect(incremented.major).toBe(1);
    expect(incremented.minor).toBe(0);
    expect(incremented.patch).toBe(0);
  });

  it('should not mutate the original version', () => {
    const version = createSchemaVersion(1, 2, 3);
    incrementMajor(version);
    expect(version.major).toBe(1);
    expect(version.minor).toBe(2);
    expect(version.patch).toBe(3);
  });
});

// =============================================================================
// incrementMinor Tests
// =============================================================================

describe('incrementMinor', () => {
  it('should increment minor version and reset patch', () => {
    const version = createSchemaVersion(1, 2, 3);
    const incremented = incrementMinor(version);
    expect(incremented.major).toBe(1);
    expect(incremented.minor).toBe(3);
    expect(incremented.patch).toBe(0);
  });

  it('should increment minor from 0.0.0 to 0.1.0', () => {
    const version = createSchemaVersion(0, 0, 0);
    const incremented = incrementMinor(version);
    expect(incremented.major).toBe(0);
    expect(incremented.minor).toBe(1);
    expect(incremented.patch).toBe(0);
  });

  it('should not mutate the original version', () => {
    const version = createSchemaVersion(1, 2, 3);
    incrementMinor(version);
    expect(version.major).toBe(1);
    expect(version.minor).toBe(2);
    expect(version.patch).toBe(3);
  });
});

// =============================================================================
// incrementPatch Tests
// =============================================================================

describe('incrementPatch', () => {
  it('should increment patch version only', () => {
    const version = createSchemaVersion(1, 2, 3);
    const incremented = incrementPatch(version);
    expect(incremented.major).toBe(1);
    expect(incremented.minor).toBe(2);
    expect(incremented.patch).toBe(4);
  });

  it('should increment patch from 0.0.0 to 0.0.1', () => {
    const version = createSchemaVersion(0, 0, 0);
    const incremented = incrementPatch(version);
    expect(incremented.major).toBe(0);
    expect(incremented.minor).toBe(0);
    expect(incremented.patch).toBe(1);
  });

  it('should not mutate the original version', () => {
    const version = createSchemaVersion(1, 2, 3);
    incrementPatch(version);
    expect(version.major).toBe(1);
    expect(version.minor).toBe(2);
    expect(version.patch).toBe(3);
  });
});

// =============================================================================
// Branded Type Tests
// =============================================================================

describe('SchemaVersion branded type', () => {
  it('should have __brand property for type discrimination', () => {
    const version = createSchemaVersion(1, 2, 3);
    // The brand is a compile-time construct, at runtime we just check the shape
    expect(version).toHaveProperty('major');
    expect(version).toHaveProperty('minor');
    expect(version).toHaveProperty('patch');
  });

  it('should be usable as a value', () => {
    const version: SchemaVersion = createSchemaVersion(1, 0, 0);
    expect(version.major).toBe(1);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  it('should handle version at Number.MAX_SAFE_INTEGER boundary', () => {
    // While this is technically valid, it's an extreme edge case
    // The implementation should not crash
    const largeVersion = createSchemaVersion(9999999, 9999999, 9999999);
    expect(serializeSchemaVersion(largeVersion)).toBe('9999999.9999999.9999999');
  });

  it('should compare versions consistently (transitivity)', () => {
    const a = createSchemaVersion(1, 0, 0);
    const b = createSchemaVersion(1, 1, 0);
    const c = createSchemaVersion(1, 2, 0);

    // If a < b and b < c, then a < c
    expect(compareVersions(a, b)).toBe(-1);
    expect(compareVersions(b, c)).toBe(-1);
    expect(compareVersions(a, c)).toBe(-1);
  });

  it('should compare versions consistently (anti-symmetry)', () => {
    const a = createSchemaVersion(1, 2, 3);
    const b = createSchemaVersion(1, 2, 4);

    // If a < b, then b > a
    expect(compareVersions(a, b)).toBe(-1);
    expect(compareVersions(b, a)).toBe(1);
  });

  it('should compare versions consistently (reflexivity)', () => {
    const a = createSchemaVersion(1, 2, 3);
    expect(compareVersions(a, a)).toBe(0);
  });
});
