import { ReactNode } from 'react';
import { I18nProvider, t } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

export interface LaneSelectionScreenProps {
  orientationOverlay: ReactNode;
  onSelectLane: (lane: 'lane-1' | 'lane-2') => void;
}

export function LaneSelectionScreen({ orientationOverlay, onSelectLane }: LaneSelectionScreenProps) {
  return (
    <I18nProvider lang={null}>
      <ScreenShell title={t(null, 'lane.selectTitle')} activeNav="dashboard">
        {orientationOverlay}
        <div className="mx-auto max-w-3xl">
          <Card className="p-8">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t(null, 'lane.selectSubtitle')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold">{t(null, 'lane.selectTitle')}</h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Button
                className="h-20 rounded-2xl text-lg"
                onClick={() => onSelectLane('lane-1')}
              >
                <span className="flex flex-col items-center">
                  <span>{t(null, 'lane.lane1')}</span>
                  <span className="text-sm text-muted-foreground">
                    {t(null, 'lane.register1')}
                  </span>
                </span>
              </Button>
              <Button
                variant="secondary"
                className="h-20 rounded-2xl text-lg"
                onClick={() => onSelectLane('lane-2')}
              >
                <span className="flex flex-col items-center">
                  <span>{t(null, 'lane.lane2')}</span>
                  <span className="text-sm text-muted-foreground">
                    {t(null, 'lane.register2')}
                  </span>
                </span>
              </Button>
            </div>
          </Card>
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}
