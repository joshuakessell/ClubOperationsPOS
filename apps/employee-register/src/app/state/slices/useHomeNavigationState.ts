import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomeTab } from '../shared/types';

type CheckoutPrefill = {
  occupancyId?: string;
  number?: string;
};

type AccountCustomerSummary = {
  name?: string;
  dobMonthDay?: string;
  membershipNumber?: string;
};

type OpenCustomerAccountOptions = {
  autoStart?: boolean;
  summary?: AccountCustomerSummary | null;
};

type UseHomeNavigationStateParams = {
  setManualEntry: (value: boolean) => void;
  currentSessionId: string | null;
  laneSessionCustomerId: string | null;
};

export function useHomeNavigationState({
  setManualEntry,
  currentSessionId,
  laneSessionCustomerId,
}: UseHomeNavigationStateParams) {
  const [homeTab, setHomeTab] = useState<HomeTab>('scan');
  const [accountCustomerId, setAccountCustomerId] = useState<string | null>(null);
  const [accountCustomerLabel, setAccountCustomerLabel] = useState<string | null>(null);
  const [accountCustomerSummary, setAccountCustomerSummary] =
    useState<AccountCustomerSummary | null>(null);
  const [accountAutoStartCheckin, setAccountAutoStartCheckin] = useState(true);
  const [checkoutPrefill, setCheckoutPrefill] = useState<CheckoutPrefill | null>(null);
  const [checkoutEntryMode, setCheckoutEntryMode] = useState<'default' | 'direct-confirm'>(
    'default'
  );
  const checkoutReturnToTabRef = useRef<HomeTab | null>(null);
  const lastNonAccountTabRef = useRef<HomeTab>('scan');
  const setAccountCustomerIdSafe = useCallback((value: string | null) => {
    setAccountCustomerId(value);
    if (!value) {
      setAccountCustomerLabel(null);
      setAccountCustomerSummary(null);
      setAccountAutoStartCheckin(true);
    }
  }, []);

  const selectHomeTab = useCallback(
    (next: HomeTab) => {
      setHomeTab((prev) => {
        if (next === 'account' && prev !== 'account') {
          lastNonAccountTabRef.current = prev;
        }
        if (next !== 'account') {
          lastNonAccountTabRef.current = next;
        }
        return next;
      });
      setManualEntry(next === 'firstTime');
      if (next !== 'checkout') {
        setCheckoutPrefill(null);
        setCheckoutEntryMode('default');
        checkoutReturnToTabRef.current = null;
      }
    },
    [setManualEntry]
  );

  const returnToPreviousHomeTab = useCallback(() => {
    const target = lastNonAccountTabRef.current || 'scan';
    selectHomeTab(target);
  }, [selectHomeTab]);

  const startCheckoutFromHome = useCallback(() => {
    checkoutReturnToTabRef.current = null;
    setCheckoutPrefill(null);
    setCheckoutEntryMode('default');
    selectHomeTab('checkout');
  }, [selectHomeTab]);

  const startCheckoutFromInventory = useCallback(
    (prefill: { occupancyId?: string; number: string }) => {
      checkoutReturnToTabRef.current = 'inventory';
      setCheckoutEntryMode('direct-confirm');
      setCheckoutPrefill(prefill);
      selectHomeTab('checkout');
    },
    [selectHomeTab]
  );

  const startCheckoutFromCustomerAccount = useCallback(
    (prefill?: { number?: string | null }) => {
      const returnTo: HomeTab = currentSessionId ? 'account' : 'scan';
      checkoutReturnToTabRef.current = returnTo;
      const number = prefill?.number ?? null;
      setCheckoutEntryMode(number ? 'direct-confirm' : 'default');
      setCheckoutPrefill(number ? { number } : null);
      selectHomeTab('checkout');
    },
    [currentSessionId, selectHomeTab]
  );

  const exitCheckout = useCallback(() => {
    const returnTo = checkoutReturnToTabRef.current;
    checkoutReturnToTabRef.current = null;
    setCheckoutPrefill(null);
    setCheckoutEntryMode('default');
    if (returnTo) {
      if (returnTo === 'scan') {
        setAccountCustomerIdSafe(null);
      }
      selectHomeTab(returnTo);
      return;
    }
    selectHomeTab('scan');
  }, [selectHomeTab, setAccountCustomerIdSafe]);

  const openCustomerAccount = useCallback(
    (customerId: string, label?: string | null, opts?: OpenCustomerAccountOptions) => {
      setAccountCustomerIdSafe(customerId);
      setAccountCustomerLabel(label ?? null);
      setAccountCustomerSummary(opts?.summary ?? null);
      setAccountAutoStartCheckin(opts?.autoStart ?? true);
      selectHomeTab('account');
    },
    [selectHomeTab, setAccountCustomerIdSafe]
  );

  const prevSessionIdForTabRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSessionIdForTabRef.current;
    prevSessionIdForTabRef.current = currentSessionId;
    if (!prev && currentSessionId) {
      if (laneSessionCustomerId && laneSessionCustomerId !== accountCustomerId) {
        setAccountCustomerIdSafe(laneSessionCustomerId);
        setAccountCustomerLabel(null);
      }
      setAccountCustomerSummary(null);
      setAccountAutoStartCheckin(true);
      selectHomeTab('account');
    }
  }, [
    accountCustomerId,
    currentSessionId,
    laneSessionCustomerId,
    selectHomeTab,
    setAccountCustomerIdSafe,
    setAccountCustomerLabel,
  ]);

  const canOpenAccountTab = Boolean(currentSessionId || accountCustomerId);

  return {
    homeTab,
    selectHomeTab,
    accountCustomerId,
    accountCustomerLabel,
    accountCustomerSummary,
    accountAutoStartCheckin,
    setAccountCustomerId: setAccountCustomerIdSafe,
    setAccountCustomerLabel,
    setAccountCustomerSummary,
    setAccountAutoStartCheckin,
    canOpenAccountTab,
    checkoutPrefill,
    setCheckoutPrefill,
    checkoutEntryMode,
    setCheckoutEntryMode,
    checkoutReturnToTabRef,
    startCheckoutFromHome,
    startCheckoutFromInventory,
    startCheckoutFromCustomerAccount,
    exitCheckout,
    openCustomerAccount,
    returnToPreviousHomeTab,
  };
}
