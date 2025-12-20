import { useState } from 'react';

const API_BASE = '/api';

interface ReAuthModalProps {
  sessionToken: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReAuthModal({ sessionToken, onSuccess, onCancel }: ReAuthModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin.trim()) {
      setError('Please enter your PIN');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/v1/auth/reauth-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          pin: pin.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Re-authentication failed');
      }

      onSuccess();
      setPin('');
    } catch (error) {
      console.error('Re-auth error:', error);
      setError(error instanceof Error ? error.message : 'Invalid PIN');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1002,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1f2937',
          padding: '2rem',
          borderRadius: '12px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', color: '#f9fafb' }}>
          Re-authentication Required
        </h2>
        <p style={{ marginBottom: '1.5rem', color: '#9ca3af', fontSize: '0.875rem' }}>
          This action requires re-authentication. Please enter your PIN to continue.
        </p>

        {error && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              background: '#7f1d1d',
              border: '1px solid #991b1b',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                color: '#f9fafb',
              }}
            >
              PIN
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              autoFocus
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#111827',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#f9fafb',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#374151',
                border: 'none',
                borderRadius: '6px',
                color: '#f9fafb',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !pin.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#8b5cf6',
                border: 'none',
                borderRadius: '6px',
                color: '#f9fafb',
                cursor: isLoading || !pin.trim() ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                opacity: isLoading || !pin.trim() ? 0.5 : 1,
              }}
            >
              {isLoading ? 'Verifying...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

