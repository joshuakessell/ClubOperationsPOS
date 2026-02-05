type InventoryTier = 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL';

type InventoryCounts = Record<InventoryTier, { available: number; nearing: number; late: number }>;

type Props = {
  activeSection: InventoryTier;
  navCounts: InventoryCounts;
  onSectionSelect: (section: InventoryTier) => void;
  effectiveFilterQuery: string;
  onFilterQueryChange: (value: string) => void;
  filterQueryLocked: boolean;
};

export function InventoryNav({
  activeSection,
  navCounts,
  onSectionSelect,
  effectiveFilterQuery,
  onFilterQueryChange,
  filterQueryLocked,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 0 }}>
      {(
        [
          ['LOCKER', 'Lockers'],
          ['STANDARD', 'Standard'],
          ['DOUBLE', 'Double'],
          ['SPECIAL', 'Special'],
        ] as const
      ).map(([tier, label]) => {
        const counts = navCounts[tier];
        return (
          <button
            key={tier}
            type="button"
            className={[
              'cs-liquid-button',
              activeSection === tier
                ? 'cs-liquid-button--selected'
                : 'cs-liquid-button--secondary',
            ].join(' ')}
            onClick={() => onSectionSelect(tier)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '0.9rem 0.85rem',
              fontWeight: 900,
              minHeight: '74px',
            }}
          >
            <div className="er-inv-nav">
              <div className="er-inv-nav-label">{label}</div>
              <div
                className="er-inv-nav-stats er-inv-meta"
                style={{
                  color:
                    activeSection === tier
                      ? 'rgba(255,255,255,0.92)'
                      : 'rgba(148,163,184,0.95)',
                }}
              >
                <div>Available {counts.available}</div>
                <div>Nearing Checkout {counts.nearing}</div>
                <div>Past Checkout {counts.late}</div>
              </div>
            </div>
          </button>
        );
      })}

      {/* Search directly beneath the Special button */}
      <div style={{ marginTop: '0.5rem' }}>
        <div className="er-inv-search-label" style={{ marginBottom: '0.35rem' }}>
          Search
        </div>
        <div className="cs-liquid-search">
          <input
            className="cs-liquid-input cs-liquid-search__input"
            type="text"
            placeholder="Search by name or number..."
            value={effectiveFilterQuery}
            onChange={(e) => onFilterQueryChange(e.target.value)}
            aria-label="Inventory search"
            disabled={filterQueryLocked}
          />
          <div className="cs-liquid-search__icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 14L11.1 11.1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
