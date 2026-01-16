import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

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
      <div className="grid gap-3">
        <div className="text-sm text-gray-600">Select the correct customer to continue.</div>

        {errorMessage ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {errorMessage}
          </div>
        ) : null}

        <Card padding="none" className="overflow-hidden">
          {candidates.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">No candidates.</div>
          ) : (
            <div className="grid">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  disabled={isSubmitting}
                  className="w-full border-b border-gray-200 p-4 text-left hover:bg-gray-50 disabled:opacity-60"
                >
                  <div className="font-semibold text-gray-900">{c.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
                    {c.dob ? <span>DOB: {c.dob}</span> : null}
                    {c.membershipNumber ? <span>Membership: {c.membershipNumber}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="flex justify-end">
          <Button variant="danger" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}

