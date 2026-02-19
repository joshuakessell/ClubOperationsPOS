import { useState, useEffect, useCallback } from 'react';
import { PanelContent } from './views/PanelContent';
import { PanelHeader } from './views/PanelHeader';
import { PanelShell } from './views/PanelShell';
import { RaisedCard } from './views/RaisedCard';
import type { StaffSession } from './LockScreen';

// ---------------------------------------------------------------------------
// API base — same pattern as other office-dashboard views
// ---------------------------------------------------------------------------
const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_API_URL) ||
  '/api';

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------
type EmployeeSummary = {
  staffId: string;
  staffName: string;
  checkins: number;
  salesCount: number;
  salesTotalCents: number;
  shiftHours: number;
};

type RegisterSales = {
  registerId: string;
  saleCount: number;
  totalCents: number;
  avgCents: number;
};

type HourlySales = {
  bucket: string;
  saleCount: number;
  totalCents: number;
};

type TopItem = {
  eventType: string;
  saleCount: number;
  totalCents: number;
};

type DaySummary = {
  date: string;
  checkins: number;
  checkouts: number;
  salesCount: number;
  salesTotalCents: number;
  clockIns: number;
  breaks: number;
  notes: number;
  overrides: number;
};

type CustomerSpend = {
  customerId: string;
  customerName: string | null;
  saleCount: number;
  totalCents: number;
  avgCents: number;
  visitCount: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function friendlyEventType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// One-week default range
function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86400000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function isoToDate(iso: string): string {
  return iso.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Generic fetcher
// ---------------------------------------------------------------------------
async function fetchAnalytics<T>(endpoint: string, token: string, range: { from: string; to: string }): Promise<T> {
  const sp = new URLSearchParams();
  sp.set('from', range.from);
  sp.set('to', range.to);
  const res = await fetch(`${API_BASE}${endpoint}?${sp.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint} (${res.status})`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ClubAnalyticsView({ session }: { session: StaffSession }) {
  const [range, setRange] = useState(defaultRange);

  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [registers, setRegisters] = useState<RegisterSales[]>([]);
  const [hourly, setHourly] = useState<HourlySales[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [daily, setDaily] = useState<DaySummary[]>([]);
  const [customers, setCustomers] = useState<CustomerSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, regRes, hourRes, itemRes, dayRes, custRes] = await Promise.all([
        fetchAnalytics<{ employees: EmployeeSummary[] }>('/v1/admin/club-analytics/employee-summary', session.sessionToken, range),
        fetchAnalytics<{ registers: RegisterSales[] }>('/v1/admin/club-analytics/sales-by-register', session.sessionToken, range),
        fetchAnalytics<{ hourly: HourlySales[] }>('/v1/admin/club-analytics/sales-by-hour', session.sessionToken, range),
        fetchAnalytics<{ items: TopItem[] }>('/v1/admin/club-analytics/top-items', session.sessionToken, range),
        fetchAnalytics<{ days: DaySummary[] }>('/v1/admin/club-analytics/daily-summary', session.sessionToken, range),
        fetchAnalytics<{ customers: CustomerSpend[] }>('/v1/admin/club-analytics/customer-spending', session.sessionToken, range),
      ]);
      setEmployees(empRes.employees ?? []);
      setRegisters(regRes.registers ?? []);
      setHourly(hourRes.hourly ?? []);
      setTopItems(itemRes.items ?? []);
      setDaily(dayRes.days ?? []);
      setCustomers(custRes.customers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [session.sessionToken, range]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Aggregated totals
  const totalRevenue = daily.reduce((s, d) => s + d.salesTotalCents, 0);
  const totalCheckins = daily.reduce((s, d) => s + d.checkins, 0);
  const totalSales = daily.reduce((s, d) => s + d.salesCount, 0);
  const totalClockIns = daily.reduce((s, d) => s + d.clockIns, 0);

  return (
    <PanelShell spacing="md">
      <PanelHeader title="Club Analytics" />
      <PanelContent padding="md">
        {/* ────────── Date Range Picker ────────── */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>From:</label>
          <input
            type="date"
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            value={isoToDate(range.from)}
            onChange={(e) => {
              const d = new Date(e.target.value + 'T00:00:00');
              if (!isNaN(d.getTime())) setRange((prev) => ({ ...prev, from: d.toISOString() }));
            }}
          />
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>To:</label>
          <input
            type="date"
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            value={isoToDate(range.to)}
            onChange={(e) => {
              const d = new Date(e.target.value + 'T23:59:59');
              if (!isNaN(d.getTime())) setRange((prev) => ({ ...prev, to: d.toISOString() }));
            }}
          />
          <button
            className="rounded-lg bg-brand-500 px-4 py-1.5 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            disabled={loading}
            onClick={() => void loadData()}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading analytics…</div>
        ) : error ? (
          <div style={{ color: '#ef4444', fontWeight: 600 }}>{error}</div>
        ) : (
          <>
            {/* ────────── Stat Cards ────────── */}
            <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="stat-card">
                <span className="stat-value">{formatCurrency(totalRevenue)}</span>
                <span className="stat-label">Total Revenue</span>
              </div>
              <div className="stat-card stat-available">
                <span className="stat-value">{totalCheckins}</span>
                <span className="stat-label">Check-ins</span>
              </div>
              <div className="stat-card stat-cleaning">
                <span className="stat-value">{totalSales}</span>
                <span className="stat-label">Sales</span>
              </div>
              <div className="stat-card stat-occupied">
                <span className="stat-value">{totalClockIns}</span>
                <span className="stat-label">Clock-ins</span>
              </div>
            </section>

            {/* ────────── Employee Leaderboard ────────── */}
            <RaisedCard style={{ marginTop: '1.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
                👤 Employee Performance
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="rooms-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th style={{ textAlign: 'right' }}>Check-ins</th>
                      <th style={{ textAlign: 'right' }}>Sales</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Shift Hrs</th>
                      <th style={{ textAlign: 'right' }}>$ / Hr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e.staffId}>
                        <td className="room-number">{e.staffName}</td>
                        <td style={{ textAlign: 'right' }}>{e.checkins}</td>
                        <td style={{ textAlign: 'right' }}>{e.salesCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(e.salesTotalCents)}</td>
                        <td style={{ textAlign: 'right' }}>{e.shiftHours.toFixed(1)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          {e.shiftHours > 0 ? formatCurrency(e.salesTotalCents / e.shiftHours) : '—'}
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </RaisedCard>

            {/* ────────── Two-Column: Register Sales + Sale Types ────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              <RaisedCard>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>💰 Sales by Register</div>
                <table className="rooms-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Register</th>
                      <th style={{ textAlign: 'right' }}>Sales</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>AOV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registers.map((r) => (
                      <tr key={r.registerId}>
                        <td className="room-number">{r.registerId}</td>
                        <td style={{ textAlign: 'right' }}>{r.saleCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(r.totalCents)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(r.avgCents)}</td>
                      </tr>
                    ))}
                    {registers.length === 0 && (
                      <tr><td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </RaisedCard>

              <RaisedCard>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>🏷️ Sale Types</div>
                <table className="rooms-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th style={{ textAlign: 'right' }}>Count</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((t) => (
                      <tr key={t.eventType}>
                        <td className="room-number">{friendlyEventType(t.eventType)}</td>
                        <td style={{ textAlign: 'right' }}>{t.saleCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(t.totalCents)}</td>
                      </tr>
                    ))}
                    {topItems.length === 0 && (
                      <tr><td colSpan={3} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </RaisedCard>
            </div>

            {/* ────────── Hourly Sales ────────── */}
            <RaisedCard style={{ marginTop: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>⏰ Sales by Hour</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="rooms-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Hour</th>
                      <th style={{ textAlign: 'right' }}>Sales</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourly.map((h) => (
                      <tr key={h.bucket}>
                        <td className="room-number">{h.bucket}</td>
                        <td style={{ textAlign: 'right' }}>{h.saleCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(h.totalCents)}</td>
                      </tr>
                    ))}
                    {hourly.length === 0 && (
                      <tr><td colSpan={3} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </RaisedCard>

            {/* ────────── Top Customers ────────── */}
            <RaisedCard style={{ marginTop: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>🏆 Top Customers</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="rooms-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Visits</th>
                      <th style={{ textAlign: 'right' }}>Sales</th>
                      <th style={{ textAlign: 'right' }}>Spent</th>
                      <th style={{ textAlign: 'right' }}>AOV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.slice(0, 20).map((c) => (
                      <tr key={c.customerId}>
                        <td className="room-number">{c.customerName ?? c.customerId.slice(0, 8)}</td>
                        <td style={{ textAlign: 'right' }}>{c.visitCount}</td>
                        <td style={{ textAlign: 'right' }}>{c.saleCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(c.totalCents)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(c.avgCents)}</td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr><td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </RaisedCard>

            {/* ────────── Daily Summary ────────── */}
            <RaisedCard style={{ marginTop: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📅 Daily Activity Summary</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="rooms-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Check-ins</th>
                      <th style={{ textAlign: 'right' }}>Checkouts</th>
                      <th style={{ textAlign: 'right' }}>Sales</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Clock-ins</th>
                      <th style={{ textAlign: 'right' }}>Breaks</th>
                      <th style={{ textAlign: 'right' }}>Notes</th>
                      <th style={{ textAlign: 'right' }}>Overrides</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((d) => (
                      <tr key={d.date}>
                        <td className="room-number">{d.date}</td>
                        <td style={{ textAlign: 'right' }}>{d.checkins}</td>
                        <td style={{ textAlign: 'right' }}>{d.checkouts}</td>
                        <td style={{ textAlign: 'right' }}>{d.salesCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(d.salesTotalCents)}</td>
                        <td style={{ textAlign: 'right' }}>{d.clockIns}</td>
                        <td style={{ textAlign: 'right' }}>{d.breaks}</td>
                        <td style={{ textAlign: 'right' }}>{d.notes}</td>
                        <td style={{ textAlign: 'right' }}>{d.overrides}</td>
                      </tr>
                    ))}
                    {daily.length === 0 && (
                      <tr><td colSpan={9} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </RaisedCard>
          </>
        )}
      </PanelContent>
    </PanelShell>
  );
}
