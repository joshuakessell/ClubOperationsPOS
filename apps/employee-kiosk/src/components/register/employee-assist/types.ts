export type EmployeeAssistStep = 'UPGRADE' | 'RENTAL' | 'PAYMENT' | 'AGREEMENT' | 'DONE';

export type LanguageOption = 'EN' | 'ES';
export type MembershipOption = 'ONE_TIME' | 'SIX_MONTH';
export type RentalOption = 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL';

export type Pending =
  | { step: 'RENTAL_ADDON'; option: MembershipOption }
  | { step: 'WAITLIST_BACKUP'; option: RentalOption }
  | { step: 'WAITLIST_JOIN'; option: RentalOption }
  | { step: 'RENTAL'; option: RentalOption };

export type PendingState = Pending | null;

export type RentalButton = {
  id: RentalOption;
  label: string;
  count: number;
  allowed: boolean;
};

export type WaitlistUnavailableOptions = {
  rooms: Record<'SPECIAL' | 'DOUBLE' | 'STANDARD', Array<{ number: string; status: string }>>;
  lockers: Array<{ number: string; status: string }>;
} | null;
