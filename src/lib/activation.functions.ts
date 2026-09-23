import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const intentSchema = z.enum(["itinerary", "flight_search", "image_translation", "document_translation", "travel_budget", "direct"]);
const eventSchema = z.enum(["signup_completed", "onboarding_started", "onboarding_completed", "first_action", "first_result", "second_action", "share_clicked", "feature_discovered", "return_visit", "subscription_started"]);

const shareableKinds = ["itinerary", "translation", "travel_budget", "document_translation", "flight_search"] as const;

function publicSnapshot(kind: string, payload: Record<string, unknown>) {
  if (kind === "itinerary") return { markdown: payload.markdown, destination: payload.destination, days: payload.days, currency: payload.currency };
  if (kind === "translation") return { translation: payload.translation, from: payload.from, to: payload.to };
  if (kind === "travel_budget") return { markdown: payload.markdown, currency: payload.currency, total: payload.total, daily: payload.daily };
  if (kind === "document_translation") return { summary: payload.summary, sourceLanguage: payload.sourceLanguage, targetLanguage: payload.targetLanguage };
  if (kind === "flight_search") return { summary: payload.summary, origin: payload.origin, destination: payload.destination, departureDate: payload.departureDate };
  return {};
}

export const getActivationState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: onboarding }, { data: results }, { data: credits }] = await Promise.all([
      supabase.from("user_onboarding").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_results").select("id,kind,title,summary,payload,occurred_at,updated_at").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(6),
      supabase.from("user_credits").select("free_balance,monthly_balance,topup_balance,balance").eq("user_id", userId).maybeSingle(),
    ]);
    return { onboarding: onboarding ?? null, results: results ?? [], credits: credits ?? null };
  });

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    intent: intentSchema,
    status: z.enum(["started", "completed", "skipped"]).default("started"),
    currentStep: z.number().int().min(1).max(10),
    draft: z.record(z.string(), z.unknown()).default({}),
    sourceContext: z.record(z.string(), z.unknown()).default({}),
    variant: z.string().max(40).default("default"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_onboarding").upsert({
      user_id: context.userId,
      intent: data.intent,
      status: data.status,
      current_step: data.currentStep,
      draft: data.draft as Json,
      source_context: data.sourceContext as Json,
      variant: data.variant,
      completed_at: data.status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const trackActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    event: eventSchema,
    feature: z.string().max(50).optional(),
    source: z.string().max(80).optional(),
    campaign: z.string().max(120).optional(),
    variant: z.string().max(40).default("default"),
    properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("activation_events").insert({
      user_id: context.userId,
      event_name: data.event,
      feature: data.feature ?? null,
      source: data.source ?? null,
      campaign: data.campaign ?? null,
      variant: data.variant,
      properties: data.properties as Json,
    });
    if (error) throw new Error(error.message);
    if (data.event === "first_result") {
      await context.supabase.rpc("activate_viral_referral", { _user: context.userId });
    }
    return { ok: true };
  });

export const saveUserResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    kind: z.enum(["itinerary", "translation", "flight_search", "travel_budget", "document_translation"]),
    title: z.string().min(1).max(180),
    summary: z.string().max(500).optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.from("user_results").insert({
      user_id: context.userId,
      kind: data.kind,
      title: data.title,
      summary: data.summary ?? null,
      payload: data.payload as Json,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: result.id };
  });

export const shareUserResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ resultId: z.string().uuid(), confirmedPublic: z.literal(true) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.from("user_results").select("kind,title,summary,payload").eq("id", data.resultId).eq("user_id", context.userId).single();
    if (error || !result) throw new Error("Resultado não encontrado");
    if (!shareableKinds.includes(result.kind as typeof shareableKinds[number])) throw new Error("Este resultado não pode ser compartilhado");
    const [{ data: existing }, { data: profile }] = await Promise.all([
      context.supabase.from("shared_results").select("id,slug,kind").eq("owner_id", context.userId).eq("source_result_id", data.resultId).eq("active", true).maybeSingle(),
      context.supabase.from("profiles").select("referral_code").eq("id", context.userId).single(),
    ]);
    const routeByKind: Record<string, string> = { itinerary: "roteiro", translation: "traducao", travel_budget: "orcamento", document_translation: "documento", flight_search: "voo" };
    if (existing) {
      const query = profile?.referral_code ? `?ref=${encodeURIComponent(profile.referral_code)}` : "";
      return { shareId: existing.id, slug: existing.slug, path: `/${routeByKind[existing.kind]}/${existing.slug}${query}` };
    }
    const prefixByKind: Record<string, string> = { itinerary: "rot", translation: "tra", travel_budget: "orc", document_translation: "doc", flight_search: "voo" };
    const slug = `${prefixByKind[result.kind]}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const { data: shared, error: insertError } = await context.supabase.from("shared_results").insert({
      slug,
      owner_id: context.userId,
      source_result_id: data.resultId,
      referral_code_snapshot: profile?.referral_code ?? null,
      feature: result.kind,
      kind: result.kind,
      title: result.title,
      summary: result.summary,
      public_payload: publicSnapshot(result.kind, result.payload as Record<string, unknown>) as Json,
    }).select("id").single();
    if (insertError) throw new Error(insertError.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: eventError } = await supabaseAdmin.from("viral_events").insert({
      share_id: shared.id, referrer_id: context.userId, event_name: "share_created", feature: result.kind,
      source: "result", idempotency_key: `share:${shared.id}`,
    });
    if (eventError) throw new Error(eventError.message);
    const query = profile?.referral_code ? `?ref=${encodeURIComponent(profile.referral_code)}` : "";
    return { shareId: shared.id, slug, path: `/${routeByKind[result.kind]}/${slug}${query}` };
  });

export const getGrowthEngine = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Acesso negado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data: events }, { data: journeys }, { data: rewards }] = await Promise.all([
      supabaseAdmin.from("viral_events").select("event_name,feature,source,created_at").gte("created_at", since).limit(10000),
      supabaseAdmin.from("viral_referrals").select("status,feature,reward_credits,created_at").gte("created_at", since).limit(10000),
      supabaseAdmin.from("referral_rewards").select("source,credits,created_at").gte("created_at", since).limit(10000),
    ]);
    const counts = (events ?? []).reduce<Record<string, number>>((acc, row) => { acc[row.event_name] = (acc[row.event_name] ?? 0) + 1; return acc; }, {});
    const byFeature = (events ?? []).reduce<Record<string, number>>((acc, row) => { const key = row.feature ?? "general"; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
    return { counts, byFeature, journeys: journeys ?? [], rewards: rewards ?? [] };
  });

export const getActivationFunnel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Acesso negado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data, error } = await supabaseAdmin.from("activation_events").select("event_name,feature,source,campaign,variant,created_at,user_id,visitor_id").gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const counts = rows.reduce<Record<string, number>>((acc, row) => { acc[row.event_name] = (acc[row.event_name] ?? 0) + 1; return acc; }, {});
    const byVariant = rows.reduce<Record<string, Record<string, number>>>((acc, row) => {
      const variant = row.variant || "default";
      acc[variant] ??= {};
      acc[variant][row.event_name] = (acc[variant][row.event_name] ?? 0) + 1;
      return acc;
    }, {});
    return { counts, byVariant, recent: rows.slice(0, 100) };
  });