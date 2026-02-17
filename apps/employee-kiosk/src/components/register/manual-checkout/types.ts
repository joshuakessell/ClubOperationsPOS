export type ManualCheckoutStep = 'select' | 'confirm';

export type ManualCandidate = {
  occupancyId: string;
  resourceType: 'ROOM' | 'LOCKER';
  number: string;
  customerName: string;
  checkinAt: string | Date;
  scheduledCheckoutAt: string | Date;
  isOverdue: boolean;
};

export type ResolveResponse = {
  occupancyId: string;
  resourceType: 'ROOM' | 'LOCKER';
  number: string;
  customerName: string;
  checkinAt: string | Date;
  scheduledCheckoutAt: string | Date;
  lateMinutes: number;
  fee: number;
  banApplied: boolean;
};
