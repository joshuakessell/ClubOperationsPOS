import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppLayout from '../layout/AppLayout';

function renderLayout(activeTab: string = 'scan', onNavigate = vi.fn()) {
  return {
    onNavigate,
    ...render(
      <AppLayout activeTab={activeTab as never} onNavigate={onNavigate}>
        <div data-testid="content">Content for {activeTab}</div>
      </AppLayout>
    ),
  };
}

describe('AppLayout', () => {
  it('renders the sidebar with all 10 nav items', () => {
    renderLayout();
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

  it('renders the header', () => {
    renderLayout();
    expect(screen.getByText('Employee Register')).toBeInTheDocument();
  });

  it('renders content children', () => {
    renderLayout('inventory');
    expect(screen.getByTestId('content')).toHaveTextContent('Content for inventory');
  });

  it('highlights the active tab in the sidebar', () => {
    renderLayout('upgrades');
    const buttons = screen.getAllByRole('button');
    const upgradesBtn = buttons.find((b) => b.textContent?.includes('Upgrades'));
    expect(upgradesBtn?.className).toContain('menu-item-active');
  });

  it('calls onNavigate when a sidebar item is clicked', () => {
    const { onNavigate } = renderLayout();
    const buttons = screen.getAllByRole('button');
    const retailBtn = buttons.find((b) => b.textContent?.includes('Retail'));
    fireEvent.click(retailBtn!);
    expect(onNavigate).toHaveBeenCalledWith('retail');
  });
});
