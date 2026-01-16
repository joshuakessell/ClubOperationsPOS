import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

export type InventorySummarySection = 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL';

export type InventoryAvailableCounts = null | {
  rooms: Record<string, number>;
  rawRooms: Record<string, number>;
  lockers: number;
};

export interface InventorySummaryBarProps {
  counts: InventoryAvailableCounts;
  onOpenInventorySection(section: InventorySummarySection): void;
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

  const PillButton = (props: {
    label: string;
    ratio: string;
    section: InventorySummarySection;
  }) => (
    <Button
      type="button"
      variant="secondary"
      className="min-w-[150px] justify-between gap-3 rounded-full px-4"
      disabled={disabled}
      onClick={() => onOpenInventorySection(props.section)}
    >
      <span style={{ fontWeight: 800 }}>{props.label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{props.ratio}</span>
    </Button>
  );

  return (
    <Card
      padding="md"
      className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 text-white ring-slate-700"
      aria-label="Inventory summary"
    >
      <PillButton label="Lockers" ratio={formatRatio(lockers, lockers)} section="LOCKER" />
      <PillButton label="Standard" ratio={formatRatio(xStandard, yStandard)} section="STANDARD" />
      <PillButton label="Double" ratio={formatRatio(xDouble, yDouble)} section="DOUBLE" />
      <PillButton label="Special" ratio={formatRatio(xSpecial, ySpecial)} section="SPECIAL" />
    </Card>
  );
}


