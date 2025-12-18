import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the dashboard header', () => {
    render(<App />);
    expect(screen.getByText('Office Dashboard')).toBeDefined();
  });

  it('shows navigation items', () => {
    render(<App />);
    // Use getAllByText for elements that may appear multiple times
    expect(screen.getAllByText(/Rooms/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lockers/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Staff/).length).toBeGreaterThan(0);
  });

  it('shows override button', () => {
    render(<App />);
    expect(screen.getByText(/Override Mode/)).toBeDefined();
  });
});

