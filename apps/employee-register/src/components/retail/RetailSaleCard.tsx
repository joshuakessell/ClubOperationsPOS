import type { ReactNode } from 'react';
import { PanelHeader } from '../../views/PanelHeader';
import type { RetailCatalogItem, RetailCartItem } from './retailCatalog';

export function RetailSaleCard({
  title,
  items,
  cartItems,
  total,
  onAddItem,
  onRemoveItem,
  footer,
}: {
  title: string;
  items: RetailCatalogItem[];
  cartItems: RetailCartItem[];
  total: number;
  onAddItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  footer: ReactNode;
}) {
  return (
    <div className="er-retail-card">
      <PanelHeader title={title} spacing="sm" />

      <div className="er-retail-layout">
        <section className="er-retail-catalog" aria-label="Catalog">
          <div className="er-retail-section-title">
            Quick Add <span className="er-retail-section-hint">Tap to add</span>
          </div>
          <div className="er-retail-items" role="list">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03] er-retail-item-button"
                onClick={() => onAddItem(item.id)}
              >
                <span className="er-retail-item-label">{item.label}</span>
                <span className="er-retail-price">${item.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="er-retail-cart-panel" aria-label="Cart">
          <div className="er-retail-section-title">Current Sale</div>
          <div className="er-retail-cart">
            {cartItems.length === 0 ? (
              <div className="er-retail-cart-empty">No items added.</div>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="er-retail-cart-row">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-error-300 bg-error-50 px-2 py-1 text-sm font-semibold text-error-600 transition hover:bg-error-100 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20 er-retail-cart-remove"
                    onClick={() => onRemoveItem(item.id)}
                    aria-label={`Remove ${item.label}`}
                  >
                    −
                  </button>
                  <div className="er-retail-cart-label">
                    <div className="er-retail-cart-name">{item.label}</div>
                    <div className="er-retail-cart-meta">Qty {item.quantity}</div>
                  </div>
                  <div className="er-retail-cart-unit">${item.lineTotal.toFixed(2)}</div>
                </div>
              ))
            )}
          </div>

          <div className="er-retail-total">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>

          <div className="er-retail-actions">{footer}</div>
        </section>
      </div>
    </div>
  );
}
