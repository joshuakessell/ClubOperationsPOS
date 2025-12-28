import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchSquareSummary, SquareNotConfiguredError } from '../src/services/square.js';

describe('Square service', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    (global.fetch as any)?.mockRestore?.();
  });

  it('throws when not configured', async () => {
    delete process.env.SQUARE_ACCESS_TOKEN;
    delete process.env.SQUARE_LOCATION_ID;

    await expect(fetchSquareSummary(new Date().toISOString(), new Date().toISOString()))
      .rejects.toBeInstanceOf(SquareNotConfiguredError);
  });

  it('computes summary totals', async () => {
    process.env.SQUARE_ACCESS_TOKEN = 'token';
    process.env.SQUARE_LOCATION_ID = 'loc';
    process.env.SQUARE_ENV = 'sandbox';

    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        payments: [
          {
            id: 'p1',
            amount_money: { amount: 1000 },
            cash_details: { buyer_tendered_money: { amount: 500 } },
            refunds: [{ amount_money: { amount: 200 } }],
          },
          {
            id: 'p2',
            amount_money: { amount: 2000 },
          },
        ],
      }),
    } as any);

    const summary = await fetchSquareSummary(new Date().toISOString(), new Date().toISOString());
    expect(summary.totals.totalAmount).toBe(3000);
    expect(summary.totals.cashAmount).toBe(500);
    expect(summary.totals.cardAmount).toBe(2000);
    expect(summary.totals.refundedAmount).toBe(200);
    expect(summary.totals.countPayments).toBe(2);

    expect(mockFetch).toHaveBeenCalled();
  });
});

