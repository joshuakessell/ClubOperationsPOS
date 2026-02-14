import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_KIOSK_TOKEN': JSON.stringify('test-kiosk-token'),
    'import.meta.env.VITE_DISABLE_REALTIME': JSON.stringify('false'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    teardownTimeout: 10000,
    reporters: process.env.CI ? ['default', 'hanging-process'] : ['default'],
  },
});
