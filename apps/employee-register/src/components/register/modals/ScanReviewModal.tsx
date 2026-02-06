import { ModalFrame } from './ModalFrame';
import type { ScanReviewData, ScanReviewField } from '../../../app/state/slices/useScanReviewState';

export function ScanReviewModal(props: {
  isOpen: boolean;
  scanReviewData: ScanReviewData | null;
  errorMessage: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  onChangeField: (field: ScanReviewField, value: string) => void;
}) {
  const { isOpen, scanReviewData, errorMessage, isSubmitting, onCancel, onSubmit, onChangeField } =
    props;

  const values = scanReviewData ?? {
    firstName: '',
    lastName: '',
    dob: '',
    idExpirationDate: '',
    idNumber: '',
  };

  return (
    <ModalFrame
      isOpen={isOpen}
      title="Review ID Scan"
      onClose={onCancel}
      maxWidth="720px"
      closeOnOverlayClick={false}
    >
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ color: '#94a3b8' }}>
          Verify or correct the scanned ID details, then submit to search existing customers or
          create a new profile.
        </div>

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

        <div className="cs-liquid-card" style={{ padding: '1rem' }}>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
              <span style={{ color: '#94a3b8' }}>First Name</span>
              <input
                className="cs-liquid-input"
                value={values.firstName}
                onChange={(e) => onChangeField('firstName', e.target.value)}
                autoComplete="off"
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
              <span style={{ color: '#94a3b8' }}>Last Name</span>
              <input
                className="cs-liquid-input"
                value={values.lastName}
                onChange={(e) => onChangeField('lastName', e.target.value)}
                autoComplete="off"
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
              <span style={{ color: '#94a3b8' }}>Date of Birth</span>
              <input
                className="cs-liquid-input"
                value={values.dob}
                onChange={(e) => onChangeField('dob', e.target.value)}
                placeholder="YYYY-MM-DD"
                autoComplete="off"
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
              <span style={{ color: '#94a3b8' }}>Expiration Date</span>
              <input
                className="cs-liquid-input"
                value={values.idExpirationDate}
                onChange={(e) => onChangeField('idExpirationDate', e.target.value)}
                placeholder="YYYY-MM-DD"
                autoComplete="off"
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
              <span style={{ color: '#94a3b8' }}>ID Number</span>
              <input
                className="cs-liquid-input"
                value={values.idNumber}
                onChange={(e) => onChangeField('idNumber', e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            className="cs-liquid-button cs-liquid-button--secondary"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button className="cs-liquid-button" disabled={isSubmitting} onClick={onSubmit}>
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
