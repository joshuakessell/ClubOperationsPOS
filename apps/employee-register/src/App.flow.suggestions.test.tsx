import { describe, it, expect, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CLUBOPS_STORAGE_KEYS } from '@club-ops/shared';
import { buildRealtimeAuthResponse, setupRegisterAppTest } from './test-utils/registerAppTestUtils';

const { getApp } = setupRegisterAppTest();

describe('App flow: suggestions', () => {
  it('shows customer suggestions at 3+ characters and confirm triggers session', async () => {
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

    (global.fetch as Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>).mockImplementation(
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
            json: () =>
              Promise.resolve({
                sessionId: 'session-123',
                customerName: 'Alex Rivera',
                membershipNumber: '700001',
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

    // Allow debounced search to fire
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
  });
});
