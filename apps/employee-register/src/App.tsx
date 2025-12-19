import { useEffect, useState, useRef } from 'react';
import { RoomStatus, RoomType } from '@club-ops/shared';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [scanMode, setScanMode] = useState<'id' | 'membership' | null>(null);
  const [scanBuffer, setScanBuffer] = useState('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle barcode scanner input (keyboard wedge mode)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Barcode scanners typically send characters quickly and end with Enter
      if (e.key === 'Enter' && scanBuffer.trim()) {
        const scannedValue = scanBuffer.trim();
        handleScan(scannedValue);
        setScanBuffer('');
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Accumulate characters (barcode scanner input)
        setScanBuffer(prev => prev + e.key);
        
        // Clear buffer after 1 second of no input (normal typing)
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = setTimeout(() => {
          setScanBuffer('');
        }, 1000);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [scanBuffer]);

  const handleScan = async (scannedValue: string) => {
    if (!scanMode) {
      // Auto-detect: if it looks like a UUID, treat as ID; otherwise membership number
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scannedValue);
      const mode = isUuid ? 'id' : 'membership';
      setScanMode(mode);
      await sendScan(mode, scannedValue);
    } else {
      await sendScan(scanMode, scannedValue);
    }
  };

  const sendScan = async (mode: 'id' | 'membership', value: string) => {
    try {
      const endpoint = mode === 'id' 
        ? '/api/v1/sessions/scan-id'
        : '/api/v1/sessions/scan-membership';
      
      const body = mode === 'id'
        ? { idNumber: value }
        : { membershipNumber: value };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Scan failed:', error);
        alert(`Scan failed: ${error.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      console.log('Scan successful:', data);
      // Reset scan mode after successful scan
      setScanMode(null);
    } catch (error) {
      console.error('Failed to send scan:', error);
      alert('Failed to process scan. Please try again.');
    }
  };

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
            <button 
              className={`action-btn ${scanMode === 'id' ? 'active' : ''}`}
              onClick={() => setScanMode(scanMode === 'id' ? null : 'id')}
            >
              <span className="btn-icon">🆔</span>
              {scanMode === 'id' ? 'Scanning ID...' : 'Scan ID'}
            </button>
            <button 
              className={`action-btn ${scanMode === 'membership' ? 'active' : ''}`}
              onClick={() => setScanMode(scanMode === 'membership' ? null : 'membership')}
            >
              <span className="btn-icon">🏷️</span>
              {scanMode === 'membership' ? 'Scanning Membership...' : 'Scan Membership'}
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
          {scanMode && (
            <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f0f0f0', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {scanMode === 'id' ? 'Ready to scan ID' : 'Ready to scan membership card'}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                Point barcode scanner and scan
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>Employee-facing tablet • Runs alongside Square POS</p>
      </footer>
    </div>
  );
}

export default App;

