import { defineConfig } from 'vitest/config';

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
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/__tests__/**',
        '**/test-utils/**',
        '**/*.test.ts',
        '**/*.d.ts',
      ],
    },
  },
});
