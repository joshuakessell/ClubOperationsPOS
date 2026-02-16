import { describe, it, expect, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { CLUBOPS_STORAGE_KEYS } from '@club-ops/shared';
import { buildRealtimeAuthResponse, setupRegisterAppTest } from './test-utils/registerAppTestUtils';

const { getApp } = setupRegisterAppTest();

describe('App flow: checkout', () => {
  it('checkout from already visiting customer returns to scan and clears account', async () => {
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
    fetchMock.mockImplementation((url: RequestInfo | URL, init?: RequestInit) => {
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

      if (u.includes('/v1/registers/heartbeat')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
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

      if (u.includes('/v1/checkout/manual-resolve')) {
        expect(init?.method).toBe('POST');
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              occupancyId: 'occ-1',
              resourceType: 'LOCKER',
              number: '012',
              customerName: 'Alex Rivera',
              checkinAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
              scheduledCheckoutAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
              lateMinutes: 0,
              fee: 0,
              banApplied: false,
            }),
        } as unknown as Response);
      }

      if (u.includes('/v1/checkout/manual-complete')) {
        expect(init?.method).toBe('POST');
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ alreadyCheckedOut: false }),
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
    });

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

    expect(await screen.findByRole('heading', { name: 'Customer Account' })).toBeDefined();

    const startCheckinButton = await screen.findByRole('button', { name: /Start Checkin/i });
    act(() => {
      fireEvent.click(startCheckinButton);
    });

    const accountPanel = await waitFor(() => {
      const node = document.querySelector('.er-account-already-visiting');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    const checkoutButton = within(accountPanel).getByRole('button', {
      name: 'Checkout',
    });
    act(() => {
      fireEvent.click(checkoutButton);
    });

    const completeButton = await screen.findByRole('button', { name: /Complete checkout/i });
    act(() => {
      fireEvent.click(completeButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Scan Now')).toBeDefined();
    });
    expect(screen.queryByRole('heading', { name: 'Customer Account' })).toBeNull();
    expect(document.querySelector('.er-account-already-visiting')).toBeNull();
  });
});
