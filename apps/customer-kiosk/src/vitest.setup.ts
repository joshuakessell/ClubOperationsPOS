import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

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
