import { useMemo, useState } from 'react';
import { API_BASE } from '../../../../app/state/shared/api';
import { formatDisplayError, mapAvailableLockers, mapAvailableRooms } from './utils';
import type {
  ActiveVisitSummaryProps,
  AvailableLocker,
  AvailableRoom,
  PreviousRoomStatus,
  SwitchApiError,
  SwitchPaymentChoice,
} from './types';

type DetailedInventoryResponse = {
  rooms?: Array<{ id: string; number: string; status: string; assignedTo?: string }>;
  lockers?: Array<{ id: string; number: string; status: string; assignedTo?: string }>;
};

export function useSwitchResourceFlow({
  activeCheckin,
  sessionToken,
  onRefetch,
}: Pick<ActiveVisitSummaryProps, 'activeCheckin' | 'sessionToken' | 'onRefetch'>) {
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [lockers, setLockers] = useState<AvailableLocker[]>([]);
  const [targetType, setTargetType] = useState<'room' | 'locker'>(
    activeCheckin.assignedResourceType === 'locker' ? 'room' : 'locker'
  );
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [previousRoomStatus, setPreviousRoomStatus] = useState<PreviousRoomStatus>('DIRTY');
  const [pendingAdditionalFee, setPendingAdditionalFee] = useState<number | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const roomOptionsByTier = useMemo(() => {
    const grouped: Record<'SPECIAL' | 'DOUBLE' | 'STANDARD', AvailableRoom[]> = {
      SPECIAL: [],
      DOUBLE: [],
      STANDARD: [],
    };
    for (const room of rooms) grouped[room.tier].push(room);
    return grouped;
  }, [rooms]);

  const selectedNumber = useMemo(() => {
    if (!selectedResourceId) return null;
    if (targetType === 'room') {
      return rooms.find((room) => room.id === selectedResourceId)?.number ?? null;
    }
    return lockers.find((locker) => locker.id === selectedResourceId)?.number ?? null;
  }, [lockers, rooms, selectedResourceId, targetType]);

  const hasRoomChoices = rooms.length > 0;
  const hasLockerChoices = lockers.length > 0;

  const openSwitchModal = () => {
    setSwitchModalOpen(true);
    setPendingAdditionalFee(null);
    setPendingError(null);
    setInventoryError(null);
    void loadAvailableInventory();
  };

  const closeSwitchModal = () => {
    if (submitting) return;
    setSwitchModalOpen(false);
    setPendingAdditionalFee(null);
    setPendingError(null);
  };

  const selectRoomTarget = () => {
    setTargetType('room');
    setSelectedResourceId(rooms[0]?.id ?? '');
  };

  const selectLockerTarget = () => {
    setTargetType('locker');
    setSelectedResourceId(lockers[0]?.id ?? '');
  };

  async function loadAvailableInventory() {
    if (!sessionToken) {
      setInventoryError('Not authenticated');
      return;
    }

    setLoadingInventory(true);
    setInventoryError(null);
    try {
      const response = await fetch(`${API_BASE}/v1/inventory/detailed`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(formatDisplayError(errorPayload, 'Failed to load inventory'));
      }

      const payload = (await response.json()) as DetailedInventoryResponse;
      const availableRooms = mapAvailableRooms(payload.rooms ?? []);
      const availableLockers = mapAvailableLockers(payload.lockers ?? []);

      setRooms(availableRooms);
      setLockers(availableLockers);

      if (targetType === 'room') {
        setSelectedResourceId((prev) =>
          prev && availableRooms.some((room) => room.id === prev)
            ? prev
            : (availableRooms[0]?.id ?? '')
        );
      } else {
        setSelectedResourceId((prev) =>
          prev && availableLockers.some((locker) => locker.id === prev)
            ? prev
            : (availableLockers[0]?.id ?? '')
        );
      }
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : 'Failed to load inventory');
    } finally {
      setLoadingInventory(false);
    }
  }

  async function submitSwitch(paymentChoice?: SwitchPaymentChoice) {
    if (!sessionToken) {
      setPendingError('Not authenticated');
      return;
    }
    if (!selectedResourceId) {
      setPendingError(`Select an available ${targetType} first.`);
      return;
    }

    setSubmitting(true);
    setPendingError(null);
    try {
      const response = await fetch(
        `${API_BASE}/v1/checkin/visits/${encodeURIComponent(activeCheckin.visitId)}/switch-resource`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            targetResourceType: targetType,
            targetResourceId: selectedResourceId,
            previousRoomStatus:
              activeCheckin.assignedResourceType === 'room' ? previousRoomStatus : undefined,
            paymentOutcome: paymentChoice,
            declineReason: paymentChoice === 'CREDIT_DECLINE' ? 'Credit declined' : undefined,
          }),
        }
      );

      if (response.ok) {
        setPendingAdditionalFee(null);
        setSwitchModalOpen(false);
        onRefetch();
        return;
      }

      const errorPayload = (await response.json().catch(() => null)) as SwitchApiError | null;
      if (response.status === 409 && errorPayload?.code === 'PAYMENT_REQUIRED') {
        setPendingAdditionalFee(
          typeof errorPayload.additionalFee === 'number' ? errorPayload.additionalFee : null
        );
        return;
      }

      if (response.status === 402 && errorPayload?.code === 'PAYMENT_DECLINED') {
        setPendingAdditionalFee(null);
        setPendingError(errorPayload.error || 'Credit declined. Room/locker was not switched.');
        return;
      }

      throw new Error(formatDisplayError(errorPayload, 'Failed to switch room/locker'));
    } catch (error) {
      setPendingError(error instanceof Error ? error.message : 'Failed to switch room/locker');
    } finally {
      setSubmitting(false);
    }
  }

  return {
    switchModalOpen,
    loadingInventory,
    inventoryError,
    submitting,
    rooms,
    lockers,
    targetType,
    selectedResourceId,
    previousRoomStatus,
    pendingAdditionalFee,
    pendingError,
    roomOptionsByTier,
    selectedNumber,
    hasRoomChoices,
    hasLockerChoices,
    setSelectedResourceId,
    setPreviousRoomStatus,
    setPendingAdditionalFee,
    openSwitchModal,
    closeSwitchModal,
    selectRoomTarget,
    selectLockerTarget,
    submitSwitch,
  };
}
