import { twMerge } from 'tailwind-merge';

/**
 * TailAdmin utility — merges Tailwind class names with conflict resolution.
 * Vendored alongside TailAdmin components.
 */
export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return twMerge(inputs.filter(Boolean).join(' '));
}
