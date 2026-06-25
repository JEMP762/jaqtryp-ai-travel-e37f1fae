// Server-only helpers for charging credits per feature.
// Usage:
//   - In a server route handler: after auth + AI success, call
//     `chargeFeature(userId, "translate_text", { ... })`.
//   - In a `createServerFn` handler with requireSupabaseAuth: pass
//     `context.supabase` to `chargeFeatureWith(...)`.
//
// Both paths use the database RPC `spend_for_feature`, which atomically
// debits the user's bucket-aware balance (monthly → free → topup) and
// records a ledger entry. The RPC returns `{ ok: false, reason: 'insufficient' }`
// when the user does not have enough credits.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SpendResult =
  | { ok: true; spent: number; balance: number }
  | { ok: false; reason: "insufficient"; needed: number; have: number }
  | { ok: false; reason: string };

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin not configured");
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/**
 * Check the user's balance against a feature cost WITHOUT debiting.
 * Returns `{ ok: true }` when balance is sufficient, otherwise an
 * insufficient/unknown_feature result that can be returned to the caller.
 */
export async function checkBalance(
  userId: string,
  featureKey: string,
): Promise<{ ok: true; cost: number; have: number } | { ok: false; reason: string; needed?: number; have?: number }> {
  const sb = admin();
  const [{ data: cost }, { data: wallet }] = await Promise.all([
    sb.from("credit_costs").select("cost, active").eq("feature_key", featureKey).maybeSingle(),
    sb.from("user_credits").select("balance").eq("user_id", userId).maybeSingle(),
  ]);
  if (!cost || cost.active === false) return { ok: false, reason: "unknown_feature" };
  const have = Number((wallet as any)?.balance ?? 0);
  const needed = Number((cost as any).cost ?? 0);
  if (have < needed) return { ok: false, reason: "insufficient", needed, have };
  return { ok: true, cost: needed, have };
}

/**
 * Charge a feature using the service-role client. Use from server routes
 * (`createFileRoute(...).server.handlers`) after auth succeeds.
 */
export async function chargeFeature(
  userId: string,
  featureKey: string,
  metadata: Record<string, unknown> = {},
): Promise<SpendResult> {
  const { data, error } = await admin().rpc("spend_for_feature", {
    _user: userId,
    _feature: featureKey,
    _meta: metadata as any,
  });
  if (error) return { ok: false, reason: error.message };
  return data as unknown as SpendResult;
}

/**
 * Charge a feature using a per-request authenticated client (RLS as user).
 * Use from `createServerFn` handlers that already have `context.supabase`.
 */
export async function chargeFeatureWith(
  supabase: SupabaseClient,
  userId: string,
  featureKey: string,
  metadata: Record<string, unknown> = {},
): Promise<SpendResult> {
  const { data, error } = await supabase.rpc("spend_for_feature", {
    _user: userId,
    _feature: featureKey,
    _meta: metadata as any,
  });
  if (error) return { ok: false, reason: error.message };
  return data as unknown as SpendResult;
}

/** HTTP response helper for the "insufficient credits" case. */
export function insufficientCreditsResponse(result: Extract<SpendResult, { ok: false }>) {
  const status = result.reason === "insufficient" ? 402 : 400;
  const message =
    result.reason === "insufficient"
      ? `Créditos insuficientes. Faltam ${(result as any).needed - (result as any).have} créditos.`
      : result.reason === "unknown_feature"
        ? "Feature de créditos não configurada."
        : "Falha ao debitar créditos.";
  return new Response(JSON.stringify({ error: message, code: result.reason }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
