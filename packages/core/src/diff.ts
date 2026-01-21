/**
 * Schema Diff Detection for IceType
 *
 * This module provides functionality to compare two IceType schemas
 * and detect differences including:
 * - Added fields
 * - Removed fields
 * - Renamed fields (heuristic: same type, one added + one removed)
 * - Type changes
 * - Modifier changes
 * - Directive changes
 *
 * @packageDocumentation
 */

import type { IceTypeSchema, FieldDefinition, SchemaDirectives } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a single change in a schema diff.
 */
export type SchemaChange =
  | { type: 'add_field'; field: string; definition: FieldDefinition }
  | { type: 'remove_field'; field: string }
  | { type: 'rename_field'; oldName: string; newName: string }
  | { type: 'change_type'; field: string; oldType: string; newType: string }
  | { type: 'change_modifier'; field: string; oldModifier: string; newModifier: string }
  | { type: 'change_directive'; directive: string; oldValue: unknown; newValue: unknown };

/**
 * Represents the difference between two schema versions.
 */
export interface SchemaDiff {
  /** Name of the schema being compared */
  schemaName: string;
  /** List of all changes detected */
  changes: SchemaChange[];
  /** Whether any of the changes are breaking */
  isBreaking: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the modifier character for a field definition.
 */
function getModifier(field: FieldDefinition): string {
  if (field.isOptional) return '?';
  if (field.modifier === '!') return '!';
  if (field.isUnique) return '#';
  return '';
}

/**
 * Check if two field definitions have the same type signature (type + modifiers).
 * Used for rename detection heuristic.
 */
function hasSameTypeSignature(a: FieldDefinition, b: FieldDefinition): boolean {
  return (
    a.type === b.type &&
    a.isArray === b.isArray &&
    a.isOptional === b.isOptional &&
    a.isUnique === b.isUnique &&
    a.isIndexed === b.isIndexed &&
    a.modifier === b.modifier
  );
}

/**
 * Detect directive changes between two schemas.
 */
function detectDirectiveChanges(
  oldDirectives: SchemaDirectives,
  newDirectives: SchemaDirectives
): SchemaChange[] {
  const changes: SchemaChange[] = [];

  // Check $partitionBy
  const oldPartition = oldDirectives.partitionBy;
  const newPartition = newDirectives.partitionBy;
  if (JSON.stringify(oldPartition) !== JSON.stringify(newPartition)) {
    changes.push({
      type: 'change_directive',
      directive: '$partitionBy',
      oldValue: oldPartition,
      newValue: newPartition,
    });
  }

  // Check $index
  const oldIndex = oldDirectives.index;
  const newIndex = newDirectives.index;
  if (JSON.stringify(oldIndex) !== JSON.stringify(newIndex)) {
    changes.push({
      type: 'change_directive',
      directive: '$index',
      oldValue: oldIndex,
      newValue: newIndex,
    });
  }

  // Check $fts
  const oldFts = oldDirectives.fts;
  const newFts = newDirectives.fts;
  if (JSON.stringify(oldFts) !== JSON.stringify(newFts)) {
    changes.push({
      type: 'change_directive',
      directive: '$fts',
      oldValue: oldFts,
      newValue: newFts,
    });
  }

  // Check $vector
  const oldVector = oldDirectives.vector;
  const newVector = newDirectives.vector;
  if (JSON.stringify(oldVector) !== JSON.stringify(newVector)) {
    changes.push({
      type: 'change_directive',
      directive: '$vector',
      oldValue: oldVector,
      newValue: newVector,
    });
  }

  return changes;
}

/**
 * Determine if a change is breaking.
 */
function isBreakingChange(change: SchemaChange): boolean {
  switch (change.type) {
    case 'remove_field':
      // Removing a field is always breaking
      return true;

    case 'add_field':
      // Adding a required field is breaking (existing data won't have it)
      return change.definition.modifier === '!' && !change.definition.isOptional;

    case 'change_type':
      // Type changes are always breaking
      return true;

    case 'change_modifier':
      // Changing from optional to required is breaking
      return change.oldModifier === '?' && change.newModifier === '!';

    case 'rename_field':
      // Field renames are not breaking (just need migration)
      return false;

    case 'change_directive':
      // Directive changes are generally not breaking
      return false;

    default:
      return false;
  }
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Compare two IceType schemas and return the differences.
 *
 * @param oldSchema - The original schema version
 * @param newSchema - The new schema version
 * @returns A SchemaDiff object describing all changes
 *
 * @example
 * ```typescript
 * const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
 * const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
 *
 * const diff = diffSchemas(oldSchema, newSchema);
 * console.log(diff.changes); // [{ type: 'add_field', field: 'name', definition: {...} }]
 * console.log(diff.isBreaking); // true (adding required field)
 * ```
 */
export function diffSchemas(oldSchema: IceTypeSchema, newSchema: IceTypeSchema): SchemaDiff {
  const changes: SchemaChange[] = [];

  const oldFields = oldSchema.fields;
  const newFields = newSchema.fields;

  // Track fields that exist in old but not in new (candidates for removal or rename)
  const removedCandidates: Map<string, FieldDefinition> = new Map();
  // Track fields that exist in new but not in old (candidates for addition or rename)
  const addedCandidates: Map<string, FieldDefinition> = new Map();

  // First pass: identify modified, removed candidates, and added candidates
  for (const [fieldName, oldField] of oldFields) {
    const newField = newFields.get(fieldName);

    if (!newField) {
      // Field was removed (or possibly renamed)
      removedCandidates.set(fieldName, oldField);
    } else {
      // Field exists in both - check for modifications
      // Check type change
      if (oldField.type !== newField.type) {
        changes.push({
          type: 'change_type',
          field: fieldName,
          oldType: oldField.type,
          newType: newField.type,
        });
      }

      // Check modifier change
      const oldModifier = getModifier(oldField);
      const newModifier = getModifier(newField);
      if (oldModifier !== newModifier) {
        changes.push({
          type: 'change_modifier',
          field: fieldName,
          oldModifier,
          newModifier,
        });
      }
    }
  }

  // Find added candidates
  for (const [fieldName, newField] of newFields) {
    if (!oldFields.has(fieldName)) {
      addedCandidates.set(fieldName, newField);
    }
  }

  // Second pass: detect renames using heuristic
  // Heuristic: if exactly one field was removed and one was added with the same type signature,
  // treat it as a rename
  const usedRemoved = new Set<string>();
  const usedAdded = new Set<string>();

  for (const [removedName, removedField] of removedCandidates) {
    // Find matching added field with same type signature
    let matchingAdded: string | null = null;
    let matchCount = 0;

    for (const [addedName, addedField] of addedCandidates) {
      if (usedAdded.has(addedName)) continue;

      if (hasSameTypeSignature(removedField, addedField)) {
        matchingAdded = addedName;
        matchCount++;
      }
    }

    // Only treat as rename if there's exactly one match AND
    // there's only one removed field with this type signature AND
    // there's only one added field with this type signature
    if (matchCount === 1 && matchingAdded !== null) {
      // Count how many removed fields have this type signature
      let removedWithSameType = 0;
      for (const [_, rf] of removedCandidates) {
        if (hasSameTypeSignature(rf, removedField)) {
          removedWithSameType++;
        }
      }

      // Count how many added fields have this type signature
      let addedWithSameType = 0;
      for (const [_, af] of addedCandidates) {
        if (hasSameTypeSignature(af, removedField)) {
          addedWithSameType++;
        }
      }

      // Only rename if it's a 1:1 match
      if (removedWithSameType === 1 && addedWithSameType === 1) {
        changes.push({
          type: 'rename_field',
          oldName: removedName,
          newName: matchingAdded,
        });
        usedRemoved.add(removedName);
        usedAdded.add(matchingAdded);
      }
    }
  }

  // Add remaining removed fields as remove_field changes
  for (const [fieldName] of removedCandidates) {
    if (!usedRemoved.has(fieldName)) {
      changes.push({
        type: 'remove_field',
        field: fieldName,
      });
    }
  }

  // Add remaining added fields as add_field changes
  for (const [fieldName, fieldDef] of addedCandidates) {
    if (!usedAdded.has(fieldName)) {
      changes.push({
        type: 'add_field',
        field: fieldName,
        definition: fieldDef,
      });
    }
  }

  // Detect directive changes
  const directiveChanges = detectDirectiveChanges(oldSchema.directives, newSchema.directives);
  changes.push(...directiveChanges);

  // Determine if any changes are breaking
  const isBreaking = changes.some(isBreakingChange);

  return {
    schemaName: newSchema.name,
    changes,
    isBreaking,
  };
}
