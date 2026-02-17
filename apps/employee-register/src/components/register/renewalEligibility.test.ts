import { describe, it, expect } from 'vitest';
import { formatLocal, getRenewalEligibility } from './renewalEligibility';

describe('formatLocal', () => {
  it('returns dash for null', () => {
    expect(formatLocal(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatLocal(undefined)).toBe('—');
  });

  it('returns dash for empty string', () => {
    expect(formatLocal('')).toBe('—');
  });

  it('returns dash for invalid date string', () => {
    expect(formatLocal('not-a-date')).toBe('—');
  });

  it('returns formatted string for valid ISO date', () => {
    const result = formatLocal('2026-01-15T10:30:00.000Z');
    // toLocaleString output varies by locale, but should not be '—'
    expect(result).not.toBe('—');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getRenewalEligibility', () => {
  it('returns ineligible when activeCheckin is null', () => {
    const result = getRenewalEligibility(null);
    expect(result).toEqual({
      withinWindow: false,
      allowTwoHour: false,
      allowSixHour: false,
      totalHours: null,
    });
  });

  it('returns ineligible when checkoutAt is missing', () => {
    const result = getRenewalEligibility({ checkoutAt: undefined } as any);
    expect(result.withinWindow).toBe(false);
  });

  it('returns withinWindow=true when checkout is within 1 hour', () => {
    const now = new Date();
    const checkoutAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30 mins from now
    const result = getRenewalEligibility({
      checkoutAt,
      currentTotalHours: 4,
    } as any);
    expect(result.withinWindow).toBe(true);
    expect(result.totalHours).toBe(4);
  });

  it('returns withinWindow=false when checkout is more than 1 hour away', () => {
    const now = new Date();
    const checkoutAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours away
    const result = getRenewalEligibility({
      checkoutAt,
      currentTotalHours: 4,
    } as any);
    expect(result.withinWindow).toBe(false);
  });

  it('allows 2-hour renewal when total + 2 <= 14', () => {
    const now = new Date();
    const checkoutAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const result = getRenewalEligibility({
      checkoutAt,
      currentTotalHours: 12,
    } as any);
    expect(result.allowTwoHour).toBe(true);
    expect(result.allowSixHour).toBe(false);
  });

  it('disallows 2-hour renewal when total + 2 > 14', () => {
    const now = new Date();
    const checkoutAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const result = getRenewalEligibility({
      checkoutAt,
      currentTotalHours: 13,
    } as any);
    expect(result.allowTwoHour).toBe(false);
    expect(result.allowSixHour).toBe(false);
  });

  it('allows 6-hour renewal when total + 6 <= 14', () => {
    const now = new Date();
    const checkoutAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const result = getRenewalEligibility({
      checkoutAt,
      currentTotalHours: 6,
    } as any);
    expect(result.allowTwoHour).toBe(true);
    expect(result.allowSixHour).toBe(true);
  });

  it('handles null currentTotalHours', () => {
    const now = new Date();
    const checkoutAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const result = getRenewalEligibility({
      checkoutAt,
      currentTotalHours: null,
    } as any);
    expect(result.withinWindow).toBe(true);
    expect(result.totalHours).toBeNull();
    expect(result.allowTwoHour).toBe(false);
    expect(result.allowSixHour).toBe(false);
  });
});
