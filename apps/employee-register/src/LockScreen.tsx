import { useState, useEffect, type FormEvent } from 'react';
import { PinInput } from '@club-ops/ui';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import {
  type StaffSession,
  getErrorMessage,
  parseStaffSession,
  isWebAuthnSupported,
  requestAuthenticationOptions,
  getCredential,
  authenticationCredentialToJSON,
  verifyAuthentication,
} from '@club-ops/app-kit';

const API_BASE = '/api';
export type { StaffSession } from '@club-ops/app-kit';

interface LockScreenProps {
  onLogin: (session: StaffSession) => void;
  deviceType: 'tablet' | 'kiosk' | 'desktop';
  deviceId: string;
}

export function LockScreen({ onLogin, deviceId }: LockScreenProps) {
  const [mode, setMode] = useState<'webauthn' | 'pin'>('webauthn');
  const [staffLookup, setStaffLookup] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [webauthnSupported, setWebauthnSupported] = useState(false);

  // Check WebAuthn support on mount
  useEffect(() => {
    setWebauthnSupported(isWebAuthnSupported());
    if (!isWebAuthnSupported()) {
      setMode('pin');
    }
  }, []);

  const handleWebAuthnLogin = async () => {
    if (!staffLookup.trim()) {
      setError('Please enter your name or staff ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request authentication options
      const options = await requestAuthenticationOptions(staffLookup.trim(), deviceId);

      // Get credential from authenticator
      const credential = await getCredential(options);

      // Convert to JSON
      const credentialResponse = authenticationCredentialToJSON(credential);

      // Verify with server
      const result = await verifyAuthentication(deviceId, credentialResponse);

      if (result.verified) {
        onLogin({
          staffId: result.staffId,
          name: result.name,
          role: result.role as 'STAFF' | 'ADMIN',
          sessionToken: result.sessionToken,
        });
      } else {
        throw new Error('Authentication verification failed');
      }
    } catch (error) {
      console.error('WebAuthn login error:', error);
      setError(error instanceof Error ? error.message : 'Fingerprint authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!staffLookup.trim() || !pin.trim()) {
      setError('Please enter your name/ID and PIN');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auth/login-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffLookup: staffLookup.trim(),
          deviceId,
          pin: pin.trim(),
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(getErrorMessage(errorPayload) || 'Login failed');
      }

      const payload: unknown = await response.json();
      const session = parseStaffSession(payload);
      if (!session) {
        throw new Error('Invalid login response');
      }
      onLogin(session);
      setPin('');
      setStaffLookup('');
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Invalid credentials');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card padding="lg">
          <div className="mb-6">
            <div className="text-sm font-semibold text-indigo-600">Employee Register</div>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">Staff Login</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in with fingerprint or PIN</p>
          </div>

          <div className="mb-4 flex gap-2">
            {webauthnSupported ? (
              <Button
                variant={mode === 'webauthn' ? 'primary' : 'secondary'}
                className="flex-1"
                onClick={() => {
                  setMode('webauthn');
                  setError(null);
                }}
                disabled={isLoading}
              >
                Fingerprint
              </Button>
            ) : null}
            <Button
              variant={mode === 'pin' ? 'primary' : 'secondary'}
              className="flex-1"
              onClick={() => {
                setMode('pin');
                setError(null);
              }}
              disabled={isLoading}
            >
              PIN
            </Button>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {mode === 'webauthn' ? (
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Enter your name or staff ID"
                value={staffLookup}
                onChange={(e) => setStaffLookup(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
              <Button
                type="button"
                onClick={() => void handleWebAuthnLogin()}
                disabled={isLoading || !staffLookup.trim()}
                className="w-full"
              >
                {isLoading ? 'Authenticating…' : 'Sign in with fingerprint'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMode('pin');
                  setError(null);
                }}
                disabled={isLoading}
                className="w-full"
              >
                Use PIN instead
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Enter your name or staff ID"
                value={staffLookup}
                onChange={(e) => setStaffLookup(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
              <PinInput
                length={6}
                value={pin}
                onChange={(next) => setPin(next)}
                onSubmit={() => void handlePinSubmit()}
                submitLabel={isLoading ? 'Logging in…' : 'Login'}
                submitDisabled={isLoading || !staffLookup.trim()}
                disabled={isLoading}
                displayAriaLabel="Staff PIN"
              />
              {webauthnSupported ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setMode('webauthn');
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="w-full"
                >
                  Use fingerprint instead
                </Button>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
