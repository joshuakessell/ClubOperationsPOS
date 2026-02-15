type LineItem = { description: string; amount: number };

export function derivePastDueLineItems(pastDueBalance: number): LineItem[] {
  const items: LineItem[] = [];

  if (items.length === 0 && pastDueBalance > 0) {
    items.push({ description: 'Past due balance', amount: pastDueBalance });
  }

  return items;
}
