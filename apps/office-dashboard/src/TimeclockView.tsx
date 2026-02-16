import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StaffSession } from './LockScreen';
// Intentionally no direct `fetch` usage in this view; use `src/api/*` modules.
import {
  closeTimeclockSession,
  fetchTimeclockSessions,
  updateTimeclockSession,
} from './api/timeclock';
import { formatTime, formatDate, calculateHours } from './lib/dateUtils';


import type { TimeclockSession } from './api/timeclock';

interface TimeclockViewProps {
  session: StaffSession;
}

export function TimeclockView({ session }: TimeclockViewProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TimeclockSession[]>([]);
  const [currentlyClockedIn, setCurrentlyClockedIn] = useState<TimeclockSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0]!;
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0]!;
  });
  const [selectedSession, setSelectedSession] = useState<TimeclockSession | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchCurrentlyClockedIn = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]!;
      const data = await fetchTimeclockSessions(session.sessionToken, `from=${today}`);
      setCurrentlyClockedIn(data.sessions.filter((s) => !s.clockOutAt));
    } catch (error) {
      console.error('Failed to fetch currently clocked in:', error);
    }
  }, [session.sessionToken]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('from', `${dateFrom}T00:00:00Z`);
      if (dateTo) params.append('to', `${dateTo}T23:59:59Z`);

      const data = await fetchTimeclockSessions(session.sessionToken, params.toString());
      setSessions(data.sessions);
      await fetchCurrentlyClockedIn();
    } catch (error) {
      console.error('Failed to fetch timeclock sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, fetchCurrentlyClockedIn, session.sessionToken]);

  useEffect(() => {
    fetchSessions();
    // Refresh currently clocked in every 30 seconds
    const interval = setInterval(() => {
      fetchCurrentlyClockedIn();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchCurrentlyClockedIn, fetchSessions]);

  const handleCloseSession = async (sessionId: string) => {
    try {
      await closeTimeclockSession(session.sessionToken, sessionId);
      await fetchSessions();
    } catch (error) {
      console.error('Failed to close session:', error);
      alert('Failed to close session');
    }
  };



  // Group by employee for hours summary
  const hoursByEmployee = sessions.reduce(
    (acc, session) => {
      if (!acc[session.employeeId]) {
        acc[session.employeeId] = { name: session.employeeName, totalHours: 0, sessions: 0 };
      }
      if (session.clockOutAt) {
        const hours =
          (new Date(session.clockOutAt).getTime() - new Date(session.clockInAt).getTime()) /
          (1000 * 60 * 60);
        acc[session.employeeId]!.totalHours += hours;
        acc[session.employeeId]!.sessions += 1;
      }
      return acc;
    },
    {} as Record<string, { name: string; totalHours: number; sessions: number }>
  );

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading timeclock data...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Timeclock</h1>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#374151',
            border: 'none',
            borderRadius: '6px',
            color: '#f9fafb',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Currently Clocked In */}
      {currentlyClockedIn.length > 0 && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            background: '#1f2937',
            borderRadius: '8px',
            border: '1px solid #374151',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
            Currently Clocked In ({currentlyClockedIn.length})
          </h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {currentlyClockedIn.map((session) => (
              <div
                key={session.id}
                style={{
                  padding: '1rem',
                  background: '#111827',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{session.employeeName}</div>
                  <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                    Clocked in: {formatDate(session.clockInAt)} at {formatTime(session.clockInAt)}
                  </div>
                </div>
                <button
                  onClick={() => handleCloseSession(session.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  Close Session
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          padding: '1rem',
          background: '#1f2937',
          borderRadius: '8px',
        }}
      >
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: '0.5rem',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: '0.5rem',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
            }}
          />
        </div>
      </div>

      {/* Hours by Employee */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          background: '#1f2937',
          borderRadius: '8px',
          border: '1px solid #374151',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
          Hours by Employee
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #374151' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Employee</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Total Hours</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(hoursByEmployee).map(([employeeId, data]) => (
              <tr key={employeeId} style={{ borderBottom: '1px solid #374151' }}>
                <td style={{ padding: '0.75rem' }}>{data.name}</td>
                <td style={{ padding: '0.75rem' }}>{data.totalHours.toFixed(2)}h</td>
                <td style={{ padding: '0.75rem' }}>{data.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Session List */}
      <div
        style={{
          padding: '1.5rem',
          background: '#1f2937',
          borderRadius: '8px',
          border: '1px solid #374151',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>All Sessions</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #374151' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Employee</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Clock In</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Clock Out</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Hours</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Source</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} style={{ borderBottom: '1px solid #374151' }}>
                <td style={{ padding: '0.75rem' }}>{session.employeeName}</td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                  {formatDate(session.clockInAt)} {formatTime(session.clockInAt)}
                </td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                  {session.clockOutAt ? (
                    <>
                      {formatDate(session.clockOutAt)} {formatTime(session.clockOutAt)}
                    </>
                  ) : (
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>Open</span>
                  )}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {calculateHours(session.clockInAt, session.clockOutAt)}
                </td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{session.source}</td>
                <td style={{ padding: '0.75rem' }}>
                  {!session.clockOutAt && (
                    <button
                      onClick={() => handleCloseSession(session.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#ef4444',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        marginRight: '0.5rem',
                      }}
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedSession(session);
                      setShowEditModal(true);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#f9fafb',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Session Modal */}
      {showEditModal && selectedSession && (
        <EditSessionModal
          session={selectedSession}
          onClose={() => {
            setShowEditModal(false);
            setSelectedSession(null);
          }}
          onSave={async (updates) => {
            try {
              await updateTimeclockSession(session.sessionToken, selectedSession.id, updates);
              await fetchSessions();
              setShowEditModal(false);
              setSelectedSession(null);
            } catch (error) {
              console.error('Failed to update session:', error);
              alert('Failed to update session');
            }
          }}
        />
      )}
    </div>
  );
}

function EditSessionModal({
  session,
  onClose,
  onSave,
}: {
  session: TimeclockSession;
  onClose: () => void;
  onSave: (updates: { clock_in_at: string; clock_out_at: string | null; notes: string | null }) => Promise<void>;
}) {
  const [clockInAt, setClockInAt] = useState(session.clockInAt.slice(0, 16));
  const [clockOutAt, setClockOutAt] = useState(session.clockOutAt?.slice(0, 16) || '');
  const [notes, setNotes] = useState(session.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        clock_in_at: new Date(clockInAt).toISOString(),
        clock_out_at: clockOutAt ? new Date(clockOutAt).toISOString() : null,
        notes: notes || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1f2937',
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: '500px',
          width: '90%',
          border: '1px solid #374151',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          Edit Timeclock Session
        </h2>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Clock In
          </label>
          <input
            type="datetime-local"
            value={clockInAt}
            onChange={(e) => setClockInAt(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '1rem',
            }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Clock Out (leave empty if still open)
          </label>
          <input
            type="datetime-local"
            value={clockOutAt}
            onChange={(e) => setClockOutAt(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '1rem',
            }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '1rem',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#374151',
              border: 'none',
              borderRadius: '6px',
              color: '#f9fafb',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              background: saving ? '#6b7280' : '#10b981',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
