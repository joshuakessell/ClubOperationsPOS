import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: [
            {
                find: '@club-ops/shared',
                replacement: path.resolve(__dirname, '../../packages/shared/src'),
            },
            {
                find: '@',
                replacement: path.resolve(__dirname, './src'),
            },
        ],
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
        pool: 'forks', // Use forks for better isolation in Node environment
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
    },
});
