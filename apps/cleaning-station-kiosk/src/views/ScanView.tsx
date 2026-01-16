import { RefObject } from 'react';
import { Button } from '../ui/Button';

export interface ScannedItem {
  tagCode: string;
  room: {
    roomId: string;
    roomNumber: string;
    roomType: string;
    status: string;
    floor: number;
    tagCode: string;
    tagType: string;
    overrideFlag: boolean;
  };
  timestamp: number;
}

export interface ScanViewProps {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  cameraError: string | null;
  cameraFacingMode: 'user' | 'environment';
  onToggleFacingMode: () => void;
  scannedItems: ScannedItem[];
  isProcessing: boolean;
  onLogout: () => void;
  onGoToResolve: () => void;
  actionType: 'begin' | 'finish' | 'mixed' | null;
  onRemoveScannedItem: (tagCode: string) => void;
  onUndoLastScan: () => void;
  onClearAll: () => void;
  onBeginCleaning: () => void;
  onFinishCleaning: () => void;
}

export function ScanView({
  videoRef,
  canvasRef,
  cameraError,
  cameraFacingMode,
  onToggleFacingMode,
  scannedItems,
  isProcessing,
  onLogout,
  onGoToResolve,
  actionType,
  onRemoveScannedItem,
  onUndoLastScan,
  onClearAll,
  onBeginCleaning,
  onFinishCleaning,
}: ScanViewProps) {
  return (
    <div className="app-container">
      <div className="camera-container" data-camera-mode={cameraFacingMode}>
        <video ref={videoRef} className="camera-preview" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="camera-canvas" style={{ display: 'none' }} />
        {cameraError && (
          <div className="camera-error">
            <p>Camera Error: {cameraError}</p>
            <Button variant="secondary" onClick={onToggleFacingMode}>
              Switch Camera
            </Button>
          </div>
        )}
        {!cameraError && (
          <button
            className="camera-switch-button"
            onClick={onToggleFacingMode}
            title="Switch Camera"
          >
            🔄
          </button>
        )}
      </div>

      <div className="content-panel">
        <h1 className="panel-title">Scanned Rooms</h1>

        {scannedItems.length === 0 ? (
          <div className="empty-state">
            <p>Scan QR codes to add rooms</p>
          </div>
        ) : (
          <>
            <div className="scanned-list">
              {scannedItems.map((item) => (
                <div key={item.tagCode} className="scanned-item">
                  <div className="scanned-info">
                    <div className="scanned-room-number">Room {item.room.roomNumber}</div>
                    <div className={`scanned-status status-${item.room.status.toLowerCase()}`}>
                      {item.room.status}
                    </div>
                  </div>
                  <button
                    className="button-remove"
                    onClick={() => onRemoveScannedItem(item.tagCode)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="control-buttons">
              <Button variant="secondary" onClick={onUndoLastScan}>
                Undo Last
              </Button>
              <Button variant="secondary" onClick={onClearAll}>
                Clear All
              </Button>
              <Button variant="secondary" onClick={onLogout} type="button">
                Log Out
              </Button>
            </div>

            <div className="action-buttons">
              {actionType === 'begin' && (
                <Button onClick={onBeginCleaning} disabled={isProcessing} className="button-large">
                  Begin Cleaning ({scannedItems.length})
                </Button>
              )}

              {actionType === 'finish' && (
                <Button onClick={onFinishCleaning} disabled={isProcessing} className="button-large">
                  Finish Cleaning ({scannedItems.length})
                </Button>
              )}

              {actionType === 'mixed' && (
                <>
                  <div className="warning-message">
                    ⚠️ Mixed statuses detected. Please resolve before proceeding.
                  </div>
                  <Button onClick={onGoToResolve} disabled={isProcessing} className="button-large">
                    Resolve Statuses
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

