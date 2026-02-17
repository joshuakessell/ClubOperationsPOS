export type InventorySummarySection = 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL';

export type InventoryAvailableCounts = null | {
  rooms: Record<string, number>;
  rawRooms: Record<string, number>;
  lockers: number;
};

export interface InventorySummaryBarProps {
  counts: InventoryAvailableCounts;
  onOpenInventorySection: (section: InventorySummarySection) => void;
}

function getCount(rec: Record<string, number> | undefined, key: string): number | null {
  const raw = rec?.[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function formatRatio(x: number | null, y: number | null) {
  const left = x === null ? '—' : String(x);
  const right = y === null ? '—' : String(y);
  return `${left} / ${right}`;
}

export function InventorySummaryBar({ counts, onOpenInventorySection }: InventorySummaryBarProps) {
  const lockers = counts ? (Number.isFinite(counts.lockers) ? counts.lockers : null) : null;

  const xStandard = counts ? getCount(counts.rooms, 'STANDARD') : null;
  const yStandard = counts ? getCount(counts.rawRooms, 'STANDARD') : null;
  const xDouble = counts ? getCount(counts.rooms, 'DOUBLE') : null;
  const yDouble = counts ? getCount(counts.rawRooms, 'DOUBLE') : null;
  const xSpecial = counts ? getCount(counts.rooms, 'SPECIAL') : null;
  const ySpecial = counts ? getCount(counts.rawRooms, 'SPECIAL') : null;

  const disabled = !counts;

  const SummaryButton = (props: {
    label: string;
    ratio: string;
    section: InventorySummarySection;
  }) => (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50 disabled:opacity-65 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
      disabled={disabled}
      onClick={() => onOpenInventorySection(props.section)}
    >
      <span>{props.label}</span>
      <span className="tabular-nums">{props.ratio}</span>
    </button>
  );

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
      style={{
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        alignItems: 'stretch',
      }}
      aria-label="Inventory summary"
    >
      <SummaryButton label="Lockers" ratio={formatRatio(lockers, lockers)} section="LOCKER" />
      <SummaryButton
        label="Standard"
        ratio={formatRatio(xStandard, yStandard)}
        section="STANDARD"
      />
      <SummaryButton label="Double" ratio={formatRatio(xDouble, yDouble)} section="DOUBLE" />
      <SummaryButton label="Special" ratio={formatRatio(xSpecial, ySpecial)} section="SPECIAL" />
    </div>
  );
}
