import type { ReactNode } from 'react';
import { RegisterSignIn } from '../../RegisterSignIn';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';

export function SessionRoot({ children }: { children: ReactNode }) {
  const {
    deviceId,
    handleRegisterSignIn,
    lane,
    health,
    realtimeConnected,
    realtimeMode,
    handleLogout,
    handleCloseOut,
    registerSession,
    session,
  } = useEmployeeRegisterState();

  return (
    <RegisterSignIn
      deviceId={deviceId}
      onSignedIn={handleRegisterSignIn}
      topTitle="Employee Register"
      lane={lane}
      apiStatus={health?.status ?? null}
      realtimeConnected={realtimeConnected}
      realtimeMode={realtimeMode}
      onSignOut={() => void handleLogout()}
      onCloseOut={() => void handleCloseOut()}
    >
      {!registerSession ? (
        /* Not authenticated — still render children so NavigationRoot can show the Sign In tab */
        children
      ) : !session ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>Loading...</div>
      ) : (
        children
      )}
    </RegisterSignIn>
  );
}
