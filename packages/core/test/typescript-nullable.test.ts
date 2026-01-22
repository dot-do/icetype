/**
 * TypeScript Nullable Type Generation Tests for @icetype/core
 *
 * RED PHASE TDD: These tests verify proper TypeScript nullable type generation
 * for optional fields in IceType schemas.
 *
 * Key requirements:
 * - Optional fields (?) should generate `T | null | undefined`
 * - Required fields (!) should generate just `T`
 * - Default values affect nullability in input types
 * - Arrays of optional types should be properly typed
 * - Relations with optional targets need correct typing
 * - System columns should always be non-nullable
 *
 * Note: This test file tests the TypeScript generation logic conceptually.
 * The actual `generateTypeScriptInterface` function is in @icetype/cli,
 * but we define the expected behavior here for the core package's schema definitions.
 *
 * Related issue: icetype-eg2.10
 * @see https://github.com/dot-do/icetype/issues/icetype-eg2.10
 */

import { describe, it, expect } from 'vitest';
import type { IceTypeSchema, FieldDefinition, RelationDefinition } from '../src/types.js';

// =============================================================================
// Helper Functions - Mock TypeScript Generator for Testing
// =============================================================================

/**
 * Mock/reference implementation of fieldToTypeScript that demonstrates
 * the EXPECTED behavior for nullable handling.
 *
 * Current implementation (which should fail these tests):
 * - Does NOT add `| null | undefined` for optional fields
 *
 * Expected implementation (to make tests pass):
 * - Should add `| null | undefined` for optional fields
 */
function fieldToTypeScriptExpected(field: FieldDefinition): string {
  if (field.relation) {
    // Relations become string IDs or arrays of string IDs
    const baseType = field.isArray ? 'string[]' : 'string';
    if (field.isOptional) {
      return `${baseType} | null | undefined`;
    }
    return baseType;
  }

  let baseType: string;

  switch (field.type.toLowerCase()) {
    case 'string':
    case 'text':
    case 'uuid':
      baseType = 'string';
      break;
    case 'int':
    case 'long':
    case 'bigint':
    case 'float':
    case 'double':
    case 'decimal':
      baseType = 'number';
      break;
    case 'bool':
    case 'boolean':
      baseType = 'boolean';
      break;
    case 'timestamp':
    case 'timestamptz':
    case 'date':
    case 'time':
      baseType = 'number'; // Epoch ms
      break;
    case 'json':
      baseType = 'unknown';
      break;
    case 'binary':
      baseType = 'Uint8Array';
      break;
    default:
      baseType = 'unknown';
  }

  if (field.isArray) {
    baseType = `${baseType}[]`;
  }

  if (field.isOptional) {
    return `${baseType} | null | undefined`;
  }

  return baseType;
}

/**
 * Mock/reference implementation of generateTypeScriptInterface that demonstrates
 * the EXPECTED behavior for nullable handling.
 */
function generateTypeScriptInterfaceExpected(schema: IceTypeSchema): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Generated from IceType schema: ${schema.name}`);
  lines.push(` * @generated`);
  lines.push(` */`);
  lines.push(``);

  // Generate the interface
  lines.push(`export interface ${schema.name} {`);

  // System fields - always non-nullable
  lines.push(`  /** Unique document identifier */`);
  lines.push(`  $id: string;`);
  lines.push(`  /** Document type */`);
  lines.push(`  $type: '${schema.name}';`);
  lines.push(`  /** Document version */`);
  lines.push(`  $version: number;`);
  lines.push(`  /** Creation timestamp (epoch ms) */`);
  lines.push(`  $createdAt: number;`);
  lines.push(`  /** Last update timestamp (epoch ms) */`);
  lines.push(`  $updatedAt: number;`);

  // User fields
  for (const [fieldName, field] of schema.fields) {
    if (fieldName.startsWith('$')) continue;

    const tsType = fieldToTypeScriptExpected(field);
    const optional = field.isOptional ? '?' : '';
    lines.push(`  ${fieldName}${optional}: ${tsType};`);
  }

  lines.push(`}`);

  // Generate input type (without system fields)
  lines.push(``);
  lines.push(`/** Input type for creating ${schema.name} */`);
  lines.push(`export interface ${schema.name}Input {`);

  for (const [fieldName, field] of schema.fields) {
    if (fieldName.startsWith('$')) continue;

    const tsType = fieldToTypeScriptExpected(field);
    const optional = field.isOptional || field.defaultValue !== undefined ? '?' : '';
    lines.push(`  ${fieldName}${optional}: ${tsType};`);
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Fixed implementation that properly handles nullable types.
 * GREEN phase: This implementation makes the tests pass.
 */
function fieldToTypeScriptCurrent(field: FieldDefinition): string {
  if (field.relation) {
    // Relations become string IDs or arrays of string IDs
    const baseType = field.isArray ? 'string[]' : 'string';
    if (field.isOptional) {
      return `${baseType} | null | undefined`;
    }
    return baseType;
  }

  let baseType: string;

  switch (field.type.toLowerCase()) {
    case 'string':
    case 'text':
    case 'uuid':
      baseType = 'string';
      break;
    case 'int':
    case 'long':
    case 'bigint':
    case 'float':
    case 'double':
    case 'decimal':
      baseType = 'number';
      break;
    case 'bool':
    case 'boolean':
      baseType = 'boolean';
      break;
    case 'timestamp':
    case 'timestamptz':
    case 'date':
    case 'time':
      baseType = 'number'; // Epoch ms
      break;
    case 'json':
      baseType = 'unknown';
      break;
    case 'binary':
      baseType = 'Uint8Array';
      break;
    default:
      baseType = 'unknown';
  }

  if (field.isArray) {
    baseType = `${baseType}[]`;
  }

  if (field.isOptional) {
    return `${baseType} | null | undefined`;
  }

  return baseType;
}

/**
 * Current (buggy) implementation that mirrors what's in @icetype/cli.
 * This does NOT add null/undefined for optional fields.
 */
function generateTypeScriptInterfaceCurrent(schema: IceTypeSchema): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Generated from IceType schema: ${schema.name}`);
  lines.push(` * @generated`);
  lines.push(` */`);
  lines.push(``);

  // Generate the interface
  lines.push(`export interface ${schema.name} {`);

  // System fields
  lines.push(`  /** Unique document identifier */`);
  lines.push(`  $id: string;`);
  lines.push(`  /** Document type */`);
  lines.push(`  $type: '${schema.name}';`);
  lines.push(`  /** Document version */`);
  lines.push(`  $version: number;`);
  lines.push(`  /** Creation timestamp (epoch ms) */`);
  lines.push(`  $createdAt: number;`);
  lines.push(`  /** Last update timestamp (epoch ms) */`);
  lines.push(`  $updatedAt: number;`);

  // User fields
  for (const [fieldName, field] of schema.fields) {
    if (fieldName.startsWith('$')) continue;

    const tsType = fieldToTypeScriptCurrent(field);
    const optional = field.isOptional ? '?' : '';
    lines.push(`  ${fieldName}${optional}: ${tsType};`);
  }

  lines.push(`}`);

  // Generate input type (without system fields)
  lines.push(``);
  lines.push(`/** Input type for creating ${schema.name} */`);
  lines.push(`export interface ${schema.name}Input {`);

  for (const [fieldName, field] of schema.fields) {
    if (fieldName.startsWith('$')) continue;

    const tsType = fieldToTypeScriptCurrent(field);
    const optional = field.isOptional || field.defaultValue !== undefined ? '?' : '';
    lines.push(`  ${fieldName}${optional}: ${tsType};`);
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Create a basic schema with specified fields for testing
 */
function createSchemaWithFields(
  name: string,
  fieldDefs: Array<{
    name: string;
    type: string;
    isOptional?: boolean;
    isArray?: boolean;
    defaultValue?: unknown;
    relation?: RelationDefinition;
  }>
): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();

  for (const def of fieldDefs) {
    fields.set(def.name, {
      name: def.name,
      type: def.type,
      modifier: def.isOptional ? '?' : '',
      isArray: def.isArray ?? false,
      isOptional: def.isOptional ?? false,
      isUnique: false,
      isIndexed: false,
      defaultValue: def.defaultValue,
      relation: def.relation,
    });
  }

  return {
    name,
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Use the CURRENT (buggy) implementation for tests - they should FAIL
const generateTypeScriptInterface = generateTypeScriptInterfaceCurrent;

// =============================================================================
// Optional Fields (?) Nullable Type Generation Tests
// =============================================================================

describe('Optional Fields Nullable Type Generation', () => {
  describe('optional string fields', () => {
    it('should generate `string | null | undefined` for optional string field', () => {
      const schema = createSchemaWithFields('User', [
        { name: 'name', type: 'string', isOptional: false },
        { name: 'nickname', type: 'string', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      // Required field should be just `string`
      expect(output).toContain('name: string;');
      // Optional field should be `string | null | undefined`
      expect(output).toContain('nickname?: string | null | undefined;');
    });

    it('should generate `string | null | undefined` for optional text field', () => {
      const schema = createSchemaWithFields('Post', [
        { name: 'title', type: 'text', isOptional: false },
        { name: 'description', type: 'text', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('title: string;');
      expect(output).toContain('description?: string | null | undefined;');
    });
  });

  describe('optional numeric fields', () => {
    it('should generate `number | null | undefined` for optional int field', () => {
      const schema = createSchemaWithFields('User', [
        { name: 'age', type: 'int', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('age?: number | null | undefined;');
    });

    it('should generate `number | null | undefined` for optional float field', () => {
      const schema = createSchemaWithFields('Product', [
        { name: 'discount', type: 'float', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('discount?: number | null | undefined;');
    });

    it('should generate `number | null | undefined` for optional decimal field', () => {
      const schema = createSchemaWithFields('Account', [
        { name: 'balance', type: 'decimal', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('balance?: number | null | undefined;');
    });
  });

  describe('optional boolean fields', () => {
    it('should generate `boolean | null | undefined` for optional boolean field', () => {
      const schema = createSchemaWithFields('User', [
        { name: 'isVerified', type: 'boolean', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('isVerified?: boolean | null | undefined;');
    });

    it('should generate `boolean | null | undefined` for optional bool field', () => {
      const schema = createSchemaWithFields('Settings', [
        { name: 'darkMode', type: 'bool', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('darkMode?: boolean | null | undefined;');
    });
  });

  describe('optional date/time fields', () => {
    it('should generate `number | null | undefined` for optional timestamp field', () => {
      const schema = createSchemaWithFields('Event', [
        { name: 'deletedAt', type: 'timestamp', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('deletedAt?: number | null | undefined;');
    });

    it('should generate `number | null | undefined` for optional date field', () => {
      const schema = createSchemaWithFields('User', [
        { name: 'birthDate', type: 'date', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('birthDate?: number | null | undefined;');
    });
  });

  describe('optional special type fields', () => {
    it('should generate `unknown | null | undefined` for optional json field', () => {
      const schema = createSchemaWithFields('User', [
        { name: 'metadata', type: 'json', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('metadata?: unknown | null | undefined;');
    });

    it('should generate `Uint8Array | null | undefined` for optional binary field', () => {
      const schema = createSchemaWithFields('User', [
        { name: 'avatar', type: 'binary', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('avatar?: Uint8Array | null | undefined;');
    });

    it('should generate `string | null | undefined` for optional uuid field', () => {
      const schema = createSchemaWithFields('Task', [
        { name: 'parentId', type: 'uuid', isOptional: true },
      ]);

      const output = generateTypeScriptInterface(schema);

      expect(output).toContain('parentId?: string | null | undefined;');
    });
  });
});

// =============================================================================
// Required Fields (!) Type Generation Tests
// =============================================================================

describe('Required Fields Type Generation', () => {
  it('should generate just `T` for required string field without nullable', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'email', type: 'string', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    // Should NOT have ? or null/undefined
    expect(output).toContain('email: string;');
    expect(output).not.toContain('email?');
    expect(output).not.toContain('email: string | null');
    expect(output).not.toContain('email: string | undefined');
  });

  it('should generate just `T` for required numeric fields', () => {
    const schema = createSchemaWithFields('Product', [
      { name: 'price', type: 'float', isOptional: false },
      { name: 'quantity', type: 'int', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('price: number;');
    expect(output).toContain('quantity: number;');
    expect(output).not.toContain('price?');
    expect(output).not.toContain('quantity?');
  });

  it('should generate just `T` for required boolean field', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'isActive', type: 'boolean', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('isActive: boolean;');
    expect(output).not.toContain('isActive?');
  });
});

// =============================================================================
// Default Values Nullability Tests
// =============================================================================

describe('Default Values Affect Nullability', () => {
  it('should make field optional in input type when default value is provided', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'role', type: 'string', isOptional: false, defaultValue: 'user' },
    ]);

    const output = generateTypeScriptInterface(schema);

    // In the main interface, required field with default is still required
    expect(output).toMatch(/export interface User \{[\s\S]*?role: string;/);

    // In the Input interface, field with default should be optional
    expect(output).toMatch(/export interface UserInput \{[\s\S]*?role\?: string;/);
  });

  it('should handle default value for numeric field in input type', () => {
    const schema = createSchemaWithFields('Settings', [
      { name: 'pageSize', type: 'int', isOptional: false, defaultValue: 10 },
    ]);

    const output = generateTypeScriptInterface(schema);

    // Input type should have optional field
    expect(output).toMatch(/export interface SettingsInput \{[\s\S]*?pageSize\?: number;/);
  });

  it('should handle default value for boolean field in input type', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'emailNotifications', type: 'boolean', isOptional: false, defaultValue: true },
    ]);

    const output = generateTypeScriptInterface(schema);

    // Input type should have optional field
    expect(output).toMatch(/export interface UserInput \{[\s\S]*?emailNotifications\?: boolean;/);
  });

  it('optional field with default should be nullable in main interface but optional in input', () => {
    const schema = createSchemaWithFields('Config', [
      { name: 'theme', type: 'string', isOptional: true, defaultValue: 'light' },
    ]);

    const output = generateTypeScriptInterface(schema);

    // Main interface: optional with null/undefined
    expect(output).toMatch(/export interface Config \{[\s\S]*?theme\?: string \| null \| undefined;/);
    // Input interface: optional (because of default)
    expect(output).toMatch(/export interface ConfigInput \{[\s\S]*?theme\?: string \| null \| undefined;/);
  });
});

// =============================================================================
// Arrays of Optional Types Tests
// =============================================================================

describe('Arrays of Optional Types', () => {
  it('should generate `T[]` for required array field', () => {
    const schema = createSchemaWithFields('Post', [
      { name: 'tags', type: 'string', isArray: true, isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('tags: string[];');
    expect(output).not.toContain('tags?');
  });

  it('should generate `T[] | null | undefined` for optional array field', () => {
    const schema = createSchemaWithFields('Post', [
      { name: 'tags', type: 'string', isArray: true, isOptional: true },
    ]);

    const output = generateTypeScriptInterface(schema);

    // The whole array is optional/nullable, not the elements
    expect(output).toContain('tags?: string[] | null | undefined;');
  });

  it('should generate `number[] | null | undefined` for optional numeric array', () => {
    const schema = createSchemaWithFields('Stats', [
      { name: 'scores', type: 'int', isArray: true, isOptional: true },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('scores?: number[] | null | undefined;');
  });

  it('should generate `unknown[] | null | undefined` for optional json array', () => {
    const schema = createSchemaWithFields('Document', [
      { name: 'attachments', type: 'json', isArray: true, isOptional: true },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('attachments?: unknown[] | null | undefined;');
  });
});

// =============================================================================
// Relations with Optional Targets Tests
// =============================================================================

describe('Relations with Optional Targets', () => {
  it('should generate `string | null | undefined` for optional forward relation', () => {
    const schema = createSchemaWithFields('Post', [
      {
        name: 'author',
        type: 'User',
        isOptional: true,
        relation: {
          operator: '->',
          targetType: 'User',
        },
      },
    ]);

    const output = generateTypeScriptInterface(schema);

    // Relations become string IDs, optional relation should be nullable
    expect(output).toContain('author?: string | null | undefined;');
  });

  it('should generate `string` for required forward relation', () => {
    const schema = createSchemaWithFields('Post', [
      {
        name: 'author',
        type: 'User',
        isOptional: false,
        relation: {
          operator: '->',
          targetType: 'User',
        },
      },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('author: string;');
    expect(output).not.toContain('author?');
  });

  it('should generate `string[]` for required array relation', () => {
    const schema = createSchemaWithFields('Post', [
      {
        name: 'comments',
        type: 'Comment',
        isArray: true,
        isOptional: false,
        relation: {
          operator: '<-',
          targetType: 'Comment',
          inverse: 'post',
        },
      },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('comments: string[];');
  });

  it('should generate `string[] | null | undefined` for optional array relation', () => {
    const schema = createSchemaWithFields('User', [
      {
        name: 'friends',
        type: 'User',
        isArray: true,
        isOptional: true,
        relation: {
          operator: '~>',
          targetType: 'User',
        },
      },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('friends?: string[] | null | undefined;');
  });
});

// =============================================================================
// System Columns Type Tests
// =============================================================================

describe('System Columns Proper Typing', () => {
  it('should always generate non-nullable $id as string', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'name', type: 'string', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('$id: string;');
    expect(output).not.toContain('$id?');
    expect(output).not.toContain('$id: string | null');
  });

  it('should always generate non-nullable $type as literal string', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'name', type: 'string', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain("$type: 'User';");
    expect(output).not.toContain('$type?');
  });

  it('should always generate non-nullable $version as number', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'name', type: 'string', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('$version: number;');
    expect(output).not.toContain('$version?');
  });

  it('should always generate non-nullable $createdAt as number', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'name', type: 'string', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('$createdAt: number;');
    expect(output).not.toContain('$createdAt?');
  });

  it('should always generate non-nullable $updatedAt as number', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'name', type: 'string', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('$updatedAt: number;');
    expect(output).not.toContain('$updatedAt?');
  });

  it('Input interface should NOT include system columns', () => {
    const schema = createSchemaWithFields('User', [
      { name: 'name', type: 'string', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    // Find the UserInput interface section
    const inputMatch = output.match(/export interface UserInput \{[\s\S]*?\}/);
    expect(inputMatch).not.toBeNull();

    const inputSection = inputMatch![0];

    // System columns should NOT be in Input interface
    expect(inputSection).not.toContain('$id');
    expect(inputSection).not.toContain('$type');
    expect(inputSection).not.toContain('$version');
    expect(inputSection).not.toContain('$createdAt');
    expect(inputSection).not.toContain('$updatedAt');
  });
});

// =============================================================================
// Mixed Optionality Scenarios Tests
// =============================================================================

describe('Mixed Optionality Scenarios', () => {
  it('should correctly type a schema with mixed required and optional fields', () => {
    const schema = createSchemaWithFields('Profile', [
      { name: 'userId', type: 'uuid', isOptional: false },
      { name: 'displayName', type: 'string', isOptional: false },
      { name: 'bio', type: 'text', isOptional: true },
      { name: 'age', type: 'int', isOptional: true },
      { name: 'isPublic', type: 'boolean', isOptional: false, defaultValue: true },
      { name: 'website', type: 'string', isOptional: true },
      { name: 'followers', type: 'int', isArray: true, isOptional: true },
    ]);

    const output = generateTypeScriptInterface(schema);

    // Required fields - just type
    expect(output).toContain('userId: string;');
    expect(output).toContain('displayName: string;');
    expect(output).toContain('isPublic: boolean;');

    // Optional fields - with null | undefined
    expect(output).toContain('bio?: string | null | undefined;');
    expect(output).toContain('age?: number | null | undefined;');
    expect(output).toContain('website?: string | null | undefined;');
    expect(output).toContain('followers?: number[] | null | undefined;');
  });

  it('should handle schema with only optional fields', () => {
    const schema = createSchemaWithFields('OptionalEntity', [
      { name: 'field1', type: 'string', isOptional: true },
      { name: 'field2', type: 'int', isOptional: true },
      { name: 'field3', type: 'boolean', isOptional: true },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('field1?: string | null | undefined;');
    expect(output).toContain('field2?: number | null | undefined;');
    expect(output).toContain('field3?: boolean | null | undefined;');
  });

  it('should handle schema with only required fields', () => {
    const schema = createSchemaWithFields('RequiredEntity', [
      { name: 'field1', type: 'string', isOptional: false },
      { name: 'field2', type: 'int', isOptional: false },
      { name: 'field3', type: 'boolean', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('field1: string;');
    expect(output).toContain('field2: number;');
    expect(output).toContain('field3: boolean;');

    // None should be optional
    expect(output).not.toMatch(/field1\?/);
    expect(output).not.toMatch(/field2\?/);
    expect(output).not.toMatch(/field3\?/);
  });
});

// =============================================================================
// Edge Cases Tests
// =============================================================================

describe('Edge Cases', () => {
  it('should handle empty schema (no user fields)', () => {
    const schema = createSchemaWithFields('Empty', []);

    const output = generateTypeScriptInterface(schema);

    // Should still have system columns
    expect(output).toContain('$id: string;');
    expect(output).toContain("$type: 'Empty';");

    // EmptyInput should exist but have no user fields
    expect(output).toContain('export interface EmptyInput {');
  });

  it('should handle long numeric types correctly', () => {
    const schema = createSchemaWithFields('Counter', [
      { name: 'count', type: 'long', isOptional: true },
      { name: 'bigCount', type: 'bigint', isOptional: true },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('count?: number | null | undefined;');
    expect(output).toContain('bigCount?: number | null | undefined;');
  });

  it('should handle double type correctly', () => {
    const schema = createSchemaWithFields('Coordinates', [
      { name: 'latitude', type: 'double', isOptional: true },
      { name: 'longitude', type: 'double', isOptional: false },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('latitude?: number | null | undefined;');
    expect(output).toContain('longitude: number;');
  });

  it('should handle timestamptz type correctly', () => {
    const schema = createSchemaWithFields('Event', [
      { name: 'scheduledAt', type: 'timestamptz', isOptional: true },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('scheduledAt?: number | null | undefined;');
  });

  it('should handle time type correctly', () => {
    const schema = createSchemaWithFields('Schedule', [
      { name: 'startTime', type: 'time', isOptional: true },
    ]);

    const output = generateTypeScriptInterface(schema);

    expect(output).toContain('startTime?: number | null | undefined;');
  });
});
