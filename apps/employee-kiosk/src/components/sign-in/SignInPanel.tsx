import { useState, useEffect, useCallback } from 'react';
import { Alert, Spinner, Button } from '@club-ops/ui/tailadmin';
import { OtpPinInput } from './OtpPinInput';
import {
  RegisterButtons,
  type RegisterAvailability,
  type RegisterNumber,
} from './RegisterButtons';
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

export interface RegisterSession {
  employeeId: string;
  employeeName: string;
  registerNumber: number;
  deviceId: string;
  pin?: string;
}

type SignInStep = 'select-employee' | 'enter-pin' | 'assign-register' | 'confirm';

export interface SignInPanelProps {
  deviceId: string;
  onSignedIn: (session: RegisterSession) => void;
}

/* ── Component ─────────────────────────────────────────────── */

export function SignInPanel({ deviceId, onSignedIn }: SignInPanelProps) {
  const [step, setStep] = useState<SignInStep>('select-employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [registerNumber, setRegisterNumber] = useState<number | null>(null);
  const [registers, setRegisters] = useState<RegisterAvailability[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── API calls ── */

  const fetchAvailableEmployees = useCallback(async () => {
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
  }, []);

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

  useEffect(() => {
    if (step === 'select-employee') {
      void fetchAvailableEmployees();
    }
  }, [step, fetchAvailableEmployees]);

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

      onSignedIn(session);

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

  return (
    <div className="flex h-full items-center justify-center">
      {/* Sign-in card */}
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 shadow-theme-xl backdrop-blur-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Employee Sign In</h1>
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
