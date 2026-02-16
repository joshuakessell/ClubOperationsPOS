/**
 * TailAdmin Pro UI Components — barrel export for @club-ops use.
 *
 * All components are vendored from TailAdmin React Pro 2.0 with
 * minimal adaptations. See individual files for details.
 */

// ── UI Primitives ────────────────────────────────────────────

export { default as Button } from './ui/button/Button';
export type { ButtonProps } from './ui/button/Button';

export { Card, CardTitle, CardDescription } from './ui/card/index';

export { Modal } from './ui/modal/index';

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from './ui/table/index';

export { default as Badge } from './ui/badge/Badge';

export { default as Alert } from './ui/alert/Alert';

export { Spinner } from './ui/spinner/Spinner';

// ── Form Components ──────────────────────────────────────────

export { default as Input } from './form/InputField';
export { default as Label } from './form/Label';
export { default as Select } from './form/Select';
export { default as TextArea } from './form/TextArea';
export { default as Checkbox } from './form/Checkbox';
export { default as Radio } from './form/Radio';

// ── Context & Hooks ──────────────────────────────────────────

export { ThemeProvider, useTheme } from './context/ThemeContext';
export { useModal } from './hooks/useModal';
