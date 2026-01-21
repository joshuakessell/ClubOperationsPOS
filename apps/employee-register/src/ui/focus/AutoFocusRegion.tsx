import { type ReactNode, useEffect, useRef } from 'react';
import { focusBestTextEntry, isEmptyTextEntry } from './focusUtils';

export function AutoFocusRegion({
  active,
  children,
  restoreFocus = true,
}: {
  active: boolean;
  children: ReactNode;
  restoreFocus?: boolean;
}) {
  const regionRef = useRef<HTMLDivElement | null>(null);
  const prevFocusedRef = useRef<HTMLElement | null>(null);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;

    // Track previous focus on activation.
    if (active && !wasActiveRef.current && restoreFocus) {
      const prev = document.activeElement;
      prevFocusedRef.current = prev instanceof HTMLElement ? prev : null;
    }

    wasActiveRef.current = active;

    if (active) {
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLElement && region.contains(activeEl)) return;

      // Wait until after paint so focus targets exist.
      const raf = requestAnimationFrame(() => {
        const focused = focusBestTextEntry(region);
        // If we focused an empty input/textarea, place cursor at start for fast typing.
        if (focused && isEmptyTextEntry(focused)) {
          if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
            try {
              focused.setSelectionRange(0, 0);
            } catch {
              // Ignore selection errors (e.g. non-text inputs).
            }
          }
        }
      });
      return () => cancelAnimationFrame(raf);
    }

    // Deactivation: restore prior focus.
    if (!active && restoreFocus) {
      const prev = prevFocusedRef.current;
      if (prev && document.contains(prev)) {
        prev.focus();
      }
      prevFocusedRef.current = null;
    }
  }, [active, restoreFocus]);

  // Unmount restore (covers cases where the region is removed while active).
  useEffect(() => {
    return () => {
      if (!restoreFocus) return;
      if (!wasActiveRef.current) return;
      const prev = prevFocusedRef.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [restoreFocus]);

  return <div ref={regionRef}>{children}</div>;
}

