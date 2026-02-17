import { Badge, Button, Spinner } from '@club-ops/ui/tailadmin';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { PanelHeader } from '../../views/PanelHeader';
import { PanelShell } from '../../views/PanelShell';

export function ScanPanel() {
  const {
    currentSessionId,
    customerName,
    selectNavTab,
    scanReady,
    scanBlockedReason,
    scanInputRef,
    scanInputHandlers,
    scanInputEnabled,
    scanCaptureSubmitting,
  } = useEmployeeRegisterState();

  return (
    <PanelShell align="top">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-4xl" aria-hidden="true">
          📷
        </span>
        <PanelHeader
          align="center"
          spacing="sm"
          title="Scan Now"
          subtitle="Scan a membership ID or Driver Licence."
        />
      </div>

      {/* Demo badge */}
      <div className="mt-3 flex justify-center">
        <Badge color="info" variant="light" size="sm">
          DEMO MODE
        </Badge>
      </div>

      {/* Scanner input */}
      <label
        className="mt-4 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
        htmlFor="scan-input-area"
      >
        Scanner Input
      </label>
      <textarea
        id="scan-input-area"
        ref={scanInputRef}
        className="mt-1 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-white/30"
        aria-label="Scanner input"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        disabled={!scanInputEnabled}
        placeholder="Scan or type code here..."
        rows={3}
        {...scanInputHandlers}
      />

      {/* Processing overlay */}
      {scanCaptureSubmitting ? (
        <div className="fixed inset-0 z-99999 flex items-center justify-center bg-gray-400/50 backdrop-blur-[32px]">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
            <Spinner size="md" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Processing scan…
            </span>
          </div>
        </div>
      ) : null}

      {/* Status text */}
      <p className="mt-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
        {scanReady
          ? scanCaptureSubmitting
            ? 'Processing scan...'
            : 'Scanner ready'
          : `Scanner paused: ${scanBlockedReason || 'Unavailable'}`}
      </p>

      {/* Active session CTA */}
      {currentSessionId && customerName ? (
        <div className="mt-6 flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            Active lane session:{' '}
            <span className="text-gray-800 dark:text-white/90">{customerName}</span>
          </p>
          <Button fullWidth onClick={() => selectNavTab('account')}>
            Open Customer Account
          </Button>
        </div>
      ) : null}
    </PanelShell>
  );
}
