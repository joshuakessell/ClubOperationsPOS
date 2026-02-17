import type { ActiveCheckinDetails } from '../../modals/AlreadyCheckedInModal';

export type SwitchPaymentChoice = 'CASH_SUCCESS' | 'CREDIT_SUCCESS' | 'CREDIT_DECLINE';
export type PreviousRoomStatus = 'CLEAN' | 'CLEANING' | 'DIRTY';

export type AvailableRoom = {
  id: string;
  number: string;
  tier: 'SPECIAL' | 'DOUBLE' | 'STANDARD';
};

export type AvailableLocker = { id: string; number: string };

export type SwitchApiError = {
  error?: string;
  code?: string;
  additionalFee?: number;
};

export type ActiveVisitSummaryProps = {
  activeCheckin: ActiveCheckinDetails;
  sessionToken: string | null | undefined;
  onStartCheckout: (prefill?: { number?: string | null }) => void;
  onStartRenewal?: (activeCheckin: ActiveCheckinDetails) => void;
  onRefetch: () => void;
};
