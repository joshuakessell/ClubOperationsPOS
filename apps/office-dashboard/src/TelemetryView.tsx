import { useEffect, useMemo, useState } from 'react';
import type { StaffSession } from './LockScreen';
import { apiJson } from './api';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

type TelemetryRow = {
  id: string;
  created_at: string;
  app: string;
  kind: string;
  level: 'error' | 'warn' | 'info' | string;
  message: string | null;
  route: string | null;
  request_id: string | null;
};

export function TelemetryView({ session }: { session: StaffSession }) {
  const [events, setEvents] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limit, setLimit] = useState(200);
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return events.filter((e) => {
      if (level !== 'all' && e.level !== level) return false;
      if (!s) return true;
      const hay = [
        e.app,
        e.kind,
        e.level,
        e.message ?? '',
        e.route ?? '',
        e.request_id ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(s);
    });
  }, [events, level, q]);

  const load = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await apiJson<{ events: TelemetryRow[] }>(
        `/v1/admin/telemetry/recent?limit=${encodeURIComponent(String(limit))}`,
        { sessionToken: session.sessionToken }
      );
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, limit]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <section className="panel" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header">
          <h2>Telemetry</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
        <div className="panel-content" style={{ padding: '1.25rem' }}>
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

          <Card padding="md" className="bg-white">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[280px] flex-1">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search (app/kind/message/route/requestId)…"
                />
              </div>

              <label className="text-sm font-semibold text-gray-700">
                Level{' '}
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as any)}
                  className="ml-2 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-600 focus:ring-indigo-600/30"
                >
                  <option value="all">All</option>
                  <option value="error">error</option>
                  <option value="warn">warn</option>
                  <option value="info">info</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-gray-700">
                Limit{' '}
                <select
                  value={String(limit)}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="ml-2 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-600 focus:ring-indigo-600/30"
                >
                  {[50, 100, 200].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                Auto-refresh
              </label>

              <div className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-700">{filtered.length}</span> / {events.length}
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Recent events</h2>
        </div>
        <div className="panel-content" style={{ padding: '1.25rem' }}>
          <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">App</th>
                  <th className="px-3 py-2 font-semibold">Kind</th>
                  <th className="px-3 py-2 font-semibold">Level</th>
                  <th className="px-3 py-2 font-semibold">Message</th>
                  <th className="px-3 py-2 font-semibold">Route</th>
                  <th className="px-3 py-2 font-semibold">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-gray-500" colSpan={7}>
                      No events found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => {
                    const dt = new Date(e.created_at);
                    const timeText = Number.isFinite(dt.getTime())
                      ? dt.toLocaleString()
                      : e.created_at;

                    const levelClass =
                      e.level === 'error'
                        ? 'text-red-700 bg-red-50 ring-red-200'
                        : e.level === 'warn'
                          ? 'text-amber-700 bg-amber-50 ring-amber-200'
                          : 'text-gray-700 bg-gray-50 ring-gray-200';

                    return (
                      <tr key={e.id} className="align-top">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{timeText}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-semibold text-gray-900">
                          {e.app}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900">{e.kind}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${levelClass}`}>
                            {e.level}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-900 max-w-[520px]">
                          <div className="whitespace-pre-wrap break-words">{e.message ?? ''}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                          {e.route ?? ''}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-700">
                          {e.request_id ?? ''}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

