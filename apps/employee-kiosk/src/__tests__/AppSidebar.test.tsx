import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppSidebar from '../layout/AppSidebar';

function renderSidebar(activeTab: string = 'scan', onNavigate = vi.fn()) {
  return {
    onNavigate,
    ...render(<AppSidebar activeTab={activeTab as never} onNavigate={onNavigate} />),
  };
}

describe('AppSidebar', () => {
  it('renders the app title', () => {
    renderSidebar();
    expect(screen.getByText('Employee Kiosk')).toBeInTheDocument();
  });

  it('renders the "Menu" section header', () => {
    renderSidebar();
    expect(screen.getByText('Menu')).toBeInTheDocument();
  });

  it('renders all 10 navigation items', () => {
    renderSidebar();
    expect(screen.getByText('Scan')).toBeInTheDocument();
    expect(screen.getByText('Search Customer')).toBeInTheDocument();
    expect(screen.getByText('Rentals')).toBeInTheDocument();
    expect(screen.getByText('Upgrades')).toBeInTheDocument();
    expect(screen.getByText('Retail')).toBeInTheDocument();
    expect(screen.getByText('Checkout')).toBeInTheDocument();
    expect(screen.getByText('Customer Account')).toBeInTheDocument();
    expect(screen.getByText('Club Log')).toBeInTheDocument();
    expect(screen.getByText('Manual Entry')).toBeInTheDocument();
    expect(screen.getByText('Room Cleaning')).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    renderSidebar('inventory');
    const buttons = screen.getAllByRole('button');
    const rentalsBtn = buttons.find((b) => b.textContent?.includes('Rentals'));
    expect(rentalsBtn?.className).toContain('menu-item-active');

    const scanBtn = buttons.find((b) => b.textContent?.includes('Scan'));
    expect(scanBtn?.className).toContain('menu-item-inactive');
  });

  it('calls onNavigate when a nav item is clicked', () => {
    const { onNavigate } = renderSidebar();
    const buttons = screen.getAllByRole('button');
    const searchBtn = buttons.find((b) => b.textContent?.includes('Search Customer'));
    fireEvent.click(searchBtn!);
    expect(onNavigate).toHaveBeenCalledWith('search');
  });

  it('applies dark mode sidebar styles (bg-gray-900)', () => {
    const { container } = renderSidebar();
    const aside = container.querySelector('aside');
    expect(aside).toBeDefined();
    expect(aside?.className).toContain('bg-gray-900');
  });

  it('uses fixed width of 240px', () => {
    const { container } = renderSidebar();
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('w-[240px]');
  });

  it('shows F-key shortcuts next to each item', () => {
    renderSidebar();
    expect(screen.getByText('(F1)')).toBeInTheDocument();
    expect(screen.getByText('(F10)')).toBeInTheDocument();
  });
});
