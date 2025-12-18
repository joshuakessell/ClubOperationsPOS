import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the kiosk header', () => {
    render(<App />);
    expect(screen.getByText('Customer Kiosk')).toBeDefined();
  });

  it('shows check-in section', () => {
    render(<App />);
    expect(screen.getByText('Check-In')).toBeDefined();
  });
});

