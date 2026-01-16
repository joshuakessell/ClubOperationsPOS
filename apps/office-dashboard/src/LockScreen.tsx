import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
const API_BASE = '/api';

export interface StaffSession {
  staffId: string;
  name: string;
  role: 'STAFF' | 'ADMIN';
  sessionToken: string;
}

interface LockScreenProps {
  onLogin: (session: StaffSession) => void;
  deviceType: 'tablet' | 'kiosk' | 'desktop';
  deviceId: string;
}

// Employee definitions
interface Employee {
  id: string;
  name: string;
  role: 'STAFF' | 'ADMIN';
  accessLevel: 'limited' | 'full';
  description: string;
}

export function LockScreen({ onLogin, deviceType, deviceId }: LockScreenProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);

  // Fetch employees from API
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const response = await fetch(`${API_BASE}/v1/auth/staff`);
        if (response.ok) {
          const data = await response.json();
          const staffList: Employee[] = (data.staff || []).map(
            (staff: { id: string; name: string; role: 'STAFF' | 'ADMIN' }) => ({
              id: staff.id,
              name: staff.name,
              role: staff.role,
              accessLevel: staff.role === 'ADMIN' ? 'full' : 'limited',
              description:
                staff.role === 'ADMIN'
                  ? 'Admin — Monitor, Waitlist, Reports, Customer Tools'
                  : 'Staff — Schedule, Messages (stub)',
            })
          );
          setEmployees(staffList);
        } else {
          setError('Failed to load staff list');
        }
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

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployee || !pin.trim()) {
      setError('Please enter your PIN');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auth/login-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffLookup: selectedEmployee.name,
          deviceId,
          pin: pin.trim(),
          deviceType: deviceType, // Pass device type for proper session creation
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Login failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || 'Login failed';
          console.error('Login API error:', errorData);
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `Login failed (${response.status} ${response.statusText})`;
        }
        throw new Error(errorMessage);
      }

      const session: StaffSession = await response.json();

      // Use the session data from the server (authenticated and verified)
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

  const headerTitle = useMemo(() => {
    if (!selectedEmployee) return 'Select your account';
    return selectedEmployee.name;
  }, [selectedEmployee]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card padding="lg">
          <div className="mb-6">
            <div className="text-sm font-semibold text-indigo-600">Club Operations</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{headerTitle}</div>
            <div className="mt-2 text-sm text-gray-600">
              {!selectedEmployee
                ? 'Choose your staff account to continue.'
                : selectedEmployee.description}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!selectedEmployee ? (
            <div className="space-y-3">
              {isLoadingEmployees ? (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
                  Loading staff…
                </div>
              ) : employees.length === 0 ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  No active staff members found. Please contact an administrator.
                </div>
              ) : (
                employees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => handleEmployeeSelect(employee)}
                    className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600/30 focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">{employee.name}</div>
                        <div className="mt-1 text-sm text-gray-600">{employee.description}</div>
                      </div>
                      <div className="text-xs font-semibold text-gray-500">
                        {employee.role === 'ADMIN' ? 'ADMIN' : 'STAFF'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Button variant="ghost" onClick={handleBack} className="w-full justify-start">
                ← Back to employee selection
              </Button>

              <form onSubmit={handlePinSubmit} className="space-y-3">
                <label className="block text-sm font-semibold text-gray-900">Enter PIN</label>
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setPin(value);
                  }}
                  disabled={isLoading}
                  autoFocus
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="text-center text-xl tracking-[0.35em] font-mono"
                />

                <Button
                  type="submit"
                  disabled={isLoading || pin.trim().length !== 6}
                  className="w-full"
                >
                  {isLoading ? 'Signing in…' : 'Sign In'}
                </Button>
              </form>
            </div>
          )}
        </Card>
        <div className="mt-4 text-center text-xs text-gray-500">
          Device: <span className="font-mono">{deviceType}</span> • <span className="font-mono">{deviceId}</span>
        </div>
      </div>
    </div>
  );
}
