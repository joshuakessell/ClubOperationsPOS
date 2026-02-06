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
    startScanCamera,
    stopScanCamera,
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

  const tapSubtitle = scanReady
    ? 'Front camera • PDF417 + barcodes'
    : `Scanner paused: ${scanBlockedReason || 'Unavailable'}`;

  return (
    <PanelShell align="center">
      {scanCameraOverlayVisible ? (
        <div className="er-camera-scan-overlay" role="dialog" aria-live="polite">
          <div className="er-camera-scan-stage" data-active={scanCameraActive ? 'true' : 'false'}>
            <video ref={scanCameraVideoRef} autoPlay muted playsInline />
            <div className="er-camera-scan-tip cs-liquid-card">
              <div className="er-camera-scan-title">Scan ID</div>
              <div className="er-camera-scan-subtitle">
                Align the barcode within the frame to capture automatically.
              </div>
              {scanCameraStatus === 'starting' || scanCameraError ? (
                <div className="er-camera-scan-status">{cameraStatusMessage}</div>
              ) : null}
            </div>
            <div className="er-camera-scan-frame" aria-hidden="true" />
            <div className="er-camera-scan-line" aria-hidden="true" />
            <div className="er-camera-scan-actions">
              <button type="button" className="cs-liquid-button" onClick={stopScanCamera}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="er-scan-layout">
        <div className="er-scan-left">
          <div className="er-scan-icon" aria-hidden="true">
            📷
          </div>
          <PanelHeader
            align="center"
            spacing="sm"
            title="Scan Now"
            subtitle="Scan a membership ID or driver license."
          />
          <div className="er-text-sm" style={{ marginTop: '0.5rem', color: '#94a3b8' }}>
            {scanReady ? 'Scanner ready' : `Scanner paused: ${scanBlockedReason || 'Unavailable'}`}
          </div>
        </div>
        <button
          type="button"
          className="er-scan-tap-card cs-liquid-card"
          onClick={startScanCamera}
          disabled={!scanReady || scanCameraOverlayVisible}
        >
          <div className="er-scan-tap-icon" aria-hidden="true">
            📷
          </div>
          <div className="er-scan-tap-title">
            {scanCameraOverlayVisible ? 'Scanning…' : 'Tap to Scan'}
          </div>
          <div className="er-scan-tap-subtitle">{tapSubtitle}</div>
        </button>
      </div>
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
