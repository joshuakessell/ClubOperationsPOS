import { PanelHeader } from '../../views/PanelHeader';
import { PanelShell } from '../../views/PanelShell';

export type HomeHealth = {
  realtimeConnected?: boolean;
  lastEventAt?: string;
};

export type HomeLaneStatus = {
  activeLaneLabel?: string;
  activeSessionId?: string;
};

export type HomeScreenProps = {
  onStartScan: () => void;
  onStartSearch: () => void;
  onStartManualEntry?: () => void;
  onOpenInventory: () => void;
  onOpenUpgrades: () => void;
  onOpenCheckout: () => void;
  onOpenRoomCleaning?: () => void;
  onOpenRetail?: () => void;
  health?: HomeHealth;
  laneStatus?: HomeLaneStatus;
};

export function HomeScreen({
  onStartScan,
  onStartSearch,
  onStartManualEntry,
  onOpenInventory,
  onOpenUpgrades,
  onOpenCheckout,
  onOpenRoomCleaning,
  onOpenRetail,
  health,
  laneStatus,
}: HomeScreenProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)',
        gap: '1rem',
        height: '100%',
        minHeight: 0,
      }}
    >
      <section style={{ minWidth: 0, minHeight: 0, display: 'grid', gap: '1rem' }}>
        <PanelShell align="top" scroll="auto">
          <PanelHeader title="Start" spacing="sm" />
          <div className="action-buttons" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="action-btn cs-liquid-button" onClick={onStartScan}>
              <span className="btn-icon" aria-hidden="true">
                📷
              </span>
              Scan ID
            </button>
            <button
              type="button"
              className="action-btn cs-liquid-button cs-liquid-button--secondary"
              onClick={onStartSearch}
            >
              <span className="btn-icon" aria-hidden="true">
                🔎
              </span>
              Search Member
            </button>
            <button
              type="button"
              className="action-btn cs-liquid-button cs-liquid-button--secondary"
              onClick={onOpenInventory}
            >
              <span className="btn-icon" aria-hidden="true">
                📦
              </span>
              Rentals
            </button>
            <button
              type="button"
              className="action-btn cs-liquid-button cs-liquid-button--secondary"
              onClick={onOpenCheckout}
            >
              <span className="btn-icon" aria-hidden="true">
                ✅
              </span>
              Checkout
            </button>
            <button
              type="button"
              className="action-btn cs-liquid-button cs-liquid-button--secondary"
              onClick={onOpenUpgrades}
            >
              <span className="btn-icon" aria-hidden="true">
                ✨
              </span>
              Upgrades
            </button>
            {onStartManualEntry ? (
              <button
                type="button"
                className="action-btn cs-liquid-button cs-liquid-button--secondary"
                onClick={onStartManualEntry}
              >
                <span className="btn-icon" aria-hidden="true">
                  📝
                </span>
                Manual Entry
              </button>
            ) : null}
            {onOpenRoomCleaning ? (
              <button
                type="button"
                className="action-btn cs-liquid-button cs-liquid-button--secondary"
                onClick={onOpenRoomCleaning}
              >
                <span className="btn-icon" aria-hidden="true">
                  🧹
                </span>
                Room Cleaning
              </button>
            ) : null}
            {onOpenRetail ? (
              <button
                type="button"
                className="action-btn cs-liquid-button cs-liquid-button--secondary"
                onClick={onOpenRetail}
              >
                <span className="btn-icon" aria-hidden="true">
                  🛒
                </span>
                Retail
              </button>
            ) : null}
          </div>
        </PanelShell>

        <PanelShell align="top" scroll="auto">
          <PanelHeader title="Operational notes" spacing="sm" />
          <div className="er-text-md" style={{ color: 'rgba(148, 163, 184, 0.95)', fontWeight: 750 }}>
            This view is event-driven. Start with Scan or Search, then follow the check-in
            flow surfaced in the session panel.
          </div>
        </PanelShell>
      </section>

      <aside style={{ minHeight: 0, display: 'grid', gap: '1rem' }}>
        <PanelShell align="top" scroll="auto">
          <PanelHeader title="Realtime" spacing="sm" />
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div className="er-text-sm" style={{ color: 'rgba(148, 163, 184, 0.95)', fontWeight: 800 }}>
                Connected
              </div>
              <span
                className={`cs-badge ${health?.realtimeConnected ? 'cs-badge--success' : 'cs-badge--error'}`}
              >
                {health?.realtimeConnected ? 'Yes' : 'No'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div className="er-text-sm" style={{ color: 'rgba(148, 163, 184, 0.95)', fontWeight: 800 }}>
                Last event
              </div>
              <div className="er-text-xs" style={{ color: 'rgba(148, 163, 184, 0.9)', fontWeight: 800 }}>
                {health?.lastEventAt ?? 'n/a'}
              </div>
            </div>
          </div>
        </PanelShell>

        <PanelShell align="top" scroll="auto">
          <PanelHeader title="Lane" spacing="sm" />
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div className="er-text-sm" style={{ color: 'rgba(148, 163, 184, 0.95)', fontWeight: 800 }}>
                Active
              </div>
              <div className="er-text-xs" style={{ color: 'rgba(148, 163, 184, 0.9)', fontWeight: 800 }}>
                {laneStatus?.activeLaneLabel ?? 'n/a'}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div className="er-text-sm" style={{ color: 'rgba(148, 163, 184, 0.95)', fontWeight: 800 }}>
                Session
              </div>
              <div className="er-text-xs" style={{ color: 'rgba(148, 163, 184, 0.9)', fontWeight: 800 }}>
                {laneStatus?.activeSessionId ?? 'n/a'}
              </div>
            </div>
          </div>
        </PanelShell>
      </aside>
    </div>
  );
}

