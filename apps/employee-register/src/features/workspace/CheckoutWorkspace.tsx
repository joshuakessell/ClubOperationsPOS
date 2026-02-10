import { useMemo, useState } from 'react';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { InventorySummaryBar } from '../../components/inventory/InventorySummaryBar';
import { InventoryDrawer } from '../../components/inventory/InventoryDrawer';
import { SlideOutDrawer } from '../../components/drawers/SlideOutDrawer';
import { PanelCard } from '../../views/PanelCard';
import { PanelHeader } from '../../views/PanelHeader';
import './CheckoutWorkspace.css';

export type CheckoutWorkspaceProps = {
  checkoutPanel: React.ReactNode;
};

export function CheckoutWorkspace({ checkoutPanel }: CheckoutWorkspaceProps) {
  const {
    lane,
    session,
    currentSessionId,
    inventoryAvailable,
    customerSelectedType,
    waitlistDesiredTier,
    waitlistBackupType,
    handleInventorySelect,
    setSelectedInventoryItem,
    selectedInventoryItem,
    inventoryForcedSection,
    setInventoryForcedSection,
    setInventoryHasLate,
    startCheckoutFromInventory,
    openCustomerAccount,
    inventoryRefreshNonce,
  } = useEmployeeRegisterState();

  const [inventoryOpen, setInventoryOpen] = useState(false);

  const summaryCounts = useMemo(() => {
    if (!inventoryAvailable) return null;
    return {
      rooms: inventoryAvailable.rooms,
      rawRooms: inventoryAvailable.rawRooms,
      lockers: inventoryAvailable.lockers,
    };
  }, [inventoryAvailable]);

  return (
    <div className="er-checkout-workspace">
      <div className="er-checkout-workspace__primary">{checkoutPanel}</div>

      <aside className="er-checkout-workspace__sidebar" aria-label="Operations sidebar">
        <PanelCard>
          <PanelHeader
            title="Now"
            spacing="sm"
            subtitle={
              <span className="er-text-sm" style={{ color: 'rgba(148, 163, 184, 0.92)' }}>
                Keep checkout open while reviewing availability.
              </span>
            }
          />

          <div className="er-checkout-workspace__snapshot">
            <div className="er-checkout-workspace__row">
              <div className="er-checkout-workspace__label">Lane</div>
              <div className="er-checkout-workspace__value">{lane || '—'}</div>
            </div>
            <div className="er-checkout-workspace__row">
              <div className="er-checkout-workspace__label">Session</div>
              <div className="er-checkout-workspace__value">
                {currentSessionId ? currentSessionId : 'None'}
              </div>
            </div>
          </div>
        </PanelCard>

        <div className="er-checkout-workspace__inventory">
          <div className="er-checkout-workspace__section-label">Availability</div>
          <InventorySummaryBar
            counts={summaryCounts}
            onOpenInventorySection={(section) => {
              setInventoryForcedSection(section);
              setInventoryOpen(true);
            }}
          />

          <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.6rem' }}>
            <button
              type="button"
              className="cs-liquid-button cs-liquid-button--secondary"
              onClick={() => setInventoryOpen(true)}
              disabled={!session?.sessionToken}
              style={{ width: '100%', padding: '0.75rem', fontWeight: 900 }}
            >
              Open Rentals (peek)
            </button>
            <button
              type="button"
              className="cs-liquid-button cs-liquid-button--secondary"
              onClick={() => setInventoryForcedSection(null)}
              disabled={!session?.sessionToken}
              style={{ width: '100%', padding: '0.75rem', fontWeight: 900 }}
            >
              Clear section focus
            </button>
          </div>
        </div>
      </aside>

      {session?.sessionToken ? (
        <SlideOutDrawer
          side="right"
          label="Rentals"
          isOpen={inventoryOpen}
          onOpenChange={setInventoryOpen}
          tabTopPercent={42}
          tabVariant="secondary"
          widthPx={560}
        >
          <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
            <InventoryDrawer
              lane={lane}
              sessionToken={session.sessionToken}
              forcedExpandedSection={inventoryForcedSection}
              onExpandedSectionChange={setInventoryForcedSection}
              customerSelectedType={customerSelectedType}
              waitlistDesiredTier={waitlistDesiredTier}
              waitlistBackupType={waitlistBackupType}
              onSelect={handleInventorySelect}
              onClearSelection={() => setSelectedInventoryItem(null)}
              selectedItem={selectedInventoryItem}
              sessionId={currentSessionId}
              disableSelection={false}
              onAlertSummaryChange={({ hasLate }) => setInventoryHasLate(hasLate)}
              onRequestCheckout={startCheckoutFromInventory}
              onOpenCustomerAccount={openCustomerAccount}
              externalRefreshNonce={inventoryRefreshNonce}
            />
          </div>
        </SlideOutDrawer>
      ) : null}
    </div>
  );
}

