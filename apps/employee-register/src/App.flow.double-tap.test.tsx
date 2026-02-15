import { describe, it, expect, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CLUBOPS_STORAGE_KEYS } from '@club-ops/shared';
import {
  buildRealtimeAuthResponse,
  setupRegisterAppTest,
} from './test-utils/registerAppTestUtils';

const { getApp } = setupRegisterAppTest();

describe('App flow: double tap proposal', () => {
  it('double tap on same proposal forces selection (to payment)', { timeout: 15000 }, async () => {
    const App = getApp();

    localStorage.setItem(
      CLUBOPS_STORAGE_KEYS.staffSession,
      JSON.stringify({
        staffId: 'staff-1',
        sessionToken: 'test-token',
        name: 'Test User',
        role: 'STAFF',
      })
    );

    const fetchMock = global.fetch as Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;
    let proposedRental: string | null = null;

    fetchMock.mockImplementation((url: RequestInfo | URL, _init?: RequestInit) => {
      const u =
        typeof url === 'string'
          ? url
          : url instanceof URL
            ? url.toString()
            : url instanceof Request
              ? url.url
              : '';

      if (u.includes('/v1/realtime/auth')) {
        return Promise.resolve(buildRealtimeAuthResponse(_init));
      }

      if (u.includes('/v1/registers/status')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              signedIn: true,
              employee: { id: 'emp-1', name: 'Test Employee' },
              registerNumber: 1,
            }),
        } as unknown as Response);
      }

      if (u.includes('/v1/customers/search')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              suggestions: [
                {
                  id: 'c0ffee00-0000-4000-8000-000000000001',
                  name: 'Alex Rivera',
                  firstName: 'Alex',
                  lastName: 'Rivera',
                  dobMonthDay: '03/14',
                  membershipNumber: '700001',
                  disambiguator: '0001',
                },
              ],
            }),
        } as unknown as Response);
      }

      if (u.includes('/v1/checkin/lane/lane-1/start')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              customerName: 'Alex Rivera',
              membershipNumber: '700001',
            }),
        } as unknown as Response);
      }

      if (u.includes('/v1/checkin/lane/lane-1/session-snapshot')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              session: {
                sessionId: 'session-123',
                customerName: 'Alex Rivera',
                membershipNumber: '700001',
                allowedRentals: ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'],
                customerPrimaryLanguage: 'EN',
                membershipChoice: 'ONE_TIME',
                selectionConfirmed: false,
                proposedRentalType: proposedRental ?? undefined,
                proposedBy: proposedRental ? 'EMPLOYEE' : undefined,
              },
            }),
        } as unknown as Response);
      }

      if (u.includes('/v1/checkin/lane/lane-1/propose-selection')) {
        proposedRental = 'LOCKER';
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as unknown as Response);
      }

      if (u.includes('/v1/checkin/lane/lane-1/confirm-selection')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              rentalType: 'STANDARD',
              confirmedBy: 'EMPLOYEE',
            }),
        } as unknown as Response);
      }

      if (u.includes('/v1/checkin/lane/lane-1/create-payment-intent')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              paymentIntentId: 'pi-123',
              quote: { total: 10, lineItems: [], messages: [] },
            }),
        } as unknown as Response);
      }

      if (u.includes('/v1/inventory/available')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              rooms: { STANDARD: 5, DOUBLE: 3, SPECIAL: 1 },
              rawRooms: { STANDARD: 5, DOUBLE: 3, SPECIAL: 1 },
              waitlistDemand: { STANDARD: 0, DOUBLE: 0, SPECIAL: 0 },
              lockers: 10,
            }),
        } as unknown as Response);
      }

      if (u.includes('/health')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 }),
        } as unknown as Response);
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response);
    });

    act(() => {
      render(<App />);
    });

    // Switch to Search.
    const searchTab = await screen.findByRole('button', { name: 'Search Customer' });
    act(() => {
      fireEvent.click(searchTab);
    });
    const searchInput = await screen.findByPlaceholderText('Start typing name...');
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'Ale' } });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    const suggestion = await screen.findByText(/Rivera, Alex/);
    act(() => {
      fireEvent.click(suggestion);
    });
    await waitFor(() => {
      // After check-in, activeTab='guided' shows EmployeeAssistPanel (not CustomerProfileCard).
      // The header label 'Rivera, Alex' persists; 'Alex Rivera' only appears in the profile card.
      expect(screen.queryAllByText(/Rivera, Alex/).length).toBeGreaterThan(0);
    });

    // The app auto-switches to guided tab when a session becomes active.
    await waitFor(() => {
      expect(screen.getByText('Customer Profile')).toBeDefined();
    });

    // Wait for the polling fallback to deliver session-snapshot data (with prerequisites
    // already resolved: language + membership choice). The poll fires on hydration when
    // currentSessionId changes, then every 2s while realtime is disconnected.
    // The session-snapshot mock returns allowedRentals + language + membership, which
    // advances the guided flow to the RENTAL step.
    const proposeLocker = await screen.findByRole('button', { name: /Propose Locker/i }, { timeout: 5000 });
    act(() => {
      fireEvent.click(proposeLocker); // first tap highlights
    });

    // The propose-selection call sets proposedRental='LOCKER'. The next poll cycle
    // picks up the updated session-snapshot (with proposedRentalType + proposedBy).
    // Wait for the UI to reflect the proposal via polling.
    await waitFor(() => {
      expect(proposeLocker).toHaveProperty('disabled', false);
    }, { timeout: 5000 });

    act(() => {
      fireEvent.click(proposeLocker); // second tap confirms selection
    });

    // Confirmation triggers /confirm-selection and then payment intent creation.
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => {
        const arg = c[0];
        if (typeof arg === 'string') return arg;
        if (arg instanceof URL) return arg.toString();
        if (arg instanceof Request) return arg.url;
        return '';
      });
      expect(urls.some((u) => u.includes('/v1/checkin/lane/lane-1/confirm-selection'))).toBe(true);
      expect(urls.some((u) => u.includes('/v1/checkin/lane/lane-1/create-payment-intent'))).toBe(
        true
      );
    });
  });
});
