import { useEffect, useState } from 'react';
import { RoomStatus, RoomType } from '@club-ops/shared';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'rooms' | 'lockers' | 'staff'>('rooms');

  useEffect(() => {
    // Check API health
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: HealthStatus) => setHealth(data))
      .catch(console.error);

    // Connect to WebSocket
    const ws = new WebSocket(`ws://${window.location.hostname}:3001/ws`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };

    ws.onmessage = (event) => {
      console.log('WebSocket message:', event.data);
    };

    return () => ws.close();
  }, []);

  // Demo data for dashboard
  const summaryStats = {
    totalRooms: 50,
    available: 18,
    occupied: 25,
    cleaning: 7,
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">🏢</span>
          <span className="logo-text">Club Ops</span>
        </div>
        <nav className="nav">
          <button
            className={`nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            🚪 Rooms
          </button>
          <button
            className={`nav-item ${activeTab === 'lockers' ? 'active' : ''}`}
            onClick={() => setActiveTab('lockers')}
          >
            🔐 Lockers
          </button>
          <button
            className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            👥 Staff
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="connection-status">
            <span className={`dot ${wsConnected ? 'dot-live' : 'dot-offline'}`}></span>
            <span>{wsConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <h1>Office Dashboard</h1>
          <div className="topbar-status">
            <span className="api-status">
              API: <strong className={health?.status === 'ok' ? 'text-success' : 'text-error'}>
                {health?.status ?? 'checking...'}
              </strong>
            </span>
          </div>
        </header>

        <div className="content">
          <section className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{summaryStats.totalRooms}</span>
              <span className="stat-label">Total Rooms</span>
            </div>
            <div className="stat-card stat-available">
              <span className="stat-value">{summaryStats.available}</span>
              <span className="stat-label">{RoomStatus.CLEAN}</span>
            </div>
            <div className="stat-card stat-occupied">
              <span className="stat-value">{summaryStats.occupied}</span>
              <span className="stat-label">Occupied</span>
            </div>
            <div className="stat-card stat-cleaning">
              <span className="stat-value">{summaryStats.cleaning}</span>
              <span className="stat-label">{RoomStatus.CLEANING}</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Overview</h2>
              <button className="btn-override">⚡ Override Mode</button>
            </div>
            <div className="panel-content">
              <div className="placeholder">
                <span className="placeholder-icon">📊</span>
                <p>
                  {activeTab === 'rooms' && 'Room grid view with status indicators'}
                  {activeTab === 'lockers' && 'Locker allocation matrix'}
                  {activeTab === 'staff' && 'Staff activity and shift assignments'}
                </p>
                <p className="placeholder-hint">
                  Room types: {Object.values(RoomType).join(', ')}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;

