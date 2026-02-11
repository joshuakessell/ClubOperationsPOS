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

      <div className="er-scan-demo-badge" role="status" aria-live="polite">
        DEMO MODE
      </div>

      <label className="er-scan-label" htmlFor="scan-input-area">
        Scanner Input
      </label>
      <textarea
        id="scan-input-area"
        ref={scanInputRef}
        className="er-scan-input er-scan-input--entry"
        aria-label="Scanner input"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        disabled={!scanInputEnabled}
        placeholder="Scan or type code here..."
        {...scanInputHandlers}
      />

      <div
        className={`er-scan-processing-overlay ${scanCaptureSubmitting ? 'er-scan-processing-overlay--active' : ''}`}
        aria-hidden={!scanCaptureSubmitting}
      >
        <div className="cs-liquid-card er-scan-processing-card">
          <span className="er-spinner" aria-hidden="true" />
          <span className="er-scan-processing-text">Processing scan…</span>
        </div>
      </div>

      <div className="er-scan-status">
        {scanReady
          ? scanCaptureSubmitting
            ? 'Processing scan...'
            : 'Scanner ready'
          : `Scanner paused: ${scanBlockedReason || 'Unavailable'}`}
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
