import { t, type Language } from '../i18n';

export function WelcomeOverlay({
  isOpen,
  language,
  customerName,
  onDismiss,
}: {
  isOpen: boolean;
  language?: Language | null;
  customerName?: string | null;
  onDismiss: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onDismiss}
      role="dialog"
      aria-label={t(language, 'a11y.welcomeDialog')}
    >
      <div className="rounded-3xl border border-white/20 bg-white/10 px-8 py-6 text-center shadow-soft">
        <div className="text-3xl font-semibold text-white">
          {t(language, 'welcome')}
          {customerName ? `, ${customerName}` : ''}
        </div>
      </div>
    </div>
  );
}
