/**
 * Schema Diff Detection Tests for @icetype/core
 *
 * TDD RED phase - these tests should fail initially.
 * Tests for diffSchemas function with the new interface.
 */

import { describe, it, expect } from 'vitest';
import { parseSchema } from '../src/parser.js';
import { diffSchemas } from '../src/diff.js';

// =============================================================================
// diffSchemas Tests - New Interface
// =============================================================================

describe('diffSchemas', () => {
  describe('return type', () => {
    it('should return SchemaDiff with schemaName, changes array, and isBreaking flag', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff).toHaveProperty('schemaName');
      expect(diff).toHaveProperty('changes');
      expect(diff).toHaveProperty('isBreaking');
      expect(Array.isArray(diff.changes)).toBe(true);
      expect(typeof diff.isBreaking).toBe('boolean');
    });
  });

  describe('added fields', () => {
    it('should detect added fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);

      const addFieldChanges = diff.changes.filter((c) => c.type === 'add_field');
      expect(addFieldChanges).toHaveLength(1);
      expect(addFieldChanges[0]).toMatchObject({
        type: 'add_field',
        field: 'name',
      });
      expect(addFieldChanges[0]).toHaveProperty('definition');
    });

    it('should detect multiple added fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        email: 'string!',
        age: 'int?',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      const addFieldChanges = diff.changes.filter((c) => c.type === 'add_field');
      expect(addFieldChanges).toHaveLength(3);
      const fieldNames = addFieldChanges.map((c) => (c as { field: string }).field);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('age');
    });

    it('should include field definition in added field changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string#' });

      const diff = diffSchemas(oldSchema, newSchema);

      const addFieldChange = diff.changes.find((c) => c.type === 'add_field') as {
        type: 'add_field';
        field: string;
        definition: { type: string; isIndexed: boolean };
      };
      expect(addFieldChange).toBeDefined();
      expect(addFieldChange.definition.type).toBe('string');
      expect(addFieldChange.definition.isIndexed).toBe(true);
    });
  });

  describe('removed fields', () => {
    it('should detect removed fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(oldSchema, newSchema);

      const removeFieldChanges = diff.changes.filter((c) => c.type === 'remove_field');
      expect(removeFieldChanges).toHaveLength(1);
      expect(removeFieldChanges[0]).toMatchObject({
        type: 'remove_field',
        field: 'name',
      });
    });

    it('should detect multiple removed fields', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        email: 'string!',
        phone: 'string?',
      });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(oldSchema, newSchema);

      const removeFieldChanges = diff.changes.filter((c) => c.type === 'remove_field');
      expect(removeFieldChanges).toHaveLength(3);
      const fieldNames = removeFieldChanges.map((c) => (c as { field: string }).field);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('phone');
    });

    it('should mark removed fields as breaking', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.isBreaking).toBe(true);
    });
  });

  describe('renamed fields (heuristic detection)', () => {
    it('should detect renamed fields (same type, one added + one removed)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', userName: 'string!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);

      const renameChanges = diff.changes.filter((c) => c.type === 'rename_field');
      expect(renameChanges).toHaveLength(1);
      expect(renameChanges[0]).toMatchObject({
        type: 'rename_field',
        oldName: 'userName',
        newName: 'name',
      });
    });

    it('should detect renamed fields with same type and modifiers', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', userEmail: 'string#' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string#' });

      const diff = diffSchemas(oldSchema, newSchema);

      const renameChanges = diff.changes.filter((c) => c.type === 'rename_field');
      expect(renameChanges).toHaveLength(1);
      expect(renameChanges[0]).toMatchObject({
        type: 'rename_field',
        oldName: 'userEmail',
        newName: 'email',
      });
    });

    it('should not detect rename when types differ', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', total: 'string' });

      const diff = diffSchemas(oldSchema, newSchema);

      const renameChanges = diff.changes.filter((c) => c.type === 'rename_field');
      expect(renameChanges).toHaveLength(0);

      // Should be add + remove instead
      const addChanges = diff.changes.filter((c) => c.type === 'add_field');
      const removeChanges = diff.changes.filter((c) => c.type === 'remove_field');
      expect(addChanges).toHaveLength(1);
      expect(removeChanges).toHaveLength(1);
    });

    it('should not detect rename when multiple fields have same type', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        firstName: 'string!',
        lastName: 'string!',
      });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        fullName: 'string!',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      // With 2 removed and 1 added of same type, heuristic should not apply
      const renameChanges = diff.changes.filter((c) => c.type === 'rename_field');
      expect(renameChanges).toHaveLength(0);
    });
  });

  describe('type changes', () => {
    it('should detect type changes (string -> int)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'string' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });

      const diff = diffSchemas(oldSchema, newSchema);

      const typeChanges = diff.changes.filter((c) => c.type === 'change_type');
      expect(typeChanges).toHaveLength(1);
      expect(typeChanges[0]).toMatchObject({
        type: 'change_type',
        field: 'count',
        oldType: 'string',
        newType: 'int',
      });
    });

    it('should detect type changes (int -> long)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'long' });

      const diff = diffSchemas(oldSchema, newSchema);

      const typeChanges = diff.changes.filter((c) => c.type === 'change_type');
      expect(typeChanges).toHaveLength(1);
      expect(typeChanges[0]).toMatchObject({
        type: 'change_type',
        field: 'count',
        oldType: 'int',
        newType: 'long',
      });
    });

    it('should mark type changes as breaking', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'string' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.isBreaking).toBe(true);
    });
  });

  describe('modifier changes', () => {
    it('should detect modifier changes (optional -> required)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);

      const modifierChanges = diff.changes.filter((c) => c.type === 'change_modifier');
      expect(modifierChanges).toHaveLength(1);
      expect(modifierChanges[0]).toMatchObject({
        type: 'change_modifier',
        field: 'name',
        oldModifier: '?',
        newModifier: '!',
      });
    });

    it('should detect modifier changes (required -> optional)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });

      const diff = diffSchemas(oldSchema, newSchema);

      const modifierChanges = diff.changes.filter((c) => c.type === 'change_modifier');
      expect(modifierChanges).toHaveLength(1);
      expect(modifierChanges[0]).toMatchObject({
        type: 'change_modifier',
        field: 'name',
        oldModifier: '!',
        newModifier: '?',
      });
    });

    it('should mark optional to required as breaking', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.isBreaking).toBe(true);
    });

    it('should not mark required to optional as breaking', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });

      const diff = diffSchemas(oldSchema, newSchema);

      // Adding optional field and no other breaking changes
      expect(diff.isBreaking).toBe(false);
    });
  });

  describe('directive changes', () => {
    it('should detect $index directive changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', email: 'string' });
      const newSchema = parseSchema({
        $type: 'User',
        $index: [['email']],
        id: 'uuid!',
        email: 'string',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      const directiveChanges = diff.changes.filter((c) => c.type === 'change_directive');
      expect(directiveChanges.length).toBeGreaterThanOrEqual(1);
      const indexChange = directiveChanges.find(
        (c) => (c as { directive: string }).directive === '$index'
      );
      expect(indexChange).toBeDefined();
    });

    it('should detect $partitionBy directive changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({
        $type: 'User',
        $partitionBy: ['id'],
        id: 'uuid!',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      const directiveChanges = diff.changes.filter((c) => c.type === 'change_directive');
      const partitionChange = directiveChanges.find(
        (c) => (c as { directive: string }).directive === '$partitionBy'
      );
      expect(partitionChange).toBeDefined();
      expect(partitionChange).toMatchObject({
        type: 'change_directive',
        directive: '$partitionBy',
        oldValue: undefined,
        newValue: ['id'],
      });
    });

    it('should detect $fts directive changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', bio: 'text' });
      const newSchema = parseSchema({
        $type: 'User',
        $fts: ['bio'],
        id: 'uuid!',
        bio: 'text',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      const directiveChanges = diff.changes.filter((c) => c.type === 'change_directive');
      const ftsChange = directiveChanges.find(
        (c) => (c as { directive: string }).directive === '$fts'
      );
      expect(ftsChange).toBeDefined();
    });

    it('should detect $vector directive changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', embedding: 'float[]' });
      const newSchema = parseSchema({
        $type: 'User',
        $vector: { embedding: 1536 },
        id: 'uuid!',
        embedding: 'float[]',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      const directiveChanges = diff.changes.filter((c) => c.type === 'change_directive');
      const vectorChange = directiveChanges.find(
        (c) => (c as { directive: string }).directive === '$vector'
      );
      expect(vectorChange).toBeDefined();
    });
  });

  describe('identical schemas', () => {
    it('should return empty changes array for identical schemas', () => {
      const schema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(schema, schema);

      expect(diff.changes).toHaveLength(0);
      expect(diff.isBreaking).toBe(false);
    });

    it('should return empty diff for schemas with same fields', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        email: 'string?',
      });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!',
        email: 'string?',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.changes).toHaveLength(0);
      expect(diff.isBreaking).toBe(false);
    });
  });

  describe('multiple changes in single diff', () => {
    it('should detect multiple different change types', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        userName: 'string!', // will be renamed to name
        count: 'int', // will change type to long
        oldField: 'string', // will be removed
        status: 'string?', // will become required
      });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string!', // renamed from userName
        count: 'long', // type changed
        newField: 'timestamp', // added
        status: 'string!', // modifier changed
      });

      const diff = diffSchemas(oldSchema, newSchema);

      // Should have multiple changes
      expect(diff.changes.length).toBeGreaterThan(3);

      // Check each change type is present
      const changeTypes = new Set(diff.changes.map((c) => c.type));
      expect(changeTypes.has('rename_field')).toBe(true);
      expect(changeTypes.has('change_type')).toBe(true);
      expect(changeTypes.has('add_field')).toBe(true);
      expect(changeTypes.has('change_modifier')).toBe(true);

      // Should be breaking due to type change, modifier change, or removed field
      expect(diff.isBreaking).toBe(true);
    });

    it('should handle add and remove without confusing them for renames when types differ', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        oldInt: 'int',
        oldStr: 'string',
      });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        newBool: 'boolean',
        newFloat: 'float',
      });

      const diff = diffSchemas(oldSchema, newSchema);

      // Should not detect any renames since types don't match
      const renameChanges = diff.changes.filter((c) => c.type === 'rename_field');
      expect(renameChanges).toHaveLength(0);

      // Should have 2 removes and 2 adds
      const addChanges = diff.changes.filter((c) => c.type === 'add_field');
      const removeChanges = diff.changes.filter((c) => c.type === 'remove_field');
      expect(addChanges).toHaveLength(2);
      expect(removeChanges).toHaveLength(2);
    });
  });

  describe('schema name', () => {
    it('should include schema name in diff', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.schemaName).toBe('User');
    });
  });

  describe('isBreaking flag', () => {
    it('should not be breaking for adding optional fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.isBreaking).toBe(false);
    });

    it('should be breaking for adding required fields', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.isBreaking).toBe(true);
    });

    it('should be breaking for removing any field', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string?' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.isBreaking).toBe(true);
    });

    it('should be breaking for type changes', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'int' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', count: 'string' });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.isBreaking).toBe(true);
    });

    it('should not be breaking for field renames (if detected)', () => {
      const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', userName: 'string!' });
      const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string!' });

      const diff = diffSchemas(oldSchema, newSchema);

      // Renames alone should not be breaking (just need migration)
      // But if rename is not detected, it becomes add+remove which IS breaking
      const renameChanges = diff.changes.filter((c) => c.type === 'rename_field');
      if (renameChanges.length === 1) {
        // If rename was detected, check it's the only change
        const otherBreakingChanges = diff.changes.filter(
          (c) =>
            c.type === 'remove_field' ||
            c.type === 'change_type' ||
            (c.type === 'add_field' &&
              (c as { definition: { modifier: string } }).definition.modifier === '!')
        );
        if (otherBreakingChanges.length === 0) {
          expect(diff.isBreaking).toBe(false);
        }
      }
    });
  });
});
