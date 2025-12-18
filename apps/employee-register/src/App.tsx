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

  // Sample inventory data for display
  const inventoryDemo = {
    [RoomType.STANDARD]: { clean: 12, cleaning: 3, dirty: 5 },
    [RoomType.DELUXE]: { clean: 4, cleaning: 1, dirty: 2 },
    [RoomType.VIP]: { clean: 2, cleaning: 0, dirty: 1 },
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Employee Register</h1>
        <div className="status-badges">
          <span className={`badge ${health?.status === 'ok' ? 'badge-success' : 'badge-error'}`}>
            API: {health?.status ?? '...'}
          </span>
          <span className={`badge ${wsConnected ? 'badge-success' : 'badge-error'}`}>
            WS: {wsConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </header>

      <main className="main">
        <section className="inventory-panel">
          <h2>Room Inventory</h2>
          <div className="inventory-grid">
            {Object.entries(inventoryDemo).map(([type, counts]) => (
              <div key={type} className="inventory-card">
                <h3>{type}</h3>
                <div className="counts">
                  <div className="count count-clean">
                    <span className="count-value">{counts.clean}</span>
                    <span className="count-label">{RoomStatus.CLEAN}</span>
                  </div>
                  <div className="count count-cleaning">
                    <span className="count-value">{counts.cleaning}</span>
                    <span className="count-label">{RoomStatus.CLEANING}</span>
                  </div>
                  <div className="count count-dirty">
                    <span className="count-value">{counts.dirty}</span>
                    <span className="count-label">{RoomStatus.DIRTY}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="actions-panel">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <button className="action-btn">
              <span className="btn-icon">🏷️</span>
              Assign Room
            </button>
            <button className="action-btn">
              <span className="btn-icon">🔑</span>
              Assign Locker
            </button>
            <button className="action-btn">
              <span className="btn-icon">📋</span>
              New Session
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Employee-facing tablet • Runs alongside Square POS</p>
      </footer>
    </div>
  );
}

export default App;

