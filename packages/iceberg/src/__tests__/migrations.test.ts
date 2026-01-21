/**
 * Tests for Iceberg schema evolution/migrations from IceType schema diffs
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema, diffSchemas } from '@icetype/core';
import type { SchemaDiff } from '@icetype/core';
import {
  IcebergMigrationGenerator,
  createIcebergMigrationGenerator,
  generateIcebergSchemaUpdate,
} from '../migrations.js';
import type {
  IcebergSchemaUpdate,
  IcebergAddColumn,
  IcebergDropColumn,
  IcebergRenameColumn,
  IcebergUpdateType,
  IcebergMakeOptional,
  IcebergMakeRequired,
} from '../migrations.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a simple schema for testing
 */
function createSimpleSchema() {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    name: 'string',
  });
}

/**
 * Create a schema with added field
 */
function createSchemaWithAddedField() {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    name: 'string',
    age: 'int?',
  });
}

/**
 * Create a schema with removed field
 */
function createSchemaWithRemovedField() {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
  });
}

/**
 * Create a schema with renamed field
 */
function createSchemaWithRenamedField() {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    fullName: 'string',
  });
}

/**
 * Create a schema with changed type
 */
function createSchemaWithChangedType() {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    name: 'text',
  });
}

/**
 * Create a schema with changed modifier (optional to required)
 */
function createSchemaWithOptionalField() {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    name: 'string?',
  });
}

/**
 * Create a schema with changed modifier (required to optional)
 */
function createSchemaWithRequiredField() {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    name: 'string!',
  });
}

// =============================================================================
// IcebergMigrationGenerator Class Tests
// =============================================================================

describe('IcebergMigrationGenerator', () => {
  let generator: IcebergMigrationGenerator;

  beforeEach(() => {
    generator = new IcebergMigrationGenerator();
  });

  describe('generateSchemaUpdate()', () => {
    it('should return empty operations when schemas are identical', () => {
      const oldSchema = createSimpleSchema();
      const newSchema = createSimpleSchema();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      expect(update.operations).toEqual([]);
    });

    it('should generate add-column operation for added field', () => {
      const oldSchema = createSimpleSchema();
      const newSchema = createSchemaWithAddedField();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      expect(update.operations.length).toBe(1);
      expect(update.operations[0]!.op).toBe('add-column');

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.name).toBe('age');
      expect(addOp.type.type).toBe('int');
      expect(addOp.required).toBe(false);
    });

    it('should generate drop-column operation for removed field', () => {
      const oldSchema = createSimpleSchema();
      const newSchema = createSchemaWithRemovedField();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      expect(update.operations.length).toBe(1);
      expect(update.operations[0]!.op).toBe('drop-column');

      const dropOp = update.operations[0] as IcebergDropColumn;
      expect(dropOp.name).toBe('name');
    });

    it('should generate rename-column operation for renamed field', () => {
      const oldSchema = createSimpleSchema();
      const newSchema = createSchemaWithRenamedField();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      expect(update.operations.length).toBe(1);
      expect(update.operations[0]!.op).toBe('rename-column');

      const renameOp = update.operations[0] as IcebergRenameColumn;
      expect(renameOp.oldName).toBe('name');
      expect(renameOp.newName).toBe('fullName');
    });

    it('should generate update-type operation for type change', () => {
      const oldSchema = createSimpleSchema();
      const newSchema = createSchemaWithChangedType();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      expect(update.operations.length).toBe(1);
      expect(update.operations[0]!.op).toBe('update-type');

      const updateOp = update.operations[0] as IcebergUpdateType;
      expect(updateOp.name).toBe('name');
      expect(updateOp.newType.type).toBe('string'); // text maps to string in Iceberg
    });

    it('should generate make-optional operation when field becomes optional', () => {
      const oldSchema = createSchemaWithRequiredField();
      const newSchema = createSchemaWithOptionalField();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      expect(update.operations.length).toBe(1);
      expect(update.operations[0]!.op).toBe('make-optional');

      const optionalOp = update.operations[0] as IcebergMakeOptional;
      expect(optionalOp.name).toBe('name');
    });

    it('should generate make-required operation when field becomes required', () => {
      const oldSchema = createSchemaWithOptionalField();
      const newSchema = createSchemaWithRequiredField();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      expect(update.operations.length).toBe(1);
      expect(update.operations[0]!.op).toBe('make-required');

      const requiredOp = update.operations[0] as IcebergMakeRequired;
      expect(requiredOp.name).toBe('name');
    });
  });

  describe('Type mapping', () => {
    it('should map IceType string to Iceberg string', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', name: 'string?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('string');
    });

    it('should map IceType int to Iceberg int', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', age: 'int?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('int');
    });

    it('should map IceType long to Iceberg long', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', count: 'long?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('long');
    });

    it('should map IceType double to Iceberg double', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', price: 'double?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('double');
    });

    it('should map IceType boolean to Iceberg boolean', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', active: 'boolean?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('boolean');
    });

    it('should map IceType timestamp to Iceberg timestamp', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', createdAt: 'timestamp?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('timestamp');
    });

    it('should map IceType date to Iceberg date', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', birthDate: 'date?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('date');
    });

    it('should map IceType uuid to Iceberg uuid', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', refId: 'uuid?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('uuid');
    });

    it('should map IceType binary to Iceberg binary', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', data: 'binary?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('binary');
    });

    it('should map IceType json to Iceberg string', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', metadata: 'json?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('string');
    });

    it('should map IceType array to Iceberg list', () => {
      const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
      const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', tags: 'string[]?' });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      const addOp = update.operations[0] as IcebergAddColumn;
      expect(addOp.type.type).toBe('list');
      expect(addOp.type.elementType?.type).toBe('string');
    });
  });

  describe('Multiple operations', () => {
    it('should generate multiple operations for complex diffs', () => {
      const oldSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        email: 'string#',
        name: 'string',
        oldField: 'string?',
      });
      const newSchema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        email: 'string#',
        fullName: 'string',
        age: 'int?',
      });
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);

      // Should have: rename name->fullName, drop oldField, add age
      expect(update.operations.length).toBeGreaterThan(1);

      const ops = update.operations.map(op => op.op);
      expect(ops).toContain('rename-column');
      expect(ops).toContain('drop-column');
      expect(ops).toContain('add-column');
    });
  });

  describe('serializeUpdate()', () => {
    it('should produce valid JSON', () => {
      const oldSchema = createSimpleSchema();
      const newSchema = createSchemaWithAddedField();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);
      const json = generator.serializeUpdate(update);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should produce pretty-printed JSON', () => {
      const oldSchema = createSimpleSchema();
      const newSchema = createSchemaWithAddedField();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);
      const json = generator.serializeUpdate(update);

      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('should deserialize back to equivalent update', () => {
      const oldSchema = createSimpleSchema();
      const newSchema = createSchemaWithAddedField();
      const diff = diffSchemas(oldSchema, newSchema);

      const update = generator.generateSchemaUpdate(diff);
      const json = generator.serializeUpdate(update);
      const parsed = JSON.parse(json) as IcebergSchemaUpdate;

      expect(parsed.operations.length).toBe(update.operations.length);
      expect(parsed.operations[0]?.op).toBe(update.operations[0]?.op);
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createIcebergMigrationGenerator()', () => {
  it('should create a new generator instance', () => {
    const generator = createIcebergMigrationGenerator();
    expect(generator).toBeInstanceOf(IcebergMigrationGenerator);
  });
});

describe('generateIcebergSchemaUpdate()', () => {
  it('should generate schema update from diff', () => {
    const oldSchema = createSimpleSchema();
    const newSchema = createSchemaWithAddedField();
    const diff = diffSchemas(oldSchema, newSchema);

    const update = generateIcebergSchemaUpdate(diff);

    expect(update.operations.length).toBe(1);
    expect(update.operations[0]!.op).toBe('add-column');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge cases', () => {
  it('should handle empty diff', () => {
    const diff: SchemaDiff = {
      schemaName: 'Test',
      changes: [],
      isBreaking: false,
    };

    const generator = new IcebergMigrationGenerator();
    const update = generator.generateSchemaUpdate(diff);

    expect(update.operations).toEqual([]);
  });

  it('should ignore directive changes (not schema evolution)', () => {
    const oldSchema = parseSchema({
      $type: 'User',
      $partitionBy: ['tenantId'],
      id: 'uuid!',
      tenantId: 'string!',
    });
    const newSchema = parseSchema({
      $type: 'User',
      $partitionBy: ['tenantId', 'createdAt'],
      id: 'uuid!',
      tenantId: 'string!',
    });
    const diff = diffSchemas(oldSchema, newSchema);

    const generator = new IcebergMigrationGenerator();
    const update = generator.generateSchemaUpdate(diff);

    // Directive changes don't produce Iceberg schema operations
    expect(update.operations).toEqual([]);
  });

  it('should set doc field when provided in add-column', () => {
    const oldSchema = parseSchema({ $type: 'Test', id: 'uuid!' });
    const newSchema = parseSchema({ $type: 'Test', id: 'uuid!', description: 'text?' });
    const diff = diffSchemas(oldSchema, newSchema);

    const generator = new IcebergMigrationGenerator();
    const update = generator.generateSchemaUpdate(diff);

    const addOp = update.operations[0] as IcebergAddColumn;
    expect(addOp.doc).toBeDefined();
  });
});
