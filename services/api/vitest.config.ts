import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/vitest.setup.ts'],
    // Integration tests share a single Postgres instance; run serially to avoid cross-test DB interference.
    // Vitest 4.x removed singleFork; use maxWorkers + isolate instead.
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
      },
    },
    isolate: false,
    fileParallelism: false,
    teardownTimeout: 10000,
    forceExit: true,
  },
});
