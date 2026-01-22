import { t, type Language } from '../../i18n';
import { STORE_CATALOG, storeCartToLineItems, type StoreCart } from '@club-ops/shared';

export interface StorefrontModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  cart: StoreCart;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onContinue: () => void;
  onClose: () => void;
}

export function StorefrontModal({
  isOpen,
  customerPrimaryLanguage,
  cart,
  onUpdateQuantity,
  onContinue,
  onClose,
}: StorefrontModalProps) {
  if (!isOpen) return null;

  const lineItems = storeCartToLineItems(cart);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content cs-liquid-card storefront-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t(customerPrimaryLanguage, 'addOns.storefront.title')}</h2>
        <div className="storefront-list">
          {STORE_CATALOG.map((item) => {
            const qty = cart[item.id] || 0;
            return (
              <div key={item.id} className="storefront-row">
                <div className="storefront-item-info">
                  <span className="storefront-item-name">{item.name}</span>
                  <span className="storefront-item-price">${item.price.toFixed(2)}</span>
                </div>
                <div className="storefront-qty-controls">
                  <button
                    className="cs-liquid-button storefront-qty-btn"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    disabled={qty === 0}
                  >
                    −
                  </button>
                  <span className="storefront-qty-value">{qty}</span>
                  <button
                    className="cs-liquid-button storefront-qty-btn"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {lineItems.length > 0 && (
          <div className="storefront-selected">
            <h3>{t(customerPrimaryLanguage, 'addOns.storefront.selectedItems')}</h3>
            <div className="storefront-selected-list">
              {lineItems.map((item, idx) => (
                <div key={idx} className="storefront-selected-row">
                  <span>{item.description}</span>
                  <span>${item.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button className="cs-liquid-button modal-ok-btn" onClick={onContinue}>
            {t(customerPrimaryLanguage, 'common.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
