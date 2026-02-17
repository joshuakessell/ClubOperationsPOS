import { ReactNode } from 'react';
import { I18nProvider, t } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { KioskNoticeBanner } from '../views/KioskNoticeBanner';
import { KioskOptionButton } from '../views/KioskOptionButton';
import type { KioskNotice } from '../app/notice';
import { PurchaseCard } from '../views/PurchaseCard';
import { getRentalDisplayName } from '../utils/display';
import { getMembershipStatus, type SessionState } from '../utils/membership';

export interface SelectionScreenProps {
  session: SessionState;
  inventory: {
    rooms: Record<string, number>;
    lockers: number;
  } | null;
  proposedRentalType: string | null;
  proposedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectionConfirmed: boolean;
  selectionConfirmedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectedRental: string | null;
  isSubmitting: boolean;
  orientationOverlay: ReactNode;
  welcomeOverlay: ReactNode;
  notice?: KioskNotice | null;
  onSelectRental: (rental: string) => void;
  onToggleLanguage: () => void;
  membershipChoice: 'ONE_TIME' | 'SIX_MONTH' | null;
  onJoinWaitlist: () => void;
}

export function SelectionScreen({
  session,
  inventory,
  proposedRentalType,
  proposedBy,
  selectionConfirmed,
  selectionConfirmedBy,
  selectedRental,
  isSubmitting,
  orientationOverlay,
  welcomeOverlay,
  notice,
  onSelectRental,
  onToggleLanguage,
  membershipChoice,
  onJoinWaitlist,
}: SelectionScreenProps) {
  const lang = session.customerPrimaryLanguage;
  const membershipStatus = getMembershipStatus(session, Date.now());
  const membershipLabel =
    membershipStatus === 'ACTIVE'
      ? t(lang, 'membership.member')
      : membershipStatus === 'PENDING' || membershipChoice === 'SIX_MONTH'
        ? t(lang, 'membership.pending')
        : t(lang, 'membership.nonMember');
  const isPendingMembership = membershipStatus === 'PENDING' || membershipChoice === 'SIX_MONTH';

  const canInteract =
    !isSubmitting &&
    !session.pastDueBlocked &&
    !selectionConfirmed;

  const rentalOrder = ['LOCKER', 'GYM_LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'] as const;
  const allowedSet = new Set(session.allowedRentals);
  const rentalsToShow = rentalOrder.filter((r) => allowedSet.has(r));
  const getAvailableCount = (rental: string) =>
    inventory?.rooms?.[rental] ??
    (rental === 'LOCKER' || rental === 'GYM_LOCKER' ? inventory?.lockers : undefined);
  const hasUnavailableRentals = rentalsToShow.some((rental) => getAvailableCount(rental) === 0);
  const hasStaffProposedUnavailable =
    proposedBy === 'EMPLOYEE' &&
    !selectionConfirmed &&
    proposedRentalType != null &&
    getAvailableCount(proposedRentalType) === 0;

  const selectionTone: 'success' | 'info' | 'muted' = selectionConfirmed
    ? 'success'
    : proposedBy === 'EMPLOYEE'
      ? 'info'
      : 'muted';

  return (
    <I18nProvider lang={session.customerPrimaryLanguage}>
      <ScreenShell backgroundVariant="steamroom1" showLogoWatermark={true} watermarkLayer="under">
        {orientationOverlay}
        {welcomeOverlay}
        <div className="active-content">
          <main className="main-content">
            <div className="customer-info">
              <h1 className="customer-name">{session.customerName || t(lang, 'welcome')}</h1>
              <div
                className={
                  isPendingMembership
                    ? 'customer-membership-subheader customer-membership-subheader--pending'
                    : 'customer-membership-subheader'
                }
              >
                {membershipLabel}
              </div>
            </div>

            {/* Language toggle */}
            <button
              type="button"
              className="ck-language-toggle"
              onClick={onToggleLanguage}
              disabled={isSubmitting}
            >
              {lang === 'ES' ? 'English?' : '¿Español?'}
            </button>

            {notice && (
              <KioskNoticeBanner tone={notice.tone ?? 'warning'} title={notice.title}>
                {notice.message}
              </KioskNoticeBanner>
            )}

            {/* Past-due block message */}
            {session.pastDueBlocked && (
              <div className="past-due-block-message">
                <p>{t(session.customerPrimaryLanguage, 'pastDueBlocked')}</p>
              </div>
            )}

            {/* Selection State Display */}
            {proposedRentalType && (
              <KioskNoticeBanner
                tone={selectionTone}
                className="ck-selection-proposed-banner"
                title={
                  selectionConfirmed
                    ? `✓ ${t(session.customerPrimaryLanguage, 'selected')}: ${getRentalDisplayName(proposedRentalType, session.customerPrimaryLanguage)} (${selectionConfirmedBy === 'CUSTOMER' ? t(session.customerPrimaryLanguage, 'common.you') : t(session.customerPrimaryLanguage, 'common.staff')})`
                    : proposedBy === 'EMPLOYEE'
                      ? `${t(session.customerPrimaryLanguage, 'proposed')}: ${getRentalDisplayName(proposedRentalType, session.customerPrimaryLanguage)} (${t(session.customerPrimaryLanguage, 'selection.staffSuggestionHint')})`
                      : `${t(session.customerPrimaryLanguage, 'selected')}: ${getRentalDisplayName(proposedRentalType, session.customerPrimaryLanguage)} (${t(session.customerPrimaryLanguage, 'common.you')})`
                }
              />
            )}

            <div className="purchase-cards">
              <PurchaseCard variant="rental" active={true} title={t(lang, 'rental.title')}>
                {rentalsToShow.length > 0 ? (
                  <>
                    <div className="rental-grid">
                      {rentalsToShow.map((rental) => {
                        const availableCount = getAvailableCount(rental);
                        const showWarning =
                          typeof availableCount === 'number' &&
                          availableCount > 0 &&
                          availableCount <= 5;
                        const isUnavailable = availableCount === 0;
                        const isDisabled =
                          !session.customerPrimaryLanguage ||
                          session.pastDueBlocked ||
                          selectionConfirmed ||
                          isUnavailable;
                        const isSelected =
                          proposedRentalType === rental &&
                          (selectionConfirmed || proposedBy === 'CUSTOMER');
                        const isStaffProposed =
                          proposedBy === 'EMPLOYEE' &&
                          proposedRentalType === rental &&
                          !selectionConfirmed;
                        const isForced =
                          selectedRental === rental &&
                          selectionConfirmed &&
                          selectionConfirmedBy === 'EMPLOYEE';

                        const displayName = getRentalDisplayName(rental, lang);
                        const span2 =
                          rental === 'LOCKER' || rental === 'GYM_LOCKER' || rental === 'STANDARD';
                        const subtext =
                          showWarning && !isUnavailable && typeof availableCount === 'number'
                            ? t(lang, 'availability.onlyAvailable', { count: availableCount })
                            : isUnavailable
                              ? t(lang, 'availability.unavailable')
                              : null;

                        return (
                          <KioskOptionButton
                            key={rental}
                            span={span2 ? 2 : 1}
                            selected={isSelected}
                            staffProposed={isStaffProposed}
                            disabled={isDisabled}
                            disabledStyle={isDisabled}
                            stacked={true}
                            data-forced={isForced}
                            onClick={() => {
                              if (isDisabled) return;
                              void onSelectRental(rental);
                            }}
                            title={displayName}
                            subtext={subtext}
                          />
                        );
                      })}
                    </div>

                    {hasUnavailableRentals ? (
                      <button
                        type="button"
                        className={[
                          'cs-liquid-button',
                          hasStaffProposedUnavailable
                            ? 'cs-liquid-button--staff-proposed'
                            : 'cs-liquid-button--secondary',
                          'ck-waitlist-entry-btn',
                        ].join(' ')}
                        onClick={() => {
                          if (!canInteract) return;
                          onJoinWaitlist();
                        }}
                        disabled={!canInteract}
                      >
                        {t(lang, 'waitlist.joinButton')}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="cs-liquid-button cs-liquid-button--disabled">
                    {t(lang, 'noOptionsAvailable')}
                  </div>
                )}
              </PurchaseCard>
            </div>
          </main>
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}
