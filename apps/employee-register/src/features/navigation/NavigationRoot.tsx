import { CheckoutRequestsBanner } from '../../components/register/CheckoutRequestsBanner';
import { CheckoutVerificationModal } from '../../components/register/CheckoutVerificationModal';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { ScanPanel } from './ScanPanel';
import { AccountPanel } from './AccountPanel';
import { SearchPanel } from './SearchPanel';
import { InventoryPanel } from './InventoryPanel';
import { UpgradesPanel } from './UpgradesPanel';
import { CheckoutPanel } from './CheckoutPanel';
import { RoomCleaningPanel } from './RoomCleaningPanel';
import { ManualEntryPanel } from './ManualEntryPanel';
import { RetailPanel } from './RetailPanel';
import type { HomeTab } from '../../app/state/shared/types';
import { RegisterShell, type ShellNavKey, type ShellNavItem } from '../shell/RegisterShell';
import { HomeScreen } from '../home/HomeScreen';
import { CheckoutWorkspace } from '../workspace/CheckoutWorkspace';

export function NavigationRoot() {
  const {
    homeTab,
    checkoutRequests,
    selectedCheckoutRequest,
    checkoutItemsConfirmed,
    checkoutFeePaid,
    isSubmitting,
    handleClaimCheckout,
    openCustomerAccount,
    handleConfirmItems,
    handleMarkFeePaid,
    handleCompleteCheckout,
    setSelectedCheckoutRequest,
    setCheckoutChecklist,
    setCheckoutItemsConfirmed,
    setCheckoutFeePaid,
    selectHomeTab,
    startCheckoutFromHome,
    lane,
    realtimeConnected,
    currentSessionId,
    inventoryHasLate,
    hasEligibleEntries,
    canOpenAccountTab,
  } = useEmployeeRegisterState();

  const active = homeTabToShellKey(homeTab);

  const items: ShellNavItem[] = [
    { key: 'home', label: 'Home', icon: <span aria-hidden="true">🏠</span> },
    { key: 'scan', label: 'Scan', icon: <span aria-hidden="true">📷</span> },
    {
      key: 'search',
      label: 'Search Customer',
      icon: <span aria-hidden="true">🔎</span>,
    },
    {
      key: 'inventory',
      label: 'Rentals',
      icon: <span aria-hidden="true">📦</span>,
      badge: inventoryHasLate ? (
        <span className="cs-badge cs-badge--error">Late</span>
      ) : undefined,
    },
    {
      key: 'upgrades',
      label: 'Upgrades',
      icon: <span aria-hidden="true">✨</span>,
      badge: hasEligibleEntries ? (
        <span className="cs-badge cs-badge--success">Ready</span>
      ) : undefined,
    },
    { key: 'retail', label: 'Retail', icon: <span aria-hidden="true">🛒</span> },
    { key: 'checkout', label: 'Checkout', icon: <span aria-hidden="true">✅</span> },
    {
      key: 'account',
      label: 'Customer Account',
      icon: <span aria-hidden="true">👤</span>,
      disabled: !canOpenAccountTab,
    },
    { key: 'manual', label: 'Manual Entry', icon: <span aria-hidden="true">📝</span> },
    { key: 'roomCleaning', label: 'Room Cleaning', icon: <span aria-hidden="true">🧹</span> },
  ];

  return (
    <>
      {checkoutRequests.size > 0 && !selectedCheckoutRequest && (
        <CheckoutRequestsBanner
          requests={Array.from(checkoutRequests.values())}
          onClaim={(id) => void handleClaimCheckout(id)}
          onOpenCustomerAccount={(customerId, label) => openCustomerAccount(customerId, label)}
        />
      )}

      {selectedCheckoutRequest && checkoutRequests.get(selectedCheckoutRequest) ? (
        <CheckoutVerificationModal
          request={checkoutRequests.get(selectedCheckoutRequest)!}
          isSubmitting={isSubmitting}
          checkoutItemsConfirmed={checkoutItemsConfirmed}
          checkoutFeePaid={checkoutFeePaid}
          onOpenCustomerAccount={(customerId, label) => openCustomerAccount(customerId, label)}
          onConfirmItems={() => void handleConfirmItems(selectedCheckoutRequest)}
          onMarkFeePaid={() => void handleMarkFeePaid(selectedCheckoutRequest)}
          onComplete={() => void handleCompleteCheckout(selectedCheckoutRequest)}
          onCancel={() => {
            setSelectedCheckoutRequest(null);
            setCheckoutChecklist({});
            setCheckoutItemsConfirmed(false);
            setCheckoutFeePaid(false);
          }}
        />
      ) : null}

      <main className="main" style={{ padding: 0 }}>
        <section className="actions-panel">
          <RegisterShell
            active={active}
            onNavigate={(key) => selectShellNav(key)}
            title="Employee Register"
            subtitle={lane}
            statusPill={
              <span
                className={`cs-badge ${realtimeConnected ? 'cs-badge--success' : 'cs-badge--error'}`}
              >
                {realtimeConnected ? 'Live' : 'Offline'}
              </span>
            }
            items={items}
          >
            <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
              {active === 'home' ? (
                <HomeScreen
                  onStartScan={() => selectHomeTab('scan')}
                  onStartSearch={() => selectHomeTab('search')}
                  onStartManualEntry={() => selectHomeTab('firstTime')}
                  onOpenInventory={() => selectHomeTab('inventory')}
                  onOpenUpgrades={() => selectHomeTab('upgrades')}
                  onOpenCheckout={() => startCheckoutFromHome()}
                  onOpenRoomCleaning={() => selectHomeTab('roomCleaning')}
                  onOpenRetail={() => selectHomeTab('retail')}
                  health={{
                    realtimeConnected,
                  }}
                  laneStatus={{
                    activeLaneLabel: lane,
                    activeSessionId: currentSessionId ?? undefined,
                  }}
                />
              ) : null}

              {homeTab === 'scan' && <ScanPanel />}
              {homeTab === 'account' && <AccountPanel />}
              {homeTab === 'search' && <SearchPanel />}
              {homeTab === 'inventory' && <InventoryPanel />}
              {homeTab === 'upgrades' && <UpgradesPanel />}
              {homeTab === 'checkout' && (
                <CheckoutWorkspace checkoutPanel={<CheckoutPanel />} />
              )}
              {homeTab === 'roomCleaning' && <RoomCleaningPanel />}
              {homeTab === 'firstTime' && <ManualEntryPanel />}
              {homeTab === 'retail' && <RetailPanel />}
            </div>
          </RegisterShell>
        </section>
      </main>
    </>
  );

  function selectShellNav(key: ShellNavKey) {
    if (key === 'home') {
      selectHomeTab('home');
      return;
    }

    if (key === 'manual') {
      selectHomeTab('firstTime');
      return;
    }

    if (key === 'checkout') {
      startCheckoutFromHome();
      return;
    }

    if (key === 'account') {
      if (canOpenAccountTab) {
        selectHomeTab('account');
      }
      return;
    }

    selectHomeTab(key);
  }
}

function homeTabToShellKey(tab: HomeTab): ShellNavKey {
  return tab === 'firstTime' ? 'manual' : (tab as ShellNavKey);
}
