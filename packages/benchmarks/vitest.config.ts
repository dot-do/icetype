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
    // Regular tests - explicitly exclude bench files
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.bench.ts', 'node_modules/**'],
  },
  // Benchmark-specific configuration (used by vitest bench)
  benchmark: {
    include: ['src/**/*.bench.ts'],
    exclude: ['node_modules/**'],
    reporters: ['default', 'json'],
    outputFile: {
      json: './benchmark-results.json',
    },
  },
});
