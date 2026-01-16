import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

export interface WaitlistPopoverItem {
  id: string;
  title: string; // entry.customerName || entry.displayIdentifier
  subtitle: string; // `${entry.displayIdentifier} → ${entry.desiredTier}`
  eligible: boolean;
  customerName?: string | null;
}

export interface WaitlistPopoverProps {
  open: boolean;
  disabledReason?: string | null; // when sessionActive
  items: WaitlistPopoverItem[];
  hasMore: boolean;
  onClose: () => void;
  onAction: (id: string, customerName?: string | null) => void;
  onMore: () => void;
}

export function WaitlistPopover({
  open,
  disabledReason,
  items,
  hasMore,
  onClose,
  onAction,
  onMore,
}: WaitlistPopoverProps) {
  if (!open) return null;

  return (
    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
      <Card
        padding="none"
        className="absolute right-0 z-[1500] w-[320px] bg-slate-900/70 text-white shadow-2xl ring-slate-700"
      >
        <div
          style={{
            padding: '0.75rem',
            borderBottom: '1px solid #1f2937',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontWeight: 700, color: '#f59e0b' }}>Waitlist</div>
          <Button onClick={onClose} variant="secondary" className="h-9 px-3 text-sm">
            Close
          </Button>
        </div>
        <div
          style={{
            maxHeight: '260px',
            overflowY: 'auto',
            opacity: disabledReason ? 0.65 : 1,
            pointerEvents: disabledReason ? 'none' : 'auto',
          }}
        >
          {items.length === 0 && (
            <div style={{ padding: '0.75rem', color: '#94a3b8' }}>No waitlist entries</div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '0.75rem',
                borderBottom: '1px solid #1f2937',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{item.subtitle}</div>
              </div>
              <Button
                aria-label={`Begin upgrade for ${item.title}`}
                onClick={() => onAction(item.id, item.customerName)}
                variant={item.eligible ? 'primary' : 'secondary'}
                className="h-10 w-12 p-0 text-base"
                disabled={!item.eligible}
              >
                🔑
              </Button>
            </div>
          ))}
          {hasMore && (
            <div
              onClick={onMore}
              style={{
                padding: '0.75rem',
                borderTop: '1px solid #1f2937',
                color: '#f59e0b',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              More..
            </div>
          )}
        </div>
        {disabledReason && (
          <div
            style={{
              padding: '0.65rem 0.75rem',
              color: '#f59e0b',
              fontSize: '0.85rem',
              borderTop: '1px solid #1f2937',
            }}
          >
            {disabledReason}
          </div>
        )}
      </Card>
    </div>
  );
}

