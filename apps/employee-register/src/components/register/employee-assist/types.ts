export type EmployeeAssistStep = 'LANGUAGE' | 'MEMBERSHIP' | 'UPGRADE' | 'RENTAL' | 'DONE';

export type LanguageOption = 'EN' | 'ES';
export type MembershipOption = 'ONE_TIME' | 'SIX_MONTH';
export type RentalOption = 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL';

export type Pending =
  | { step: 'LANGUAGE'; option: LanguageOption }
  | { step: 'MEMBERSHIP'; option: MembershipOption }
  | { step: 'WAITLIST_BACKUP'; option: RentalOption }
  | { step: 'RENTAL'; option: RentalOption };

export type PendingState = Pending | null;

export type RentalButton = {
  id: RentalOption;
  label: string;
  count: number;
  allowed: boolean;
};
