import { useEffect, useMemo, useState } from 'react';
import { Button } from '@club-ops/ui/tailadmin';
import { getApiUrl } from '@club-ops/shared';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { RequiredTenderOutcomeModal } from '../../components/register/modals/RequiredTenderOutcomeModal';
import { RetailSaleCard } from '../../components/retail/RetailSaleCard';
import {
  RETAIL_CATALOG,
  buildRetailCartItems,
  getRetailCartTotal,
  fetchRetailCatalog,
  type RetailCart,
  type RetailCatalogItem,
} from '../../components/retail/retailCatalog';
import { PanelShell } from '../../views/PanelShell';

export function RetailPanel() {
  const { session, setSuccessToastMessage } = useEmployeeRegisterState();
  const [cart, setCart] = useState<RetailCart>({});
  const [showTenderOptions, setShowTenderOptions] = useState(false);
  const [catalog, setCatalog] = useState<RetailCatalogItem[]>(RETAIL_CATALOG);

  // Fetch dynamic catalog on mount
  useEffect(() => {
    if (!session?.sessionToken) return;
    const apiBase = getApiUrl('/api');
    void fetchRetailCatalog(apiBase, session.sessionToken).then(setCatalog);
  }, [session?.sessionToken]);

  const cartItems = useMemo(() => buildRetailCartItems(cart, catalog), [cart, catalog]);
  const total = useMemo(() => getRetailCartTotal(cartItems), [cartItems]);

  useEffect(() => {
    if (cartItems.length === 0) {
      setShowTenderOptions(false);
    }
  }, [cartItems.length]);

  const addItem = (itemId: string) => {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }));
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      const current = next[itemId] ?? 0;
      if (current <= 1) {
        delete next[itemId];
      } else {
        next[itemId] = current - 1;
      }
      return next;
    });
  };

  const resetSale = () => {
    setCart({});
    setShowTenderOptions(false);
  };

  const handleSaleSuccess = (methodLabel: string) => {
    setSuccessToastMessage(`Retail sale complete (${methodLabel}).`);
    resetSale();
  };

  return (
    <PanelShell align="top" scroll="hidden">
      <RetailSaleCard
        title="Retail"
        items={catalog}
        cartItems={cartItems}
        total={total}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        footer={
          <Button
            onClick={() => setShowTenderOptions(true)}
            disabled={cartItems.length === 0}
            fullWidth
          >
            Sale
          </Button>
        }
      />

      <RequiredTenderOutcomeModal
        isOpen={showTenderOptions}
        totalAmount={total}
        isSubmitting={false}
        onConfirm={(choice) => {
          if (choice === 'CREDIT_SUCCESS') handleSaleSuccess('Credit');
          if (choice === 'CASH_SUCCESS') handleSaleSuccess('Cash');
          if (choice === 'CREDIT_DECLINE') {
            setSuccessToastMessage('Credit declined.');
            setShowTenderOptions(true);
          }
        }}
        onClose={() => setShowTenderOptions(false)}
      />
    </PanelShell>
  );
}

