import { t, type Language } from '../../i18n';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export interface MembershipModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  intent: 'PURCHASE' | 'RENEW';
  onContinue: () => void;
  onClose: () => void;
  isSubmitting: boolean;
}

export function MembershipModal({
  isOpen,
  customerPrimaryLanguage,
  intent,
  onContinue,
  onClose,
  isSubmitting,
}: MembershipModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(customerPrimaryLanguage, 'membership.modal.title')} width="2xl">
      <div className="grid gap-6">
        <div className="text-lg text-gray-700">
          {intent === 'PURCHASE'
            ? t(customerPrimaryLanguage, 'membership.modal.body.purchase')
            : t(customerPrimaryLanguage, 'membership.modal.body.renew')}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button onClick={() => void onContinue()} disabled={isSubmitting} className="min-w-[240px]">
            {t(customerPrimaryLanguage, 'common.continue')}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting} className="min-w-[240px]">
            {t(customerPrimaryLanguage, 'common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

