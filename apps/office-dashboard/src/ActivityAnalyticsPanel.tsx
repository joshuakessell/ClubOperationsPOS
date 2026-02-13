import { PanelContent } from './views/PanelContent';
import { PanelHeader } from './views/PanelHeader';
import { PanelShell } from './views/PanelShell';
import { RaisedCard } from './views/RaisedCard';

export type ActivityAnalytics = {
  from: string;
  to: string;
  timezone: string;
  checkinsByHour: Array<{ bucket: string; count: number }>;
  revenueByHour: Array<{ bucket: string; totalCents: number }>;
  heatmapCheckins: Array<{ dow: number; hour: number; count: number }>;
  heatmapRevenue: Array<{ dow: number; hour: number; totalCents: number }>;
  paymentMethodSplit: Array<{ method: string; totalCents: number }>;
  topCategories: Array<{ category: string; totalCents: number }>;
  aovByDay: Array<{ bucket: string; avgCents: number }>;
};

type Props = {
  analytics: ActivityAnalytics | null;
};

export function ActivityAnalyticsPanel({ analytics }: Props) {
  const totalCheckins = analytics
    ? analytics.checkinsByHour.reduce((sum, item) => sum + item.count, 0)
    : 0;
  const totalRevenueCents = analytics
    ? analytics.revenueByHour.reduce((sum, item) => sum + item.totalCents, 0)
    : 0;
  const avgCheckinsPerHour =
    analytics && analytics.checkinsByHour.length > 0
      ? totalCheckins / analytics.checkinsByHour.length
      : 0;
  const avgRevenuePerHour =
    analytics && analytics.revenueByHour.length > 0
      ? totalRevenueCents / analytics.revenueByHour.length
      : 0;
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heatmapMax = analytics
    ? Math.max(1, ...analytics.heatmapCheckins.map((h) => h.count))
    : 0;
  const heatmapRows = analytics
    ? Array.from({ length: 7 }, (_, dow) => ({
        dow,
        hours: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: analytics.heatmapCheckins.find((h) => h.dow === dow && h.hour === hour)?.count || 0,
        })),
      }))
    : [];

  return (
    <PanelShell spacing="md">
      <PanelHeader title="Activity Analytics" />
      <PanelContent padding="md">
        {!analytics ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <>
            <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="stat-card">
                <span className="stat-value">{totalCheckins}</span>
                <span className="stat-label">Total Check-ins</span>
              </div>
              <div className="stat-card stat-available">
                <span className="stat-value">{formatCurrency(totalRevenueCents)}</span>
                <span className="stat-label">Revenue</span>
              </div>
              <div className="stat-card stat-cleaning">
                <span className="stat-value">{avgCheckinsPerHour.toFixed(1)}</span>
                <span className="stat-label">Avg Check-ins / Hr</span>
              </div>
              <div className="stat-card stat-occupied">
                <span className="stat-value">{formatCurrency(avgRevenuePerHour)}</span>
                <span className="stat-label">Avg Revenue / Hr</span>
              </div>
            </section>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '1.5rem',
                marginTop: '1.5rem',
              }}
            >
              <RaisedCard>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Payment Methods</div>
                <table className="rooms-table">
                  <tbody>
                    {analytics.paymentMethodSplit.map((p) => (
                      <tr key={p.method}>
                        <td style={{ color: 'var(--text-muted)' }}>{p.method}</td>
                        <td style={{ fontWeight: 800 }}>{formatCurrency(p.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </RaisedCard>

              <RaisedCard>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Top Categories</div>
                <table className="rooms-table">
                  <tbody>
                    {analytics.topCategories.map((c) => (
                      <tr key={c.category}>
                        <td style={{ color: 'var(--text-muted)' }}>{c.category}</td>
                        <td style={{ fontWeight: 800 }}>{formatCurrency(c.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </RaisedCard>
            </div>

            <RaisedCard style={{ marginTop: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Check-in Heatmap</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="rooms-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>Day</th>
                      {Array.from({ length: 24 }, (_, hour) => (
                        <th key={hour}>{hour}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapRows.map((row) => (
                      <tr key={row.dow}>
                        <td className="room-number">{dowLabels[row.dow]}</td>
                        {row.hours.map((h) => {
                          const intensity = Math.min(1, h.count / heatmapMax);
                          const bg = `rgba(59, 130, 246, ${0.1 + intensity * 0.6})`;
                          return (
                            <td key={h.hour} style={{ background: bg, textAlign: 'center' }}>
                              {h.count}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </RaisedCard>

            <RaisedCard style={{ marginTop: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>AOV by Day</div>
              <table className="rooms-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Avg Order Value</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.aovByDay.map((row) => (
                    <tr key={row.bucket}>
                      <td className="room-number">{row.bucket}</td>
                      <td style={{ fontWeight: 800 }}>{formatCurrency(row.avgCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </RaisedCard>
          </>
        )}
      </PanelContent>
    </PanelShell>
  );
}
