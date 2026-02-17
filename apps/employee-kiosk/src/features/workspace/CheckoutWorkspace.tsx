import type { ReactNode } from 'react';
import './CheckoutWorkspace.css';

export type CheckoutWorkspaceProps = {
  checkoutPanel: ReactNode;
};

export function CheckoutWorkspace({ checkoutPanel }: CheckoutWorkspaceProps) {
  return (
    <div className="er-checkout-workspace">
      <div className="er-checkout-workspace__primary">{checkoutPanel}</div>
    </div>
  );
}
