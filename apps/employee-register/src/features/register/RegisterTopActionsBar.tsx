import { Button } from '../../ui/Button';

export interface RegisterTopActionsBarProps {
  onCheckout(): void;
  onRoomCleaning(): void;
}

export function RegisterTopActionsBar({ onCheckout, onRoomCleaning }: RegisterTopActionsBarProps) {
  return (
    <div className="action-buttons register-top-actions" aria-label="Register top actions">
      <Button type="button" className="action-btn" onClick={onCheckout}>
        <span className="btn-icon" aria-hidden="true">
          ✅
        </span>
        Checkout
      </Button>
      <Button type="button" className="action-btn" variant="secondary" onClick={onRoomCleaning}>
        <span className="btn-icon" aria-hidden="true">
          🧹
        </span>
        Room Cleaning
      </Button>
    </div>
  );
}


