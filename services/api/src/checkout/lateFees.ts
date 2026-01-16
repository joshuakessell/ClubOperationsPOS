/**
 * Calculate late fee and ban status based on minutes late.
 */
export function calculateLateFee(lateMinutes: number): { feeAmount: number; banApplied: boolean } {
  // In demo mode, suppress late fees/bans to keep flows lightweight
  if (process.env.DEMO_MODE === 'true') {
    return { feeAmount: 0, banApplied: false };
  }
  if (lateMinutes < 30) {
    return { feeAmount: 0, banApplied: false };
  } else if (lateMinutes < 60) {
    return { feeAmount: 15, banApplied: false };
  } else if (lateMinutes < 90) {
    return { feeAmount: 35, banApplied: false };
  } else {
    return { feeAmount: 35, banApplied: true };
  }
}

export function computeLateMinutes(now: Date, scheduledCheckoutAt: Date): number {
  return Math.max(0, Math.floor((now.getTime() - scheduledCheckoutAt.getTime()) / (1000 * 60)));
}

