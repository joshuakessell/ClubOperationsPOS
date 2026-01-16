import { useState, useEffect } from 'react';
import { PinInput } from '@club-ops/ui';
import { ModalFrame } from './features/register/modals/ModalFrame';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

const API_BASE = '/api';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const msg = value['message'];
  const err = value['error'];
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof err === 'string' && err.trim()) return err;
  return undefined;
}

async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  return data as T;
}

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: (data: {
    employeeId: string;
    employeeName: string;
    registerNumber: number;
    deviceId: string;
    pin: string; // PIN needed to create staff session
  }) => void;
  deviceId: string;
}

type SignInStep = 'select-employee' | 'enter-pin' | 'assign-register' | 'confirm';

type RegisterAvailability = {
  registerNumber: 1 | 2;
  occupied: boolean;
  deviceId?: string;
  employee?: {
    id: string;
    name: string;
    role: string;
  };
};

export function SignInModal({ isOpen, onClose, onSignIn, deviceId }: SignInModalProps) {
  const [step, setStep] = useState<SignInStep>('select-employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [registerNumber, setRegisterNumber] = useState<number | null>(null);
  const [registers, setRegisters] = useState<RegisterAvailability[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available employees on open
  useEffect(() => {
    if (isOpen && step === 'select-employee') {
      void fetchAvailableEmployees();
    }
  }, [isOpen, step]);

  const fetchAvailableEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE}/v1/employees/available`);
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await readJson<{ employees?: unknown[] }>(response);
      const employees = (Array.isArray(data.employees) ? data.employees : [])
        .filter(isRecord)
        .filter(
          (e) =>
            typeof e.id === 'string' && typeof e.name === 'string' && typeof e.role === 'string'
        )
        .map((e) => ({ id: e.id as string, name: e.name as string, role: e.role as string }));
      setEmployees(employees);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      setError('Failed to load employees');
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

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setStep('enter-pin');
    setPin('');
    setPinError(false);
    setError(null);
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedEmployee || !pin.trim()) return;

    setIsLoading(true);
    setPinError(false);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          pin: pin.trim(),
          deviceId,
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        if (getErrorMessage(errorPayload) === 'Wrong PIN') {
          setPinError(true);
          setPin('');
          // Shake animation will be handled by CSS
          return;
        }
        throw new Error(getErrorMessage(errorPayload) || 'PIN verification failed');
      }

      // PIN verified, allow user to choose a register
      setStep('assign-register');
      await fetchRegisterAvailability();
    } catch (error) {
      console.error('PIN verification error:', error);
      setError(error instanceof Error ? error.message : 'PIN verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRegister = async (requestedRegisterNumber?: 1 | 2) => {
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
    } catch (error) {
      console.error('Register assignment error:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign register');
      // Refresh availability in case occupancy changed
      await fetchRegisterAvailability();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRegister = async (num: 1 | 2) => {
    await handleAssignRegister(num);
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

      // Sign in complete - pass PIN for staff session creation
      onSignIn({
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        registerNumber,
        deviceId,
        pin: pin, // Pass PIN for staff session
      });

      // Reset state
      setStep('select-employee');
      setSelectedEmployee(null);
      setPin('');
      setRegisterNumber(null);
      setPinError(false);
      setError(null);
      onClose();
    } catch (error) {
      console.error('Confirmation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to confirm');
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

  if (!isOpen) return null;

  return (
    <ModalFrame isOpen={isOpen} title="Register Sign In" onClose={onClose} maxWidth="720px">
      {step === 'select-employee' ? (
        <div className="grid gap-3">
          <div className="text-sm text-gray-600">Select an employee to sign in.</div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <Card padding="none" className="overflow-hidden">
            {employees.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">No available employees</div>
            ) : (
              <div className="grid">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectEmployee(emp)}
                    disabled={isLoading}
                    className="w-full border-b border-gray-200 p-4 text-left hover:bg-gray-50 disabled:opacity-60"
                  >
                    <div className="font-semibold text-gray-900">{emp.name}</div>
                    <div className="mt-1 text-sm text-gray-600">{emp.role}</div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {step === 'enter-pin' && selectedEmployee ? (
        <div className="grid gap-3">
          <div className="text-sm text-gray-600">
            Employee: <span className="font-semibold text-gray-900">{selectedEmployee.name}</span>
          </div>
          {pinError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              Wrong PIN
            </div>
          ) : null}
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <PinInput
            length={6}
            value={pin}
            onChange={(next) => {
              setPin(next);
              setPinError(false);
            }}
            onSubmit={() => void handlePinSubmit()}
            submitLabel={isLoading ? 'Verifying…' : 'Verify PIN'}
            submitDisabled={isLoading}
            disabled={isLoading}
            displayAriaLabel="Employee PIN"
          />

          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleBack} disabled={isLoading}>
              Back
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'assign-register' ? (
        <div className="grid gap-3">
          <div className="text-sm text-gray-600">Select a register for this device.</div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          {!registers ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              Loading registers…
            </div>
          ) : (
            <div className="grid gap-2">
              {([1, 2] as const).map((num) => {
                const reg = registers.find((r) => r.registerNumber === num);
                const occupied = reg?.occupied ?? false;
                const occupiedLabel = reg?.employee?.name ? ` (In use: ${reg.employee.name})` : ' (In use)';
                return (
                  <Button
                    key={num}
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={() => void handleSelectRegister(num)}
                    disabled={isLoading || occupied}
                    title={occupied ? `Register ${num} is occupied` : `Use Register ${num}`}
                  >
                    <span>Register {num}</span>
                    <span className="text-sm text-gray-600">{occupied ? occupiedLabel : ''}</span>
                  </Button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleBack} disabled={isLoading}>
              Back
            </Button>
            <Button variant="secondary" type="button" onClick={() => void fetchRegisterAvailability()} disabled={isLoading}>
              Refresh
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'confirm' && registerNumber ? (
        <div className="grid gap-3">
          <div className="text-lg font-semibold text-gray-900">Assigned Register {registerNumber}</div>
          <div className="text-sm text-gray-600">
            Employee: <span className="font-semibold text-gray-900">{selectedEmployee?.name}</span>
          </div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleBack} disabled={isLoading}>
              Back
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={isLoading}>
              {isLoading ? 'Confirming…' : 'Confirm'}
            </Button>
          </div>
        </div>
      ) : null}
    </ModalFrame>
  );
}
