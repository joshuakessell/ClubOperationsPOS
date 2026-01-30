import { t, type Language } from '../../i18n';
import { getRentalDisplayName } from '../../utils/display';
import { KioskModal } from '../../views/KioskModal';
import { KioskModalActions } from '../../views/KioskModalActions';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

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
  highlightedBackupRental?: string | null;
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
  highlightedBackupRental = null,
  onBackupSelection,
  onClose,
}: WaitlistModalProps) {
  return (
    <KioskModal
      isOpen={isOpen}
      title={t(customerPrimaryLanguage, 'waitlist.modalTitle')}
      onClose={onClose}
    >
      <p>
        {t(customerPrimaryLanguage, 'waitlist.currentlyUnavailable', {
          rental: getRentalDisplayName(desiredType, customerPrimaryLanguage),
        })}
      </p>
      {position !== null && (
        <Card className="mt-3 border-dashed p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t(customerPrimaryLanguage, 'waitlist.infoTitle')}
          </p>
          <p className="mt-2">
            {t(customerPrimaryLanguage, 'waitlist.position')}: <strong>#{position}</strong>
          </p>
          {eta ? (
            <p>
              {t(customerPrimaryLanguage, 'waitlist.estimatedReady')}:{' '}
              <strong>{new Date(eta).toLocaleString()}</strong>
            </p>
          ) : (
            <p>
              {t(customerPrimaryLanguage, 'waitlist.estimatedReady')}:{' '}
              <strong>{t(customerPrimaryLanguage, 'waitlist.unknown')}</strong>
            </p>
          )}
          {upgradeFee !== null && upgradeFee > 0 && (
            <p className="mt-2 text-amber-600">
              {t(customerPrimaryLanguage, 'waitlist.upgradeFee')}:{' '}
              <strong>${upgradeFee.toFixed(2)}</strong>
            </p>
          )}
        </Card>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        {t(customerPrimaryLanguage, 'waitlist.instructions')}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {t(customerPrimaryLanguage, 'waitlist.noteChargedBackup')}
      </p>
      <div className="mt-4">
        <p className="text-sm font-semibold">
          {t(customerPrimaryLanguage, 'waitlist.selectBackup')}
        </p>
        <div className="mt-3 grid gap-2">
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
                  variant="secondary"
                  className={highlightedBackupRental === rental ? 'ring-2 ring-primary/40' : ''}
                  onClick={() => onBackupSelection(rental)}
                  disabled={!isAvailable || isSubmitting}
                >
                  {getRentalDisplayName(rental, customerPrimaryLanguage)}
                  {!isAvailable && ` ${t(customerPrimaryLanguage, 'waitlist.unavailableSuffix')}`}
                </Button>
              );
            })}
        </div>
      </div>
      <KioskModalActions>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          {t(customerPrimaryLanguage, 'common.cancel')}
        </Button>
      </KioskModalActions>
    </KioskModal>
  );
}
