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
  } = useEmployeeRegisterState();

  return (
    <PanelShell align="top" className="er-scan-panel">
      <div className="er-scan-header">
        <div className="er-scan-icon" aria-hidden="true">
          📷
        </div>
        <PanelHeader
          align="center"
          spacing="sm"
          title="Scan Now"
          subtitle="Scan a membership ID or Driver Licence."
        />
      </div>

      <textarea
        ref={scanInputRef}
        className="er-scan-input"
        aria-label="Scan input"
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="none"
        disabled={!scanInputEnabled}
        {...scanInputHandlers}
      />

      <div className="er-scan-status">
        {scanReady ? 'Scanner ready' : `Scanner paused: ${scanBlockedReason || 'Unavailable'}`}
      </div>

      {currentSessionId && customerName ? (
        <div style={{ marginTop: '1.5rem', display: 'grid', gap: '0.5rem' }}>
          <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
            Active lane session: <span style={{ color: '#e2e8f0' }}>{customerName}</span>
          </div>
          <button
            type="button"
            className="cs-liquid-button"
            onClick={() => selectNavTab('account')}
            style={{ width: '100%', padding: '0.75rem', fontWeight: 900 }}
          >
            Open Customer Account
          </button>
        </div>
      ) : null}
    </PanelShell>
  );
}
