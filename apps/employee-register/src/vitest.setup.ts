import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { registerHangingProcessDiagnostics } from './test-utils/vitestHooks';

registerHangingProcessDiagnostics();

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
