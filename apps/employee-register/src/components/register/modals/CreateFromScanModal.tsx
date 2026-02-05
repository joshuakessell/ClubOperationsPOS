import { ModalFrame } from './ModalFrame';

type PendingCreateFromScan = {
  idScanValue: string;
  idScanHash: string | null;
  extracted: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    dob?: string;
    idExpirationDate?: string;
    idNumber?: string;
    idType?: 'STATE_ID' | 'DRIVERS_LICENSE' | 'PASSPORT' | 'OTHER';
    idTypeOther?: string;
    issuer?: string;
    jurisdiction?: string;
    idState?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
};

export function CreateFromScanModal(props: {
  isOpen: boolean;
  pendingCreateFromScan: PendingCreateFromScan | null;
  createFromScanError: string | null;
  createFromScanSubmitting: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  const {
    isOpen,
    pendingCreateFromScan,
    createFromScanError,
    createFromScanSubmitting,
    isSubmitting,
    onClose,
    onCreate,
  } = props;
  const idTypeLabel = (() => {
    const idType = pendingCreateFromScan?.extracted.idType;
    switch (idType) {
      case 'STATE_ID':
        return 'State ID';
      case 'DRIVERS_LICENSE':
        return 'Drivers License';
      case 'PASSPORT':
        return 'Passport';
      case 'OTHER':
        return pendingCreateFromScan?.extracted.idTypeOther?.trim()
          ? `Other (${pendingCreateFromScan?.extracted.idTypeOther})`
          : 'Other';
      default:
        return '—';
    }
  })();

  return (
    <ModalFrame
      isOpen={isOpen}
      title="No match found"
      onClose={onClose}
      maxWidth="720px"
      closeOnOverlayClick={false}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ color: '#94a3b8' }}>
          Create a new customer profile using the scanned details. Review the captured data below
          for troubleshooting.
        </div>

        {createFromScanError ? (
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
            {createFromScanError}
          </div>
        ) : null}

        <div className="cs-liquid-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: '#94a3b8' }}>
            <span>
              First:{' '}
              <strong style={{ color: 'white' }}>
                {pendingCreateFromScan?.extracted.firstName || '—'}
              </strong>
            </span>
            <span>
              Last:{' '}
              <strong style={{ color: 'white' }}>
                {pendingCreateFromScan?.extracted.lastName || '—'}
              </strong>
            </span>
            <span>
              DOB:{' '}
              <strong style={{ color: 'white' }}>
                {pendingCreateFromScan?.extracted.dob || '—'}
              </strong>
            </span>
          </div>
          <div
            style={{
              marginTop: '0.75rem',
              display: 'grid',
              gap: '0.35rem',
              color: '#94a3b8',
              fontSize: '0.9rem',
            }}
          >
            <div>
              Full Name:{' '}
              <strong style={{ color: 'white' }}>
                {pendingCreateFromScan?.extracted.fullName || '—'}
              </strong>
            </div>
            <div>
              ID Number:{' '}
              <strong style={{ color: 'white' }}>
                {pendingCreateFromScan?.extracted.idNumber || '—'}
              </strong>
            </div>
            <div>
              ID Type:{' '}
              <strong style={{ color: 'white' }}>
                {idTypeLabel}
              </strong>
            </div>
            <div>
              Issuer / State:{' '}
              <strong style={{ color: 'white' }}>
                {pendingCreateFromScan?.extracted.issuer ||
                  pendingCreateFromScan?.extracted.jurisdiction ||
                  pendingCreateFromScan?.extracted.idState ||
                  '—'}
              </strong>
            </div>
            <div>
              Expiration:{' '}
              <strong style={{ color: 'white' }}>
                {pendingCreateFromScan?.extracted.idExpirationDate || '—'}
              </strong>
            </div>
            <div>
              Address:{' '}
              <strong style={{ color: 'white' }}>
                {pendingCreateFromScan?.extracted.addressLine1 || '—'}
              </strong>
            </div>
            <div>
              City/State/ZIP:{' '}
              <strong style={{ color: 'white' }}>
                {[
                  pendingCreateFromScan?.extracted.city,
                  pendingCreateFromScan?.extracted.state,
                  pendingCreateFromScan?.extracted.postalCode,
                ]
                  .filter(Boolean)
                  .join(' ') || '—'}
              </strong>
            </div>
            <div>
              Scan Hash:{' '}
              <strong style={{ color: 'white' }}>
                {pendingCreateFromScan?.idScanHash || '—'}
              </strong>
            </div>
          </div>
        </div>

        <div className="cs-liquid-card" style={{ padding: '0.75rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Normalized scan text
          </div>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#e2e8f0',
              fontSize: '0.75rem',
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            {pendingCreateFromScan?.idScanValue || '—'}
          </pre>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            className="cs-liquid-button cs-liquid-button--secondary"
            disabled={createFromScanSubmitting || isSubmitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="cs-liquid-button"
            disabled={createFromScanSubmitting || isSubmitting || !pendingCreateFromScan}
            onClick={onCreate}
          >
            {createFromScanSubmitting ? 'Creating…' : 'Create Customer'}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
