export type Focusable = HTMLElement;

const FOCUSABLE_SELECTOR =
  [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

function isVisible(el: HTMLElement) {
  // Fast-ish visibility check that works for fixed/absolute elements too.
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (el.hasAttribute('hidden')) return false;
  // Elements with zero rects are typically not focusable in practice.
  const rects = el.getClientRects();
  return rects.length > 0;
}

export function getFocusable(container: ParentNode): Focusable[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => {
    if (!isVisible(el)) return false;
    // Ignore disabled fieldset descendants.
    if (el.closest('fieldset[disabled]')) return false;
    // Some custom controls set tabindex=-1 while still matching selector parts above; respect it.
    const ti = el.getAttribute('tabindex');
    if (ti === '-1') return false;
    return true;
  });
}

export function isTextEntry(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'hidden') return false;
    // Treat common non-text inputs as non-text-entry.
    if (['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color'].includes(type))
      return false;
    return true;
  }
  const ce = el.getAttribute('contenteditable');
  return ce === 'true';
}

export function isEmptyTextEntry(el: Element | null): el is HTMLElement {
  if (!isTextEntry(el)) return false;
  if (el instanceof HTMLTextAreaElement) return el.value.trim().length === 0;
  if (el instanceof HTMLInputElement) return el.value.trim().length === 0;
  // contenteditable
  return (el.textContent || '').trim().length === 0;
}

export function focusBestTextEntry(container: ParentNode): Focusable | null {
  const focusables = getFocusable(container);
  if (focusables.length === 0) return null;

  const preferred = focusables.find((el) => el.getAttribute('data-autofocus') === 'true');
  if (preferred) {
    preferred.focus();
    return preferred;
  }

  const emptyText = focusables.find((el) => isEmptyTextEntry(el));
  if (emptyText) {
    emptyText.focus();
    return emptyText;
  }

  const anyText = focusables.find((el) => isTextEntry(el));
  if (anyText) {
    anyText.focus();
    return anyText;
  }

  focusables[0]?.focus();
  return focusables[0] ?? null;
}

export function trapFocusOnTab(e: KeyboardEvent, container: ParentNode): boolean {
  if (e.key !== 'Tab') return false;
  const focusables = getFocusable(container);
  if (focusables.length === 0) return false;

  const active = document.activeElement as HTMLElement | null;
  const idx = active ? focusables.indexOf(active) : -1;
  const nextIdx = e.shiftKey
    ? idx <= 0
      ? focusables.length - 1
      : idx - 1
    : idx === -1 || idx === focusables.length - 1
      ? 0
      : idx + 1;
  e.preventDefault();
  focusables[nextIdx]?.focus();
  return true;
}

