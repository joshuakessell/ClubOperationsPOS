/**
 * Tailwind CSS class name merge utility.
 * Combines multiple class name strings, filtering out falsy values.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
