import { t, type Language } from '../../i18n';
import { getRentalDisplayName } from '../../utils/display';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

export interface WaitlistModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  desiredType: string;
  allowedRentals: string[];
  inventory: {
    rooms: Record<string, number>;
    lockers: number;
  } | null;
  position: number | null;
  eta: string | null;
  upgradeFee: number | null;
  isSubmitting: boolean;
  onBackupSelection: (rental: string) => void;
  onClose: () => void;
}

export function WaitlistModal({
  isOpen,
  customerPrimaryLanguage,
  desiredType,
  allowedRentals,
  inventory,
  position,
  eta,
  upgradeFee,
  isSubmitting,
  onBackupSelection,
  onClose,
}: WaitlistModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(customerPrimaryLanguage, 'waitlist.modalTitle')} width="3xl">
      <div className="grid gap-6">
        <div className="grid gap-4 text-lg text-gray-700">
          <p>
            {t(customerPrimaryLanguage, 'waitlist.currentlyUnavailable', {
              rental: getRentalDisplayName(desiredType, customerPrimaryLanguage),
            })}
          </p>
          {position !== null && (
            <Card className="bg-slate-900/70 ring-slate-700 text-white">
              <p className="text-lg font-semibold">{t(customerPrimaryLanguage, 'waitlist.infoTitle')}</p>
              <p className="mt-2 text-lg">
                {t(customerPrimaryLanguage, 'waitlist.position')}: <span className="font-semibold">#{position}</span>
              </p>
              <p className="mt-1 text-lg">
                {t(customerPrimaryLanguage, 'waitlist.estimatedReady')}:{' '}
                <span className="font-semibold">
                  {eta ? new Date(eta).toLocaleString() : t(customerPrimaryLanguage, 'waitlist.unknown')}
                </span>
              </p>
              {upgradeFee !== null && upgradeFee > 0 && (
                <p className="mt-2 text-lg font-semibold text-amber-300">
                  {t(customerPrimaryLanguage, 'waitlist.upgradeFee')}: ${upgradeFee.toFixed(2)}
                </p>
              )}
            </Card>
          )}
          <p>{t(customerPrimaryLanguage, 'waitlist.instructions')}</p>
          <p className="text-base text-gray-500">{t(customerPrimaryLanguage, 'waitlist.noteChargedBackup')}</p>
        </div>

        <div className="grid gap-3">
          <p className="text-lg font-semibold text-gray-900">
            {t(customerPrimaryLanguage, 'waitlist.selectBackup')}
          </p>
          <div className="flex flex-col gap-3">
            {allowedRentals
              .filter((rental) => rental !== desiredType)
              .map((rental) => {
                const availableCount =
                  inventory?.rooms[rental] ||
                  (rental === 'LOCKER' || rental === 'GYM_LOCKER' ? inventory?.lockers : 0) ||
                  0;
                const isAvailable = availableCount > 0;
                return (
                  <Button
                    key={rental}
                    onClick={() => onBackupSelection(rental)}
                    disabled={!isAvailable || isSubmitting}
                    variant="primary"
                    className={!isAvailable ? 'opacity-60' : undefined}
                  >
                    {getRentalDisplayName(rental, customerPrimaryLanguage)}
                    {!isAvailable && ` ${t(customerPrimaryLanguage, 'waitlist.unavailableSuffix')}`}
                  </Button>
                );
              })}
          </div>
        </div>

        <div className="flex justify-center">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting} className="min-w-[240px]">
            {t(customerPrimaryLanguage, 'common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

