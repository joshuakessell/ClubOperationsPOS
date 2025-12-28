import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface OfferResponse {
  offerId: string;
  status: string;
  shift: {
    id: string;
    startsAt: string;
    endsAt: string;
    shiftCode: string;
    role: string | null;
    status: string;
  };
}

export function ShiftClaimView() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<OfferResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const loadOffer = async () => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/open-shifts/offers/${token}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Offer not found');
        }
        const data = (await res.json()) as OfferResponse;
        setOffer(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load offer');
      } finally {
        setLoading(false);
      }
    };

    loadOffer();
  }, [token]);

  const handleClaim = async () => {
    if (!token) return;
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/open-shifts/offers/${token}/claim`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Already claimed or unavailable');
      }
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim shift');
    } finally {
      setClaiming(false);
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago' });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1221', color: '#f9fafb', padding: '1.5rem' }}>
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '2rem', maxWidth: '500px', width: '100%' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>Claim Open Shift</h1>

        {loading && <p>Loading shift details...</p>}
        {error && <p style={{ color: '#f87171' }}>{error}</p>}

        {!loading && !error && offer && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>Shift Code</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{offer.shift.shiftCode}</div>
              {offer.shift.role && (
                <div style={{ marginTop: '0.25rem', color: '#9ca3af' }}>Role: {offer.shift.role}</div>
              )}
            </div>
            <div style={{ marginBottom: '1rem', color: '#e5e7eb' }}>
              <div><strong>Starts:</strong> {formatDateTime(offer.shift.startsAt)}</div>
              <div><strong>Ends:</strong> {formatDateTime(offer.shift.endsAt)}</div>
            </div>
            {claimed ? (
              <div style={{ padding: '0.75rem', background: '#064e3b', borderRadius: '8px', marginBottom: '1rem' }}>
                ✓ Shift claimed successfully. Thank you!
              </div>
            ) : (
              <button
                onClick={handleClaim}
                disabled={claiming || offer.shift.status !== 'OPEN'}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: claiming ? '#6b7280' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: claiming ? 'not-allowed' : 'pointer',
                  marginBottom: '0.75rem',
                }}
              >
                {claiming ? 'Claiming...' : 'Claim this shift'}
              </button>
            )}
            {offer.shift.status !== 'OPEN' && !claimed && (
              <div style={{ color: '#f59e0b' }}>This shift is no longer available.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

