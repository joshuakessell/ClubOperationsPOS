import { useEffect, useState } from 'react';
import type { SessionUpdatedPayload, WebSocketEvent } from '@club-ops/shared';
import logoImage from './assets/the-clubs-logo.png';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}

interface SessionState {
  customerName: string | null;
  membershipNumber: string | null;
  allowedRentals: string[];
}

// Map rental types to display names
function getRentalDisplayName(rental: string): string {
  switch (rental) {
    case 'LOCKER':
      return 'Locker';
    case 'STANDARD':
      return 'Regular Room';
    case 'DELUXE':
      return 'Deluxe Room';
    case 'GYM_LOCKER':
      return 'Gym Locker';
    default:
      return rental;
  }
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [session, setSession] = useState<SessionState>({
    customerName: null,
    membershipNumber: null,
    allowedRentals: [],
  });

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
      try {
        const message: WebSocketEvent = JSON.parse(event.data);
        console.log('WebSocket message:', message);

        if (message.type === 'SESSION_UPDATED') {
          const payload = message.payload as SessionUpdatedPayload;
          setSession({
            customerName: payload.customerName,
            membershipNumber: payload.membershipNumber || null,
            allowedRentals: payload.allowedRentals,
          });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    return () => ws.close();
  }, []);

  const hasActiveSession = !!session.customerName;

  // Idle state: logo only, centered
  if (!hasActiveSession) {
    return (
      <div className="idle-container">
        <img src={logoImage} alt="The Clubs" className="logo-idle" />
      </div>
    );
  }

  // Active session state: logo in top-left, customer info and options
  return (
    <div className="active-container">
      <img src={logoImage} alt="The Clubs" className="logo-header" />
      
      <main className="main-content">
        <div className="customer-info">
          <h1 className="customer-name">{session.customerName}</h1>
          {session.membershipNumber && (
            <p className="membership-number">Membership: {session.membershipNumber}</p>
          )}
        </div>

        <div className="package-options">
          {session.allowedRentals.map((rental) => (
            <div key={rental} className="package-option">
              <div className="package-name">{getRentalDisplayName(rental)}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;

