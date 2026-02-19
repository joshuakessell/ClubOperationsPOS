import { isRecord } from '@club-ops/shared';
import type {
  SelectionFlowSetters,
  SelectionInventory,
  WaitlistUnavailableOptions,
} from './types';

function isLockerRental(rental: string) {
  return rental === 'LOCKER' || rental === 'GYM_LOCKER';
}

export function getAvailableCount(
  inventory: SelectionInventory,
  rental: string
): number | undefined {
  return inventory?.rooms?.[rental] ?? (isLockerRental(rental) ? inventory?.lockers : undefined);
}

export function isLanguageRequiredConflict(status: number, payload: unknown): boolean {
  return status === 409 && isRecord(payload) && payload.code === 'LANGUAGE_REQUIRED';
}

export function parseConfirmedBy(payload: unknown): 'CUSTOMER' | 'EMPLOYEE' {
  if (isRecord(payload) && (payload.confirmedBy === 'CUSTOMER' || payload.confirmedBy === 'EMPLOYEE')) {
    return payload.confirmedBy;
  }
  return 'CUSTOMER';
}

function toSortedResourceEntries(value: unknown): Array<{ number: string; status: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is { number: string; status: string } =>
        isRecord(entry) && typeof entry.number === 'string' && typeof entry.status === 'string'
    )
    .sort((a, b) => Number(a.number) - Number(b.number));
}

export function mapWaitlistUnavailableOptions(payload: unknown): WaitlistUnavailableOptions {
  if (!isRecord(payload)) return null;
  if (!isRecord(payload.rooms) || !Array.isArray(payload.lockers)) return null;

  return {
    rooms: {
      SPECIAL: toSortedResourceEntries(payload.rooms.SPECIAL),
      DOUBLE: toSortedResourceEntries(payload.rooms.DOUBLE),
      STANDARD: toSortedResourceEntries(payload.rooms.STANDARD),
    },
    lockers: toSortedResourceEntries(payload.lockers),
  };
}

export function resetWaitlistDraft(
  setters: SelectionFlowSetters,
  options?: { clearHighlightedBackup?: boolean }
) {
  setters.setWaitlistDesiredType(null);
  setters.setWaitlistDesiredTypes([]);
  setters.setWaitlistBackupType(null);
  setters.setWaitlistRequestedResourceNumber(null);
  setters.setWaitlistRequestedResourceType(null);
  setters.setWaitlistUnavailableOptions(null);
  if (options?.clearHighlightedBackup) {
    setters.setHighlightedWaitlistBackup(null);
  }
}
