import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthGateProvider } from '../context/AuthGateContext';
import AppHeader from '../layout/AppHeader';

function renderHeader() {
  return render(
    <AuthGateProvider>
      <AppHeader />
    </AuthGateProvider>
  );
}

describe('AppHeader', () => {
  it('renders the register title text', () => {
    renderHeader();
    expect(screen.getByText('Employee Register')).toBeInTheDocument();
  });

  it('applies dark mode header styles (bg-gray-900)', () => {
    const { container } = renderHeader();
    const header = container.querySelector('header');
    expect(header).toBeDefined();
    expect(header?.className).toContain('bg-gray-900');
  });

  it('uses proper padding (px-4 py-2.5)', () => {
    const { container } = renderHeader();
    const header = container.querySelector('header');
    expect(header?.className).toContain('px-4');
    expect(header?.className).toContain('py-2.5');
  });

  it('does not render session info when not authenticated', () => {
    renderHeader();
    // When no sessionInfo is set, no sign-out / close-out buttons appear
    expect(screen.queryByText('Sign Out')).toBeNull();
    expect(screen.queryByText('Close Out')).toBeNull();
  });
});
