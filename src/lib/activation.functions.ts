import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const intentSchema = z.enum(["itinerary", "flight_search", "image_translation", "document_translation", "travel_budget", "direct"]);
const eventSchema = z.enum(["signup_completed", "onboarding_started", "onboarding_completed", "first_action", "first_result", "second_action", "share_clicked", "feature_discovered", "return_visit", "subscription_started"]);

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
      draft: data.draft as any,
      source_context: data.sourceContext as any,
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
      properties: data.properties as any,
    });
    if (error) throw new Error(error.message);
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
      payload: data.payload,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: result.id };
  });

export const shareUserResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ resultId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.from("user_results").select("kind,title,summary,payload").eq("id", data.resultId).eq("user_id", context.userId).single();
    if (error || !result) throw new Error("Resultado não encontrado");
    if (result.kind !== "itinerary" && result.kind !== "translation") throw new Error("Este resultado não pode ser compartilhado");
    const slug = `${result.kind === "itinerary" ? "rot" : "tra"}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const { error: insertError } = await context.supabase.from("shared_results").insert({
      slug,
      owner_id: context.userId,
      kind: result.kind,
      title: result.title,
      summary: result.summary,
      public_payload: result.payload,
    });
    if (insertError) throw new Error(insertError.message);
    return { slug, path: result.kind === "itinerary" ? `/roteiro/${slug}` : `/traducao/${slug}` };
  });