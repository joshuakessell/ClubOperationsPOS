import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { setupKioskAppTest, emitRealtimeEvent } from './test-utils/kioskAppTestUtils';

const { getApp } = setupKioskAppTest();

describe('App payment safety', () => {
  it('never shows a payment decline reason (generic guidance only)', async () => {
    const App = getApp();
    act(() => {
      render(<App />);
    });

    await act(async () => {
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: 'session-1',
          customerName: 'Test Customer',
          membershipNumber: '123',
          allowedRentals: ['LOCKER'],
          customerPrimaryLanguage: 'EN',
          selectionConfirmed: true,
          paymentStatus: 'DUE',
          paymentTotal: 12.34,
          paymentFailureReason: 'CVV mismatch: 123',
        },
      });
    });

    // Payment screen should show total due
    expect(await screen.findByText('$12.34')).toBeDefined();

    // Generic customer-facing message is OK
    expect(screen.getByText(/please see attendant/i)).toBeDefined();

    // Decline reason must never be displayed to customer
    expect(screen.queryByText(/CVV mismatch/i)).toBeNull();
  });
});
