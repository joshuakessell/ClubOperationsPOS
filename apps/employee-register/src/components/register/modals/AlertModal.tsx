import { Button } from '../../../ui/Button';
import { ModalFrame } from './ModalFrame';

export type AlertModalProps = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export function AlertModal({ open, title = 'Notice', message, onClose }: AlertModalProps) {
  if (!open) return null;

  return (
    <ModalFrame isOpen={true} title={title} onClose={onClose} maxWidth="520px">
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-700">{message}</p>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    </ModalFrame>
  );
}

