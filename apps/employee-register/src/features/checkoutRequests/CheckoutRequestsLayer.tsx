import type { CheckoutRequestSummary } from '@club-ops/shared';
import { CheckoutRequestsBanner } from '../register/CheckoutRequestsBanner';
import { CheckoutVerificationModal } from '../register/CheckoutVerificationModal';
import type { CheckoutRequestsController } from './useCheckoutRequestsController';

export function CheckoutRequestsLayer(props: {
  controller: CheckoutRequestsController;
  isSubmitting: boolean;
}): JSX.Element | null {
  const { controller, isSubmitting } = props;
  const { checkoutRequests, selectedCheckoutRequest } = controller;

  if (checkoutRequests.size === 0 && !selectedCheckoutRequest) return null;

  return (
    <>
      {/* Checkout Request Notifications */}
      {checkoutRequests.size > 0 && !selectedCheckoutRequest && (
        <CheckoutRequestsBanner
          requests={Array.from(checkoutRequests.values()) as CheckoutRequestSummary[]}
          onClaim={(id) => void controller.claim(id)}
        />
      )}

      {/* Checkout Verification Screen */}
      {selectedCheckoutRequest &&
        (() => {
          const request = checkoutRequests.get(selectedCheckoutRequest);
          if (!request) return null;
          return (
            <CheckoutVerificationModal
              request={request}
              isSubmitting={isSubmitting}
              checkoutItemsConfirmed={controller.checkoutItemsConfirmed}
              checkoutFeePaid={controller.checkoutFeePaid}
              onConfirmItems={() => void controller.confirmItems(selectedCheckoutRequest)}
              onMarkFeePaid={() => void controller.markFeePaid(selectedCheckoutRequest)}
              onComplete={() => void controller.complete(selectedCheckoutRequest)}
              onCancel={() => controller.cancel()}
            />
          );
        })()}
    </>
  );
}

