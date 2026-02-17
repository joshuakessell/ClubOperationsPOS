import { Button } from '@club-ops/ui/tailadmin';

export interface RegisterTopActionsBarProps {
  onCheckout: () => void;
  onRoomCleaning: () => void;
}

export function RegisterTopActionsBar({ onCheckout, onRoomCleaning }: RegisterTopActionsBarProps) {
  return (
    <div className="flex items-center gap-3" aria-label="Register top actions">
      <Button onClick={onCheckout}>
        <span className="mr-1" aria-hidden="true">
          ✅
        </span>
        Checkout
      </Button>
      <Button variant="outline" onClick={onRoomCleaning}>
        <span className="mr-1" aria-hidden="true">
          🧹
        </span>
        Room Cleaning
      </Button>
    </div>
  );
}
