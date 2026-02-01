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
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
