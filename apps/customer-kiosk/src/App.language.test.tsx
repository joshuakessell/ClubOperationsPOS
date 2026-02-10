import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  setupKioskAppTest,
  emitRealtimeEvent,
  buildRealtimeAuthResponse,
} from './test-utils/kioskAppTestUtils';

const { getApp } = setupKioskAppTest();

describe('App language flow', () => {
  it('persists language: after set-language, reload does not show language prompt again', async () => {
    const App = getApp();
    let mockSessionSnapshot: unknown = null;
    // Make set-language succeed
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
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 }),
        } as unknown as Response);
      }
      if (u.includes('/v1/inventory/available')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              rooms: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
              rawRooms: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
              waitlistDemand: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
              lockers: 0,
              total: 0,
            }),
        } as unknown as Response);
      }
      if (u.includes('/v1/checkin/lane/') && u.includes('/set-language')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as unknown as Response);
      }
      if (u.includes('/v1/checkin/lane/') && u.includes('/session-snapshot')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ session: mockSessionSnapshot }),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response);
    });

    const { unmount } = render(<App />);

    // Initial session with no language set should show language prompt.
    await act(async () => {
      const payload = {
        sessionId: 'session-1',
        customerName: 'Test Customer',
        membershipNumber: null,
        allowedRentals: ['LOCKER'],
        pastDueBlocked: false,
        // customerPrimaryLanguage intentionally omitted
      };
      mockSessionSnapshot = payload;
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload,
      });
    });

    expect(await screen.findByText(/select language/i)).toBeDefined();

    // Select English.
    const englishBtn = await screen.findByText(/english/i);
    act(() => {
      (englishBtn as HTMLButtonElement).click();
    });

    // Server broadcasts updated session with language set; kiosk should not show language prompt.
    await act(async () => {
      const payload = {
        sessionId: 'session-1',
        customerName: 'Test Customer',
        membershipNumber: null,
        allowedRentals: ['LOCKER'],
        pastDueBlocked: false,
        customerPrimaryLanguage: 'EN',
      };
      mockSessionSnapshot = payload;
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload,
      });
    });

    expect(screen.queryByText(/select language/i)).toBeNull();

    // "Reload": unmount + remount. When the same customer/session arrives with language already set,
    // the language prompt must not reappear.
    unmount();
    act(() => {
      render(<App />);
    });
    await act(async () => {
      const payload = {
        sessionId: 'session-1',
        customerName: 'Test Customer',
        membershipNumber: null,
        allowedRentals: ['LOCKER'],
        pastDueBlocked: false,
        customerPrimaryLanguage: 'EN',
      };
      mockSessionSnapshot = payload;
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload,
      });
    });

    expect(screen.queryByText(/select language/i)).toBeNull();
  });

  it('shows language prompt even when customer is past-due blocked (so messaging can be localized)', async () => {
    const App = getApp();
    let mockSessionSnapshot: unknown = null;
    // Make set-language succeed
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
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 }),
        } as unknown as Response);
      }
      if (u.includes('/v1/inventory/available')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              rooms: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
              rawRooms: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
              waitlistDemand: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
              lockers: 0,
              total: 0,
            }),
        } as unknown as Response);
      }
      if (u.includes('/v1/checkin/lane/') && u.includes('/set-language')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as unknown as Response);
      }
      if (u.includes('/v1/checkin/lane/') && u.includes('/session-snapshot')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ session: mockSessionSnapshot }),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response);
    });

    render(<App />);

    // Past-due blocked session with no language set should still show language prompt.
    await act(async () => {
      const payload = {
        sessionId: 'session-1',
        customerName: 'Test Customer',
        membershipNumber: null,
        allowedRentals: ['LOCKER'],
        pastDueBlocked: true,
        pastDueBalance: 12.34,
        // customerPrimaryLanguage intentionally omitted
      };
      mockSessionSnapshot = payload;
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload,
      });
    });

    expect(await screen.findByText(/select language/i)).toBeDefined();

    // Select English.
    const englishBtn = await screen.findByText(/english/i);
    act(() => {
      (englishBtn as HTMLButtonElement).click();
    });

    // After language is set, we should transition to selection view (still blocked) and show the localized message.
    await act(async () => {
      const payload = {
        sessionId: 'session-1',
        customerName: 'Test Customer',
        membershipNumber: null,
        allowedRentals: ['LOCKER'],
        pastDueBlocked: true,
        pastDueBalance: 12.34,
        customerPrimaryLanguage: 'EN',
      };
      mockSessionSnapshot = payload;
      await emitRealtimeEvent({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload,
      });
    });

    expect(screen.queryByText(/select language/i)).toBeNull();
    expect(await screen.findByText(/please see the front desk/i)).toBeDefined();
  });
});
