/**
 * Room status representing the cleaning state.
 * Normal flow: DIRTY → CLEANING → CLEAN
 * Skipping steps requires explicit override.
 */
export enum RoomStatus {
  DIRTY = 'DIRTY',
  CLEANING = 'CLEANING',
  CLEAN = 'CLEAN',
}

/**
 * Type of room available at the club.
 */
export enum RoomType {
  STANDARD = 'STANDARD',
  DELUXE = 'DELUXE',
  VIP = 'VIP',
  LOCKER = 'LOCKER',
}

/**
 * Type of check-in block within a visit.
 */
export enum BlockType {
  INITIAL = 'INITIAL',
  RENEWAL = 'RENEWAL',
  FINAL2H = 'FINAL2H',
}

/**
 * Check-in mode: Initial check-in or Renewal.
 */
export enum CheckinMode {
  INITIAL = 'INITIAL',
  RENEWAL = 'RENEWAL',
}

