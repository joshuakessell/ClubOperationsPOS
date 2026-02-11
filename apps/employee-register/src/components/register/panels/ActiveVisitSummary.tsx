import { useMemo } from 'react';
import { RequiredTenderOutcomeModal } from '../modals/RequiredTenderOutcomeModal';
import { ModalFrame } from '../modals/ModalFrame';
import { formatLocal, getRenewalEligibility } from '../renewalEligibility';
import { useSwitchResourceFlow } from './active-visit/useSwitchResourceFlow';
import type { ActiveVisitSummaryProps } from './active-visit/types';

export function ActiveVisitSummary(props: ActiveVisitSummaryProps) {
  const { activeCheckin } = props;

  const renewalEligibility = useMemo(
    () => getRenewalEligibility(activeCheckin),
    [activeCheckin]
  );
  const canRenew = renewalEligibility.allowTwoHour || renewalEligibility.allowSixHour;

  const switchFlow = useSwitchResourceFlow({
    activeCheckin,
    sessionToken: props.sessionToken,
    onRefetch: props.onRefetch,
  });

  return (
    <>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div>
          <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
            Assigned
          </div>
          <div style={{ fontWeight: 900 }}>
            {activeCheckin.assignedResourceType && activeCheckin.assignedResourceNumber
              ? `${activeCheckin.assignedResourceType === 'room' ? 'Room' : 'Locker'} ${
                  activeCheckin.assignedResourceNumber
                }`
              : '—'}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
                Check-in
              </div>
              <div style={{ fontWeight: 800 }}>{formatLocal(activeCheckin.checkinAt)}</div>
            </div>
            <div>
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
                Checkout
              </div>
              <div style={{ fontWeight: 800 }}>
                {formatLocal(activeCheckin.checkoutAt)}{' '}
                {activeCheckin.overdue ? <span style={{ color: '#f59e0b' }}>(overdue)</span> : null}
              </div>
            </div>
          </div>

          <div
            className="er-account-actions"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              minWidth: 220,
              gap: '0.5rem',
            }}
          >
            <button
              type="button"
              className="cs-liquid-button"
              onClick={() =>
                props.onStartCheckout({
                  number: activeCheckin.assignedResourceNumber,
                })
              }
              style={{ width: '100%', maxWidth: 260, padding: '0.7rem', fontWeight: 900 }}
            >
              Checkout
            </button>
            {props.onStartRenewal ? (
              <button
                type="button"
                className="cs-liquid-button cs-liquid-button--secondary"
                onClick={() => props.onStartRenewal?.(activeCheckin)}
                disabled={!canRenew}
                style={{ width: '100%', maxWidth: 260, padding: '0.7rem', fontWeight: 900 }}
              >
                Renew Checkin
              </button>
            ) : null}
            <button
              type="button"
              className="cs-liquid-button cs-liquid-button--secondary"
              onClick={switchFlow.openSwitchModal}
              style={{ width: '100%', maxWidth: 260, padding: '0.7rem', fontWeight: 900 }}
            >
              Switch Room/Locker
            </button>
          </div>
        </div>

        {activeCheckin.waitlist ? (
          <div>
            <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
              Pending upgrade request
            </div>
            <div style={{ fontWeight: 900 }}>
              {activeCheckin.waitlist.desiredTier} (backup: {activeCheckin.waitlist.backupTier}) •{' '}
              {activeCheckin.waitlist.status}
            </div>
          </div>
        ) : null}
      </div>

      <ModalFrame
        isOpen={switchFlow.switchModalOpen}
        title="Switch Room / Locker"
        onClose={switchFlow.closeSwitchModal}
        maxWidth="640px"
      >
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <div className="er-text-sm" style={{ color: '#cbd5e1', fontWeight: 700 }}>
            Move this active visit to a different available room/locker. If the new selection costs
            more, payment is required before the switch completes.
          </div>

          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
              Target Type
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`cs-liquid-button ${switchFlow.targetType === 'room' ? '' : 'cs-liquid-button--secondary'}`}
                disabled={switchFlow.submitting || !switchFlow.hasRoomChoices}
                onClick={switchFlow.selectRoomTarget}
                style={{ padding: '0.6rem 0.9rem', fontWeight: 900 }}
              >
                Room
              </button>
              <button
                type="button"
                className={`cs-liquid-button ${switchFlow.targetType === 'locker' ? '' : 'cs-liquid-button--secondary'}`}
                disabled={switchFlow.submitting || !switchFlow.hasLockerChoices}
                onClick={switchFlow.selectLockerTarget}
                style={{ padding: '0.6rem 0.9rem', fontWeight: 900 }}
              >
                Locker
              </button>
            </div>
          </div>

          {activeCheckin.assignedResourceType === 'room' ? (
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
                Previous Room Status
              </span>
              <select
                value={switchFlow.previousRoomStatus}
                onChange={(event) =>
                  switchFlow.setPreviousRoomStatus(
                    event.target.value as 'CLEAN' | 'CLEANING' | 'DIRTY'
                  )
                }
                disabled={switchFlow.submitting}
                style={{ padding: '0.6rem', borderRadius: 8 }}
              >
                <option value="DIRTY">Dirty</option>
                <option value="CLEANING">Cleaning</option>
                <option value="CLEAN">Clean</option>
              </select>
            </label>
          ) : null}

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
              Available {switchFlow.targetType === 'room' ? 'Rooms' : 'Lockers'}
            </span>
            <select
              value={switchFlow.selectedResourceId}
              onChange={(event) => switchFlow.setSelectedResourceId(event.target.value)}
              disabled={switchFlow.submitting || switchFlow.loadingInventory}
              style={{ padding: '0.6rem', borderRadius: 8 }}
            >
              {switchFlow.targetType === 'room' ? (
                <>
                  <optgroup label="Special">
                    {switchFlow.roomOptionsByTier.SPECIAL.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.number}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Double">
                    {switchFlow.roomOptionsByTier.DOUBLE.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.number}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Standard">
                    {switchFlow.roomOptionsByTier.STANDARD.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.number}
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : (
                switchFlow.lockers.map((locker) => (
                  <option key={locker.id} value={locker.id}>
                    Locker {locker.number}
                  </option>
                ))
              )}
            </select>
          </label>

          {switchFlow.loadingInventory ? (
            <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
              Loading available inventory…
            </div>
          ) : null}
          {switchFlow.inventoryError ? (
            <div className="er-text-sm" style={{ color: '#fca5a5', fontWeight: 800 }}>
              {switchFlow.inventoryError}
            </div>
          ) : null}
          {switchFlow.pendingError ? (
            <div className="er-text-sm" style={{ color: '#fca5a5', fontWeight: 800 }}>
              {switchFlow.pendingError}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="cs-liquid-button cs-liquid-button--secondary"
              onClick={switchFlow.closeSwitchModal}
              disabled={switchFlow.submitting}
              style={{ padding: '0.65rem 1rem', fontWeight: 900 }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cs-liquid-button"
              onClick={() => void switchFlow.submitSwitch()}
              disabled={switchFlow.submitting || !switchFlow.selectedResourceId}
              style={{ padding: '0.65rem 1rem', fontWeight: 900 }}
            >
              {switchFlow.submitting
                ? 'Switching…'
                : `Switch to ${switchFlow.targetType === 'room' ? 'Room' : 'Locker'}${
                    switchFlow.selectedNumber ? ` ${switchFlow.selectedNumber}` : ''
                  }`}
            </button>
          </div>
        </div>
      </ModalFrame>

      <RequiredTenderOutcomeModal
        isOpen={switchFlow.pendingAdditionalFee !== null}
        totalAmount={switchFlow.pendingAdditionalFee ?? 0}
        details={
          <div className="er-text-sm" style={{ color: '#cbd5e1', fontWeight: 700 }}>
            This switch has an additional charge. Choose the payment result to continue.
          </div>
        }
        isSubmitting={switchFlow.submitting}
        onClose={() => switchFlow.setPendingAdditionalFee(null)}
        onConfirm={(choice) => {
          const mapped =
            choice === 'CASH_SUCCESS'
              ? 'CASH_SUCCESS'
              : choice === 'CREDIT_SUCCESS'
                ? 'CREDIT_SUCCESS'
                : 'CREDIT_DECLINE';
          void switchFlow.submitSwitch(mapped);
        }}
      />
    </>
  );
}
