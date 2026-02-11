import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavTab } from '../shared/types';

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

type UseNavigationStateParams = {
  setManualEntry: (value: boolean) => void;
  currentSessionId: string | null;
  laneSessionCustomerId: string | null;
};

export function useNavigationState({
  setManualEntry,
  currentSessionId,
  laneSessionCustomerId,
}: UseNavigationStateParams) {
  const [navTab, setNavTab] = useState<NavTab>('scan');
  const [accountCustomerId, setAccountCustomerId] = useState<string | null>(null);
  const [accountCustomerLabel, setAccountCustomerLabel] = useState<string | null>(null);
  const [accountCustomerSummary, setAccountCustomerSummary] =
    useState<AccountCustomerSummary | null>(null);
  const [accountAutoStartCheckin, setAccountAutoStartCheckin] = useState(true);
  const [checkoutPrefill, setCheckoutPrefill] = useState<CheckoutPrefill | null>(null);
  const [checkoutEntryMode, setCheckoutEntryMode] = useState<'default' | 'direct-confirm'>(
    'default'
  );
  const checkoutReturnToTabRef = useRef<NavTab | null>(null);
  const lastNonAccountTabRef = useRef<NavTab>('scan');
  const setAccountCustomerIdSafe = useCallback((value: string | null) => {
    setAccountCustomerId(value);
    if (!value) {
      setAccountCustomerLabel(null);
      setAccountCustomerSummary(null);
      setAccountAutoStartCheckin(true);
    }
  }, []);

  const selectNavTab = useCallback(
    (next: NavTab) => {
      setNavTab((prev) => {
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

  const returnToPreviousTab = useCallback(() => {
    const target = lastNonAccountTabRef.current || 'scan';
    selectNavTab(target);
  }, [selectNavTab]);

  const startCheckout = useCallback(() => {
    checkoutReturnToTabRef.current = null;
    setCheckoutPrefill(null);
    setCheckoutEntryMode('default');
    selectNavTab('checkout');
  }, [selectNavTab]);

  const startCheckoutFromInventory = useCallback(
    (prefill: { occupancyId?: string; number: string }) => {
      checkoutReturnToTabRef.current = 'inventory';
      setCheckoutEntryMode('direct-confirm');
      setCheckoutPrefill(prefill);
      selectNavTab('checkout');
    },
    [selectNavTab]
  );

  const startCheckoutFromCustomerAccount = useCallback(
    (prefill?: { number?: string | null }) => {
      const returnTo: NavTab = currentSessionId ? 'account' : 'scan';
      checkoutReturnToTabRef.current = returnTo;
      const number = prefill?.number ?? null;
      setCheckoutEntryMode(number ? 'direct-confirm' : 'default');
      setCheckoutPrefill(number ? { number } : null);
      selectNavTab('checkout');
    },
    [currentSessionId, selectNavTab]
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
      selectNavTab(returnTo);
      return;
    }
    selectNavTab('scan');
  }, [selectNavTab, setAccountCustomerIdSafe]);

  const openCustomerAccount = useCallback(
    (customerId: string, label?: string | null, opts?: OpenCustomerAccountOptions) => {
      setAccountCustomerIdSafe(customerId);
      setAccountCustomerLabel(label ?? null);
      setAccountCustomerSummary(opts?.summary ?? null);
      setAccountAutoStartCheckin(opts?.autoStart ?? true);
      selectNavTab('account');
    },
    [selectNavTab, setAccountCustomerIdSafe]
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
      selectNavTab('account');
    }
  }, [
    accountCustomerId,
    currentSessionId,
    laneSessionCustomerId,
    selectNavTab,
    setAccountCustomerIdSafe,
    setAccountCustomerLabel,
  ]);

  const canOpenAccountTab = Boolean(currentSessionId || accountCustomerId);

  return {
    navTab,
    selectNavTab,
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
    startCheckout,
    startCheckoutFromInventory,
    startCheckoutFromCustomerAccount,
    exitCheckout,
    openCustomerAccount,
    returnToPreviousTab,
  };
}
