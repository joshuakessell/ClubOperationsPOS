import { useEffect, useState } from 'react';
import { t, type Language } from '../../i18n';
import { getRentalDisplayName } from '../../utils/display';
import { KioskModal } from '../../views/KioskModal';
import { KioskModalActions } from '../../views/KioskModalActions';

export interface WaitlistModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  desiredType: string;
  desiredTypes: string[];
  requestedResourceNumber: string | null;
  requestedResourceType: 'room' | 'locker' | null;
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
  onDesiredTypesChange: (next: string[]) => void;
  onSpecificSelection: (params: {
    resourceType: 'room' | 'locker' | null;
    resourceNumber: string | null;
  }) => void;
  onSpecificFocus?: () => void;
  specificOptions?: {
    rooms: Record<'SPECIAL' | 'DOUBLE' | 'STANDARD', Array<{ number: string; status: string }>>;
    lockers: Array<{ number: string; status: string }>;
  } | null;
  onBackupSelection: (rental: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function WaitlistModal({
  isOpen,
  customerPrimaryLanguage,
  desiredType,
  desiredTypes,
  requestedResourceNumber,
  requestedResourceType,
  allowedRentals,
  inventory,
  position,
  eta,
  upgradeFee,
  isSubmitting,
  highlightedBackupRental = null,
  onDesiredTypesChange,
  onSpecificSelection,
  onSpecificFocus,
  specificOptions,
  onBackupSelection,
  onSubmit,
  onClose,
}: WaitlistModalProps) {
  const unavailableChoices = allowedRentals.filter((rental) => {
    const availableCount =
      inventory?.rooms[rental] ||
      (rental === 'LOCKER' || rental === 'GYM_LOCKER' ? inventory?.lockers : 0) ||
      0;
    return availableCount <= 0;
  });

  const backupChoices = allowedRentals.filter((rental) => {
    const availableCount =
      inventory?.rooms[rental] ||
      (rental === 'LOCKER' || rental === 'GYM_LOCKER' ? inventory?.lockers : 0) ||
      0;
    return rental !== desiredType && availableCount > 0;
  });

  const currentDesiredSet = new Set(desiredTypes.length > 0 ? desiredTypes : [desiredType]);
  const [showBackupStep, setShowBackupStep] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowBackupStep(false);
    }
  }, [isOpen]);

  const canProceedFromPreferences =
    currentDesiredSet.size > 0 || Boolean(requestedResourceNumber && requestedResourceNumber.trim());

  const specificRoomOptions = [
    ...(specificOptions?.rooms.SPECIAL ?? []),
    ...(specificOptions?.rooms.DOUBLE ?? []),
    ...(specificOptions?.rooms.STANDARD ?? []),
  ];

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
        <div className="ck-modal-info-box">
          <p className="ck-modal-info-title">{t(customerPrimaryLanguage, 'waitlist.infoTitle')}</p>
          <p>
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
            <p className="ck-modal-info-warning">
              {t(customerPrimaryLanguage, 'waitlist.upgradeFee')}:{' '}
              <strong>${upgradeFee.toFixed(2)}</strong>
            </p>
          )}
        </div>
      )}
      {!showBackupStep ? (
        <>
          <div className="ck-modal-section">
            <p className="ck-modal-section-title">{t(customerPrimaryLanguage, 'waitlist.selectDesired')}</p>
            <div className="ck-modal-stack">
              {unavailableChoices.map((rental) => {
                const checked = currentDesiredSet.has(rental);
                return (
                  <label key={rental} className="ck-waitlist-checkbox-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = new Set(currentDesiredSet);
                        if (event.target.checked) next.add(rental);
                        else next.delete(rental);
                        onDesiredTypesChange(Array.from(next));
                        if (next.size > 0 && requestedResourceNumber) {
                          onSpecificSelection({ resourceType: null, resourceNumber: null });
                        }
                      }}
                      disabled={isSubmitting}
                    />
                    <span>{getRentalDisplayName(rental, customerPrimaryLanguage)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="ck-modal-section">
            <p className="ck-modal-section-title">{t(customerPrimaryLanguage, 'waitlist.requestSpecific')}</p>
            <select
              className="cs-liquid-input"
              value={
                requestedResourceNumber
                  ? `${requestedResourceType ?? 'room'}:${requestedResourceNumber}`
                  : ''
              }
              onFocus={() => onSpecificFocus?.()}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  onSpecificSelection({ resourceType: null, resourceNumber: null });
                  return;
                }

                const [resourceType, resourceNumber] = value.split(':', 2);
                const parsedResourceType =
                  resourceType === 'locker' ? 'locker' : resourceType === 'room' ? 'room' : null;
                onSpecificSelection({
                  resourceType: parsedResourceType,
                  resourceNumber: resourceNumber || null,
                });
                if (resourceNumber) onDesiredTypesChange([]);
              }}
              disabled={isSubmitting}
            >
              <option value="">{t(customerPrimaryLanguage, 'waitlist.requestSpecificPlaceholder')}</option>
              {specificRoomOptions.length > 0 ? (
                <optgroup label="Rooms">
                  {specificRoomOptions.map((room) => (
                    <option key={`room-${room.number}`} value={`room:${room.number}`}>
                      {room.number}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {(specificOptions?.lockers?.length ?? 0) > 0 ? (
                <optgroup label="Lockers">
                  {(specificOptions?.lockers ?? []).map((locker) => (
                    <option key={`locker-${locker.number}`} value={`locker:${locker.number}`}>
                      {locker.number}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>

          <KioskModalActions>
            <button
              className="cs-liquid-button ck-modal-btn"
              onClick={() => setShowBackupStep(true)}
              disabled={isSubmitting || !canProceedFromPreferences}
            >
              {t(customerPrimaryLanguage, 'waitlist.nextToBackup')}
            </button>
            <button
              className="cs-liquid-button cs-liquid-button--secondary ck-modal-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t(customerPrimaryLanguage, 'common.cancel')}
            </button>
          </KioskModalActions>
        </>
      ) : (
        <>
          <p className="ck-modal-spaced">{t(customerPrimaryLanguage, 'waitlist.instructions')}</p>
          <p className="ck-modal-note">{t(customerPrimaryLanguage, 'waitlist.noteChargedBackup')}</p>

          <div className="ck-modal-section">
            <p className="ck-modal-section-title">{t(customerPrimaryLanguage, 'waitlist.selectBackup')}</p>
            <div className="ck-modal-stack">
              {backupChoices.map((rental) => {
                const availableCount =
                  inventory?.rooms[rental] ||
                  (rental === 'LOCKER' || rental === 'GYM_LOCKER' ? inventory?.lockers : 0) ||
                  0;
                const isAvailable = availableCount > 0;

                return (
                  <button
                    key={rental}
                    className={[
                      'cs-liquid-button',
                      'ck-modal-btn',
                      highlightedBackupRental === rental ? 'ck-option-highlight' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => onBackupSelection(rental)}
                    disabled={!isAvailable || isSubmitting}
                    style={{
                      opacity: isAvailable ? 1 : 0.5,
                      cursor: isAvailable && !isSubmitting ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {getRentalDisplayName(rental, customerPrimaryLanguage)}
                    {!isAvailable && ` ${t(customerPrimaryLanguage, 'waitlist.unavailableSuffix')}`}
                  </button>
                );
              })}
            </div>
          </div>

          <KioskModalActions>
            <button
              className="cs-liquid-button ck-modal-btn"
              onClick={onSubmit}
              disabled={isSubmitting || !canProceedFromPreferences || !backupChoices.length}
            >
              {t(customerPrimaryLanguage, 'common.continue')}
            </button>
            <button
              className="cs-liquid-button cs-liquid-button--secondary ck-modal-btn"
              onClick={() => setShowBackupStep(false)}
              disabled={isSubmitting}
            >
              {t(customerPrimaryLanguage, 'waitlist.backToPreferences')}
            </button>
          </KioskModalActions>
        </>
      )}
    </KioskModal>
  );
}
