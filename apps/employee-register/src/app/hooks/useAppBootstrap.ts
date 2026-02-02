import { useEffect } from 'react';
import { closeAllLaneSessionClients } from '@club-ops/shared/realtime/laneSessionClient';

export function useAppBootstrap() {
  useEffect(() => {
    return () => {
      closeAllLaneSessionClients();
    };
  }, []);
}
