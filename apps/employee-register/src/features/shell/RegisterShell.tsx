import type { ReactNode } from 'react';
import './RegisterShell.css';

export type ShellNavKey =
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
  return (
    <div className="er-shell">
      <div className="er-shell__body">
        <aside className="er-shell__sidebar" aria-label="Primary navigation">
          <div className="er-shell__sidebar-header">
            <div style={{ minWidth: 0 }}>
              <div className="er-shell__sidebar-title">{title}</div>
              {subtitle ? <div className="er-shell__sidebar-subtitle">{subtitle}</div> : null}
            </div>
            {statusPill ? <div>{statusPill}</div> : null}
          </div>

          <nav className="er-shell__nav">
            {items.map((item) => {
              const isActive = item.key === active;
              const classes = [
                'cs-liquid-button',
                'er-shell__nav-btn',
                isActive ? 'cs-liquid-button--selected' : 'cs-liquid-button--secondary',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={item.key}
                  type="button"
                  className={classes}
                  onClick={() => onNavigate(item.key)}
                  disabled={item.disabled}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.icon ? (
                    <span className="er-shell__nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="er-shell__nav-label">{item.label}</span>
                  {item.badge ? (
                    <span className="er-shell__nav-badge" aria-hidden="true">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="er-shell__content">
          {headerRight ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{headerRight}</div>
          ) : null}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
