import { Button } from '../ui/Button';
import { ModalFrame } from '../features/register/modals/ModalFrame';

export type ScanToastOverlayProps = {
  message: string | null;
  onDismiss: () => void;
  title?: string;
};

export function ScanToastOverlay({ message, onDismiss, title = 'Scan' }: ScanToastOverlayProps) {
  if (!message) return null;

  return (
    <ModalFrame isOpen={true} title={title} onClose={onDismiss} maxWidth="520px">
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-700">{message}</p>
        <div className="flex justify-end">
          <Button onClick={onDismiss}>OK</Button>
        </div>
      </div>
    </ModalFrame>
  );
}

