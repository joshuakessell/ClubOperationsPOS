import { useEffect, useMemo, useState } from 'react';
import type { StaffSession } from './LockScreen';
import { ApiError, apiJson } from './api';
import { ReAuthModal } from './ReAuthModal';
import { PanelContent } from './views/PanelContent';
import { PanelHeader } from './views/PanelHeader';
import { PanelShell } from './views/PanelShell';
import {
  CustomerAdminDetailPanel,
  type ActivityEvent,
  type AgreementVisit,
  type CustomerAdminSummary,
  type CustomerNote,
  type SpendGroup,
} from './CustomerAdminDetailPanel';

type Customer = CustomerAdminSummary;

export function CustomerAdminToolsView({ session }: { session: StaffSession }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | {
    type: 'waivePastDue';
  }>(null);

  const [structuredNotes, setStructuredNotes] = useState<CustomerNote[]>([]);
  const [structuredNotesBusy, setStructuredNotesBusy] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteImportant, setNewNoteImportant] = useState(false);

  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityBusy, setActivityBusy] = useState(false);

  const [spendGroups, setSpendGroups] = useState<SpendGroup[]>([]);
  const [spendBusy, setSpendBusy] = useState(false);

  const [agreementVisits, setAgreementVisits] = useState<AgreementVisit[]>([]);
  const [agreementsBusy, setAgreementsBusy] = useState(false);

  const canSearch = q.trim().length >= 2;

  const runSearch = async () => {
    try {
      setError(null);
      setBusy(true);
      const data = await apiJson<{ customers: Customer[] }>(
        `/v1/admin/customers?search=${encodeURIComponent(q.trim())}`,
        { sessionToken: session.sessionToken }
      );
      setResults(data.customers || []);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  };

  const selectCustomer = (c: Customer) => {
    setSelected(c);
    setError(null);
  };

  const loadPanels = async (customerId: string, centerEventId?: string | null) => {
    setStructuredNotesBusy(true);
    setActivityBusy(true);
    setSpendBusy(true);
    setAgreementsBusy(true);
    try {
      const [notesRes, activityRes, spendRes, agreementsRes] = await Promise.all([
        apiJson<{ notes: CustomerNote[] }>(`/v1/customers/${customerId}/notes?limit=50`, {
          sessionToken: session.sessionToken,
        }),
        apiJson<{ events: ActivityEvent[]; centerEventId: string | null }>(
          `/v1/admin/customers/${customerId}/activity-log?limit=41${
            centerEventId ? `&centerEventId=${encodeURIComponent(centerEventId)}` : ''
          }`,
          { sessionToken: session.sessionToken }
        ),
        apiJson<{ groups: SpendGroup[] }>(`/v1/customers/${customerId}/spend-ledger?limit=50`, {
          sessionToken: session.sessionToken,
        }),
        apiJson<{ visits: AgreementVisit[] }>(`/v1/admin/customers/${customerId}/agreements?limit=25`, {
          sessionToken: session.sessionToken,
        }),
      ]);

      setStructuredNotes(Array.isArray(notesRes.notes) ? notesRes.notes : []);
      setActivityEvents(Array.isArray(activityRes.events) ? activityRes.events : []);
      setSpendGroups(Array.isArray(spendRes.groups) ? spendRes.groups : []);
      setAgreementVisits(Array.isArray(agreementsRes.visits) ? agreementsRes.visits : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customer panels');
    } finally {
      setStructuredNotesBusy(false);
      setActivityBusy(false);
      setSpendBusy(false);
      setAgreementsBusy(false);
    }
  };

  const createStructuredNote = async () => {
    if (!selected) return;
    const trimmed = newNoteText.trim();
    if (!trimmed) return;

    try {
      setStructuredNotesBusy(true);
      await apiJson(`/v1/customers/${selected.id}/notes`, {
        sessionToken: session.sessionToken,
        method: 'POST',
        body: { note: trimmed, isImportant: newNoteImportant, sourceApp: 'OFFICE_DASHBOARD' },
      });
      setNewNoteText('');
      setNewNoteImportant(false);
      await loadPanels(selected.id, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create note');
    } finally {
      setStructuredNotesBusy(false);
    }
  };

  // Deep link support: /customers?customerId=...&centerEventId=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerId = params.get('customerId');
    const centerEventId = params.get('centerEventId');
    if (!customerId) return;

    // If the customer is already selected, just load panels.
    if (selected?.id === customerId) {
      void loadPanels(customerId, centerEventId);
      return;
    }

    // Fetch minimal customer for selection.
    void (async () => {
      try {
        const data = await apiJson<{ customers: Customer[] }>(
          `/v1/admin/customers?search=${encodeURIComponent(customerId)}&limit=1`,
          { sessionToken: session.sessionToken }
        );
        const found = (data.customers || []).find((c) => c.id === customerId) ?? null;
        if (found) {
          setSelected(found);
          await loadPanels(found.id, centerEventId);
        }
      } catch {
        // Ignore deep-link failure.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performAdminUpdate = async (action: 'waivePastDue') => {
    if (!selected) return;
    const body = { pastDueBalance: 0 };

    try {
      setError(null);
      setBusy(true);
      const updated = await apiJson<Customer>(`/v1/admin/customers/${selected.id}`, {
        sessionToken: session.sessionToken,
        method: 'PATCH',
        body,
      });
      setSelected(updated);
      setResults((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setPendingAction({ type: action });
        setReauthOpen(true);
        return;
      }
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const header = useMemo(() => {
    if (!selected) return 'Search customers';
    return `${selected.name}${selected.membershipNumber ? ` (${selected.membershipNumber})` : ''}`;
  }, [selected]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {reauthOpen && (
        <ReAuthModal
          sessionToken={session.sessionToken}
          onCancel={() => {
            setReauthOpen(false);
            setPendingAction(null);
          }}
          onSuccess={async () => {
            setReauthOpen(false);
            if (pendingAction?.type) {
              await performAdminUpdate(pendingAction.type);
              setPendingAction(null);
            }
          }}
        />
      )}

      <PanelShell spacing="md">
        <PanelHeader title="Customer Admin Tools" />
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

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="cs-liquid-search" style={{ minWidth: 360 }}>
              <input
                className="cs-liquid-input cs-liquid-search__input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or membership #"
              />
              <div className="cs-liquid-search__icon">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 14L11.1 11.1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <button className="cs-liquid-button" disabled={!canSearch || busy} onClick={runSearch}>
              {busy ? 'Searching…' : 'Search'}
            </button>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Admin can waive past-due balance (requires re-auth).
            </div>
          </div>
        </PanelContent>
      </PanelShell>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1.5rem' }}
      >
        <PanelShell>
          <PanelHeader title={`Results (${results.length})`} />
          <PanelContent padding="md">
            {results.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>
                {canSearch ? 'No results yet — run a search.' : 'Type at least 2 characters.'}
              </div>
            ) : (
              <table className="rooms-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Membership</th>
                    <th>Past Due</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      style={{
                        cursor: 'pointer',
                        background: selected?.id === c.id ? 'rgba(43, 102, 184, 0.12)' : undefined,
                      }}
                    >
                      <td className="room-number">{c.name}</td>
                      <td>{c.membershipNumber || '—'}</td>
                      <td
                        style={{
                          color: c.pastDueBalance > 0 ? 'var(--warning)' : 'var(--text-muted)',
                          fontWeight: 700,
                        }}
                      >
                        ${c.pastDueBalance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PanelContent>
        </PanelShell>

        <PanelShell>
          <PanelHeader title={header} />
          <PanelContent padding="md">
            {!selected ? (
              <div className="placeholder">
                <span className="placeholder-icon">🗂️</span>
                <p>Select a customer to view/edit details.</p>
              </div>
            ) : (
              <CustomerAdminDetailPanel
                customer={selected}
                structuredNotes={structuredNotes}
                structuredNotesBusy={structuredNotesBusy}
                newNoteText={newNoteText}
                newNoteImportant={newNoteImportant}
                onNewNoteTextChange={setNewNoteText}
                onNewNoteImportantChange={setNewNoteImportant}
                onCreateStructuredNote={() => void createStructuredNote()}
                activityEvents={activityEvents}
                activityBusy={activityBusy}
                spendGroups={spendGroups}
                spendBusy={spendBusy}
                agreementVisits={agreementVisits}
                agreementsBusy={agreementsBusy}
                onWaivePastDue={() => performAdminUpdate('waivePastDue')}
                canWaivePastDue={selected.pastDueBalance > 0}
                busy={busy}
                sessionToken={session.sessionToken}
                onError={(message) => setError(message)}
              />
            )}
          </PanelContent>
        </PanelShell>
      </div>
    </div>
  );
}
