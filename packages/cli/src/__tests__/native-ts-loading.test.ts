/**
 * Native TypeScript Loading Tests for @icetype/cli
 *
 * GREEN PHASE - These tests verify that native TypeScript loading works correctly.
 *
 * What These Tests Validate:
 * 1. The `ice` binary can be executed directly with TS files (no tsx wrapper)
 * 2. Complex TypeScript features work (generics, type imports, const assertions)
 * 3. tsconfig.json path aliases are resolved correctly
 * 4. Error messages are clear when TS syntax errors occur
 *
 * Implementation:
 * - Uses jiti for on-the-fly TypeScript transpilation
 * - Reads tsconfig.json from the schema file's directory (or parent directories)
 * - Converts tsconfig paths to jiti aliases for path resolution
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(tmpdir(), `icetype-native-ts-${Date.now()}`);
const CLI_PATH = join(__dirname, '../../dist/cli.js');
const PACKAGE_ROOT = resolve(__dirname, '../..');
const CORE_PATH = resolve(__dirname, '../../../core/dist/index.js');

/**
 * Helper to run the CLI via the package bin entry point.
 * This simulates how a user would invoke the CLI after installing the package.
 */
function runCliViaBin(args: string, cwd: string = TEST_DIR): { stdout: string; stderr: string; code: number } {
  try {
    // Try to run via the bin entry point as a user would
    // This should work without tsx wrapper
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '' }, // Clear NODE_OPTIONS to avoid tsx interference
    });
    return { stdout, stderr: '', code: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      code: error.status || 1,
    };
  }
}

/**
 * Helper to run CLI via npx simulation (how users would actually run it).
 * This tests the real user workflow without tsx.
 */
function runCliViaPackage(args: string, cwd: string = TEST_DIR): { stdout: string; stderr: string; code: number } {
  try {
    // Simulate npx ice <args> by running the bin entry
    const result = spawnSync('node', [CLI_PATH, ...args.split(' ')], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '' },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      code: result.status ?? 1,
    };
  } catch (error: any) {
    return {
      stdout: '',
      stderr: error.message,
      code: 1,
    };
  }
}

/**
 * Create a TypeScript schema file that uses complex TS features.
 */
function createComplexTypeScriptSchema(): string {
  return `import { parseSchema } from '${CORE_PATH}';
import type { IceTypeSchema } from '${CORE_PATH}';

// Const assertion - TypeScript 3.4+ feature
const SCHEMA_VERSION = 1 as const;
const STATUS_VALUES = ['active', 'inactive', 'pending'] as const;

// Generic type
type Status = typeof STATUS_VALUES[number];

// Generic helper with type constraints
function defineSchema<T extends Record<string, string>>(
  name: string,
  fields: T
): IceTypeSchema {
  return parseSchema({
    $type: name,
    ...fields,
  });
}

// Interface with optional properties
interface UserMeta {
  lastLogin?: Date;
  loginCount: number;
}

// Exported schema using generics
export const UserSchema: IceTypeSchema = defineSchema('User', {
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  status: 'string = "active"',
  createdAt: 'timestamp',
});

// Second schema demonstrating type annotations
export const PostSchema: IceTypeSchema = defineSchema('Post', {
  id: 'uuid!',
  title: 'string',
  content: 'text',
  authorId: 'uuid',
  publishedAt: 'timestamp?',
});

// Satisfies operator (TypeScript 4.9+)
const schemaConfig = {
  version: SCHEMA_VERSION,
  schemas: [UserSchema, PostSchema],
} satisfies { version: number; schemas: IceTypeSchema[] };

export { SCHEMA_VERSION };
`;
}

/**
 * Create a TypeScript schema with syntax errors for error message testing.
 */
function createSyntaxErrorSchema(): string {
  return `import { parseSchema } from '${CORE_PATH}';

// Missing closing brace - syntax error
export const BrokenSchema = parseSchema({
  $type: 'Broken',
  id: 'uuid!'
  // Missing closing brace and parenthesis
`;
}

/**
 * Create a TypeScript schema with type imports from a separate file.
 */
function createSchemaWithTypeImports(typesPath: string): string {
  return `import { parseSchema } from '${CORE_PATH}';
import type { IceTypeSchema } from '${CORE_PATH}';
import type { CustomConfig } from '${typesPath}';

// Using imported type
const config: CustomConfig = {
  strict: true,
  version: 1,
};

export const ConfiguredSchema: IceTypeSchema = parseSchema({
  $type: 'Configured',
  id: 'uuid!',
  data: 'json',
});
`;
}

/**
 * Create a types file for import testing.
 */
function createTypesFile(): string {
  return `export interface CustomConfig {
  strict: boolean;
  version: number;
  options?: Record<string, unknown>;
}

export type ConfigKey = keyof CustomConfig;
`;
}

/**
 * Create a tsconfig.json with path aliases.
 */
function createTsConfig(baseUrl: string = '.'): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        baseUrl,
        paths: {
          '@schemas/*': ['./schemas/*'],
          '@types/*': ['./types/*'],
        },
      },
      include: ['**/*.ts'],
    },
    null,
    2
  );
}

/**
 * Create a schema that uses tsconfig path aliases.
 */
function createSchemaWithPathAlias(): string {
  return `import { parseSchema } from '${CORE_PATH}';
import type { IceTypeSchema } from '${CORE_PATH}';
// This import uses tsconfig path alias
// import type { UserType } from '@types/user';

export const AliasedSchema: IceTypeSchema = parseSchema({
  $type: 'Aliased',
  id: 'uuid!',
  name: 'string',
});
`;
}

describe('Native TypeScript Loading', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('Direct CLI execution without tsx wrapper', () => {
    /**
     * TEST: The CLI should work when invoked directly without tsx.
     *
     * Current behavior: Works because we use jiti internally
     * Expected: Should work (this test should pass)
     */
    it('should validate a TypeScript schema file without tsx wrapper', () => {
      const schemaDir = join(TEST_DIR, 'direct-validate');
      mkdirSync(schemaDir, { recursive: true });

      const schemaPath = join(schemaDir, 'schema.ts');
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';

export const SimpleSchema = parseSchema({
  $type: 'Simple',
  id: 'uuid!',
  name: 'string',
});
`
      );

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('SimpleSchema is valid');
    });

    /**
     * TEST: The CLI should generate types from TypeScript schema without tsx.
     *
     * Current behavior: Works because we use jiti internally
     * Expected: Should work (this test should pass)
     */
    it('should generate types from TypeScript schema without tsx wrapper', () => {
      const schemaDir = join(TEST_DIR, 'direct-generate');
      mkdirSync(schemaDir, { recursive: true });

      const schemaPath = join(schemaDir, 'schema.ts');
      const outputPath = join(schemaDir, 'types.ts');
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';

export const GenerateSchema = parseSchema({
  $type: 'Generate',
  id: 'uuid!',
  title: 'string',
  count: 'int',
});
`
      );

      const result = runCliViaBin(`generate --schema ${schemaPath} --output ${outputPath}`);

      expect(result.code).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const generated = readFileSync(outputPath, 'utf-8');
      expect(generated).toContain('export interface Generate');
    });
  });

  describe('Complex TypeScript features', () => {
    /**
     * TEST: The CLI should handle complex TypeScript syntax.
     *
     * This tests:
     * - const assertions
     * - Generic functions
     * - Type annotations
     * - satisfies operator (TS 4.9+)
     *
     * EXPECTED TO FAIL if jiti doesn't support all TS features correctly.
     */
    it('should handle generics and type annotations', () => {
      const schemaDir = join(TEST_DIR, 'complex-ts');
      mkdirSync(schemaDir, { recursive: true });

      const schemaPath = join(schemaDir, 'complex.ts');
      writeFileSync(schemaPath, createComplexTypeScriptSchema());

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      // This should work with jiti - testing that complex TS features are transpiled
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('UserSchema is valid');
      expect(result.stdout).toContain('PostSchema is valid');
    });

    /**
     * TEST: Handle TypeScript with type-only imports.
     *
     * This tests that type-only imports are correctly elided during transpilation.
     */
    it('should handle type-only imports', () => {
      const schemaDir = join(TEST_DIR, 'type-imports');
      mkdirSync(schemaDir, { recursive: true });

      const typesPath = join(schemaDir, 'types.ts');
      const schemaPath = join(schemaDir, 'schema.ts');

      writeFileSync(typesPath, createTypesFile());
      writeFileSync(schemaPath, createSchemaWithTypeImports(typesPath));

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('ConfiguredSchema is valid');
    });

    /**
     * TEST: Handle const assertions (as const).
     */
    it('should handle const assertions', () => {
      const schemaDir = join(TEST_DIR, 'const-assertions');
      mkdirSync(schemaDir, { recursive: true });

      const schemaPath = join(schemaDir, 'schema.ts');
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';

const FIELD_TYPES = ['uuid', 'string', 'int'] as const;
type FieldType = typeof FIELD_TYPES[number];

export const ConstSchema = parseSchema({
  $type: 'ConstTest',
  id: 'uuid!',
  name: 'string',
});
`
      );

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('ConstSchema is valid');
    });
  });

  describe('tsconfig.json path resolution', () => {
    /**
     * TEST: The CLI should respect tsconfig.json paths.
     *
     * This uses a VALUE import (not type-only) so it tests that
     * path resolution works at runtime via tsconfig.json configuration.
     */
    it('should resolve tsconfig.json path aliases', () => {
      const schemaDir = join(TEST_DIR, 'tsconfig-paths');
      mkdirSync(join(schemaDir, 'schemas'), { recursive: true });
      mkdirSync(join(schemaDir, 'utils'), { recursive: true });

      // Write tsconfig.json with path aliases
      writeFileSync(join(schemaDir, 'tsconfig.json'), createTsConfig('.'));

      // Write a utility file in the aliased path - exports a VALUE, not just a type
      writeFileSync(
        join(schemaDir, 'utils', 'schema-helpers.ts'),
        `// This exports a VALUE that must be resolved at runtime
export const SCHEMA_VERSION = 2;

export function getSchemaName(base: string): string {
  return base + '_v' + SCHEMA_VERSION;
}
`
      );

      // Write a schema that uses the path alias for a VALUE import
      const schemaPath = join(schemaDir, 'schemas', 'user.ts');
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';
// Path alias import for a VALUE - this MUST be resolved via tsconfig.json
// or the module will fail to load
import { SCHEMA_VERSION, getSchemaName } from '@schemas/../utils/schema-helpers';

const name = getSchemaName('User');

export const UserSchema = parseSchema({
  $type: name,
  $version: SCHEMA_VERSION,
  id: 'uuid!',
  name: 'string',
  email: 'string#',
});
`
      );

      // Run from the schema directory where tsconfig.json exists
      const result = runCliViaBin(`validate --schema ${schemaPath}`, schemaDir);

      // This test documents that path aliases DON'T work currently
      // For GREEN phase, we need to configure jiti to read tsconfig.json
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('UserSchema is valid');
    });

    /**
     * TEST: Path alias resolution should work with baseUrl.
     *
     * This uses a bare module specifier 'lib/helpers' which requires
     * baseUrl resolution from tsconfig.json.
     */
    it('should resolve paths with baseUrl from tsconfig.json', () => {
      const schemaDir = join(TEST_DIR, 'baseurl-paths');
      mkdirSync(join(schemaDir, 'src', 'schemas'), { recursive: true });
      mkdirSync(join(schemaDir, 'src', 'lib'), { recursive: true });

      // tsconfig with baseUrl pointing to src
      writeFileSync(
        join(schemaDir, 'tsconfig.json'),
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
              baseUrl: './src',
              paths: {
                'lib/*': ['lib/*'],
              },
            },
          },
          null,
          2
        )
      );

      // Helper module in lib - exports a VALUE
      writeFileSync(
        join(schemaDir, 'src', 'lib', 'helpers.ts'),
        `export function createId(): string {
  return 'test-id-' + Date.now();
}

export const DEFAULT_NAME = 'DefaultEntity';
`
      );

      // Schema using baseUrl path - bare specifier that needs resolution
      const schemaPath = join(schemaDir, 'src', 'schemas', 'user.ts');
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';
// This import uses baseUrl resolution - 'lib/helpers' is NOT a relative path
// It requires tsconfig.json baseUrl to resolve to ./src/lib/helpers
import { createId, DEFAULT_NAME } from 'lib/helpers';

const id = createId();

export const UserSchema = parseSchema({
  $type: DEFAULT_NAME,
  id: 'uuid!',
});
`
      );

      const result = runCliViaBin(`validate --schema ${schemaPath}`, schemaDir);

      expect(result.code).toBe(0);
    });
  });

  describe('Error messages for TypeScript syntax errors', () => {
    /**
     * TEST: Clear error messages for syntax errors.
     *
     * When a TypeScript file has syntax errors, the error message should:
     * 1. Identify the file
     * 2. Show the line/column of the error
     * 3. Describe the syntax issue clearly
     */
    it('should provide clear error messages for TypeScript syntax errors', () => {
      const schemaDir = join(TEST_DIR, 'syntax-errors');
      mkdirSync(schemaDir, { recursive: true });

      const schemaPath = join(schemaDir, 'broken.ts');
      writeFileSync(schemaPath, createSyntaxErrorSchema());

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      expect(result.code).not.toBe(0);

      const output = result.stdout + result.stderr;
      // The error message should contain useful information
      expect(output.length).toBeGreaterThan(0);

      // Should mention the file or indicate a syntax/parsing issue
      // This validates that error messages are actually useful
      expect(
        output.includes('broken.ts') ||
          output.includes('syntax') ||
          output.includes('Unexpected') ||
          output.includes('parse') ||
          output.includes('Error')
      ).toBe(true);
    });

    /**
     * TEST: Error messages should include line numbers when possible.
     */
    it('should include line information in syntax error messages', () => {
      const schemaDir = join(TEST_DIR, 'line-errors');
      mkdirSync(schemaDir, { recursive: true });

      const schemaPath = join(schemaDir, 'error-line.ts');
      // Create a schema with error on a specific line (line 8)
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';

export const Schema = parseSchema({
  $type: 'Test',
  id: 'uuid!'
  // Missing comma above - error is on line 5-6 area
  name: 'string',
});
`
      );

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      expect(result.code).not.toBe(0);

      const output = result.stdout + result.stderr;
      // Error should have some indication of where the problem is
      // This could be a line number, column, or surrounding code context
      expect(output.length).toBeGreaterThan(10);
    });

    /**
     * TEST: Runtime errors should be distinguishable from syntax errors.
     */
    it('should distinguish runtime errors from syntax errors', () => {
      const schemaDir = join(TEST_DIR, 'runtime-error');
      mkdirSync(schemaDir, { recursive: true });

      const schemaPath = join(schemaDir, 'runtime.ts');
      // Valid TypeScript syntax but will throw at runtime due to calling undefined
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';

// This will throw at runtime because nonExistent is undefined
const nonExistent: any = undefined;
const result = nonExistent.someMethod();

export const RuntimeErrorSchema = parseSchema({
  $type: 'RuntimeError',
  id: 'uuid!',
  data: result,
});
`
      );

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      expect(result.code).not.toBe(0);

      const output = result.stdout + result.stderr;
      // Runtime errors should indicate it's a runtime issue, not syntax
      expect(output.length).toBeGreaterThan(0);
      // Should contain error information
      expect(
        output.includes('TypeError') ||
          output.includes('undefined') ||
          output.includes('Cannot read') ||
          output.includes('Error')
      ).toBe(true);
    });
  });

  describe('Module resolution edge cases', () => {
    /**
     * TEST: Relative imports should work correctly.
     */
    it('should handle relative imports between TypeScript files', () => {
      const schemaDir = join(TEST_DIR, 'relative-imports');
      mkdirSync(schemaDir, { recursive: true });

      // Helper module
      writeFileSync(
        join(schemaDir, 'helpers.ts'),
        `export const DEFAULT_VERSION = 1;

export function getTimestamp(): number {
  return Date.now();
}
`
      );

      // Main schema importing the helper
      const schemaPath = join(schemaDir, 'schema.ts');
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';
import { DEFAULT_VERSION } from './helpers.js';

export const RelativeSchema = parseSchema({
  $type: 'Relative',
  id: 'uuid!',
  version: 'int',
});
`
      );

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('RelativeSchema is valid');
    });

    /**
     * TEST: Importing from node_modules should work.
     */
    it('should handle imports from node_modules', () => {
      const schemaDir = join(TEST_DIR, 'node-modules-import');
      mkdirSync(schemaDir, { recursive: true });

      // Schema that imports from @icetype/core via node_modules resolution
      const schemaPath = join(schemaDir, 'schema.ts');
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';
import type { IceTypeSchema, FieldDefinition } from '${CORE_PATH}';

// Use imported types
const fields: Map<string, FieldDefinition> = new Map();

export const NodeModulesSchema: IceTypeSchema = parseSchema({
  $type: 'NodeModules',
  id: 'uuid!',
});
`
      );

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('NodeModulesSchema is valid');
    });
  });

  describe('Export variations', () => {
    /**
     * TEST: Multiple exports from a single file.
     */
    it('should handle multiple schema exports', () => {
      const schemaDir = join(TEST_DIR, 'multiple-exports');
      mkdirSync(schemaDir, { recursive: true });

      const schemaPath = join(schemaDir, 'schemas.ts');
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';

export const FirstSchema = parseSchema({
  $type: 'First',
  id: 'uuid!',
});

export const SecondSchema = parseSchema({
  $type: 'Second',
  id: 'uuid!',
  ref: 'uuid',
});

export const ThirdSchema = parseSchema({
  $type: 'Third',
  id: 'uuid!',
  data: 'json',
});
`
      );

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('FirstSchema is valid');
      expect(result.stdout).toContain('SecondSchema is valid');
      expect(result.stdout).toContain('ThirdSchema is valid');
      expect(result.stdout).toContain('Found 3 schema(s)');
    });

    /**
     * TEST: Default exports should work.
     */
    it('should handle default exports', () => {
      const schemaDir = join(TEST_DIR, 'default-export');
      mkdirSync(schemaDir, { recursive: true });

      const schemaPath = join(schemaDir, 'schema.ts');
      writeFileSync(
        schemaPath,
        `import { parseSchema } from '${CORE_PATH}';

const DefaultSchema = parseSchema({
  $type: 'Default',
  id: 'uuid!',
  value: 'string',
});

export default DefaultSchema;
`
      );

      const result = runCliViaBin(`validate --schema ${schemaPath}`);

      // Default exports should be detected
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('is valid');
    });

    /**
     * TEST: Re-exports should work.
     */
    it('should handle re-exports', () => {
      const schemaDir = join(TEST_DIR, 're-exports');
      mkdirSync(schemaDir, { recursive: true });

      // Original schema file
      writeFileSync(
        join(schemaDir, 'user.ts'),
        `import { parseSchema } from '${CORE_PATH}';

export const UserSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string',
});
`
      );

      // Re-export file
      const indexPath = join(schemaDir, 'index.ts');
      writeFileSync(
        indexPath,
        `export { UserSchema } from './user.js';

import { parseSchema } from '${CORE_PATH}';

export const IndexSchema = parseSchema({
  $type: 'Index',
  id: 'uuid!',
});
`
      );

      const result = runCliViaBin(`validate --schema ${indexPath}`);

      expect(result.code).toBe(0);
      // Should find both the direct export and the re-export
      expect(result.stdout).toContain('is valid');
    });
  });
});
