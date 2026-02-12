import { useEffect, useState } from 'react';
import type { StaffSession } from './LockScreen';
import { apiJson } from './api';
import { PanelContent } from './views/PanelContent';
import { PanelHeader } from './views/PanelHeader';
import { PanelShell } from './views/PanelShell';
import { RaisedCard } from './views/RaisedCard';
import { useNavigate } from 'react-router-dom';

type ActivityEvent = {
  id: string;
  occurredAt: string;
  customerId: string;
  customerName: string;
  actionType: string;
  actionCategory: string;
  actorStaffName: string | null;
  summary: string;
};

export function ActivityLogView({ session }: { session: StaffSession }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const runSearch = async (reset: boolean) => {
    try {
      setError(null);
      setBusy(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (category) params.set('actionCategories', category);
      params.set('limit', '50');
      if (!reset && nextCursor) params.set('cursor', nextCursor);

      const data = await apiJson<{ events: ActivityEvent[]; nextCursor: string | null }>(
        `/v1/admin/activity-log?${params.toString()}`,
        { sessionToken: session.sessionToken }
      );
      setEvents((prev) => (reset ? data.events : [...prev, ...data.events]));
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity log');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void runSearch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PanelShell spacing="md">
        <PanelHeader title="Logs" />
        <PanelContent padding="md">
          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                border: '1px solid var(--error)',
                borderRadius: 8,
                color: 'var(--error)',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="cs-liquid-search" style={{ minWidth: 360 }}>
              <input
                className="cs-liquid-input cs-liquid-search__input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search (customer, staff, order id, room #)"
              />
              <div className="cs-liquid-search__icon">🔎</div>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="cs-liquid-input"
              style={{ minWidth: 220 }}
            >
              <option value="">All categories</option>
              <option value="CHECKIN">Check-in</option>
              <option value="CHECKOUT">Checkout</option>
              <option value="UPGRADE">Upgrades</option>
              <option value="PURCHASE">Purchases</option>
              <option value="RESOURCE_CHANGE">Resource changes</option>
              <option value="NOTE">Notes</option>
            </select>
            <button
              className="cs-liquid-button"
              disabled={busy}
              onClick={() => {
                setNextCursor(null);
                void runSearch(true);
              }}
            >
              {busy ? 'Loading…' : 'Apply'}
            </button>
          </div>
        </PanelContent>
      </PanelShell>

      <RaisedCard>
        {events.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No events.</div>
        ) : (
          <table className="rooms-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Summary</th>
                <th>Staff</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="room-number">{new Date(e.occurredAt).toLocaleString()}</td>
                  <td>
                    <button
                      className="cs-liquid-button cs-liquid-button--secondary"
                      onClick={() =>
                        navigate(`/customers?customerId=${e.customerId}&centerEventId=${e.id}`)
                      }
                    >
                      {e.customerName}
                    </button>
                  </td>
                  <td>{e.summary}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{e.actorStaffName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
          <button
            className="cs-liquid-button"
            disabled={busy || !nextCursor}
            onClick={() => void runSearch(false)}
          >
            {nextCursor ? (busy ? 'Loading…' : 'Load more') : 'No more'}
          </button>
        </div>
      </RaisedCard>
    </div>
  );
}
