import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@club-ops/shared/realtime',
        replacement: path.resolve(__dirname, '../../packages/shared/realtime'),
      },
      {
        find: '@club-ops/shared',
        replacement: path.resolve(__dirname, '../../packages/shared/src'),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/vitest.setup.ts'],
    // Avoid flaky OOMs:
    // - Node worker threads often have a lower heap limit than the parent process.
    // - Use a single forked process instead of threads to get a normal Node heap.
    // Vitest 4.x: singleFork → maxWorkers: 1, isolate: false; poolOptions removed.
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
    teardownTimeout: 10000,
    forceExit: true,
    // Note: tests should clean up any background intervals/sockets they start.
    // The mock WebSocket in registerAppTestUtils.ts simulates proper close() behavior
    // to ensure React cleanup effects cancel reconnection timers and intervals.
    // The CI step also has a timeout-minutes safety net.
    reporters: process.env.CI ? ['default', 'hanging-process'] : ['default'],
  },
});
