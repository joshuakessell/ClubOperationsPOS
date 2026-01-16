import { describe, expect, it } from 'vitest';
import { getRoomTierFromRoomNumber } from '@club-ops/shared';

describe('office-dashboard room tier mapping', () => {
  it('maps SPECIAL rooms using the canonical shared mapping', () => {
    expect(getRoomTierFromRoomNumber(201)).toBe('SPECIAL');
    expect(getRoomTierFromRoomNumber('232')).toBe('SPECIAL');
    expect(getRoomTierFromRoomNumber(256)).toBe('SPECIAL');
  });

  it('handles non-existent room numbers intentionally (throws for non-existent in-range rooms)', () => {
    // Within the facility range 200..262, some room numbers intentionally do not exist.
    expect(() => getRoomTierFromRoomNumber(247)).toThrow();
  });
});

