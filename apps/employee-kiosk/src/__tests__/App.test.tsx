import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import CheckInPage from '../pages/CheckInPage';
import CustomerSearchPage from '../pages/CustomerSearchPage';
import InventoryPage from '../pages/InventoryPage';
import SettingsPage from '../pages/SettingsPage';

// In JSDOM, window.innerWidth is 0 (< 1280). Sidebar is collapsed, text is hidden.
// We test the expanded state by mocking a wider viewport.

function renderWithRouter(initialRoute = '/', expanded = true) {
  if (expanded) {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
    window.dispatchEvent(new Event('resize'));
  }
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index path="/" element={<CheckInPage />} />
          <Route path="/search" element={<CustomerSearchPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('App routing', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 0, writable: true });
  });

  it('renders the header with sidebar toggle button', () => {
    renderWithRouter('/');
    expect(screen.getByLabelText('Toggle Sidebar')).toBeInTheDocument();
  });

  it('renders sidebar navigation links', () => {
    renderWithRouter('/');
    const links = document.querySelectorAll('a[href]');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/search');
    expect(hrefs).toContain('/inventory');
    expect(hrefs).toContain('/settings');
  });

  it('renders the sidebar logo text', () => {
    renderWithRouter('/');
    const logos = screen.getAllByText('Employee Kiosk');
    expect(logos.length).toBeGreaterThan(0);
  });

  it('renders sidebar nav item text when expanded', () => {
    renderWithRouter('/');
    expect(screen.getByText('Check-In')).toBeInTheDocument();
    expect(screen.getByText('Customer Search')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('highlights the active navigation item', () => {
    renderWithRouter('/inventory');
    const inventoryLinks = screen.getAllByRole('link', { name: /Inventory/i });
    const sidebarLink = inventoryLinks.find((link) =>
      link.classList.contains('menu-item')
    );
    expect(sidebarLink).toBeDefined();
    if (sidebarLink) {
      expect(sidebarLink.className).toContain('menu-item-active');
    }
  });

  it('does not highlight non-active navigation items', () => {
    renderWithRouter('/');
    const inventoryLinks = screen.getAllByRole('link', { name: /Inventory/i });
    const sidebarLink = inventoryLinks.find((link) =>
      link.classList.contains('menu-item')
    );
    expect(sidebarLink).toBeDefined();
    if (sidebarLink) {
      expect(sidebarLink.className).toContain('menu-item-inactive');
    }
  });
});
