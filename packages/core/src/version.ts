/**
 * Schema Version Module for @icetype/core
 *
 * Provides semantic versioning for IceType schemas.
 * SchemaVersion follows semantic versioning (major.minor.patch) for tracking schema changes:
 * - Major: Breaking changes that require migration
 * - Minor: Backward-compatible additions (new fields, etc.)
 * - Patch: Backward-compatible fixes
 *
 * @packageDocumentation
 */

// =============================================================================
// SchemaVersion Branded Type
// =============================================================================

/**
 * Branded type for schema versions.
 * Ensures type safety when working with version objects.
 */
export type SchemaVersion = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
} & { readonly __brand: 'SchemaVersion' };

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates that a number is a valid version component (non-negative integer).
 * @param value - The value to validate
 * @param name - The name of the component for error messages
 * @throws Error if the value is not a valid version component
 */
function validateVersionComponent(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number, got ${value}`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`${name} must be non-negative, got ${value}`);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new SchemaVersion from major, minor, and patch numbers.
 *
 * @param major - The major version number (breaking changes)
 * @param minor - The minor version number (backward-compatible additions)
 * @param patch - The patch version number (backward-compatible fixes)
 * @returns A new SchemaVersion object
 * @throws Error if any version component is negative, non-integer, or not finite
 *
 * @example
 * ```typescript
 * const version = createSchemaVersion(1, 2, 3);
 * console.log(version.major); // 1
 * console.log(version.minor); // 2
 * console.log(version.patch); // 3
 * ```
 */
export function createSchemaVersion(
  major: number,
  minor: number,
  patch: number
): SchemaVersion {
  validateVersionComponent(major, 'major');
  validateVersionComponent(minor, 'minor');
  validateVersionComponent(patch, 'patch');

  return {
    major,
    minor,
    patch,
  } as SchemaVersion;
}

// =============================================================================
// Parser
// =============================================================================

/**
 * Parses a version string in the format "major.minor.patch".
 *
 * @param versionString - The version string to parse (e.g., "1.2.3")
 * @returns A new SchemaVersion object
 * @throws Error if the version string is not in the correct format
 *
 * @example
 * ```typescript
 * const version = parseSchemaVersion('1.2.3');
 * console.log(version.major); // 1
 * ```
 */
export function parseSchemaVersion(versionString: string): SchemaVersion {
  if (!versionString || versionString.trim() === '') {
    throw new Error('Version string cannot be empty');
  }

  // Strict format: only digits separated by dots, exactly 3 parts
  const pattern = /^(\d+)\.(\d+)\.(\d+)$/;
  const match = versionString.match(pattern);

  if (!match) {
    throw new Error(
      `Invalid version string format: "${versionString}". Expected format: "major.minor.patch" (e.g., "1.2.3")`
    );
  }

  const major = parseInt(match[1]!, 10);
  const minor = parseInt(match[2]!, 10);
  const patch = parseInt(match[3]!, 10);

  return createSchemaVersion(major, minor, patch);
}

// =============================================================================
// Serializer
// =============================================================================

/**
 * Serializes a SchemaVersion to a string in the format "major.minor.patch".
 *
 * @param version - The SchemaVersion to serialize
 * @returns The version string (e.g., "1.2.3")
 *
 * @example
 * ```typescript
 * const version = createSchemaVersion(1, 2, 3);
 * console.log(serializeSchemaVersion(version)); // "1.2.3"
 * ```
 */
export function serializeSchemaVersion(version: SchemaVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

// =============================================================================
// Comparison
// =============================================================================

/**
 * Compares two SchemaVersions.
 *
 * @param a - The first version
 * @param b - The second version
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 *
 * @example
 * ```typescript
 * const v1 = createSchemaVersion(1, 0, 0);
 * const v2 = createSchemaVersion(2, 0, 0);
 * console.log(compareVersions(v1, v2)); // -1
 * ```
 */
export function compareVersions(a: SchemaVersion, b: SchemaVersion): -1 | 0 | 1 {
  // Compare major version
  if (a.major < b.major) return -1;
  if (a.major > b.major) return 1;

  // Major versions are equal, compare minor
  if (a.minor < b.minor) return -1;
  if (a.minor > b.minor) return 1;

  // Minor versions are equal, compare patch
  if (a.patch < b.patch) return -1;
  if (a.patch > b.patch) return 1;

  // All components are equal
  return 0;
}

// =============================================================================
// Compatibility Check
// =============================================================================

/**
 * Checks if a migration from an older version to a newer version is safe (backward compatible).
 *
 * Rules:
 * - Patch increments are always compatible
 * - Minor increments are compatible (for stable versions >= 1.0.0)
 * - Major increments are breaking changes (not compatible)
 * - For pre-release versions (0.x.x), minor increments are also breaking
 * - Downgrades are never compatible
 *
 * @param older - The older (current) version
 * @param newer - The newer (target) version
 * @returns true if the migration is safe, false otherwise
 *
 * @example
 * ```typescript
 * const v1 = createSchemaVersion(1, 0, 0);
 * const v2 = createSchemaVersion(1, 1, 0);
 * console.log(isCompatible(v1, v2)); // true (minor increment)
 *
 * const v3 = createSchemaVersion(2, 0, 0);
 * console.log(isCompatible(v1, v3)); // false (major increment)
 * ```
 */
export function isCompatible(older: SchemaVersion, newer: SchemaVersion): boolean {
  const comparison = compareVersions(older, newer);

  // Downgrade is never compatible
  if (comparison > 0) {
    return false;
  }

  // Same version is compatible
  if (comparison === 0) {
    return true;
  }

  // Major version changed - breaking change
  if (newer.major !== older.major) {
    return false;
  }

  // For 0.x.x versions (pre-release), minor changes are breaking
  if (older.major === 0 && newer.minor !== older.minor) {
    return false;
  }

  // Minor or patch increment with same major (and for stable versions) is compatible
  return true;
}

// =============================================================================
// Increment Functions
// =============================================================================

/**
 * Increments the major version, resetting minor and patch to 0.
 * Use for breaking changes.
 *
 * @param version - The current version
 * @returns A new SchemaVersion with incremented major version
 *
 * @example
 * ```typescript
 * const v1 = createSchemaVersion(1, 2, 3);
 * const v2 = incrementMajor(v1);
 * console.log(serializeSchemaVersion(v2)); // "2.0.0"
 * ```
 */
export function incrementMajor(version: SchemaVersion): SchemaVersion {
  return createSchemaVersion(version.major + 1, 0, 0);
}

/**
 * Increments the minor version, resetting patch to 0.
 * Use for backward-compatible additions.
 *
 * @param version - The current version
 * @returns A new SchemaVersion with incremented minor version
 *
 * @example
 * ```typescript
 * const v1 = createSchemaVersion(1, 2, 3);
 * const v2 = incrementMinor(v1);
 * console.log(serializeSchemaVersion(v2)); // "1.3.0"
 * ```
 */
export function incrementMinor(version: SchemaVersion): SchemaVersion {
  return createSchemaVersion(version.major, version.minor + 1, 0);
}

/**
 * Increments the patch version.
 * Use for backward-compatible fixes.
 *
 * @param version - The current version
 * @returns A new SchemaVersion with incremented patch version
 *
 * @example
 * ```typescript
 * const v1 = createSchemaVersion(1, 2, 3);
 * const v2 = incrementPatch(v1);
 * console.log(serializeSchemaVersion(v2)); // "1.2.4"
 * ```
 */
export function incrementPatch(version: SchemaVersion): SchemaVersion {
  return createSchemaVersion(version.major, version.minor, version.patch + 1);
}
