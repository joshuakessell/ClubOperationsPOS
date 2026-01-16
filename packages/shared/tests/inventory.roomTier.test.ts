import { describe, expect, it } from 'vitest';
import { getRoomTierFromRoomNumber } from '../src/inventory';

describe('getRoomTierFromRoomNumber (canonical mapping)', () => {
  it('maps known room numbers to the correct tier', () => {
    // Special rooms (contract)
    expect(getRoomTierFromRoomNumber(201)).toBe('SPECIAL');
    expect(getRoomTierFromRoomNumber('232')).toBe('SPECIAL');

    // Double rooms (contract)
    expect(getRoomTierFromRoomNumber(216)).toBe('DOUBLE');
    expect(getRoomTierFromRoomNumber('262')).toBe('DOUBLE');

    // Standard rooms (contract)
    expect(getRoomTierFromRoomNumber(200)).toBe('STANDARD');
    expect(getRoomTierFromRoomNumber('202')).toBe('STANDARD');
  });

  it('rejects non-existent room numbers', () => {
    expect(() => getRoomTierFromRoomNumber(247)).toThrow();
    expect(() => getRoomTierFromRoomNumber('261')).toThrow();
  });

  it('rejects non-numeric room inputs', () => {
    expect(() => getRoomTierFromRoomNumber('216A')).toThrow();
    expect(() => getRoomTierFromRoomNumber('')).toThrow();
  });
});

