import { Badge, Button } from '@club-ops/ui/tailadmin';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}

export interface RegisterHeaderProps {
  health: HealthStatus | null;
  realtimeConnected: boolean;
  lane: string;
  staffName: string;
  staffRole: 'STAFF' | 'ADMIN';
  onSignOut: () => void;
  onCloseOut: () => void;
}

export function RegisterHeader({
  health,
  realtimeConnected,
  lane,
  staffName,
  staffRole,
  onSignOut,
  onCloseOut,
}: RegisterHeaderProps) {
  return (
    <header className="sticky top-0 z-99 flex w-full items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900">
      {/* Left side: title + status badges */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold text-gray-800 dark:text-white/90">Employee Register</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={health?.status === 'ok' ? 'success' : 'error'} variant="light" size="sm">
            API: {health?.status ?? '...'}
          </Badge>
          <Badge color={realtimeConnected ? 'success' : 'error'} variant="light" size="sm">
            Realtime: {realtimeConnected ? 'Live' : 'Offline'}
          </Badge>
          <Badge color="info" variant="light" size="sm">
            Lane: {lane}
          </Badge>
          <Badge color="light" variant="light" size="sm">
            {staffName} ({staffRole})
          </Badge>
        </div>
      </div>

      {/* Right side: action buttons */}
      <div className="ml-auto flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onSignOut}>
          Sign Out
        </Button>
        <Button variant="danger" size="sm" onClick={() => void onCloseOut()}>
          Close Out
        </Button>
      </div>
    </header>
  );
}
