import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['node_modules', 'dist', 'test-pipeline'],
    testTimeout: 15000,
  },
});
