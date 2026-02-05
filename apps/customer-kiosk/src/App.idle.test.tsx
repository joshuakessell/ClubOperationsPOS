import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { setupKioskAppTest } from './test-utils/kioskAppTestUtils';

const { getApp } = setupKioskAppTest();

describe('App idle states', () => {
  it('renders logo-only idle screen', () => {
    const App = getApp();
    act(() => {
      render(<App />);
    });
    const logo = screen.getByAltText('Club Dallas');
    expect(logo).toBeDefined();
    // Idle should be logo-only; implementation details (class names) may change with layout/watermark updates.
    expect(screen.queryByText(/Welcome,/i)).toBeNull();
    expect(screen.queryByText(/Select Language/i)).toBeNull();
  });

  it('shows idle state when no session exists', () => {
    const App = getApp();
    act(() => {
      render(<App />);
    });
    // Should show logo-only idle screen
    const logo = screen.getByAltText('Club Dallas');
    expect(logo).toBeDefined();
    // Should not show customer info
    expect(screen.queryByText(/Membership/i)).toBeNull();
    expect(screen.queryByText(/Rental/i)).toBeNull();
  });

  it('prompts for lane selection on the default URL', () => {
    const App = getApp();
    window.history.replaceState({}, '', '/');
    sessionStorage.removeItem('lane');
    act(() => {
      render(<App />);
    });
    expect(screen.getByText('Select Lane')).toBeDefined();
    expect(screen.getByText('Lane 1')).toBeDefined();
    expect(screen.getByText('Lane 2')).toBeDefined();
  });
});
