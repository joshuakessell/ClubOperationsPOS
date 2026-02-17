import { useEffect, type ReactNode } from 'react';
import { Badge } from '@club-ops/ui/tailadmin';

/* ── Nav key union (unchanged API) ──────────────────────── */

export type ShellNavKey =
  | 'signIn'
  | 'scan'
  | 'search'
  | 'inventory'
  | 'upgrades'
  | 'retail'
  | 'checkout'
  | 'account'
  | 'clubLog'
  | 'manual'
  | 'roomCleaning';

export type ShellNavItem = {
  key: ShellNavKey;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  /** Keyboard shortcut label shown next to the item, e.g. 'F1'. */
  shortcut?: string;
};

export type RegisterShellProps = {
  active: ShellNavKey;
  onNavigate: (key: ShellNavKey) => void;
  title?: string;
  subtitle?: string;
  statusPill?: ReactNode;
  headerRight?: ReactNode;
  items: ShellNavItem[];
  children: ReactNode;
};

/**
 * TailAdmin-style sidebar + content layout for the Employee Register.
 *
 * Left sidebar (280 px) with icon-label nav items.
 * Right area: optional headerRight slot + scrollable content.
 */
export function RegisterShell({
  active,
  onNavigate,
  title = 'Lane 1',
  subtitle,
  statusPill,
  headerRight,
  items,
  children,
}: RegisterShellProps) {
  /* ── F-key keyboard shortcut listener ────────────────── */
  useEffect(() => {
    // Build a map of F-key -> item for enabled items with shortcuts
    const shortcutMap = new Map<string, ShellNavItem>();
    for (const item of items) {
      if (item.shortcut && !item.disabled) {
        shortcutMap.set(item.shortcut.toUpperCase(), item);
      }
    }
    if (shortcutMap.size === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toUpperCase(); // e.g. 'F1', 'F2', ...
      const item = shortcutMap.get(key);
      if (!item) return;

      // Block if a modal / dialog / drawer overlay is open
      if (document.querySelector('[role="dialog"], [data-modal], .modal-backdrop')) {
        return;
      }

      // Block if focus is inside an input / textarea (avoid hijacking form input)
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
        return;
      }

      e.preventDefault();
      onNavigate(item.key);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, onNavigate]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside
        className="flex w-[280px] shrink-0 flex-col gap-3 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:w-[280px] md:w-[240px]"
        aria-label="Primary navigation"
      >
        {/* Sidebar header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-2 pb-3 dark:border-gray-800">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-gray-800 dark:text-white/90">
              {title}
            </div>
            {subtitle ? (
              <div className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                {subtitle}
              </div>
            ) : null}
          </div>
          {statusPill ? <div>{statusPill}</div> : null}
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-1 no-scrollbar">
          {items.map((item) => {
            const isActive = item.key === active;

            return (
              <button
                key={item.key}
                type="button"
                className={`menu-item group w-full justify-start gap-3 text-left text-base ${
                  isActive ? 'menu-item-active' : 'menu-item-inactive'
                }`}
                onClick={() => onNavigate(item.key)}
                disabled={item.disabled}
                aria-label={item.label}
                title={item.shortcut ? `${item.label} (${item.shortcut})` : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon ? (
                  <span
                    className={`menu-item-icon-size flex shrink-0 items-center justify-center ${
                      isActive ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
                    }`}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                ) : null}
                <span className="flex-1 truncate">{item.label}</span>
                {item.shortcut ? (
                  <kbd
                    className="ml-auto shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    aria-hidden="true"
                  >
                    {item.shortcut}
                  </kbd>
                ) : null}
                {item.badge ? (
                  <span className="shrink-0" aria-hidden="true">
                    {typeof item.badge === 'number' || typeof item.badge === 'string' ? (
                      <Badge color="error" size="sm">
                        {item.badge}
                      </Badge>
                    ) : (
                      item.badge
                    )}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Content area ────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        {headerRight ? <div className="mb-3 flex justify-end">{headerRight}</div> : null}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
