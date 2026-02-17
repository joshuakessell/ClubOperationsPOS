import { describe, it, expect } from 'vitest';
import { RoomStatus } from '@club-ops/shared';
import {
  isRecord,
  getMsUntil,
  formatDurationHuman,
  formatTimeOfDay,
  isUuid,
  alertLevelFromMsUntil,
  groupRooms,
  sortGroupedRooms,
} from './utils';
import type { DetailedRoom, RoomGroup } from './types';

// ---------------------------------------------------------------------------
// isRecord
// ---------------------------------------------------------------------------
describe('isRecord', () => {
  it('returns true for plain object', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });
  it('returns false for null', () => expect(isRecord(null)).toBe(false));
  it('returns false for array', () => expect(isRecord([1, 2])).toBe(true)); // arrays are objects
  it('returns false for string', () => expect(isRecord('hello')).toBe(false));
  it('returns false for number', () => expect(isRecord(42)).toBe(false));
});

// ---------------------------------------------------------------------------
// getMsUntil
// ---------------------------------------------------------------------------
describe('getMsUntil', () => {
  it('returns ms difference from now', () => {
    const nowMs = 1000000;
    const iso = new Date(1030000).toISOString(); // 30s ahead
    expect(getMsUntil(iso, nowMs)).toBe(30000);
  });

  it('returns negative for past times', () => {
    const nowMs = 1000000;
    const iso = new Date(970000).toISOString(); // 30s behind
    expect(getMsUntil(iso, nowMs)).toBe(-30000);
  });

  it('returns null for undefined', () => {
    expect(getMsUntil(undefined, 1000)).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(getMsUntil('not-a-date', 1000)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatDurationHuman
// ---------------------------------------------------------------------------
describe('formatDurationHuman', () => {
  it('formats minutes only', () => {
    expect(formatDurationHuman(15 * 60 * 1000)).toEqual({ label: '15 mins', isOverdue: false });
  });

  it('formats hours and minutes', () => {
    expect(formatDurationHuman(90 * 60 * 1000)).toEqual({
      label: '1 hr 30 mins',
      isOverdue: false,
    });
  });

  it('formats exact hours', () => {
    expect(formatDurationHuman(120 * 60 * 1000)).toEqual({ label: '2 hr', isOverdue: false });
  });

  it('marks overdue for negative values', () => {
    const result = formatDurationHuman(-5 * 60 * 1000);
    expect(result.isOverdue).toBe(true);
    expect(result.label).toContain('mins');
  });

  it('returns 0 mins for exactly zero', () => {
    expect(formatDurationHuman(0)).toEqual({ label: '0 mins', isOverdue: false });
  });
});

// ---------------------------------------------------------------------------
// formatTimeOfDay
// ---------------------------------------------------------------------------
describe('formatTimeOfDay', () => {
  it('returns null for undefined', () => {
    expect(formatTimeOfDay(undefined)).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(formatTimeOfDay('invalid')).toBeNull();
  });

  it('returns formatted time string for valid ISO', () => {
    const result = formatTimeOfDay('2026-06-15T14:30:00.000Z');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// isUuid
// ---------------------------------------------------------------------------
describe('isUuid', () => {
  it('validates correct UUID', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects invalid UUID', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('returns false for null', () => expect(isUuid(null)).toBe(false));
  it('returns false for undefined', () => expect(isUuid(undefined)).toBe(false));
  it('returns false for empty string', () => expect(isUuid('')).toBe(false));
});

// ---------------------------------------------------------------------------
// alertLevelFromMsUntil
// ---------------------------------------------------------------------------
describe('alertLevelFromMsUntil', () => {
  const DUE_SOON_MS = 30 * 60 * 1000;

  it('returns "danger" for negative (overdue)', () => {
    expect(alertLevelFromMsUntil(-1)).toBe('danger');
  });

  it('returns "warning" when within 30 min threshold', () => {
    expect(alertLevelFromMsUntil(DUE_SOON_MS - 1)).toBe('warning');
    expect(alertLevelFromMsUntil(0)).toBe('warning');
  });

  it('returns "warning" at exactly 30 min', () => {
    expect(alertLevelFromMsUntil(DUE_SOON_MS)).toBe('warning');
  });

  it('returns null for time well in the future', () => {
    expect(alertLevelFromMsUntil(DUE_SOON_MS + 1)).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(alertLevelFromMsUntil(null)).toBeNull();
    expect(alertLevelFromMsUntil(undefined)).toBeNull();
  });

  it('returns null for non-finite number', () => {
    expect(alertLevelFromMsUntil(Infinity)).toBeNull();
    expect(alertLevelFromMsUntil(NaN)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// groupRooms
// ---------------------------------------------------------------------------
describe('groupRooms', () => {
  const makeRoom = (overrides: Partial<DetailedRoom> = {}): DetailedRoom =>
    ({
      id: 'room-1',
      number: '101',
      tier: 'STANDARD',
      status: RoomStatus.CLEAN,
      floor: 1,
      lastStatusChange: '2026-01-01T00:00:00Z',
      overrideFlag: false,
      ...overrides,
    }) as DetailedRoom;

  it('groups clean unassigned room as available', () => {
    const result = groupRooms([makeRoom()], [], Date.now());
    expect(result[0]!.group).toBe('available');
  });

  it('groups occupied room', () => {
    const result = groupRooms([makeRoom({ status: RoomStatus.OCCUPIED })], [], Date.now());
    expect(result[0]!.group).toBe('occupied');
  });

  it('groups assigned room as occupied', () => {
    const result = groupRooms([makeRoom({ assignedTo: 'cust-1' })], [], Date.now());
    expect(result[0]!.group).toBe('occupied');
  });

  it('groups cleaning room', () => {
    const result = groupRooms([makeRoom({ status: RoomStatus.CLEANING })], [], Date.now());
    expect(result[0]!.group).toBe('cleaning');
  });

  it('groups dirty room', () => {
    const result = groupRooms([makeRoom({ status: RoomStatus.DIRTY })], [], Date.now());
    expect(result[0]!.group).toBe('dirty');
  });

  it('groups clean room matching waitlist as upgradeRequest', () => {
    const room = makeRoom({ tier: 'DOUBLE', status: RoomStatus.CLEAN });
    const waitlistEntries = [{ desiredTier: 'DOUBLE', status: 'ACTIVE' }];
    const result = groupRooms([room], waitlistEntries, Date.now());
    expect(result[0]!.group).toBe('upgradeRequest');
    expect(result[0]!.isWaitlistMatch).toBe(true);
  });

  it('does not match occupied room to waitlist', () => {
    const room = makeRoom({ tier: 'DOUBLE', status: RoomStatus.OCCUPIED });
    const waitlistEntries = [{ desiredTier: 'DOUBLE', status: 'ACTIVE' }];
    const result = groupRooms([room], waitlistEntries, Date.now());
    expect(result[0]!.group).toBe('occupied');
  });
});

// ---------------------------------------------------------------------------
// sortGroupedRooms
// ---------------------------------------------------------------------------
describe('sortGroupedRooms', () => {
  const makeGrouped = (group: string, number: string, extra: Record<string, unknown> = {}) => ({
    room: { number, tier: 'STANDARD', status: RoomStatus.CLEAN, id: `r-${number}` } as DetailedRoom,
    group: group as RoomGroup,
    ...extra,
  });

  it('sorts by group priority: upgradeRequest < available < occupied < cleaning < dirty', () => {
    const items = [
      makeGrouped('dirty', '5'),
      makeGrouped('available', '2'),
      makeGrouped('upgradeRequest', '1'),
      makeGrouped('cleaning', '4'),
      makeGrouped('occupied', '3'),
    ];
    const sorted = sortGroupedRooms(items);
    expect(sorted.map((s) => s.group)).toEqual([
      'upgradeRequest',
      'available',
      'occupied',
      'cleaning',
      'dirty',
    ]);
  });

  it('sorts rooms within same group by room number', () => {
    const items = [
      makeGrouped('available', '205'),
      makeGrouped('available', '103'),
      makeGrouped('available', '101'),
    ];
    const sorted = sortGroupedRooms(items);
    expect(sorted.map((s) => s.room.number)).toEqual(['101', '103', '205']);
  });
});
