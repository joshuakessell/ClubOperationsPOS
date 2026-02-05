import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { PanelHeader } from '../../views/PanelHeader';
import { PanelShell } from '../../views/PanelShell';

export function ScanPanel() {
  const {
    currentSessionId,
    customerName,
    selectHomeTab,
    scanReady,
    scanBlockedReason,
    scanOverlayActive,
    scanCameraOverlayVisible,
    scanCameraStatus,
    scanCameraError,
    scanCameraActive,
    scanCameraVideoRef,
    scanInputRef,
    scanInputHandlers,
    scanInputEnabled,
  } = useEmployeeRegisterState();

  const cameraStatusMessage = !scanReady
    ? `Scanner paused: ${scanBlockedReason || 'Unavailable'}`
    : scanCameraStatus === 'starting'
      ? 'Starting front camera…'
      : scanCameraError
        ? scanCameraError
        : 'Align barcode within the frame to scan.';

  return (
    <PanelShell align="center">
      {scanCameraOverlayVisible ? (
        <div className="er-camera-scan-overlay" role="status" aria-live="polite">
          <div className="er-camera-scan-card cs-liquid-card">
            <div className="er-camera-scan-header">
              <div>
                <div className="er-camera-scan-title">Scan ID</div>
                <div className="er-camera-scan-subtitle">
                  Front camera active for driver licenses and memberships.
                </div>
              </div>
              <div className="er-camera-scan-status">{cameraStatusMessage}</div>
            </div>
            <div className="er-camera-scan-video" data-active={scanCameraActive ? 'true' : 'false'}>
              <video ref={scanCameraVideoRef} autoPlay muted playsInline />
              <div className="er-camera-scan-reticle" aria-hidden="true" />
              <div className="er-camera-scan-line" aria-hidden="true" />
            </div>
          </div>
        </div>
      ) : null}
      <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: '0.5rem' }} aria-hidden="true">
        📷
      </div>
      <PanelHeader
        align="center"
        spacing="sm"
        title="Scan Now"
        subtitle="Scan a membership ID or driver license."
      />
      <textarea
        ref={scanInputRef}
        className={[
          'er-scan-input',
          scanOverlayActive ? 'er-scan-input--visible' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Scan input"
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="none"
        disabled={!scanInputEnabled}
        {...scanInputHandlers}
      />
      <div className="er-text-sm" style={{ marginTop: '0.5rem', color: '#94a3b8' }}>
        {scanReady ? 'Scanner ready' : `Scanner paused: ${scanBlockedReason || 'Unavailable'}`}
      </div>
      {currentSessionId && customerName ? (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
          <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
            Active lane session: <span style={{ color: '#e2e8f0' }}>{customerName}</span>
          </div>
          <button
            type="button"
            className="cs-liquid-button"
            onClick={() => selectHomeTab('account')}
            style={{ width: '100%', padding: '0.75rem', fontWeight: 900 }}
          >
            Open Customer Account
          </button>
        </div>
      ) : null}
    </PanelShell>
  );
}
