import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { buildRealtimeAuthResponse, setupRegisterAppTest } from './test-utils/registerAppTestUtils';

const { getApp } = setupRegisterAppTest();

describe('App flow: already checked in', () => {
  it('Customer Account: if customer is already checked in, shows inline status (no modal)', async () => {
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

    expect(await screen.findByText('Currently Checked In')).toBeDefined();
    expect(screen.queryByText('Already Checked In')).toBeNull();
    expect(screen.queryByText('Customer Profile')).toBeNull();
  });
});
