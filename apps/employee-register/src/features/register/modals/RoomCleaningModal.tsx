import { useEffect, useMemo, useState } from 'react';
import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

type DetailedRoom = {
  id: string;
  number: string;
  status: string;
};

export interface RoomCleaningModalProps {
  isOpen: boolean;
  sessionToken: string;
  staffId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function RoomCleaningModal({ isOpen, sessionToken, staffId, onClose, onSuccess }: RoomCleaningModalProps) {
  const [rooms, setRooms] = useState<DetailedRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [activeList, setActiveList] = useState<'DIRTY' | 'CLEANING' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dirtyRooms = useMemo(
    () => rooms.filter((r) => r.status === 'DIRTY').sort((a, b) => a.number.localeCompare(b.number)),
    [rooms]
  );

  const cleaningRooms = useMemo(
    () => rooms.filter((r) => r.status === 'CLEANING').sort((a, b) => a.number.localeCompare(b.number)),
    [rooms]
  );

  const selectedRooms = useMemo(() => {
    const ids = selectedRoomIds;
    return rooms.filter((r) => ids.has(r.id)).sort((a, b) => a.number.localeCompare(b.number));
  }, [rooms, selectedRoomIds]);

  useEffect(() => {
    if (!isOpen) return;
    setRooms([]);
    setError(null);
    setSelectedRoomIds(new Set());
    setActiveList(null);
    setIsSubmitting(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/v1/inventory/detailed', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) throw new Error('Failed to load inventory');
        const data = (await res.json()) as { rooms?: Array<Record<string, unknown>> };
        const roomsRaw = Array.isArray(data.rooms) ? data.rooms : [];
        const relevant: DetailedRoom[] = roomsRaw
          .filter((r) => typeof r?.id === 'string' && typeof r?.number === 'string' && typeof r?.status === 'string')
          .map((r) => ({ id: r.id as string, number: r.number as string, status: r.status as string }))
          .filter((r) => r.status === 'CLEANING' || r.status === 'DIRTY');
        setRooms(relevant);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load inventory');
        setRooms([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, sessionToken]);

  const toggleRoom = (roomId: string, source: 'DIRTY' | 'CLEANING') => {
    // Prevent mixed-status batch: selecting in one list clears the other.
    const switchingLists = Boolean(activeList && activeList !== source);
    const base = switchingLists ? new Set<string>() : new Set(selectedRoomIds);
    if (base.has(roomId)) base.delete(roomId);
    else base.add(roomId);

    setSelectedRoomIds(base);
    setActiveList(base.size === 0 ? null : source);
  };

  const handleConfirm = async () => {
    if (selectedRoomIds.size === 0) return;
    if (!activeList) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const targetStatus = activeList === 'DIRTY' ? 'CLEANING' : 'CLEAN';
      const res = await fetch('/api/v1/cleaning/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          roomIds: Array.from(selectedRoomIds),
          targetStatus,
          staffId,
          override: false,
        }),
      });
      if (!res.ok) throw new Error('Failed to update room statuses');
      onClose();
      onSuccess(
        targetStatus === 'CLEANING'
          ? 'Cleaning started'
          : 'Rooms marked CLEAN'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update room statuses');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalFrame isOpen={isOpen} title="Room Cleaning" onClose={onClose} maxWidth="760px">
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="mb-3 text-sm font-semibold text-gray-900">
        Select rooms to begin or finish cleaning
      </div>

      {loading ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          Loading…
        </div>
      ) : dirtyRooms.length === 0 && cleaningRooms.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          No DIRTY or CLEANING rooms
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-2 text-xs font-semibold text-gray-500">
              DIRTY (ready to begin cleaning)
            </div>
            <div className="grid gap-2">
              {dirtyRooms.length === 0 ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-sm text-gray-600">
                  None
                </div>
              ) : (
                dirtyRooms.map((r) => {
                  const selected = selectedRoomIds.has(r.id);
                  const disabled = activeList === 'CLEANING';
                  return (
                    <Button
                      key={r.id}
                      type="button"
                      variant={selected ? 'primary' : 'secondary'}
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => toggleRoom(r.id, 'DIRTY')}
                      className="w-full justify-between"
                    >
                      <span className="font-semibold">Room {r.number}</span>
                      <span className="text-sm text-gray-600">{selected ? 'Selected' : 'DIRTY'}</span>
                    </Button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-gray-500">
              CLEANING (ready to finish cleaning)
            </div>
            <div className="grid gap-2">
              {cleaningRooms.length === 0 ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-sm text-gray-600">
                  None
                </div>
              ) : (
                cleaningRooms.map((r) => {
                  const selected = selectedRoomIds.has(r.id);
                  const disabled = activeList === 'DIRTY';
                  return (
                    <Button
                      key={r.id}
                      type="button"
                      variant={selected ? 'primary' : 'secondary'}
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => toggleRoom(r.id, 'CLEANING')}
                      className="w-full justify-between"
                    >
                      <span className="font-semibold">Room {r.number}</span>
                      <span className="text-sm text-gray-600">{selected ? 'Selected' : 'CLEANING'}</span>
                    </Button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {selectedRooms.length > 0 && (
        <Card padding="md" className="mt-3">
          <div className="text-xs font-semibold text-gray-500">Selected</div>
          <div className="mt-1 text-sm text-gray-700">
            {selectedRooms.map((r) => `Room ${r.number}`).join(', ')}
          </div>
        </Card>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSelectedRoomIds(new Set());
            setActiveList(null);
          }}
          disabled={isSubmitting || selectedRoomIds.size === 0}
        >
          Clear
        </Button>
        <Button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting || selectedRoomIds.size === 0 || !activeList}
        >
          {isSubmitting
            ? 'Working…'
            : activeList === 'DIRTY'
              ? 'Begin Cleaning'
              : activeList === 'CLEANING'
                ? 'Finish Cleaning'
                : 'Continue'}
        </Button>
      </div>
    </ModalFrame>
  );
}


