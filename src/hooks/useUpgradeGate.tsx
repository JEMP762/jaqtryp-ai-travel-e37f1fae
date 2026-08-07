import * as React from "react";
import { getMyCredits } from "@/lib/credits.functions";
import { checkPremiumAccessClient } from "@/lib/premium-access";
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

    // Never auto-open on auth/public routes
    const path = window.location.pathname;
    const isAuthRoute =
      path === "/" ||
      path.startsWith("/login") ||
      path.startsWith("/signup") ||
      path.startsWith("/reset-password") ||
      path.startsWith("/auth");
    if (isAuthRoute) return;

    let cancelled = false;
    (async () => {
      try {
        const [walletRes, subRes] = await Promise.allSettled([
          getMyCredits(),
          checkPremiumAccessClient(user.id),
        ]);
        if (cancelled) return;

        // Fail-safe: if any query failed, do NOT open the modal
        if (walletRes.status !== "fulfilled" || !walletRes.value) return;
        if (subRes.status !== "fulfilled" || subRes.value === null) return;

        const wallet = walletRes.value;
        const hasPremium = subRes.value === true;
        if (hasPremium) return; // paying users never see the gate

        const zero =
          (wallet.free ?? 0) === 0 &&
          (wallet.monthly ?? 0) === 0 &&
          (wallet.topup ?? 0) === 0;
        const spentBefore = (wallet.lifetimeSpent ?? 0) >= 1;

        if (zero && spentBefore) {
          window.sessionStorage.setItem(SESSION_KEY, "1");
          setOpen(true);
        }
      } catch {
        /* fail-safe: never open on error */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);


  return { open, setOpen };
}
