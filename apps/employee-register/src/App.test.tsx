import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the register header', () => {
    render(<App />);
    expect(screen.getByText('Employee Register')).toBeDefined();
  });

  it('shows room inventory section', () => {
    render(<App />);
    expect(screen.getByText('Room Inventory')).toBeDefined();
  });

  it('shows quick actions section', () => {
    render(<App />);
    expect(screen.getByText('Quick Actions')).toBeDefined();
  });
});

