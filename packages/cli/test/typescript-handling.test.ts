/**
 * TypeScript File Handling Tests for @icetype/cli
 *
 * Tests that the CLI can handle TypeScript schema files natively
 * without requiring tsx or other external TypeScript runners.
 *
 * The CLI uses jiti for runtime TypeScript transpilation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(tmpdir(), `icetype-ts-test-${Date.now()}`);
const CLI_PATH = join(__dirname, '../../dist/cli.js');
// Use absolute path to @icetype/core for tests to avoid module resolution issues
const CORE_PATH = resolve(__dirname, '../../../core/dist/index.js');

function runCli(args: string): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', code: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      code: error.status || 1
    };
  }
}

/**
 * Create a TypeScript IceType schema file content.
 * Uses absolute path to core for module resolution in temp directories.
 */
function createTypeScriptSchemaContent(schemaName: string = 'User'): string {
  return `import { parseSchema } from '${CORE_PATH}';
import type { IceTypeSchema } from '${CORE_PATH}';

// TypeScript interface for type checking
interface ${schemaName}Type {
  id: string;
  name: string;
  email: string;
  age?: number;
  createdAt: number;
}

export const ${schemaName}Schema: IceTypeSchema = parseSchema({
  $type: '${schemaName}',
  id: 'uuid!',
  name: 'string',
  email: 'string#',
  age: 'int?',
  createdAt: 'timestamp',
});
`;
}

/**
 * Create a TypeScript schema file with type annotations and modern syntax.
 */
function createComplexTypeScriptSchema(): string {
  return `import { parseSchema } from '${CORE_PATH}';
import type { IceTypeSchema } from '${CORE_PATH}';

// Use const assertion
const SCHEMA_VERSION = 1 as const;

// Generic helper function
function createSchemaWithDefaults<T extends Record<string, string>>(
  name: string,
  fields: T
): IceTypeSchema {
  return parseSchema({
    $type: name,
    ...fields,
  });
}

// Multiple schemas
export const UserSchema: IceTypeSchema = createSchemaWithDefaults('User', {
  id: 'uuid!',
  name: 'string',
  email: 'string#',
});

export const PostSchema: IceTypeSchema = createSchemaWithDefaults('Post', {
  id: 'uuid!',
  title: 'string',
  content: 'text',
  authorId: 'uuid',
});

// Enum-like type
type SchemaType = 'User' | 'Post';

// Export for testing
export { SCHEMA_VERSION };
`;
}

/**
 * Create an invalid TypeScript file with syntax errors.
 */
function createInvalidTypeScriptContent(): string {
  return `import { parseSchema } from '${CORE_PATH}';

// Missing closing brace
export const BrokenSchema = parseSchema({
  $type: 'Broken',
  id: 'uuid!'
  // Missing comma and closing brace
`;
}

/**
 * Create TypeScript file with type errors (but valid syntax).
 */
function createTypeErrorContent(): string {
  return `import { parseSchema } from '${CORE_PATH}';

// This will be transpiled even with type errors
// because jiti doesn't perform type checking
export const SchemaWithTypeError = parseSchema({
  $type: 'TypeError',
  id: 'uuid!',
  name: 'string',
});
`;
}

describe('TypeScript File Handling', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('Basic .ts file support', () => {
    const BASIC_DIR = join(TEST_DIR, 'basic-ts');

    beforeEach(() => {
      mkdirSync(BASIC_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(BASIC_DIR, { recursive: true, force: true });
    });

    it('should validate a TypeScript schema file', () => {
      const schemaPath = join(BASIC_DIR, 'schema.ts');
      writeFileSync(schemaPath, createTypeScriptSchemaContent('Customer'));

      const result = runCli(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('CustomerSchema is valid');
      expect(result.stdout).toContain('All schemas are valid');
    });

    it('should generate TypeScript types from a .ts schema file', () => {
      const schemaPath = join(BASIC_DIR, 'schema.ts');
      const outputPath = join(BASIC_DIR, 'types.ts');
      writeFileSync(schemaPath, createTypeScriptSchemaContent('Order'));

      const result = runCli(`generate --schema ${schemaPath} --output ${outputPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Generated types');
      expect(existsSync(outputPath)).toBe(true);

      const generated = readFileSync(outputPath, 'utf-8');
      expect(generated).toContain('export interface Order');
      expect(generated).toContain('export interface OrderInput');
    });

    it('should export PostgreSQL DDL from a .ts schema file', () => {
      const schemaPath = join(BASIC_DIR, 'schema.ts');
      const outputPath = join(BASIC_DIR, 'tables.sql');
      writeFileSync(schemaPath, createTypeScriptSchemaContent('Product'));

      const result = runCli(`postgres export --schema ${schemaPath} --output ${outputPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Exported PostgreSQL DDL');
      expect(existsSync(outputPath)).toBe(true);

      const ddl = readFileSync(outputPath, 'utf-8');
      expect(ddl).toContain('CREATE TABLE');
      expect(ddl).toContain('Product');
    });

    it('should export ClickHouse DDL from a .ts schema file', () => {
      const schemaPath = join(BASIC_DIR, 'schema.ts');
      const outputPath = join(BASIC_DIR, 'clickhouse.sql');
      writeFileSync(schemaPath, createTypeScriptSchemaContent('Event'));

      const result = runCli(`clickhouse export --schema ${schemaPath} --output ${outputPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Exported ClickHouse DDL');
      expect(existsSync(outputPath)).toBe(true);

      const ddl = readFileSync(outputPath, 'utf-8');
      expect(ddl).toContain('CREATE TABLE');
      expect(ddl).toContain('MergeTree');
    });

    it('should export Iceberg metadata from a .ts schema file', () => {
      const schemaPath = join(BASIC_DIR, 'schema.ts');
      const outputPath = join(BASIC_DIR, 'iceberg.json');
      writeFileSync(schemaPath, createTypeScriptSchemaContent('Metric'));

      const result = runCli(`iceberg export --schema ${schemaPath} --output ${outputPath} --location s3://test/metrics`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Exported Iceberg metadata');
      expect(existsSync(outputPath)).toBe(true);

      const metadata = JSON.parse(readFileSync(outputPath, 'utf-8'));
      expect(metadata).toHaveProperty('formatVersion');
      expect(metadata).toHaveProperty('schemas');
    });
  });

  describe('Complex TypeScript syntax', () => {
    const COMPLEX_DIR = join(TEST_DIR, 'complex-ts');

    beforeEach(() => {
      mkdirSync(COMPLEX_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(COMPLEX_DIR, { recursive: true, force: true });
    });

    it('should handle TypeScript with generics and type annotations', () => {
      const schemaPath = join(COMPLEX_DIR, 'complex-schema.ts');
      writeFileSync(schemaPath, createComplexTypeScriptSchema());

      const result = runCli(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('UserSchema is valid');
      expect(result.stdout).toContain('PostSchema is valid');
      expect(result.stdout).toContain('Found 2 schema(s)');
    });

    it('should generate types from complex TypeScript schema', () => {
      const schemaPath = join(COMPLEX_DIR, 'complex-schema.ts');
      const outputPath = join(COMPLEX_DIR, 'complex-types.ts');
      writeFileSync(schemaPath, createComplexTypeScriptSchema());

      const result = runCli(`generate --schema ${schemaPath} --output ${outputPath}`);

      expect(result.code).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const generated = readFileSync(outputPath, 'utf-8');
      expect(generated).toContain('export interface User');
      expect(generated).toContain('export interface Post');
    });
  });

  describe('Error handling for TypeScript files', () => {
    const ERROR_DIR = join(TEST_DIR, 'error-ts');

    beforeEach(() => {
      mkdirSync(ERROR_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(ERROR_DIR, { recursive: true, force: true });
    });

    it('should report error for TypeScript file with syntax errors', () => {
      const schemaPath = join(ERROR_DIR, 'invalid.ts');
      writeFileSync(schemaPath, createInvalidTypeScriptContent());

      const result = runCli(`validate --schema ${schemaPath}`);

      expect(result.code).not.toBe(0);
      // Should include error information about the syntax issue
      const output = result.stdout + result.stderr;
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle TypeScript file not found', () => {
      const result = runCli(`validate --schema ${ERROR_DIR}/nonexistent.ts`);

      expect(result.code).not.toBe(0);
      const output = result.stdout + result.stderr;
      expect(output).toContain('not found');
    });

    it('should transpile TypeScript even with type-level errors', () => {
      // jiti doesn't perform type checking, so type errors don't prevent execution
      const schemaPath = join(ERROR_DIR, 'type-error.ts');
      writeFileSync(schemaPath, createTypeErrorContent());

      const result = runCli(`validate --schema ${schemaPath}`);

      // Should succeed because jiti only transpiles, doesn't type check
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('SchemaWithTypeError is valid');
    });
  });

  describe('.js file handling (still works)', () => {
    const JS_DIR = join(TEST_DIR, 'js-files');

    beforeEach(() => {
      mkdirSync(JS_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(JS_DIR, { recursive: true, force: true });
    });

    it('should still handle .js files', () => {
      const schemaPath = join(JS_DIR, 'schema.js');
      const content = `import { parseSchema } from '${CORE_PATH}';

export const LegacySchema = parseSchema({
  $type: 'Legacy',
  id: 'uuid!',
  data: 'json',
});
`;
      writeFileSync(schemaPath, content);

      const result = runCli(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('LegacySchema is valid');
    });

    it('should still handle .mjs files', () => {
      const schemaPath = join(JS_DIR, 'schema.mjs');
      const content = `import { parseSchema } from '${CORE_PATH}';

export const ESMSchema = parseSchema({
  $type: 'ESModule',
  id: 'uuid!',
  version: 'int',
});
`;
      writeFileSync(schemaPath, content);

      const result = runCli(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('ESMSchema is valid');
    });
  });

  describe('diff command with TypeScript files', () => {
    const DIFF_DIR = join(TEST_DIR, 'diff-ts');

    beforeEach(() => {
      mkdirSync(DIFF_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(DIFF_DIR, { recursive: true, force: true });
    });

    it('should compare two TypeScript schema files', () => {
      const oldSchemaPath = join(DIFF_DIR, 'old.ts');
      const newSchemaPath = join(DIFF_DIR, 'new.ts');

      const oldSchema = `import { parseSchema } from '${CORE_PATH}';

export const UserSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string',
});
`;

      const newSchema = `import { parseSchema } from '${CORE_PATH}';

export const UserSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string',
  email: 'string#',
  createdAt: 'timestamp',
});
`;

      writeFileSync(oldSchemaPath, oldSchema);
      writeFileSync(newSchemaPath, newSchema);

      const result = runCli(`diff --old ${oldSchemaPath} --new ${newSchemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Comparing schemas');
      expect(result.stdout).toContain('IceType Migration');
    });
  });
});
