import { useState, useEffect } from 'react';
import { STORE_CATALOG, normalizeStoreCart, storeCartToLineItems, sumLineItems, type StoreCart } from '@club-ops/shared';
import { getApiUrl } from '@/lib/apiBase';

export interface StorePurchaseModalProps {
  isOpen: boolean;
  visitId: string;
  sessionToken: string | null | undefined;
  registerNumber: number;
  onClose: () => void;
  onPurchaseComplete: () => void;
}

const API_BASE = getApiUrl('/api');

export function StorePurchaseModal({
  isOpen,
  visitId,
  sessionToken,
  registerNumber,
  onClose,
  onPurchaseComplete,
}: StorePurchaseModalProps) {
  const [cart, setCart] = useState<StoreCart>({});
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCart({});
      setPaymentIntentId(null);
      setTotal(0);
      setError(null);
    }
  }, [isOpen]);

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const newQty = Math.max(0, (prev[itemId] || 0) + delta);
      const newCart = { ...prev };
      if (newQty > 0) {
        newCart[itemId] = newQty;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const lineItems = storeCartToLineItems(cart);
  const subtotal = sumLineItems(lineItems);

  const handleCreatePaymentIntent = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const normalizedCart = normalizeStoreCart(cart);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`${API_BASE}/v1/visits/${encodeURIComponent(visitId)}/store/create-payment-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          storeCart: normalizedCart,
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(
          errorPayload && typeof errorPayload === 'object' && 'error' in errorPayload
            ? String(errorPayload.error)
            : 'Failed to create payment intent'
        );
      }

      const data = await response.json();
      if (data.paymentIntentId && typeof data.total === 'number') {
        setPaymentIntentId(data.paymentIntentId);
        setTotal(data.total);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment intent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkPaid = async (paymentMethod: 'CASH' | 'CREDIT') => {
    if (!paymentIntentId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`${API_BASE}/v1/payments/${encodeURIComponent(paymentIntentId)}/mark-paid`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          paymentMethod,
          registerNumber,
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(
          errorPayload && typeof errorPayload === 'object' && 'error' in errorPayload
            ? String(errorPayload.error)
            : 'Failed to mark payment as paid'
        );
      }

      onPurchaseComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark payment as paid');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="cs-liquid-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: 600,
          maxHeight: '80vh',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          overflow: 'hidden',
        }}
      >
        <h2 style={{ fontWeight: 950, fontSize: '1.2rem', margin: 0 }}>New Purchase</h2>
        {error && (
          <div
            className="cs-liquid-card"
            style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fecaca',
              fontWeight: 800,
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}
        {!paymentIntentId ? (
          <>
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
              {STORE_CATALOG.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontWeight: 900 }}>{item.name}</span>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 800 }}>
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="cs-liquid-button"
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        disabled={qty === 0 || isSubmitting}
                        style={{ padding: '0.5rem 0.75rem', minWidth: 40 }}
                      >
                        −
                      </button>
                      <span style={{ minWidth: 30, textAlign: 'center', fontWeight: 900 }}>{qty}</span>
                      <button
                        type="button"
                        className="cs-liquid-button"
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        disabled={isSubmitting}
                        style={{ padding: '0.5rem 0.75rem', minWidth: 40 }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {subtotal > 0 && (
              <div
                style={{
                  padding: '0.75rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 950,
                }}
              >
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="cs-liquid-button cs-liquid-button--secondary"
                onClick={onClose}
                disabled={isSubmitting}
                style={{ padding: '0.75rem 1.5rem', fontWeight: 900 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cs-liquid-button"
                onClick={handleCreatePaymentIntent}
                disabled={isSubmitting || subtotal === 0}
                style={{ padding: '0.75rem 1.5rem', fontWeight: 900 }}
              >
                {isSubmitting ? 'Creating...' : 'Create payment intent'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                padding: '0.85rem',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '0.5rem',
              }}
            >
              <div style={{ fontWeight: 950, marginBottom: '0.5rem' }}>Total</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950 }}>${total.toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="cs-liquid-button"
                onClick={() => handleMarkPaid('CASH')}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '1rem', fontWeight: 950 }}
              >
                Mark Paid (Cash)
              </button>
              <button
                type="button"
                className="cs-liquid-button"
                onClick={() => handleMarkPaid('CREDIT')}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '1rem', fontWeight: 950 }}
              >
                Mark Paid (Card)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
