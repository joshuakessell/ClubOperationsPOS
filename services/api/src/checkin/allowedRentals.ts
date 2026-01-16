/**
 * Allowed rentals logic (shared across API endpoints).
 *
 * Eligibility is determined by configurable numeric ranges in GYM_LOCKER_ELIGIBLE_RANGES.
 * Format: "1000-1999,5000-5999" (comma-separated ranges)
 */

export function isGymLockerEligible(membershipNumber: string | null | undefined): boolean {
  if (!membershipNumber) return false;

  const rangesEnv = process.env.GYM_LOCKER_ELIGIBLE_RANGES || '';
  if (!rangesEnv.trim()) return false;

  const membershipNum = parseInt(membershipNumber, 10);
  if (Number.isNaN(membershipNum)) return false;

  const ranges = rangesEnv
    .split(',')
    .map((range) => range.trim())
    .filter(Boolean);

  for (const range of ranges) {
    const [startStr, endStr] = range.split('-').map((s) => s.trim());
    const start = parseInt(startStr || '', 10);
    const end = parseInt(endStr || '', 10);
    if (!Number.isNaN(start) && !Number.isNaN(end) && membershipNum >= start && membershipNum <= end) {
      return true;
    }
  }

  return false;
}

export function getAllowedRentals(membershipNumber: string | null | undefined): string[] {
  // Keep this list consistent with client expectations (kiosk/register tier UI).
  const allowed: string[] = ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'];
  if (isGymLockerEligible(membershipNumber)) {
    allowed.push('GYM_LOCKER');
  }
  return allowed;
}

