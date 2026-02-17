export function remainingCountLabel(count: number): { label: string; tone: 'ok' | 'low' | 'none' } {
  if (count <= 0) return { label: '0 remaining', tone: 'none' };
  if (count <= 5) return { label: `${count} remaining (low)`, tone: 'low' };
  return { label: `${count} remaining`, tone: 'ok' };
}
