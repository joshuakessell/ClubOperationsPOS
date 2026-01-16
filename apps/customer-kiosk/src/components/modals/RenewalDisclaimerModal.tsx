import { t, type Language } from '../../i18n';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export interface RenewalDisclaimerModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  blockEndsAt?: string | null;
  onClose: () => void;
  onProceed: () => void;
  isSubmitting: boolean;
}

export function RenewalDisclaimerModal({
  isOpen,
  customerPrimaryLanguage,
  blockEndsAt,
  onClose,
  onProceed,
  isSubmitting,
}: RenewalDisclaimerModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(customerPrimaryLanguage, 'renewal.title')} width="2xl">
      <div className="grid gap-6">
        <div className="text-left">
          <ul className="list-disc space-y-3 pl-6 text-lg text-gray-700">
            <li>
              {t(customerPrimaryLanguage, 'renewal.bullet.extendsStay')}
              {blockEndsAt && (
                <span>
                  {' '}
                  {t(customerPrimaryLanguage, 'renewal.currentCheckout', {
                    time: new Date(blockEndsAt).toLocaleString(),
                  })}
                </span>
              )}
            </li>
            <li className="font-semibold text-amber-700">
              {t(customerPrimaryLanguage, 'renewal.bullet.approachingMax')}
            </li>
            <li>{t(customerPrimaryLanguage, 'renewal.bullet.finalExtension')}</li>
            <li>{t(customerPrimaryLanguage, 'renewal.bullet.feeNotChargedNow')}</li>
          </ul>
        </div>
        <div className="flex justify-center">
          <Button onClick={() => void onProceed()} disabled={isSubmitting} className="min-w-[240px]">
            {t(customerPrimaryLanguage, 'common.ok')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

