import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scenarios/**/*.test.ts'],
    exclude: ['samples/**', 'node_modules/**'],
    testTimeout: 120000,
    hookTimeout: 120000,
    globals: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
