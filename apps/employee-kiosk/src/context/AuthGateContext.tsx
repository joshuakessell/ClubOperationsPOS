import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { NavTab } from '../app/state/shared/types';

/** Session display info surfaced to the kiosk header */
export interface SessionDisplayInfo {
  employeeName: string;
  registerNumber: number;
  lane: string;
  apiStatus: string | null;
  realtimeConnected: boolean;
  realtimeMode: 'cloud' | 'lan';
  onSignOut: () => void;
  onCloseOut: () => void;
}

interface AuthGateState {
  /** True when an employee has signed in and the main UI should be visible */
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  /** The currently active nav tab (set by NavigationRoot) */
  activeNavTab: NavTab;
  /** Navigate to a specific tab (calls through to selectNavTab in NavigationRoot) */
  selectNavTab: ((tab: NavTab) => void) | null;
  /** Register the selectNavTab callback from NavigationRoot */
  registerSelectNavTab: (fn: (tab: NavTab) => void) => void;
  /** Session display info for the header bar */
  sessionInfo: SessionDisplayInfo | null;
  /** Set session display info (called by SessionRoot / NavigationRoot) */
  setSessionInfo: (info: SessionDisplayInfo | null) => void;
}

const AuthGateContext = createContext<AuthGateState | null>(null);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const activeNavTab: NavTab = 'scan';
  const [selectNavTabFn, setSelectNavTabFn] = useState<((tab: NavTab) => void) | null>(null);
  const [sessionInfo, setSessionInfoState] = useState<SessionDisplayInfo | null>(null);

  const setAuthenticated = useCallback((v: boolean) => setIsAuthenticated(v), []);

  const registerSelectNavTab = useCallback((fn: (tab: NavTab) => void) => {
    // Wrap in a function to avoid React treating fn as a state updater
    setSelectNavTabFn(() => fn);
  }, []);

  const setSessionInfo = useCallback((info: SessionDisplayInfo | null) => {
    setSessionInfoState(info);
  }, []);

  return (
    <AuthGateContext.Provider
      value={{
        isAuthenticated,
        setAuthenticated,
        activeNavTab,
        selectNavTab: selectNavTabFn,
        registerSelectNavTab,
        sessionInfo,
        setSessionInfo,
      }}
    >
      {children}
    </AuthGateContext.Provider>
  );
}

export function useAuthGate(): AuthGateState {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    return {
      isAuthenticated: false,
      setAuthenticated: () => {},
      activeNavTab: 'scan',
      selectNavTab: null,
      registerSelectNavTab: () => {},
      sessionInfo: null,
      setSessionInfo: () => {},
    };
  }
  return ctx;
}
