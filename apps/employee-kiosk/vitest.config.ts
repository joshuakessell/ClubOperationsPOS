import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react() as any],
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
        find: '@club-ops/ui',
        replacement: path.resolve(__dirname, '../../packages/ui/src'),
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
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
    teardownTimeout: 10000,
    forceExit: true,
    reporters: process.env.CI ? ['default', 'hanging-process'] : ['default'],
  },
});
