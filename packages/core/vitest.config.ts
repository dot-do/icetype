import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @icetype/core
 *
 * This package contains critical path code that requires high coverage:
 * - Parser: Core schema parsing logic (95% target)
 * - Diff: Schema comparison and change detection (95% target)
 * - Validation: Schema validation rules (90% target)
 *
 * Coverage Targets (TDD RED phase - icetype-syl.7):
 * These thresholds are set to enforce minimum coverage for critical paths.
 * The GREEN phase (icetype-syl.8) will add tests to meet these targets.
 *
 * Current coverage (as of icetype-syl.7):
 * - parser.ts: 81.85% statements, 95.48% branches, 77.77% functions
 * - diff.ts: 99.43% statements, 96.22% branches, 100% functions
 * - validation.test.ts covers parser.validateSchema
 */
export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/__tests__/**',
        'src/index.ts', // Re-export module
      ],
      // Global thresholds for the core package
      thresholds: {
        // Global defaults (relaxed for non-critical modules)
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,

        // Per-file thresholds for critical paths
        // These enforce 95%+ coverage on parser and diff modules
        'src/parser.ts': {
          lines: 95,
          branches: 95,
          functions: 90,
          statements: 95,
        },
        'src/diff.ts': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        // Validation is tested via parser.validateSchema
        // Coverage is tracked as part of parser.ts
      },
    },
  },
});
