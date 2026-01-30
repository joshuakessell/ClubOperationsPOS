import { ReactNode, useMemo } from 'react';
import { BedDouble, DoorOpen, LogIn, LogOut, Sparkles } from 'lucide-react';
import blackLogo from '../assets/logo_vector_transparent_hi_black.svg';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Button } from '../components/ui/button';
import { EXPECTED_LOCKER_COUNT, EXPECTED_ROOM_COUNT, ROOMS } from '@club-ops/shared';

export interface IdleScreenProps {
  customerPrimaryLanguage: Language | null | undefined;
  orientationOverlay: ReactNode;
  inventory: {
    rooms: Record<string, number>;
    lockers: number;
  } | null;
}

export function IdleScreen({
  customerPrimaryLanguage,
  orientationOverlay,
  inventory,
}: IdleScreenProps) {
  const roomTotals = useMemo(() => {
    const totals = { STANDARD: 0, DOUBLE: 0, SPECIAL: 0 };
    ROOMS.forEach((room) => {
      totals[room.tier] += 1;
    });
    return totals;
  }, []);

  const availableRooms =
    inventory?.rooms && Object.values(inventory.rooms).length > 0
      ? Object.values(inventory.rooms).reduce((acc, value) => acc + value, 0)
      : null;
  const occupiedRooms =
    availableRooms !== null ? Math.max(EXPECTED_ROOM_COUNT - availableRooms, 0) : null;
  const availableLockers = inventory ? inventory.lockers : null;

  const statCards = [
    {
      label: t(customerPrimaryLanguage, 'totalRooms'),
      value: EXPECTED_ROOM_COUNT,
      icon: <BedDouble className="h-5 w-5 text-blue-500" />,
    },
    {
      label: t(customerPrimaryLanguage, 'occupied'),
      value: occupiedRooms ?? '—',
      icon: <DoorOpen className="h-5 w-5 text-emerald-500" />,
    },
    {
      label: t(customerPrimaryLanguage, 'checkinsToday'),
      value: '—',
      icon: <LogIn className="h-5 w-5 text-indigo-500" />,
    },
    {
      label: t(customerPrimaryLanguage, 'checkoutsToday'),
      value: '—',
      icon: <LogOut className="h-5 w-5 text-rose-500" />,
    },
  ];

  const inventoryRows = [
    {
      label: t(customerPrimaryLanguage, 'rooms.standard'),
      available: inventory?.rooms?.STANDARD ?? null,
      total: roomTotals.STANDARD,
      tone: 'bg-blue-500',
    },
    {
      label: t(customerPrimaryLanguage, 'rooms.double'),
      available: inventory?.rooms?.DOUBLE ?? null,
      total: roomTotals.DOUBLE,
      tone: 'bg-amber-500',
    },
    {
      label: t(customerPrimaryLanguage, 'rooms.special'),
      available: inventory?.rooms?.SPECIAL ?? null,
      total: roomTotals.SPECIAL,
      tone: 'bg-emerald-500',
    },
    {
      label: t(customerPrimaryLanguage, 'rooms.lockers'),
      available: availableLockers,
      total: EXPECTED_LOCKER_COUNT,
      tone: 'bg-violet-500',
    },
  ];

  return (
    <I18nProvider lang={customerPrimaryLanguage}>
      <ScreenShell
        title={t(customerPrimaryLanguage, 'dashboard')}
        subtitle={t(customerPrimaryLanguage, 'dashboardSubtitle')}
        activeNav="dashboard"
      >
        {orientationOverlay}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <Card key={card.label} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {card.label}
                      </p>
                      <p className="mt-2 text-3xl font-semibold">{card.value}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/60">
                      {card.icon}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {t(customerPrimaryLanguage, 'inventoryStatus')}
                  </p>
                  <h2 className="text-xl font-semibold">{t(customerPrimaryLanguage, 'roomLockerStatus')}</h2>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  {t(customerPrimaryLanguage, 'live')}
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {inventoryRows.map((row) => {
                  const percent =
                    row.available !== null && row.total
                      ? Math.round((row.available / row.total) * 100)
                      : null;
                  return (
                    <div key={row.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{row.label}</span>
                        <span className="text-muted-foreground">
                          {row.available !== null ? `${row.available} / ${row.total}` : '—'}
                        </span>
                      </div>
                      <div className="relative">
                        <Progress
                          value={percent ?? 0}
                          className="h-2"
                          indicatorClassName={row.tone}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {t(customerPrimaryLanguage, 'quickActions')}
                  </p>
                  <h2 className="text-xl font-semibold">{t(customerPrimaryLanguage, 'actionsForStaff')}</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  t(customerPrimaryLanguage, 'checkIn'),
                  t(customerPrimaryLanguage, 'checkout'),
                  t(customerPrimaryLanguage, 'inventory'),
                  t(customerPrimaryLanguage, 'upgrades'),
                ].map((action) => (
                  <Button
                    key={action}
                    variant="secondary"
                    className="w-full justify-between rounded-2xl px-4 py-3 text-base font-semibold"
                    disabled
                  >
                    <span>{action}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {t(customerPrimaryLanguage, 'staffOnly')}
                    </span>
                  </Button>
                ))}
              </div>
            </Card>

            <Card className="glass-panel p-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <img
                  src={blackLogo}
                  alt={t(customerPrimaryLanguage, 'brand.clubName')}
                  className="h-16 w-16"
                />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {t(customerPrimaryLanguage, 'readyForNextGuest')}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {t(customerPrimaryLanguage, 'waitingForStaff')}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}
