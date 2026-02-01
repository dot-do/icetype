import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration with coverage thresholds for CI enforcement.
 *
 * Coverage Thresholds:
 * - Global: 80% lines, 75% branches, 80% functions, 80% statements
 * - Critical paths have stricter per-file thresholds (see packages/core/vitest.config.ts)
 *
 * These thresholds are enforced in CI via .github/workflows/tests.yml
 * The build will fail if coverage drops below these thresholds.
 */
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,
      },
    },
    fileParallelism: false,
    maxConcurrency: 5,
    // Skip strict path validation in tests to allow mock paths
    env: {
      ICETYPE_SKIP_PATH_SECURITY: '1',
    },
    // Exclude RED phase TDD tests (features not yet implemented) and compiled files
    exclude: [
      '**/node_modules/**',
      '**/dist/**',                        // Don't run tests from compiled files
      'apps/playground/**',
      'packages/integration-tests/**',     // Requires Docker containers
      '**/*-red*.test.ts',
      '**/pull-command.test.ts',           // DB introspection not yet implemented
      '**/dynamic-imports.test.ts',        // Lazy loading not yet implemented
      '**/schema-loading-errors.test.ts',  // Error enhancements not yet implemented
      '**/adapter-registry.test.ts',       // RED: CLI adapter registry integration
      '**/dynamic-adapter-loading.test.ts', // RED: Dynamic adapter loading
      '**/security-audit.test.ts',         // RED: Security vulnerability tracking
      '**/readme-requirements.test.ts',    // RED: README completeness requirements
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',
      // Global coverage thresholds - CI will fail if not met
      thresholds: {
        // Default thresholds for all packages
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,

        // Per-file thresholds for critical paths
        // Core package - parser and diff are critical
        'packages/core/src/parser.ts': {
          lines: 95,
          branches: 95,
          functions: 90,
          statements: 95,
        },
        'packages/core/src/diff.ts': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        // CLI package - schema loader and config are critical
        'packages/cli/src/utils/schema-loader.ts': {
          lines: 85,
          branches: 80,
          functions: 85,
          statements: 85,
        },
        'packages/cli/src/utils/config.ts': {
          lines: 85,
          branches: 80,
          functions: 85,
          statements: 85,
        },
        // Adapters package - registry is critical
        'packages/adapters/src/registry.ts': {
          lines: 85,
          branches: 80,
          functions: 85,
          statements: 85,
        },
      },
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/__tests__/**',
        '**/test-utils/**',
        '**/*.test.ts',
        '**/*.d.ts',
        '**/index.ts',  // Re-export modules don't need coverage
      ],
    },
  },
});
