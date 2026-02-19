import { useMemo, useState } from 'react';
import { getErrorMessage } from '@club-ops/shared';
import { API_BASE } from '../../app/state/shared/api';
import { InventoryDrawer } from '../../components/inventory/InventoryDrawer';
import { SlideOutDrawer } from '../../components/drawers/SlideOutDrawer';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';

type AssignableTier = 'STANDARD' | 'DOUBLE' | 'SPECIAL' | 'LOCKER';

function isAssignableTier(value: string | null | undefined): value is AssignableTier {
  return value === 'STANDARD' || value === 'DOUBLE' || value === 'SPECIAL' || value === 'LOCKER';
}

function tierToInventorySection(tier: AssignableTier) {
  if (tier === 'LOCKER') return 'LOCKER' as const;
  if (tier === 'STANDARD') return 'STANDARD' as const;
  if (tier === 'DOUBLE') return 'DOUBLE' as const;
  return 'SPECIAL' as const;
}

export function AssignRoomPeek() {
  const {
    lane,
    session,
    currentSessionId,
    customerSelectedType,
    selectedInventoryItem,
    setSelectedInventoryItem,
    inventoryForcedSection,
    setInventoryForcedSection,
    waitlistDesiredTier,
    waitlistBackupType,
    setInventoryHasLate,
    openCustomerAccount,
    inventoryRefreshNonce,
    pushBottomToast,
  } = useEmployeeRegisterState();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const desiredTier: AssignableTier | null = useMemo(() => {
    if (isAssignableTier(customerSelectedType)) return customerSelectedType;
    return null;
  }, [customerSelectedType]);

  const expectedType = desiredTier === 'LOCKER' ? 'locker' : 'room';

  const canAssign = Boolean(
    lane &&
    session?.sessionToken &&
    currentSessionId &&
    desiredTier &&
    selectedInventoryItem &&
    selectedInventoryItem.type === expectedType &&
    selectedInventoryItem.tier === desiredTier
  );

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
      style={{ padding: '0.9rem' }}
    >
      <div style={{ fontWeight: 950, fontSize: '1.05rem' }}>
        Assign specific {desiredTier === 'LOCKER' ? 'locker' : 'room'}
      </div>
      <div
        className="er-text-sm"
        style={{ color: '#94a3b8', fontWeight: 800, marginTop: '0.35rem' }}
      >
        While the customer signs the agreement, you can pre-select an available{' '}
        {desiredTier?.toLowerCase() ?? 'room'}.
      </div>

      <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.85rem' }}>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          onClick={() => {
            if (!desiredTier) {
              pushBottomToast({ message: 'Select a rental type first.', tone: 'warning' });
              return;
            }
            setInventoryForcedSection(tierToInventorySection(desiredTier));
            setDrawerOpen(true);
          }}
          disabled={!session?.sessionToken || !currentSessionId || !desiredTier}
          style={{ width: '100%', padding: '0.8rem', fontWeight: 950 }}
        >
          Peek availability
        </button>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
          onClick={() => void handleAssignSelected()}
          disabled={!canAssign || assigning}
          style={{ width: '100%', padding: '0.85rem', fontWeight: 950 }}
        >
          {assigning
            ? 'Assigning…'
            : selectedInventoryItem
              ? `Assign ${selectedInventoryItem.type === 'room' ? 'Room' : 'Locker'} ${selectedInventoryItem.number}`
              : 'Assign selected'}
        </button>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          onClick={() => setSelectedInventoryItem(null)}
          disabled={!selectedInventoryItem || assigning}
          style={{ width: '100%', padding: '0.8rem', fontWeight: 950 }}
        >
          Clear selection
        </button>
      </div>

      {session?.sessionToken ? (
        <SlideOutDrawer
          side="right"
          label={expectedType === 'locker' ? 'Lockers' : 'Rooms'}
          isOpen={drawerOpen}
          onOpenChange={setDrawerOpen}
          tabTopPercent={40}
          tabVariant="secondary"
          widthPx={620}
          zIndex={2600}
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
              onSelect={(type, id, number, tier) => {
                if (!desiredTier) return;
                if (type !== expectedType) {
                  pushBottomToast({
                    message: `Select an available ${expectedType} to assign.`,
                    tone: 'warning',
                  });
                  return;
                }
                if (tier !== desiredTier) {
                  pushBottomToast({
                    message: `Select an available ${desiredTier.toLowerCase()} ${expectedType}.`,
                    tone: 'warning',
                  });
                  return;
                }
                setSelectedInventoryItem({ type, id, number, tier });
              }}
              onClearSelection={() => setSelectedInventoryItem(null)}
              selectedItem={selectedInventoryItem}
              sessionId={currentSessionId}
              disableSelection={false}
              onAlertSummaryChange={({ hasLate }) => setInventoryHasLate(hasLate)}
              onOpenCustomerAccount={openCustomerAccount}
              externalRefreshNonce={inventoryRefreshNonce}
            />
          </div>
        </SlideOutDrawer>
      ) : null}
    </div>
  );

  async function handleAssignSelected() {
    if (!lane || !session?.sessionToken || !currentSessionId) return;
    if (!selectedInventoryItem) return;

    const resourceType = selectedInventoryItem.type;
    const resourceId = selectedInventoryItem.id;

    setAssigning(true);
    try {
      const response = await fetch(`${API_BASE}/v1/checkin/lane/${lane}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({ resourceType, resourceId }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(getErrorMessage(errorPayload) || 'Failed to assign resource');
      }

      await response.json().catch(() => null);
      pushBottomToast({
        message: `Assigned ${resourceType === 'room' ? 'room' : 'locker'} ${selectedInventoryItem.number}.`,
        tone: 'info',
      });
      setDrawerOpen(false);
    } catch (error) {
      pushBottomToast({
        message: error instanceof Error ? error.message : 'Failed to assign resource',
        tone: 'warning',
      });
    } finally {
      setAssigning(false);
    }
  }
}
