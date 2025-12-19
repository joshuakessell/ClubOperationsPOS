import { useEffect, useState, useRef } from 'react';
import { RoomStatus, RoomType, CheckinMode, type ActiveVisit, type CheckoutRequestSummary, type CheckoutChecklist, type WebSocketEvent, type CheckoutRequestedPayload, type CheckoutClaimedPayload, type CheckoutUpdatedPayload } from '@club-ops/shared';
import { LockScreen, type StaffSession } from './LockScreen';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}

const API_BASE = '/api';

function App() {
  const [session, setSession] = useState<StaffSession | null>(() => {
    // Load session from localStorage on mount
    const stored = localStorage.getItem('staff_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [scanMode, setScanMode] = useState<'id' | 'membership' | null>(null);
  const [scanBuffer, setScanBuffer] = useState('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [membershipNumber, setMembershipNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [agreementSigned, setAgreementSigned] = useState(false);
  const [checkinMode, setCheckinMode] = useState<CheckinMode>(CheckinMode.INITIAL);
  const [selectedVisit, setSelectedVisit] = useState<ActiveVisit | null>(null);
  const [showRenewalSearch, setShowRenewalSearch] = useState(false);
  const [renewalSearchQuery, setRenewalSearchQuery] = useState('');
  const [renewalSearchResults, setRenewalSearchResults] = useState<ActiveVisit[]>([]);
  const [showRenewalDisclaimer, setShowRenewalDisclaimer] = useState(false);
  const [selectedRentalType, setSelectedRentalType] = useState<string | null>(null);
  const [checkoutRequests, setCheckoutRequests] = useState<Map<string, CheckoutRequestSummary>>(new Map());
  const [selectedCheckoutRequest, setSelectedCheckoutRequest] = useState<string | null>(null);
  const [checkoutChecklist, setCheckoutChecklist] = useState<CheckoutChecklist>({});
  const [checkoutItemsConfirmed, setCheckoutItemsConfirmed] = useState(false);
  const [checkoutFeePaid, setCheckoutFeePaid] = useState(false);
  const [lane] = useState(() => {
    // Get lane from URL query param or localStorage, default to 'lane-1'
    const params = new URLSearchParams(window.location.search);
    return params.get('lane') || localStorage.getItem('lane') || 'lane-1';
  });

  const deviceId = useState(() => {
    // Generate or retrieve device ID
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = `device-${crypto.randomUUID()}`;
      localStorage.setItem('device_id', id);
    }
    return id;
  })[0];

  const handleLogin = (newSession: StaffSession) => {
    setSession(newSession);
    localStorage.setItem('staff_session', JSON.stringify(newSession));
  };

  const handleLogout = async () => {
    if (session?.sessionToken) {
      try {
        await fetch(`${API_BASE}/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.sessionToken}`,
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    setSession(null);
    localStorage.removeItem('staff_session');
  };

  // Show lock screen if not authenticated
  if (!session) {
    return (
      <LockScreen
        onLogin={handleLogin}
        deviceType="tablet"
        deviceId={deviceId}
      />
    );
  }

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
    if (!session?.sessionToken) {
      alert('Not authenticated');
      return;
    }

    try {
      // For ID scan, we'll extract name from the scan (simplified - in production, parse ID format)
      // For membership scan, we'll update the membership number
      if (mode === 'id') {
        // Simplified: treat scanned ID as customer name for now
        // In production, parse ID format to extract name
        await updateLaneSession(value, null);
      } else {
        // Membership scan - update existing session with membership number
        // First get current session or use a placeholder name
        await updateLaneSession(customerName || 'Customer', value);
      }

      // Reset scan mode after successful scan
      setScanMode(null);
    } catch (error) {
      console.error('Failed to send scan:', error);
      alert('Failed to process scan. Please try again.');
    }
  };

  const updateLaneSession = async (name: string, membership: string | null) => {
    if (!session?.sessionToken) {
      alert('Not authenticated');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/v1/lanes/${lane}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({
          customerName: name,
          membershipNumber: membership,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update session');
      }

      const data = await response.json();
      console.log('Session updated:', data);
      
      // Update local state
      if (name) setCustomerName(name);
      if (membership !== null) setMembershipNumber(membership || '');
      if (data.sessionId) setCurrentSessionId(data.sessionId);
      
      // Fetch agreement status if session ID is available
      if (data.sessionId) {
        fetchAgreementStatus(data.sessionId);
      }
      
      // Clear manual entry mode if active
      if (manualEntry) {
        setManualEntry(false);
      }
    } catch (error) {
      console.error('Failed to update session:', error);
      alert(error instanceof Error ? error.message : 'Failed to update session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Please enter customer name');
      return;
    }
    await updateLaneSession(customerName.trim(), membershipNumber.trim() || null);
  };

  const fetchAgreementStatus = async (sessionId: string) => {
    if (!session?.sessionToken) return;

    try {
      const response = await fetch(`${API_BASE}/v1/sessions/active`, {
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const activeSession = data.sessions?.find((s: { id: string }) => s.id === sessionId);
        if (activeSession) {
          setAgreementSigned(activeSession.agreementSigned || false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch agreement status:', error);
    }
  };

  const handleClearSession = async () => {
    if (!session?.sessionToken) {
      alert('Not authenticated');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/v1/lanes/${lane}/clear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to clear session');
      }

      setCustomerName('');
      setMembershipNumber('');
      setCurrentSessionId(null);
      setAgreementSigned(false);
      setManualEntry(false);
      setSelectedVisit(null);
      setCheckinMode(CheckinMode.INITIAL);
      setShowRenewalSearch(false);
      console.log('Session cleared');
    } catch (error) {
      console.error('Failed to clear session:', error);
      alert('Failed to clear session');
    }
  };

  const handleSearchActiveVisits = async () => {
    if (!session?.sessionToken || !renewalSearchQuery.trim()) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/v1/visits/active?query=${encodeURIComponent(renewalSearchQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.sessionToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to search visits');
      }

      const data = await response.json();
      setRenewalSearchResults(data.visits || []);
    } catch (error) {
      console.error('Failed to search visits:', error);
      alert('Failed to search visits');
    }
  };

  const handleSelectVisit = (visit: ActiveVisit) => {
    setSelectedVisit(visit);
    setCustomerName(visit.customerName);
    setMembershipNumber(visit.membershipNumber || '');
    setShowRenewalSearch(false);
    setRenewalSearchQuery('');
    setRenewalSearchResults([]);
  };

  const handleCreateVisit = async (rentalType: string, roomId?: string, lockerId?: string) => {
    if (!session?.sessionToken) {
      alert('Not authenticated');
      return;
    }

    if (checkinMode === CheckinMode.RENEWAL && !selectedVisit) {
      alert('Please select a visit to renew');
      return;
    }

    setIsSubmitting(true);
    try {
      if (checkinMode === CheckinMode.RENEWAL && selectedVisit) {
        // Show renewal disclaimer before proceeding
        setSelectedRentalType(rentalType);
        setShowRenewalDisclaimer(true);
        setIsSubmitting(false);
        return;
      }

      // For initial check-in, we need member ID - for now, use lane session approach
      // In production, this would look up member by name/membership
      await updateLaneSession(customerName, membershipNumber || null);
    } catch (error) {
      console.error('Failed to create visit:', error);
      alert('Failed to create visit');
      setIsSubmitting(false);
    }
  };

  const handleClaimCheckout = async (requestId: string) => {
    if (!session?.sessionToken) {
      alert('Not authenticated');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/v1/checkout/${requestId}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to claim checkout');
      }

      const data = await response.json();
      setSelectedCheckoutRequest(requestId);
      
      // Fetch the checkout request details to get checklist
      // For now, we'll get it from the request summary
      const request = checkoutRequests.get(requestId);
      if (request) {
        // We'll need to fetch the full request details to get the checklist
        // For now, initialize empty checklist
        setCheckoutChecklist({});
        setCheckoutItemsConfirmed(false);
        setCheckoutFeePaid(false);
      }
    } catch (error) {
      console.error('Failed to claim checkout:', error);
      alert(error instanceof Error ? error.message : 'Failed to claim checkout');
    }
  };

  const handleConfirmItems = async (requestId: string) => {
    if (!session?.sessionToken) {
      alert('Not authenticated');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/v1/checkout/${requestId}/confirm-items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to confirm items');
      }

      setCheckoutItemsConfirmed(true);
    } catch (error) {
      console.error('Failed to confirm items:', error);
      alert(error instanceof Error ? error.message : 'Failed to confirm items');
    }
  };

  const handleMarkFeePaid = async (requestId: string) => {
    if (!session?.sessionToken) {
      alert('Not authenticated');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/v1/checkout/${requestId}/mark-fee-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark fee as paid');
      }

      setCheckoutFeePaid(true);
    } catch (error) {
      console.error('Failed to mark fee as paid:', error);
      alert(error instanceof Error ? error.message : 'Failed to mark fee as paid');
    }
  };

  const handleCompleteCheckout = async (requestId: string) => {
    if (!session?.sessionToken) {
      alert('Not authenticated');
      return;
    }

    if (!checkoutItemsConfirmed) {
      alert('Please confirm items returned first');
      return;
    }

    const request = checkoutRequests.get(requestId);
    if (request && request.lateFeeAmount > 0 && !checkoutFeePaid) {
      alert('Please mark late fee as paid first');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/v1/checkout/${requestId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete checkout');
      }

      // Reset checkout state
      setSelectedCheckoutRequest(null);
      setCheckoutChecklist({});
      setCheckoutItemsConfirmed(false);
      setCheckoutFeePaid(false);
    } catch (error) {
      console.error('Failed to complete checkout:', error);
      alert(error instanceof Error ? error.message : 'Failed to complete checkout');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenewalDisclaimerAcknowledge = async () => {
    if (!session?.sessionToken || !selectedVisit || !selectedRentalType) {
      return;
    }

    setIsSubmitting(true);
    setShowRenewalDisclaimer(false);

    try {
      const response = await fetch(`${API_BASE}/v1/visits/${selectedVisit.id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({
          rentalType: selectedRentalType,
          lane,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to renew visit');
      }

      const data = await response.json();
      setCurrentSessionId(data.sessionId);
      setSelectedRentalType(null);
      alert('Renewal created successfully');
    } catch (error) {
      console.error('Failed to renew visit:', error);
      alert(error instanceof Error ? error.message : 'Failed to renew visit');
    } finally {
      setIsSubmitting(false);
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
      
      // Subscribe to checkout events
      ws.send(JSON.stringify({
        type: 'subscribe',
        events: ['CHECKOUT_REQUESTED', 'CHECKOUT_CLAIMED', 'CHECKOUT_UPDATED', 'CHECKOUT_COMPLETED'],
      }));
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketEvent = JSON.parse(event.data);
        console.log('WebSocket message:', message);

        if (message.type === 'CHECKOUT_REQUESTED') {
          const payload = message.payload as CheckoutRequestedPayload;
          setCheckoutRequests(prev => {
            const next = new Map(prev);
            next.set(payload.request.requestId, payload.request);
            return next;
          });
        } else if (message.type === 'CHECKOUT_CLAIMED') {
          const payload = message.payload as CheckoutClaimedPayload;
          setCheckoutRequests(prev => {
            const next = new Map(prev);
            next.delete(payload.requestId);
            return next;
          });
          // If this is our claim, we might want to show the verification screen
        } else if (message.type === 'CHECKOUT_UPDATED') {
          const payload = message.payload as CheckoutUpdatedPayload;
          if (selectedCheckoutRequest === payload.requestId) {
            setCheckoutItemsConfirmed(payload.itemsConfirmed);
            setCheckoutFeePaid(payload.feePaid);
          }
        } else if (message.type === 'CHECKOUT_COMPLETED') {
          setCheckoutRequests(prev => {
            const next = new Map(prev);
            next.delete(message.payload.requestId);
            return next;
          });
          if (selectedCheckoutRequest === message.payload.requestId) {
            setSelectedCheckoutRequest(null);
            setCheckoutChecklist({});
            setCheckoutItemsConfirmed(false);
            setCheckoutFeePaid(false);
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    return () => ws.close();
  }, [selectedCheckoutRequest]);

  // Sample inventory data for display
  const inventoryDemo = {
    [RoomType.STANDARD]: { clean: 12, cleaning: 3, dirty: 5 },
    [RoomType.DELUXE]: { clean: 4, cleaning: 1, dirty: 2 },
    [RoomType.VIP]: { clean: 2, cleaning: 0, dirty: 1 },
  };

  return (
    <div className="container">
      {/* Checkout Request Notifications */}
      {checkoutRequests.size > 0 && !selectedCheckoutRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#1e293b',
          borderBottom: '2px solid #3b82f6',
          zIndex: 1000,
          padding: '1rem',
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          {Array.from(checkoutRequests.values()).map((request) => {
            const lateMinutes = request.lateMinutes;
            const feeAmount = request.lateFeeAmount;
            const banApplied = request.banApplied;
            
            return (
              <div
                key={request.requestId}
                onClick={() => handleClaimCheckout(request.requestId)}
                style={{
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  background: '#0f172a',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#1e293b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#0f172a';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                      {request.customerName}
                      {request.membershipNumber && ` (${request.membershipNumber})`}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                      {request.rentalType} • {request.roomNumber || request.lockerNumber || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      Scheduled: {new Date(request.scheduledCheckoutAt).toLocaleString()} • 
                      Current: {new Date(request.currentTime).toLocaleString()} • 
                      {lateMinutes > 0 ? (
                        <span style={{ color: '#f59e0b' }}>{lateMinutes} min late</span>
                      ) : (
                        <span>On time</span>
                      )}
                    </div>
                    {feeAmount > 0 && (
                      <div style={{ fontSize: '0.875rem', color: '#f59e0b', marginTop: '0.25rem', fontWeight: 600 }}>
                        Late fee: ${feeAmount.toFixed(2)}
                        {banApplied && ' • 30-day ban applied'}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClaimCheckout(request.requestId);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Claim
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Checkout Verification Screen */}
      {selectedCheckoutRequest && (() => {
        const request = checkoutRequests.get(selectedCheckoutRequest);
        if (!request) return null;
        
        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}>
            <div style={{
              background: '#1e293b',
              border: '2px solid #3b82f6',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}>
              <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
                Checkout Verification
              </h2>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Customer:</strong> {request.customerName}
                  {request.membershipNumber && ` (${request.membershipNumber})`}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Rental:</strong> {request.rentalType} • {request.roomNumber || request.lockerNumber || 'N/A'}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Scheduled Checkout:</strong> {new Date(request.scheduledCheckoutAt).toLocaleString()}
                </div>
                {request.lateMinutes > 0 && (
                  <div style={{ marginBottom: '0.5rem', color: '#f59e0b' }}>
                    <strong>Late:</strong> {request.lateMinutes} minutes
                  </div>
                )}
                {request.lateFeeAmount > 0 && (
                  <div style={{ marginBottom: '0.5rem', color: '#f59e0b', fontWeight: 600 }}>
                    <strong>Late Fee:</strong> ${request.lateFeeAmount.toFixed(2)}
                    {request.banApplied && ' • 30-day ban applied'}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#0f172a', borderRadius: '8px' }}>
                <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Customer Checklist:</div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                  (Items customer marked as returned)
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <button
                  onClick={() => handleConfirmItems(selectedCheckoutRequest)}
                  disabled={checkoutItemsConfirmed}
                  style={{
                    padding: '0.75rem',
                    background: checkoutItemsConfirmed ? '#10b981' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: checkoutItemsConfirmed ? 'default' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {checkoutItemsConfirmed ? '✓ Items Confirmed' : 'Confirm Items Returned'}
                </button>

                {request.lateFeeAmount > 0 && (
                  <button
                    onClick={() => handleMarkFeePaid(selectedCheckoutRequest)}
                    disabled={checkoutFeePaid}
                    style={{
                      padding: '0.75rem',
                      background: checkoutFeePaid ? '#10b981' : '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: checkoutFeePaid ? 'default' : 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {checkoutFeePaid ? '✓ Fee Marked Paid' : 'Mark Late Fee Paid'}
                  </button>
                )}

                <button
                  onClick={() => handleCompleteCheckout(selectedCheckoutRequest)}
                  disabled={!checkoutItemsConfirmed || (request.lateFeeAmount > 0 && !checkoutFeePaid) || isSubmitting}
                  style={{
                    padding: '0.75rem',
                    background: (!checkoutItemsConfirmed || (request.lateFeeAmount > 0 && !checkoutFeePaid)) ? '#475569' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (!checkoutItemsConfirmed || (request.lateFeeAmount > 0 && !checkoutFeePaid)) ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {isSubmitting ? 'Processing...' : 'Complete Checkout'}
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedCheckoutRequest(null);
                  setCheckoutChecklist({});
                  setCheckoutItemsConfirmed(false);
                  setCheckoutFeePaid(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      <header className="header">
        <h1>Employee Register</h1>
        <div className="status-badges">
          <span className={`badge ${health?.status === 'ok' ? 'badge-success' : 'badge-error'}`}>
            API: {health?.status ?? '...'}
          </span>
          <span className={`badge ${wsConnected ? 'badge-success' : 'badge-error'}`}>
            WS: {wsConnected ? 'Live' : 'Offline'}
          </span>
          <span className="badge badge-info">Lane: {lane}</span>
          <span className="badge badge-info">{session.name} ({session.role})</span>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.375rem 0.75rem',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid var(--error)',
              borderRadius: '9999px',
              color: 'var(--error)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="main">
        {/* Mode Toggle */}
        <section className="mode-toggle-section" style={{ marginBottom: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
          <h2 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Check-in Mode</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                setCheckinMode(CheckinMode.INITIAL);
                setSelectedVisit(null);
                setShowRenewalSearch(false);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: checkinMode === CheckinMode.INITIAL ? '#3b82f6' : '#e5e7eb',
                color: checkinMode === CheckinMode.INITIAL ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Initial Check-in
            </button>
            <button
              onClick={() => {
                setCheckinMode(CheckinMode.RENEWAL);
                setShowRenewalSearch(true);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: checkinMode === CheckinMode.RENEWAL ? '#3b82f6' : '#e5e7eb',
                color: checkinMode === CheckinMode.RENEWAL ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Renewal
            </button>
          </div>
        </section>

        {/* Renewal Visit Search */}
        {checkinMode === CheckinMode.RENEWAL && showRenewalSearch && (
          <section className="renewal-search-section" style={{ marginBottom: '1rem', padding: '1rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Select Visit to Renew</h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={renewalSearchQuery}
                onChange={(e) => setRenewalSearchQuery(e.target.value)}
                placeholder="Search by membership # or customer name"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchActiveVisits();
                  }
                }}
              />
              <button
                onClick={handleSearchActiveVisits}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Search
              </button>
            </div>
            {renewalSearchResults.length > 0 && (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {renewalSearchResults.map((visit) => (
                  <div
                    key={visit.id}
                    onClick={() => handleSelectVisit(visit)}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      background: selectedVisit?.id === visit.id ? '#dbeafe' : '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{visit.customerName}</div>
                    {visit.membershipNumber && (
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Membership: {visit.membershipNumber}
                      </div>
                    )}
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Checkout: {new Date(visit.currentCheckoutAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedVisit && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#dbeafe', borderRadius: '6px' }}>
                <strong>Selected:</strong> {selectedVisit.customerName} - Checkout: {new Date(selectedVisit.currentCheckoutAt).toLocaleString()}
              </div>
            )}
          </section>
        )}

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
          <h2>Lane Session</h2>
          <div className="action-buttons">
            <button 
              className={`action-btn ${scanMode === 'id' ? 'active' : ''}`}
              onClick={() => {
                setScanMode(scanMode === 'id' ? null : 'id');
                setManualEntry(false);
              }}
            >
              <span className="btn-icon">🆔</span>
              {scanMode === 'id' ? 'Scanning ID...' : 'Scan ID'}
            </button>
            <button 
              className={`action-btn ${scanMode === 'membership' ? 'active' : ''}`}
              onClick={() => {
                setScanMode(scanMode === 'membership' ? null : 'membership');
                setManualEntry(false);
              }}
            >
              <span className="btn-icon">🏷️</span>
              {scanMode === 'membership' ? 'Scanning Membership...' : 'Scan Membership'}
            </button>
            <button 
              className={`action-btn ${manualEntry ? 'active' : ''}`}
              onClick={() => {
                setManualEntry(!manualEntry);
                setScanMode(null);
              }}
            >
              <span className="btn-icon">✏️</span>
              Manual Entry
            </button>
            <button 
              className="action-btn"
              onClick={handleClearSession}
              disabled={isSubmitting}
            >
              <span className="btn-icon">🗑️</span>
              Clear Session
            </button>
          </div>
          
          {scanMode && (
            <div className="scan-status">
              <p>
                {scanMode === 'id' ? 'Ready to scan ID' : 'Ready to scan membership card'}
              </p>
              <p className="scan-hint">
                Point barcode scanner and scan, or press Enter
              </p>
            </div>
          )}

          {manualEntry && (
            <form className="manual-entry-form" onSubmit={handleManualSubmit}>
              <div className="form-group">
                <label htmlFor="customerName">Customer Name *</label>
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="membershipNumber">Membership Number (optional)</label>
                <input
                  id="membershipNumber"
                  type="text"
                  value={membershipNumber}
                  onChange={(e) => setMembershipNumber(e.target.value)}
                  placeholder="Enter membership number"
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isSubmitting || !customerName.trim()}
                >
                  {isSubmitting ? 'Submitting...' : 'Update Session'}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    setManualEntry(false);
                    setCustomerName('');
                    setMembershipNumber('');
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {(customerName || membershipNumber) && !manualEntry && (
            <div className="current-session">
              <p><strong>Current Session:</strong></p>
              <p>Name: {customerName || 'Not set'}</p>
              {membershipNumber && <p>Membership: {membershipNumber}</p>}
              {currentSessionId && (
                <p className={agreementSigned ? 'agreement-status signed' : 'agreement-status unsigned'}>
                  {agreementSigned ? 'Agreement signed ✓' : 'Agreement pending'}
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>Employee-facing tablet • Runs alongside Square POS</p>
      </footer>

      {/* Renewal Disclaimer Modal */}
      {showRenewalDisclaimer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowRenewalDisclaimer(false)}
        >
          <div
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Renewal Notice</h2>
            <div style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  This is a renewal that extends your stay for another 6 hours from your current checkout time.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  You are nearing the 14-hour maximum stay for a single visit.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  At the end of this 6-hour renewal, you may extend one final time for 2 additional hours for a flat $20 fee (same for lockers or any room type).
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  The $20 fee is not charged now; it applies only if you choose the final 2-hour extension later.
                </li>
              </ul>
            </div>
            <button
              onClick={handleRenewalDisclaimerAcknowledge}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Processing...' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

