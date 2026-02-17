import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { registerHangingProcessDiagnostics } from './test-utils/vitestHooks';

registerHangingProcessDiagnostics();

// Suppress known noisy console warnings in tests.
// These are expected side-effects of rendering components with realtime/polling hooks
// in a mock environment and clutter CI output.
const SUPPRESSED_PATTERNS = [
  'inside a test was not wrapped in act',
  'Maximum update depth exceeded',
  'Realtime connection error',
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
  // This must happen before clearing timers so that hook cleanup functions can clear their timers.
  cleanup();

  // Clean up DOM (must happen before clearing timers, as portal cleanup in DOM refs may depend on this).
  document.body.innerHTML = '';

  // Now that components are unmounted, clear any remaining timers.
  // This is critical for hooks like useLaneSession that use window.setInterval.
  vi.clearAllTimers();

  // Switch back to real timers for the next test (must happen AFTER clearing timers).
  vi.useRealTimers();

  // Clean up all mocks (must happen last so that earlier cleanup doesn't trigger new mocks).
  vi.clearAllMocks();
});
