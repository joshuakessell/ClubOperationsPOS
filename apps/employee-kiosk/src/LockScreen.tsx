import { useState, useEffect, type FormEvent } from 'react';
import { LiquidGlassPinInput } from '@club-ops/ui';
import { Alert, Button } from '@club-ops/ui/tailadmin';
import {
  isWebAuthnSupported,
  requestAuthenticationOptions,
  getCredential,
  authenticationCredentialToJSON,
  verifyAuthentication,
} from '@club-ops/ui';
import { getApiUrl } from '@club-ops/shared';

const API_BASE = getApiUrl('/api');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const err = value['error'];
  const msg = value['message'];
  if (typeof err === 'string' && err.trim()) return err;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return undefined;
}

function parseStaffSession(value: unknown): StaffSession | null {
  if (!isRecord(value)) return null;
  const staffId = value['staffId'];
  const name = value['name'];
  const role = value['role'];
  const sessionToken = value['sessionToken'];
  if (typeof staffId !== 'string') return null;
  if (typeof name !== 'string') return null;
  if (role !== 'STAFF' && role !== 'ADMIN') return null;
  if (typeof sessionToken !== 'string') return null;
  return { staffId, name, role, sessionToken };
}

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

const inputClass =
  'h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-white/30';

export function LockScreen({ onLogin, deviceId }: LockScreenProps) {
  const [mode, setMode] = useState<'webauthn' | 'pin'>('webauthn');
  const [staffLookup, setStaffLookup] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [webauthnSupported, setWebauthnSupported] = useState(false);

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
      const options = await requestAuthenticationOptions(staffLookup.trim(), deviceId);
      const credential = await getCredential(options);
      const credentialResponse = authenticationCredentialToJSON(credential);
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
    <div className="fixed inset-0 z-99999 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Staff Login</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sign in with fingerprint or PIN
          </p>
        </div>

        {/* Tab buttons */}
        <nav className="mb-5 flex overflow-hidden rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {webauthnSupported && (
            <button
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'webauthn'
                  ? 'bg-white text-gray-900 shadow-theme-xs dark:bg-white/[0.03] dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              onClick={() => {
                setMode('webauthn');
                setError(null);
              }}
              disabled={isLoading}
            >
              Fingerprint
            </button>
          )}
          <button
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'pin'
                ? 'bg-white text-gray-900 shadow-theme-xs dark:bg-white/[0.03] dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            onClick={() => {
              setMode('pin');
              setError(null);
            }}
            disabled={isLoading}
          >
            PIN
          </button>
        </nav>

        {/* Error */}
        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}

        {/* WebAuthn mode */}
        {mode === 'webauthn' ? (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              className={inputClass}
              placeholder="Enter your name or staff ID"
              value={staffLookup}
              onChange={(e) => setStaffLookup(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            <Button
              fullWidth
              onClick={() => void handleWebAuthnLogin()}
              disabled={isLoading || !staffLookup.trim()}
            >
              {isLoading ? 'Authenticating...' : 'Sign in with fingerprint'}
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setMode('pin');
                setError(null);
              }}
              disabled={isLoading}
            >
              Use PIN instead
            </Button>
          </div>
        ) : (
          /* PIN mode */
          <div className="flex flex-col gap-4">
            <input
              type="text"
              className={inputClass}
              placeholder="Enter your name or staff ID"
              value={staffLookup}
              onChange={(e) => setStaffLookup(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            <LiquidGlassPinInput
              length={6}
              value={pin}
              onChange={(next) => setPin(next)}
              onSubmit={() => void handlePinSubmit()}
              submitLabel={isLoading ? 'Logging in…' : 'Login'}
              submitDisabled={isLoading || !staffLookup.trim()}
              disabled={isLoading}
              displayAriaLabel="Staff PIN"
            />
            {webauthnSupported && (
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  setMode('webauthn');
                  setError(null);
                }}
                disabled={isLoading}
              >
                Use fingerprint instead
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
