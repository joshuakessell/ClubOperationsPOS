import type {
  CheckinBlockRow,
  CheckoutRequestRow,
  CustomerRow,
  KeyTagRow,
  LockerRow,
  ManualCheckoutCandidateRow,
  ManualResolveRow,
  RoomRow,
  VisitDateRow,
  WaitlistStatusRow,
} from './types.js';

export type DbQuery = <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;

export async function selectManualCheckoutCandidates(dbQuery: DbQuery) {
  const res = await dbQuery<ManualCheckoutCandidateRow>(
    `
    WITH room_candidates AS (
      SELECT DISTINCT ON (cb.room_id)
        cb.id as occupancy_id,
        'ROOM'::text as resource_type,
        r.number as number,
        c.name as customer_name,
        cb.starts_at as checkin_at,
        cb.ends_at as scheduled_checkout_at,
        (cb.ends_at < NOW()) as is_overdue
      FROM checkin_blocks cb
      JOIN visits v ON cb.visit_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN rooms r ON cb.room_id = r.id
      WHERE cb.room_id IS NOT NULL
        AND v.ended_at IS NULL
        AND cb.ends_at <= NOW() + INTERVAL '60 minutes'
      ORDER BY cb.room_id, cb.ends_at DESC
    ),
    locker_candidates AS (
      SELECT DISTINCT ON (cb.locker_id)
        cb.id as occupancy_id,
        'LOCKER'::text as resource_type,
        l.number as number,
        c.name as customer_name,
        cb.starts_at as checkin_at,
        cb.ends_at as scheduled_checkout_at,
        (cb.ends_at < NOW()) as is_overdue
      FROM checkin_blocks cb
      JOIN visits v ON cb.visit_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN lockers l ON cb.locker_id = l.id
      WHERE cb.locker_id IS NOT NULL
        AND v.ended_at IS NULL
        AND cb.ends_at <= NOW() + INTERVAL '60 minutes'
      ORDER BY cb.locker_id, cb.ends_at DESC
    )
    SELECT * FROM room_candidates
    UNION ALL
    SELECT * FROM locker_candidates
    ORDER BY is_overdue DESC, scheduled_checkout_at ASC
    `
  );
  return res.rows;
}

export async function selectLockerIdByNumber(dbQuery: DbQuery, number: string) {
  const res = await dbQuery<{ id: string }>(`SELECT id FROM lockers WHERE number = $1`, [number]);
  return res.rows[0]?.id ?? null;
}

export async function selectRoomIdByNumber(dbQuery: DbQuery, number: string) {
  const res = await dbQuery<{ id: string }>(`SELECT id FROM rooms WHERE number = $1`, [number]);
  return res.rows[0]?.id ?? null;
}

export async function selectManualResolveByOccupancyId(dbQuery: DbQuery, occupancyId: string) {
  const res = await dbQuery<ManualResolveRow>(
    `
    SELECT
      cb.id as occupancy_id,
      cb.visit_id,
      v.customer_id,
      c.name as customer_name,
      cb.starts_at as checkin_at,
      cb.ends_at as scheduled_checkout_at,
      cb.room_id,
      r.number as room_number,
      cb.locker_id,
      l.number as locker_number,
      cb.session_id
    FROM checkin_blocks cb
    JOIN visits v ON cb.visit_id = v.id
    JOIN customers c ON v.customer_id = c.id
    LEFT JOIN rooms r ON cb.room_id = r.id
    LEFT JOIN lockers l ON cb.locker_id = l.id
    WHERE cb.id = $1 AND v.ended_at IS NULL
    `,
    [occupancyId]
  );
  return res.rows[0] ?? null;
}

export async function selectManualResolveLatestByRoomId(dbQuery: DbQuery, roomId: string) {
  const res = await dbQuery<ManualResolveRow>(
    `
    SELECT
      cb.id as occupancy_id,
      cb.visit_id,
      v.customer_id,
      c.name as customer_name,
      cb.starts_at as checkin_at,
      cb.ends_at as scheduled_checkout_at,
      cb.room_id,
      r.number as room_number,
      cb.locker_id,
      l.number as locker_number,
      cb.session_id
    FROM checkin_blocks cb
    JOIN visits v ON cb.visit_id = v.id
    JOIN customers c ON v.customer_id = c.id
    JOIN rooms r ON cb.room_id = r.id
    LEFT JOIN lockers l ON cb.locker_id = l.id
    WHERE cb.room_id = $1 AND v.ended_at IS NULL
    ORDER BY cb.ends_at DESC
    LIMIT 1
    `,
    [roomId]
  );
  return res.rows[0] ?? null;
}

export async function selectManualResolveLatestByLockerId(dbQuery: DbQuery, lockerId: string) {
  const res = await dbQuery<ManualResolveRow>(
    `
    SELECT
      cb.id as occupancy_id,
      cb.visit_id,
      v.customer_id,
      c.name as customer_name,
      cb.starts_at as checkin_at,
      cb.ends_at as scheduled_checkout_at,
      cb.room_id,
      r.number as room_number,
      cb.locker_id,
      l.number as locker_number,
      cb.session_id
    FROM checkin_blocks cb
    JOIN visits v ON cb.visit_id = v.id
    JOIN customers c ON v.customer_id = c.id
    JOIN lockers l ON cb.locker_id = l.id
    LEFT JOIN rooms r ON cb.room_id = r.id
    WHERE cb.locker_id = $1 AND v.ended_at IS NULL
    ORDER BY cb.ends_at DESC
    LIMIT 1
    `,
    [lockerId]
  );
  return res.rows[0] ?? null;
}

export async function selectKeyTagByToken(dbQuery: DbQuery, token: string) {
  const res = await dbQuery<KeyTagRow>(
    `SELECT id, room_id, locker_id, tag_code, is_active
     FROM key_tags
     WHERE tag_code = $1 AND is_active = true`,
    [token]
  );
  return res.rows[0] ?? null;
}

export async function selectLatestActiveBlockByRoomId(dbQuery: DbQuery, roomId: string) {
  const res = await dbQuery<CheckinBlockRow>(
    `SELECT cb.id, cb.visit_id, cb.block_type, cb.starts_at, cb.ends_at,
            cb.rental_type::text as rental_type, cb.room_id, cb.locker_id, cb.session_id, cb.has_tv_remote
     FROM checkin_blocks cb
     JOIN visits v ON cb.visit_id = v.id
     WHERE cb.room_id = $1 AND v.ended_at IS NULL
     ORDER BY cb.ends_at DESC
     LIMIT 1`,
    [roomId]
  );
  return res.rows[0] ?? null;
}

export async function selectLatestActiveBlockByLockerId(dbQuery: DbQuery, lockerId: string) {
  const res = await dbQuery<CheckinBlockRow>(
    `SELECT cb.id, cb.visit_id, cb.block_type, cb.starts_at, cb.ends_at,
            cb.rental_type::text as rental_type, cb.room_id, cb.locker_id, cb.session_id, cb.has_tv_remote
     FROM checkin_blocks cb
     JOIN visits v ON cb.visit_id = v.id
     WHERE cb.locker_id = $1 AND v.ended_at IS NULL
     ORDER BY cb.ends_at DESC
     LIMIT 1`,
    [lockerId]
  );
  return res.rows[0] ?? null;
}

export async function selectVisitCustomerId(dbQuery: DbQuery, visitId: string) {
  const res = await dbQuery<{ customer_id: string }>('SELECT customer_id FROM visits WHERE id = $1', [
    visitId,
  ]);
  return res.rows[0]?.customer_id ?? null;
}

export async function selectCustomerForCheckout(dbQuery: DbQuery, customerId: string) {
  const res = await dbQuery<CustomerRow>(
    'SELECT id, name, membership_number, banned_until FROM customers WHERE id = $1',
    [customerId]
  );
  return res.rows[0] ?? null;
}

export async function selectRoomForCheckout(dbQuery: DbQuery, roomId: string) {
  const res = await dbQuery<RoomRow>('SELECT id, number, type FROM rooms WHERE id = $1', [roomId]);
  return res.rows[0] ?? null;
}

export async function selectLockerForCheckout(dbQuery: DbQuery, lockerId: string) {
  const res = await dbQuery<LockerRow>('SELECT id, number FROM lockers WHERE id = $1', [lockerId]);
  return res.rows[0] ?? null;
}

export async function selectActiveBlockById(dbQuery: DbQuery, occupancyId: string) {
  const res = await dbQuery<CheckinBlockRow & { customer_id: string }>(
    `SELECT cb.id, cb.visit_id, cb.block_type, cb.starts_at, cb.ends_at,
            cb.rental_type::text as rental_type, cb.room_id, cb.locker_id, cb.session_id, cb.has_tv_remote,
            v.customer_id
     FROM checkin_blocks cb
     JOIN visits v ON cb.visit_id = v.id
     WHERE cb.id = $1 AND v.ended_at IS NULL`,
    [occupancyId]
  );
  return res.rows[0] ?? null;
}

export async function selectBlockById(dbQuery: DbQuery, occupancyId: string) {
  const res = await dbQuery<CheckinBlockRow & { customer_id: string }>(
    `SELECT cb.id, cb.visit_id, cb.block_type, cb.starts_at, cb.ends_at,
            cb.rental_type::text as rental_type, cb.room_id, cb.locker_id, cb.session_id, cb.has_tv_remote,
            v.customer_id
     FROM checkin_blocks cb
     JOIN visits v ON cb.visit_id = v.id
     WHERE cb.id = $1`,
    [occupancyId]
  );
  return res.rows[0] ?? null;
}

export async function selectExistingActiveCheckoutRequestForOccupancy(
  dbQuery: DbQuery,
  occupancyId: string
) {
  const res = await dbQuery<{ id: string }>(
    `SELECT id FROM checkout_requests
     WHERE occupancy_id = $1 AND status IN ('SUBMITTED', 'CLAIMED')`,
    [occupancyId]
  );
  return res.rows[0]?.id ?? null;
}

export async function selectActiveKeyTagIdForRoom(dbQuery: DbQuery, roomId: string) {
  const res = await dbQuery<{ id: string }>(
    `SELECT id FROM key_tags WHERE room_id = $1 AND is_active = true LIMIT 1`,
    [roomId]
  );
  return res.rows[0]?.id ?? null;
}

export async function selectActiveKeyTagIdForLocker(dbQuery: DbQuery, lockerId: string) {
  const res = await dbQuery<{ id: string }>(
    `SELECT id FROM key_tags WHERE locker_id = $1 AND is_active = true LIMIT 1`,
    [lockerId]
  );
  return res.rows[0]?.id ?? null;
}

export async function insertCheckoutRequest(
  dbQuery: DbQuery,
  input: {
    occupancyId: string;
    customerId: string;
    keyTagId: string | null;
    kioskDeviceId: string;
    customerChecklistJson: unknown;
    lateMinutes: number;
    lateFeeAmount: number;
    banApplied: boolean;
  }
) {
  const res = await dbQuery<CheckoutRequestRow>(
    `INSERT INTO checkout_requests (
      occupancy_id, customer_id, key_tag_id, kiosk_device_id,
      customer_checklist_json, late_minutes, late_fee_amount, ban_applied
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, occupancy_id, customer_id, key_tag_id, kiosk_device_id,
              created_at, claimed_by_staff_id, claimed_at, claim_expires_at,
              customer_checklist_json, status, late_minutes, late_fee_amount,
              ban_applied, items_confirmed, fee_paid, completed_at`,
    [
      input.occupancyId,
      input.customerId,
      input.keyTagId,
      input.kioskDeviceId,
      JSON.stringify(input.customerChecklistJson),
      input.lateMinutes,
      input.lateFeeAmount,
      input.banApplied,
    ]
  );
  return res.rows[0]!;
}

export async function selectCheckoutRequestForUpdate(dbQuery: DbQuery, requestId: string) {
  const res = await dbQuery<CheckoutRequestRow>(
    `SELECT id, occupancy_id, customer_id, key_tag_id, kiosk_device_id,
            created_at, claimed_by_staff_id, claimed_at, claim_expires_at,
            customer_checklist_json, status, late_minutes, late_fee_amount,
            ban_applied, items_confirmed, fee_paid, completed_at
     FROM checkout_requests
     WHERE id = $1 FOR UPDATE`,
    [requestId]
  );
  return res.rows[0] ?? null;
}

export async function updateCheckoutRequestClaim(
  dbQuery: DbQuery,
  input: { requestId: string; staffId: string; claimedAt: Date; claimExpiresAt: Date }
) {
  const res = await dbQuery<CheckoutRequestRow>(
    `UPDATE checkout_requests
     SET claimed_by_staff_id = $1, claimed_at = $2, claim_expires_at = $3, status = 'CLAIMED', updated_at = NOW()
     WHERE id = $4
     RETURNING id, occupancy_id, customer_id, key_tag_id, kiosk_device_id,
               created_at, claimed_by_staff_id, claimed_at, claim_expires_at,
               customer_checklist_json, status, late_minutes, late_fee_amount,
               ban_applied, items_confirmed, fee_paid, completed_at`,
    [input.staffId, input.claimedAt, input.claimExpiresAt, input.requestId]
  );
  return res.rows[0]!;
}

export async function selectCheckoutRequestOwnership(dbQuery: DbQuery, requestId: string) {
  const res = await dbQuery<Pick<CheckoutRequestRow, 'id' | 'claimed_by_staff_id' | 'status' | 'fee_paid' | 'items_confirmed'>>(
    `SELECT id, claimed_by_staff_id, status, fee_paid, items_confirmed
     FROM checkout_requests
     WHERE id = $1`,
    [requestId]
  );
  return res.rows[0] ?? null;
}

export async function updateCheckoutRequestFeePaid(dbQuery: DbQuery, requestId: string) {
  const res = await dbQuery<Pick<CheckoutRequestRow, 'id' | 'items_confirmed' | 'fee_paid'>>(
    `UPDATE checkout_requests
     SET fee_paid = true, updated_at = NOW()
     WHERE id = $1
     RETURNING id, items_confirmed, fee_paid`,
    [requestId]
  );
  return res.rows[0]!;
}

export async function updateCheckoutRequestItemsConfirmed(dbQuery: DbQuery, requestId: string) {
  const res = await dbQuery<Pick<CheckoutRequestRow, 'id' | 'items_confirmed' | 'fee_paid'>>(
    `UPDATE checkout_requests
     SET items_confirmed = true, updated_at = NOW()
     WHERE id = $1
     RETURNING id, items_confirmed, fee_paid`,
    [requestId]
  );
  return res.rows[0]!;
}

export async function selectWaitlistActiveForUpdate(dbQuery: DbQuery, visitId: string) {
  const res = await dbQuery<WaitlistStatusRow>(
    `SELECT id, status
     FROM waitlist
     WHERE visit_id = $1 AND status IN ('ACTIVE','OFFERED')
     FOR UPDATE`,
    [visitId]
  );
  return res.rows;
}

export async function cancelWaitlistEntries(dbQuery: DbQuery, waitlistIds: string[]) {
  await dbQuery(
    `UPDATE waitlist
     SET status = 'CANCELLED',
         cancelled_at = NOW(),
         cancelled_by_staff_id = NULL,
         updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [waitlistIds]
  );
}

export async function insertAuditWaitlistCancelled(
  dbQuery: DbQuery,
  input: { staffId: string | null; waitlistId: string; oldStatus: string }
) {
  await dbQuery(
    `INSERT INTO audit_log
     (staff_id, action, entity_type, entity_id, old_value, new_value)
     VALUES ($1, 'WAITLIST_CANCELLED', 'waitlist', $2, $3, $4)`,
    [
      input.staffId,
      input.waitlistId,
      JSON.stringify({ status: input.oldStatus }),
      JSON.stringify({ status: 'CANCELLED', reason: 'CHECKED_OUT' }),
    ]
  );
}

export async function updateRoomToDirtyAndUnassign(dbQuery: DbQuery, roomId: string, dirtyStatus: string) {
  await dbQuery(
    `UPDATE rooms SET status = $1, assigned_to_customer_id = NULL, updated_at = NOW() WHERE id = $2`,
    [dirtyStatus, roomId]
  );
}

export async function updateLockerToCleanAndUnassign(dbQuery: DbQuery, lockerId: string, cleanStatus: string) {
  await dbQuery(
    `UPDATE lockers SET status = $1, assigned_to_customer_id = NULL, updated_at = NOW() WHERE id = $2`,
    [cleanStatus, lockerId]
  );
}

export async function endVisit(dbQuery: DbQuery, visitId: string) {
  await dbQuery(`UPDATE visits SET ended_at = NOW(), updated_at = NOW() WHERE id = $1`, [visitId]);
}

export async function completeLegacySessionIfPresent(dbQuery: DbQuery, sessionId: string) {
  await dbQuery(`UPDATE sessions SET status = 'COMPLETED', check_out_time = NOW(), updated_at = NOW() WHERE id = $1`, [
    sessionId,
  ]);
}

export async function applyCustomerBan(dbQuery: DbQuery, customerId: string, banUntil: Date) {
  await dbQuery(`UPDATE customers SET banned_until = $1, updated_at = NOW() WHERE id = $2`, [
    banUntil,
    customerId,
  ]);
}

export async function incrementCustomerPastDue(dbQuery: DbQuery, customerId: string, feeAmount: number) {
  await dbQuery(
    `UPDATE customers
     SET past_due_balance = past_due_balance + $1,
         updated_at = NOW()
     WHERE id = $2`,
    [feeAmount, customerId]
  );
}

export async function selectExistingLateFeeChargeId(dbQuery: DbQuery, checkinBlockId: string) {
  const res = await dbQuery<{ id: string }>(
    `SELECT id FROM charges WHERE checkin_block_id = $1 AND type = 'LATE_FEE' LIMIT 1`,
    [checkinBlockId]
  );
  return res.rows[0]?.id ?? null;
}

export async function insertLateFeeCharge(
  dbQuery: DbQuery,
  input: { visitId: string; checkinBlockId: string; amount: number }
) {
  await dbQuery(
    `INSERT INTO charges (visit_id, checkin_block_id, type, amount, payment_intent_id)
     VALUES ($1, $2, 'LATE_FEE', $3, NULL)`,
    [input.visitId, input.checkinBlockId, input.amount]
  );
}

export async function selectVisitStartedAt(dbQuery: DbQuery, visitId: string) {
  const res = await dbQuery<VisitDateRow>(`SELECT started_at FROM visits WHERE id = $1 LIMIT 1`, [visitId]);
  return res.rows[0]?.started_at ?? null;
}

export async function appendCustomerNote(dbQuery: DbQuery, customerId: string, noteLine: string) {
  await dbQuery(
    `UPDATE customers
     SET notes = CASE
       WHEN notes IS NULL OR notes = '' THEN $1
       ELSE notes || E'\\n' || $1
     END,
     updated_at = NOW()
     WHERE id = $2`,
    [noteLine, customerId]
  );
}

export async function insertLateCheckoutEvent(
  dbQuery: DbQuery,
  input: {
    customerId: string;
    occupancyId: string;
    checkoutRequestId: string | null;
    lateMinutes: number;
    feeAmount: number;
    banApplied: boolean;
  }
) {
  await dbQuery(
    `INSERT INTO late_checkout_events (customer_id, occupancy_id, checkout_request_id, late_minutes, fee_amount, ban_applied)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.customerId,
      input.occupancyId,
      input.checkoutRequestId,
      input.lateMinutes,
      input.feeAmount,
      input.banApplied,
    ]
  );
}

export async function markCheckoutRequestVerified(dbQuery: DbQuery, requestId: string, completedAt: Date) {
  await dbQuery(
    `UPDATE checkout_requests
     SET status = 'VERIFIED', completed_at = $1, updated_at = NOW()
     WHERE id = $2`,
    [completedAt, requestId]
  );
}

export async function selectManualResolveForUpdateOfVisit(dbQuery: DbQuery, occupancyId: string) {
  const res = await dbQuery<ManualResolveRow & { visit_ended_at: Date | null }>(
    `
    SELECT
      cb.id as occupancy_id,
      cb.visit_id,
      v.customer_id,
      c.name as customer_name,
      cb.starts_at as checkin_at,
      cb.ends_at as scheduled_checkout_at,
      cb.room_id,
      r.number as room_number,
      cb.locker_id,
      l.number as locker_number,
      cb.session_id,
      v.ended_at as visit_ended_at
    FROM checkin_blocks cb
    JOIN visits v ON cb.visit_id = v.id
    JOIN customers c ON v.customer_id = c.id
    LEFT JOIN rooms r ON cb.room_id = r.id
    LEFT JOIN lockers l ON cb.locker_id = l.id
    WHERE cb.id = $1
    FOR UPDATE OF v
    `,
    [occupancyId]
  );
  return res.rows[0] ?? null;
}

