import { Badge } from '@club-ops/ui/tailadmin';
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
import { SignInPanel } from '../../components/sign-in/SignInPanel';
import { useRegisterSignInContext } from '../../RegisterSignIn';
import type { NavTab } from '../../app/state/shared/types';
import { RegisterShell, type ShellNavKey, type ShellNavItem } from '../shell/RegisterShell';
import { CheckoutWorkspace } from '../workspace/CheckoutWorkspace';

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
    inventoryHasLate,
    hasEligibleEntries,
    canOpenAccountTab,
    registerSession,
  } = useEmployeeRegisterState();

  const isAuthenticated = !!registerSession;

  const signInContext = useRegisterSignInContext();

  // Pick active key: when not authenticated, always show signIn
  const active: ShellNavKey = !isAuthenticated
    ? 'signIn'
    : navTabToShellKey(navTab);

  const laneLabel = lane && lane.trim() ? lane.trim().replace(/^lane[-\s]*/i, 'Lane ') : 'Lane 1';

  /* ── Build nav items ── */
  const operationalItems: ShellNavItem[] = [
    { key: 'scan', label: 'Scan', icon: <span aria-hidden="true">📷</span>, shortcut: 'F1' },
    {
      key: 'search',
      label: 'Search Customer',
      icon: <span aria-hidden="true">🔎</span>,
      shortcut: 'F2',
    },
    {
      key: 'inventory',
      label: 'Rentals',
      icon: <span aria-hidden="true">📦</span>,
      badge: inventoryHasLate ? (
        <Badge color="error" variant="light" size="sm">
          Late
        </Badge>
      ) : undefined,
      shortcut: 'F3',
    },
    {
      key: 'upgrades',
      label: 'Upgrades',
      icon: <span aria-hidden="true">✨</span>,
      badge: hasEligibleEntries ? (
        <Badge color="success" variant="light" size="sm">
          Ready
        </Badge>
      ) : undefined,
      shortcut: 'F4',
    },
    { key: 'retail', label: 'Retail', icon: <span aria-hidden="true">🛒</span>, shortcut: 'F5' },
    { key: 'checkout', label: 'Checkout', icon: <span aria-hidden="true">✅</span>, shortcut: 'F6' },
    {
      key: 'account',
      label: 'Customer Account',
      icon: <span aria-hidden="true">👤</span>,
      disabled: !canOpenAccountTab,
      shortcut: 'F7',
    },
    { key: 'clubLog', label: 'Club Log', icon: <span aria-hidden="true">📜</span>, shortcut: 'F8' },
    { key: 'manual', label: 'Manual Entry', icon: <span aria-hidden="true">📝</span>, shortcut: 'F9' },
    { key: 'roomCleaning', label: 'Room Cleaning', icon: <span aria-hidden="true">🧹</span>, shortcut: 'F10' },
  ];

  // When not authenticated, show only Sign In tab (hide operational items so tests
  // properly wait for auth before interacting with them)
  const items: ShellNavItem[] = !isAuthenticated
    ? [
        { key: 'signIn', label: 'Sign In', icon: <span aria-hidden="true">🔐</span> },
      ]
    : operationalItems;

  return (
    <>
      {isAuthenticated && checkoutRequests.size > 0 && !selectedCheckoutRequest && (
        <CheckoutRequestsBanner
          requests={Array.from(checkoutRequests.values())}
          onClaim={(id) => void handleClaimCheckout(id)}
          onOpenCustomerAccount={(customerId, label) => openCustomerAccount(customerId, label)}
        />
      )}

      {isAuthenticated && selectedCheckoutRequest && checkoutRequests.get(selectedCheckoutRequest) ? (
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
            title={laneLabel}
            statusPill={
              isAuthenticated ? (
                <Badge color={realtimeConnected ? 'success' : 'error'} variant="light" size="sm">
                  {realtimeConnected ? 'Live' : 'Offline'}
                </Badge>
              ) : undefined
            }
            items={items}
          >
            <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
              {/* Sign-in panel when not authenticated */}
              {!isAuthenticated && signInContext && (
                <SignInPanel
                  deviceId={signInContext.deviceId}
                  onSignedIn={signInContext.onSignedIn}
                />
              )}

              {/* Operational panels (only rendered when authenticated) */}
              {isAuthenticated && navTab === 'scan' && <ScanPanel />}
              {isAuthenticated && navTab === 'account' && <AccountPanel />}
              {isAuthenticated && navTab === 'search' && <SearchPanel />}
              {isAuthenticated && navTab === 'inventory' && <InventoryPanel />}
              {isAuthenticated && navTab === 'upgrades' && <UpgradesPanel />}
              {isAuthenticated && navTab === 'checkout' && <CheckoutWorkspace checkoutPanel={<CheckoutPanel />} />}
              {isAuthenticated && navTab === 'clubLog' && <ClubLogPanel />}
              {isAuthenticated && navTab === 'roomCleaning' && <RoomCleaningPanel />}
              {isAuthenticated && navTab === 'firstTime' && <ManualEntryPanel />}
              {isAuthenticated && navTab === 'retail' && <RetailPanel />}
            </div>
          </RegisterShell>
        </section>
      </main>
    </>
  );

  function selectShellNav(key: ShellNavKey) {
    // Sign-in tab — no-op (it's always active when not authenticated)
    if (key === 'signIn') {
      return;
    }

    // Don't allow navigating to operational tabs when not authenticated
    if (!isAuthenticated) return;

    if (key === 'manual') {
      selectNavTab('firstTime');
      return;
    }

    if (key === 'checkout') {
      startCheckout();
      return;
    }

    if (key === 'account') {
      if (canOpenAccountTab) {
        selectNavTab('account');
      }
      return;
    }

    selectNavTab(key);
  }
}

function navTabToShellKey(tab: NavTab): ShellNavKey {
  return tab === 'firstTime' ? 'manual' : (tab as ShellNavKey);
}
