export type RoomKind = 'STANDARD' | 'DOUBLE' | 'SPECIAL';

export const LOCKER_NUMBERS: string[] = Array.from({ length: 108 }, (_, idx) =>
  String(idx + 1).padStart(3, '0')
);

export const EXPECTED_LOCKER_COUNT = 108 as const;
export const EXPECTED_ROOM_COUNT = 55 as const;

// Nominal room range is 200..262 inclusive, but some rooms do NOT exist at all.
export const NONEXISTENT_ROOM_NUMBERS = [
  247, 249, 251, 253, 255, 257, 259, 261,
] as const;

export const DOUBLE_ROOM_NUMBERS = [216, 218, 225, 252, 262] as const;
export const SPECIAL_ROOM_NUMBERS = [201, 232, 256] as const;

const NONEXISTENT_ROOM_SET = new Set<number>(NONEXISTENT_ROOM_NUMBERS);
const DOUBLE_ROOM_SET = new Set<number>(DOUBLE_ROOM_NUMBERS);
const SPECIAL_ROOM_SET = new Set<number>(SPECIAL_ROOM_NUMBERS);

export function isExistingRoomNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 200 && n <= 262 && !NONEXISTENT_ROOM_SET.has(n);
}

export function isDoubleRoom(n: number): boolean {
  return DOUBLE_ROOM_SET.has(n);
}

export function isSpecialRoom(n: number): boolean {
  return SPECIAL_ROOM_SET.has(n);
}

export function getRoomKind(n: number): RoomKind {
  if (!isExistingRoomNumber(n)) {
    throw new Error(`Invalid/non-existent room number: ${n}`);
  }
  if (isSpecialRoom(n)) return 'SPECIAL';
  if (isDoubleRoom(n)) return 'DOUBLE';
  return 'STANDARD';
}

/**
 * Canonical room-number → tier mapping.
 *
 * - Accepts string or number inputs (common across API + UI).
 * - Validates against the facility contract (including NONEXISTENT_ROOM_NUMBERS).
 * - Throws on invalid / non-existent room numbers so callers don't silently drift.
 */
export function getRoomTierFromRoomNumber(roomNumber: string | number): RoomKind {
  const n =
    typeof roomNumber === 'number'
      ? roomNumber
      : (() => {
          const s = String(roomNumber).trim();
          if (!/^\d+$/.test(s)) {
            throw new Error(`Invalid room number (expected digits): ${roomNumber}`);
          }
          return Number(s);
        })();

  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`Invalid room number: ${roomNumber}`);
  }

  return getRoomKind(n);
}

export const ROOM_NUMBERS: number[] = Array.from({ length: 262 - 200 + 1 }, (_, i) => 200 + i).filter(
  isExistingRoomNumber
);

// Convenience set (fast membership checks without re-allocating in callers)
export const ROOM_NUMBER_SET: ReadonlySet<number> = new Set(ROOM_NUMBERS);

export const ROOMS: Array<{ number: number; kind: RoomKind }> = ROOM_NUMBERS.map((n) => ({
  number: n,
  kind: getRoomKind(n),
}));

// ---------------------------------------------------------------------------
// Contract sanity checks (throws at module load time if a constant is wrong)
// ---------------------------------------------------------------------------
if (LOCKER_NUMBERS.length !== EXPECTED_LOCKER_COUNT) {
  throw new Error(`LOCKER_NUMBERS contract mismatch: expected ${EXPECTED_LOCKER_COUNT}, got ${LOCKER_NUMBERS.length}`);
}
if (ROOM_NUMBERS.length !== EXPECTED_ROOM_COUNT) {
  throw new Error(`ROOM_NUMBERS contract mismatch: expected ${EXPECTED_ROOM_COUNT}, got ${ROOM_NUMBERS.length}`);
}
for (const n of DOUBLE_ROOM_NUMBERS) {
  if (!ROOM_NUMBER_SET.has(n)) throw new Error(`DOUBLE_ROOM_NUMBERS contains non-existent room: ${n}`);
  if (SPECIAL_ROOM_SET.has(n)) throw new Error(`Room ${n} cannot be both DOUBLE and SPECIAL`);
}
for (const n of SPECIAL_ROOM_NUMBERS) {
  if (!ROOM_NUMBER_SET.has(n)) throw new Error(`SPECIAL_ROOM_NUMBERS contains non-existent room: ${n}`);
  if (DOUBLE_ROOM_SET.has(n)) throw new Error(`Room ${n} cannot be both SPECIAL and DOUBLE`);
}


