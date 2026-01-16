import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAllowedRentals, isGymLockerEligible } from '../src/checkin/allowedRentals.js';

describe('checkin/allowedRentals', () => {
  const originalEnv = process.env.GYM_LOCKER_ELIGIBLE_RANGES;

  beforeEach(() => {
    delete process.env.GYM_LOCKER_ELIGIBLE_RANGES;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GYM_LOCKER_ELIGIBLE_RANGES;
    } else {
      process.env.GYM_LOCKER_ELIGIBLE_RANGES = originalEnv;
    }
  });

  it('does not allow gym locker when ranges env is unset/blank', () => {
    expect(isGymLockerEligible('1500')).toBe(false);
    expect(getAllowedRentals('1500')).toEqual(['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL']);
  });

  it('adds GYM_LOCKER when membership number is within configured ranges', () => {
    process.env.GYM_LOCKER_ELIGIBLE_RANGES = '1000-1999, 5000-5999';
    expect(isGymLockerEligible('1500')).toBe(true);
    expect(getAllowedRentals('1500')).toEqual(['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL', 'GYM_LOCKER']);
  });

  it('treats invalid membership numbers as not eligible', () => {
    process.env.GYM_LOCKER_ELIGIBLE_RANGES = '1000-1999';
    expect(isGymLockerEligible('abc')).toBe(false);
    expect(isGymLockerEligible('')).toBe(false);
    expect(isGymLockerEligible(undefined)).toBe(false);
    expect(isGymLockerEligible(null)).toBe(false);
  });

  it('handles inclusive boundaries', () => {
    process.env.GYM_LOCKER_ELIGIBLE_RANGES = '1000-1999';
    expect(isGymLockerEligible('1000')).toBe(true);
    expect(isGymLockerEligible('1999')).toBe(true);
    expect(isGymLockerEligible('999')).toBe(false);
    expect(isGymLockerEligible('2000')).toBe(false);
  });
});

