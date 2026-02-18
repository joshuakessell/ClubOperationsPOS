import { RaisedCard } from './views/RaisedCard';
import { downloadCustomerDocumentPdf } from './api/customerDocuments';

export type CustomerAdminSummary = {
  id: string;
  name: string;
  membershipNumber: string | null;
  primaryLanguage: 'EN' | 'ES' | null;
  pastDueBalance: number;
};

export type CustomerNote = {
  id: string;
  createdAt: string;
  createdByStaffName: string;
  note: string;
  isImportant: boolean;
};

export type ActivityEvent = {
  id: string;
  occurredAt: string;
  actionCategory: string;
  actionType: string;
  summary: string;
  actorStaffName: string | null;
};

export type SpendGroup = {
  visitId: string | null;
  visitStartedAt: string | null;
  visitEndedAt: string | null;
  grossCents: number;
  refundsCents: number;
  netCents: number;
  entryCount: number;
};

export type AgreementVisit = {
  visitId: string;
  visitStartedAt: string;
  visitEndedAt: string | null;
  checkinBlocks: Array<{
    checkinBlockId: string;
    startsAt: string;
    endsAt: string;
    rentalType: string;
    roomNumber: string | null;
    lockerNumber: string | null;
    agreementSigned: boolean;
    agreementSignedAt: string | null;
    hasPdf: boolean;
    hasSignature: boolean;
    signatureCreatedAt: string | null;
    agreementVersion: string | null;
  }>;
};

type Props = {
  customer: CustomerAdminSummary;
  structuredNotes: CustomerNote[];
  structuredNotesBusy: boolean;
  newNoteText: string;
  newNoteImportant: boolean;
  onNewNoteTextChange: (value: string) => void;
  onNewNoteImportantChange: (value: boolean) => void;
  onCreateStructuredNote: () => void;
  activityEvents: ActivityEvent[];
  activityBusy: boolean;
  spendGroups: SpendGroup[];
  spendBusy: boolean;
  agreementVisits: AgreementVisit[];
  agreementsBusy: boolean;
  onWaivePastDue: () => void;
  canWaivePastDue: boolean;
  busy: boolean;
  sessionToken: string;
  onError: (message: string) => void;
};

export function CustomerAdminDetailPanel({
  customer,
  structuredNotes,
  structuredNotesBusy,
  newNoteText,
  newNoteImportant,
  onNewNoteTextChange,
  onNewNoteImportantChange,
  onCreateStructuredNote,
  activityEvents,
  activityBusy,
  spendGroups,
  spendBusy,
  agreementVisits,
  agreementsBusy,
  onWaivePastDue,
  canWaivePastDue,
  busy,
  sessionToken,
  onError,
}: Props) {
  return (
    <>
      <RaisedCard style={{ marginBottom: '1rem' }}>
        <table className="rooms-table" style={{ marginBottom: '0.75rem' }}>
          <tbody>
            <tr>
              <td style={{ color: 'var(--text-muted)' }}>Customer ID</td>
              <td style={{ fontFamily: 'monospace' }}>{customer.id}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text-muted)' }}>Primary Language</td>
              <td>{customer.primaryLanguage || '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text-muted)' }}>Past Due Balance</td>
              <td
                style={{
                  fontWeight: 800,
                  color: customer.pastDueBalance > 0 ? 'var(--warning)' : 'var(--text)',
                }}
              >
                ${customer.pastDueBalance.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Structured Notes</div>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <textarea
            value={newNoteText}
            onChange={(e) => onNewNoteTextChange(e.target.value)}
            placeholder="Add a note…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            style={{ minHeight: 80 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
            <input
              type="checkbox"
              checked={newNoteImportant}
              onChange={(e) => onNewNoteImportantChange(e.target.checked)}
            />
            Important
          </label>
          <button
            className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            disabled={structuredNotesBusy}
            onClick={onCreateStructuredNote}
          >
            Add Note
          </button>
        </div>

        <div style={{ marginTop: '0.75rem', maxHeight: '12rem', overflow: 'auto' }}>
          {structuredNotesBusy ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : structuredNotes.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No structured notes.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[...structuredNotes]
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
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <div style={{ fontWeight: n.isImportant ? 900 : 700 }}>
                        {n.isImportant ? '⚑ ' : ''}
                        {n.createdByStaffName}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{n.note}</div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </RaisedCard>

      <RaisedCard style={{ marginBottom: '1rem', maxHeight: '14rem', overflow: 'auto' }}>
        <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Customer Activity</div>
        {activityBusy ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : activityEvents.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No activity yet.</div>
        ) : (
          <table className="rooms-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Category</th>
                <th>Summary</th>
                <th>Staff</th>
              </tr>
            </thead>
            <tbody>
              {activityEvents.map((e) => (
                <tr
                  key={e.id}
                  style={{
                    background:
                      new URLSearchParams(window.location.search).get('centerEventId') === e.id
                        ? 'rgba(239, 68, 68, 0.12)'
                        : undefined,
                  }}
                >
                  <td className="room-number">{new Date(e.occurredAt).toLocaleString()}</td>
                  <td>{e.actionCategory}</td>
                  <td>{e.summary}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{e.actorStaffName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </RaisedCard>

      <RaisedCard style={{ marginBottom: '1rem', maxHeight: '14rem', overflow: 'auto' }}>
        <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Spending per visit</div>
        {spendBusy ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : spendGroups.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No ledger entries.</div>
        ) : (
          <table className="rooms-table">
            <thead>
              <tr>
                <th>Visit</th>
                <th>Net</th>
                <th>Gross</th>
                <th>Refunds</th>
              </tr>
            </thead>
            <tbody>
              {spendGroups.map((g) => (
                <tr key={g.visitId ?? 'unassigned'}>
                  <td className="room-number">
                    {g.visitStartedAt
                      ? new Date(g.visitStartedAt).toLocaleString()
                      : g.visitId
                        ? g.visitId.slice(0, 8)
                        : 'Unassigned'}
                  </td>
                  <td>${(g.netCents / 100).toFixed(2)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>${(g.grossCents / 100).toFixed(2)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>${(g.refundsCents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </RaisedCard>

      <RaisedCard style={{ marginBottom: '1rem', maxHeight: '14rem', overflow: 'auto' }}>
        <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Agreements</div>
        {agreementsBusy ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : agreementVisits.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No agreements found.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {agreementVisits.map((v) => (
              <div
                key={v.visitId}
                style={{ border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 10, padding: '0.6rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ fontWeight: 900 }}>{new Date(v.visitStartedAt).toLocaleString()}</div>
                  <button
                    className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 font-semibold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50"
                    onClick={() => navigator.clipboard.writeText(v.visitId)}
                  >
                    Copy visit id
                  </button>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <table className="rooms-table">
                    <thead>
                      <tr>
                        <th>Block</th>
                        <th>Signed</th>
                        <th>PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.checkinBlocks.map((b) => (
                        <tr key={b.checkinBlockId}>
                          <td className="room-number">
                            {new Date(b.startsAt).toLocaleString()} — {b.rentalType}{' '}
                            {b.roomNumber
                              ? `Room ${b.roomNumber}`
                              : b.lockerNumber
                                ? `Locker ${b.lockerNumber}`
                                : ''}
                          </td>
                          <td
                            style={{
                              color: b.agreementSigned ? 'var(--success)' : 'var(--text-muted)',
                              fontWeight: 700,
                            }}
                          >
                            {b.agreementSigned ? 'Yes' : 'No'}
                          </td>
                          <td>
                            <button
                              className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                              disabled={!b.hasPdf}
                              onClick={() => {
                                downloadCustomerDocumentPdf(sessionToken, b.checkinBlockId)
                                  .then(async (blob) => {
                                    const obj = URL.createObjectURL(blob);
                                    window.open(obj, '_blank', 'noopener,noreferrer');
                                    window.setTimeout(() => URL.revokeObjectURL(obj), 60_000);
                                  })
                                  .catch((e) =>
                                    onError(e instanceof Error ? e.message : 'Download failed')
                                  );
                              }}
                            >
                              View PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </RaisedCard>

      <RaisedCard>
        <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Past Due</div>
        <div style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Waiving past due sets the customer’s past due balance to $0.00.
        </div>
        <button className="btn-secondary" disabled={busy || !canWaivePastDue} onClick={onWaivePastDue}>
          Waive Past Due (admin)
        </button>
      </RaisedCard>
    </>
  );
}
