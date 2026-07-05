import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scenarios/**/*.test.ts'],
    exclude: ['samples/**', 'node_modules/**'],
    testTimeout: 300000,   // 5 minutes per test (agents take time)
    hookTimeout: 120000,   // 2 minutes for setup hooks
    globals: false,
    pool: 'forks',         // Isolate each test in its own process
    poolOptions: {
      forks: {
        singleFork: true,  // Run tests sequentially to avoid agent conflicts
      },
    },
  },
});
