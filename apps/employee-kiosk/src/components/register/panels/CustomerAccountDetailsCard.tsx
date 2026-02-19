import { useState } from 'react';
import type { ReactNode } from 'react';
import { ModalFrame } from '../modals/ModalFrame';
import { getApiUrl } from '@club-ops/shared';
import { isRecord, readJson } from '@club-ops/shared';
import { useEmployeeRegisterState } from '../../../app/state/useEmployeeRegisterState';

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
  createNote: (
    customerId: string,
    note: { note: string; isImportant?: boolean; sourceApp?: string }
  ) => Promise<void> | void;
};

type CustomerSpendLedgerState = {
  getGroups: (customerId: string) => Array<{
    visitId: string | null;
    visitStartedAt: string | null;
    netCents: number;
  }>;
  getVisitEntries: (
    customerId: string,
    visitId: string | null
  ) => Array<{
    id: string;
    summary: string;
    amountCents: number;
  }>;
  isLoading: (customerId: string) => boolean;
  getError: (customerId: string) => string | null;
  loadVisitLedger: (customerId: string, visitId: string | null) => Promise<void> | void;
};

type CustomerDocumentsState = {
  loadDocuments: (customerId: string) => Promise<void> | void;
  getDocuments: (customerId: string) => Array<{
    id: string;
    created_at: string;
    visit_started_at: string | null;
    visit_ended_at: string | null;
    has_pdf: boolean;
  }>;
  isLoading: (customerId: string) => boolean;
  getError: (customerId: string) => string | null;
};

type Props = {
  customerId: string;
  profileCard: ReactNode;
  customerNotesState: CustomerNotesState;
  customerSpendLedgerState: CustomerSpendLedgerState;
  customerDocumentsState: CustomerDocumentsState;
};

export function CustomerAccountDetailsCard({
  customerId,
  profileCard,
  customerNotesState,
  customerSpendLedgerState,
  customerDocumentsState,
}: Props) {
  const { session } = useEmployeeRegisterState();
  const [customerNoteText, setCustomerNoteText] = useState('');
  const [customerNoteImportant, setCustomerNoteImportant] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [agreementListModalOpen, setAgreementListModalOpen] = useState(false);
  const [agreementPdfModalOpen, setAgreementPdfModalOpen] = useState(false);
  const [agreementPdfUrl, setAgreementPdfUrl] = useState<string | null>(null);
  const [agreementError, setAgreementError] = useState<string | null>(null);

  const latestNote = customerNotesState
    .getNotes(customerId)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const notesList = (
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
  );

  const activityList = (
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
                {customerSpendLedgerState.getVisitEntries(customerId, g.visitId).map((e) => (
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
  );

  const agreementsList = (
    <div className="er-account-scroll" style={{ marginTop: '0.6rem' }}>
      {customerDocumentsState.getError(customerId) ? (
        <div style={{ color: '#fecaca', fontWeight: 800 }}>
          {customerDocumentsState.getError(customerId)}
        </div>
      ) : null}
      {customerDocumentsState.isLoading(customerId) ? (
        <div style={{ color: '#94a3b8', fontWeight: 800 }}>Loading agreements…</div>
      ) : customerDocumentsState.getDocuments(customerId).length === 0 ? (
        <div style={{ color: '#94a3b8', fontWeight: 800 }}>No agreements found.</div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {customerDocumentsState.getDocuments(customerId).map((d) => (
            <button
              key={d.id}
              type="button"
              className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
              style={{
                padding: '0.75rem',
                textAlign: 'left',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                background: 'rgba(15, 23, 42, 0.15)',
                color: 'inherit',
                fontWeight: 850,
              }}
              onClick={() => {
                void (async () => {
                  if (!session?.sessionToken) return;
                  setAgreementError(null);
                  setAgreementPdfUrl(null);
                  setAgreementPdfModalOpen(true);
                  try {
                    const res = await fetch(
                      getApiUrl(`/api/v1/documents/${encodeURIComponent(d.id)}/download`),
                      { headers: { Authorization: `Bearer ${session.sessionToken}` } }
                    );
                    if (!res.ok) {
                      const payload = await readJson<unknown>(res);
                      const message =
                        isRecord(payload) && typeof payload.error === 'string'
                          ? payload.error
                          : `Failed to fetch PDF (${res.status})`;
                      throw new Error(message);
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setAgreementPdfUrl(url);
                  } catch (e) {
                    setAgreementError(e instanceof Error ? e.message : 'Failed to fetch PDF');
                  }
                })();
              }}
              disabled={!d.has_pdf}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 900 }}>Agreement PDF</div>
                <div className="er-text-xs" style={{ color: '#94a3b8', fontWeight: 800 }}>
                  {d.created_at ? new Date(d.created_at).toLocaleString() : ''}
                </div>
              </div>
              <div className="er-text-xs" style={{ color: '#94a3b8', fontWeight: 800 }}>
                {d.visit_started_at
                  ? `Visit started: ${new Date(d.visit_started_at).toLocaleString()}`
                  : 'Visit start: —'}
              </div>
              {!d.has_pdf ? (
                <div className="er-text-xs" style={{ color: '#fca5a5', fontWeight: 900 }}>
                  PDF not stored
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div className="er-account-scroll er-account-scroll--tall">{profileCard}</div>

      <div className="er-account-grid">
        <button
          type="button"
          onClick={() => setNotesModalOpen(true)}
          style={{
            padding: '0.75rem',
            maxHeight: '12rem',
            overflow: 'auto',
            textAlign: 'left',
            borderRadius: 16,
            border: '1px solid rgba(148, 163, 184, 0.2)',
            background: 'rgba(15, 23, 42, 0.35)',
            color: 'inherit',
            fontWeight: 800,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="er-account-section-title">Notes</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {latestNote ? (
                <span className="er-text-xs" style={{ color: '#94a3b8', fontWeight: 800 }}>
                  Last: {new Date(latestNote.createdAt).toLocaleString()}
                </span>
              ) : null}
              <span className="er-text-xs" style={{ color: '#94a3b8', fontWeight: 800 }}>
                View all
              </span>
            </div>
          </div>

          {latestNote ? (
            <div
              style={{
                marginTop: '0.4rem',
                padding: '0.5rem',
                borderRadius: 12,
                border: '1px solid rgba(148, 163, 184, 0.15)',
                background: 'rgba(2, 6, 23, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {latestNote.isImportant ? (
                  <span aria-hidden="true" style={{ color: '#ef4444', fontWeight: 900 }}>
                    ⚑
                  </span>
                ) : null}
                <div style={{ fontWeight: latestNote.isImportant ? 950 : 850 }}>
                  {latestNote.createdByStaffName}
                </div>
              </div>
              <div
                style={{
                  marginTop: '0.25rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: latestNote.isImportant ? 900 : 800,
                  opacity: 0.95,
                }}
              >
                {latestNote.note}
              </div>
            </div>
          ) : null}

          {customerNotesState.getError(customerId) ? (
            <div style={{ marginTop: '0.5rem', color: '#fecaca', fontWeight: 800 }}>
              {customerNotesState.getError(customerId)}
            </div>
          ) : null}
          {notesList}
        </button>

        <button
          type="button"
          onClick={() => setActivityModalOpen(true)}
          style={{
            padding: '0.75rem',
            maxHeight: '12rem',
            overflow: 'auto',
            textAlign: 'left',
            borderRadius: 16,
            border: '1px solid rgba(148, 163, 184, 0.2)',
            background: 'rgba(15, 23, 42, 0.35)',
            color: 'inherit',
            fontWeight: 800,
          }}
        >
          <div className="er-account-section-title">Activity</div>
          <div className="er-text-xs" style={{ color: '#94a3b8', fontWeight: 800 }}>
            Click to expand
          </div>
          {activityList}
        </button>

        <button
          type="button"
          onClick={() => {
            void customerDocumentsState.loadDocuments(customerId);
            setAgreementListModalOpen(true);
          }}
          style={{
            gridColumn: '1 / -1',
            padding: '0.75rem',
            maxHeight: '10rem',
            overflow: 'auto',
            textAlign: 'left',
            borderRadius: 16,
            border: '1px solid rgba(148, 163, 184, 0.2)',
            background: 'rgba(15, 23, 42, 0.22)',
            color: 'inherit',
            fontWeight: 800,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="er-account-section-title">Agreements</div>
            <span className="er-text-xs" style={{ color: '#94a3b8', fontWeight: 800 }}>
              Click to view
            </span>
          </div>
          {agreementsList}
        </button>
      </div>

      <ModalFrame
        isOpen={notesModalOpen}
        title="Customer Notes"
        onClose={() => setNotesModalOpen(false)}
        maxWidth="780px"
        maxHeight="80vh"
        closeOnOverlayClick
        closeOnEscape
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Add Note</div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <textarea
                value={customerNoteText}
                onChange={(e) => setCustomerNoteText(e.target.value)}
                placeholder="Add a note…"
                style={{
                  width: '100%',
                  minHeight: 120,
                  borderRadius: 10,
                  padding: '0.6rem',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(15, 23, 42, 0.35)',
                  color: '#e2e8f0',
                  fontWeight: 800,
                }}
              />
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900 }}
              >
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
                  className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                  onClick={() => {
                    void (async () => {
                      await customerNotesState.createNote(customerId, {
                        note: customerNoteText,
                        isImportant: customerNoteImportant,
                        sourceApp: 'EMPLOYEE_REGISTER',
                      });
                      setCustomerNoteText('');
                      setCustomerNoteImportant(false);
                      setNotesModalOpen(false);
                    })();
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  onClick={() => setNotesModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
          {notesList}
        </div>
      </ModalFrame>

      <ModalFrame
        isOpen={activityModalOpen}
        title="Customer Activity"
        onClose={() => setActivityModalOpen(false)}
        maxWidth="900px"
        maxHeight="80vh"
        closeOnOverlayClick
        closeOnEscape
      >
        {activityList}
      </ModalFrame>

      <ModalFrame
        isOpen={agreementListModalOpen}
        title="Agreements"
        onClose={() => setAgreementListModalOpen(false)}
        maxWidth="900px"
        maxHeight="80vh"
        closeOnOverlayClick
        closeOnEscape
      >
        {agreementsList}
      </ModalFrame>

      <ModalFrame
        isOpen={agreementPdfModalOpen}
        title="Agreement PDF"
        onClose={() => {
          setAgreementPdfModalOpen(false);
          if (agreementPdfUrl) {
            URL.revokeObjectURL(agreementPdfUrl);
          }
          setAgreementPdfUrl(null);
          setAgreementError(null);
        }}
        maxWidth="980px"
        maxHeight="85vh"
        closeOnOverlayClick
        closeOnEscape
      >
        {agreementError ? (
          <div className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm font-medium text-error-600 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400">
            {agreementError}
          </div>
        ) : null}
        {agreementPdfUrl ? (
          <iframe
            title="Agreement PDF"
            src={agreementPdfUrl}
            style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 12 }}
          />
        ) : (
          <div style={{ color: '#94a3b8', fontWeight: 800 }}>Loading PDF…</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            onClick={() => setAgreementPdfModalOpen(false)}
          >
            Close
          </button>
        </div>
      </ModalFrame>
    </div>
  );
}
