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
        setupFiles: [], // Add setup file if needed
    },
});
