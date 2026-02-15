import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Suppress known noisy console warnings in tests.
const SUPPRESSED_PATTERNS = [
    'inside a test was not wrapped in act',
    'Maximum update depth exceeded',
];

beforeAll(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
        const msg = typeof args[0] === 'string' ? args[0] : '';
        if (SUPPRESSED_PATTERNS.some((p) => msg.includes(p))) return;
        originalError.call(console, ...args);
    };
});

afterEach(() => {
    // First, unmount all rendered components to trigger useEffect cleanups.
    cleanup();

    // Now that components are unmounted, clear any remaining timers.
    vi.clearAllTimers();

    // Switch back to real timers for the next test.
    vi.useRealTimers();

    // Clean up all mocks.
    vi.clearAllMocks();
});
