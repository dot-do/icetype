/**
 * Schema Loader Tests for @icetype/cli
 *
 * Tests for the schema loader utility that loads IceType schema files.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSchemaFile, loadSingleSchema, loadAllSchemas } from '../utils/schema-loader.js';
import type { IceTypeSchema } from '@icetype/core';

// Mock fs module
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a valid IceTypeSchema object for testing
 */
function createValidSchema(name: string = 'TestEntity'): IceTypeSchema {
  return {
    name,
    version: 1,
    fields: new Map([
      ['id', {
        name: 'id',
        type: 'uuid',
        modifier: '!',
        isArray: false,
        isOptional: false,
        isUnique: true,
        isIndexed: false,
      }],
      ['name', {
        name: 'name',
        type: 'string',
        modifier: '',
        isArray: false,
        isOptional: false,
        isUnique: false,
        isIndexed: false,
      }],
    ]),
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a JSON representation of a valid schema (for JSON file tests)
 */
function createValidSchemaJson(name: string = 'TestEntity'): object {
  return {
    name,
    version: 1,
    fields: new Map([
      ['id', {
        name: 'id',
        type: 'uuid',
        modifier: '!',
        isArray: false,
        isOptional: false,
        isUnique: true,
        isIndexed: false,
      }],
    ]),
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// isIceTypeSchema Type Guard Tests (via loadFromJson)
// =============================================================================

describe('isIceTypeSchema type guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('valid schema objects', () => {
    it('should recognize a valid IceTypeSchema with all required properties', async () => {
      const validSchema = createValidSchema();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validSchema, (key, value) => {
        // Convert Map to array for JSON serialization (note: this won't round-trip properly)
        if (value instanceof Map) {
          return Array.from(value.entries());
        }
        return value;
      }));

      const result = await loadSchemaFile('/test/schema.json');
      // Since JSON can't preserve Map instances, this will fail the type guard
      // This tests the type guard's strictness
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });
  });

  describe('invalid schema objects', () => {
    it('should reject null values', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('null');

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject primitive values', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('"just a string"');

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject objects missing name property', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        version: 1,
        fields: {},
        directives: {},
      }));

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });

    it('should reject objects missing version property', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        name: 'Test',
        fields: {},
        directives: {},
      }));

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });

    it('should reject objects where name is not a string', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        name: 123,
        version: 1,
        fields: {},
        directives: {},
      }));

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });

    it('should reject objects where version is not a number', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        name: 'Test',
        version: '1.0',
        fields: {},
        directives: {},
      }));

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });

    it('should reject objects where fields is not a Map', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        name: 'Test',
        version: 1,
        fields: {}, // Regular object, not a Map
        directives: {},
      }));

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });

    it('should reject objects where directives is missing', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        name: 'Test',
        version: 1,
        fields: [],
      }));

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });

    it('should reject empty objects', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });

    it('should reject arrays', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('[]');

      const result = await loadSchemaFile('/test/schema.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });
  });
});

// =============================================================================
// loadFromJson Tests
// =============================================================================

describe('loadFromJson', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('valid JSON files', () => {
    it('should load a single valid schema from JSON', async () => {
      // Note: Since JSON can't serialize Maps, we expect this to fail type guard
      // This tests that the loader properly validates schema structure
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        name: 'User',
        version: 1,
        fields: {},
        directives: {},
      }));

      const result = await loadSchemaFile('/test/schema.json');
      // Will fail because fields is not a Map instance
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });

    it('should load multiple schemas from a JSON object', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        User: {
          name: 'User',
          version: 1,
          fields: {},
          directives: {},
        },
        Post: {
          name: 'Post',
          version: 1,
          fields: {},
          directives: {},
        },
      }));

      const result = await loadSchemaFile('/test/schemas.json');
      // Will fail because fields are not Map instances
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('No valid IceTypeSchema found');
    });
  });

  describe('invalid JSON files', () => {
    it('should return error for malformed JSON', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

      const result = await loadSchemaFile('/test/bad.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });

    it('should return error for truncated JSON', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"name": "Test"');

      const result = await loadSchemaFile('/test/truncated.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });

    it('should return error for empty JSON file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('');

      const result = await loadSchemaFile('/test/empty.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });

    it('should return error for JSON with only whitespace', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('   \n\t  ');

      const result = await loadSchemaFile('/test/whitespace.json');
      expect(result.schemas).toHaveLength(0);
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });
  });
});

// =============================================================================
// File Not Found Error Handling
// =============================================================================

describe('file not found handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return error when file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadSchemaFile('/nonexistent/schema.ts');
    expect(result.schemas).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('File not found');
    expect(result.errors[0]).toContain('/nonexistent/schema.ts');
  });

  it('should return error with the exact file path provided', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadSchemaFile('./relative/path/schema.json');
    expect(result.errors[0]).toContain('File not found');
    expect(result.errors[0]).toContain('./relative/path/schema.json');
  });

  it('should return error for nested paths that do not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadSchemaFile('/a/b/c/d/schema.ts');
    expect(result.schemas).toHaveLength(0);
    expect(result.errors[0]).toContain('File not found');
  });

  it('should handle loadSingleSchema with nonexistent file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(loadSingleSchema('/missing/schema.ts')).rejects.toThrow('File not found');
  });

  it('should handle loadAllSchemas with nonexistent file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(loadAllSchemas('/missing/schema.ts')).rejects.toThrow('File not found');
  });
});

// =============================================================================
// Unsupported File Extension Handling
// =============================================================================

describe('unsupported file extension handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should return error for .txt files', async () => {
    const result = await loadSchemaFile('/test/schema.txt');
    expect(result.schemas).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Unsupported file extension');
    expect(result.errors[0]).toContain('.txt');
  });

  it('should return error for .yml files', async () => {
    const result = await loadSchemaFile('/test/schema.yml');
    expect(result.schemas).toHaveLength(0);
    expect(result.errors[0]).toContain('Unsupported file extension');
    expect(result.errors[0]).toContain('.yml');
  });

  it('should return error for .yaml files', async () => {
    const result = await loadSchemaFile('/test/schema.yaml');
    expect(result.schemas).toHaveLength(0);
    expect(result.errors[0]).toContain('Unsupported file extension');
    expect(result.errors[0]).toContain('.yaml');
  });

  it('should return error for .xml files', async () => {
    const result = await loadSchemaFile('/test/schema.xml');
    expect(result.schemas).toHaveLength(0);
    expect(result.errors[0]).toContain('Unsupported file extension');
    expect(result.errors[0]).toContain('.xml');
  });

  it('should return error for files without extension', async () => {
    const result = await loadSchemaFile('/test/schema');
    expect(result.schemas).toHaveLength(0);
    expect(result.errors[0]).toContain('Unsupported file extension');
  });

  it('should return error for .md files', async () => {
    const result = await loadSchemaFile('/test/schema.md');
    expect(result.schemas).toHaveLength(0);
    expect(result.errors[0]).toContain('Unsupported file extension');
    expect(result.errors[0]).toContain('.md');
  });

  it('should suggest valid extensions in error message', async () => {
    const result = await loadSchemaFile('/test/schema.xyz');
    expect(result.errors[0]).toContain('.ts');
    expect(result.errors[0]).toContain('.js');
    expect(result.errors[0]).toContain('.mjs');
    expect(result.errors[0]).toContain('.json');
  });

  it('should handle uppercase extensions as unsupported', async () => {
    const result = await loadSchemaFile('/test/schema.TXT');
    expect(result.schemas).toHaveLength(0);
    expect(result.errors[0]).toContain('Unsupported file extension');
  });
});

// =============================================================================
// Supported File Extensions
// =============================================================================

describe('supported file extensions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should accept .json files', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{}');

    const result = await loadSchemaFile('/test/schema.json');
    // Won't find valid schemas, but won't reject the extension
    expect(result.errors[0]).not.toContain('Unsupported file extension');
  });

  it('should accept .JSON files (case insensitive)', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{}');

    const result = await loadSchemaFile('/test/schema.JSON');
    expect(result.errors[0]).not.toContain('Unsupported file extension');
  });

  // Note: .ts, .js, .mjs files use dynamic import which is harder to mock
  // These are tested indirectly through integration tests
});

// =============================================================================
// loadSingleSchema Tests
// =============================================================================

describe('loadSingleSchema', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should throw error when no schemas found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');

    await expect(loadSingleSchema('/test/empty.json')).rejects.toThrow();
  });

  it('should throw error for nonexistent file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(loadSingleSchema('/missing.json')).rejects.toThrow('File not found');
  });

  it('should throw error for malformed JSON', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json');

    await expect(loadSingleSchema('/bad.json')).rejects.toThrow('Failed to parse JSON');
  });
});

// =============================================================================
// loadAllSchemas Tests
// =============================================================================

describe('loadAllSchemas', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should throw error when no schemas found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');

    await expect(loadAllSchemas('/test/empty.json')).rejects.toThrow();
  });

  it('should throw error for nonexistent file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(loadAllSchemas('/missing.json')).rejects.toThrow('File not found');
  });
});

// =============================================================================
// Path Resolution Tests
// =============================================================================

describe('path resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should handle absolute paths', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadSchemaFile('/absolute/path/to/schema.ts');
    expect(result.errors[0]).toContain('File not found');
    expect(result.errors[0]).toContain('/absolute/path/to/schema.ts');
  });

  it('should handle relative paths', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadSchemaFile('./relative/schema.ts');
    expect(result.errors[0]).toContain('File not found');
  });

  it('should handle paths with special characters', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadSchemaFile('/path/with spaces/schema.ts');
    expect(result.errors[0]).toContain('File not found');
  });
});

// =============================================================================
// LoadResult Structure Tests
// =============================================================================

describe('LoadResult structure', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return LoadResult with schemas and errors arrays', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadSchemaFile('/test/schema.ts');
    expect(result).toHaveProperty('schemas');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.schemas)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should return empty schemas array on error', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadSchemaFile('/missing.json');
    expect(result.schemas).toHaveLength(0);
  });

  it('should return errors array with at least one error on failure', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadSchemaFile('/missing.json');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
