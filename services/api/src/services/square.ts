import crypto from 'crypto';

interface SquareConfig {
  accessToken: string;
  env: 'production' | 'sandbox';
  locationId: string;
}

export interface SquareSummary {
  from: string;
  to: string;
  lastUpdated: string;
  totals: {
    totalAmount: number;
    cashAmount: number;
    cardAmount: number;
    refundedAmount: number;
    countPayments: number;
  };
  raw?: unknown;
}

const CACHE_TTL_MS = 45_000;
const cache = new Map<string, { timestamp: number; data: SquareSummary }>();

export class SquareNotConfiguredError extends Error {
  code = 'SQUARE_NOT_CONFIGURED';
  constructor() {
    super('Square integration not configured');
  }
}

function getConfig(): SquareConfig {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const env = (process.env.SQUARE_ENV as 'production' | 'sandbox') || 'sandbox';
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) {
    throw new SquareNotConfiguredError();
  }

  return { accessToken, env, locationId };
}

function getBaseUrl(env: 'production' | 'sandbox'): string {
  return env === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
}

async function callSquare<T>(config: SquareConfig, path: string, params?: URLSearchParams): Promise<T> {
  const url = `${getBaseUrl(config.env)}${path}${params ? `?${params.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Square-Version': '2023-12-13',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const err = new Error(`Square API error ${response.status}: ${errorBody}`);
    (err as any).status = response.status;
    throw err;
  }

  return response.json() as Promise<T>;
}

function computeCacheKey(from: string, to: string): string {
  return crypto.createHash('sha1').update(`${from}:${to}`).digest('hex');
}

export async function fetchSquareSummary(from: string, to: string): Promise<SquareSummary> {
  const cacheKey = computeCacheKey(from, to);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const config = getConfig();

  const params = new URLSearchParams({
    begin_time: new Date(from).toISOString(),
    end_time: new Date(to).toISOString(),
    location_id: config.locationId,
    sort_order: 'DESC',
  });

  type Payment = {
    id: string;
    amount_money?: { amount: number };
    card_details?: unknown;
    cash_details?: { buyer_tendered_money?: { amount?: number } };
    status?: string;
    refunds?: Array<{ amount_money?: { amount: number } }>;
  };

  const paymentsResponse = await callSquare<{ payments?: Payment[] }>(config, '/v2/payments', params);
  const payments = paymentsResponse.payments || [];

  let totalAmount = 0;
  let cashAmount = 0;
  let cardAmount = 0;
  let refundedAmount = 0;

  for (const payment of payments) {
    const amt = payment.amount_money?.amount ?? 0;
    totalAmount += amt;

    if (payment.cash_details?.buyer_tendered_money?.amount) {
      cashAmount += payment.cash_details.buyer_tendered_money.amount;
    } else {
      // Assume non-cash as card for this lightweight summary
      cardAmount += amt;
    }

    if (payment.refunds) {
      for (const refund of payment.refunds) {
        refundedAmount += refund.amount_money?.amount ?? 0;
      }
    }
  }

  const summary: SquareSummary = {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    lastUpdated: new Date().toISOString(),
    totals: {
      totalAmount,
      cashAmount,
      cardAmount,
      refundedAmount,
      countPayments: payments.length,
    },
    raw: process.env.SQUARE_DEBUG === 'true' ? paymentsResponse : undefined,
  };

  cache.set(cacheKey, { timestamp: Date.now(), data: summary });
  return summary;
}

