import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  onopen: null,
  onclose: null,
  onmessage: null,
  close: vi.fn(),
  send: vi.fn(),
})) as unknown as typeof WebSocket;

// Mock fetch
global.fetch = vi.fn();

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 }),
    });
  });

  it('renders lock screen when not authenticated', () => {
    render(<App />);
    // When not authenticated, LockScreen is shown instead of the main app
    // The LockScreen component should be rendered
    expect(screen.queryByText('Employee Register')).toBeNull();
  });

  it('renders the register header when authenticated', () => {
    // Mock a session in localStorage
    const mockSession = {
      sessionToken: 'test-token',
      name: 'Test User',
      role: 'staff',
    };
    localStorage.setItem('staff_session', JSON.stringify(mockSession));
    
    render(<App />);
    expect(screen.getByText('Employee Register')).toBeDefined();
  });

  it('shows lane session section when authenticated', () => {
    // Mock a session in localStorage
    const mockSession = {
      sessionToken: 'test-token',
      name: 'Test User',
      role: 'staff',
    };
    localStorage.setItem('staff_session', JSON.stringify(mockSession));
    
    render(<App />);
    expect(screen.getByText('Lane Session')).toBeDefined();
  });
});

