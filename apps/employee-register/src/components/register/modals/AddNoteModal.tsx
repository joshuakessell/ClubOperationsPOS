import { ModalFrame } from './ModalFrame';

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
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        style={{
          width: '100%',
          padding: '0.75rem',
          fontSize: '1rem',
          marginBottom: '1rem',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onSubmit}
          disabled={isSubmitting || !noteText.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
          style={{
            flex: 1,
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          {isSubmitting ? 'Adding...' : 'Add Note'}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-lg border border-error-300 bg-error-50 px-4 py-2.5 text-sm font-semibold text-error-600 shadow-theme-xs transition hover:bg-error-100 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20"
          style={{
            flex: 1,
            padding: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </ModalFrame>
  );
}
