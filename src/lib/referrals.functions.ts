import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "crypto";
import { z } from "zod";

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

    const { data: journeys } = await supabase
      .from("viral_referrals")
      .select("id,status,feature,source,registered_at,activated_at,rewarded_at,reward_credits,created_at")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: settings } = await supabase
      .from("viral_reward_settings")
      .select("event_key,credits,enabled");

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
      journeys: journeys ?? [],
      settings: settings ?? [],
    };
  });

export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    code: z.string().min(1).max(32).transform((value) => value.trim().toUpperCase()),
    visitorId: z.string().min(8).max(100).optional(),
    shareSlug: z.string().max(100).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const visitorHash = data.visitorId ? createHash("sha256").update(data.visitorId).digest("hex") : undefined;
    const { data: result, error } = await context.supabase.rpc("register_viral_referral", {
      _code: data.code,
      _visitor_hash: visitorHash,
      _share_slug: data.shareSlug ?? undefined,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; reason?: string; referrer_id?: string };
  });
