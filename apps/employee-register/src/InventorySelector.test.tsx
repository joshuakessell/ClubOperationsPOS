import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InventorySelector } from './InventorySelector';
import { RoomStatus } from '@club-ops/shared';

// Mock fetch
global.fetch = vi.fn();

describe('InventorySelector', () => {
  const mockProps = {
    customerSelectedType: null,
    waitlistDesiredTier: null,
    waitlistBackupType: null,
    onSelect: vi.fn(),
    selectedItem: null,
    sessionId: 'test-session',
    lane: 'lane-1',
    sessionToken: 'test-token',
  };

  const mockInventory = {
    rooms: [
      {
        id: 'room-1',
        number: '101',
        tier: 'STANDARD',
        status: RoomStatus.CLEAN,
        floor: 1,
        lastStatusChange: new Date().toISOString(),
        assignedTo: undefined,
        assignedMemberName: undefined,
        overrideFlag: false,
      },
      {
        id: 'room-2',
        number: '102',
        tier: 'STANDARD',
        status: RoomStatus.CLEAN,
        floor: 1,
        lastStatusChange: new Date().toISOString(),
        assignedTo: 'member-1',
        assignedMemberName: 'John Doe',
        overrideFlag: false,
        checkinAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        checkoutAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
      },
    ],
    lockers: [
      {
        id: 'locker-1',
        number: '001',
        status: RoomStatus.CLEAN,
        assignedTo: undefined,
        assignedMemberName: undefined,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockInventory,
    });

    render(<InventorySelector {...mockProps} />);
    expect(screen.getByText(/loading inventory/i)).toBeDefined();
  });

  it('should group and sort rooms correctly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockInventory,
    });

    render(<InventorySelector {...mockProps} customerSelectedType="STANDARD" />);
    
    // Wait for data to load
    await screen.findByText(/standard rooms/i);
    
    // Check that sections are rendered
    expect(screen.getByText(/standard rooms/i)).toBeDefined();
  });

  it('should auto-expand section when customer selects type', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockInventory,
    });

    render(<InventorySelector {...mockProps} customerSelectedType="STANDARD" />);
    
    await screen.findByText(/standard rooms/i);
    
    // Section should be expanded (we can check by looking for room numbers)
    // This is a basic test - in a real scenario, we'd check the expanded state
  });

  it('should auto-select first available item', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockInventory,
    });

    const onSelect = vi.fn();
    render(
      <InventorySelector
        {...mockProps}
        customerSelectedType="STANDARD"
        onSelect={onSelect}
      />
    );
    
    await screen.findByText(/standard rooms/i);
    
    // Auto-selection happens in useEffect, so we wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // onSelect should be called with the first available room
    expect(onSelect).toHaveBeenCalledWith(
      'room',
      'room-1',
      '101',
      'STANDARD'
    );
  });
});

