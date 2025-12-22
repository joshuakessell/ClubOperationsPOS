import { useState, useEffect } from 'react';

const API_BASE = '/api';

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

export function SignInModal({ isOpen, onClose, onSignIn, deviceId }: SignInModalProps) {
  const [step, setStep] = useState<SignInStep>('select-employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [registerNumber, setRegisterNumber] = useState<number | null>(null);
  const [availableRegisters, setAvailableRegisters] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available employees on open
  useEffect(() => {
    if (isOpen && step === 'select-employee') {
      fetchAvailableEmployees();
    }
  }, [isOpen, step]);

  const fetchAvailableEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE}/v1/employees/available`);
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      setError('Failed to load employees');
    }
  };

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setStep('enter-pin');
    setPin('');
    setPinError(false);
    setError(null);
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.message === 'Wrong PIN') {
          setPinError(true);
          setPin('');
          // Shake animation will be handled by CSS
          return;
        }
        throw new Error(errorData.message || 'PIN verification failed');
      }

      // PIN verified, proceed to register assignment
      await handleAssignRegister();
    } catch (error) {
      console.error('PIN verification error:', error);
      setError(error instanceof Error ? error.message : 'PIN verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRegister = async () => {
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign register');
      }

      const data = await response.json();

      // If registerNumber is returned, it means auto-assignment happened
      if (data.registerNumber) {
        setRegisterNumber(data.registerNumber);
        setStep('confirm');
      } else {
        // If no registerNumber, show selection (shouldn't happen with current logic)
        const allRegisters = [1, 2];
        setAvailableRegisters(allRegisters);
        setStep('assign-register');
      }
    } catch (error) {
      console.error('Register assignment error:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign register');
    } finally {
      setIsLoading(false);
    }
  };

  const getOccupiedRegisters = async (): Promise<number[]> => {
    try {
      // Check status for both registers
      const status1 = await fetch(`${API_BASE}/v1/registers/status?deviceId=check-register-1`);
      const status2 = await fetch(`${API_BASE}/v1/registers/status?deviceId=check-register-2`);
      // This is a simplified check - in production, you'd have a dedicated endpoint
      return [];
    } catch {
      return [];
    }
  };

  const handleSelectRegister = (num: number) => {
    setRegisterNumber(num);
    setStep('confirm');
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
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to confirm register assignment');
      }

      const data = await response.json();

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
      setAvailableRegisters([]);
    } else if (step === 'confirm') {
      if (availableRegisters.length > 0) {
        setStep('assign-register');
      } else {
        setStep('enter-pin');
      }
      setRegisterNumber(null);
    }
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="sign-in-modal-overlay" onClick={onClose}>
      <div className="sign-in-modal" onClick={(e) => e.stopPropagation()}>
        <button className="sign-in-modal-close" onClick={onClose}>×</button>

        {step === 'select-employee' && (
          <div className="sign-in-step">
            <h2>Select Employee</h2>
            {error && <div className="sign-in-error">{error}</div>}
            <div className="employee-list">
              {employees.length === 0 ? (
                <p>No available employees</p>
              ) : (
                employees.map((emp) => (
                  <button
                    key={emp.id}
                    className="employee-item"
                    onClick={() => handleSelectEmployee(emp)}
                    disabled={isLoading}
                  >
                    {emp.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === 'enter-pin' && selectedEmployee && (
          <div className="sign-in-step">
            <h2>Enter PIN</h2>
            <p className="sign-in-subtitle">Employee: {selectedEmployee.name}</p>
            {pinError && <div className="sign-in-error shake">Wrong PIN</div>}
            {error && <div className="sign-in-error">{error}</div>}
            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                className={`pin-input ${pinError ? 'shake' : ''}`}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setPinError(false);
                }}
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                autoFocus
                disabled={isLoading}
              />
              <div className="sign-in-actions">
                <button type="button" onClick={handleBack} disabled={isLoading}>
                  Back
                </button>
                <button type="submit" disabled={isLoading || pin.length !== 4}>
                  {isLoading ? 'Verifying...' : 'Verify PIN'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'assign-register' && (
          <div className="sign-in-step">
            <h2>Select Register</h2>
            {error && <div className="sign-in-error">{error}</div>}
            <div className="register-buttons">
              {availableRegisters.map((num) => (
                <button
                  key={num}
                  className="register-button"
                  onClick={() => handleSelectRegister(num)}
                  disabled={isLoading}
                >
                  Register {num}
                </button>
              ))}
            </div>
            <div className="sign-in-actions">
              <button onClick={handleBack} disabled={isLoading}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && registerNumber && (
          <div className="sign-in-step">
            <h2>Assigned Register {registerNumber}</h2>
            <p className="sign-in-subtitle">Employee: {selectedEmployee?.name}</p>
            {error && <div className="sign-in-error">{error}</div>}
            <div className="sign-in-actions">
              <button onClick={handleBack} disabled={isLoading}>
                Back
              </button>
              <button onClick={handleConfirm} disabled={isLoading}>
                {isLoading ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

