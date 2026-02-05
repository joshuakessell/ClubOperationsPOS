import { InventorySection, LockerSection } from './InventorySections';
import type { DetailedLocker, DetailedRoom } from './types';

type InventoryTier = 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL';

type SelectedItem = {
  type: 'room' | 'locker';
  id: string;
  number: string;
  tier: string;
} | null;

type WaitlistEntry = { desiredTier: string; status: string };

type Props = {
  activeSection: InventoryTier;
  roomsByTier: {
    STANDARD: DetailedRoom[];
    DOUBLE: DetailedRoom[];
    SPECIAL: DetailedRoom[];
  };
  lockers: DetailedLocker[];
  onSelectRoom: (room: DetailedRoom) => void;
  onSelectLocker: (locker: DetailedLocker) => void;
  selectedItem: SelectedItem;
  waitlistEntries: WaitlistEntry[];
  nowMs: number;
  disableSelection: boolean;
  occupancyLookupMode: boolean;
  searchHighlight: { type: 'room' | 'locker'; id: string } | null;
  onOpenCustomerAccount?: (customerId: string, customerLabel?: string) => void;
};

export function InventoryListPane({
  activeSection,
  roomsByTier,
  lockers,
  onSelectRoom,
  onSelectLocker,
  selectedItem,
  waitlistEntries,
  nowMs,
  disableSelection,
  occupancyLookupMode,
  searchHighlight,
  onOpenCustomerAccount,
}: Props) {
  const selectionLockedToType: 'room' | 'locker' | null = selectedItem?.type ?? null;

  return (
    <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        className="cs-liquid-card"
        style={{
          padding: '0.85rem',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: '0.65rem',
        }}
      >
        {activeSection === 'LOCKER' ? (
          <LockerSection
            lockers={lockers}
            onSelectLocker={onSelectLocker}
            selectedItem={selectedItem}
            nowMs={nowMs}
            disableSelection={disableSelection || selectionLockedToType === 'room'}
            occupancyLookupMode={occupancyLookupMode}
            highlightId={searchHighlight?.type === 'locker' ? searchHighlight.id : null}
            onOpenCustomerAccount={onOpenCustomerAccount}
          />
        ) : (
          <InventorySection
            title={
              activeSection === 'STANDARD'
                ? 'Standard Rooms'
                : activeSection === 'DOUBLE'
                  ? 'Double Rooms'
                  : 'Special Rooms'
            }
            rooms={
              activeSection === 'STANDARD'
                ? roomsByTier.STANDARD
                : activeSection === 'DOUBLE'
                  ? roomsByTier.DOUBLE
                  : roomsByTier.SPECIAL
            }
            onSelectRoom={onSelectRoom}
            selectedItem={selectedItem}
            waitlistEntries={waitlistEntries}
            nowMs={nowMs}
            disableSelection={disableSelection || selectionLockedToType === 'locker'}
            occupancyLookupMode={occupancyLookupMode}
            highlightId={searchHighlight?.type === 'room' ? searchHighlight.id : null}
            onOpenCustomerAccount={onOpenCustomerAccount}
          />
        )}
      </div>
    </div>
  );
}
