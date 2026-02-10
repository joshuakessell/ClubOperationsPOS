import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  buildRealtimeAuthResponse,
  createdSockets,
  emitRealtime,
  setupRegisterAppTest,
  type MockRealtimeSocket,
} from './test-utils/registerAppTestUtils';

const { getApp } = setupRegisterAppTest();

describe('App flow: double tap proposal', () => {
  it('double tap on same proposal forces selection (to payment)', async () => {
    const App = getApp();
    localStorage.setItem(
      'staff_session',
      JSON.stringify({
        staffId: 'staff-1',
        sessionToken: 'test-token',
        name: 'Test User',
        role: 'STAFF',
      })
    );

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
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

    // Home is now the default tab; switch to Search.
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
      expect(screen.queryAllByText(/Alex Rivera/).length).toBeGreaterThan(0);
    });

    // The app auto-switches to Scan tab when a session becomes active.
    await waitFor(() => {
      expect(screen.getByText('Customer Profile')).toBeDefined();
    });

    // Simulate kiosk prerequisites already resolved (language + membership choice) so we land on RENTAL step.
    // React StrictMode can create multiple realtime sockets; use the one that has the handler attached.
    let socketWithHandler: MockRealtimeSocket | null = null;
    await waitFor(() => {
      expect(createdSockets.length).toBeGreaterThan(0);
      socketWithHandler =
        createdSockets.find((w) => w.url.includes('lane=lane-1')) ?? createdSockets[0] ?? null;
      expect(socketWithHandler).not.toBeNull();
    });

    act(() => {
      emitRealtime(socketWithHandler, {
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: 'session-123',
          customerName: 'Alex Rivera',
          allowedRentals: ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'],
          customerPrimaryLanguage: 'EN',
          membershipChoice: 'ONE_TIME',
          selectionConfirmed: false,
        },
      });
    });

    const proposeLocker = await screen.findByRole('button', { name: /Propose Locker/i });
    act(() => {
      fireEvent.click(proposeLocker); // first tap highlights
    });

    // Server snapshot updates with the proposed rental so we can confirm it.
    act(() => {
      emitRealtime(socketWithHandler, {
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: 'session-123',
          customerName: 'Alex Rivera',
          allowedRentals: ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'],
          customerPrimaryLanguage: 'EN',
          membershipChoice: 'ONE_TIME',
          selectionConfirmed: false,
          proposedRentalType: 'LOCKER',
          proposedBy: 'EMPLOYEE',
        },
      });
    });

    await waitFor(() => {
      expect(proposeLocker).toHaveProperty('disabled', false);
    });

    act(() => {
      fireEvent.click(proposeLocker); // second tap confirms selection
    });

    // Confirmation triggers /confirm-selection and then payment intent creation.
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('/v1/checkin/lane/lane-1/confirm-selection'))).toBe(true);
      expect(urls.some((u) => u.includes('/v1/checkin/lane/lane-1/create-payment-intent'))).toBe(
        true
      );
    });
  });
});
