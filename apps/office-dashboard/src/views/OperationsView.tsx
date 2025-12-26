import { useState, useEffect } from 'react';
import type { StaffSession } from '../LockScreen';
import './OperationsView.css';

const API_BASE = '/api';

interface RegisterSession {
  registerNumber: 1 | 2;
  active: boolean;
  sessionId: string | null;
  employee: {
    id: string;
    displayName: string;
    role: string;
  } | null;
  deviceId: string | null;
  createdAt: string | null;
  lastHeartbeatAt: string | null;
  secondsSinceHeartbeat: number | null;
}

interface LaneSession {
  id: string;
  laneId: string;
  status: string;
  customerName?: string;
  membershipNumber?: string;
  desiredRentalType?: string;
  assignedResource?: { type: 'room' | 'locker'; number: string };
  staffName?: string;
  createdAt: string;
}

interface OperationsViewProps {
  session: StaffSession;
}

export function OperationsView({ session }: OperationsViewProps) {
  const [registerSessions, setRegisterSessions] = useState<RegisterSession[]>([]);
  const [customerKioskSessions, setCustomerKioskSessions] = useState<LaneSession[]>([]);
  const [checkoutKioskActive, setCheckoutKioskActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOperationsData();
    const interval = setInterval(loadOperationsData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadOperationsData = async () => {
    try {
      // Load register sessions
      const registerResponse = await fetch(`${API_BASE}/v1/admin/register-sessions`, {
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
        },
      });
      if (registerResponse.ok) {
        const registerData = await registerResponse.json();
        setRegisterSessions(registerData || []);
      }

      // Load customer kiosk sessions (lane sessions)
      const laneResponse = await fetch(`${API_BASE}/v1/checkin/lane-sessions`, {
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
        },
      });
      if (laneResponse.ok) {
        const laneData = await laneResponse.json();
        setCustomerKioskSessions(laneData.sessions || []);
      }

      // TODO: Load checkout kiosk status when endpoint is available
      setCheckoutKioskActive(false);
    } catch (error) {
      console.error('Failed to load operations data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (active: boolean, secondsSinceHeartbeat: number | null) => {
    if (!active) return '#A0A1A2';
    if (secondsSinceHeartbeat === null) return '#10b981';
    if (secondsSinceHeartbeat < 30) return '#10b981';
    if (secondsSinceHeartbeat < 60) return '#f59e0b';
    return '#ef4444';
  };

  const formatTimeAgo = (seconds: number | null) => {
    if (seconds === null) return 'Active';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="operations-view">
      <div className="view-header">
        <div className="header-content">
          <h2>Live Operations</h2>
          <p className="view-subtitle">Monitor real-time activity across all systems</p>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading operations data...</p>
        </div>
      ) : (
        <div className="operations-grid">
          {/* Employee Registers */}
          {registerSessions.slice(0, 2).map((reg, index) => (
            <div key={reg.registerNumber} className="feed-card">
              <div className="feed-header">
                <div className="feed-title">
                  <span className="feed-icon">🖥️</span>
                  <h3>Employee Register {reg.registerNumber}</h3>
                </div>
                <div
                  className="status-indicator"
                  style={{
                    backgroundColor: getStatusColor(reg.active, reg.secondsSinceHeartbeat),
                  }}
                />
              </div>
              <div className="feed-content">
                {reg.active ? (
                  <>
                    <div className="feed-item">
                      <span className="feed-label">Employee:</span>
                      <span className="feed-value">{reg.employee?.displayName || 'Unknown'}</span>
                    </div>
                    <div className="feed-item">
                      <span className="feed-label">Role:</span>
                      <span className="feed-value">{reg.employee?.role || '-'}</span>
                    </div>
                    <div className="feed-item">
                      <span className="feed-label">Device:</span>
                      <span className="feed-value">{reg.deviceId || '-'}</span>
                    </div>
                    <div className="feed-item">
                      <span className="feed-label">Last Update:</span>
                      <span className="feed-value">
                        {formatTimeAgo(reg.secondsSinceHeartbeat)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="feed-inactive">
                    <span className="inactive-text">Not Active</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Customer Kiosks */}
          {customerKioskSessions.slice(0, 2).map((session, index) => (
            <div key={session.id} className="feed-card">
              <div className="feed-header">
                <div className="feed-title">
                  <span className="feed-icon">📱</span>
                  <h3>Customer Kiosk {index + 1}</h3>
                </div>
                <div className="status-indicator" style={{ backgroundColor: '#10b981' }} />
              </div>
              <div className="feed-content">
                <div className="feed-item">
                  <span className="feed-label">Lane:</span>
                  <span className="feed-value">{session.laneId}</span>
                </div>
                {session.customerName && (
                  <div className="feed-item">
                    <span className="feed-label">Customer:</span>
                    <span className="feed-value">{session.customerName}</span>
                  </div>
                )}
                {session.membershipNumber && (
                  <div className="feed-item">
                    <span className="feed-label">Membership:</span>
                    <span className="feed-value">{session.membershipNumber}</span>
                  </div>
                )}
                {session.desiredRentalType && (
                  <div className="feed-item">
                    <span className="feed-label">Rental Type:</span>
                    <span className="feed-value">{session.desiredRentalType}</span>
                  </div>
                )}
                <div className="feed-item">
                  <span className="feed-label">Status:</span>
                  <span className="feed-value">{session.status}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Checkout Kiosk */}
          <div className="feed-card">
            <div className="feed-header">
              <div className="feed-title">
                <span className="feed-icon">🚪</span>
                <h3>Checkout Kiosk</h3>
              </div>
              <div
                className="status-indicator"
                style={{
                  backgroundColor: checkoutKioskActive ? '#10b981' : '#A0A1A2',
                }}
              />
            </div>
            <div className="feed-content">
              {checkoutKioskActive ? (
                <div className="feed-item">
                  <span className="feed-label">Status:</span>
                  <span className="feed-value">Active</span>
                </div>
              ) : (
                <div className="feed-inactive">
                  <span className="inactive-text">Not Active</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
