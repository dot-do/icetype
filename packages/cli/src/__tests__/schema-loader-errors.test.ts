/**
 * Schema Loader Error Tests for @icetype/cli
 *
 * TDD RED phase tests for stack trace preservation in schema loading.
 * These tests verify that error messages from the schema loader provide
 * clear, actionable information pointing to user code.
 *
 * Expected behavior (currently failing):
 * - Syntax errors include file path and line number
 * - Import errors show the missing module name
 * - Type errors preserve TypeScript error messages
 * - Stack traces point to user code, not internal code
 *
 * Issue: icetype-eg2.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { loadSchemaFile, loadSingleSchema, clearSchemaLoaderCaches } from '../utils/schema-loader.js';
import { SchemaLoadError, isSchemaLoadError } from '@icetype/core';

// =============================================================================
// Test Fixtures Directory
// =============================================================================

const FIXTURES_DIR = join(process.cwd(), 'test-fixtures-schema-loader-errors');

/**
 * Create test fixtures directory and files
 */
function createTestFixtures(): void {
  // Clean up if exists
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true });
  }
  mkdirSync(FIXTURES_DIR, { recursive: true });
}

/**
 * Clean up test fixtures
 */
function cleanupTestFixtures(): void {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true });
  }
}

/**
 * Write a test schema file
 */
function writeSchemaFile(filename: string, content: string): string {
  const filepath = join(FIXTURES_DIR, filename);
  writeFileSync(filepath, content, 'utf-8');
  return filepath;
}

// =============================================================================
// Syntax Error Tests
// =============================================================================

describe('Schema Loader Error Handling', () => {
  beforeEach(() => {
    createTestFixtures();
    clearSchemaLoaderCaches();
  });

  afterEach(() => {
    cleanupTestFixtures();
  });

  describe('Syntax Errors', () => {
    it('should include file path in syntax error', async () => {
      // Create a schema file with syntax error (missing closing brace)
      const filepath = writeSchemaFile('syntax-error.ts', `
// Schema file with syntax error
export const UserSchema = {
  name: 'User',
  fields: {
    id: 'uuid!'
  // Missing closing brace
`);

      const result = await loadSchemaFile(filepath);

      // Expect error message to include the file path
      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // FAILING: The error should contain the absolute file path
      expect(errorMessage).toContain(filepath);
    });

    it('should show line number for parse errors', async () => {
      // Create a schema file with syntax error at a specific line
      const filepath = writeSchemaFile('line-error.ts', `
// Line 2
// Line 3
// Line 4
export const Schema = {
  name: 'Test',
  fields: {
    id: 'uuid!',
    email 'string!' // Line 9 - missing colon
  }
};
`);

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // FAILING: Error should include line:column or line number reference
      // The syntax error is on line 9
      expect(errorMessage).toMatch(/line\s*:?\s*9|:9:/i);
    });

    it('should include column number in syntax error when available', async () => {
      const filepath = writeSchemaFile('column-error.ts', `
export const X = {a b};
`);

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // FAILING: Should include column information for precise error location
      // The error is at column position where 'b' appears without separator
      expect(errorMessage).toMatch(/:\d+:\d+|col(umn)?\s*\d+/i);
    });
  });

  describe('Import Errors', () => {
    it('should show the missing module name for import errors', async () => {
      // Create a schema file that USES the import (so the error is thrown)
      const filepath = writeSchemaFile('missing-import.ts', `
import { NonExistentModule } from 'this-package-does-not-exist-xyz123';

// Actually use the import to ensure it's not tree-shaken
const value = NonExistentModule;

export const Schema = {
  name: 'Test',
  version: 1,
  fields: new Map(),
  directives: {}
};
`);

      const result = await loadSchemaFile(filepath);

      // FAILING: The current implementation doesn't properly catch and report import errors
      // The loader should return an error when the module can't be found
      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // Should clearly show which module is missing
      expect(errorMessage).toContain('this-package-does-not-exist-xyz123');
    });

    it('should show the missing relative module path', async () => {
      const filepath = writeSchemaFile('missing-relative-import.ts', `
import { helper } from './non-existent-helper';

// Use the import
const value = helper;

export const Schema = {
  name: 'Test',
  version: 1,
  fields: new Map(),
  directives: {}
};
`);

      const result = await loadSchemaFile(filepath);

      // FAILING: Import errors should be captured and returned
      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // Should show the relative path that failed to resolve
      expect(errorMessage).toContain('./non-existent-helper');
    });

    it('should suggest tsconfig paths for path alias import errors', async () => {
      const filepath = writeSchemaFile('path-alias-error.ts', `
import { SharedTypes } from '@myapp/shared-types';

// Use the import
const value = SharedTypes;

export const Schema = {
  name: 'Test',
  version: 1,
  fields: new Map(),
  directives: {}
};
`);

      const result = await loadSchemaFile(filepath);

      // FAILING: Path alias errors should be caught
      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // Should mention that this looks like a path alias and suggest checking tsconfig
      expect(errorMessage).toMatch(/tsconfig|path\s*alias|paths/i);
    });
  });

  describe('Type/Runtime Errors', () => {
    it('should preserve TypeScript error messages', async () => {
      // This creates a runtime error when the module is loaded
      const filepath = writeSchemaFile('runtime-error.ts', `
// This will throw when executed
const config = undefined;
const value = config.someProp; // TypeError: Cannot read property of undefined

export const Schema = {
  name: 'Test',
  version: 1,
  fields: new Map(),
  directives: {}
};
`);

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // FAILING: Should preserve the original error message
      expect(errorMessage).toMatch(/cannot read|undefined|someProp/i);
    });

    it('should show ReferenceError for undefined variables', async () => {
      const filepath = writeSchemaFile('reference-error.ts', `
// Reference an undefined variable
const result = undefinedVariable + 1;

export const Schema = {
  name: 'Test',
  version: 1,
  fields: new Map(),
  directives: {}
};
`);

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // FAILING: Should mention the undefined variable name
      expect(errorMessage).toContain('undefinedVariable');
    });
  });

  describe('Stack Trace Preservation', () => {
    it('should preserve original stack trace pointing to user code', async () => {
      const filepath = writeSchemaFile('stack-trace-test.ts', `
function innerFunction() {
  throw new Error('Error from user code');
}

function outerFunction() {
  innerFunction();
}

// This will be called when module loads
outerFunction();

export const Schema = {
  name: 'Test',
  version: 1,
  fields: new Map(),
  directives: {}
};
`);

      let caughtError: Error | null = null;

      try {
        await loadSingleSchema(filepath);
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).not.toBeNull();

      // FAILING: Stack trace should point to user code (the schema file)
      // Not just internal schema-loader.ts code
      const stackTrace = caughtError!.stack || '';
      expect(stackTrace).toContain('stack-trace-test.ts');
    });

    it('should include the function name where error occurred', async () => {
      const filepath = writeSchemaFile('function-name-test.ts', `
function parseUserData() {
  const data = null;
  return data.name; // Will throw
}

parseUserData();

export const Schema = {
  name: 'Test',
  version: 1,
  fields: new Map(),
  directives: {}
};
`);

      let caughtError: Error | null = null;

      try {
        await loadSingleSchema(filepath);
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).not.toBeNull();

      // FAILING: Stack trace should show the function name (parseUserData)
      // Currently, the stack trace only shows internal schema-loader code,
      // not the user's function names from the schema file
      //
      // For good DX, users need to see their function names in stack traces
      // to quickly identify where the error originated in their code
      const errorDetails = caughtError!.message + '\n' + (caughtError!.stack || '');

      // The error message should include the user function name for debugging
      // OR the cause chain should preserve the original stack trace
      const hasFunctionName = errorDetails.includes('parseUserData');
      const hasCauseWithFunctionName = caughtError!.cause instanceof Error &&
        (caughtError!.cause.stack || '').includes('parseUserData');

      expect(hasFunctionName || hasCauseWithFunctionName).toBe(true);
    });

    it('should not obscure user code location with internal frames', async () => {
      const filepath = writeSchemaFile('user-code-location.ts', `
// Line 2
// Line 3
// Line 4
// Line 5
const problematicCall = () => {
  throw new Error('User error on line 7');
};
// Line 9
problematicCall(); // Line 10

export const Schema = {
  name: 'Test',
  version: 1,
  fields: new Map(),
  directives: {}
};
`);

      let caughtError: Error | null = null;

      try {
        await loadSingleSchema(filepath);
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).not.toBeNull();

      const stackTrace = caughtError!.stack || '';

      // FAILING: The first user-code line in the stack should be from the schema file
      // The stack trace should start with or prominently feature the schema file location
      const lines = stackTrace.split('\n');
      const userCodeLine = lines.find(line =>
        line.includes('user-code-location.ts') && line.includes(':')
      );

      expect(userCodeLine).toBeDefined();

      // The line number in the stack should be near where the error occurred (line 7 or 10)
      const lineMatch = userCodeLine?.match(/:(\d+):/);
      if (lineMatch) {
        const lineNumber = parseInt(lineMatch[1], 10);
        expect(lineNumber).toBeLessThanOrEqual(15); // Should be in our user code range
      }
    });

    it('should include original error cause with full stack trace', async () => {
      const filepath = writeSchemaFile('cause-stack-test.ts', `
function deepFunction() {
  throw new Error('Deep error in user code');
}

function middleFunction() {
  deepFunction();
}

function topFunction() {
  middleFunction();
}

topFunction();

export const Schema = {};
`);

      let caughtError: Error | null = null;

      try {
        await loadSingleSchema(filepath);
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).not.toBeNull();

      // FAILING: The error.cause should contain the original error with full stack
      // This allows tools and debuggers to see the full call stack in user code
      const cause = caughtError!.cause;

      expect(cause).toBeInstanceOf(Error);
      if (cause instanceof Error) {
        const causeStack = cause.stack || '';
        // The cause stack should show the function call chain
        expect(causeStack).toContain('deepFunction');
        expect(causeStack).toContain('middleFunction');
        expect(causeStack).toContain('topFunction');
      }
    });
  });

  describe('SchemaLoadError Properties', () => {
    it('should throw SchemaLoadError with filePath property', async () => {
      const filepath = writeSchemaFile('schema-load-error-test.ts', `
throw new Error('Intentional error');
export const Schema = {};
`);

      let caughtError: unknown = null;

      try {
        await loadSingleSchema(filepath);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).not.toBeNull();

      // FAILING: Should throw SchemaLoadError with filePath property set
      expect(isSchemaLoadError(caughtError)).toBe(true);
      if (isSchemaLoadError(caughtError)) {
        expect(caughtError.filePath).toBe(filepath);
      }
    });

    it('should preserve cause chain for nested errors', async () => {
      const filepath = writeSchemaFile('cause-chain-test.ts', `
function level3() {
  const err = new Error('Root cause error');
  throw err;
}

function level2() {
  try {
    level3();
  } catch (e) {
    throw new Error('Level 2 wrapper', { cause: e });
  }
}

function level1() {
  try {
    level2();
  } catch (e) {
    throw new Error('Level 1 wrapper', { cause: e });
  }
}

level1();

export const Schema = {};
`);

      let caughtError: unknown = null;

      try {
        await loadSingleSchema(filepath);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).not.toBeNull();

      // FAILING: The error cause chain should be preserved
      // We should be able to traverse the cause chain to find the root error
      const errorMessage = caughtError instanceof Error
        ? caughtError.message + (caughtError.stack || '')
        : String(caughtError);

      // At minimum, we should see evidence of the error chain
      expect(errorMessage).toMatch(/root cause|level|wrapper/i);
    });
  });

  describe('Error Message Formatting', () => {
    it('should format error with file:line:column for editor navigation', async () => {
      const filepath = writeSchemaFile('editor-format-test.ts', `
const x = {
  a: 1,
  b 2  // Missing colon - syntax error
};
export const Schema = {};
`);

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // FAILING: Should include file:line:column format that editors can parse
      // Format like: /path/to/file.ts:4:5 for clicking in VS Code, etc.
      const fileLineColumnPattern = new RegExp(
        filepath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\d+:\\d+'
      );
      expect(errorMessage).toMatch(fileLineColumnPattern);
    });

    it('should provide helpful context for JSON parse errors', async () => {
      const filepath = join(FIXTURES_DIR, 'invalid.json');
      writeFileSync(filepath, '{ "name": "Test", invalid json }', 'utf-8');

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // Should indicate it's a JSON parse error
      expect(errorMessage).toMatch(/json|parse|syntax/i);
      expect(errorMessage).toContain(filepath);
    });
  });

  describe('Error Type Preservation', () => {
    it('should preserve TypeError information in error message', async () => {
      const filepath = writeSchemaFile('type-error-test.ts', `
const obj: any = null;
const value = obj.nonExistentProperty.deeper;

export const Schema = {};
`);

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // FAILING: Should indicate this is a TypeError for better debugging
      // Users should know what type of error occurred
      expect(errorMessage).toMatch(/TypeError|cannot read|null|undefined/i);
    });

    it('should preserve RangeError information', async () => {
      const filepath = writeSchemaFile('range-error-test.ts', `
const arr = new Array(-1);

export const Schema = {};
`);

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // Should indicate this is a RangeError
      expect(errorMessage).toMatch(/RangeError|invalid array length|range/i);
    });
  });

  describe('Verbose Error Context', () => {
    it('should include suggestions for common errors', async () => {
      const filepath = writeSchemaFile('common-error-suggestions.ts', `
import { Something } from '@project/missing';

export const Schema = Something;
`);

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // FAILING: Should provide helpful suggestions
      // When a path alias fails, suggest checking tsconfig.json paths
      expect(errorMessage).toMatch(/suggestion|tsconfig|install|path/i);
    });

    it('should show the exact import that failed when multiple imports exist', async () => {
      // Create a helper file that exists
      writeSchemaFile('existing-helper.ts', `
export const helper = { value: 42 };
`);

      const filepath = writeSchemaFile('multi-import-test.ts', `
import { helper } from './existing-helper';
import { missing } from './missing-module';

const combined = { ...helper, ...missing };

export const Schema = combined;
`);

      const result = await loadSchemaFile(filepath);

      expect(result.errors.length).toBeGreaterThan(0);
      const errorMessage = result.errors.join('\n');

      // FAILING: Should specifically show which import failed
      expect(errorMessage).toContain('./missing-module');
    });
  });
});
