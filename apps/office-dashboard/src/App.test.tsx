import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    // When not authenticated, LockScreen is shown
    expect(screen.getByText('Staff Login')).toBeDefined();
  });

  it('shows lock screen with PIN input', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    // Lock screen should show PIN input
    expect(screen.getByPlaceholderText('Enter PIN')).toBeDefined();
  });

  it('renders dashboard when authenticated', () => {
    // Mock a session in localStorage
    const mockSession = {
      sessionToken: 'test-token',
      name: 'Test User',
      role: 'admin',
    };
    localStorage.setItem('staff_session', JSON.stringify(mockSession));
    
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('Office Dashboard')).toBeDefined();
  });
});

