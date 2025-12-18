import { useEffect, useState } from 'react';

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

  return (
    <div className="container">
      <header className="header">
        <h1>Customer Kiosk</h1>
        <p className="subtitle">Welcome to Club Operations</p>
      </header>

      <main className="main">
        <div className="card">
          <h2>Check-In</h2>
          <p>Scan your membership card or enter your number below.</p>
          <div className="placeholder-content">
            <span className="icon">🏷️</span>
            <p>Membership scanner placeholder</p>
          </div>
        </div>

        <div className="status-panel">
          <h3>System Status</h3>
          <div className="status-item">
            <span>API:</span>
            <span className={health?.status === 'ok' ? 'status-ok' : 'status-error'}>
              {health?.status ?? 'Checking...'}
            </span>
          </div>
          <div className="status-item">
            <span>WebSocket:</span>
            <span className={wsConnected ? 'status-ok' : 'status-error'}>
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Tablet-based kiosk • Locked single-app experience</p>
      </footer>
    </div>
  );
}

export default App;

