import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { CLUBOPS_STORAGE_KEYS } from '@club-ops/shared';
import {
  buildRealtimeAuthResponse,
  createdSockets,
  emitRealtime,
  setupRegisterAppTest,
  type MockRealtimeSocket,
} from './test-utils/registerAppTestUtils';

const { getApp } = setupRegisterAppTest();

let mockSessionSnapshot: unknown = null;

const mockRegisterFetch = () => {
  mockSessionSnapshot = null;
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
      if (u.includes('/v1/checkin/lane/lane-1/session-snapshot')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ session: mockSessionSnapshot }),
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
    }
  );
};

describe('App', () => {
  it('renders lock screen when not authenticated', () => {
    const App = getApp();
    act(() => {
      render(<App />);
    });
    // When not authenticated, LockScreen is shown instead of the main app
    // The LockScreen component should be rendered
    expect(screen.queryByText('Employee Register')).toBeNull();
  });

  it('renders the register header when authenticated', async () => {
    const App = getApp();
    // Mock a signed-in register + staff session
    localStorage.setItem(
      CLUBOPS_STORAGE_KEYS.staffSession,
      JSON.stringify({
        staffId: 'staff-1',
        sessionToken: 'test-token',
        name: 'Test User',
        role: 'STAFF',
      })
    );

    mockRegisterFetch();

    act(() => {
      render(<App />);
    });
    const headers = await screen.findAllByText('Employee Register');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('shows lane session section when authenticated', async () => {
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

    mockRegisterFetch();

    act(() => {
      render(<App />);
    });

    const scanTab = await screen.findByRole('button', { name: 'Scan' });
    act(() => {
      fireEvent.click(scanTab);
    });
    expect(await screen.findByText('Scan Now')).toBeDefined();
  });

  it('updates agreement status when receiving SESSION_UPDATED with agreementSigned=true', async () => {
    const App = getApp();
    const STEP_TIMEOUT_MS = 1000;
    localStorage.setItem(
      CLUBOPS_STORAGE_KEYS.staffSession,
      JSON.stringify({
        staffId: 'staff-1',
        sessionToken: 'test-token',
        name: 'Test User',
        role: 'STAFF',
      })
    );

    mockRegisterFetch();

    act(() => {
      render(<App />);
    });

    const scanTab = await screen.findByRole('button', { name: 'Scan' });
    act(() => {
      fireEvent.click(scanTab);
    });
    expect(
      await screen.findByText('Scan Now', undefined, { timeout: STEP_TIMEOUT_MS })
    ).toBeDefined();

    // Wait until App has attached its onmessage handler, then simulate an agreement-signed update.
    // React StrictMode can create multiple realtime sockets; use the one that has the handler attached.
    let socketWithHandler: MockRealtimeSocket | null = null;
    // Fail fast if no websocket instance was created; retry loops can hang if timers are misbehaving.
    expect(createdSockets.length).toBeGreaterThan(0);
    socketWithHandler =
      createdSockets.find((w) => w.url.includes('lane=lane-1')) ?? createdSockets[0] ?? null;
    expect(socketWithHandler).not.toBeNull();

    act(() => {
      mockSessionSnapshot = {
        sessionId: 'session-123',
        customerName: 'Alex Rivera',
        membershipNumber: '700001',
        allowedRentals: ['LOCKER'],
        agreementSigned: true,
      };
      emitRealtime(socketWithHandler, {
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: 'session-123',
          customerName: 'Alex Rivera',
          membershipNumber: '700001',
          allowedRentals: ['LOCKER'],
          agreementSigned: true,
        },
      });
    });
    expect(
      await screen.findByText('Customer Profile', undefined, { timeout: STEP_TIMEOUT_MS })
    ).toBeDefined();
  });

  it('shows transaction completion modal (with PDF verify + complete) after assignment + agreement signed', async () => {
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

    mockRegisterFetch();

    act(() => {
      render(<App />);
    });

    const scanTab = await screen.findByRole('button', { name: 'Scan' });
    act(() => {
      fireEvent.click(scanTab);
    });
    expect(await screen.findByText('Scan Now')).toBeDefined();

    let socketWithHandler: MockRealtimeSocket | null = null;
    await waitFor(() => {
      expect(createdSockets.length).toBeGreaterThan(0);
      socketWithHandler =
        createdSockets.find((w) => w.url.includes('lane=lane-1')) ?? createdSockets[0] ?? null;
      expect(socketWithHandler).not.toBeNull();
    });

    act(() => {
      const checkoutAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      mockSessionSnapshot = {
        sessionId: 'session-123',
        customerName: 'Alex Rivera',
        agreementSigned: true,
        selectionConfirmed: true,
        paymentStatus: 'PAID',
        assignedResourceType: 'locker',
        assignedResourceNumber: '012',
        checkoutAt,
      };
      emitRealtime(socketWithHandler, {
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: 'session-123',
          customerName: 'Alex Rivera',
          agreementSigned: true,
          selectionConfirmed: true,
          paymentStatus: 'PAID',
          assignedResourceType: 'locker',
          assignedResourceNumber: '012',
          checkoutAt,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Transaction Ready')).toBeDefined();
      expect(screen.getByText('Verify agreement PDF + signature saved')).toBeDefined();
      expect(screen.getByText('Complete Transaction')).toBeDefined();
    });

    // Overlay should exist (blocks clicks on underlying UI)
    expect(document.querySelector('.er-txn-complete-modal__overlay')).not.toBeNull();
  });
});
