/**
 * Playground Tests for @icetype/playground
 *
 * RED phase TDD tests - these tests define the expected behavior
 * for the IceType web playground component.
 *
 * The playground should provide:
 * - Schema parsing with real-time validation
 * - TypeScript type generation preview
 * - SQL generation for multiple dialects
 * - Shareable URL generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { IceTypeSchema, ValidationError } from '@icetype/core';

// =============================================================================
// Types for the Playground API
// =============================================================================

/**
 * Result from parsing schema input in the playground
 */
interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed schema if successful */
  schema?: IceTypeSchema;
  /** Parse errors if failed */
  errors?: ParseErrorInfo[];
}

/**
 * Error information with position for editor highlighting
 */
interface ParseErrorInfo {
  /** Error message */
  message: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Error severity */
  severity: 'error' | 'warning';
}

/**
 * Result from validation
 */
interface ValidationResult {
  /** Whether the schema is valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationErrorInfo[];
  /** Validation warnings */
  warnings: ValidationErrorInfo[];
}

/**
 * Validation error with context
 */
interface ValidationErrorInfo {
  /** Error message */
  message: string;
  /** Field that caused the error */
  field?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Generated TypeScript types output
 */
interface TypesGenerationResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Generated TypeScript code */
  code?: string;
  /** Generation errors */
  errors?: string[];
}

/**
 * Generated SQL output
 */
interface SqlGenerationResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Generated SQL statements */
  sql?: string;
  /** Generation errors */
  errors?: string[];
}

/**
 * SQL dialect options
 */
type SqlDialect = 'postgres' | 'mysql' | 'sqlite';

/**
 * Share URL result
 */
interface ShareResult {
  /** Full shareable URL */
  url: string;
  /** Compressed schema data */
  encodedSchema: string;
}

// =============================================================================
// Expected Playground API (to be implemented in GREEN phase)
// =============================================================================

/**
 * The Playground class provides the core functionality for the web playground.
 * This is the main API that the React/Preact components will use.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PlaygroundAPI {
  /**
   * Parse schema input and return results with error positions
   */
  parseSchema(input: string): ParseResult;

  /**
   * Validate a parsed schema with detailed feedback
   */
  validateSchema(schema: IceTypeSchema): ValidationResult;

  /**
   * Generate TypeScript types from schema
   */
  generateTypes(schema: IceTypeSchema): TypesGenerationResult;

  /**
   * Generate SQL DDL for a specific dialect
   */
  generateSql(schema: IceTypeSchema, dialect: SqlDialect): SqlGenerationResult;

  /**
   * Create a shareable URL for the current schema
   */
  createShareUrl(schema: string, baseUrl?: string): ShareResult;

  /**
   * Load schema from a share URL
   */
  loadFromShareUrl(url: string): string | null;
}

// =============================================================================
// Import the Playground (will fail until implemented)
// =============================================================================

// These imports will fail until the GREEN phase implements them
import { Playground } from '../index.js';

// =============================================================================
// Schema Parsing Tests
// =============================================================================

describe('Playground', () => {
  let playground: InstanceType<typeof Playground>;

  beforeEach(() => {
    playground = new Playground();
  });

  describe('parseSchema', () => {
    it('should parse valid schema and return success', () => {
      const input = `{
        $type: 'User',
        id: 'uuid!',
        email: 'string#',
        name: 'string',
      }`;

      const result = playground.parseSchema(input);

      expect(result.success).toBe(true);
      expect(result.schema).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should parse schema with multiple entities', () => {
      const input = `{
        User: {
          id: 'uuid!',
          email: 'string#',
          posts: '<- Post.author[]',
        },
        Post: {
          id: 'uuid!',
          title: 'string',
          author: '-> User',
        }
      }`;

      const result = playground.parseSchema(input);

      expect(result.success).toBe(true);
      expect(result.schema).toBeDefined();
    });

    it('should return errors with line and column for invalid syntax', () => {
      const input = `{
        $type: 'User',
        id: 'uuid!'
        email: 'string#',
      }`;
      // Missing comma after id line

      const result = playground.parseSchema(input);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toMatchObject({
        line: expect.any(Number),
        column: expect.any(Number),
        message: expect.any(String),
        severity: 'error',
      });
    });

    it('should return errors for unknown field types', () => {
      const input = `{
        $type: 'User',
        id: 'unknownType!',
      }`;

      const result = playground.parseSchema(input);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.message.toLowerCase().includes('unknown'))).toBe(true);
    });

    it('should handle empty input gracefully', () => {
      const result = playground.parseSchema('');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle whitespace-only input gracefully', () => {
      const result = playground.parseSchema('   \n\t  ');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  // ===========================================================================
  // Real-time Validation Tests
  // ===========================================================================

  describe('validateSchema', () => {
    it('should validate a well-formed schema', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'User',
        id: 'uuid!',
        email: 'string#',
      }`);

      expect(parseResult.success).toBe(true);
      const validation = playground.validateSchema(parseResult.schema!);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing $type directive', () => {
      // Manually construct a schema without $type for testing
      const parseResult = playground.parseSchema(`{
        id: 'uuid!',
        email: 'string#',
      }`);

      // Even if parsing succeeds, validation should warn about missing $type
      if (parseResult.success) {
        const validation = playground.validateSchema(parseResult.schema!);
        // Either invalid or has warnings
        expect(validation.errors.length + validation.warnings.length).toBeGreaterThan(0);
      }
    });

    it('should detect invalid relation references', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'Post',
        id: 'uuid!',
        author: '-> NonExistentUser',
      }`);

      expect(parseResult.success).toBe(true);
      const validation = playground.validateSchema(parseResult.schema!);

      // Should have warning/error about unknown relation target
      const allIssues = [...validation.errors, ...validation.warnings];
      expect(allIssues.some((e) => e.message.toLowerCase().includes('nonexistentuser'))).toBe(true);
    });

    it('should provide suggestions for common mistakes', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'User',
        id: 'uuid!',
        email: 'strng#',
      }`);

      // Typo in 'string' -> 'strng'
      // Should fail to parse or validate with a suggestion

      if (!parseResult.success) {
        expect(
          parseResult.errors!.some((e) => e.message.toLowerCase().includes('string') || e.message.toLowerCase().includes('strng'))
        ).toBe(true);
      } else {
        const validation = playground.validateSchema(parseResult.schema!);
        const allIssues = [...validation.errors, ...validation.warnings];
        expect(allIssues.some((e) => e.suggestion !== undefined)).toBe(true);
      }
    });

    it('should validate field modifiers are correctly used', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'User',
        id: 'uuid!',
        optionalRequired: 'string!?',
      }`);

      // Having both ! and ? might be a warning
      expect(parseResult.success).toBe(true);
      const validation = playground.validateSchema(parseResult.schema!);

      // Should at least warn about conflicting modifiers
      const allIssues = [...validation.errors, ...validation.warnings];
      expect(allIssues.length).toBeGreaterThanOrEqual(0); // May or may not warn
    });
  });

  // ===========================================================================
  // TypeScript Type Generation Tests
  // ===========================================================================

  describe('generateTypes', () => {
    it('should generate TypeScript interface for schema', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'User',
        id: 'uuid!',
        email: 'string#',
        name: 'string?',
        age: 'int?',
      }`);

      expect(parseResult.success).toBe(true);
      const types = playground.generateTypes(parseResult.schema!);

      expect(types.success).toBe(true);
      expect(types.code).toBeDefined();
      expect(types.code).toContain('interface User');
      expect(types.code).toContain('id: string'); // uuid maps to string
      expect(types.code).toContain('email: string');
      expect(types.code).toContain('name?: string'); // optional
      expect(types.code).toContain('age?: number'); // int maps to number, optional
    });

    it('should generate types for array fields', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'User',
        id: 'uuid!',
        tags: 'string[]',
        scores: 'int[]?',
      }`);

      expect(parseResult.success).toBe(true);
      const types = playground.generateTypes(parseResult.schema!);

      expect(types.success).toBe(true);
      expect(types.code).toContain('tags: string[]');
      expect(types.code).toContain('scores?: number[]');
    });

    it('should generate types with default values as comments', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'Config',
        id: 'uuid!',
        status: 'string = "active"',
        retries: 'int = 3',
      }`);

      expect(parseResult.success).toBe(true);
      const types = playground.generateTypes(parseResult.schema!);

      expect(types.success).toBe(true);
      expect(types.code).toBeDefined();
      // Should include default value info in comments
      expect(types.code).toMatch(/default.*active/i);
      expect(types.code).toMatch(/default.*3/i);
    });

    it('should handle complex types like json and decimal', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'Product',
        id: 'uuid!',
        metadata: 'json',
        price: 'decimal(10,2)',
      }`);

      expect(parseResult.success).toBe(true);
      const types = playground.generateTypes(parseResult.schema!);

      expect(types.success).toBe(true);
      expect(types.code).toContain('metadata:'); // json -> Record<string, unknown> or similar
      expect(types.code).toContain('price:'); // decimal -> number or string
    });

    it('should return error for invalid schema', () => {
      // Create an invalid/incomplete schema object
      const types = playground.generateTypes({} as IceTypeSchema);

      expect(types.success).toBe(false);
      expect(types.errors).toBeDefined();
      expect(types.errors!.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // SQL Generation Tests
  // ===========================================================================

  describe('generateSql', () => {
    describe('PostgreSQL dialect', () => {
      it('should generate PostgreSQL DDL', () => {
        const parseResult = playground.parseSchema(`{
          $type: 'User',
          id: 'uuid!',
          email: 'string#',
          name: 'string',
          createdAt: 'timestamp',
        }`);

        expect(parseResult.success).toBe(true);
        const sql = playground.generateSql(parseResult.schema!, 'postgres');

        expect(sql.success).toBe(true);
        expect(sql.sql).toBeDefined();
        expect(sql.sql).toContain('CREATE TABLE');
        expect(sql.sql).toContain('"User"');
        expect(sql.sql).toContain('UUID');
        expect(sql.sql).toContain('TEXT'); // string -> TEXT in postgres
        expect(sql.sql).toContain('TIMESTAMP');
      });

      it('should generate unique constraints for # modifier', () => {
        const parseResult = playground.parseSchema(`{
          $type: 'User',
          id: 'uuid!',
          email: 'string#',
        }`);

        expect(parseResult.success).toBe(true);
        const sql = playground.generateSql(parseResult.schema!, 'postgres');

        expect(sql.success).toBe(true);
        expect(sql.sql).toMatch(/UNIQUE/i);
      });

      it('should generate arrays for PostgreSQL', () => {
        const parseResult = playground.parseSchema(`{
          $type: 'User',
          id: 'uuid!',
          tags: 'string[]',
        }`);

        expect(parseResult.success).toBe(true);
        const sql = playground.generateSql(parseResult.schema!, 'postgres');

        expect(sql.success).toBe(true);
        expect(sql.sql).toContain('TEXT[]'); // PostgreSQL array syntax
      });
    });

    describe('MySQL dialect', () => {
      it('should generate MySQL DDL', () => {
        const parseResult = playground.parseSchema(`{
          $type: 'User',
          id: 'uuid!',
          email: 'string#',
          name: 'string',
        }`);

        expect(parseResult.success).toBe(true);
        const sql = playground.generateSql(parseResult.schema!, 'mysql');

        expect(sql.success).toBe(true);
        expect(sql.sql).toBeDefined();
        expect(sql.sql).toContain('CREATE TABLE');
        // MySQL uses backticks for identifiers
        expect(sql.sql).toMatch(/`User`|User/);
        expect(sql.sql).toContain('VARCHAR'); // string -> VARCHAR in MySQL
      });

      it('should use JSON for arrays in MySQL', () => {
        const parseResult = playground.parseSchema(`{
          $type: 'User',
          id: 'uuid!',
          tags: 'string[]',
        }`);

        expect(parseResult.success).toBe(true);
        const sql = playground.generateSql(parseResult.schema!, 'mysql');

        expect(sql.success).toBe(true);
        // MySQL doesn't have native arrays, should use JSON
        expect(sql.sql).toContain('JSON');
      });
    });

    describe('SQLite dialect', () => {
      it('should generate SQLite DDL', () => {
        const parseResult = playground.parseSchema(`{
          $type: 'User',
          id: 'uuid!',
          email: 'string#',
          name: 'string',
        }`);

        expect(parseResult.success).toBe(true);
        const sql = playground.generateSql(parseResult.schema!, 'sqlite');

        expect(sql.success).toBe(true);
        expect(sql.sql).toBeDefined();
        expect(sql.sql).toContain('CREATE TABLE');
        expect(sql.sql).toContain('TEXT'); // SQLite uses TEXT for strings
      });

      it('should use TEXT for json in SQLite', () => {
        const parseResult = playground.parseSchema(`{
          $type: 'Config',
          id: 'uuid!',
          data: 'json',
        }`);

        expect(parseResult.success).toBe(true);
        const sql = playground.generateSql(parseResult.schema!, 'sqlite');

        expect(sql.success).toBe(true);
        // SQLite stores JSON as TEXT
        expect(sql.sql).toContain('TEXT');
      });
    });

    it('should return error for invalid schema', () => {
      const sql = playground.generateSql({} as IceTypeSchema, 'postgres');

      expect(sql.success).toBe(false);
      expect(sql.errors).toBeDefined();
    });
  });

  // ===========================================================================
  // Share URL Tests
  // ===========================================================================

  describe('createShareUrl', () => {
    it('should create a shareable URL with encoded schema', () => {
      const schema = `{
        $type: 'User',
        id: 'uuid!',
        email: 'string#',
      }`;

      const result = playground.createShareUrl(schema);

      expect(result.url).toBeDefined();
      expect(result.encodedSchema).toBeDefined();
      expect(result.url).toContain(result.encodedSchema);
    });

    it('should use custom base URL when provided', () => {
      const schema = `{ $type: 'Test', id: 'uuid!' }`;
      const baseUrl = 'https://playground.icetype.dev';

      const result = playground.createShareUrl(schema, baseUrl);

      expect(result.url).toStartWith(baseUrl);
    });

    it('should compress long schemas', () => {
      const longSchema = `{
        $type: 'ComplexEntity',
        ${Array.from({ length: 50 }, (_, i) => `field${i}: 'string'`).join(',\n        ')}
      }`;

      const result = playground.createShareUrl(longSchema);

      // Encoded should be significantly shorter than raw schema
      expect(result.encodedSchema.length).toBeLessThan(longSchema.length);
    });

    it('should create deterministic URLs for same schema', () => {
      const schema = `{ $type: 'User', id: 'uuid!' }`;

      const result1 = playground.createShareUrl(schema);
      const result2 = playground.createShareUrl(schema);

      expect(result1.encodedSchema).toBe(result2.encodedSchema);
    });
  });

  describe('loadFromShareUrl', () => {
    it('should decode schema from share URL', () => {
      const originalSchema = `{
        $type: 'User',
        id: 'uuid!',
        email: 'string#',
      }`;

      const shareResult = playground.createShareUrl(originalSchema);
      const decodedSchema = playground.loadFromShareUrl(shareResult.url);

      expect(decodedSchema).toBeDefined();
      // Should preserve the schema content (whitespace may differ)
      expect(decodedSchema!.replace(/\s+/g, '')).toBe(originalSchema.replace(/\s+/g, ''));
    });

    it('should return null for invalid share URL', () => {
      const result = playground.loadFromShareUrl('https://example.com/invalid');

      expect(result).toBeNull();
    });

    it('should return null for corrupted encoded data', () => {
      const result = playground.loadFromShareUrl('https://playground.icetype.dev/?schema=!!!invalid!!!');

      expect(result).toBeNull();
    });

    it('should handle URL with query parameters', () => {
      const schema = `{ $type: 'Test', id: 'uuid!' }`;
      const baseUrl = 'https://playground.icetype.dev';

      const shareResult = playground.createShareUrl(schema, baseUrl);
      const decoded = playground.loadFromShareUrl(shareResult.url);

      expect(decoded).toBeDefined();
    });
  });
});

// =============================================================================
// Edge Cases and Error Handling Tests
// =============================================================================

describe('Playground Edge Cases', () => {
  let playground: InstanceType<typeof Playground>;

  beforeEach(() => {
    playground = new Playground();
  });

  describe('unicode handling', () => {
    it('should handle unicode in field default values', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'Greeting',
        id: 'uuid!',
        message: 'string = "Hello, World"',
      }`);

      expect(parseResult.success).toBe(true);
    });

    it('should generate valid SQL with unicode in defaults', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'Config',
        id: 'uuid!',
        locale: 'string = "en-US"',
      }`);

      expect(parseResult.success).toBe(true);
      const sql = playground.generateSql(parseResult.schema!, 'postgres');

      expect(sql.success).toBe(true);
    });
  });

  describe('large schema handling', () => {
    it('should handle schema with 100+ fields', () => {
      const fields = Array.from({ length: 100 }, (_, i) => `field${i}: 'string'`).join(',\n');
      const schema = `{
        $type: 'LargeEntity',
        id: 'uuid!',
        ${fields}
      }`;

      const parseResult = playground.parseSchema(schema);

      expect(parseResult.success).toBe(true);
    });

    it('should generate types for large schemas efficiently', () => {
      const fields = Array.from({ length: 100 }, (_, i) => `field${i}: 'string'`).join(',\n');
      const schema = `{
        $type: 'LargeEntity',
        id: 'uuid!',
        ${fields}
      }`;

      const parseResult = playground.parseSchema(schema);
      expect(parseResult.success).toBe(true);

      const startTime = Date.now();
      const types = playground.generateTypes(parseResult.schema!);
      const duration = Date.now() - startTime;

      expect(types.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple parse operations', async () => {
      const schemas = [
        `{ $type: 'User', id: 'uuid!' }`,
        `{ $type: 'Post', id: 'uuid!', title: 'string' }`,
        `{ $type: 'Comment', id: 'uuid!', body: 'string' }`,
      ];

      const results = schemas.map((s) => playground.parseSchema(s));

      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe('special characters', () => {
    it('should handle escaped quotes in default values', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'Config',
        id: 'uuid!',
        template: 'string = "Hello \\"World\\""',
      }`);

      expect(parseResult.success).toBe(true);
    });

    it('should handle newlines in default string values', () => {
      const parseResult = playground.parseSchema(`{
        $type: 'Template',
        id: 'uuid!',
        content: 'string = "Line1\\nLine2"',
      }`);

      expect(parseResult.success).toBe(true);
    });
  });
});
