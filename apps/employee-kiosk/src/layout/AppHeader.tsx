import { useAuthGate } from "../context/AuthGateContext";

const AppHeader: React.FC = () => {
  const { sessionInfo } = useAuthGate();

  return (
    <header className="flex w-full items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
      {/* Left: title + session info */}
      <div className="flex items-center gap-4">
        <span className="text-base font-semibold text-white/90">Employee Register</span>

        {sessionInfo && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">
              {sessionInfo.employeeName} • Register {sessionInfo.registerNumber}
            </span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400">
              {sessionInfo.lane}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              sessionInfo.apiStatus === 'ok'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              API: {sessionInfo.apiStatus ?? '...'}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              sessionInfo.realtimeConnected
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              Realtime: {sessionInfo.realtimeConnected ? 'Online' : 'Offline'}
            </span>
          </div>
        )}
      </div>

      {/* Right: Sign Out / Close Out */}
      {sessionInfo && (
        <div className="flex items-center gap-2">
          <button
            onClick={sessionInfo.onSignOut}
            className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Sign Out
          </button>
          <button
            onClick={sessionInfo.onCloseOut}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Close Out
          </button>
        </div>
      )}
    </header>
  );
};

export default AppHeader;
