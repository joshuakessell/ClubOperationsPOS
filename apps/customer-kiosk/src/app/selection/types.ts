import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { CustomerConfirmationRequiredPayload } from '@club-ops/shared';
import type { SessionState } from '../../utils/membership';
import type { KioskNotice } from '../notice';

export type SelectionInventory = {
  rooms: Record<string, number>;
  lockers: number;
} | null;

export type WaitlistUnavailableOptions = {
  rooms: Record<'SPECIAL' | 'DOUBLE' | 'STANDARD', Array<{ number: string; status: string }>>;
  lockers: Array<{ number: string; status: string }>;
} | null;

export type SelectionFlowState = {
  session: SessionState;
  lane: string | null;
  inventory: SelectionInventory;
  selectedRental: string | null;
  proposedRentalType: string | null;
  proposedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectionConfirmed: boolean;
  selectionConfirmedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  waitlistDesiredType: string | null;
  waitlistDesiredTypes: string[];
  waitlistBackupType: string | null;
  waitlistRequestedResourceNumber: string | null;
  waitlistRequestedResourceType: 'room' | 'locker' | null;
  waitlistUnavailableOptions: WaitlistUnavailableOptions;
  waitlistPosition: number | null;
  waitlistETA: string | null;
  waitlistUpgradeFee: number | null;
  showWaitlistModal: boolean;
  showUpgradeDisclaimer: boolean;
  upgradeAction: 'waitlist' | null;
  upgradeDisclaimerAcknowledged: boolean;
  showRenewalDisclaimer: boolean;
  showCustomerConfirmation: boolean;
  customerConfirmationData: CustomerConfirmationRequiredPayload | null;
  membershipChoice: 'ONE_TIME' | 'SIX_MONTH' | null;
  showMembershipModal: boolean;
  membershipModalIntent: 'PURCHASE' | 'RENEW' | null;
  highlightedMembershipChoice: 'ONE_TIME' | 'SIX_MONTH' | null;
  highlightedWaitlistBackup: string | null;
};

export type SelectionFlowSetters = {
  setProposedRentalType: Dispatch<SetStateAction<string | null>>;
  setProposedBy: Dispatch<SetStateAction<'CUSTOMER' | 'EMPLOYEE' | null>>;
  setSelectionConfirmed: Dispatch<SetStateAction<boolean>>;
  setSelectionConfirmedBy: Dispatch<SetStateAction<'CUSTOMER' | 'EMPLOYEE' | null>>;
  setWaitlistDesiredType: Dispatch<SetStateAction<string | null>>;
  setWaitlistDesiredTypes: Dispatch<SetStateAction<string[]>>;
  setWaitlistBackupType: Dispatch<SetStateAction<string | null>>;
  setWaitlistRequestedResourceNumber: Dispatch<SetStateAction<string | null>>;
  setWaitlistRequestedResourceType: Dispatch<SetStateAction<'room' | 'locker' | null>>;
  setWaitlistUnavailableOptions: Dispatch<SetStateAction<WaitlistUnavailableOptions>>;
  setWaitlistPosition: Dispatch<SetStateAction<number | null>>;
  setWaitlistETA: Dispatch<SetStateAction<string | null>>;
  setWaitlistUpgradeFee: Dispatch<SetStateAction<number | null>>;
  setShowWaitlistModal: Dispatch<SetStateAction<boolean>>;
  setShowUpgradeDisclaimer: Dispatch<SetStateAction<boolean>>;
  setUpgradeAction: Dispatch<SetStateAction<'waitlist' | null>>;
  setUpgradeDisclaimerAcknowledged: Dispatch<SetStateAction<boolean>>;
  setShowRenewalDisclaimer: Dispatch<SetStateAction<boolean>>;
  setShowCustomerConfirmation: Dispatch<SetStateAction<boolean>>;
  setCustomerConfirmationData: Dispatch<SetStateAction<CustomerConfirmationRequiredPayload | null>>;
  setMembershipChoice: Dispatch<SetStateAction<'ONE_TIME' | 'SIX_MONTH' | null>>;
  setShowMembershipModal: Dispatch<SetStateAction<boolean>>;
  setMembershipModalIntent: Dispatch<SetStateAction<'PURCHASE' | 'RENEW' | null>>;
  setHighlightedWaitlistBackup: Dispatch<SetStateAction<string | null>>;
  setSession: Dispatch<SetStateAction<SessionState>>;
};

export type SelectionFlowUi = {
  orientationOverlay: ReactNode;
  welcomeOverlay: ReactNode;
  isSubmitting: boolean;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
};

export type SelectionFlowCallbacks = {
  onSwitchToLanguage: () => void;
  onProceedToAgreement: () => void;
};

export type SelectionFlowNotices = {
  notice?: KioskNotice | null;
  showNotice: (notice: KioskNotice, ttlMs?: number) => void;
};

export interface SelectionFlowProps {
  apiBase: string;
  kioskAuthHeaders: (extra?: Record<string, string>) => Record<string, string>;
  state: SelectionFlowState;
  setters: SelectionFlowSetters;
  ui: SelectionFlowUi;
  callbacks: SelectionFlowCallbacks;
  notices: SelectionFlowNotices;
}
