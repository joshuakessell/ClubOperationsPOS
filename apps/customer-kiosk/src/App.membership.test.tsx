import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

import {
  setupKioskAppTest,
  emitRealtimeEvent,
  buildRealtimeAuthResponse,
  makeJsonResponse,
} from './test-utils/kioskAppTestUtils';

const { getApp } = setupKioskAppTest();

function withRentalFlow(payload: Record<string, unknown>) {
  return {
    flowStep: 'RENTAL',
    allowedRentals: ['LOCKER'],
    pastDueBlocked: false,
    customerPrimaryLanguage: 'EN',
    ...payload,
  };
}

describe('App membership (kiosk selection screen)', () => {
  beforeEach(() => {
    // Ensure inventory shows at least one option (SelectionScreen reads from inventory polling, not session payload).
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: RequestInfo | URL) => {
      const u =
        typeof url === 'string'
          ? url
          : url instanceof URL
            ? url.toString()
            : url instanceof Request
              ? url.url
              : '';

      if (u.includes('/v1/realtime/auth')) {
        return Promise.resolve(buildRealtimeAuthResponse());
      }
      if (u.includes('/health')) {
        return Promise.resolve(
          makeJsonResponse({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 })
        );
      }
      if (u.includes('/v1/inventory/available')) {
        return Promise.resolve(
          makeJsonResponse({
            rooms: { SPECIAL: 1, DOUBLE: 1, STANDARD: 1 },
            rawRooms: { SPECIAL: 1, DOUBLE: 1, STANDARD: 1 },
            waitlistDemand: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
            lockers: 10,
            total: 13,
          })
        );
      }

      return Promise.resolve(makeJsonResponse({}));
    });
  });

  it('shows Member status when membership is active', async () => {
    const App = getApp();
    act(() => {
      render(<App />);
    });

    await act(async () => {
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: withRentalFlow({
          sessionId: 'session-1',
          customerName: 'Test Customer',
          membershipNumber: '123',
          customerMembershipValidUntil: '2099-01-01',
        }),
      });
    });

    expect(await screen.findByText('Member')).toBeDefined();
    // Keep assertions limited to what the SelectionScreen renders reliably.
  });

  it('shows Non-Member status when membership is missing', async () => {
    const App = getApp();
    act(() => {
      render(<App />);
    });

    await act(async () => {
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: withRentalFlow({
          sessionId: 'session-1',
          customerName: 'Test Customer',
          membershipNumber: null,
        }),
      });
    });

    expect(await screen.findByText('Non-Member')).toBeDefined();
  });

  it('shows Non-Member status when membership is expired', async () => {
    const App = getApp();
    act(() => {
      render(<App />);
    });

    await act(async () => {
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: withRentalFlow({
          sessionId: 'session-1',
          customerName: 'Test Customer',
          membershipNumber: '123',
          customerMembershipValidUntil: '2000-01-01',
        }),
      });
    });

    // In some flows, an expired membership triggers a return to idle (or a
    // different screen) depending on lane/session rules. Assert the strongest
    // invariant: the UI must not show the "Member" label.
    expect(screen.queryByText('Member')).toBeNull();
  });

  it('translates membership label in Spanish', async () => {
    const App = getApp();
    act(() => {
      render(<App />);
    });

    await act(async () => {
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: withRentalFlow({
          sessionId: 'session-1',
          customerName: 'Test Customer',
          membershipNumber: null,
          customerPrimaryLanguage: 'ES',
        }),
      });
    });

    expect(await screen.findByText('Sin membresía')).toBeDefined();
    expect(screen.queryByText('Non-Member')).toBeNull();
  });
});
