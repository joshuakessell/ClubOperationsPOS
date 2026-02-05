import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { buildRealtimeAuthResponse, setupRegisterAppTest } from './test-utils/registerAppTestUtils';

const { getApp } = setupRegisterAppTest();

describe('App flow: first time customer', () => {
  it('First Time Customer: if identity matches an existing customer, prompts and allows loading existing customer', async () => {
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

    const calls: Array<{ url: string; body?: unknown }> = [];
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

        let body: unknown = undefined;
        if (typeof init?.body === 'string') {
          body = JSON.parse(init.body) as unknown;
        }
        calls.push({ url: u, body });

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
        if (u.includes('/health')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 }),
          } as unknown as Response);
        }
        if (u.includes('/v1/customers/match-identity')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                matchCount: 1,
                bestMatch: {
                  id: 'cust-1',
                  name: 'John Smith',
                  dob: '1988-01-02',
                  membershipNumber: null,
                },
              }),
          } as unknown as Response);
        }
        if (u.includes('/v1/checkin/lane/lane-1/start')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionId: 'sess-1',
                customerName: 'John Smith',
                membershipNumber: null,
              }),
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

    // Open manual entry
    const manualEntryTab = await screen.findByRole('button', { name: /Manual Entry/i });
    fireEvent.click(manualEntryTab);
    expect(await screen.findByText(/First Time Customer/i)).toBeDefined();

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: '01021988' } });
    fireEvent.change(screen.getByLabelText(/ID Expiration Date/i), {
      target: { value: '01012030' },
    });
    fireEvent.change(screen.getByLabelText(/ID Type/i), {
      target: { value: 'DRIVERS_LICENSE' },
    });

    const addBtn = screen.getByRole('button', { name: /Add Customer/i });
    expect(addBtn).toHaveProperty('disabled', false);

    fireEvent.click(addBtn);

    // Prompt appears
    expect(await screen.findByRole('heading', { name: /Existing customer found/i })).toBeDefined();
    expect(screen.getByText(/John Smith/i)).toBeDefined();

    // Choose existing customer
    fireEvent.click(screen.getByRole('button', { name: /Existing Customer/i }));

    await waitFor(() => {
      const startCall = calls.find((c) => c.url.includes('/v1/checkin/lane/lane-1/start'));
      expect(startCall).toBeDefined();
      const b = startCall?.body;
      expect(b).toBeDefined();
      if (!b || typeof b !== 'object' || !('customerId' in b)) {
        throw new Error('Expected start call body to include customerId');
      }
      expect((b as { customerId?: unknown }).customerId).toBe('cust-1');
    });
  });
});
