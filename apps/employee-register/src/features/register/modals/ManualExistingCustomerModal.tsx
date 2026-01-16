import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { ModalFrame } from './ModalFrame';
import type { ManualExistingPrompt } from '../controller/useManualEntryController';

export function ManualExistingCustomerModal(props: {
  open: boolean;
  prompt: ManualExistingPrompt | null;
  error: string | null;
  isSubmitting: boolean;
  isBusy: boolean;
  onClose: () => void;
  onChooseExisting: () => void;
  onCreateNew: () => void;
}): JSX.Element | null {
  const { open, prompt, error, isSubmitting, isBusy, onClose, onChooseExisting, onCreateNew } =
    props;
  if (!open) return null;

  return (
    <ModalFrame
      isOpen={true}
      title="Existing customer found"
      onClose={onClose}
      maxWidth="640px"
      closeOnOverlayClick={false}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ color: '#94a3b8' }}>
          An existing customer already matches this First Name, Last Name, and Date of Birth. Do you
          want to continue?
        </div>

        {prompt?.matchCount && prompt.matchCount > 1 ? (
          <div style={{ color: '#f59e0b', fontWeight: 800 }}>
            {prompt.matchCount} matching customers found. Showing best match:
          </div>
        ) : null}

        {prompt ? (
          <Card padding="md" className="bg-slate-900/70 text-white ring-slate-700">
            <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{prompt.bestMatch.name}</div>
            <div
              style={{
                marginTop: '0.25rem',
                color: '#94a3b8',
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <span>
                DOB:{' '}
                <strong style={{ color: 'white' }}>
                  {prompt.bestMatch.dob || prompt.dobIso}
                </strong>
              </span>
              {prompt.bestMatch.membershipNumber ? (
                <span>
                  Membership:{' '}
                  <strong style={{ color: 'white' }}>{prompt.bestMatch.membershipNumber}</strong>
                </span>
              ) : null}
            </div>
          </Card>
        ) : null}

        {error ? (
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
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting || isBusy}
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting || isBusy || !prompt}
            onClick={onChooseExisting}
          >
            Existing Customer
          </Button>

          <Button type="button" disabled={isSubmitting || isBusy || !prompt} onClick={onCreateNew}>
            Create New
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}

