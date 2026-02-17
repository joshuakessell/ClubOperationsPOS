import type { ReactNode } from 'react';
import { PanelShell } from '../../views/PanelShell';

export type CheckInFlowProps = {
  header?: ReactNode;
  sessionRoot: ReactNode;
  paymentRoot: ReactNode;
  notificationsRoot?: ReactNode;
  modalsRoot: ReactNode;
};

export function CheckInFlow({
  header,
  sessionRoot,
  paymentRoot,
  notificationsRoot,
  modalsRoot,
}: CheckInFlowProps) {
  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {header ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          {header}
        </div>
      ) : null}

      <div
        style={{
          height: '100%',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)',
          gap: '1rem',
          overflow: 'hidden',
        }}
      >
        <div style={{ minHeight: 0, display: 'grid', gap: '1rem', overflow: 'hidden' }}>
          <PanelShell align="top" scroll="auto" card={false}>
            {sessionRoot}
          </PanelShell>
          <PanelShell align="top" scroll="auto" card={false}>
            {paymentRoot}
          </PanelShell>
        </div>

        <div style={{ minHeight: 0, display: 'grid', gap: '1rem', overflow: 'hidden' }}>
          {notificationsRoot ? (
            <PanelShell align="top" scroll="auto" card={false}>
              {notificationsRoot}
            </PanelShell>
          ) : null}
          <PanelShell align="top" scroll="auto" card={false}>
            {modalsRoot}
          </PanelShell>
        </div>
      </div>
    </div>
  );
}
