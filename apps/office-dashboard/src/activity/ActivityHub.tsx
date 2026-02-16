import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StaffSession } from '../LockScreen';
import { PanelContent } from '../views/PanelContent';
import { PanelHeader } from '../views/PanelHeader';
import { PanelShell } from '../views/PanelShell';
import { RaisedCard } from '../views/RaisedCard';
import {
  fetchActivityLog,
  fetchActivityStats,
  fetchAuditLog,
  fetchHourlyHeatmap,
  fetchLaborCost,
  fetchOperationsSummary,
  fetchRevenueBreakdown,
  fetchRevenueTrend,
  type ActivityEvent,
  type ActivityStats,
  type AuditEvent,
  type HeatmapData,
  type LaborCostReport,
  type OperationsSummary,
  type RevenueBreakdown,
  type RevenueTrend,
} from '../api/activity';
import { HeatmapChart } from './charts/HeatmapChart';
import { BarChart } from './charts/BarChart';
import { DonutChart } from './charts/DonutChart';

type Tab = 'activity' | 'operations' | 'labor' | 'financial';

const TABS: { key: Tab; label: string }[] = [
  { key: 'activity', label: '📋 Activity Log' },
  { key: 'operations', label: '📊 Operations' },
  { key: 'labor', label: '👥 Staff & Labor' },
  { key: 'financial', label: '💰 Financial' },
];

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmt$(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Main Component ──

export function ActivityHub({ session }: { session: StaffSession }) {
  const [tab, setTab] = useState<Tab>('activity');

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto' }}>
      <PanelShell spacing="md">
        <PanelHeader title="Operations Hub" />
        <PanelContent padding="md">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`cs-liquid-button ${tab !== t.key ? 'cs-liquid-button--secondary' : ''}`}
                onClick={() => setTab(t.key)}
                style={{ fontSize: '0.85rem' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </PanelContent>
      </PanelShell>

      {tab === 'activity' && <ActivityLogTab session={session} />}
      {tab === 'operations' && <OperationsTab session={session} />}
      {tab === 'labor' && <LaborTab session={session} />}
      {tab === 'financial' && <FinancialTab session={session} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Tab 1: Activity Log (enhanced from original)
// ════════════════════════════════════════════════════════════════

function ActivityLogTab({ session }: { session: StaffSession }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [actionType, setActionType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null);
  const [logMode, setLogMode] = useState<'activity' | 'audit'>('activity');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const auth = useMemo(() => ({ sessionToken: session.sessionToken }), [session.sessionToken]);

  const runSearch = useCallback(
    async (reset: boolean) => {
      const controller = new AbortController();
      try {
        setError(null);
        setBusy(true);

        if (logMode === 'activity') {
          const [data, statsData] = await Promise.all([
            fetchActivityLog(
              auth,
              { q, category, actionType, from, to, cursor: reset ? undefined : (nextCursor ?? undefined), limit: 50 },
              controller.signal
            ),
            reset
              ? fetchActivityStats(auth, { from, to, category, actionType }, controller.signal)
              : Promise.resolve(null),
          ]);
          setEvents((prev) => (reset ? data.events : [...prev, ...data.events]));
          setNextCursor(data.nextCursor);
          if (statsData) setStats(statsData);
        } else {
          const data = await fetchAuditLog(
            auth,
            { from, to, cursor: reset ? undefined : (auditNextCursor ?? undefined), limit: 50 },
            controller.signal
          );
          setAuditEvents((prev) => (reset ? data.events : [...prev, ...data.events]));
          setAuditNextCursor(data.nextCursor);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load log');
      } finally {
        setBusy(false);
      }
    },
    [auth, q, category, actionType, from, to, nextCursor, auditNextCursor, logMode]
  );

  useEffect(() => {
    void runSearch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logMode]);

  const applyFilters = () => {
    setNextCursor(null);
    setAuditNextCursor(null);
    void runSearch(true);
  };

  const exportCsv = () => {
    if (events.length === 0) return;
    const header = ['occurredAt', 'customerName', 'customerId', 'category', 'type', 'summary', 'staff'];
    const rows = events.map((e) => [
      e.occurredAt, e.customerName, e.customerId, e.actionCategory,
      e.actionType, e.summary.replaceAll('\n', ' '), e.actorStaffName || '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Filters */}
      <PanelShell spacing="md">
        <PanelContent padding="md">
          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid var(--error)', borderRadius: 8, color: 'var(--error)' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={`cs-liquid-button ${logMode === 'activity' ? '' : 'cs-liquid-button--secondary'}`}
                onClick={() => setLogMode('activity')}
                style={{ fontSize: '0.8rem' }}
              >
                Customer Activity
              </button>
              <button
                className={`cs-liquid-button ${logMode === 'audit' ? '' : 'cs-liquid-button--secondary'}`}
                onClick={() => setLogMode('audit')}
                style={{ fontSize: '0.8rem' }}
              >
                Staff Audit Trail
              </button>
            </div>
            <div className="cs-liquid-search" style={{ minWidth: 300, flex: 1 }}>
              <input
                className="cs-liquid-input cs-liquid-search__input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
              />
              <div className="cs-liquid-search__icon">🔎</div>
            </div>
            {logMode === 'activity' && (
              <>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="cs-liquid-input" style={{ minWidth: 160 }}>
                  <option value="">All categories</option>
                  <option value="CHECKIN">Check-in</option>
                  <option value="CHECKOUT">Checkout</option>
                  <option value="UPGRADE">Upgrades</option>
                  <option value="PURCHASE">Purchases</option>
                  <option value="RESOURCE_CHANGE">Resource</option>
                  <option value="NOTE">Notes</option>
                </select>
                <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="cs-liquid-input" style={{ minWidth: 180 }}>
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
              </>
            )}
            <input className="cs-liquid-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className="cs-liquid-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <button className="cs-liquid-button" disabled={busy} onClick={applyFilters}>
              {busy ? 'Loading…' : 'Apply'}
            </button>
            {logMode === 'activity' && (
              <button className="cs-liquid-button cs-liquid-button--secondary" onClick={exportCsv}>
                Export CSV
              </button>
            )}
          </div>
        </PanelContent>
      </PanelShell>

      {/* Stats Cards (activity mode only) */}
      {logMode === 'activity' && stats && (
        <PanelShell spacing="md">
          <PanelContent padding="md">
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', flex: 1 }}>
                <div className="stat-card">
                  <span className="stat-value">{stats.totalEvents}</span>
                  <span className="stat-label">Total Events</span>
                </div>
                {stats.byCategory.slice(0, 3).map((c) => (
                  <div className="stat-card stat-available" key={c.category}>
                    <span className="stat-value">{c.count}</span>
                    <span className="stat-label">{c.category}</span>
                  </div>
                ))}
              </section>
              <div style={{ flex: 1, minWidth: 300 }}>
                <BarChart
                  data={stats.hourlyDistribution.map((h) => ({
                    label: h.label.slice(0, 2),
                    value: h.count,
                  }))}
                  title="Events by Hour"
                  height={120}
                />
              </div>
            </div>
          </PanelContent>
        </PanelShell>
      )}

      {/* Event Table */}
      <RaisedCard>
        {logMode === 'activity' ? (
          <>
            {events.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No events.</div>
            ) : (
              <table className="rooms-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Category</th>
                    <th>Summary</th>
                    <th>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} onClick={() => toggleRow(e.id)} style={{ cursor: 'pointer' }}>
                      <td className="room-number">{new Date(e.occurredAt).toLocaleString()}</td>
                      <td>
                        <button
                          className="cs-liquid-button cs-liquid-button--secondary"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            navigate(`/customers?customerId=${e.customerId}&centerEventId=${e.id}`);
                          }}
                          style={{ fontSize: '0.8rem' }}
                        >
                          {e.customerName}
                        </button>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: 12,
                          backgroundColor: 'var(--surface-raised, #eee)',
                          fontWeight: 500,
                        }}>
                          {e.actionCategory}
                        </span>
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
          </>
        ) : (
          <>
            {auditEvents.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No audit events.</div>
            ) : (
              <table className="rooms-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Staff</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((e) => (
                    <Fragment key={e.id}>
                      <tr onClick={() => toggleRow(e.id)} style={{ cursor: 'pointer' }}>
                        <td className="room-number">{new Date(e.createdAt).toLocaleString()}</td>
                        <td>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: 12,
                            backgroundColor: e.action === 'OVERRIDE' ? 'rgba(239,68,68,0.15)' : 'var(--surface-raised, #eee)',
                            color: e.action === 'OVERRIDE' ? '#ef4444' : undefined,
                            fontWeight: 500,
                          }}>
                            {e.action}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {e.entityType}
                          <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: '0.7rem' }}>
                            {e.entityId.slice(0, 8)}…
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{e.staffName || e.userId || '—'}</td>
                        <td>
                          {e.overrideReason && (
                            <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                              Override: {e.overrideReason}
                            </span>
                          )}
                          {expandedRows.has(e.id) ? ' ▲' : ' ▼'}
                        </td>
                      </tr>
                      {expandedRows.has(e.id) && (
                        <tr>
                          <td colSpan={5} style={{ backgroundColor: 'var(--surface-raised, #f8f9fa)', padding: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
                              {e.oldValue != null && (
                                <div>
                                  <strong>Previous Value</strong>
                                  <pre style={{ fontSize: '0.7rem', maxHeight: 200, overflow: 'auto', margin: '0.25rem 0' }}>
                                    {JSON.stringify(e.oldValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {e.newValue != null && (
                                <div>
                                  <strong>New Value</strong>
                                  <pre style={{ fontSize: '0.7rem', maxHeight: 200, overflow: 'auto', margin: '0.25rem 0' }}>
                                    {JSON.stringify(e.newValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {e.metadata != null && (
                                <div>
                                  <strong>Metadata</strong>
                                  <pre style={{ fontSize: '0.7rem', maxHeight: 200, overflow: 'auto', margin: '0.25rem 0' }}>
                                    {JSON.stringify(e.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
              <button
                className="cs-liquid-button"
                disabled={busy || !auditNextCursor}
                onClick={() => void runSearch(false)}
              >
                {auditNextCursor ? (busy ? 'Loading…' : 'Load more') : 'No more'}
              </button>
            </div>
          </>
        )}
      </RaisedCard>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
//  Tab 2: Operations Dashboard
// ════════════════════════════════════════════════════════════════

function OperationsTab({ session }: { session: StaffSession }) {
  const [from, setFrom] = useState(toDateInput(new Date()));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useMemo(() => ({ sessionToken: session.sessionToken }), [session.sessionToken]);

  const load = useCallback(async () => {
    const controller = new AbortController();
    try {
      setError(null);
      setBusy(true);
      const [s, h] = await Promise.all([
        fetchOperationsSummary(auth, { from, to }, controller.signal),
        fetchHourlyHeatmap(auth, { weeks: 4 }, controller.signal),
      ]);
      setSummary(s);
      setHeatmap(h);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setBusy(false);
    }
  }, [auth, from, to]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      {/* Date controls */}
      <PanelShell spacing="md">
        <PanelContent padding="md">
          {error && <div style={{ marginBottom: '0.75rem', padding: '0.5rem', border: '1px solid var(--error)', borderRadius: 8, color: 'var(--error)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="cs-liquid-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input className="cs-liquid-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <button className="cs-liquid-button" disabled={busy} onClick={load}>
              {busy ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </PanelContent>
      </PanelShell>

      {summary && (
        <>
          {/* KPI Cards */}
          <PanelShell spacing="md">
            <PanelHeader title="Key Metrics" />
            <PanelContent padding="md">
              <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="stat-card">
                  <span className="stat-value">{fmt$(summary.revenue.total)}</span>
                  <span className="stat-label">Revenue</span>
                </div>
                <div className="stat-card stat-available">
                  <span className="stat-value">{summary.activity.checkIns}</span>
                  <span className="stat-label">Check-Ins</span>
                </div>
                <div className="stat-card stat-cleaning">
                  <span className="stat-value">{summary.occupancy.rate}%</span>
                  <span className="stat-label">Occupancy</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{summary.labor.totalHours}h</span>
                  <span className="stat-label">Labor Hours</span>
                </div>
                <div className="stat-card stat-available">
                  <span className="stat-value">{fmt$(summary.revenue.avgTransaction)}</span>
                  <span className="stat-label">Avg Transaction</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{fmt$(summary.labor.revenuePerLaborHour)}</span>
                  <span className="stat-label">Revenue / Labor Hr</span>
                </div>
                <div className="stat-card stat-cleaning">
                  <span className="stat-value">{fmt$(summary.tips.totalDollars)}</span>
                  <span className="stat-label">Tips</span>
                </div>
                <div className="stat-card" style={summary.overrides > 0 ? { borderLeft: '3px solid #ef4444' } : {}}>
                  <span className="stat-value">{summary.overrides}</span>
                  <span className="stat-label">Overrides</span>
                </div>
              </section>
            </PanelContent>
          </PanelShell>

          {/* Heatmap */}
          {heatmap && (
            <PanelShell spacing="md">
              <PanelHeader title="Activity Heatmap (Last 4 Weeks)" />
              <PanelContent padding="md">
                <HeatmapChart data={heatmap.activityGrid} title="Check-ins & Events by Hour × Day" />
              </PanelContent>
            </PanelShell>
          )}
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
//  Tab 3: Staff & Labor
// ════════════════════════════════════════════════════════════════

function LaborTab({ session }: { session: StaffSession }) {
  const [from, setFrom] = useState(toDateInput(new Date()));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [hourlyRate, setHourlyRate] = useState('15');
  const [data, setData] = useState<LaborCostReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useMemo(() => ({ sessionToken: session.sessionToken }), [session.sessionToken]);

  const load = useCallback(async () => {
    const controller = new AbortController();
    try {
      setError(null);
      setBusy(true);
      const result = await fetchLaborCost(
        auth,
        { from, to, hourlyRate: parseFloat(hourlyRate) || 15 },
        controller.signal
      );
      setData(result);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setBusy(false);
    }
  }, [auth, from, to, hourlyRate]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PanelShell spacing="md">
        <PanelContent padding="md">
          {error && <div style={{ marginBottom: '0.75rem', padding: '0.5rem', border: '1px solid var(--error)', borderRadius: 8, color: 'var(--error)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="cs-liquid-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input className="cs-liquid-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
              Rate $/hr:
              <input className="cs-liquid-input" type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} style={{ width: 70 }} />
            </label>
            <button className="cs-liquid-button" disabled={busy} onClick={load}>
              {busy ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </PanelContent>
      </PanelShell>

      {data && (
        <>
          {/* Totals */}
          <PanelShell spacing="md">
            <PanelHeader title="Labor Summary" />
            <PanelContent padding="md">
              <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <div className="stat-card">
                  <span className="stat-value">{data.totals.scheduledHours}h</span>
                  <span className="stat-label">Scheduled</span>
                </div>
                <div className="stat-card stat-available">
                  <span className="stat-value">{data.totals.actualHours}h</span>
                  <span className="stat-label">Actual</span>
                </div>
                <div className="stat-card stat-cleaning">
                  <span className="stat-value">{fmt$(data.totals.laborCost)}</span>
                  <span className="stat-label">Labor Cost</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{fmt$(data.totals.totalRevenue)}</span>
                  <span className="stat-label">Revenue</span>
                </div>
                <div className="stat-card stat-available">
                  <span className="stat-value">{fmt$(data.totals.revenuePerLaborHour)}</span>
                  <span className="stat-label">Revenue / Hr</span>
                </div>
              </section>
            </PanelContent>
          </PanelShell>

          {/* Scheduled vs Actual chart */}
          <PanelShell spacing="md">
            <PanelHeader title="Scheduled vs. Actual Hours" />
            <PanelContent padding="md">
              <BarChart
                data={data.employees
                  .filter((e) => e.scheduledHours > 0 || e.actualHours > 0)
                  .map((e) => ({
                    label: e.employeeName.split(' ')[0] || e.employeeName,
                    value: e.actualHours,
                    color: e.variance > 1 ? '#ef4444' : e.variance < -1 ? '#f59e0b' : '#10b981',
                  }))}
                title=""
                orientation="horizontal"
                formatValue={(v) => `${v}h`}
              />
            </PanelContent>
          </PanelShell>

          {/* Employee table */}
          <RaisedCard>
            <table className="rooms-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Scheduled</th>
                  <th>Actual</th>
                  <th>Variance</th>
                  <th>Labor Cost</th>
                  <th>Revenue</th>
                  <th>Rev/Hr</th>
                  <th>OT</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e) => (
                  <tr key={e.employeeId}>
                    <td>{e.employeeName}</td>
                    <td>{e.scheduledHours}h</td>
                    <td>{e.actualHours}h</td>
                    <td style={{ color: e.variance > 1 ? '#ef4444' : e.variance < -1 ? '#f59e0b' : '#10b981' }}>
                      {e.variance > 0 ? '+' : ''}{e.variance}h
                    </td>
                    <td>{fmt$(e.laborCost)}</td>
                    <td>{fmt$(e.revenueAttributed)}</td>
                    <td>{fmt$(e.revenuePerHour)}</td>
                    <td style={{ color: e.overtimeHours > 0 ? '#ef4444' : undefined }}>
                      {e.overtimeHours > 0 ? `${e.overtimeHours}h` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RaisedCard>
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
//  Tab 4: Financial
// ════════════════════════════════════════════════════════════════

function FinancialTab({ session }: { session: StaffSession }) {
  const [from, setFrom] = useState(toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [breakdown, setBreakdown] = useState<RevenueBreakdown | null>(null);
  const [trend, setTrend] = useState<RevenueTrend | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useMemo(() => ({ sessionToken: session.sessionToken }), [session.sessionToken]);

  const load = useCallback(async () => {
    const controller = new AbortController();
    try {
      setError(null);
      setBusy(true);
      const [b, t] = await Promise.all([
        fetchRevenueBreakdown(auth, { from, to }, controller.signal),
        fetchRevenueTrend(auth, { days: 30 }, controller.signal),
      ]);
      setBreakdown(b);
      setTrend(t);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setBusy(false);
    }
  }, [auth, from, to]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PanelShell spacing="md">
        <PanelContent padding="md">
          {error && <div style={{ marginBottom: '0.75rem', padding: '0.5rem', border: '1px solid var(--error)', borderRadius: 8, color: 'var(--error)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="cs-liquid-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input className="cs-liquid-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <button className="cs-liquid-button" disabled={busy} onClick={load}>
              {busy ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </PanelContent>
      </PanelShell>

      {trend && (
        <PanelShell spacing="md">
          <PanelHeader title="Revenue Trend (30 Days)" />
          <PanelContent padding="md">
            <BarChart
              data={trend.trend.map((d) => ({
                label: d.date.slice(5),
                value: d.revenue,
              }))}
              height={200}
              formatValue={fmt$}
            />
          </PanelContent>
        </PanelShell>
      )}

      {breakdown && (
        <>
          <PanelShell spacing="md">
            <PanelHeader title="Revenue Breakdown" />
            <PanelContent padding="md">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <DonutChart
                  segments={breakdown.byPaymentMethod.map((m) => ({
                    label: m.method,
                    value: m.total,
                    color: m.method === 'CASH' ? '#10b981' : m.method === 'CREDIT' ? '#6366f1' : '#9ca3af',
                  }))}
                  title="By Payment Method"
                  formatValue={fmt$}
                />
                {breakdown.byRentalType.length > 0 && (
                  <DonutChart
                    segments={breakdown.byRentalType.map((r, i) => ({
                      label: r.rentalType.replace(/_/g, ' '),
                      value: r.total,
                      color: ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'][i % 5]!,
                    }))}
                    title="By Rental Type"
                    formatValue={fmt$}
                  />
                )}
              </div>
            </PanelContent>
          </PanelShell>

          <PanelShell spacing="md">
            <PanelHeader title="Revenue by Day of Week" />
            <PanelContent padding="md">
              <BarChart
                data={breakdown.byDayOfWeek.map((d) => ({
                  label: d.dayName,
                  value: d.total,
                }))}
                height={180}
                formatValue={fmt$}
              />
            </PanelContent>
          </PanelShell>

          <PanelShell spacing="md">
            <PanelHeader title="Tips" />
            <PanelContent padding="md">
              <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <div className="stat-card">
                  <span className="stat-value">{fmt$(breakdown.tips.totalDollars)}</span>
                  <span className="stat-label">Total Tips</span>
                </div>
                <div className="stat-card stat-available">
                  <span className="stat-value">{fmt$(breakdown.tips.avgTipDollars)}</span>
                  <span className="stat-label">Avg Tip</span>
                </div>
                <div className="stat-card stat-cleaning">
                  <span className="stat-value">{breakdown.tips.tipCount}</span>
                  <span className="stat-label">Tip Count</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{breakdown.tips.tipPercentOfRevenue}%</span>
                  <span className="stat-label">Tip % of Revenue</span>
                </div>
              </section>
            </PanelContent>
          </PanelShell>
        </>
      )}
    </>
  );
}
