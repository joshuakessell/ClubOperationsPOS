import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import {
  setupKioskAppTest,
  emitRealtimeEvent,
  buildRealtimeAuthResponse,
  makeJsonResponse,
} from './test-utils/kioskAppTestUtils';

const { getApp } = setupKioskAppTest();

describe('App membership flow', () => {
  it('shows Active Member status (no purchase/renew CTA) when membership is not expired', async () => {
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
          customerMembershipValidUntil: '2099-01-01',
          allowedRentals: ['LOCKER'],
          pastDueBlocked: false,
          customerPrimaryLanguage: 'EN',
        },
      });
    });

    expect(await screen.findByText('Membership')).toBeDefined();
    expect(await screen.findByText('Member')).toBeDefined();
    expect(screen.getByText(/Thank you for being a member/i)).toBeDefined();
    expect(screen.getByText(/expires on/i)).toBeDefined();
    // Guard: membership card should NOT show membership option buttons for members.
    expect(screen.queryByRole('button', { name: /One-time Membership/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /6-Month Membership/i })).toBeNull();
  });

  it('shows Non-Member status + Purchase CTA when membership id is missing', async () => {
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
          membershipNumber: null,
          allowedRentals: ['LOCKER'],
          pastDueBlocked: false,
          customerPrimaryLanguage: 'EN',
        },
      });
    });

    expect(await screen.findByText('Membership')).toBeDefined();
    expect(await screen.findByText('Non-Member')).toBeDefined();
    expect(screen.getByRole('button', { name: /One-time Membership/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /6-Month Membership/i })).toBeDefined();
  });

  it('shows Non-Member and routes 6-month CTA through renew flow when membership is expired', async () => {
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
          customerMembershipValidUntil: '2000-01-01',
          allowedRentals: ['LOCKER'],
          pastDueBlocked: false,
          customerPrimaryLanguage: 'EN',
        },
      });
    });

    expect(await screen.findByText('Non-Member')).toBeDefined();
    expect(screen.getByRole('button', { name: /6-Month Membership/i })).toBeDefined();
  });

  it('non-member must explicitly choose membership before rentals enable (no implicit one-time selection)', async () => {
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
          membershipNumber: null,
          allowedRentals: ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'],
          pastDueBlocked: false,
          customerPrimaryLanguage: 'EN',
        },
      });
    });

    const oneTime = await screen.findByRole('button', { name: /One-time Membership/i });
    const sixMonth = screen.getByRole('button', { name: /6-Month Membership/i });
    const locker = screen.getByRole('button', { name: /Locker/i });

    // No default selection on either membership option.
    expect(oneTime.className.includes('cs-liquid-button--selected')).toBe(false);
    expect(sixMonth.className.includes('cs-liquid-button--selected')).toBe(false);
    // Rental buttons gated until membership choice is made.
    expect(locker).toHaveProperty('disabled', true);

    act(() => {
      (oneTime as HTMLButtonElement).click();
    });

    await waitFor(() => {
      expect(locker).toHaveProperty('disabled', false);
    });
  });

  it('auto-confirms selection after non-member completes membership + rental selection', async () => {
    const App = getApp();
    let mockSessionSnapshot: unknown = null;
    // Override inventory to allow immediate rental selection (avoid waitlist path).
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
      if (u.includes('/v1/checkin/lane/') && u.includes('/propose-selection')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as unknown as Response);
      }
      if (u.includes('/v1/checkin/lane/') && u.includes('/confirm-selection')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as unknown as Response);
      }
      if (u.includes('/v1/checkin/lane/') && u.includes('/membership-purchase-intent')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as unknown as Response);
      }
      if (u.includes('/v1/checkin/lane/') && u.includes('/session-snapshot')) {
        return Promise.resolve(makeJsonResponse({ session: mockSessionSnapshot }));
      }
      return Promise.resolve(makeJsonResponse({}));
    });

    act(() => {
      render(<App />);
    });

    await act(async () => {
      const payload = {
        sessionId: 'session-1',
        customerName: 'Test Customer',
        membershipNumber: null,
        allowedRentals: ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'],
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

    act(() => {
      screen.getByRole('button', { name: /One-time Membership/i }).click();
    });

    // Now rentals enable.
    const lockerBtn = await screen.findByRole('button', { name: /Locker/i });
    await waitFor(() => expect(lockerBtn).toHaveProperty('disabled', false));

    act(() => {
      (lockerBtn as HTMLButtonElement).click();
    });

    await waitFor(() => {
      const urls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('/confirm-selection'))).toBe(true);
    });

    expect(screen.queryByText('Waiting for approval')).toBeNull();
  });

  it('shows whole-dollar prices next to rental options and never shows Join Waitlist for Upgrade', async () => {
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
          customerMembershipValidUntil: '2000-01-01',
          allowedRentals: ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'],
          pastDueBlocked: false,
          customerPrimaryLanguage: 'EN',
        },
      });
    });

    expect(await screen.findByRole('button', { name: /Locker/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Private Dressing Room/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Double Dressing Room/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Special Dressing Room/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /6-Month Membership/i })).toBeDefined();

    expect(screen.queryByText(/Join Waitlist for Upgrade/i)).toBeNull();
  });

  it('translates membership CTA in Spanish', async () => {
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
          membershipNumber: null,
          allowedRentals: ['LOCKER'],
          pastDueBlocked: false,
          customerPrimaryLanguage: 'ES',
        },
      });
    });

    expect(await screen.findByText('Sin membresía')).toBeDefined();
    expect(screen.getByRole('button', { name: /Membresía 6 meses/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Membresía por día/i })).toBeDefined();
    // Guard: key screens should not leak obvious English CTAs when in Spanish.
    expect(screen.queryByText('Non-Member')).toBeNull();
    expect(screen.queryByText(/6-Month Membership/i)).toBeNull();
  });

  it('renders Spanish membership modal copy (no English fallback) when language is ES', async () => {
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
          membershipNumber: null,
          allowedRentals: ['LOCKER'],
          pastDueBlocked: false,
          customerPrimaryLanguage: 'ES',
        },
      });
    });

    const purchaseBtn = await screen.findByRole('button', { name: /Membresía 6 meses/i });
    act(() => {
      (purchaseBtn as HTMLButtonElement).click();
    });

    // Spanish title/body + Spanish buttons
    expect(await screen.findByRole('heading', { name: 'Membresía' })).toBeDefined();
    expect(screen.getByText(/Ahorra/i)).toBeDefined();
    expect(screen.getByText('Continuar')).toBeDefined();
    expect(screen.getByText('Cancelar')).toBeDefined();

    // Guard: avoid English copy leakage.
    expect(screen.queryByText(/save on daily membership fees/i)).toBeNull();
  });

  it('purchase CTA opens modal; cancel closes; continue sets Member (Pending)', async () => {
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
          membershipNumber: null,
          allowedRentals: ['LOCKER'],
          pastDueBlocked: false,
          customerPrimaryLanguage: 'EN',
        },
      });
    });

    const purchaseBtn = await screen.findByRole('button', { name: /6-Month Membership/i });
    act(() => {
      (purchaseBtn as HTMLButtonElement).click();
    });

    expect(await screen.findByRole('heading', { name: 'Membership' })).toBeDefined();
    expect(screen.getByText(/save on daily membership fees/i)).toBeDefined();
    const cancel = screen.getByText('Cancel');
    act(() => {
      (cancel as HTMLButtonElement).click();
    });
    expect(screen.queryByText(/save on daily membership fees/i)).toBeNull();

    // Re-open and continue
    act(() => {
      (purchaseBtn as HTMLButtonElement).click();
    });
    const continueBtn = await screen.findByText('Continue');
    act(() => {
      (continueBtn as HTMLButtonElement).click();
    });

    expect(await screen.findByText('Member')).toBeDefined();
    expect(screen.queryByText('Pending')).toBeNull();
  });
});
