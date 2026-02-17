import { describe, it, expect } from 'vitest';
import { deriveWaitlistEligibility } from './waitlistEligibility';
import type { WaitlistEntryEligibilityInput } from './waitlistEligibility';

function makeEntry(
  overrides: Partial<WaitlistEntryEligibilityInput> = {}
): WaitlistEntryEligibilityInput {
  return {
    id: 'entry-1',
    status: 'ACTIVE',
    desiredTier: 'STANDARD',
    ...overrides,
  };
}

describe('deriveWaitlistEligibility', () => {
  it('returns empty result for no entries', () => {
    const result = deriveWaitlistEligibility([], { rawRooms: { STANDARD: 5 } });
    expect(result.offeredCountByTier).toEqual({});
    expect(result.eligibleEntryCount).toBe(0);
    expect(result.hasEligibleEntries).toBe(false);
  });

  it('counts offered entries by tier', () => {
    const entries = [
      makeEntry({ id: '1', status: 'OFFERED', desiredTier: 'DOUBLE' }),
      makeEntry({ id: '2', status: 'OFFERED', desiredTier: 'DOUBLE' }),
      makeEntry({ id: '3', status: 'OFFERED', desiredTier: 'STANDARD' }),
    ];
    const result = deriveWaitlistEligibility(entries, { rawRooms: { DOUBLE: 5, STANDARD: 5 } });
    expect(result.offeredCountByTier).toEqual({ DOUBLE: 2, STANDARD: 1 });
  });

  it('marks OFFERED entries as eligible', () => {
    const entry = makeEntry({ status: 'OFFERED', desiredTier: 'STANDARD' });
    const result = deriveWaitlistEligibility([entry], { rawRooms: { STANDARD: 0 } });
    expect(result.isEntryOfferEligible(entry)).toBe(true);
    expect(result.eligibleEntryCount).toBe(1);
  });

  it('marks ACTIVE entry as eligible when rooms available exceed offered', () => {
    const entries = [
      makeEntry({ id: '1', status: 'OFFERED', desiredTier: 'STANDARD' }),
      makeEntry({ id: '2', status: 'ACTIVE', desiredTier: 'STANDARD' }),
    ];
    const result = deriveWaitlistEligibility(entries, { rawRooms: { STANDARD: 2 } });
    expect(result.isEntryOfferEligible(entries[1]!)).toBe(true);
    expect(result.eligibleEntryCount).toBe(2);
    expect(result.hasEligibleEntries).toBe(true);
  });

  it('marks ACTIVE entry as ineligible when rooms exhausted', () => {
    const entries = [
      makeEntry({ id: '1', status: 'OFFERED', desiredTier: 'STANDARD' }),
      makeEntry({ id: '2', status: 'ACTIVE', desiredTier: 'STANDARD' }),
    ];
    const result = deriveWaitlistEligibility(entries, { rawRooms: { STANDARD: 1 } });
    expect(result.isEntryOfferEligible(entries[1]!)).toBe(false);
    expect(result.eligibleEntryCount).toBe(1);
  });

  it('returns ineligible for ACTIVE entry when inventory is null', () => {
    const entry = makeEntry({ status: 'ACTIVE' });
    const result = deriveWaitlistEligibility([entry], null);
    expect(result.isEntryOfferEligible(entry)).toBe(false);
    expect(result.hasEligibleEntries).toBe(false);
  });

  it('ignores CANCELLED entries', () => {
    const entry = makeEntry({ status: 'CANCELLED' });
    const result = deriveWaitlistEligibility([entry], { rawRooms: { STANDARD: 5 } });
    expect(result.isEntryOfferEligible(entry)).toBe(false);
    expect(result.eligibleEntryCount).toBe(0);
  });
});
