import * as React from "react";
import { getMyCredits } from "@/lib/credits.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SESSION_KEY = "jq_upgrade_gate_shown";

export const UPGRADE_GATE_EVENT = "open-upgrade-gate";

export function openUpgradeGate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPGRADE_GATE_EVENT));
  }
}

/**
 * Decides when to auto-open the upgrade modal.
 * - user has 0 credits in every bucket
 * - user has spent at least once (i.e. already burned the 100 free)
 * - no active subscription
 * - only once per session (unless explicitly re-triggered via event)
 */
export function useUpgradeGate() {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);

  // Listen to explicit triggers (e.g. from credit-error handler)
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(UPGRADE_GATE_EVENT, handler);
    return () => window.removeEventListener(UPGRADE_GATE_EVENT, handler);
  }, []);

  // Auto-check once per session on mount
  React.useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;

    let cancelled = false;
    (async () => {
      try {
        const [wallet, subRes] = await Promise.all([
          getMyCredits().catch(() => null),
          supabase.rpc("has_premium_access", { user_uuid: user.id }),
        ]);
        if (cancelled || !wallet) return;

        const zero =
          (wallet.free ?? 0) === 0 &&
          (wallet.monthly ?? 0) === 0 &&
          (wallet.topup ?? 0) === 0;
        const spentBefore = (wallet.lifetimeSpent ?? 0) >= 1;
        const hasPremium = !!subRes.data;

        if (zero && spentBefore && !hasPremium) {
          window.sessionStorage.setItem(SESSION_KEY, "1");
          setOpen(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { open, setOpen };
}
