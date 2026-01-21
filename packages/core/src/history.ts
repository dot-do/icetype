/**
 * Schema History Tracking Module for @icetype/core
 *
 * Provides schema history tracking system that maintains a record of all
 * schema versions and their migrations. This enables tracking schema
 * evolution over time with checksums for integrity verification.
 *
 * @packageDocumentation
 */

import { createHash } from 'node:crypto';
import type { SchemaVersion } from './version.js';
import { parseSchemaVersion, serializeSchemaVersion } from './version.js';
import type { Migration } from './migration.js';
import type { IceTypeSchema, FieldDefinition, RelationDefinition, SchemaDirectives } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a single entry in the schema history.
 */
export interface SchemaHistoryEntry {
  /** Schema version for this entry */
  version: SchemaVersion;
  /** Timestamp when this version was created */
  timestamp: Date;
  /** SHA256 checksum of the canonical schema */
  checksum: string;
  /** Migration that produced this version (null for initial version) */
  migration: Migration | null;
}

/**
 * Represents the complete history of a schema's evolution.
 */
export interface SchemaHistory {
  /** Name of the schema being tracked */
  schemaName: string;
  /** List of history entries in chronological order */
  entries: SchemaHistoryEntry[];
}

/**
 * Serialized format for a history entry (for JSON storage).
 */
interface SerializedHistoryEntry {
  version: string;
  timestamp: string;
  checksum: string;
  migration: SerializedMigration | null;
}

/**
 * Serialized format for a migration (for JSON storage).
 */
interface SerializedMigration {
  id: string;
  fromVersion: string;
  toVersion: string;
  timestamp: string;
  description?: string;
  operations: unknown[];
  isBreaking: boolean;
}

/**
 * Serialized format for schema history (for JSON file storage).
 */
interface SerializedSchemaHistory {
  schemaName: string;
  entries: SerializedHistoryEntry[];
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an empty schema history for tracking schema evolution.
 *
 * @param schemaName - The name of the schema to track
 * @returns A new empty SchemaHistory
 *
 * @example
 * ```typescript
 * const history = createSchemaHistory('User');
 * console.log(history.schemaName); // 'User'
 * console.log(history.entries);    // []
 * ```
 */
export function createSchemaHistory(schemaName: string): SchemaHistory {
  return {
    schemaName,
    entries: [],
  };
}

// =============================================================================
// History Management Functions
// =============================================================================

/**
 * Adds a new entry to the schema history.
 *
 * This function is immutable - it returns a new history object
 * without modifying the original.
 *
 * @param history - The current schema history
 * @param entry - The entry to add
 * @returns A new SchemaHistory with the entry added
 *
 * @example
 * ```typescript
 * let history = createSchemaHistory('User');
 * history = addHistoryEntry(history, {
 *   version: createSchemaVersion(1, 0, 0),
 *   timestamp: new Date(),
 *   checksum: computeSchemaChecksum(schema),
 *   migration: null,
 * });
 * ```
 */
export function addHistoryEntry(
  history: SchemaHistory,
  entry: SchemaHistoryEntry
): SchemaHistory {
  return {
    schemaName: history.schemaName,
    entries: [...history.entries, entry],
  };
}

/**
 * Retrieves a history entry by its version number.
 *
 * @param history - The schema history to search
 * @param version - The version to find
 * @returns The matching entry, or undefined if not found
 *
 * @example
 * ```typescript
 * const entry = getHistoryEntry(history, createSchemaVersion(1, 0, 0));
 * if (entry) {
 *   console.log('Found:', entry.checksum);
 * }
 * ```
 */
export function getHistoryEntry(
  history: SchemaHistory,
  version: SchemaVersion
): SchemaHistoryEntry | undefined {
  return history.entries.find(
    (entry) =>
      entry.version.major === version.major &&
      entry.version.minor === version.minor &&
      entry.version.patch === version.patch
  );
}

/**
 * Gets the most recent entry in the schema history.
 *
 * @param history - The schema history
 * @returns The latest entry, or undefined if history is empty
 *
 * @example
 * ```typescript
 * const latest = getLatestEntry(history);
 * if (latest) {
 *   console.log('Latest version:', serializeSchemaVersion(latest.version));
 * }
 * ```
 */
export function getLatestEntry(history: SchemaHistory): SchemaHistoryEntry | undefined {
  if (history.entries.length === 0) {
    return undefined;
  }
  return history.entries[history.entries.length - 1];
}

// =============================================================================
// Serialization Functions
// =============================================================================

/**
 * Serializes a schema history to JSON for file storage.
 *
 * The output format is designed for human readability and
 * version control compatibility.
 *
 * @param history - The schema history to serialize
 * @returns A JSON string representation
 *
 * @example
 * ```typescript
 * const json = serializeHistory(history);
 * fs.writeFileSync('schema-history.json', json);
 * ```
 */
export function serializeHistory(history: SchemaHistory): string {
  const serialized: SerializedSchemaHistory = {
    schemaName: history.schemaName,
    entries: history.entries.map((entry) => ({
      version: serializeSchemaVersion(entry.version),
      timestamp: entry.timestamp.toISOString(),
      checksum: entry.checksum,
      migration: entry.migration ? serializeMigration(entry.migration) : null,
    })),
  };

  return JSON.stringify(serialized, null, 2);
}

/**
 * Serialize a migration to JSON-compatible format.
 */
function serializeMigration(migration: Migration): SerializedMigration {
  const serialized: SerializedMigration = {
    id: migration.id,
    fromVersion: serializeSchemaVersion(migration.fromVersion),
    toVersion: serializeSchemaVersion(migration.toVersion),
    timestamp: migration.timestamp.toISOString(),
    operations: migration.operations,
    isBreaking: migration.isBreaking,
  };

  if (migration.description) {
    serialized.description = migration.description;
  }

  return serialized;
}

/**
 * Parses a schema history from a JSON string.
 *
 * @param json - The JSON string to parse
 * @returns The parsed SchemaHistory
 * @throws Error if the JSON is invalid or missing required fields
 *
 * @example
 * ```typescript
 * const json = fs.readFileSync('schema-history.json', 'utf8');
 * const history = parseHistory(json);
 * ```
 */
export function parseHistory(json: string): SchemaHistory {
  const parsed = JSON.parse(json) as SerializedSchemaHistory;

  // Validate required fields
  if (typeof parsed.schemaName !== 'string') {
    throw new Error('Invalid schema history: missing or invalid schemaName');
  }

  if (!Array.isArray(parsed.entries)) {
    throw new Error('Invalid schema history: missing or invalid entries');
  }

  return {
    schemaName: parsed.schemaName,
    entries: parsed.entries.map((entry) => parseHistoryEntry(entry)),
  };
}

/**
 * Parse a single history entry from serialized format.
 */
function parseHistoryEntry(entry: SerializedHistoryEntry): SchemaHistoryEntry {
  return {
    version: parseSchemaVersion(entry.version),
    timestamp: new Date(entry.timestamp),
    checksum: entry.checksum,
    migration: entry.migration ? parseMigration(entry.migration) : null,
  };
}

/**
 * Parse a migration from serialized format.
 */
function parseMigration(serialized: SerializedMigration): Migration {
  return {
    id: serialized.id,
    fromVersion: parseSchemaVersion(serialized.fromVersion),
    toVersion: parseSchemaVersion(serialized.toVersion),
    timestamp: new Date(serialized.timestamp),
    description: serialized.description,
    operations: serialized.operations as Migration['operations'],
    isBreaking: serialized.isBreaking,
  };
}

// =============================================================================
// Checksum Functions
// =============================================================================

/**
 * Computes a SHA256 checksum for a schema.
 *
 * The checksum is computed from the canonical representation of the schema,
 * which includes:
 * - Schema name
 * - All field definitions (sorted by name for consistency)
 * - All relation definitions
 * - All directives
 *
 * The checksum ignores timestamps (createdAt, updatedAt) and version numbers
 * to ensure that only structural changes affect the checksum.
 *
 * @param schema - The IceType schema to compute a checksum for
 * @returns A checksum string in the format "sha256:<hex>"
 *
 * @example
 * ```typescript
 * const checksum = computeSchemaChecksum(schema);
 * console.log(checksum); // 'sha256:abc123...'
 * ```
 */
export function computeSchemaChecksum(schema: IceTypeSchema): string {
  // Create canonical representation
  const canonical = createCanonicalSchema(schema);

  // Compute SHA256 hash
  const hash = createHash('sha256');
  hash.update(JSON.stringify(canonical));

  return `sha256:${hash.digest('hex')}`;
}

/**
 * Creates a canonical representation of a schema for checksumming.
 *
 * This normalizes the schema structure to ensure consistent checksums:
 * - Fields are sorted alphabetically by name
 * - Relations are sorted alphabetically by name
 * - Timestamps and version numbers are excluded
 */
function createCanonicalSchema(
  schema: IceTypeSchema
): Record<string, unknown> {
  // Sort fields by name
  const sortedFields: Record<string, CanonicalField> = {};
  const fieldNames = Array.from(schema.fields.keys()).sort();
  for (const name of fieldNames) {
    const field = schema.fields.get(name)!;
    sortedFields[name] = createCanonicalField(field);
  }

  // Sort relations by name
  const sortedRelations: Record<string, CanonicalRelation> = {};
  const relationNames = Array.from(schema.relations.keys()).sort();
  for (const name of relationNames) {
    const relation = schema.relations.get(name)!;
    sortedRelations[name] = createCanonicalRelation(relation);
  }

  // Create canonical directives
  const canonicalDirectives = createCanonicalDirectives(schema.directives);

  return {
    name: schema.name,
    fields: sortedFields,
    relations: sortedRelations,
    directives: canonicalDirectives,
  };
}

/**
 * Canonical field representation for checksumming.
 */
interface CanonicalField {
  name: string;
  type: string;
  modifier: string;
  isArray: boolean;
  isOptional: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  defaultValue?: unknown;
  precision?: number;
  scale?: number;
  length?: number;
}

/**
 * Creates a canonical field representation.
 */
function createCanonicalField(field: FieldDefinition): CanonicalField {
  const canonical: CanonicalField = {
    name: field.name,
    type: field.type,
    modifier: field.modifier,
    isArray: field.isArray,
    isOptional: field.isOptional,
    isUnique: field.isUnique,
    isIndexed: field.isIndexed,
  };

  // Only include optional properties if they have values
  if (field.defaultValue !== undefined) {
    canonical.defaultValue = field.defaultValue;
  }
  if (field.precision !== undefined) {
    canonical.precision = field.precision;
  }
  if (field.scale !== undefined) {
    canonical.scale = field.scale;
  }
  if (field.length !== undefined) {
    canonical.length = field.length;
  }

  return canonical;
}

/**
 * Canonical relation representation for checksumming.
 */
interface CanonicalRelation {
  operator: string;
  targetType: string;
  inverse?: string;
  onDelete?: string;
}

/**
 * Creates a canonical relation representation.
 */
function createCanonicalRelation(relation: RelationDefinition): CanonicalRelation {
  const canonical: CanonicalRelation = {
    operator: relation.operator,
    targetType: relation.targetType,
  };

  if (relation.inverse !== undefined) {
    canonical.inverse = relation.inverse;
  }
  if (relation.onDelete !== undefined) {
    canonical.onDelete = relation.onDelete;
  }

  return canonical;
}

/**
 * Creates a canonical directives representation.
 */
function createCanonicalDirectives(
  directives: SchemaDirectives
): Record<string, unknown> {
  const canonical: Record<string, unknown> = {};

  // Sort and include each directive type
  if (directives.partitionBy !== undefined) {
    canonical.partitionBy = [...directives.partitionBy].sort();
  }
  if (directives.index !== undefined) {
    canonical.index = directives.index.map((idx) => ({
      fields: [...idx.fields].sort(),
      unique: idx.unique,
      name: idx.name,
    }));
  }
  if (directives.fts !== undefined) {
    canonical.fts = [...directives.fts].sort();
  }
  if (directives.vector !== undefined) {
    canonical.vector = directives.vector.map((v) => ({
      field: v.field,
      dimensions: v.dimensions,
      metric: v.metric,
    }));
  }

  return canonical;
}
