import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

// =====================================================================
// Catálogo de pacotes avulsos (lookup_keys já criados no Stripe)
// =====================================================================
export const CREDIT_PACKS = [
  { lookupKey: "credits_700",  credits: 700,  priceUsd: 9.99,  label: "Starter",  stripeProductId: "prod_UlMf0q6vvfA0He" },
  { lookupKey: "credits_2000", credits: 2000, priceUsd: 24.99, label: "Explorer", stripeProductId: "prod_UlMgLGFHU8Vpbk", popular: true },
  { lookupKey: "credits_4000", credits: 4000, priceUsd: 59.99, label: "Global",   stripeProductId: "prod_UlMhQaBJyIp1vg", bonusPct: 14 },
] as const;

export function packCreditsFromLookup(lookup: string | null | undefined): number | null {
  const p = CREDIT_PACKS.find((p) => p.lookupKey === lookup);
  return p ? p.credits : null;
}

// =====================================================================
// Leitura do saldo
// =====================================================================
export const getMyCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_credits")
      .select("free_balance, monthly_balance, topup_balance, balance, monthly_grant, monthly_reset_at, lifetime_purchased, lifetime_spent")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      free: data?.free_balance ?? 0,
      monthly: data?.monthly_balance ?? 0,
      topup: data?.topup_balance ?? 0,
      total: data?.balance ?? 0,
      monthlyGrant: data?.monthly_grant ?? 0,
      nextReset: data?.monthly_reset_at ?? null,
      lifetimePurchased: data?.lifetime_purchased ?? 0,
      lifetimeSpent: data?.lifetime_spent ?? 0,
    };
  });

// =====================================================================
// Catálogo de custos por feature
// =====================================================================
export const getCreditCosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("credit_costs")
      .select("feature_key, cost, label, description, active")
      .eq("active", true)
      .order("cost", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// =====================================================================
// Gastar créditos de uma feature
// =====================================================================
export const spendForFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { featureKey: string; metadata?: Record<string, unknown> }) => {
    if (!i?.featureKey || typeof i.featureKey !== "string") throw new Error("featureKey required");
    return { featureKey: i.featureKey, metadata: i.metadata ?? {} };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: result, error } = await supabase.rpc("spend_for_feature", {
      _user: userId,
      _feature: data.featureKey,
      _meta: data.metadata as any,
    });
    if (error) throw new Error(error.message);
    return result as unknown as
      | { ok: true; spent: number; balance: number }
      | { ok: false; reason: "insufficient"; needed: number; have: number }
      | { ok: false; reason: string };
  });

// =====================================================================
// Histórico do ledger
// =====================================================================
export const listCreditHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number } | undefined) => ({ limit: Math.min(Math.max(i?.limit ?? 50, 1), 200) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("credit_ledger")
      .select("id, delta, reason, metadata, stripe_session_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// =====================================================================
// Checkout de pacote avulso (Embedded Checkout)
// =====================================================================
type PackCheckoutResult = { clientSecret: string } | { error: string };

export const createCreditPackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lookupKey: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.lookupKey)) throw new Error("Invalid lookupKey");
    const found = CREDIT_PACKS.find((p) => p.lookupKey === data.lookupKey);
    if (!found) throw new Error("Pacote desconhecido");
    return data;
  })
  .handler(async ({ data, context }): Promise<PackCheckoutResult> => {
    try {
      const { userId, claims } = context as any;
      const email = claims?.email as string | undefined;
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.lookupKey] });
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error(`Price '${data.lookupKey}' não encontrado`);

      // Resolve/cria customer com metadata.userId
      let customerId: string;
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 1,
      });
      if (found.data.length) {
        customerId = found.data[0].id;
      } else if (email) {
        const existing = await stripe.customers.list({ email, limit: 1 });
        if (existing.data.length) {
          customerId = existing.data[0].id;
          if (existing.data[0].metadata?.userId !== userId) {
            await stripe.customers.update(customerId, {
              metadata: { ...existing.data[0].metadata, userId },
            });
          }
        } else {
          const created = await stripe.customers.create({ email, metadata: { userId } });
          customerId = created.id;
        }
      } else {
        const created = await stripe.customers.create({ metadata: { userId } });
        customerId = created.id;
      }

      const pack = CREDIT_PACKS.find((p) => p.lookupKey === data.lookupKey)!;
      const productId =
        typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: { description: product.name },
        metadata: {
          userId,
          kind: "credit_pack",
          lookup_key: data.lookupKey,
          credits: String(pack.credits),
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
