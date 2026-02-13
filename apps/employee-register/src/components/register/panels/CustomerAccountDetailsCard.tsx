import { useState } from 'react';
import type { ReactNode } from 'react';

type CustomerNotesState = {
  getNotes: (customerId: string) => Array<{
    id: string;
    createdAt: string;
    createdByStaffName: string;
    note: string;
    isImportant: boolean;
  }>;
  isLoading: (customerId: string) => boolean;
  getError: (customerId: string) => string | null;
  createNote: (customerId: string, note: string, isImportant: boolean) => Promise<void> | void;
};

type CustomerSpendLedgerState = {
  getGroups: (customerId: string) => Array<{
    visitId: string | null;
    visitStartedAt: string | null;
    netCents: number;
  }>;
  getVisitEntries: (customerId: string, visitId: string | null) => Array<{
    id: string;
    summary: string;
    amountCents: number;
  }>;
  isLoading: (customerId: string) => boolean;
  getError: (customerId: string) => string | null;
  loadVisitLedger: (customerId: string, visitId: string | null) => Promise<void> | void;
};

type Props = {
  customerId: string;
  profileCard: ReactNode;
  customerNotesState: CustomerNotesState;
  customerSpendLedgerState: CustomerSpendLedgerState;
};

export function CustomerAccountDetailsCard({
  customerId,
  profileCard,
  customerNotesState,
  customerSpendLedgerState,
}: Props) {
  const [showAddCustomerNote, setShowAddCustomerNote] = useState(false);
  const [customerNoteText, setCustomerNoteText] = useState('');
  const [customerNoteImportant, setCustomerNoteImportant] = useState(false);

  return (
    <div className="cs-liquid-card" style={{ padding: '0.85rem', display: 'grid', gap: '0.75rem' }}>
      <div className="er-account-scroll er-account-scroll--tall">{profileCard}</div>

      <div className="er-account-grid">
        <div className="cs-liquid-card" style={{ padding: '0.75rem', maxHeight: '12rem', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="er-account-section-title">Notes</div>
            <button
              type="button"
              className="cs-liquid-button cs-liquid-button--secondary"
              onClick={() => setShowAddCustomerNote(true)}
            >
              Add Note
            </button>
          </div>

          {customerNotesState.getError(customerId) ? (
            <div style={{ marginTop: '0.5rem', color: '#fecaca', fontWeight: 800 }}>
              {customerNotesState.getError(customerId)}
            </div>
          ) : null}

          <div className="er-account-scroll" style={{ marginTop: '0.5rem' }}>
            {customerNotesState.isLoading(customerId) ? (
              <div style={{ color: '#94a3b8', fontWeight: 800 }}>Loading notes…</div>
            ) : customerNotesState.getNotes(customerId).length === 0 ? (
              <div style={{ color: '#94a3b8', fontWeight: 800 }}>No notes.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {[...customerNotesState.getNotes(customerId)]
                  .sort((a, b) => Number(b.isImportant) - Number(a.isImportant))
                  .map((n) => (
                    <div
                      key={n.id}
                      style={{
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        borderRadius: 10,
                        padding: '0.6rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {n.isImportant ? (
                            <span aria-hidden="true" style={{ color: '#ef4444', fontWeight: 900 }}>
                              ⚑
                            </span>
                          ) : null}
                          <div style={{ fontWeight: n.isImportant ? 950 : 850 }}>
                            {n.createdByStaffName}
                          </div>
                        </div>
                        <div className="er-text-xs" style={{ color: '#94a3b8', fontWeight: 800 }}>
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontWeight: n.isImportant ? 900 : 800 }}>
                        {n.note}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {showAddCustomerNote ? (
            <div
              style={{
                marginTop: '0.75rem',
                borderTop: '1px solid rgba(148, 163, 184, 0.15)',
                paddingTop: '0.75rem',
                display: 'grid',
                gap: '0.5rem',
              }}
            >
              <textarea
                value={customerNoteText}
                onChange={(e) => setCustomerNoteText(e.target.value)}
                placeholder="Add a note…"
                style={{
                  width: '100%',
                  minHeight: 80,
                  borderRadius: 10,
                  padding: '0.6rem',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(15, 23, 42, 0.35)',
                  color: '#e2e8f0',
                  fontWeight: 800,
                }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900 }}>
                <input
                  type="checkbox"
                  checked={customerNoteImportant}
                  onChange={(e) => setCustomerNoteImportant(e.target.checked)}
                />
                Important
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="cs-liquid-button"
                  onClick={() => {
                    void (async () => {
                      await customerNotesState.createNote(
                        customerId,
                        customerNoteText,
                        customerNoteImportant
                      );
                      setCustomerNoteText('');
                      setCustomerNoteImportant(false);
                      setShowAddCustomerNote(false);
                    })();
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="cs-liquid-button cs-liquid-button--secondary"
                  onClick={() => setShowAddCustomerNote(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="cs-liquid-card" style={{ padding: '0.75rem', maxHeight: '12rem', overflow: 'auto' }}>
          <div className="er-account-section-title">Spending</div>
          <div className="er-text-xs" style={{ color: '#94a3b8', fontWeight: 800 }}>
            <span className="er-account-link">Open full ledger in Office Dashboard</span>
          </div>
          <div className="er-account-scroll" style={{ marginTop: '0.6rem' }}>
            {customerSpendLedgerState.getError(customerId) ? (
              <div style={{ color: '#fecaca', fontWeight: 800 }}>
                {customerSpendLedgerState.getError(customerId)}
              </div>
            ) : null}
            {customerSpendLedgerState.isLoading(customerId) ? (
              <div style={{ color: '#94a3b8', fontWeight: 800 }}>Loading spend ledger…</div>
            ) : customerSpendLedgerState.getGroups(customerId).length === 0 ? (
              <div style={{ color: '#94a3b8', fontWeight: 800 }}>No spend ledger entries.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {customerSpendLedgerState.getGroups(customerId).map((g) => (
                  <details
                    key={g.visitId ?? 'unassigned'}
                    onToggle={(e) => {
                      const open = (e.target as HTMLDetailsElement).open;
                      if (!open) return;
                      void customerSpendLedgerState.loadVisitLedger(customerId, g.visitId);
                    }}
                  >
                    <summary style={{ cursor: 'pointer', fontWeight: 900 }}>
                      {g.visitStartedAt
                        ? new Date(g.visitStartedAt).toLocaleString()
                        : g.visitId
                          ? `Visit ${g.visitId.slice(0, 8)}`
                          : 'Unassigned'}
                      {` — Net $${(g.netCents / 100).toFixed(2)}`}
                    </summary>
                    <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.35rem' }}>
                      {customerSpendLedgerState
                        .getVisitEntries(customerId, g.visitId)
                        .map((e) => (
                          <div
                            key={e.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              fontWeight: 850,
                            }}
                          >
                            <div style={{ color: '#cbd5e1' }}>{e.summary}</div>
                            <div style={{ color: e.amountCents < 0 ? '#fca5a5' : '#86efac' }}>
                              {(e.amountCents < 0 ? '-' : '') +
                                `$${(Math.abs(e.amountCents) / 100).toFixed(2)}`}
                            </div>
                          </div>
                        ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
