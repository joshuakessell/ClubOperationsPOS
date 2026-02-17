import type { ReactNode } from 'react';
import { PanelHeader } from '../../views/PanelHeader';

export type UpgradeWaitlistStatus = string;

export type UpgradeWaitlistEntry = {
  id: string;
  visitId: string;
  checkinBlockId: string;
  customerId?: string;
  desiredTier: string;
  backupTier: string;
  status: string;
  createdAt: string;
  checkinAt?: string;
  checkoutAt?: string;
  offeredAt?: string;
  roomId?: string | null;
  offeredRoomNumber?: string | null;
  displayIdentifier: string;
  currentRentalType: string;
  customerName?: string;
};

export interface UpgradesDrawerContentProps {
  waitlistEntries: UpgradeWaitlistEntry[];
  hasEligibleEntries: boolean;
  isEntryOfferEligible: (entryId: string, status: string, desiredTier: string) => boolean;
  onOffer: (entryId: string, desiredTier: string, customerLabel: string) => void;
  onStartPayment: (entry: UpgradeWaitlistEntry) => void;
  onCancelOffer: (entryId: string) => void;
  onOpenCustomerAccount?: (customerId: string, customerLabel?: string) => void;
  isSubmitting?: boolean;
  headerRightSlot?: ReactNode;
}

export function UpgradesDrawerContent({
  waitlistEntries,
  hasEligibleEntries: _hasEligibleEntries,
  isEntryOfferEligible,
  onOffer,
  onStartPayment,
  onCancelOffer,
  onOpenCustomerAccount,
  isSubmitting = false,
  headerRightSlot,
}: UpgradesDrawerContentProps) {
  const active = waitlistEntries.filter((e) => e.status === 'ACTIVE');
  const offered = waitlistEntries.filter((e) => e.status === 'OFFERED');

  return (
    <div
      className="er-surface"
      style={{
        padding: '1rem',
        borderRadius: 8,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <PanelHeader title="Upgrade Waitlist" spacing="sm" action={headerRightSlot} />

      <div
        style={{
          marginTop: '1rem',
          flex: 1,
          overflowY: 'auto',
          display: waitlistEntries.length === 0 ? 'flex' : 'block',
          alignItems: waitlistEntries.length === 0 ? 'center' : undefined,
          justifyContent: waitlistEntries.length === 0 ? 'center' : undefined,
        }}
      >
        {waitlistEntries.length === 0 ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontWeight: 800, fontSize: '1.05rem' }}>
              No active waitlist entries
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(
              [
                ['OFFERED', offered],
                ['ACTIVE', active],
              ] as const
            ).map(([status, entries]) => {
              if (entries.length === 0) return null;

              return (
                <section key={status}>
                  <h3
                    style={{
                      margin: 0,
                      marginBottom: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: status === 'OFFERED' ? '#f59e0b' : '#94a3b8',
                    }}
                  >
                    {status === 'OFFERED' ? '⚠️ Offered' : '⏳ Active'} ({entries.length})
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {entries.map((entry) => {
                      const customerLabel = entry.customerName || entry.displayIdentifier;
                      const eligible = isEntryOfferEligible(
                        entry.id,
                        entry.status,
                        entry.desiredTier
                      );
                      const canOpenCustomer = Boolean(entry.customerId && onOpenCustomerAccount);

                      return (
                        <div
                          key={entry.id}
                          className="er-surface"
                          style={{
                            padding: '1rem',
                            borderRadius: 8,
                            border: '1px solid rgba(148, 163, 184, 0.18)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'start',
                              gap: '0.75rem',
                              marginBottom: '0.75rem',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  marginBottom: '0.25rem',
                                  display: 'flex',
                                  gap: '0.5rem',
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={!canOpenCustomer}
                                  onClick={() => {
                                    if (!entry.customerId) return;
                                    onOpenCustomerAccount?.(entry.customerId, customerLabel);
                                  }}
                                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                                  style={{
                                    padding: '0.3rem 0.6rem',
                                    minHeight: 'unset',
                                    fontSize: '0.85rem',
                                    fontWeight: 800,
                                    opacity: canOpenCustomer ? 1 : 0.6,
                                  }}
                                  title={
                                    canOpenCustomer
                                      ? 'Open Customer Account'
                                      : 'Customer id not available'
                                  }
                                >
                                  {customerLabel}
                                </button>
                                <span aria-hidden="true" style={{ color: '#94a3b8' }}>
                                  →
                                </span>
                                <span>{entry.desiredTier}</span>
                              </div>
                              <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                Assigned: {entry.displayIdentifier} • Backup: {entry.backupTier} •
                                Current: {entry.currentRentalType} • Check-in:{' '}
                                {entry.checkinAt
                                  ? new Date(entry.checkinAt).toLocaleTimeString()
                                  : '—'}{' '}
                                • Checkout:{' '}
                                {entry.checkoutAt
                                  ? new Date(entry.checkoutAt).toLocaleTimeString()
                                  : '—'}
                              </div>
                            </div>
                          </div>

                          {status === 'ACTIVE' ? (
                            <button
                              onClick={() => onOffer(entry.id, entry.desiredTier, customerLabel)}
                              className={[
                                'rounded-lg px-4 py-2 text-sm font-bold transition',
                                eligible
                                  ? 'bg-success-500 text-white hover:bg-success-600'
                                  : 'border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300',
                              ].join(' ')}
                              disabled={!eligible || isSubmitting}
                              style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 700,
                              }}
                            >
                              Offer Upgrade
                            </button>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => onStartPayment(entry)}
                                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
                                disabled={!eligible || isSubmitting}
                                style={{
                                  padding: '0.5rem 0.9rem',
                                  fontSize: '0.875rem',
                                  fontWeight: 700,
                                }}
                              >
                                Start Payment
                              </button>
                              <button
                                onClick={() => onCancelOffer(entry.id)}
                                className="rounded-lg border border-error-300 bg-error-50 px-4 py-2 text-sm font-bold text-error-600 transition hover:bg-error-100 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20"
                                disabled={isSubmitting}
                                style={{
                                  padding: '0.5rem 0.9rem',
                                  fontSize: '0.875rem',
                                  fontWeight: 700,
                                }}
                              >
                                Cancel Offer
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
