import { type ReactNode } from 'react';
import whiteLogo from '../assets/logo_vector_transparent_hi.svg';
import { useI18n } from '../i18n';

interface ScreenShellProps {
  children: ReactNode;
  backgroundVariant?: 'steamroom1' | 'steamroom2' | 'none';
  showLogoWatermark?: boolean;
  watermarkLayer?: 'over' | 'under';
}

export function ScreenShell({
  children,
  backgroundVariant: _backgroundVariant = 'steamroom1',
  showLogoWatermark = true,
  watermarkLayer = 'under',
}: ScreenShellProps) {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-screen min-h-dvh flex-col items-center justify-center bg-gray-950">
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gray-900/50 via-transparent to-gray-900/50" />
      {/* Watermark logo */}
      {showLogoWatermark && (
        <div
          className={[
            'pointer-events-none absolute inset-0 flex items-center justify-center',
            watermarkLayer === 'under' ? 'z-0' : 'z-10',
          ].join(' ')}
        >
          <img
            src={whiteLogo}
            alt={t('brand.clubName')}
            className="h-[60vh] max-h-[600px] w-auto opacity-[0.04]"
          />
        </div>
      )}
      <div className="relative z-[1] flex w-full flex-1 flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
