import { randomUUID } from 'crypto';

export type DbClient = {
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export type DemoCustomer = {
  id: string;
  name: string;
  membership_number: string | null;
  dob: Date | null;
};

export type DemoLocker = { id: string; number: number };
export type DemoRoom = { id: string; number: string; type: string };
export type DemoStaff = { id: string; name: string };
export type DemoRegisterSession = {
  id: string;
  register_number: number;
  employee_id: string;
  device_id: string;
};

export type DemoAgreement = {
  id: string;
  version: string;
  title: string;
  body_text: string;
};

function seededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rng: () => number, items: Array<{ item: T; weight: number }>): T {
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  const roll = rng() * total;
  let acc = 0;
  for (const it of items) {
    acc += it.weight;
    if (roll <= acc) return it.item;
  }
  return items[items.length - 1]!.item;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function floorTo15Min(d: Date): Date {
  const ms = d.getTime();
  const rounded = Math.floor(ms / (15 * 60 * 1000)) * 15 * 60 * 1000;
  return new Date(rounded);
}

function ceilTo15Min(d: Date): Date {
  const ms = d.getTime();
  const rounded = Math.ceil(ms / (15 * 60 * 1000)) * 15 * 60 * 1000;
  return new Date(rounded);
}

function hourOf(d: Date): number {
  return d.getHours();
}

function isFridayOrSaturdayPeak(d: Date): boolean {
  const day = d.getDay(); // 0=Sun..6=Sat
  const hour = hourOf(d);
  const isFriNight = day === 5 && hour >= 20;
  const isSatEarly = day === 6 && hour <= 4;
  const isSatNight = day === 6 && hour >= 20;
  const isSunEarly = day === 0 && hour <= 4;
  return isFriNight || isSatEarly || isSatNight || isSunEarly;
}

function visitStartRatePerHour(d: Date): number {
  if (isFridayOrSaturdayPeak(d)) return 36;
  const hour = hourOf(d);
  if (hour >= 12 && hour <= 16) return 10;
  if (hour >= 17 && hour <= 19) return 18;
  if (hour >= 20 && hour <= 23) return 22;
  if (hour >= 0 && hour <= 3) return 14;
  return 6;
}

function samplePoisson(rng: () => number, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function sampleStayMinutes(rng: () => number): number {
  return pickWeighted(rng, [
    { item: 120, weight: 0.06 },
    { item: 240, weight: 0.18 },
    { item: 360, weight: 0.62 },
    { item: 480, weight: 0.1 },
    { item: 720, weight: 0.04 },
  ]);
}

function sampleCheckoutDeltaMinutes(rng: () => number): number {
  return pickWeighted(rng, [
    { item: 0, weight: 0.55 },
    { item: 5, weight: 0.18 },
    { item: 10, weight: 0.1 },
    { item: 30, weight: 0.07 },
    { item: 60, weight: 0.04 },
    { item: 120, weight: 0.02 },
    { item: -5, weight: 0.02 },
    { item: -15, weight: 0.01 },
    { item: -30, weight: 0.01 },
  ]);
}

function currencyUSD() {
  return 'USD';
}

export async function appendIncrementalDemoSimulation(params: {
  client: DbClient;
  from: Date;
  to: Date;
  agreement: DemoAgreement;
  customers: DemoCustomer[];
  lockers: DemoLocker[];
  rooms: DemoRoom[];
  staff: DemoStaff[];
  registerSessions: DemoRegisterSession[];
}): Promise<{ visitsCreated: number }>
{
  const windowMs = params.to.getTime() - params.from.getTime();
  if (windowMs <= 0) return { visitsCreated: 0 };

  const rngSeed = Math.floor(params.from.getTime() / 60000) ^ Math.floor(windowMs / 60000);
  const rng = seededRng(rngSeed);

  const intervalMs = 60 * 60 * 1000;
  const intervals = Math.max(1, Math.ceil(windowMs / intervalMs));
  const maxVisits = Math.min(900, intervals * 70);

  const useLockers = params.lockers.length > 0;

  let customerIndex = 0;
  let lockerIndex = 0;
  let roomIndex = 0;
  let created = 0;

  const checkoutEvents: Array<{
    occurredAt: Date;
    customer: DemoCustomer;
    visitId: string;
    checkinBlockId: string;
    rentalType: string;
    roomId: string | null;
    lockerId: string | null;
    staffId: string;
    staffName: string;
  }> = [];

  const cleaningEvents: Array<{ roomId: string; startedAt: Date; completedAt: Date; staffId: string }> = [];

  const anonOrders: Array<{ createdAt: Date; staffId: string; registerSessionId: string }> = [];
  const customerOrders: Array<{
    createdAt: Date;
    staffId: string;
    registerSessionId: string;
    customerId: string;
  }> = [];

  for (let i = 0; i < intervals && created < maxVisits; i += 1) {
    const slotStart = new Date(params.from.getTime() + i * intervalMs);
    const slotEnd = new Date(Math.min(slotStart.getTime() + intervalMs, params.to.getTime()));

    const slotLambda = visitStartRatePerHour(slotStart);
    const visitsInSlot = clamp(samplePoisson(rng, slotLambda), 0, 70);

    for (let j = 0; j < visitsInSlot && created < maxVisits; j += 1) {
      const offsetMs = Math.floor(rng() * Math.max(1, slotEnd.getTime() - slotStart.getTime()));
      let start = new Date(slotStart.getTime() + offsetMs);
      if (start > params.to) continue;
      start = floorTo15Min(start);

      const stayMinutes = sampleStayMinutes(rng);
      const scheduledEnd = ceilTo15Min(new Date(start.getTime() + stayMinutes * 60 * 1000));
      if (scheduledEnd <= start) continue;

      const checkoutDeltaMinutes = sampleCheckoutDeltaMinutes(rng);
      const end = new Date(scheduledEnd.getTime() - checkoutDeltaMinutes * 60 * 1000);
      if (end <= start) continue;
      if (end > params.to) continue;

      const customer = params.customers[customerIndex++ % params.customers.length]!;
      const register = params.registerSessions[(customerIndex + j) % params.registerSessions.length]!;
      const staffMember = params.staff.find((s) => s.id === register.employee_id) ?? params.staff[0]!;

      const visitId = randomUUID();
      const checkinBlockId = randomUUID();

      let lockerId: string | null = null;
      let roomId: string | null = null;
      let rentalType = 'LOCKER';

      const preferLocker = useLockers && rng() < 0.62;
      if (preferLocker) {
        const locker = params.lockers[lockerIndex++ % params.lockers.length]!;
        lockerId = locker.id;
        rentalType = 'LOCKER';
      } else if (params.rooms.length > 0) {
        const room = params.rooms[roomIndex++ % params.rooms.length]!;
        roomId = room.id;
        rentalType =
          room.type === 'DOUBLE' || room.type === 'SPECIAL' || room.type === 'STANDARD'
            ? room.type
            : 'STANDARD';
      } else if (useLockers) {
        const locker = params.lockers[lockerIndex++ % params.lockers.length]!;
        lockerId = locker.id;
        rentalType = 'LOCKER';
      }

      await params.client.query(
        `INSERT INTO visits (id, started_at, ended_at, customer_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [visitId, start, end, customer.id]
      );

      const signedAt = new Date(start.getTime() + 3 * 60 * 1000);
      await params.client.query(
        `INSERT INTO checkin_blocks
         (id, visit_id, block_type, starts_at, ends_at, locker_id, room_id,
          agreement_signed, agreement_signed_at, rental_type)
         VALUES ($1, $2, 'INITIAL', $3, $4, $5, $6, true, $7, $8)`,
        [checkinBlockId, visitId, start, scheduledEnd, lockerId, roomId, signedAt, rentalType]
      );

      await params.client.query(
        `
        INSERT INTO customer_activity_events
          (occurred_at, customer_id, action_type, action_category, source_app,
           actor_type, actor_staff_id, actor_staff_name, summary, metadata, search_blob, dedupe_key)
        VALUES
          ($1, $2::uuid, $3, $4, $5, $6, $7::uuid, $8, $9, $10::jsonb, $11, $12)
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        `,
        [
          start,
          customer.id,
          'CHECKIN_COMPLETED',
          'CHECKIN',
          'EMPLOYEE_REGISTER',
          'STAFF',
          staffMember.id,
          staffMember.name,
          `Checked in`,
          {
            visitId,
            checkinBlockId,
            rentalType,
            registerNumber: register.register_number,
            registerSessionId: register.id,
          },
          `Checked in ${customer.name} ${rentalType} ${visitId} ${checkinBlockId} ${staffMember.name}`,
          `ACT:DEMO:CHECKIN_COMPLETED:${checkinBlockId}`,
        ]
      );

      checkoutEvents.push({
        occurredAt: end,
        customer,
        visitId,
        checkinBlockId,
        rentalType,
        roomId,
        lockerId,
        staffId: staffMember.id,
        staffName: staffMember.name,
      });

      if (rng() < 0.24) {
        customerOrders.push({
          createdAt: new Date(start.getTime() + (10 + Math.floor(rng() * 30)) * 60 * 1000),
          staffId: staffMember.id,
          registerSessionId: register.id,
          customerId: customer.id,
        });
      }

      if (rng() < 0.55) {
        anonOrders.push({
          createdAt: new Date(start.getTime() + (45 + Math.floor(rng() * 120)) * 60 * 1000),
          staffId: staffMember.id,
          registerSessionId: register.id,
        });
      }

      if (roomId) {
        const cleaningStart = new Date(end.getTime() + 5 * 60 * 1000);
        const cleaningDone = new Date(cleaningStart.getTime() + 10 * 60 * 1000);
        const cleaner = params.staff[(roomIndex + j) % params.staff.length]!;
        cleaningEvents.push({ roomId, startedAt: cleaningStart, completedAt: cleaningDone, staffId: cleaner.id });
      }

      await params.client.query(
        `INSERT INTO agreement_signatures
         (id, agreement_id, customer_name, membership_number, signed_at,
          agreement_text_snapshot, agreement_version, checkin_block_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          params.agreement.id,
          customer.name,
          customer.membership_number,
          signedAt,
          params.agreement.body_text,
          params.agreement.version,
          checkinBlockId,
        ]
      );

      created += 1;
    }
  }

  for (const ev of checkoutEvents) {
    if (ev.occurredAt > params.to) continue;

    await params.client.query(
      `
      INSERT INTO customer_activity_events
        (occurred_at, customer_id, action_type, action_category, source_app,
         actor_type, actor_staff_id, actor_staff_name, summary, metadata, search_blob, dedupe_key)
      VALUES
        ($1, $2::uuid, $3, $4, $5, $6, $7::uuid, $8, $9, $10::jsonb, $11, $12)
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
      `,
      [
        ev.occurredAt,
        ev.customer.id,
        'CHECKOUT_COMPLETED',
        'CHECKOUT',
        'EMPLOYEE_REGISTER',
        'STAFF',
        ev.staffId,
        ev.staffName,
        `Checked out`,
        { visitId: ev.visitId, checkinBlockId: ev.checkinBlockId, rentalType: ev.rentalType },
        `Checked out ${ev.customer.name} ${ev.visitId} ${ev.checkinBlockId} ${ev.staffName}`,
        `ACT:DEMO:CHECKOUT_COMPLETED:${ev.visitId}`,
      ]
    );

    if (rng() < 0.06) {
      await params.client.query(
        `INSERT INTO customer_notes
           (id, customer_id, created_at, created_by_staff_id, created_by_staff_name, source_app, note, is_important)
         VALUES ($1, $2::uuid, $3, $4::uuid, $5, 'EMPLOYEE_REGISTER', $6, true)`,
        [
          randomUUID(),
          ev.customer.id,
          new Date(ev.occurredAt.getTime() + 2 * 60 * 1000),
          ev.staffId,
          ev.staffName,
          `Late checkout noted. Please remind customer to check out on time.`,
        ]
      );
    }
  }

  for (const ce of cleaningEvents) {
    if (ce.completedAt > params.to) continue;
    const eventId1 = randomUUID();
    const eventId2 = randomUUID();
    await params.client.query(
      `INSERT INTO cleaning_events
         (id, room_id, staff_id, started_at, completed_at, from_status, to_status, override_flag, device_id, created_at)
       VALUES
         ($1, $2::uuid, $3::uuid, $4, NULL, 'DIRTY', 'CLEANING', false, 'demo-cleaning', $4),
         ($5, $2::uuid, $3::uuid, $4, $6, 'CLEANING', 'CLEAN', false, 'demo-cleaning', $6)
      `,
      [eventId1, ce.roomId, ce.staffId, ce.startedAt, eventId2, ce.completedAt]
    );
  }

  async function insertOrder(order: {
    createdAt: Date;
    registerSessionId: string;
    staffId: string;
    customerId: string | null;
    seed: number;
  }) {
    const rng2 = rng;
    const subtotalCents = 500 + Math.floor(rng2() * 3500);
    const taxCents = Math.floor(subtotalCents * 0.0825);
    const tipCents = rng2() < 0.12 ? 200 + Math.floor(rng2() * 700) : 0;
    const totalCents = subtotalCents + taxCents + tipCents;
    const orderId = randomUUID();

    await params.client.query(
      `INSERT INTO orders
         (id, customer_id, register_session_id, created_by_staff_id, created_at, status,
          subtotal_cents, discount_cents, tax_cents, tip_cents, total_cents, currency, metadata_json)
       VALUES ($1, $2, $3, $4, $5, 'PAID', $6, 0, $7, $8, $9, $10, $11)`,
      [
        orderId,
        order.customerId,
        order.registerSessionId,
        order.staffId,
        order.createdAt,
        subtotalCents,
        taxCents,
        tipCents,
        totalCents,
        currencyUSD(),
        { tender: { paymentMethod: rng2() < 0.33 ? 'CASH' : 'CREDIT', source: 'DEMO_SIM' } },
      ]
    );

    const itemId = randomUUID();
    const name = rng2() < 0.4 ? 'Water' : rng2() < 0.7 ? 'Energy Drink' : 'Towel';
    const sku = name.toUpperCase().replace(/\s+/g, '_');
    const unitPrice = Math.max(200, Math.floor(subtotalCents / 2));
    const qty = 1 + (rng2() < 0.15 ? 1 : 0);
    const lineTotal = unitPrice * qty;

    await params.client.query(
      `INSERT INTO order_line_items
         (id, order_id, kind, sku, name, quantity, unit_price_cents, discount_cents, tax_cents, total_cents, metadata_json)
       VALUES ($1, $2, 'RETAIL', $3, $4, $5, $6, 0, 0, $7, NULL)`,
      [itemId, orderId, sku, name, qty, unitPrice, lineTotal]
    );

    const receiptId = randomUUID();
    const receiptNumber = `D${order.createdAt.getUTCFullYear()}-${String(order.seed).padStart(6, '0')}`;
    const issuedAt = new Date(order.createdAt.getTime() + 2 * 60 * 1000);
    await params.client.query(
      `INSERT INTO receipts (id, order_id, issued_at, receipt_number, receipt_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        receiptId,
        orderId,
        issuedAt,
        receiptNumber,
        {
          receiptNumber,
          orderId,
          issuedAt: issuedAt.toISOString(),
          currency: currencyUSD(),
          totals: { subtotalCents, taxCents, tipCents, totalCents },
          lineItems: [
            {
              id: itemId,
              kind: 'RETAIL',
              sku,
              name,
              quantity: qty,
              unitPriceCents: unitPrice,
              totalCents: lineTotal,
            },
          ],
        },
      ]
    );

    if (order.customerId) {
      await params.client.query(
        `
        INSERT INTO customer_activity_events
          (occurred_at, customer_id, action_type, action_category, source_app,
           actor_type, actor_staff_id, actor_staff_name, summary, metadata, search_blob, dedupe_key)
        VALUES
          ($1, $2::uuid, 'ORDER_PAID', 'PURCHASE', 'EMPLOYEE_REGISTER', 'STAFF', $3::uuid, $4,
           $5, $6::jsonb, $7, $8)
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        `,
        [
          order.createdAt,
          order.customerId,
          order.staffId,
          order.staffId,
          `Order paid`,
          { orderId, totalCents, currency: currencyUSD() },
          `Order paid ${orderId} ${totalCents}`,
          `ACT:DEMO:ORDER_PAID:${orderId}`,
        ]
      );
    }
  }

  let orderSeed = Math.floor(params.from.getTime() / 60000) % 100000;
  for (const o of anonOrders) {
    orderSeed += 1;
    if (o.createdAt > params.to) continue;
    await insertOrder({
      createdAt: o.createdAt,
      registerSessionId: o.registerSessionId,
      staffId: o.staffId,
      customerId: null,
      seed: orderSeed,
    });
  }
  for (const o of customerOrders) {
    orderSeed += 1;
    if (o.createdAt > params.to) continue;
    await insertOrder({
      createdAt: o.createdAt,
      registerSessionId: o.registerSessionId,
      staffId: o.staffId,
      customerId: o.customerId,
      seed: orderSeed,
    });
  }

  return { visitsCreated: created };
}
