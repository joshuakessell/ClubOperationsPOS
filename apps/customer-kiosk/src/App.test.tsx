import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock fetch and WebSocket
global.fetch = vi.fn();
global.WebSocket = vi.fn(() => ({
  onopen: null,
  onclose: null,
  onmessage: null,
  close: vi.fn(),
})) as unknown as typeof WebSocket;

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders logo-only idle screen', () => {
    render(<App />);
    const logo = screen.getByAltText('Club Dallas');
    expect(logo).toBeDefined();
    expect(logo.className).toBe('logo-idle');
  });

  it('shows idle state when no session exists', () => {
    render(<App />);
    // Should show logo-only idle screen
    const logo = screen.getByAltText('Club Dallas');
    expect(logo).toBeDefined();
    expect(logo.className).toBe('logo-idle');
    // Should not show customer info
    expect(screen.queryByText(/Membership:/)).toBeNull();
  });
});

