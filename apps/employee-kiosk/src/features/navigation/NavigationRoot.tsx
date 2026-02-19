import { useEffect } from 'react';
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
import { ClubLogPanel } from './ClubLogPanel';
import type { NavTab } from '../../app/state/shared/types';
import { CheckoutWorkspace } from '../workspace/CheckoutWorkspace';
import { useAuthGate } from '../../context/AuthGateContext';
import SignInPage from '../../pages/SignInPage';
import AppLayout from '../../layout/AppLayout';

export function NavigationRoot() {
  const {
    navTab,
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
    selectNavTab,
    startCheckout,
    lane,
    realtimeConnected,
    canOpenAccountTab,
    registerSession,
    health,
    realtimeMode,
    handleLogout,
    handleCloseOut,
  } = useEmployeeRegisterState();

  const isAuthenticated = !!registerSession;

  const { setAuthenticated, registerSelectNavTab, setSessionInfo } = useAuthGate();

  // Sync auth state and nav callbacks to the app-level AuthGateContext
  useEffect(() => {
    setAuthenticated(isAuthenticated);
  }, [isAuthenticated, setAuthenticated]);

  useEffect(() => {
    registerSelectNavTab(selectNavTab);
  }, [selectNavTab, registerSelectNavTab]);

  // Sync session display info to AuthGateContext for the kiosk header
  useEffect(() => {
    if (isAuthenticated && registerSession) {
      const laneLabel = lane && lane.trim() ? lane.trim().replace(/^lane[-\s]*/i, 'Lane ') : 'Lane 1';
      setSessionInfo({
        employeeName: registerSession.employeeName,
        registerNumber: registerSession.registerNumber,
        lane: laneLabel,
        apiStatus: health?.status ?? null,
        realtimeConnected,
        realtimeMode: realtimeMode ?? 'cloud',
        onSignOut: () => void handleLogout(),
        onCloseOut: () => void handleCloseOut(),
      });
    } else {
      setSessionInfo(null);
    }
  }, [
    isAuthenticated,
    registerSession,
    lane,
    health?.status,
    realtimeConnected,
    realtimeMode,
    handleLogout,
    handleCloseOut,
    setSessionInfo,
  ]);

  /* ── Unauthenticated: full-screen sign-in page ── */
  if (!isAuthenticated) {
    return <SignInPage />;
  }


  /* ── Helper to map sidebar clicks to nav tabs ── */
  function handleNav(tab: NavTab) {
    if (tab === 'firstTime') {
      selectNavTab('firstTime');
      return;
    }

    if (tab === 'checkout') {
      startCheckout();
      return;
    }

    if (tab === 'account') {
      if (canOpenAccountTab) {
        selectNavTab('account');
      }
      return;
    }

    selectNavTab(tab);
  }

  return (
    <AppLayout activeTab={navTab} onNavigate={handleNav}>
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

      {/* Content panels */}
      <div className="h-full min-h-0 overflow-auto p-4 sm:p-6">
        {navTab === 'scan' && <ScanPanel />}
        {navTab === 'account' && <AccountPanel />}
        {navTab === 'search' && <SearchPanel />}
        {navTab === 'inventory' && <InventoryPanel />}
        {navTab === 'upgrades' && <UpgradesPanel />}
        {navTab === 'checkout' && <CheckoutWorkspace checkoutPanel={<CheckoutPanel />} />}
        {navTab === 'clubLog' && <ClubLogPanel />}
        {navTab === 'roomCleaning' && <RoomCleaningPanel />}
        {navTab === 'firstTime' && <ManualEntryPanel />}
        {navTab === 'retail' && <RetailPanel />}
      </div>
    </AppLayout>
  );
}
