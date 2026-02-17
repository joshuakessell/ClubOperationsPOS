import type { CustomerIdType } from '@club-ops/shared';

export type CustomerProfile = {
  id: string;
  name: string;
  dob: string | null;
  dobMonthDay: string | null;
  membershipNumber: string | null;
  membershipValidUntil: string | null;
  idNumber: string | null;
  idType: CustomerIdType | null;
  idTypeOther: string | null;
  idExpirationDate: string | null;
  preferredLanguage: 'EN' | 'ES' | null;
  lastVisitAt: string | null;
  hasEncryptedLookupMarker: boolean;
};

export type LaneSessionPatch = {
  customerId?: string | null;
  customerName?: string;
  membershipNumber?: string;
  currentSessionId?: string | null;
  mode?: 'CHECKIN' | 'RENEWAL' | null;
  renewalHours?: 2 | 6 | null;
  customerHasEncryptedLookupMarker?: boolean;
  assignedResourceType?: 'room' | 'locker' | null;
  assignedResourceNumber?: string | null;
  checkoutAt?: string | null;
};
