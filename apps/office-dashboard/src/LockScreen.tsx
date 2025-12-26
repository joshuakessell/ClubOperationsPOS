import { useState, useEffect } from 'react';
import './LockScreen.css';

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
          const staffList: Employee[] = (data.staff || []).map((staff: { id: string; name: string; role: 'STAFF' | 'ADMIN' }) => ({
            id: staff.id,
            name: staff.name,
            role: staff.role,
            accessLevel: staff.role === 'ADMIN' ? 'full' : 'limited',
            description: staff.role === 'ADMIN' 
              ? 'Full Access - Auditing, Reports & Schedule Management'
              : 'Register Employee - View Schedule Only',
          }));
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
      const errorMessage = error instanceof Error ? error.message : 'Invalid PIN. Please try again.';
      setError(errorMessage);
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="lock-screen-container">
      <div className="lock-screen-background">
        <div className="lock-screen-card">
          {!selectedEmployee ? (
            <div className="lock-screen-content">
              {/* Header */}
              <div className="lock-screen-header">
                <div className="logo-circle-large">
                  <span className="logo-text-large">CD</span>
                </div>
                <h1 className="lock-screen-title">Club Dallas</h1>
                <p className="lock-screen-subtitle">Select your account to continue</p>
              </div>

              {/* Employee Selection */}
              {isLoadingEmployees ? (
                <div className="loading-container">
                  <div className="spinner-large"></div>
                  <p>Loading staff...</p>
                </div>
              ) : employees.length === 0 ? (
                <div className="error-message">
                  No active staff members found. Please contact an administrator.
                </div>
              ) : (
                <div className="employee-list">
                  {employees.map((employee) => (
                    <div
                      key={employee.id}
                      className="employee-card"
                      onClick={() => handleEmployeeSelect(employee)}
                    >
                      <div className={`employee-avatar ${employee.role.toLowerCase()}`}>
                        {employee.role === 'ADMIN' ? '👔' : '👤'}
                      </div>
                      <div className="employee-details">
                        <h3 className="employee-name">{employee.name}</h3>
                        <p className="employee-description">{employee.description}</p>
                      </div>
                      <div className="employee-arrow">→</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="lock-screen-content">
              {/* Back Button */}
              <button className="back-button" onClick={handleBack}>
                ← Back to Employee Selection
              </button>

              {/* Selected Employee Info */}
              <div className="selected-employee-header">
                <div className={`employee-avatar-large ${selectedEmployee.role.toLowerCase()}`}>
                  {selectedEmployee.role === 'ADMIN' ? '👔' : '👤'}
                </div>
                <h2 className="selected-employee-name">{selectedEmployee.name}</h2>
                <p className="selected-employee-description">{selectedEmployee.description}</p>
              </div>

              {/* PIN Entry Form */}
              <form onSubmit={handlePinSubmit} className="pin-form">
                {error && (
                  <div className="error-message" onClick={() => setError(null)}>
                    {error}
                  </div>
                )}

                <div className="pin-input-container">
                  <input
                    type="password"
                    className="pin-input"
                    value={pin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setPin(value);
                    }}
                    disabled={isLoading}
                    autoFocus
                    maxLength={10}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Enter PIN"
                  />
                </div>

                {/* Progress Bar */}
                {isLoading && (
                  <div className="progress-bar-container">
                    <div className="progress-bar">
                      <div className="progress-bar-fill"></div>
                    </div>
                    <p className="progress-text">Signing in...</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="sign-in-button"
                  disabled={isLoading || !pin.trim()}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
