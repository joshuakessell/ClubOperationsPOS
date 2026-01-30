import { type ReactNode } from 'react';
import whiteLogo from '../assets/logo_vector_transparent_hi.svg';
import { useI18n } from '../i18n';
import { cn } from '../lib/utils';

interface ScreenShellProps {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  activeNav?: 'dashboard' | 'checkin' | 'payment' | 'agreement' | 'complete';
  showSidebar?: boolean;
}

export function ScreenShell({
  children,
  title,
  subtitle,
  activeNav = 'dashboard',
  showSidebar = true,
}: ScreenShellProps) {
  const { t } = useI18n();
  const navItems: Array<{ key: ScreenShellProps['activeNav']; label: string }> = [
    { key: 'dashboard', label: t('dashboard') },
    { key: 'checkin', label: t('checkIn') },
    { key: 'payment', label: t('payment.title') },
    { key: 'agreement', label: t('agreementTitle') },
    { key: 'complete', label: t('complete') },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-foreground">
      <div className="flex min-h-screen bg-soft-grid">
        {showSidebar && (
          <aside className="hidden w-64 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] lg:flex">
            <div className="flex items-center gap-3 px-6 py-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 p-2">
                <img src={whiteLogo} alt={t('brand.clubName')} className="h-full w-full" />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-widest text-white">
                  Club Dallas
                </div>
                <div className="text-xs text-white/70">{t('kiosk')}</div>
              </div>
            </div>
            <nav className="flex-1 space-y-1 px-4">
              {navItems.map((item) => (
                <div
                  key={item.key}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                    item.key === activeNav
                      ? 'bg-white/10 text-white shadow-soft'
                      : 'text-white/70'
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-white/60" />
                  {item.label}
                </div>
              ))}
            </nav>
            <div className="px-6 py-6 text-xs text-white/60">
              {t('brand.clubName')} · {t('poweredBy')}
            </div>
          </aside>
        )}

        <div className="flex flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t('brand.clubName')}
              </div>
              <h1 className="text-2xl font-semibold">{title ?? t('dashboard')}</h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/70 px-4 py-2 text-xs font-semibold text-slate-500 shadow-soft">
                {t('kiosk')}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto px-6 pb-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
