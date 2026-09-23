import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

const schema = z.object({
  event: z.enum(["shared_content_viewed", "context_cta_clicked"]),
  visitorId: z.string().min(8).max(100),
  feature: z.enum(["itinerary", "translation", "flight_search", "travel_budget"]).optional(),
  source: z.string().max(80).optional(),
  campaign: z.string().max(120).optional(),
  variant: z.string().max(40).default("default"),
  slug: z.string().max(100).optional(),
  ref: z.string().max(32).optional(),
});

export const Route = createFileRoute("/api/public/activation")({
  server: { handlers: { POST: async ({ request }) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new Response(JSON.stringify({ error: "invalid" }), { status: 400, headers: { "content-type": "application/json" } });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const visitorHash = createHash("sha256").update(parsed.data.visitorId).digest("hex");
    if (parsed.data.ref) {
      await supabaseAdmin.rpc("capture_viral_click", {
        _code: parsed.data.ref,
        _share_slug: parsed.data.slug ?? null,
        _visitor_hash: visitorHash,
        _source: parsed.data.source ?? "shared_result",
      });
    }
    const { error } = await supabaseAdmin.from("activation_events").insert({
      visitor_id: visitorHash,
      event_name: parsed.data.event,
      feature: parsed.data.feature ?? null,
      source: parsed.data.source ?? null,
      campaign: parsed.data.campaign ?? null,
      variant: parsed.data.variant,
      properties: parsed.data.slug ? { slug: parsed.data.slug } : {},
    });
    return new Response(JSON.stringify({ ok: !error }), { status: error ? 500 : 200, headers: { "content-type": "application/json" } });
  } } },
});