import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  // `ModalFrame` portals render into `document.body`; ensure nothing persists between tests.
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.clearAllTimers();
});
