import { useState, useEffect, type FormEvent } from 'react';
import { LiquidGlassPinInput } from '@club-ops/ui';
import type { StaffSession } from './api/staffAuth';
export type { StaffSession } from './api/staffAuth';
import { fetchAuthStaff, loginPin } from './api/staffAuth';

interface LockScreenProps {
  onLogin: (session: StaffSession) => void;
  deviceType: 'tablet' | 'kiosk' | 'desktop';
  deviceId: string;
}

interface Employee {
  id: string;
  name: string;
  role: 'STAFF' | 'ADMIN';
  description: string;
}

export function LockScreen({ onLogin, deviceType, deviceId }: LockScreenProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const data = await fetchAuthStaff();
        const staffList: Employee[] = (data.staff || []).map((staff) => ({
          id: staff.id,
          name: staff.name,
          role: staff.role,
          description:
            staff.role === 'ADMIN'
              ? 'Admin — Monitor, Waitlist, Reports, Customer Tools'
              : 'Staff — Schedule, Messages (stub)',
        }));
        setEmployees(staffList);
      } catch (error) {
        console.error('Failed to load employees:', error);
        setError('Failed to load staff list');
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    loadEmployees();
  }, []);

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setPin('');
    setError(null);
  };

  const handleBack = () => {
    setSelectedEmployee(null);
    setPin('');
    setError(null);
  };

  const handlePinSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!selectedEmployee || !pin.trim()) {
      setError('Please enter your PIN');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const session = await loginPin({
        staffLookup: selectedEmployee.name,
        deviceId,
        pin: pin.trim(),
        deviceType: deviceType,
      });

      onLogin(session);
      setPin('');
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Invalid PIN. Please try again.';
      setError(errorMessage);
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="lock-screen">
      <div className="lock-screen-content cs-liquid-card">
        {!selectedEmployee ? (
          <div className="lock-screen-step">
            <div className="lock-screen-header">
              <h1>Club Operations</h1>
              <p>Select your account to continue</p>
            </div>

            {error && <div className="lock-screen-error">{error}</div>}

            {isLoadingEmployees ? (
              <div className="lock-screen-loading">Loading staff...</div>
            ) : employees.length === 0 ? (
              <div className="lock-screen-empty">
                No active staff members found. Please contact an administrator.
              </div>
            ) : (
              <div className="lock-screen-employee-list">
                {employees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    className="lock-screen-employee cs-liquid-button cs-liquid-button--secondary"
                    onClick={() => handleEmployeeSelect(employee)}
                    disabled={isLoading}
                  >
                    <div className="lock-screen-employee-row">
                      <span className="lock-screen-employee-name">{employee.name}</span>
                      <span
                        className={`lock-screen-employee-role lock-screen-employee-role--${employee.role === 'ADMIN' ? 'admin' : 'staff'}`}
                      >
                        {employee.role === 'ADMIN' ? 'Admin' : 'Staff'}
                      </span>
                    </div>
                    <span className="lock-screen-employee-desc">{employee.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="lock-screen-step">
            <div className="lock-screen-header">
              <h1>Enter PIN</h1>
              <p>Employee: {selectedEmployee.name}</p>
            </div>

            {error && <div className="lock-screen-error">{error}</div>}

            <LiquidGlassPinInput
              length={6}
              value={pin}
              onChange={(next) => {
                setPin(next);
                if (error) setError(null);
              }}
              onSubmit={() => void handlePinSubmit()}
              submitLabel={isLoading ? 'Signing in...' : 'Sign In'}
              submitDisabled={isLoading}
              disabled={isLoading}
              className="lock-screen-pin"
              displayAriaLabel="Staff PIN"
            />

            <div className="lock-screen-actions">
              <button
                type="button"
                className="cs-liquid-button cs-liquid-button--secondary"
                onClick={handleBack}
                disabled={isLoading}
              >
                Back to staff selection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
