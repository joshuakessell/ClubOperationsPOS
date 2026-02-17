import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarProvider } from '../context/SidebarContext';
import AppSidebar from '../layout/AppSidebar';

// In JSDOM, window.innerWidth is 0 (< 1280), so the sidebar starts collapsed:
// text labels are hidden, width is 72px. We test the collapsed state by default,
// and test expanded state by mocking a wider viewport.

function renderSidebar(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>
  );
}

function renderExpandedSidebar(initialRoute = '/') {
  // Mock the viewport to be >= 1280px so the sidebar initialises as expanded
  Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
  window.dispatchEvent(new Event('resize'));
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>
  );
}

describe('AppSidebar', () => {
  beforeEach(() => {
    // Reset viewport to default JSDOM (0px)
    Object.defineProperty(window, 'innerWidth', { value: 0, writable: true });
  });

  it('renders all navigation links by href', () => {
    renderSidebar();
    const links = document.querySelectorAll('a[href]');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/search');
    expect(hrefs).toContain('/inventory');
    expect(hrefs).toContain('/settings');
  });

  it('renders the app title when expanded', () => {
    renderExpandedSidebar();
    expect(screen.getByText('Employee Kiosk')).toBeInTheDocument();
  });

  it('renders the "Menu" section header when expanded', () => {
    renderExpandedSidebar();
    expect(screen.getByText('Menu')).toBeInTheDocument();
  });

  it('renders nav text labels when expanded', () => {
    renderExpandedSidebar();
    expect(screen.getByText('Check-In')).toBeInTheDocument();
    expect(screen.getByText('Customer Search')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks the correct link as active based on route', () => {
    renderExpandedSidebar('/search');
    const searchLink = screen.getByRole('link', { name: /Customer Search/i });
    expect(searchLink.className).toContain('menu-item-active');

    const checkInLink = screen.getByRole('link', { name: /Check-In/i });
    expect(checkInLink.className).toContain('menu-item-inactive');
  });

  it('applies dark mode sidebar styles (bg-gray-900)', () => {
    const { container } = renderSidebar();
    const aside = container.querySelector('aside');
    expect(aside).toBeDefined();
    expect(aside?.className).toContain('bg-gray-900');
  });

  it('uses collapsed width of 72px when not expanded (JSDOM default)', () => {
    const { container } = renderSidebar();
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('w-[72px]');
  });
});
