import { ModalFrame } from './ModalFrame';

export type MultipleMatchCandidate = {
  id: string;
  name: string;
  dob: string | null;
  membershipNumber: string | null;
  matchScore: number;
};

export type MultipleMatchesModalProps = {
  isOpen: boolean;
  candidates: MultipleMatchCandidate[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSelect: (customerId: string) => void;
};

export function MultipleMatchesModal({
  isOpen,
  candidates,
  errorMessage,
  isSubmitting = false,
  onCancel,
  onSelect,
}: MultipleMatchesModalProps) {
  return (
    <ModalFrame
      isOpen={isOpen}
      title="Multiple matches found"
      onClose={onCancel}
      maxWidth="720px"
      maxHeight="70vh"
      closeOnOverlayClick={false}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ color: '#94a3b8' }}>Select the correct customer to continue.</div>

        {errorMessage ? (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 12,
              color: '#fecaca',
              fontWeight: 800,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <div
          className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          style={{
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {candidates.length === 0 ? (
            <div style={{ padding: '1rem', color: '#94a3b8' }}>No candidates.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  disabled={isSubmitting}
                  className="w-full rounded-none border-0 border-b border-gray-200 bg-transparent px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '1rem',
                    borderRadius: 0,
                    border: 'none',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
                    display: 'grid',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>{c.name}</div>
                  <div
                    style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: '#94a3b8' }}
                  >
                    {c.dob && <span>DOB: {c.dob}</span>}
                    {c.membershipNumber && <span>Membership: {c.membershipNumber}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-error-300 bg-error-50 px-4 py-2.5 text-sm font-semibold text-error-600 shadow-theme-xs transition hover:bg-error-100 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
