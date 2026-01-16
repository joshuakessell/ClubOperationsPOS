import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LockScreen, type StaffSession } from './LockScreen';
import { ShiftsView } from './ShiftsView';
import { OfficeShell } from './OfficeShell';
import { DemoOverview } from './DemoOverview';
import { LaneMonitorView } from './LaneMonitorView';
import { WaitlistManagementView } from './WaitlistManagementView';
import { CustomerAdminToolsView } from './CustomerAdminToolsView';
import { ReportsDemoView } from './ReportsDemoView';
import { MessagesView } from './MessagesView';
import { TelemetryView } from './TelemetryView';

function App() {
  const [session, setSession] = useState<StaffSession | null>(() => {
    // Load session from localStorage on mount
    const stored = window.localStorage.getItem('staff_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  const deviceId = useState(() => {
    // Generate or retrieve device ID
    const storage = window.localStorage;
    let id = storage.getItem('device_id');
    if (!id) {
      id = `device-${crypto.randomUUID()}`;
      storage.setItem('device_id', id);
    }
    return id;
  })[0];

  const handleLogin = (newSession: StaffSession) => {
    setSession(newSession);
    window.localStorage.setItem('staff_session', JSON.stringify(newSession));
  };

  const handleLogout = async () => {
    if (session?.sessionToken) {
      try {
        await fetch(`/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.sessionToken}`,
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    setSession(null);
    window.localStorage.removeItem('staff_session');
  };

  // Show lock screen if not authenticated
  if (!session) {
    return <LockScreen onLogin={handleLogin} deviceType="desktop" deviceId={deviceId} />;
  }

  const isAdmin = session.role === 'ADMIN';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAdmin ? '/overview' : '/schedule'} replace />} />
      <Route element={<OfficeShell session={session} onLogout={handleLogout} />}>
        <Route
          path="/overview"
          element={isAdmin ? <DemoOverview session={session} /> : <Navigate to="/schedule" replace />}
        />
        <Route
          path="/monitor"
          element={isAdmin ? <LaneMonitorView session={session} /> : <Navigate to="/schedule" replace />}
        />
        <Route
          path="/waitlist"
          element={isAdmin ? <WaitlistManagementView session={session} /> : <Navigate to="/schedule" replace />}
        />
        <Route
          path="/reports"
          element={isAdmin ? <ReportsDemoView session={session} /> : <Navigate to="/schedule" replace />}
        />
        <Route
          path="/customers"
          element={isAdmin ? <CustomerAdminToolsView session={session} /> : <Navigate to="/schedule" replace />}
        />
        <Route
          path="/telemetry"
          element={isAdmin ? <TelemetryView session={session} /> : <Navigate to="/schedule" replace />}
        />

        <Route path="/schedule" element={<ShiftsView session={session} limitedAccess={!isAdmin} />} />
        <Route path="/messages" element={isAdmin ? <Navigate to="/overview" replace /> : <MessagesView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
