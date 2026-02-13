import { useEffect, useMemo, useState } from 'react';
import { apiJson } from './api';
import { PanelShell } from './views/PanelShell';
import { PanelHeader } from './views/PanelHeader';
import { PanelContent } from './views/PanelContent';
import { RaisedCard } from './views/RaisedCard';
import { useNavigate } from 'react-router-dom';
import type { StaffSession } from './LockScreen';

type Props = { session: StaffSession };

type AlertRow = {
  id: string;
  customerId: string;
  customerName: string;
  checkoutRequestId: string;
  occupancyId: string;
  visitId: string | null;
  lateMinutes: number;
  feeAmountCents: number;
  recommendedBanDays: number;
  status: string;
  createdAt: string;
  createdByStaffName: string | null;
  customerNotesThatDay?: Array<{
    id: string;
    createdAt: string;
    createdByStaffName: string | null;
    note: string;
    isImportant: boolean;
  }>;
};

export function LateCheckoutBanAlertsView({ session }: Props) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banDaysById, setBanDaysById] = useState<Record<string, number>>({});

  const pendingCount = useMemo(() => alerts.length, [alerts.length]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiJson<{ alerts: AlertRow[] }>('/v1/admin/late-checkout-ban-alerts', {
        sessionToken: session.sessionToken,
      });
      const list = Array.isArray(data.alerts) ? data.alerts : [];
      setAlerts(list);
      setBanDaysById((prev) => {
        const next = { ...prev };
        for (const a of list) {
          if (typeof next[a.id] !== 'number') next[a.id] = a.recommendedBanDays ?? 30;
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts');
    } finally {
      setBusy(false);
    }
  }

  async function decide(alertId: string, decision: 'APPROVE' | 'DENY') {
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/v1/admin/late-checkout-ban-alerts/${alertId}/decide`, {
        method: 'POST',
        sessionToken: session.sessionToken,
        body:
          decision === 'APPROVE'
            ? { decision, banDays: banDaysById[alertId] ?? 30 }
            : { decision },
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit decision');
    } finally {
      setBusy(false);
    }
  }

  function renderNotesPreview(a: AlertRow) {
    const notes = a.customerNotesThatDay ?? [];
    if (notes.length === 0) {
      return <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No notes for this customer today.</div>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>Notes (today)</div>
        {notes.slice(0, 2).map((n) => (
          <div key={n.id} style={{ fontSize: 12, lineHeight: 1.25 }}>
            <div style={{ color: 'var(--text-muted)' }}>
              {new Date(n.createdAt).toLocaleString()} — {n.createdByStaffName ?? '—'}
            </div>
            <div style={{ fontWeight: n.isImportant ? 800 : 500 }}>{n.note}</div>
          </div>
        ))}
        {notes.length > 2 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{notes.length - 2} more</div>
        ) : null}
      </div>
    );
  }

  return (
    <PanelShell>
      <PanelHeader
        title={`Late Checkout Ban Alerts (${pendingCount})`}
        actions={
          <button
            className="cs-liquid-button cs-liquid-button--secondary"
            type="button"
            onClick={() => void refresh()}
            disabled={busy}
          >
            Refresh
          </button>
        }
      />
      <PanelContent padding="md">
        {error ? (
          <div style={{ marginBottom: 12, color: 'var(--danger)', fontWeight: 700 }}>{error}</div>
        ) : null}

        {alerts.length === 0 ? (
          <RaisedCard>
            <div style={{ color: 'var(--text-muted)' }}>{busy ? 'Loading…' : 'No pending alerts.'}</div>
          </RaisedCard>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {alerts.map((a) => (
              <RaisedCard key={a.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      <button
                        type="button"
                        className="cs-link"
                        onClick={() => navigate(`/customers?customerId=${encodeURIComponent(a.customerId)}`)}
                        style={{ fontWeight: 900 }}
                      >
                        {a.customerName}
                      </button>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      Late: {a.lateMinutes} min · Fee: ${(a.feeAmountCents / 100).toFixed(2)}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      Created: {new Date(a.createdAt).toLocaleString()}
                      {a.createdByStaffName ? ` by ${a.createdByStaffName}` : ''}
                    </div>

                    {renderNotesPreview(a)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Ban days</div>
                      <input
                        className="cs-input"
                        style={{ width: 90 }}
                        type="number"
                        min={1}
                        max={365}
                        value={banDaysById[a.id] ?? 30}
                        onChange={(e) =>
                          setBanDaysById((p) => ({ ...p, [a.id]: parseInt(e.target.value || '30', 10) }))
                        }
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="cs-liquid-button"
                        onClick={() => void decide(a.id, 'APPROVE')}
                        disabled={busy}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="cs-liquid-button cs-liquid-button--secondary"
                        onClick={() => void decide(a.id, 'DENY')}
                        disabled={busy}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              </RaisedCard>
            ))}
          </div>
        )}
      </PanelContent>
    </PanelShell>
  );
}
