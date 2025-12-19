import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock fetch
global.fetch = vi.fn();

// Mock getUserMedia
const mockStream = {
  getTracks: () => [
    {
      stop: vi.fn(),
    },
  ],
} as unknown as MediaStream;

Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue(mockStream),
  },
});

// Mock video element
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(HTMLVideoElement.prototype, 'readyState', {
  writable: true,
  value: HTMLMediaElement.HAVE_ENOUGH_DATA,
});

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        rooms: [],
        statusCounts: { DIRTY: 0, CLEANING: 0, CLEAN: 0 },
        isMixedStatus: false,
        primaryAction: null,
        totalResolved: 0,
        totalRequested: 0,
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders camera preview and content panel', () => {
    render(<App />);
    // Should show camera container and content panel
    expect(screen.getByText('Scanned Rooms')).toBeDefined();
  });

  it('shows empty state when no rooms scanned', () => {
    render(<App />);
    expect(screen.getByText('Scan QR codes to add rooms')).toBeDefined();
  });
});

