import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, Button } from '@club-ops/ui/tailadmin';
import { Alert, Spinner } from '@club-ops/ui/tailadmin';
import { OtpPinInput } from './components/sign-in/OtpPinInput';
import {
  RegisterButtons,
  type RegisterAvailability,
  type RegisterNumber,
} from './components/sign-in/RegisterButtons';
import type { RealtimeEvent, RegisterSessionUpdatedPayload } from '@club-ops/shared';
import { useLaneSession } from '@club-ops/shared/realtime/useLaneSession';
import { safeJsonParse } from '@club-ops/ui';
import {
  clearStorageValue,
  CLUBOPS_STORAGE_KEYS,
  CLUBOPS_STORAGE_LEGACY_KEYS,
  getApiUrl,
  writeStorageValue,
} from '@club-ops/shared';

const API_BASE = getApiUrl('/api');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  return data as T;
}

function getErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const msg = value['message'];
  const err = value['error'];
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof err === 'string' && err.trim()) return err;
  return undefined;
}

/* ── Types ─────────────────────────────────────────────────── */

interface Employee {
  id: string;
  name: string;
  role: string;
  signedIn: boolean;
  registerNumbers: number[];
}

interface RegisterSession {
  employeeId: string;
  employeeName: string;
  registerNumber: number;
  deviceId: string;
  pin?: string;
}

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

type SignInStep = 'select-employee' | 'enter-pin' | 'assign-register' | 'confirm';

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

  /* ── Sign-in step state ── */
  const [step, setStep] = useState<SignInStep>('select-employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [registerNumber, setRegisterNumber] = useState<number | null>(null);
  const [registers, setRegisters] = useState<RegisterAvailability[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  /* ── Sign-in API calls ── */

  const fetchAvailableEmployees = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/v1/employees/available`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await readJson<{ employees?: unknown[] }>(response);
      const emps = (Array.isArray(data.employees) ? data.employees : [])
        .filter(isRecord)
        .filter(
          (e) =>
            typeof e.id === 'string' && typeof e.name === 'string' && typeof e.role === 'string'
        )
        .map((e) => ({
          id: e.id as string,
          name: e.name as string,
          role: e.role as string,
          signedIn: Boolean(e.signedIn),
          registerNumbers: Array.isArray(e.registerNumbers)
            ? e.registerNumbers.filter((n) => typeof n === 'number')
            : [],
        }));
      setEmployees(emps);
      if (emps.length === 0) {
        setError('No employees found in the database. Is the database seeded?');
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setError(
        `Failed to load employees. Check that the API is running. (${API_BASE}/v1/employees/available)`
      );
    }
  };

  const fetchRegisterAvailability = async () => {
    try {
      const response = await fetch(`${API_BASE}/v1/registers/availability`);
      if (!response.ok) throw new Error('Failed to fetch register availability');
      const data = await readJson<{ registers?: unknown[] }>(response);
      setRegisters((Array.isArray(data.registers) ? data.registers : []) as RegisterAvailability[]);
    } catch (err) {
      console.error('Failed to fetch register availability:', err);
      setError('Failed to load register availability');
      setRegisters(null);
    }
  };

  // Fetch employees when showing the select step
  useEffect(() => {
    if (!registerSession && step === 'select-employee') {
      void fetchAvailableEmployees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerSession, step]);

  const formatSignedInLabel = (employee: Employee) => {
    if (!employee.signedIn) return '';
    const regs = employee.registerNumbers.map((num) => `Register ${num}`).join(', ');
    return regs ? ` (Signed in: ${regs})` : ' (Signed in)';
  };

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setStep('enter-pin');
    setPin('');
    setPinError(false);
    setError(null);
  };

  const handlePinComplete = async (completedPin: string) => {
    if (!selectedEmployee) return;

    setIsLoading(true);
    setPinError(false);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          pin: completedPin.trim(),
          deviceId,
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        if (getErrorMessage(errorPayload) === 'Wrong PIN') {
          setPinError(true);
          setPin('');
          return;
        }
        throw new Error(getErrorMessage(errorPayload) || 'PIN verification failed');
      }

      setStep('assign-register');
      await fetchRegisterAvailability();
    } catch (err) {
      console.error('PIN verification error:', err);
      setError(err instanceof Error ? err.message : 'PIN verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRegister = async (requestedRegisterNumber?: RegisterNumber) => {
    if (!selectedEmployee) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/registers/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          deviceId,
          registerNumber: requestedRegisterNumber,
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(getErrorMessage(errorPayload) || 'Failed to assign register');
      }

      const data = await readJson<{ registerNumber?: number }>(response);
      if (typeof data.registerNumber === 'number') setRegisterNumber(data.registerNumber);
      setStep('confirm');
    } catch (err) {
      console.error('Register assignment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign register');
      await fetchRegisterAvailability();
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedEmployee || !registerNumber) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/registers/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          deviceId,
          registerNumber,
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(getErrorMessage(errorPayload) || 'Failed to confirm register assignment');
      }

      await response.json().catch(() => null);

      const session: RegisterSession = {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        registerNumber,
        deviceId,
        pin,
      };

      // Create staff session for API calls
      if (pin) {
        try {
          const loginResp = await fetch(`${API_BASE}/v1/auth/login-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              staffLookup: selectedEmployee.id,
              deviceId,
              pin,
            }),
          });
          if (loginResp.ok) {
            const staffSession = await readJson<Record<string, unknown>>(loginResp);
            writeStorageValue(
              localStorage,
              CLUBOPS_STORAGE_KEYS.staffSession,
              JSON.stringify(staffSession),
              CLUBOPS_STORAGE_LEGACY_KEYS.staffSession
            );
          }
        } catch (err) {
          console.error('Failed to create staff session:', err);
        }
      }

      const { pin: _pin, ...sessionWithoutPin } = session;
      void _pin;
      lastActivitySentRef.current = 0;
      lastHeartbeatOkRef.current = false;
      heartbeatFailureCountRef.current = 0;
      setRegisterSession(sessionWithoutPin);
      onSignedIn(sessionWithoutPin);

      // Reset sign-in state
      setStep('select-employee');
      setSelectedEmployee(null);
      setPin('');
      setRegisterNumber(null);
      setPinError(false);
      setError(null);
    } catch (err) {
      console.error('Confirmation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'enter-pin') {
      setStep('select-employee');
      setSelectedEmployee(null);
      setPin('');
      setPinError(false);
    } else if (step === 'assign-register') {
      setStep('enter-pin');
      setRegisterNumber(null);
      setRegisters(null);
    } else if (step === 'confirm') {
      setStep('assign-register');
      setRegisterNumber(null);
    }
    setError(null);
  };

  /* ── Step title ── */
  const stepTitle =
    step === 'select-employee'
      ? 'Select Employee'
      : step === 'enter-pin'
        ? 'Enter PIN'
        : step === 'assign-register'
          ? 'Select Register'
          : `Register ${registerNumber}`;

  /* ── Not signed in → full-page auth ── */
  if (!registerSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 font-outfit">
        {/* Auth card */}
        <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 shadow-theme-xl backdrop-blur-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">{topTitle}</h1>
            <p className="mt-2 text-sm text-gray-400">{stepTitle}</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-6">
              <Alert variant="error" title="Error" message={error} />
            </div>
          )}

          {/* ── Step: Select Employee ── */}
          {step === 'select-employee' && (
            <div className="flex flex-col gap-3">
              {employees.length === 0 && !error && (
                <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                  <Spinner size="sm" /> Loading employees…
                </div>
              )}
              {employees.length === 0 && error && (
                <div className="flex justify-center">
                  <Button size="lg" onClick={() => void fetchAvailableEmployees()}>
                    Retry
                  </Button>
                </div>
              )}
              <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto custom-scrollbar">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleSelectEmployee(emp)}
                    disabled={isLoading}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-4 text-left transition-all duration-150 hover:border-brand-400/40 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {/* Avatar circle */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-300">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-white">{emp.name}</span>
                      <span className="text-xs text-gray-400">
                        {emp.role}
                        {emp.signedIn && (
                          <span className="ml-1 text-brand-400">{formatSignedInLabel(emp)}</span>
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step: Enter PIN ── */}
          {step === 'enter-pin' && selectedEmployee && (
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/20 text-lg font-bold text-brand-300">
                  {selectedEmployee.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{selectedEmployee.name}</p>
                  <p className="text-xs text-gray-400">Enter your 6-digit PIN</p>
                </div>
              </div>

              {pinError && (
                <Alert variant="error" title="Wrong PIN" message="Please try again." />
              )}

              <OtpPinInput
                value={pin}
                onChange={(next) => {
                  setPin(next);
                  setPinError(false);
                }}
                onComplete={(completedPin) => void handlePinComplete(completedPin)}
                disabled={isLoading}
                shake={pinError}
                autoFocus
              />

              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Spinner size="sm" /> Verifying…
                </div>
              )}

              <Button variant="outline" size="sm" onClick={handleBack} disabled={isLoading}>
                ← Back
              </Button>
            </div>
          )}

          {/* ── Step: Assign Register ── */}
          {step === 'assign-register' && (
            <div className="flex flex-col gap-4">
              {!registers ? (
                <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                  <Spinner size="sm" /> Loading registers…
                </div>
              ) : (
                <RegisterButtons
                  registers={registers}
                  selectedEmployeeId={selectedEmployee?.id ?? null}
                  disabled={isLoading}
                  onSelect={(num) => void handleAssignRegister(num)}
                />
              )}
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleBack} disabled={isLoading}>
                  ← Back
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchRegisterAvailability()}
                  disabled={isLoading}
                >
                  Refresh
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: Confirm ── */}
          {step === 'confirm' && registerNumber && (
            <div className="flex flex-col items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-brand-400/30 bg-brand-500/15 text-3xl font-black text-brand-300">
                {registerNumber}
              </div>
              <p className="text-base text-gray-400">
                Employee:{' '}
                <span className="font-semibold text-white">{selectedEmployee?.name}</span>
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="lg" onClick={handleBack} disabled={isLoading}>
                  Back
                </Button>
                <Button size="lg" onClick={() => void handleConfirm()} disabled={isLoading}>
                  {isLoading ? 'Confirming…' : 'Confirm'}
                </Button>
              </div>
            </div>
          )}
        </div>
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
      {children}
    </div>
  );
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
    if (!lastMessage) return;
    const parsed = safeJsonParse<unknown>(String(lastMessage.data));
    if (!isRecord(parsed) || typeof parsed.type !== 'string') return;
    const message = parsed as unknown as RealtimeEvent;
    if (message.type !== 'REGISTER_SESSION_UPDATED') return;
    const payload = message.payload as RegisterSessionUpdatedPayload;
    if (payload.deviceId === deviceId && !payload.active) {
      onInvalidated();
    }
  }, [deviceId, lastMessage, onInvalidated]);

  useEffect(() => {
    if (!lastError) return;
    console.error('Realtime connection error:', lastError);
  }, [lastError]);

  return null;
}
