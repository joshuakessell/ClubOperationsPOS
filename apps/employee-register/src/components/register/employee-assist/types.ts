export type EmployeeAssistStep = 'LANGUAGE' | 'UPGRADE' | 'RENTAL' | 'DONE';

export type LanguageOption = 'EN' | 'ES';
export type MembershipOption = 'ONE_TIME' | 'SIX_MONTH';
export type RentalOption = 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL';

export type Pending =
  | { step: 'LANGUAGE'; option: LanguageOption }
  | { step: 'RENTAL_ADDON'; option: MembershipOption }
  | { step: 'WAITLIST_BACKUP'; option: RentalOption }
  | { step: 'RENTAL'; option: RentalOption };

export type PendingState = Pending | null;

export type RentalButton = {
  id: RentalOption;
  label: string;
  count: number;
  allowed: boolean;
};
