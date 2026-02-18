import { useEffect, useMemo, useState } from 'react';
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

type Filters = {
  q: string;
  category: string;
  actionType: string;
  from: string;
  to: string;
};

export function ActivityLogView({ session }: { session: StaffSession }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('');
  const [actionType, setActionType] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const filters: Filters = { q, category, actionType, from, to };

  const runSearch = async (reset: boolean) => {
    try {
      setError(null);
      setBusy(true);
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.category) params.set('actionCategories', filters.category);
      if (filters.actionType) params.set('actionTypes', filters.actionType);
      if (filters.from) params.set('from', new Date(filters.from).toISOString());
      if (filters.to) params.set('to', new Date(filters.to).toISOString());
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

  const applyFilters = () => {
    setNextCursor(null);
    void runSearch(true);
  };

  const exportCsv = () => {
    if (events.length === 0) return;
    const header = ['occurredAt', 'customerName', 'customerId', 'category', 'type', 'summary', 'staff'];
    const rows = events.map((e) => [
      e.occurredAt,
      e.customerName,
      e.customerId,
      e.actionCategory,
      e.actionType,
      e.summary.replaceAll('\n', ' '),
      e.actorStaffName || '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalEvents = events.length;
  const uniqueCustomers = useMemo(
    () => new Set(events.map((e) => e.customerId)).size,
    [events]
  );
  const revenueEvents = useMemo(
    () => events.filter((e) => e.actionCategory === 'PURCHASE').length,
    [events]
  );

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
            <div className="relative w-full" style={{ minWidth: 360 }}>
              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-9 pr-4 text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search (customer, staff, order id, room #)"
              />
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔎</div>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
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
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              style={{ minWidth: 220 }}
            >
              <option value="">All types</option>
              <option value="CHECKIN_STARTED">Check-in started</option>
              <option value="CHECKIN_COMPLETED">Check-in completed</option>
              <option value="CHECKOUT_REQUEST_CREATED">Checkout requested</option>
              <option value="CHECKOUT_COMPLETED">Checkout completed</option>
              <option value="UPGRADE_STARTED">Upgrade started</option>
              <option value="UPGRADE_COMPLETED">Upgrade completed</option>
              <option value="ORDER_PAID">Order paid</option>
              <option value="ADDON_PURCHASED">Add-on purchased</option>
              <option value="ROOM_CHANGED">Room changed</option>
              <option value="LOCKER_CHANGED">Locker changed</option>
              <option value="NOTE_ADDED">Note added</option>
              <option value="PAST_DUE_WAIVED">Past due waived</option>
            </select>
            <input
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <button
              className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
              disabled={busy}
              onClick={applyFilters}
            >
              {busy ? 'Loading…' : 'Apply'}
            </button>
            <button className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 font-semibold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        </PanelContent>
      </PanelShell>

      <PanelShell spacing="md">
        <PanelHeader title="Log Summary" />
        <PanelContent padding="md">
          <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <span className="stat-value">{totalEvents}</span>
              <span className="stat-label">Events Loaded</span>
            </div>
            <div className="stat-card stat-available">
              <span className="stat-value">{uniqueCustomers}</span>
              <span className="stat-label">Unique Customers</span>
            </div>
            <div className="stat-card stat-cleaning">
              <span className="stat-value">{revenueEvents}</span>
              <span className="stat-label">Purchase Events</span>
            </div>
          </section>
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
                      className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 font-semibold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50"
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
            className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
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
