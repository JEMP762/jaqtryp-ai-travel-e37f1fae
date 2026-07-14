import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyReferral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_code, referred_by")
      .eq("id", userId)
      .maybeSingle();

    const { data: rewards } = await supabase
      .from("referral_rewards")
      .select("id, referred_id, source, credits, created_at")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const { count: referredCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", userId);

    const totalCredits = (rewards ?? []).reduce((s, r: any) => s + (r.credits ?? 0), 0);

    return {
      code: profile?.referral_code ?? null,
      referredBy: profile?.referred_by ?? null,
      referredCount: referredCount ?? 0,
      totalCredits,
      rewards: rewards ?? [],
    };
  });

export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { code: string }) => {
    if (!i?.code || typeof i.code !== "string") throw new Error("code required");
    return { code: i.code.trim().toUpperCase().slice(0, 32) };
  })
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("apply_referral_code", {
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; reason?: string; referrer_id?: string };
  });
