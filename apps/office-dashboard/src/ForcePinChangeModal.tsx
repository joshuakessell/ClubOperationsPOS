import { useState, type FormEvent } from 'react';
import { changePin } from './api/staffAuth';

interface ForcePinChangeModalProps {
  sessionToken: string;
  staffName: string;
  /** Called with the current PIN used (so caller can clear mustChangePin). */
  onComplete: () => void;
}

export function ForcePinChangeModal({
  sessionToken,
  staffName,
  onComplete,
}: ForcePinChangeModalProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isValid =
    /^\d{6}$/.test(currentPin) &&
    /^\d{6}$/.test(newPin) &&
    /^\d{6}$/.test(confirmPin) &&
    newPin === confirmPin &&
    newPin !== currentPin;

  const mismatch = confirmPin.length === 6 && newPin.length === 6 && newPin !== confirmPin;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match.');
      return;
    }
    if (newPin === currentPin) {
      setError('New PIN must be different from your current PIN.');
      return;
    }

    setBusy(true);
    try {
      await changePin(sessionToken, { currentPin, newPin, confirmPin });
      onComplete();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to change PIN. Please try again.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 shadow-theme-xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-gray-800 px-6 py-4">
            <h2 className="text-lg font-semibold text-white/90">Set Your New PIN</h2>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-4 px-6 py-5">
            <p className="text-sm text-gray-400">
              Welcome, <strong className="text-white/90">{staffName}</strong>. Your PIN has been
              reset by an administrator. Please choose a new 6-digit PIN.
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-400">
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  className="ml-2 text-error-400/60 hover:text-error-400"
                  onClick={() => setError(null)}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Current PIN (temporary)</label>
              <input
                type="password"
                maxLength={6}
                inputMode="numeric"
                pattern="\d{6}"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white/90 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">New PIN</label>
              <input
                type="password"
                maxLength={6}
                inputMode="numeric"
                pattern="\d{6}"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white/90 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Confirm New PIN</label>
              <input
                type="password"
                maxLength={6}
                inputMode="numeric"
                pattern="\d{6}"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className={`w-full rounded-lg border bg-gray-900 px-3 py-2.5 text-sm text-white/90 placeholder-gray-500 focus:outline-none focus:ring-2 ${
                  mismatch
                    ? 'border-error-500 focus:border-error-500 focus:ring-error-500/40'
                    : 'border-gray-700 focus:border-brand-500 focus:ring-brand-500/40'
                }`}
              />
              {mismatch && (
                <p className="text-xs text-error-400">PINs do not match</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-800 px-6 py-4">
            <button
              type="submit"
              disabled={!isValid || busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {busy ? 'Saving…' : 'Set PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
