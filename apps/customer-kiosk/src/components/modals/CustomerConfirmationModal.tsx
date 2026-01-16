import { t, type Language } from '../../i18n';
import { getRentalDisplayName } from '../../utils/display';
import type { CustomerConfirmationRequiredPayload } from '@club-ops/shared';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export interface CustomerConfirmationModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  data: CustomerConfirmationRequiredPayload;
  onAccept: () => void;
  onDecline: () => void;
  isSubmitting: boolean;
}

export function CustomerConfirmationModal({
  isOpen,
  customerPrimaryLanguage,
  data,
  onAccept,
  onDecline,
  isSubmitting,
}: CustomerConfirmationModalProps) {
  return (
    <Modal open={isOpen} onClose={() => {}} title={t(customerPrimaryLanguage, 'confirmDifferent.title')} width="2xl">
      <div className="grid gap-6">
        <div className="grid gap-3 text-lg text-gray-700">
          <p>
            {t(customerPrimaryLanguage, 'confirmDifferent.youRequested')}{' '}
            <span className="font-semibold">
              {getRentalDisplayName(data.requestedType, customerPrimaryLanguage)}
            </span>
          </p>
          <p>
            {t(customerPrimaryLanguage, 'confirmDifferent.staffSelected')}{' '}
            <span className="font-semibold">
              {getRentalDisplayName(data.selectedType, customerPrimaryLanguage)} {data.selectedNumber}
            </span>
          </p>
          <p>{t(customerPrimaryLanguage, 'confirmDifferent.question')}</p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button onClick={() => void onAccept()} disabled={isSubmitting} className="min-w-[240px]">
            {t(customerPrimaryLanguage, 'common.accept')}
          </Button>
          <Button variant="danger" onClick={() => void onDecline()} disabled={isSubmitting} className="min-w-[240px]">
            {t(customerPrimaryLanguage, 'common.decline')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

