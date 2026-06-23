import * as React from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCreditPackCheckout } from "@/lib/credits.functions";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  lookupKey: string | null;
  onClose: () => void;
}

export function CreditPackCheckoutDialog({ lookupKey, onClose }: Props) {
  const open = !!lookupKey;
  const fetchClientSecret = React.useCallback(async (): Promise<string> => {
    if (!lookupKey) throw new Error("no lookup key");
    const res = await createCreditPackCheckout({
      data: {
        lookupKey,
        returnUrl: `${window.location.origin}/credits?paid=1`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in res) throw new Error(res.error);
    if (!res.clientSecret) throw new Error("Sem clientSecret");
    return res.clientSecret;
  }, [lookupKey]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {open && (
          <div id="checkout" className="max-h-[85vh] overflow-y-auto">
            <EmbeddedCheckoutProvider
              key={lookupKey}
              stripe={getStripe()}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
