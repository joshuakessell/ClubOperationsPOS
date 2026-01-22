import { t, type Language } from '../../i18n';
import { STORE_CATALOG, type StoreCart } from '@club-ops/shared';

export interface AddOnsPromptModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  cart: StoreCart;
  onAddItem: (itemId: string) => void;
  onSeeMore: () => void;
  onContinue: () => void;
}

export function AddOnsPromptModal({
  isOpen,
  customerPrimaryLanguage,
  cart,
  onAddItem,
  onSeeMore,
  onContinue,
}: AddOnsPromptModalProps) {
  if (!isOpen) return null;

  const quickPickItems = STORE_CATALOG.filter((item) => item.quickPick);

  return (
    <div className="modal-overlay" onClick={() => {}}>
      <div className="modal-content cs-liquid-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t(customerPrimaryLanguage, 'addOns.prompt.title')}</h2>
        <div className="addons-quick-pick">
          {quickPickItems.map((item) => (
            <button
              key={item.id}
              className="cs-liquid-button addon-quick-pick-btn"
              onClick={() => onAddItem(item.id)}
            >
              {`${item.name} — $${item.price.toFixed(2)}`}
              {(cart[item.id] ?? 0) > 0 && <span className="addon-qty-badge">{cart[item.id]}</span>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button
            className="cs-liquid-button cs-liquid-button--secondary modal-ok-btn"
            onClick={onSeeMore}
          >
            {t(customerPrimaryLanguage, 'addOns.prompt.seeMore')}
          </button>
          <button className="cs-liquid-button modal-ok-btn" onClick={onContinue}>
            {t(customerPrimaryLanguage, 'common.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
