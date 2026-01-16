import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';

export type UpgradeWaitlistStatus = 'ACTIVE' | 'OFFERED' | string;

export type UpgradeWaitlistEntry = {
  id: string;
  visitId: string;
  checkinBlockId: string;
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
  isEntryOfferEligible(entryId: string, status: string, desiredTier: string): boolean;
  onOffer(entryId: string, desiredTier: string, customerLabel: string): void;
  onStartPayment(entry: UpgradeWaitlistEntry): void;
  onCancelOffer(entryId: string): void;
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
  isSubmitting = false,
  headerRightSlot,
}: UpgradesDrawerContentProps) {
  const active = waitlistEntries.filter((e) => e.status === 'ACTIVE');
  const offered = waitlistEntries.filter((e) => e.status === 'OFFERED');

  return (
    <div
      className="er-surface"
      style={{ padding: '1rem', borderRadius: 8, height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '0.35rem', fontSize: '1.25rem', fontWeight: 800 }}>
            Upgrade Waitlist
          </h2>
        </div>
        {headerRightSlot}
      </div>

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
            {([
              ['OFFERED', offered],
              ['ACTIVE', active],
            ] as const).map(([status, entries]) => {
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
                      const eligible = isEntryOfferEligible(entry.id, entry.status, entry.desiredTier);

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
                              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                                {customerLabel} → {entry.desiredTier}
                              </div>
                              <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                Assigned: {entry.displayIdentifier} • Backup: {entry.backupTier} • Current:{' '}
                                {entry.currentRentalType} • Check-in:{' '}
                                {entry.checkinAt ? new Date(entry.checkinAt).toLocaleTimeString() : '—'} • Checkout:{' '}
                                {entry.checkoutAt ? new Date(entry.checkoutAt).toLocaleTimeString() : '—'}
                              </div>
                            </div>
                          </div>

                          {status === 'ACTIVE' ? (
                            <Button
                              onClick={() => onOffer(entry.id, entry.desiredTier, customerLabel)}
                              variant={eligible ? 'primary' : 'secondary'}
                              disabled={!eligible || isSubmitting}
                              className={eligible ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40' : ''}
                            >
                              Offer Upgrade
                            </Button>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <Button
                                onClick={() => onStartPayment(entry)}
                                disabled={!eligible || isSubmitting}
                              >
                                Start Payment
                              </Button>
                              <Button
                                onClick={() => onCancelOffer(entry.id)}
                                variant="danger"
                                disabled={isSubmitting}
                              >
                                Cancel Offer
                              </Button>
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


