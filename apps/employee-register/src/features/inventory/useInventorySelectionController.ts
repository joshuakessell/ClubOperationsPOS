import { useState, type Dispatch, type SetStateAction } from 'react';
import type { InventoryDrawerSection } from './InventoryDrawer';

export type SelectedInventoryItem = {
  type: 'room' | 'locker';
  id: string;
  number: string;
  tier: string;
};

export type InventorySelectionController = {
  // WS integration
  setSelectedInventoryItem: Dispatch<SetStateAction<SelectedInventoryItem | null>>;

  // Selection state
  selectedInventoryItem: SelectedInventoryItem | null;
  onSelect: (type: 'room' | 'locker', id: string, number: string, tier: string) => void;
  clearSelection: () => void;

  // Drawer UI state
  isInventoryDrawerOpen: boolean;
  setIsInventoryDrawerOpen: Dispatch<SetStateAction<boolean>>;
  inventoryForcedSection: InventoryDrawerSection;
  setInventoryForcedSection: Dispatch<SetStateAction<InventoryDrawerSection>>;
  openInventorySection: (section: InventoryDrawerSection) => void;

  // Summary flags
  inventoryHasLate: boolean;
  setInventoryHasLate: Dispatch<SetStateAction<boolean>>;
};

export function useInventorySelectionController(opts: {
  customerSelectedType: string | null;
  onRequireCustomerConfirmation: (payload: { requested: string; selected: string; number: string }) => void;
}): InventorySelectionController {
  const { customerSelectedType, onRequireCustomerConfirmation } = opts;

  const [selectedInventoryItem, setSelectedInventoryItem] = useState<SelectedInventoryItem | null>(
    null
  );
  const [isInventoryDrawerOpen, setIsInventoryDrawerOpen] = useState(false);
  const [inventoryForcedSection, setInventoryForcedSection] = useState<InventoryDrawerSection>(null);
  const [inventoryHasLate, setInventoryHasLate] = useState(false);

  const onSelect = (type: 'room' | 'locker', id: string, number: string, tier: string) => {
    // Check if employee selected different type than customer requested.
    // Keep behavior: trigger the customer-confirmation modal before assignment.
    if (customerSelectedType && tier !== customerSelectedType) {
      onRequireCustomerConfirmation({
        requested: customerSelectedType,
        selected: tier,
        number,
      });
    }

    setSelectedInventoryItem({ type, id, number, tier });
  };

  const clearSelection = () => setSelectedInventoryItem(null);

  const openInventorySection = (section: InventoryDrawerSection) => {
    setInventoryForcedSection(section);
    setIsInventoryDrawerOpen(true);
  };

  return {
    setSelectedInventoryItem,
    selectedInventoryItem,
    onSelect,
    clearSelection,
    isInventoryDrawerOpen,
    setIsInventoryDrawerOpen,
    inventoryForcedSection,
    setInventoryForcedSection,
    openInventorySection,
    inventoryHasLate,
    setInventoryHasLate,
  };
}

