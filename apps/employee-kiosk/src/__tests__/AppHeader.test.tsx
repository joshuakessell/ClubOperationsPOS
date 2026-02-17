import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarProvider } from '../context/SidebarContext';
import AppHeader from '../layout/AppHeader';

function renderHeader() {
  return render(
    <MemoryRouter>
      <SidebarProvider>
        <AppHeader />
      </SidebarProvider>
    </MemoryRouter>
  );
}

describe('AppHeader', () => {
  it('renders the sidebar toggle button', () => {
    renderHeader();
    expect(screen.getByLabelText('Toggle Sidebar')).toBeInTheDocument();
  });

  it('renders the mobile logo text', () => {
    renderHeader();
    expect(screen.getByText('Employee Kiosk')).toBeInTheDocument();
  });

  it('applies dark mode header styles (bg-gray-900)', () => {
    const { container } = renderHeader();
    const header = container.querySelector('header');
    expect(header).toBeDefined();
    expect(header?.className).toContain('bg-gray-900');
  });

  it('uses compact padding (px-3 py-2)', () => {
    const { container } = renderHeader();
    const headerInner = container.querySelector('header > div');
    expect(headerInner?.className).toContain('px-3');
    expect(headerInner?.className).toContain('py-2');
  });

  it('does not render a theme toggle button (permanent dark mode)', () => {
    renderHeader();
    // ThemeToggleButton was removed — no toggle should exist
    const toggleButtons = screen.queryAllByRole('button');
    const themeButtons = toggleButtons.filter((btn) =>
      btn.textContent?.includes('Theme') || btn.getAttribute('aria-label')?.includes('Theme')
    );
    expect(themeButtons).toHaveLength(0);
  });
});
