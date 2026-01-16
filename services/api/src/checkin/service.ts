import crypto from 'crypto';
import type { SessionUpdatedPayload } from '@club-ops/shared';

import type {
  CustomerRow,
  LaneSessionRow,
  PaymentIntentRow,
  PoolClient,
  RoomRentalType,
} from './types.js';
import { getAllowedRentals } from './allowedRentals.js';

export function normalizeScanText(raw: string): string {
  // Normalize line endings and whitespace while preserving line breaks.
  // Honeywell scanners often emit already-decoded PDF417 text that may include \\r\\n or \\r.
  const lf = raw.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
  const lines = lf.split('\\n').map((line) => line.replace(/[ \\t]+/g, ' ').trimEnd());
  return lines.join('\\n').trim();
}

export function computeSha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Helper function to check past-due balance and bypass status.
 * Returns true if customer is blocked by past-due balance.
 *
 * Note: Behavior intentionally matches the previous inline helper in `routes/checkin.ts`.
 */
export async function checkPastDueBlocked(
  client: PoolClient,
  customerId: string | null,
  sessionBypassed: boolean
): Promise<{ blocked: boolean; balance: number }> {
  if (!customerId) {
    return { blocked: false, balance: 0 };
  }

  const customerResult = await client.query<CustomerRow>(
    `SELECT past_due_balance FROM customers WHERE id = $1`,
    [customerId]
  );

  if (customerResult.rows.length === 0) {
    return { blocked: false, balance: 0 };
  }

  const balance = parseFloat(String(customerResult.rows[0]!.past_due_balance || 0));
  const blocked = balance > 0 && !sessionBypassed;

  return { blocked, balance };
}

export async function assertAssignedResourcePersistedAndUnavailable(params: {
  client: PoolClient;
  sessionId: string;
  customerId: string;
  resourceType: 'room' | 'locker';
  resourceId: string;
  resourceNumber?: string;
}): Promise<void> {
  const { client, sessionId, customerId, resourceType, resourceId, resourceNumber } = params;

  if (resourceType === 'room') {
    const row = (
      await client.query<{
        id: string;
        number: string;
        status: string;
        assigned_to_customer_id: string | null;
      }>(
        `SELECT id, number, status, assigned_to_customer_id
         FROM rooms
         WHERE id = $1`,
        [resourceId]
      )
    ).rows[0];

    const number = resourceNumber ?? row?.number ?? '(unknown)';
    const assignedOk = row?.assigned_to_customer_id === customerId;
    const qualifiesForAvailable = row?.status === 'CLEAN' && row?.assigned_to_customer_id === null;
    if (!assignedOk || qualifiesForAvailable) {
      throw {
        statusCode: 500,
        message: `Check-in persistence assertion failed (room): sessionId=${sessionId} customerId=${customerId} resourceId=${resourceId} resourceNumber=${number} status=${row?.status ?? '(missing)'} assigned_to_customer_id=${row?.assigned_to_customer_id ?? '(null)'}`,
      };
    }
    return;
  }

  const row = (
    await client.query<{
      id: string;
      number: string;
      status: string;
      assigned_to_customer_id: string | null;
    }>(
      `SELECT id, number, status, assigned_to_customer_id
       FROM lockers
       WHERE id = $1`,
      [resourceId]
    )
  ).rows[0];

  const number = resourceNumber ?? row?.number ?? '(unknown)';
  const assignedOk = row?.assigned_to_customer_id === customerId;
  const qualifiesForAvailable = row?.status === 'CLEAN' && row?.assigned_to_customer_id === null;
  if (!assignedOk || qualifiesForAvailable) {
    throw {
      statusCode: 500,
      message: `Check-in persistence assertion failed (locker): sessionId=${sessionId} customerId=${customerId} resourceId=${resourceId} resourceNumber=${number} status=${row?.status ?? '(missing)'} assigned_to_customer_id=${row?.assigned_to_customer_id ?? '(null)'}`,
    };
  }
}

export async function selectRoomForNewCheckin(
  client: PoolClient,
  rentalType: RoomRentalType
): Promise<{ id: string; number: string } | null> {
  // 1) ACTIVE waitlist demand count for this tier (still within scheduled stay)
  const demandRes = await client.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM waitlist w
     JOIN checkin_blocks cb ON cb.id = w.checkin_block_id
     JOIN visits v ON v.id = w.visit_id
     WHERE w.status = 'ACTIVE'
       AND w.desired_tier::text = $1
       AND v.ended_at IS NULL
       AND cb.ends_at > NOW()`,
    [rentalType]
  );
  const activeDemandCount = parseInt(demandRes.rows[0]?.count ?? '0', 10) || 0;

  // 2) OFFERED waitlist rooms are explicitly reserved (do not assign them)
  const offeredRes = await client.query<{ room_id: string }>(
    `SELECT w.room_id
     FROM waitlist w
     JOIN checkin_blocks cb ON cb.id = w.checkin_block_id
     JOIN visits v ON v.id = w.visit_id
     WHERE w.status = 'OFFERED'
       AND w.desired_tier::text = $1
       AND w.room_id IS NOT NULL
       AND v.ended_at IS NULL
       AND cb.ends_at > NOW()`,
    [rentalType]
  );
  const offeredRoomIds = offeredRes.rows.map((r) => r.room_id).filter(Boolean);

  // 3) Select the (activeDemandCount+1)th clean, unassigned room by number, excluding offered rooms.
  // Concurrency-safe: FOR UPDATE SKIP LOCKED
  const room = (
    await client.query<{ id: string; number: string }>(
      `SELECT id, number
       FROM rooms
       WHERE status = 'CLEAN'
         AND assigned_to_customer_id IS NULL
         AND type = $1
         AND id <> ALL($2::uuid[])
       ORDER BY number ASC
       OFFSET $3
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [rentalType, offeredRoomIds, activeDemandCount]
    )
  ).rows[0];

  return room ?? null;
}

export function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

export function toDate(value: unknown): Date | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractPaymentLineItems(raw: unknown): Array<{ description: string; amount: number }> | undefined {
  if (raw === null || raw === undefined) return undefined;
  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }
  if (!isRecord(parsed)) return undefined;
  const items = parsed['lineItems'];
  if (!Array.isArray(items)) return undefined;

  const normalized: Array<{ description: string; amount: number }> = [];
  for (const it of items) {
    if (!isRecord(it)) continue;
    const description = it['description'];
    const amount = toNumber(it['amount']);
    if (typeof description !== 'string' || amount === undefined) continue;
    normalized.push({ description, amount });
  }
  return normalized.length > 0 ? normalized : undefined;
}

export function getHttpError(error: unknown): { statusCode: number; message?: string } | null {
  if (!error || typeof error !== 'object') return null;
  if (!('statusCode' in error)) return null;
  const statusCode = (error as { statusCode: unknown }).statusCode;
  if (typeof statusCode !== 'number') return null;
  const message = (error as { message?: unknown }).message;
  return { statusCode, message: typeof message === 'string' ? message : undefined };
}

export async function buildFullSessionUpdatedPayload(
  client: PoolClient,
  sessionId: string
): Promise<{ laneId: string; payload: SessionUpdatedPayload }> {
  const sessionResult = await client.query<LaneSessionRow>(
    `SELECT * FROM lane_sessions WHERE id = $1 LIMIT 1`,
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    throw new Error(`Lane session not found: ${sessionId}`);
  }

  const session = sessionResult.rows[0]!;
  const laneId = session.lane_id;

  const customer = session.customer_id
    ? (
        await client.query<CustomerRow>(
          `SELECT id, name, dob, membership_number, membership_card_type, membership_valid_until, past_due_balance, primary_language, notes
             FROM customers
             WHERE id = $1
             LIMIT 1`,
          [session.customer_id]
        )
      ).rows[0]
    : undefined;

  const membershipNumber = customer?.membership_number || session.membership_number || undefined;

  const allowedRentals = getAllowedRentals(membershipNumber);

  const pastDueBalance = toNumber(customer?.past_due_balance) || 0;
  const pastDueBypassed = !!session.past_due_bypassed;
  const pastDueBlocked = pastDueBalance > 0 && !pastDueBypassed;

  let customerDobMonthDay: string | undefined;
  const customerDob = toDate(customer?.dob);
  if (customerDob) {
    customerDobMonthDay = `${String(customerDob.getMonth() + 1).padStart(2, '0')}/${String(
      customerDob.getDate()
    ).padStart(2, '0')}`;
  }

  let customerLastVisitAt: string | undefined;
  if (session.customer_id) {
    const lastVisitResult = await client.query<{ starts_at: Date }>(
      `SELECT cb.starts_at
       FROM checkin_blocks cb
       JOIN visits v ON v.id = cb.visit_id
       WHERE v.customer_id = $1
       ORDER BY cb.starts_at DESC
       LIMIT 1`,
      [session.customer_id]
    );
    if (lastVisitResult.rows.length > 0) {
      customerLastVisitAt = lastVisitResult.rows[0]!.starts_at.toISOString();
    }
  }

  // Prefer a check-in block created by this lane session (when completed)
  const blockForSession = (
    await client.query<{
      visit_id: string;
      ends_at: Date;
      agreement_signed: boolean;
    }>(
      `SELECT visit_id, ends_at, agreement_signed
       FROM checkin_blocks
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.id]
    )
  ).rows[0];

  // Active visit info (useful for RENEWAL mode pre-completion)
  let activeVisitId: string | undefined;
  let activeBlockEndsAt: string | undefined;
  if (session.customer_id) {
    const activeVisitResult = await client.query<{ visit_id: string; ends_at: Date }>(
      `SELECT v.id as visit_id, cb.ends_at
       FROM visits v
       JOIN checkin_blocks cb ON cb.visit_id = v.id
       WHERE v.customer_id = $1 AND v.ended_at IS NULL
       ORDER BY cb.ends_at DESC
       LIMIT 1`,
      [session.customer_id]
    );
    if (activeVisitResult.rows.length > 0) {
      activeVisitId = activeVisitResult.rows[0]!.visit_id;
      activeBlockEndsAt = activeVisitResult.rows[0]!.ends_at.toISOString();
    }
  }

  let assignedResourceType = session.assigned_resource_type as 'room' | 'locker' | null;
  let assignedResourceNumber: string | undefined;

  if (session.assigned_resource_id && assignedResourceType) {
    if (assignedResourceType === 'room') {
      const roomResult = await client.query<{ number: string }>(
        `SELECT number FROM rooms WHERE id = $1 LIMIT 1`,
        [session.assigned_resource_id]
      );
      assignedResourceNumber = roomResult.rows[0]?.number;
    } else if (assignedResourceType === 'locker') {
      const lockerResult = await client.query<{ number: string }>(
        `SELECT number FROM lockers WHERE id = $1 LIMIT 1`,
        [session.assigned_resource_id]
      );
      assignedResourceNumber = lockerResult.rows[0]?.number;
    }
  }

  // Payment intent: prefer the one pinned on the session, otherwise latest for session
  let paymentIntent: PaymentIntentRow | undefined;
  if (session.payment_intent_id) {
    const intentResult = await client.query<PaymentIntentRow>(
      `SELECT * FROM payment_intents WHERE id = $1 LIMIT 1`,
      [session.payment_intent_id]
    );
    paymentIntent = intentResult.rows[0];
  } else {
    const intentResult = await client.query<PaymentIntentRow>(
      `SELECT * FROM payment_intents
       WHERE lane_session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.id]
    );
    paymentIntent = intentResult.rows[0];
  }

  const paymentTotal = toNumber(paymentIntent?.amount);
  const paymentLineItems =
    extractPaymentLineItems(session.price_quote_json) ?? extractPaymentLineItems(paymentIntent?.quote_json);

  const membershipValidUntilRaw = (customer as any)?.membership_valid_until as unknown;
  const customerMembershipValidUntil =
    membershipValidUntilRaw instanceof Date
      ? membershipValidUntilRaw.toISOString().slice(0, 10)
      : typeof membershipValidUntilRaw === 'string'
        ? membershipValidUntilRaw
        : undefined;

  const payload: SessionUpdatedPayload = {
    sessionId: session.id,
    customerName: customer?.name || session.customer_display_name || '',
    membershipNumber,
    customerMembershipValidUntil,
    membershipPurchaseIntent:
      (session.membership_purchase_intent as 'PURCHASE' | 'RENEW' | null) || undefined,
    kioskAcknowledgedAt: session.kiosk_acknowledged_at ? session.kiosk_acknowledged_at.toISOString() : undefined,
    allowedRentals,
    mode: session.checkin_mode === 'RENEWAL' ? 'RENEWAL' : 'INITIAL',
    status: session.status,
    proposedRentalType: session.proposed_rental_type || undefined,
    proposedBy: (session.proposed_by as 'CUSTOMER' | 'EMPLOYEE' | null) || undefined,
    selectionConfirmed: !!session.selection_confirmed,
    selectionConfirmedBy: (session.selection_confirmed_by as 'CUSTOMER' | 'EMPLOYEE' | null) || undefined,
    customerPrimaryLanguage: (customer?.primary_language as 'EN' | 'ES' | undefined) || undefined,
    customerDobMonthDay,
    customerLastVisitAt,
    customerNotes: customer?.notes || undefined,
    pastDueBalance: pastDueBalance > 0 ? pastDueBalance : undefined,
    pastDueBlocked,
    pastDueBypassed,
    paymentIntentId: paymentIntent?.id,
    paymentStatus: (paymentIntent?.status as 'DUE' | 'PAID' | undefined) || undefined,
    paymentMethod: (paymentIntent?.payment_method as 'CASH' | 'CREDIT' | undefined) || undefined,
    paymentTotal,
    paymentLineItems,
    paymentFailureReason: paymentIntent?.failure_reason || undefined,
    agreementSigned: blockForSession ? !!blockForSession.agreement_signed : false,
    assignedResourceType: assignedResourceType || undefined,
    assignedResourceNumber,
    visitId: blockForSession?.visit_id || activeVisitId,
    waitlistDesiredType: session.waitlist_desired_type || undefined,
    backupRentalType: session.backup_rental_type || undefined,
    blockEndsAt: blockForSession?.ends_at ? blockForSession.ends_at.toISOString() : activeBlockEndsAt,
    checkoutAt: blockForSession?.ends_at ? blockForSession.ends_at.toISOString() : undefined,
  };

  return { laneId, payload };
}

export function parseMembershipNumber(scanValue: string): string | null {
  // Default: extract digits only
  const pattern = process.env.MEMBERSHIP_SCAN_PATTERN || '\\d+';
  const regex = new RegExp(pattern);
  const match = scanValue.match(regex);
  return match ? match[0] : null;
}

export function calculateAge(dob: Date | string | null): number | undefined {
  const d = toDate(dob);
  if (!d) {
    return undefined;
  }
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

export async function computeWaitlistInfo(
  client: PoolClient,
  desiredTier: string
): Promise<{ position: number; estimatedReadyAt: Date | null }> {
  // Count active waitlist entries for this tier (position = count + 1)
  const waitlistCountResult = await client.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM waitlist 
     WHERE desired_tier = $1 AND status = 'ACTIVE'`,
    [desiredTier]
  );
  const position = parseInt(waitlistCountResult.rows[0]?.count || '0', 10) + 1;

  // Find Nth occupied checkin_block where N = position
  // Get blocks that will end and could free up a room of the desired tier
  const blocksResult = await client.query<{
    id: string;
    ends_at: Date;
    room_id: string | null;
  }>(
    `SELECT cb.id, cb.ends_at, cb.room_id
     FROM checkin_blocks cb
     LEFT JOIN rooms r ON cb.room_id = r.id
     WHERE cb.ends_at > NOW()
       AND (cb.room_id IS NOT NULL OR cb.locker_id IS NOT NULL)
     ORDER BY cb.ends_at ASC
     LIMIT $1`,
    [position]
  );

  let estimatedReadyAt: Date | null = null;
  if (blocksResult.rows.length >= position) {
    // Found Nth block - ETA = block end + 15 min buffer
    const nthBlock = blocksResult.rows[position - 1]!;
    estimatedReadyAt = new Date(nthBlock.ends_at.getTime() + 15 * 60 * 1000);
  }

  return { position, estimatedReadyAt };
}

