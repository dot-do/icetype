import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests typically take longer
    testTimeout: 120000,
    hookTimeout: 120000,

    // Run tests sequentially to avoid port conflicts with containers
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Include only integration test files
    include: ['src/**/*.integration.test.ts'],

    // Don't report coverage for integration tests
    coverage: {
      enabled: false,
    },
  },
});
