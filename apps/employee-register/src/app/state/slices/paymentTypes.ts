import type { PaymentQuoteViewModel } from '../../registerLaneSessionReducer';

export type PaymentQuote = PaymentQuoteViewModel | null;
export type PaymentQuoteSetter = (value: PaymentQuote | ((prev: PaymentQuote) => PaymentQuote)) => void;

export type RegisterSession = {
  employeeId: string;
  employeeName: string;
  registerNumber: number;
  deviceId: string;
};
