import { useEffect, useCallback, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LockScreen, type StaffSession } from '../LockScreen';
import { ScheduleView } from '../schedule/ScheduleView';
import { OfficeShell } from '../OfficeShell';
import { DemoOverview } from '../DemoOverview';
import { LaneMonitorView } from '../LaneMonitorView';
import { WaitlistManagementView } from '../WaitlistManagementView';
import { CustomerAdminToolsView } from '../CustomerAdminToolsView';
import { ActivityHub } from '../activity/ActivityHub';
import { LateCheckoutBanAlertsView } from '../LateCheckoutBanAlertsView';
import { ReportsView } from '../reports/ReportsView';
import { MessagesView } from '../MessagesView';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import {
  clearStorageValue,
  CLUBOPS_STORAGE_KEYS,
  CLUBOPS_STORAGE_LEGACY_KEYS,
  readStorageValueWithMigration,
  writeStorageValue,
} from '@club-ops/shared';
import { fetchAuthMe, logout } from '../api/auth';
import { ForcePinChangeModal } from '../ForcePinChangeModal';

export function AppComposition() {
  const [session, setSession] = useState<StaffSession | null>(() => {
    // Load session from localStorage on mount
    const stored = readStorageValueWithMigration(
      window.localStorage,
      CLUBOPS_STORAGE_KEYS.staffSession,
      CLUBOPS_STORAGE_LEGACY_KEYS.staffSession
    );
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  // If we boot with a stored session, validate it once before mounting the app views.
  // This avoids spamming 401s when the token is expired/revoked.
  const [isValidatingSession, setIsValidatingSession] = useState<boolean>(() =>
    Boolean(
      readStorageValueWithMigration(
        window.localStorage,
        CLUBOPS_STORAGE_KEYS.staffSession,
        CLUBOPS_STORAGE_LEGACY_KEYS.staffSession
      )
    )
  );
  const [sessionValidationError, setSessionValidationError] = useState<string | null>(null);

  const deviceId = useState(() => {
    // Generate or retrieve device ID
    const storage = window.localStorage;
    let id = readStorageValueWithMigration(
      storage,
      CLUBOPS_STORAGE_KEYS.deviceId,
      CLUBOPS_STORAGE_LEGACY_KEYS.deviceId
    );
    if (!id) {
      id = `device-${crypto.randomUUID()}`;
      writeStorageValue(
        storage,
        CLUBOPS_STORAGE_KEYS.deviceId,
        id,
        CLUBOPS_STORAGE_LEGACY_KEYS.deviceId
      );
    }
    return id;
  })[0];

  const clearSession = () => {
    setSession(null);
    clearStorageValue(
      window.localStorage,
      CLUBOPS_STORAGE_KEYS.staffSession,
      CLUBOPS_STORAGE_LEGACY_KEYS.staffSession
    );
    setSessionValidationError(null);
    setIsValidatingSession(false);
  };

  useEffect(() => {
    if (!session?.sessionToken) {
      setIsValidatingSession(false);
      setSessionValidationError(null);
      return;
    }
    if (!isValidatingSession) return;

    const ac = new AbortController();
    (async () => {
      try {
        await fetchAuthMe(session.sessionToken, ac.signal);
        if (!ac.signal.aborted) {
          setSessionValidationError(null);
          setIsValidatingSession(false);
        }
      } catch {
        if (ac.signal.aborted) return;
        // Most common case: stale localStorage token.
        clearSession();
      }
    })();

    return () => ac.abort();
  }, [session?.sessionToken, isValidatingSession]);

  const handleLogin = useCallback((newSession: StaffSession) => {
    setSession(newSession);
    writeStorageValue(
      window.localStorage,
      CLUBOPS_STORAGE_KEYS.staffSession,
      JSON.stringify(newSession),
      CLUBOPS_STORAGE_LEGACY_KEYS.staffSession
    );
    setSessionValidationError(null);
    setIsValidatingSession(false);
  }, []);

  const handleLogout = async () => {
    if (session?.sessionToken) {
      try {
        await logout(session.sessionToken);
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    clearSession();
  };

  // Gate app mounting on validating any stored session.
  if (session && isValidatingSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-700 border-t-brand-500" />
        <h3 className="text-xl font-semibold text-white/90">Validating session…</h3>
        <p className="max-w-lg text-center text-sm text-gray-400">
          If you see this for more than a few seconds, the API may be down or your token may have
          expired.
        </p>
        <button
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-300 ring-1 ring-inset ring-gray-700 hover:bg-white/[0.05] transition-colors"
          onClick={clearSession}
        >
          Return to Lock Screen
        </button>
      </div>
    );
  }

  if (session && sessionValidationError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h3 className="text-xl font-semibold text-white/90">Session check failed</h3>
        <p className="max-w-lg text-center text-sm text-gray-400">
          {sessionValidationError}
        </p>
        <div className="flex gap-2">
          <button
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            onClick={() => {
              setSessionValidationError(null);
              setIsValidatingSession(true);
            }}
          >
            Retry
          </button>
          <button
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-300 ring-1 ring-inset ring-gray-700 hover:bg-white/[0.05] transition-colors"
            onClick={clearSession}
          >
            Return to Lock Screen
          </button>
        </div>
      </div>
    );
  }

  // Show lock screen if not authenticated
  if (!session) {
    return <LockScreen onLogin={handleLogin} deviceType="desktop" deviceId={deviceId} />;
  }

  // Force PIN change if admin reset the user's PIN
  if (session.mustChangePin) {
    return (
      <ForcePinChangeModal
        sessionToken={session.sessionToken}
        staffName={session.name}
        onComplete={() => {
          // Clear the mustChangePin flag in state
          const updatedSession = { ...session, mustChangePin: false };
          setSession(updatedSession);
          writeStorageValue(
            window.localStorage,
            CLUBOPS_STORAGE_KEYS.staffSession,
            JSON.stringify(updatedSession),
            CLUBOPS_STORAGE_LEGACY_KEYS.staffSession
          );
        }}
      />
    );
  }

  const isAdmin = session.role === 'ADMIN';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAdmin ? '/overview' : '/schedule'} replace />} />
      <Route element={<OfficeShell session={session} onLogout={handleLogout} />}>
        <Route
          path="/overview"
          element={
            isAdmin ? <RouteErrorBoundary routeName="Overview"><DemoOverview session={session} /></RouteErrorBoundary> : <Navigate to="/schedule" replace />
          }
        />
        <Route
          path="/monitor"
          element={
            isAdmin ? <RouteErrorBoundary routeName="Lane Monitor"><LaneMonitorView session={session} /></RouteErrorBoundary> : <Navigate to="/schedule" replace />
          }
        />
        <Route
          path="/waitlist"
          element={
            isAdmin ? (
              <RouteErrorBoundary routeName="Waitlist"><WaitlistManagementView session={session} /></RouteErrorBoundary>
            ) : (
              <Navigate to="/schedule" replace />
            )
          }
        />
        <Route
          path="/reports"
          element={
            isAdmin ? <RouteErrorBoundary routeName="Reports"><ReportsView sessionToken={session.sessionToken} /></RouteErrorBoundary> : <Navigate to="/schedule" replace />
          }
        />
        <Route
          path="/customers"
          element={
            isAdmin ? (
              <RouteErrorBoundary routeName="Customer Tools"><CustomerAdminToolsView session={session} /></RouteErrorBoundary>
            ) : (
              <Navigate to="/schedule" replace />
            )
          }
        />
        <Route
          path="/logs"
          element={isAdmin ? <RouteErrorBoundary routeName="Operations Hub"><ActivityHub session={session} /></RouteErrorBoundary> : <Navigate to="/schedule" replace />}
        />
        <Route
          path="/late-checkout-alerts"
          element={
            isAdmin ? (
              <RouteErrorBoundary routeName="Alerts"><LateCheckoutBanAlertsView session={session} /></RouteErrorBoundary>
            ) : (
              <Navigate to="/schedule" replace />
            )
          }
        />
        <Route
          path="/schedule"
          element={<RouteErrorBoundary routeName="Schedule"><ScheduleView sessionToken={session.sessionToken} /></RouteErrorBoundary>}
        />
        <Route
          path="/messages"
          element={isAdmin ? <Navigate to="/overview" replace /> : <RouteErrorBoundary routeName="Messages"><MessagesView /></RouteErrorBoundary>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
