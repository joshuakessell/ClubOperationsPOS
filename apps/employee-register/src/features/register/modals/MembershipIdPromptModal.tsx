import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { Input } from '../../../ui/Input';

export interface MembershipIdPromptModalProps {
  isOpen: boolean;
  membershipIdMode: 'KEEP_EXISTING' | 'ENTER_NEW';
  membershipIdInput: string;
  membershipNumber?: string | null;
  membershipPurchaseIntent?: 'PURCHASE' | 'RENEW' | null;
  error: string | null;
  isSubmitting: boolean;
  onModeChange: (mode: 'KEEP_EXISTING' | 'ENTER_NEW') => void;
  onInputChange: (value: string) => void;
  onConfirm: (membershipId?: string) => void;
  onNotNow: () => void;
}

export function MembershipIdPromptModal({
  isOpen,
  membershipIdMode,
  membershipIdInput,
  membershipNumber,
  membershipPurchaseIntent,
  error,
  isSubmitting,
  onModeChange,
  onInputChange,
  onConfirm,
  onNotNow,
}: MembershipIdPromptModalProps) {
  return (
    <ModalFrame isOpen={isOpen} title="Enter Membership ID" onClose={onNotNow} maxWidth="520px">
      <p className="mb-4 text-sm text-gray-600">
        Payment was accepted for a 6 month membership. Scan or type the membership number from the
        physical card, then press Enter.
      </p>

      {membershipPurchaseIntent === 'RENEW' && membershipNumber ? (
        <div className="mb-3">
          <div className="mb-3 flex gap-3">
            <Button
              onClick={() => onModeChange('KEEP_EXISTING')}
              disabled={isSubmitting}
              variant={membershipIdMode === 'KEEP_EXISTING' ? 'primary' : 'secondary'}
              className="flex-1"
            >
              Keep Same ID
            </Button>
            <Button
              onClick={() => onModeChange('ENTER_NEW')}
              disabled={isSubmitting}
              variant={membershipIdMode === 'ENTER_NEW' ? 'primary' : 'secondary'}
              className="flex-1"
            >
              Enter New ID
            </Button>
          </div>

          {membershipIdMode === 'KEEP_EXISTING' && (
            <Card padding="md" className="font-mono text-lg tracking-wide">
              {membershipNumber}
            </Card>
          )}
        </div>
      ) : null}

      {(membershipPurchaseIntent !== 'RENEW' ||
        !membershipNumber ||
        membershipIdMode === 'ENTER_NEW') && (
        <Input
          type="text"
          value={membershipIdInput}
          autoFocus
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              onConfirm(
                membershipIdMode === 'KEEP_EXISTING' && membershipPurchaseIntent === 'RENEW'
                  ? membershipNumber ?? undefined
                  : undefined
              );
            }
          }}
          placeholder="Membership ID"
          disabled={isSubmitting}
          className="mb-3 font-mono text-lg tracking-wide"
        />
      )}

      {error ? <div className="mb-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="flex gap-3">
        <Button
          onClick={() =>
            onConfirm(
              membershipIdMode === 'KEEP_EXISTING' && membershipPurchaseIntent === 'RENEW'
                ? membershipNumber ?? undefined
                : undefined
            )
          }
          disabled={
            isSubmitting ||
            (membershipIdMode === 'KEEP_EXISTING' && membershipPurchaseIntent === 'RENEW'
              ? !membershipNumber
              : !membershipIdInput.trim())
          }
          className="flex-1"
        >
          {isSubmitting ? 'Saving…' : 'Save Membership'}
        </Button>
        <Button
          onClick={onNotNow}
          disabled={isSubmitting}
          variant="secondary"
        >
          Not now
        </Button>
      </div>
    </ModalFrame>
  );
}

