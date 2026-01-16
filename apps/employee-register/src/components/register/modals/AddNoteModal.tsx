import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';

export interface AddNoteModalProps {
  isOpen: boolean;
  noteText: string;
  onChangeNoteText: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function AddNoteModal({
  isOpen,
  noteText,
  onChangeNoteText,
  onSubmit,
  onCancel,
  isSubmitting,
}: AddNoteModalProps) {
  return (
    <ModalFrame isOpen={isOpen} title="Add Note" onClose={onCancel}>
      <textarea
        value={noteText}
        onChange={(e) => onChangeNoteText(e.target.value)}
        placeholder="Enter note..."
        rows={4}
        className="form-textarea mb-4 block w-full resize-y rounded-md border-gray-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600/30"
      />
      <div className="flex gap-3">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || !noteText.trim()}
          className="flex-1"
        >
          {isSubmitting ? 'Adding...' : 'Add Note'}
        </Button>
        <Button
          onClick={onCancel}
          variant="danger"
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </ModalFrame>
  );
}

