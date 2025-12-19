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

  it('renders lock screen when not authenticated', () => {
    render(<App />);
    // When not authenticated, LockScreen is shown
    expect(screen.getByText('Staff Login')).toBeDefined();
  });

  it('shows lock screen with PIN input', () => {
    render(<App />);
    // Lock screen should show PIN input
    expect(screen.getByPlaceholderText('Enter PIN')).toBeDefined();
  });
});

