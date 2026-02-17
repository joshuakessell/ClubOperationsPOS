import { describe, it, expect } from 'vitest';
import { derivePastDueLineItems } from './pastDueLineItems';

describe('derivePastDueLineItems', () => {
  it('returns single past due item for positive balance', () => {
    const result = derivePastDueLineItems(50);
    expect(result).toEqual([{ description: 'Past due balance', amount: 50 }]);
  });

  it('returns empty array for zero balance', () => {
    expect(derivePastDueLineItems(0)).toEqual([]);
  });

  it('returns empty array for negative balance', () => {
    expect(derivePastDueLineItems(-10)).toEqual([]);
  });

  it('handles decimal amounts', () => {
    const result = derivePastDueLineItems(25.5);
    expect(result).toEqual([{ description: 'Past due balance', amount: 25.5 }]);
  });
});
