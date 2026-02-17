import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, Button } from '@club-ops/ui/tailadmin';
import type { RegisterSession } from './components/sign-in/SignInPanel';
import type { RealtimeEvent, RegisterSessionUpdatedPayload } from '@club-ops/shared';
import { useLaneSession } from '@club-ops/shared/realtime/useLaneSession';
import { safeJsonParse } from '@club-ops/ui';
import {
  clearStorageValue,
  CLUBOPS_STORAGE_KEYS,
  CLUBOPS_STORAGE_LEGACY_KEYS,
  getApiUrl,
} from '@club-ops/shared';

const API_BASE = getApiUrl('/api');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  return data as T;
}

/* ── Types ─────────────────────────────────────────────────── */

export type { RegisterSession };

interface RegisterSignInProps {
  deviceId: string;
  onSignedIn: (session: RegisterSession) => void;
  topTitle?: string;
  lane?: string;
  apiStatus?: string | null;
  realtimeConnected?: boolean;
  realtimeMode?: 'cloud' | 'lan';
  onSignOut?: () => void;
  onCloseOut?: () => void;
  children: React.ReactNode;
}

/* ── Component ─────────────────────────────────────────────── */

export function RegisterSignIn({
  deviceId,
  onSignedIn,
  topTitle = 'Employee Register',
  lane,
  apiStatus,
  realtimeConnected,
  realtimeMode,
  onSignOut,
  onCloseOut,
  children,
}: RegisterSignInProps) {
  const [registerSession, setRegisterSession] = useState<RegisterSession | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatOkRef = useRef(false);
  const heartbeatFailureCountRef = useRef(0);
  const heartbeatInvalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivitySentRef = useRef(0);
  const activityInFlightRef = useRef(false);

  /* ── Session management (unchanged from original) ── */

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatInvalidationTimerRef.current) {
      clearTimeout(heartbeatInvalidationTimerRef.current);
      heartbeatInvalidationTimerRef.current = null;
    }
  }, []);

  const handleSessionInvalidated = useCallback(() => {
    stopHeartbeat();
    setRegisterSession(null);
    lastHeartbeatOkRef.current = false;
    heartbeatFailureCountRef.current = 0;
    clearStorageValue(
      localStorage,
      CLUBOPS_STORAGE_KEYS.staffSession,
      CLUBOPS_STORAGE_LEGACY_KEYS.staffSession
    );
  }, [stopHeartbeat]);

  const checkRegisterStatus = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(
        `${API_BASE}/v1/registers/status?deviceId=${encodeURIComponent(deviceId)}`
      );
      if (!response.ok) return false;
      const data = await readJson<{
        signedIn?: boolean;
        employee?: { id?: string; name?: string };
        registerNumber?: number;
      }>(response);
      if (
        data.signedIn &&
        data.employee &&
        typeof data.employee.id === 'string' &&
        typeof data.employee.name === 'string' &&
        typeof data.registerNumber === 'number'
      ) {
        setRegisterSession({
          employeeId: data.employee.id,
          employeeName: data.employee.name,
          registerNumber: data.registerNumber,
          deviceId,
        });
        onSignedIn({
          employeeId: data.employee.id,
          employeeName: data.employee.name,
          registerNumber: data.registerNumber,
          deviceId,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to check register status:', error);
      return false;
    }
  }, [deviceId, onSignedIn]);

  useEffect(() => {
    void checkRegisterStatus();
  }, [checkRegisterStatus]);

  const signedInRealtime = registerSession ? (
    <RegisterSessionRealtime deviceId={deviceId} onInvalidated={handleSessionInvalidated} />
  ) : null;

  const sendHeartbeat = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/v1/registers/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        if (isRecord(errorPayload) && errorPayload.code === 'DEVICE_DISABLED') {
          handleSessionInvalidated();
          return;
        }
        if (response.status === 404) {
          if (lastHeartbeatOkRef.current) {
            heartbeatFailureCountRef.current += 1;
            if (heartbeatFailureCountRef.current < 3) return;
          }
          const stillActive = await checkRegisterStatus();
          if (!stillActive) {
            if (heartbeatInvalidationTimerRef.current) {
              clearTimeout(heartbeatInvalidationTimerRef.current);
            }
            heartbeatInvalidationTimerRef.current = setTimeout(() => {
              heartbeatInvalidationTimerRef.current = null;
              void checkRegisterStatus().then((active) => {
                if (!active) handleSessionInvalidated();
              });
            }, 3000);
          }
          return;
        }
        throw new Error('Heartbeat failed');
      }
      lastHeartbeatOkRef.current = true;
      heartbeatFailureCountRef.current = 0;
      if (heartbeatInvalidationTimerRef.current) {
        clearTimeout(heartbeatInvalidationTimerRef.current);
        heartbeatInvalidationTimerRef.current = null;
      }
    } catch (error) {
      console.error('Heartbeat failed:', error);
      heartbeatFailureCountRef.current += 1;
      if (lastHeartbeatOkRef.current && heartbeatFailureCountRef.current < 3) return;
      const stillActive = await checkRegisterStatus();
      if (!stillActive) {
        if (heartbeatInvalidationTimerRef.current) {
          clearTimeout(heartbeatInvalidationTimerRef.current);
        }
        heartbeatInvalidationTimerRef.current = setTimeout(() => {
          heartbeatInvalidationTimerRef.current = null;
          void checkRegisterStatus().then((active) => {
            if (!active) handleSessionInvalidated();
          });
        }, 3000);
      }
    }
  }, [checkRegisterStatus, deviceId, handleSessionInvalidated]);

  const sendActivity = useCallback(async () => {
    if (activityInFlightRef.current) return;
    activityInFlightRef.current = true;
    try {
      const response = await fetch(`${API_BASE}/v1/registers/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        if (
          response.status === 404 ||
          (isRecord(errorPayload) && errorPayload.code === 'DEVICE_DISABLED')
        ) {
          handleSessionInvalidated();
        }
      }
    } catch (error) {
      console.error('Register activity update failed:', error);
    } finally {
      activityInFlightRef.current = false;
    }
  }, [deviceId, handleSessionInvalidated]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    void sendHeartbeat();
    const interval = setInterval(() => { void sendHeartbeat(); }, 30000);
    heartbeatIntervalRef.current = interval;
  }, [sendHeartbeat, stopHeartbeat]);

  useEffect(() => {
    if (registerSession) {
      startHeartbeat();
      return () => stopHeartbeat();
    }
    stopHeartbeat();
    return;
  }, [registerSession, startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    if (!registerSession) return;
    const onFocus = () => void sendHeartbeat();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void sendHeartbeat();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [registerSession, sendHeartbeat]);

  useEffect(() => {
    if (!registerSession) return;
    const throttleMs = 60_000;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivitySentRef.current < throttleMs) return;
      lastActivitySentRef.current = now;
      void sendActivity();
    };
    onActivity();
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('focus', onActivity);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onActivity();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('focus', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [registerSession, sendActivity]);

  /* ── Handle sign-in from the SignInPanel ── */
  const handleSignInComplete = useCallback(
    (session: RegisterSession) => {
      const { pin: _pin, ...sessionWithoutPin } = session;
      void _pin;
      lastActivitySentRef.current = 0;
      lastHeartbeatOkRef.current = false;
      heartbeatFailureCountRef.current = 0;
      setRegisterSession(sessionWithoutPin);
      onSignedIn(sessionWithoutPin);
    },
    [onSignedIn]
  );

  const signInContextValue = { deviceId, onSignedIn: handleSignInComplete };

  /* ── Not signed in → render shell with sign-in tab ── */
  if (!registerSession) {
    return (
      <div className="flex h-screen flex-col bg-white dark:bg-gray-900">
        {signedInRealtime}
        <RegisterSignInContext.Provider value={signInContextValue}>
          {children}
        </RegisterSignInContext.Provider>
      </div>
    );
  }

  /* ── Signed in → normal shell ── */
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-900">
      {realtimeMode === 'lan' ? (
        <div className="bg-warning-500 px-3 py-1.5 text-center text-sm font-bold text-white">
          LAN mode (offline fallback)
        </div>
      ) : null}

      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900">
        <span className="text-base font-semibold text-gray-800 dark:text-white/90">{topTitle}</span>

        <div className="flex items-center gap-3">
          <span className="text-base text-gray-600 dark:text-gray-300">
            {registerSession.employeeName} • Register {registerSession.registerNumber}
          </span>

          {import.meta.env.DEV && (
            <span className="flex items-center gap-2">
              {lane ? (
                <Badge color="info" variant="light" size="sm">
                  Lane: {lane}
                </Badge>
              ) : null}
              <Badge color={apiStatus === 'ok' ? 'success' : 'error'} variant="light" size="sm">
                API: {apiStatus ?? '...'}
              </Badge>
              <Badge color={realtimeConnected ? 'success' : 'error'} variant="light" size="sm">
                Realtime: {realtimeConnected ? 'Live' : 'Offline'}
              </Badge>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onSignOut && (
            <Button variant="outline" size="sm" onClick={() => void onSignOut()}>
              Sign Out
            </Button>
          )}
          {onCloseOut && (
            <Button variant="danger" size="sm" onClick={() => void onCloseOut()}>
              Close Out
            </Button>
          )}
        </div>
      </header>

      {signedInRealtime}
      <RegisterSignInContext.Provider value={signInContextValue}>
        {children}
      </RegisterSignInContext.Provider>
    </div>
  );
}

/* ── Context for passing sign-in props to NavigationRoot ─── */

import { createContext, useContext } from 'react';

interface RegisterSignInContextType {
  deviceId: string;
  onSignedIn: (session: RegisterSession) => void;
}

const RegisterSignInContext = createContext<RegisterSignInContextType | null>(null);

export function useRegisterSignInContext(): RegisterSignInContextType | null {
  return useContext(RegisterSignInContext);
}

/* ── Realtime listener (unchanged) ─────────────────────────── */

function RegisterSessionRealtime({
  deviceId,
  onInvalidated,
}: {
  deviceId: string;
  onInvalidated: () => void;
}) {
  const rawEnv = import.meta.env as unknown as Record<string, unknown>;
  const kioskToken =
    typeof rawEnv.VITE_KIOSK_TOKEN === 'string' && rawEnv.VITE_KIOSK_TOKEN.trim()
      ? rawEnv.VITE_KIOSK_TOKEN.trim()
      : null;
  const { lastMessage, lastError } = useLaneSession({
    laneId: '',
    role: 'employee',
    kioskToken: kioskToken ?? '',
    enabled: true,
  });

  useEffect(() => {
    if (lastError) {
      console.error('Realtime error:', lastError);
    }
  }, [lastError]);

  useEffect(() => {
    if (!lastMessage) return;
    try {
      const parsed = typeof lastMessage === 'string'
        ? safeJsonParse<RealtimeEvent>(lastMessage)
        : (lastMessage as unknown as RealtimeEvent | null);
      if (
        parsed &&
        typeof parsed === 'object' &&
        'type' in parsed &&
        parsed.type === 'REGISTER_SESSION_UPDATED'
      ) {
        const payload = (parsed as RealtimeEvent<RegisterSessionUpdatedPayload>).payload;
        if (
          payload &&
          payload.deviceId === deviceId &&
          payload.reason === 'SIGNED_OUT'
        ) {
          onInvalidated();
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [lastMessage, deviceId, onInvalidated]);

  return null;
}
