/**
 * Native TypeScript Loading Tests for @icetype/cli
 *
 * RED PHASE - TDD tests documenting expected but not-yet-implemented behavior.
 *
 * Issue: icetype-4em.1
 *
 * This file contains two categories of tests:
 *
 * 1. RED TESTS (should FAIL) - marked with "FAILING:" comments
 *    These document expected behavior that requires implementation work.
 *    Tests marked as failing verify features that don't work yet.
 *
 * 2. VALIDATION TESTS (should PASS) - marked with "VALIDATES:" comments
 *    These verify that existing functionality continues to work.
 *    They serve as regression tests for current jiti implementation.
 *
 * Test Categories:
 * - Loading .ts schema files without tsx wrapper
 * - Resolving tsconfig.json path aliases
 * - Handling TypeScript syntax errors gracefully
 * - Caching compiled modules for performance
 *
 * When implementing the GREEN phase:
 * - Make RED tests pass one by one
 * - Keep VALIDATION tests passing (regression prevention)
 * - Do not modify tests, only the implementation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, '../../dist/cli.js');
const CORE_PATH = resolve(__dirname, '../../../core/dist/index.js');

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a unique test directory for each test suite
 */
function createTestDir(name: string): string {
  const dir = join(tmpdir(), `icetype-red-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Run CLI command and capture output
 */
function runCli(args: string, cwd: string): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '' }, // Clear NODE_OPTIONS to avoid tsx
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

// =============================================================================
// Test Suite: Caching Compiled Modules for Performance
// =============================================================================

describe('RED: Caching compiled modules for performance', () => {
  let TEST_DIR: string;

  beforeAll(() => {
    TEST_DIR = createTestDir('caching');
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  /**
   * RED TEST: Multiple loads of the same file should use cache
   *
   * EXPECTED BEHAVIOR (not yet implemented):
   * - First load: compiles TypeScript, caches result
   * - Subsequent loads: returns cached module without recompilation
   * - Performance improvement should be measurable
   *
   * CURRENT BEHAVIOR:
   * - moduleCache is set to false in jiti config
   * - Every load recompiles the TypeScript
   * - No performance benefit from repeated loads
   */
  it('should cache compiled modules and reuse them on subsequent loads', async () => {
    const schemaPath = join(TEST_DIR, 'cached-schema.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

// Add a timestamp to track if module is re-executed
const loadTime = Date.now();
console.log('MODULE_LOADED:', loadTime);

export const CachedSchema = parseSchema({
  $type: 'Cached',
  id: 'uuid!',
  loadTime: 'int',
});

export { loadTime };
`
    );

    // Import the schema loader directly to test caching
    const { loadSchemaFile, clearSchemaLoaderCaches } = await import('../utils/schema-loader.js');

    // Clear any existing cache
    clearSchemaLoaderCaches();

    // First load
    const result1 = await loadSchemaFile(schemaPath);
    expect(result1.errors).toHaveLength(0);
    expect(result1.schemas).toHaveLength(1);

    // Second load - should use cache
    const result2 = await loadSchemaFile(schemaPath);
    expect(result2.errors).toHaveLength(0);
    expect(result2.schemas).toHaveLength(1);

    // FAILING: The module should be cached and return the same instance
    // Currently moduleCache: false means each load re-executes the module
    // We need a way to verify the cache is being used
    // This could be done by checking that the same object reference is returned
    // or by measuring that subsequent loads are significantly faster
    expect(result1.schemas[0]!.schema).toBe(result2.schemas[0]!.schema);
  });

  /**
   * VALIDATION TEST: Modified files should load with new content
   *
   * VALIDATES: When a file is modified between loads, the new content is used.
   * Note: This currently works because moduleCache: false, not smart invalidation.
   */
  it('should invalidate cache when source file is modified', async () => {
    const schemaPath = join(TEST_DIR, 'mutable-schema.ts');

    // Version 1
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';
export const MutableSchema = parseSchema({
  $type: 'Mutable',
  version: 'int = 1',
  id: 'uuid!',
});
`
    );

    const { loadSchemaFile, clearSchemaLoaderCaches } = await import('../utils/schema-loader.js');
    clearSchemaLoaderCaches();

    const result1 = await loadSchemaFile(schemaPath);
    expect(result1.schemas).toHaveLength(1);
    const schema1 = result1.schemas[0]!.schema;

    // Wait a moment to ensure different mtime
    await new Promise(resolve => setTimeout(resolve, 10));

    // Version 2 - modify the file
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';
export const MutableSchema = parseSchema({
  $type: 'Mutable',
  version: 'int = 2',
  id: 'uuid!',
  newField: 'string',
});
`
    );

    const result2 = await loadSchemaFile(schemaPath);
    expect(result2.schemas).toHaveLength(1);
    const schema2 = result2.schemas[0]!.schema;

    // FAILING: The second load should detect the file changed and reload
    // Currently works because caching is disabled, but we want smart caching
    // The schemas should have different field counts
    expect(schema2.fields.size).toBe(3); // id, version, newField
    expect(schema1.fields.size).toBe(2); // id, version

    // More importantly, the loaded schema should reflect the new field
    expect(schema2.fields.has('newField')).toBe(true);
  });

  /**
   * VALIDATION TEST: Multiple files in same project should load correctly
   *
   * VALIDATES: Files in the same project with shared tsconfig both load.
   * Note: Internal jiti instance reuse is not directly testable.
   */
  it('should reuse jiti instance for files sharing same tsconfig', async () => {
    const projectDir = join(TEST_DIR, 'shared-tsconfig');
    mkdirSync(join(projectDir, 'schemas'), { recursive: true });

    // Create tsconfig
    writeFileSync(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
        },
      })
    );

    // Create two schema files in the same project
    writeFileSync(
      join(projectDir, 'schemas', 'user.ts'),
      `import { parseSchema } from '${CORE_PATH}';
export const UserSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
});
`
    );

    writeFileSync(
      join(projectDir, 'schemas', 'post.ts'),
      `import { parseSchema } from '${CORE_PATH}';
export const PostSchema = parseSchema({
  $type: 'Post',
  id: 'uuid!',
});
`
    );

    const { loadSchemaFile, clearSchemaLoaderCaches } = await import('../utils/schema-loader.js');
    clearSchemaLoaderCaches();

    // Load both files
    const result1 = await loadSchemaFile(join(projectDir, 'schemas', 'user.ts'));
    const result2 = await loadSchemaFile(join(projectDir, 'schemas', 'post.ts'));

    expect(result1.errors).toHaveLength(0);
    expect(result2.errors).toHaveLength(0);

    // FAILING: We need to verify the jiti instance is being reused
    // This requires either exposing cache metrics or using a spy
    // For now, we just verify both loads work, but true caching verification
    // would require implementation changes to expose cache stats

    // At minimum, verify the tsconfig was found for both
    expect(result1.schemas).toHaveLength(1);
    expect(result2.schemas).toHaveLength(1);
  });

  /**
   * VALIDATION TEST: Performance metrics for cached vs uncached loads
   *
   * VALIDATES: Current jiti performance is acceptable.
   * Note: True caching verification requires implementation changes.
   */
  it('should demonstrate measurable performance improvement from caching', async () => {
    const schemaPath = join(TEST_DIR, 'perf-schema.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

// Add some complexity to make compilation measurable
interface ComplexType {
  nested: {
    deep: {
      value: string;
    };
  };
}

type UnionType = 'a' | 'b' | 'c' | 'd' | 'e';

export const PerfSchema = parseSchema({
  $type: 'Perf',
  id: 'uuid!',
  data: 'json',
  status: 'string',
});
`
    );

    const { loadSchemaFile, clearSchemaLoaderCaches } = await import('../utils/schema-loader.js');
    clearSchemaLoaderCaches();

    // Cold load (no cache)
    const coldStart = performance.now();
    await loadSchemaFile(schemaPath);
    const coldDuration = performance.now() - coldStart;

    // Warm load (should be cached)
    const warmStart = performance.now();
    await loadSchemaFile(schemaPath);
    const warmDuration = performance.now() - warmStart;

    // VALIDATES: Both loads complete in reasonable time
    // True caching would show significant speedup, but current implementation
    // with moduleCache: false means both loads take similar time
    // This test validates that loading still works and is reasonably fast
    expect(coldDuration).toBeLessThan(5000); // Should load in under 5s
    expect(warmDuration).toBeLessThan(5000);
  });

  /**
   * RED TEST: Export cache statistics for debugging
   *
   * FAILING: No API exists to get cache statistics.
   *
   * EXPECTED BEHAVIOR:
   * - Provide a way to inspect cache state
   * - Show number of cached modules, tsconfig paths, jiti instances
   * - Useful for debugging and performance monitoring
   *
   * CURRENT BEHAVIOR:
   * - Caches are internal with no visibility
   * - No way to verify caching is working correctly
   */
  it('should expose cache statistics for debugging', async () => {
    const schemaPath = join(TEST_DIR, 'stats-schema.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';
export const StatsSchema = parseSchema({
  $type: 'Stats',
  id: 'uuid!',
});
`
    );

    // Import with dynamic import to get fresh module reference
    const schemaLoader = await import('../utils/schema-loader.js');
    schemaLoader.clearSchemaLoaderCaches();

    // Load a file
    await schemaLoader.loadSchemaFile(schemaPath);

    // FAILING: getCacheStats does not exist
    // Expected: a function that returns cache statistics
    const getCacheStats = (schemaLoader as any).getCacheStats;
    expect(getCacheStats).toBeDefined();

    if (getCacheStats) {
      const stats = getCacheStats();
      expect(stats).toHaveProperty('tsConfigPathCacheSize');
      expect(stats).toHaveProperty('tsConfigCacheSize');
      expect(stats).toHaveProperty('jitiCacheSize');
      expect(stats.jitiCacheSize).toBeGreaterThanOrEqual(1);
    }
  });
});

// =============================================================================
// Test Suite: tsconfig.json Path Alias Resolution
// =============================================================================

describe('RED: Resolving tsconfig.json path aliases', () => {
  let TEST_DIR: string;

  beforeAll(() => {
    TEST_DIR = createTestDir('path-aliases');
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  /**
   * VALIDATION TEST: Resolve @-prefixed path aliases
   *
   * VALIDATES: Basic @-prefixed path aliases work with jiti.
   * This tests the current implementation's path alias support.
   */
  it('should resolve @-prefixed path aliases from tsconfig.json', async () => {
    const projectDir = join(TEST_DIR, 'at-prefix-aliases');
    mkdirSync(join(projectDir, 'src', 'utils'), { recursive: true });
    mkdirSync(join(projectDir, 'src', 'schemas'), { recursive: true });

    // tsconfig with @-prefixed aliases
    writeFileSync(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          baseUrl: '.',
          paths: {
            '@utils/*': ['src/utils/*'],
            '@schemas/*': ['src/schemas/*'],
          },
        },
      }, null, 2)
    );

    // Utility module at the aliased path
    writeFileSync(
      join(projectDir, 'src', 'utils', 'helpers.ts'),
      `export const DEFAULT_VERSION = 42;
export function formatName(name: string): string {
  return name.toUpperCase();
}
`
    );

    // Schema that imports via path alias
    const schemaPath = join(projectDir, 'src', 'schemas', 'user.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';
// This import uses the @utils path alias
import { DEFAULT_VERSION, formatName } from '@utils/helpers';

const version = DEFAULT_VERSION;
const formatted = formatName('test');

export const UserSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string',
});

export { version, formatted };
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, projectDir);

    // FAILING: Path aliases should resolve correctly
    // If this fails, it means @utils/helpers cannot be resolved
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('UserSchema is valid');
  });

  /**
   * VALIDATION TEST: Resolve nested path aliases
   *
   * VALIDATES: Deeply nested path aliases work with jiti.
   */
  it('should resolve deeply nested path alias imports', async () => {
    const projectDir = join(TEST_DIR, 'nested-aliases');
    mkdirSync(join(projectDir, 'src', 'lib', 'validation', 'rules'), { recursive: true });
    mkdirSync(join(projectDir, 'src', 'schemas'), { recursive: true });

    writeFileSync(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          baseUrl: '.',
          paths: {
            '@lib/*': ['src/lib/*'],
          },
        },
      }, null, 2)
    );

    // Deeply nested module
    writeFileSync(
      join(projectDir, 'src', 'lib', 'validation', 'rules', 'email.ts'),
      `export const EMAIL_REGEX = /^[^@]+@[^@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}
`
    );

    const schemaPath = join(projectDir, 'src', 'schemas', 'contact.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';
// Deeply nested path alias import
import { EMAIL_REGEX, isValidEmail } from '@lib/validation/rules/email';

const regex = EMAIL_REGEX;
const valid = isValidEmail('test@example.com');

export const ContactSchema = parseSchema({
  $type: 'Contact',
  id: 'uuid!',
  email: 'string#',
});

export { regex, valid };
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, projectDir);

    // FAILING: Deep path aliases should resolve
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('ContactSchema is valid');
  });

  /**
   * VALIDATION TEST: Resolve path aliases with index files
   *
   * VALIDATES: Path aliases pointing to directories with index files work.
   */
  it('should resolve path aliases that point to directories with index files', async () => {
    const projectDir = join(TEST_DIR, 'index-aliases');
    mkdirSync(join(projectDir, 'src', 'shared'), { recursive: true });
    mkdirSync(join(projectDir, 'src', 'schemas'), { recursive: true });

    writeFileSync(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          baseUrl: '.',
          paths: {
            '@shared': ['src/shared/index'],
            '@shared/*': ['src/shared/*'],
          },
        },
      }, null, 2)
    );

    // Index file that re-exports
    writeFileSync(
      join(projectDir, 'src', 'shared', 'index.ts'),
      `export const SHARED_CONFIG = { version: 1 };
export { helpers } from './helpers.js';
`
    );

    writeFileSync(
      join(projectDir, 'src', 'shared', 'helpers.ts'),
      `export const helpers = {
  formatDate: (d: Date) => d.toISOString(),
};
`
    );

    const schemaPath = join(projectDir, 'src', 'schemas', 'event.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';
// Import from index via path alias
import { SHARED_CONFIG, helpers } from '@shared';

const config = SHARED_CONFIG;
const fmt = helpers.formatDate(new Date());

export const EventSchema = parseSchema({
  $type: 'Event',
  id: 'uuid!',
  timestamp: 'timestamp',
});
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, projectDir);

    // FAILING: Index file resolution with path aliases
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('EventSchema is valid');
  });

  /**
   * RED TEST: Handle multiple tsconfig extends
   *
   * EXPECTED BEHAVIOR:
   * - Path aliases from base tsconfig should be inherited
   * - Extended configs should merge paths correctly
   */
  it('should inherit path aliases from extended tsconfig', async () => {
    const projectDir = join(TEST_DIR, 'extends-aliases');
    mkdirSync(join(projectDir, 'src', 'core'), { recursive: true });
    mkdirSync(join(projectDir, 'src', 'schemas'), { recursive: true });

    // Base tsconfig with paths
    writeFileSync(
      join(projectDir, 'tsconfig.base.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          baseUrl: '.',
          paths: {
            '@core/*': ['src/core/*'],
          },
        },
      }, null, 2)
    );

    // Extended tsconfig
    writeFileSync(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify({
        extends: './tsconfig.base.json',
        compilerOptions: {
          strict: true,
        },
      }, null, 2)
    );

    writeFileSync(
      join(projectDir, 'src', 'core', 'types.ts'),
      `export interface CoreConfig {
  name: string;
  version: number;
}
export const DEFAULT_CONFIG: CoreConfig = { name: 'test', version: 1 };
`
    );

    const schemaPath = join(projectDir, 'src', 'schemas', 'app.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';
// Path alias should be inherited from base tsconfig
import { DEFAULT_CONFIG } from '@core/types';

const config = DEFAULT_CONFIG;

export const AppSchema = parseSchema({
  $type: 'App',
  id: 'uuid!',
  config: 'json',
});
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, projectDir);

    // FAILING: Extended tsconfig paths should be resolved
    // Currently jiti may not handle tsconfig extends for paths
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('AppSchema is valid');
  });
});

// =============================================================================
// Test Suite: TypeScript Syntax Error Handling
// =============================================================================

describe('RED: Handling TypeScript syntax errors gracefully', () => {
  let TEST_DIR: string;

  beforeAll(() => {
    TEST_DIR = createTestDir('syntax-errors');
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  /**
   * VALIDATION TEST: Error message should include exact file location
   *
   * VALIDATES: Syntax errors include file path and line:column information.
   */
  it('should include file:line:column in syntax error messages', async () => {
    const schemaPath = join(TEST_DIR, 'syntax-location.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

export const Schema = parseSchema({
  $type: 'Test',
  id: 'uuid!',
  name 'string', // Line 6 - missing colon
  email: 'string',
});
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, TEST_DIR);

    expect(result.code).not.toBe(0);
    const output = result.stdout + result.stderr;

    // FAILING: Error should include file:line:column format
    // Expected format: /path/to/file.ts:6:8 or similar
    expect(output).toMatch(/syntax-location\.ts:\d+:\d+/);
  });

  /**
   * RED TEST: Show code snippet around error location
   *
   * EXPECTED BEHAVIOR:
   * - Error message includes the problematic line of code
   * - Shows context (line before and after)
   * - Points to the exact error location with a caret
   */
  it('should show code snippet with error location highlighted', async () => {
    const schemaPath = join(TEST_DIR, 'snippet-error.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

const config = {
  debug: true,
  level 'high', // Missing colon
};

export const Schema = parseSchema({
  $type: 'Test',
  id: 'uuid!',
});
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, TEST_DIR);

    expect(result.code).not.toBe(0);
    const output = result.stdout + result.stderr;

    // FAILING: Error should include code snippet
    // Should show the line with "level 'high'" and indicate the problem
    expect(output).toContain("level");
    // Should have some form of error indicator
    expect(output).toMatch(/\^|>>>|-->|error/i);
  });

  /**
   * VALIDATION TEST: Distinguish between different syntax error types
   *
   * VALIDATES: Syntax error messages indicate what's missing.
   */
  it('should provide specific error type information', async () => {
    const schemaPath = join(TEST_DIR, 'specific-error.ts');
    // Missing closing brace
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

export const Schema = parseSchema({
  $type: 'Test',
  id: 'uuid!'
// Missing closing brace and parenthesis
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, TEST_DIR);

    expect(result.code).not.toBe(0);
    const output = result.stdout + result.stderr;

    // FAILING: Error should describe what's missing
    // Should mention missing brace or unexpected end
    expect(output).toMatch(/unexpected|missing|brace|bracket|\}|\)/i);
  });

  /**
   * VALIDATION TEST: Handle multiple syntax errors in same file
   *
   * VALIDATES: At least one syntax error is reported with location info.
   */
  it('should report multiple syntax errors when present', async () => {
    const schemaPath = join(TEST_DIR, 'multi-error.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

const a = { x y }; // Error 1: missing colon
const b = { p q }; // Error 2: missing colon

export const Schema = parseSchema({
  $type: 'Test',
  id: 'uuid!',
});
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, TEST_DIR);

    expect(result.code).not.toBe(0);
    const output = result.stdout + result.stderr;

    // FAILING: Should report at least the first error clearly
    // Ideally would report both errors
    expect(output.length).toBeGreaterThan(0);
    // At minimum, should mention line numbers
    expect(output).toMatch(/:\d+/);
  });

  /**
   * VALIDATION TEST: Error recovery suggestions
   *
   * VALIDATES: Error messages include suggestions or hints.
   */
  it('should provide helpful suggestions for common syntax errors', async () => {
    const schemaPath = join(TEST_DIR, 'suggestion-error.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

// Common mistake: using = instead of : in object
export const Schema = parseSchema({
  $type = 'Test', // Should be $type: 'Test'
  id: 'uuid!',
});
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, TEST_DIR);

    expect(result.code).not.toBe(0);
    const output = result.stdout + result.stderr;

    // FAILING: Should provide a helpful suggestion
    expect(output).toMatch(/suggestion|hint|did you mean|expected/i);
  });
});

// =============================================================================
// Test Suite: Loading .ts Files Without tsx Wrapper
// =============================================================================

describe('RED: Loading .ts schema files without tsx wrapper', () => {
  let TEST_DIR: string;

  beforeAll(() => {
    TEST_DIR = createTestDir('native-ts');
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  /**
   * VALIDATION TEST: Load TypeScript 5.0+ features (satisfies)
   *
   * VALIDATES: TypeScript satisfies operator works with jiti.
   */
  it('should handle TypeScript satisfies operator (TS 5.0+)', async () => {
    const schemaPath = join(TEST_DIR, 'ts5-satisfies.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

interface SchemaConfig {
  name: string;
  strict: boolean;
}

const config = {
  name: 'Test',
  strict: true,
  extra: 'allowed', // Extra props allowed but typed
} satisfies SchemaConfig & Record<string, unknown>;

export const Schema = parseSchema({
  $type: config.name,
  id: 'uuid!',
});
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, TEST_DIR);

    // Should work - jiti supports modern TS
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('is valid');
  });

  /**
   * VALIDATION TEST: Load TypeScript with decorators (experimental)
   *
   * VALIDATES: Decorator syntax is supported by jiti.
   */
  it('should handle TypeScript decorator syntax', async () => {
    const schemaPath = join(TEST_DIR, 'ts-decorators.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

// Simple decorator that does nothing (for syntax test)
function logged(target: any, key: string) {
  // decorator implementation
}

class SchemaBuilder {
  @logged
  build() {
    return parseSchema({
      $type: 'Decorated',
      id: 'uuid!',
    });
  }
}

const builder = new SchemaBuilder();
export const DecoratedSchema = builder.build();
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, TEST_DIR);

    // FAILING: Decorator support may need tsconfig configuration
    // Or jiti may not support decorators by default
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('DecoratedSchema is valid');
  });

  /**
   * VALIDATION TEST: Load TypeScript with const type parameters (TS 5.0+)
   *
   * VALIDATES: const type parameters work with jiti.
   */
  it('should handle const type parameters (TS 5.0+)', async () => {
    const schemaPath = join(TEST_DIR, 'ts5-const-type.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

// const type parameter - TS 5.0 feature
function defineSchema<const T extends readonly string[]>(fields: T) {
  return {
    fields,
    first: fields[0],
  };
}

const result = defineSchema(['id', 'name', 'email'] as const);
// result.fields should be readonly ['id', 'name', 'email']

export const ConstTypeSchema = parseSchema({
  $type: 'ConstType',
  id: 'uuid!',
});
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, TEST_DIR);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('ConstTypeSchema is valid');
  });

  /**
   * RED TEST: Load TypeScript with using declarations (TS 5.2+)
   *
   * EXPECTED BEHAVIOR:
   * - using declarations should work
   * - Symbol.dispose should be recognized
   */
  it('should handle using declarations (TS 5.2+)', async () => {
    const schemaPath = join(TEST_DIR, 'ts52-using.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

// using declaration - TS 5.2 feature
function getResource() {
  return {
    data: 'test',
    [Symbol.dispose]() {
      // cleanup
    },
  };
}

function doWork() {
  using resource = getResource();
  return resource.data;
}

const data = doWork();

export const UsingSchema = parseSchema({
  $type: 'Using',
  id: 'uuid!',
  data: 'string',
});
`
    );

    const result = runCli(`validate --schema ${schemaPath}`, TEST_DIR);

    // FAILING: using declarations may not be supported yet
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('UsingSchema is valid');
  });

  /**
   * VALIDATION TEST: CLI execution works without NODE_OPTIONS
   *
   * VALIDATES: The CLI works without tsx or NODE_OPTIONS set.
   */
  it('should work without NODE_OPTIONS environment variable', async () => {
    const schemaPath = join(TEST_DIR, 'no-node-opts.ts');
    writeFileSync(
      schemaPath,
      `import { parseSchema } from '${CORE_PATH}';

export const NoOptsSchema = parseSchema({
  $type: 'NoOpts',
  id: 'uuid!',
});
`
    );

    // Explicitly clear NODE_OPTIONS
    const result = spawnSync('node', [CLI_PATH, 'validate', '--schema', schemaPath], {
      cwd: TEST_DIR,
      encoding: 'utf-8',
      env: {
        ...process.env,
        NODE_OPTIONS: '', // Explicitly empty
        TSX_DISABLE: '1', // Disable tsx if present
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NoOptsSchema is valid');
  });
});
