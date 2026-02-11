import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CLUBOPS_STORAGE_KEYS } from '@club-ops/shared';
import { buildRealtimeAuthResponse, setupRegisterAppTest } from './test-utils/registerAppTestUtils';

const { getApp } = setupRegisterAppTest();

describe('App flow: already checked in', () => {
  it('Customer Account: if customer is already checked in, shows inline status (no modal)', async () => {
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

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: RequestInfo | URL, init?: RequestInit) => {
        const u =
          typeof url === 'string'
            ? url
            : url instanceof URL
              ? url.toString()
              : url instanceof Request
                ? url.url
                : '';

        if (u.includes('/v1/realtime/auth')) {
          return Promise.resolve(buildRealtimeAuthResponse(init));
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
          expect(init?.method).toBe('POST');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                code: 'ALREADY_CHECKED_IN',
                alreadyCheckedIn: true,
                activeCheckin: {
                  visitId: 'visit-1',
                  rentalType: 'LOCKER',
                  assignedResourceType: 'locker',
                  assignedResourceNumber: '012',
                  checkinAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                  checkoutAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
                  overdue: false,
                  waitlist: null,
                },
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

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as unknown as Response);
      }
    );

    act(() => {
      render(<App />);
    });

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

    expect(await screen.findByText('Customer Profile')).toBeDefined();

    // Search opens the account in "manual start" mode.
    const startCheckinButton = await screen.findByRole('button', { name: 'Start Checkin' });
    act(() => {
      fireEvent.click(startCheckinButton);
    });

    expect(await screen.findByText('Currently Checked In')).toBeDefined();
    expect(screen.queryByText('Already Checked In')).toBeNull();
    expect(screen.queryByText('Customer Profile')).toBeNull();
  });

  it('shows selected customer account immediately after search selection', async () => {
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

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: RequestInfo | URL, init?: RequestInit) => {
        const u =
          typeof url === 'string'
            ? url
            : url instanceof URL
              ? url.toString()
              : url instanceof Request
                ? url.url
                : '';

        if (u.includes('/v1/realtime/auth')) {
          return Promise.resolve(buildRealtimeAuthResponse(init));
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

        if (u.includes('/v1/customers/c0ffee00-0000-4000-8000-000000000001')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                customer: {
                  id: 'c0ffee00-0000-4000-8000-000000000001',
                  name: 'Alex Rivera',
                  dob: '2000-03-14',
                  dobMonthDay: '03/14',
                  membershipNumber: '700001',
                },
              }),
          } as unknown as Response);
        }

        if (u.includes('/v1/checkin/lane/lane-1/start')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ sessionId: 'sess-1', customerName: 'Alex Rivera' }),
          } as unknown as Response);
        }

        if (u.includes('/v1/checkin/lane/lane-1/session-snapshot')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ session: null }),
          } as unknown as Response);
        }

        if (u.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 }),
          } as unknown as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as unknown as Response);
      }
    );

    act(() => {
      render(<App />);
    });

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

    expect(await screen.findByText('Alex Rivera')).toBeDefined();
    expect(screen.queryByText('Waiting for lane session…')).toBeNull();
  });

  it('allows switching room/locker and handles payment-required follow-up', async () => {
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

    const switchRequestBodies: Array<Record<string, unknown>> = [];
    let switchCallCount = 0;

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: RequestInfo | URL, init?: RequestInit) => {
        const u =
          typeof url === 'string'
            ? url
            : url instanceof URL
              ? url.toString()
              : url instanceof Request
                ? url.url
                : '';

        if (u.includes('/v1/realtime/auth')) {
          return Promise.resolve(buildRealtimeAuthResponse(init));
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
            status: 200,
            json: () =>
              Promise.resolve({
                code: 'ALREADY_CHECKED_IN',
                alreadyCheckedIn: true,
                activeCheckin: {
                  visitId: 'visit-1',
                  rentalType: 'LOCKER',
                  assignedResourceType: 'locker',
                  assignedResourceNumber: '012',
                  checkinAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                  checkoutAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
                  overdue: false,
                  waitlist: null,
                },
              }),
          } as unknown as Response);
        }

        if (u.includes('/v1/inventory/detailed')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                rooms: [
                  { id: 'room-special-1', number: '201', status: 'CLEAN' },
                  { id: 'room-standard-1', number: '200', status: 'CLEAN' },
                ],
                lockers: [{ id: 'locker-1', number: '001', status: 'CLEAN' }],
              }),
          } as unknown as Response);
        }

        if (u.includes('/v1/checkin/visits/visit-1/switch-resource')) {
          switchCallCount += 1;
          const parsedBody = (() => {
            const raw = init?.body;
            if (typeof raw === 'string') return JSON.parse(raw) as Record<string, unknown>;
            return {} as Record<string, unknown>;
          })();
          switchRequestBodies.push(parsedBody);

          if (switchCallCount === 1) {
            return Promise.resolve({
              ok: false,
              status: 409,
              json: () => Promise.resolve({ code: 'PAYMENT_REQUIRED', additionalFee: 19 }),
            } as unknown as Response);
          }

          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, additionalFee: 19 }),
          } as unknown as Response);
        }

        if (u.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 }),
          } as unknown as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as unknown as Response);
      }
    );

    act(() => {
      render(<App />);
    });

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

    const startCheckinButton = await screen.findByRole('button', { name: 'Start Checkin' });
    act(() => {
      fireEvent.click(startCheckinButton);
    });

    const switchButton = await screen.findByRole('button', { name: 'Switch Room/Locker' });
    act(() => {
      fireEvent.click(switchButton);
    });

    expect(await screen.findByText('Switch Room / Locker')).toBeDefined();

    const submitSwitchButton = await screen.findByRole('button', { name: /Switch to Room/i });
    act(() => {
      fireEvent.click(submitSwitchButton);
    });

    expect(await screen.findByText('$19.00')).toBeDefined();

    const cashSuccessButtons = await screen.findAllByRole('button', { name: 'Cash Success' });
    const primaryCashSuccess = cashSuccessButtons.find(
      (button) => button.getAttribute('data-choice') === 'CASH_SUCCESS'
    );
    expect(primaryCashSuccess).toBeDefined();
    act(() => {
      fireEvent.click(primaryCashSuccess!);
    });

    await waitFor(() => {
      expect(switchCallCount).toBe(2);
    });

    expect(switchRequestBodies[0]?.paymentOutcome).toBeUndefined();
    expect(switchRequestBodies[1]?.paymentOutcome).toBe('CASH_SUCCESS');
  });
});
