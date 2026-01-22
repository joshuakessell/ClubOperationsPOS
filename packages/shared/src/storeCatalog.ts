export type StoreItem = {
  id: string;
  name: string;
  price: number;
  quickPick?: boolean;
};

export type StoreCart = Record<string, number>;

export const STORE_CATALOG: StoreItem[] = [
  { id: 'water', name: 'Water Bottle', price: 2.0, quickPick: true },
  { id: 'gatorade', name: 'Gatorade', price: 4.0, quickPick: true },
  { id: 'iphone_charger', name: 'iPhone Charger', price: 12.0, quickPick: true },
  { id: 'usb_c_charger', name: 'USB‑C Charger', price: 12.0 },
  { id: 'energy_drink', name: 'Energy Drink', price: 5.0 },
  { id: 'protein_bar', name: 'Protein Bar', price: 3.0 },
  { id: 'chips', name: 'Chips', price: 2.5 },
  { id: 'gum', name: 'Gum', price: 1.5 },
  { id: 'earplugs', name: 'Earplugs', price: 2.0 },
  { id: 'towel', name: 'Towel', price: 6.0 },
];

/**
 * Normalize a store cart input to a valid StoreCart.
 *
 * - Accepts object-like values
 * - Keeps only ids that exist in STORE_CATALOG
 * - Quantities must be integers >= 0
 * - Removes entries with 0 quantity
 */
export function normalizeStoreCart(input: unknown): StoreCart {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const validIds = new Set(STORE_CATALOG.map((item) => item.id));
  const cart: StoreCart = {};

  for (const [key, value] of Object.entries(input)) {
    if (!validIds.has(key)) {
      continue;
    }

    const qty = typeof value === 'number' ? Math.floor(value) : Number(value);
    if (Number.isInteger(qty) && qty > 0) {
      cart[key] = qty;
    }
  }

  return cart;
}

/**
 * Convert a store cart to line items for display/billing.
 *
 * Each item with quantity > 0 becomes a line item with:
 * - description: `${item.name} x ${qty}`
 * - amount: item.price * qty
 */
export function storeCartToLineItems(cart: StoreCart): Array<{ description: string; amount: number }> {
  const itemMap = new Map(STORE_CATALOG.map((item) => [item.id, item]));
  const lineItems: Array<{ description: string; amount: number }> = [];

  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) {
      continue;
    }

    const item = itemMap.get(id);
    if (!item) {
      continue;
    }

    lineItems.push({
      description: `${item.name} x ${qty}`,
      amount: item.price * qty,
    });
  }

  return lineItems;
}

/**
 * Sum the amounts of line items.
 */
export function sumLineItems(lineItems: Array<{ description: string; amount: number }>): number {
  return lineItems.reduce((sum, item) => sum + item.amount, 0);
}
