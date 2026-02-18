import { ReactNode } from 'react';
import { I18nProvider, t } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';

export interface LaneSelectionScreenProps {
  orientationOverlay: ReactNode;
  onSelectLane: (lane: 'lane-1' | 'lane-2') => void;
}

export function LaneSelectionScreen({
  orientationOverlay,
  onSelectLane,
}: LaneSelectionScreenProps) {
  return (
    <I18nProvider lang={null}>
      <ScreenShell backgroundVariant="steamroom1" showLogoWatermark={true} watermarkLayer="under">
        {orientationOverlay}
        <div className="relative z-[1]">
          <main className="flex flex-col items-center gap-8 px-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white">{t(null, 'lane.selectTitle')}</h1>
              <p className="mt-2 text-lg text-gray-400">{t(null, 'lane.selectSubtitle')}</p>
            </div>
            <div className="flex gap-6">
              <button
                type="button"
                className="flex min-w-[200px] flex-col items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-10 py-8 text-center transition-all duration-200 hover:border-brand-500/40 hover:bg-gray-700"
                onClick={() => onSelectLane('lane-1')}
              >
                <span className="text-2xl font-bold text-white">{t(null, 'lane.lane1')}</span>
                <span className="text-sm text-gray-400">{t(null, 'lane.register1')}</span>
              </button>
              <button
                type="button"
                className="flex min-w-[200px] flex-col items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-10 py-8 text-center transition-all duration-200 hover:border-brand-500/40 hover:bg-gray-700"
                onClick={() => onSelectLane('lane-2')}
              >
                <span className="text-2xl font-bold text-white">{t(null, 'lane.lane2')}</span>
                <span className="text-sm text-gray-400">{t(null, 'lane.register2')}</span>
              </button>
            </div>
          </main>
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}
