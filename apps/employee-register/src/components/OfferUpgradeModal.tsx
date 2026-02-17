import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, Spinner } from '@club-ops/ui/tailadmin';
import { getApiUrl } from '@club-ops/shared';

const API_BASE = getApiUrl('/api');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const msg = value['message'];
  const err = value['error'];
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof err === 'string' && err.trim()) return err;
  return undefined;
}

type OfferableRoom = {
  id: string;
  number: string;
  type: string;
};

export function OfferUpgradeModal(props: {
  isOpen: boolean;
  onClose: () => void;
  sessionToken: string;
  waitlistId: string;
  desiredTier: 'STANDARD' | 'DOUBLE' | 'SPECIAL';
  customerLabel?: string;
  heldRoom?: { id: string; number: string } | null;
  disabled?: boolean;
  onOffered: () => void;
}) {
  const {
    isOpen,
    onClose,
    sessionToken,
    waitlistId,
    desiredTier,
    customerLabel,
    heldRoom = null,
    disabled,
    onOffered,
  } = props;

  const [rooms, setRooms] = useState<OfferableRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    const label = customerLabel ? ` for ${customerLabel}` : '';
    return `Offer ${desiredTier} Upgrade${label}`;
  }, [customerLabel, desiredTier]);

  const fetchOfferable = async () => {
    if (heldRoom) {
      setRooms([{ id: heldRoom.id, number: heldRoom.number, type: desiredTier }]);
      setSelectedRoomId(heldRoom.id);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/v1/rooms/offerable?tier=${encodeURIComponent(desiredTier)}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );
      if (!res.ok) {
        const payload: unknown = await res.json().catch(() => null);
        throw new Error(getErrorMessage(payload) || 'Failed to load offerable rooms');
      }
      const data: unknown = await res.json().catch(() => null);
      const list = isRecord(data) && Array.isArray(data.rooms) ? data.rooms : [];
      const rooms = list
        .filter(isRecord)
        .filter(
          (r) =>
            typeof r.id === 'string' && typeof r.number === 'string' && typeof r.type === 'string'
        )
        .map((r) => ({ id: r.id as string, number: r.number as string, type: r.type as string }));
      setRooms(rooms);
      setSelectedRoomId(rooms[0]?.id ?? null);
    } catch (e) {
      setRooms([]);
      setSelectedRoomId(null);
      setError(e instanceof Error ? e.message : 'Failed to load offerable rooms');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void fetchOfferable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, desiredTier, waitlistId, heldRoom?.id]);

  const handleConfirm = async () => {
    if (!selectedRoomId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/waitlist/${waitlistId}/offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ roomId: selectedRoomId }),
      });
      if (!res.ok) {
        const payload: unknown = await res.json().catch(() => null);
        const msg = getErrorMessage(payload) || 'Failed to offer upgrade';
        if (res.status === 409) {
          setError(msg);
          await fetchOfferable();
          return;
        }
        throw new Error(msg);
      }

      onOffered();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to offer upgrade');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-6 lg:p-8">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h2>
      </div>

      {disabled && (
        <div className="mb-3">
          <Alert
            variant="warning"
            title="Disabled"
            message="Active session present — offering is disabled"
          />
        </div>
      )}

      {error && (
        <div className="mb-3">
          <Alert variant="error" title="Error" message={error} />
        </div>
      )}

      {/* Body */}
      <div className="mb-5">
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          Select a room to reserve for this offer:
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner size="sm" />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading…</span>
          </div>
        ) : rooms.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No offerable rooms available.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rooms.map((r) => (
              <button
                key={r.id}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                  selectedRoomId === r.id
                    ? 'border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-400'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]'
                }`}
                onClick={() => setSelectedRoomId(r.id)}
                disabled={Boolean(disabled) || isLoading || Boolean(heldRoom)}
              >
                Room {r.number}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          disabled={Boolean(disabled) || isLoading || !selectedRoomId}
        >
          {heldRoom ? 'Confirm Offer (Extend Hold)' : 'Offer Selected Room'}
        </Button>
      </div>
    </Modal>
  );
}
