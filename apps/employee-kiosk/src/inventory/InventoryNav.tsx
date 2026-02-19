import { Badge } from '@club-ops/ui/tailadmin';

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

const TIERS: Array<[InventoryTier, string]> = [
  ['LOCKER', 'Lockers'],
  ['STANDARD', 'Standard'],
  ['DOUBLE', 'Double'],
  ['SPECIAL', 'Special'],
];

export function InventoryNav({
  activeSection,
  navCounts,
  onSectionSelect,
  effectiveFilterQuery,
  onFilterQueryChange,
  filterQueryLocked,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5" style={{ minWidth: 0 }}>
      <nav className="flex flex-col space-y-1">
        {TIERS.map(([tier, label]) => {
          const counts = navCounts[tier];
          const isActive = activeSection === tier;
          return (
            <button
              key={tier}
              type="button"
              className={[
                'inline-flex flex-col items-start rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-in-out',
                isActive
                  ? 'text-brand-500 bg-brand-50 dark:bg-brand-400/20 dark:text-brand-400'
                  : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              ].join(' ')}
              onClick={() => onSectionSelect(tier)}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <span style={{ fontWeight: 900, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                {label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="light" color="success" size="sm">
                  Available {counts.available}
                </Badge>
                <Badge variant="light" color="warning" size="sm">
                  Near {counts.nearing}
                </Badge>
                <Badge variant="light" color="error" size="sm">
                  Late {counts.late}
                </Badge>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Search */}
      <div style={{ marginTop: '0.5rem' }}>
        <div
          className="text-xs font-medium text-gray-500 dark:text-gray-400"
          style={{ marginBottom: '0.35rem' }}
        >
          Search
        </div>
        <div className="relative">
          <input
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-10 text-sm text-gray-800 shadow-theme-xs outline-none transition focus:border-brand-300 focus:ring focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            type="text"
            placeholder="Search by name or number..."
            value={effectiveFilterQuery}
            onChange={(e) => onFilterQueryChange(e.target.value)}
            aria-label="Inventory search"
            disabled={filterQueryLocked}
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400">
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
