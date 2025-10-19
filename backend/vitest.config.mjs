import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    maxThreads: 1,
    minThreads: 1,
    reporters: 'default',
    coverage: {
      enabled: false
    }
  }
});
