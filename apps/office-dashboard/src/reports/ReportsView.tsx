import { useState, useEffect, useCallback } from 'react';
import {
  fetchDailySummary,
  fetchRevenueTrend,
  fetchStaffProductivity,
  type DailySummary,
  type RevenueTrendEntry,
  type StaffProductivityEntry,
} from '../api/reports';

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtitle,
  colorClass = 'text-brand-400',
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  colorClass?: string;
}) {
  return (
    <div className="flex-1 min-w-[150px] rounded-xl border border-gray-800 bg-white/[0.03] p-4">
      <span className="block mb-1 text-theme-xs text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <span className={`block text-3xl font-bold ${colorClass}`}>{value}</span>
      {subtitle && (
        <span className="block text-theme-xs text-gray-400">{subtitle}</span>
      )}
    </div>
  );
}

// ── Revenue Bar Chart (CSS-only) ─────────────────────────────

function RevenueTrendChart({ data }: { data: RevenueTrendEntry[] }) {
  if (data.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-gray-400">
        No revenue data available for this period.
      </p>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="flex items-end gap-0.5 h-[200px] px-1 pb-6">
      {data.map((entry, i) => {
        const height = (entry.revenue / maxRevenue) * 100;
        const isWeekend = [0, 6].includes(new Date(entry.date).getDay());
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-0.5 relative"
          >
            <div
              className={`w-full max-w-[30px] rounded-t transition-all duration-300 cursor-pointer hover:opacity-80 ${
                isWeekend ? 'bg-brand-400' : 'bg-brand-500'
              }`}
              style={{ height: `${Math.max(height, 2)}%` }}
              title={`${entry.date}: $${entry.revenue.toFixed(2)} (${entry.transactions} txns)`}
            />
            {i % Math.ceil(data.length / 10) === 0 && (
              <span className="absolute bottom-0 text-[9px] text-gray-400 whitespace-nowrap -rotate-45">
                {new Date(entry.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Staff Productivity Table ─────────────────────────────────

function StaffProductivityTable({ data }: { data: StaffProductivityEntry[] }) {
  const sorted = [...data].sort((a, b) => b.checkIns - a.checkIns);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-gray-800 bg-gray-900">
          <tr>
            <th className="px-4 py-3 text-left text-theme-xs font-semibold uppercase text-gray-400">
              Staff Member
            </th>
            <th className="px-4 py-3 text-right text-theme-xs font-semibold uppercase text-gray-400">
              Check-Ins
            </th>
            <th className="px-4 py-3 text-right text-theme-xs font-semibold uppercase text-gray-400">
              Payments
            </th>
            <th className="px-4 py-3 text-right text-theme-xs font-semibold uppercase text-gray-400">
              Revenue
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {sorted.map((s) => (
            <tr key={s.staffId} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-3 text-sm text-gray-300">{s.staffName}</td>
              <td className="px-4 py-3 text-sm text-gray-300 text-right">{s.checkIns}</td>
              <td className="px-4 py-3 text-sm text-gray-300 text-right">{s.paymentsProcessed}</td>
              <td className="px-4 py-3 text-sm text-gray-300 text-right">${s.revenueAttributed.toFixed(2)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                No staff activity data for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── ReportsView (main) ──────────────────────────────────────

interface ReportsViewProps {
  sessionToken: string;
}

const TAB_LABELS = ['Daily Summary', 'Revenue Trend', 'Staff Productivity'] as const;

export function ReportsView({ sessionToken }: ReportsViewProps) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Daily summary state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]!);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);

  // Revenue trend state
  const [trendDays, setTrendDays] = useState(30);
  const [trendData, setTrendData] = useState<RevenueTrendEntry[]>([]);

  // Staff productivity state
  const [productivityFrom, setProductivityFrom] = useState(
    new Date().toISOString().split('T')[0]!
  );
  const [productivityTo, setProductivityTo] = useState(new Date().toISOString().split('T')[0]!);
  const [staffData, setStaffData] = useState<StaffProductivityEntry[]>([]);

  const loadDailySummary = useCallback(
    async (date: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDailySummary(sessionToken, date);
        setDailySummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [sessionToken]
  );

  const loadTrend = useCallback(
    async (days: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRevenueTrend(sessionToken, days);
        setTrendData(data.trend);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [sessionToken]
  );

  const loadProductivity = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchStaffProductivity(sessionToken, { from, to });
        setStaffData(data.staff);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [sessionToken]
  );

  // Load initial data based on active tab
  useEffect(() => {
    switch (tab) {
      case 0:
        loadDailySummary(selectedDate);
        break;
      case 1:
        loadTrend(trendDays);
        break;
      case 2:
        loadProductivity(productivityFrom, productivityTo);
        break;
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-white/90 mb-4">Reports & Analytics</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === i
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 rounded-lg border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-400">
          <span className="flex-1">{error}</span>
          <button className="text-error-400/60 hover:text-error-400" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* ─── Tab 0: Daily Summary ─── */}
      {tab === 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            <button
              onClick={() => loadDailySummary(selectedDate)}
              disabled={loading}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                'Load'
              )}
            </button>
          </div>

          {dailySummary && (
            <div className="flex flex-wrap gap-3">
              <KpiCard
                label="Total Revenue"
                value={`$${dailySummary.totalRevenue.toFixed(2)}`}
                colorClass="text-success-400"
              />
              <KpiCard label="Check-Ins" value={dailySummary.totalCheckIns} />
              <KpiCard label="Unique Customers" value={dailySummary.uniqueCustomers} />
              <KpiCard
                label="Tips"
                value={`$${dailySummary.totalTips.toFixed(2)}`}
                colorClass="text-blue-light-400"
              />
              <div className="w-full">
                <div className="rounded-xl border border-gray-800 bg-white/[0.03] p-4">
                  <h4 className="text-sm font-semibold text-gray-200 mb-2">
                    Revenue by Payment Method
                  </h4>
                  {Object.entries(dailySummary.revenueByMethod).map(([method, amount]) => (
                    <div key={method} className="flex justify-between py-1">
                      <span className="text-sm text-gray-400">{method}</span>
                      <span className="text-sm font-semibold text-gray-200">${amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 1: Revenue Trend ─── */}
      {tab === 1 && (
        <div>
          <div className="flex gap-2 mb-4">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setTrendDays(d);
                  loadTrend(d);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  trendDays === d
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-400 ring-1 ring-inset ring-gray-700 hover:bg-white/[0.05]'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-gray-800 bg-white/[0.03] p-4 min-h-[230px] relative">
            <h4 className="text-sm font-semibold text-gray-200 mb-2">
              Daily Revenue — Last {trendDays} Days
            </h4>
            {loading ? (
              <div className="flex justify-center pt-12">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-700 border-t-brand-500" />
              </div>
            ) : (
              <RevenueTrendChart data={trendData} />
            )}
          </div>
        </div>
      )}

      {/* ─── Tab 2: Staff Productivity ─── */}
      {tab === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-theme-xs text-gray-400">From</label>
              <input
                type="date"
                value={productivityFrom}
                onChange={(e) => setProductivityFrom(e.target.value)}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-theme-xs text-gray-400">To</label>
              <input
                type="date"
                value={productivityTo}
                onChange={(e) => setProductivityTo(e.target.value)}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>
            <button
              onClick={() => loadProductivity(productivityFrom, productivityTo)}
              disabled={loading}
              className="mt-5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                'Load'
              )}
            </button>
          </div>

          <div className="rounded-xl border border-gray-800 bg-white/[0.03]">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-700 border-t-brand-500" />
              </div>
            ) : (
              <StaffProductivityTable data={staffData} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
