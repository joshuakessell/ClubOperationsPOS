import { useState, useEffect } from 'react';
import { SignInModal } from './SignInModal';

const API_BASE = '/api';

interface RegisterSession {
  employeeId: string;
  employeeName: string;
  registerNumber: number;
  deviceId: string;
  pin?: string; // PIN for creating staff session
}

interface RegisterSignInProps {
  deviceId: string;
  onSignedIn: (session: RegisterSession) => void;
  children: React.ReactNode;
}

export function RegisterSignIn({ deviceId, onSignedIn, children }: RegisterSignInProps) {
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [registerSession, setRegisterSession] = useState<RegisterSession | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);

  // Check for existing register session on mount
  useEffect(() => {
    checkRegisterStatus();
  }, []);

  const checkRegisterStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/v1/registers/status?deviceId=${encodeURIComponent(deviceId)}`);
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.signedIn) {
        setRegisterSession({
          employeeId: data.employee.id,
          employeeName: data.employee.name,
          registerNumber: data.registerNumber,
          deviceId,
        });
        startHeartbeat();
        onSignedIn({
          employeeId: data.employee.id,
          employeeName: data.employee.name,
          registerNumber: data.registerNumber,
          deviceId,
        });
      }
    } catch (error) {
      console.error('Failed to check register status:', error);
    }
  };

  const startHeartbeat = () => {
    // Clear existing interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Send heartbeat every 60 seconds (90 second TTL on server)
    const interval = setInterval(async () => {
      try {
        await fetch(`${API_BASE}/v1/registers/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId }),
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
        // If heartbeat fails, session may have been cleaned up
        // Check status again
        checkRegisterStatus();
      }
    }, 60000);

    setHeartbeatInterval(interval);
  };

  const handleSignIn = async (session: RegisterSession) => {
    // After register sign-in, also create a staff session for API calls
    if (session.pin) {
      try {
        const response = await fetch(`${API_BASE}/v1/auth/login-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staffLookup: session.employeeId,
            deviceId: session.deviceId,
            pin: session.pin,
          }),
        });

        if (response.ok) {
          const staffSession = await response.json();
          // Store staff session for API authentication
          localStorage.setItem('staff_session', JSON.stringify(staffSession));
        }
      } catch (error) {
        console.error('Failed to create staff session:', error);
        // Continue anyway - register session is primary
      }
    }

    // Remove PIN from session before storing
    const { pin, ...sessionWithoutPin } = session;
    setRegisterSession(sessionWithoutPin);
    startHeartbeat();
    onSignedIn(sessionWithoutPin);
  };

  const handleSignOut = async () => {
    try {
      // Get session token from localStorage (from staff session)
      const stored = localStorage.getItem('staff_session');
      if (stored) {
        const staffSession = JSON.parse(stored);
        await fetch(`${API_BASE}/v1/registers/signout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffSession.sessionToken}`,
          },
          body: JSON.stringify({ deviceId }),
        });
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }

    // Clear heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      setHeartbeatInterval(null);
    }

    setRegisterSession(null);
    setMenuOpen(false);
    // Clear staff session as well
    localStorage.removeItem('staff_session');
    // Reload to show sign-in screen
    window.location.reload();
  };

  // If not signed in, show initial state
  if (!registerSession) {
    return (
      <div className="register-sign-in-container">
        <div className="register-sign-in-logo">Club Dallas</div>
        <button
          className="register-sign-in-button"
          onClick={() => setShowSignInModal(true)}
        >
          Sign In
        </button>
        <SignInModal
          isOpen={showSignInModal}
          onClose={() => setShowSignInModal(false)}
          onSignIn={handleSignIn}
          deviceId={deviceId}
        />
      </div>
    );
  }

  // Signed in state
  return (
    <div className="register-sign-in-container">
      <div className="register-sign-in-logo">Club Dallas</div>
      <div className="register-sign-in-overlay" />
      
      <div className="register-top-bar">
        <button
          className="register-menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          ☰
        </button>
        <div className="register-top-bar-center">
          {registerSession.employeeName} • Register {registerSession.registerNumber}
        </div>
        <div style={{ width: '40px' }} /> {/* Spacer for alignment */}
      </div>

      <div className={`register-menu ${menuOpen ? 'open' : ''}`}>
        <button
          className="register-menu-item"
          onClick={handleSignOut}
        >
          Sign Out
        </button>
      </div>

      {children}
    </div>
  );
}

