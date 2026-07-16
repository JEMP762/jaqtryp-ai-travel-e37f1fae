import { createFileRoute } from "@tanstack/react-router";
import { requireAuthFromRequest } from "@/lib/auth-route.server";
import { chargeFeature, checkBalance, insufficientCreditsResponse } from "@/lib/credit-charge.server";

// Allowlist of feature keys callable from /api/ai. Map each to the
// corresponding row in `credit_costs`. Default is the cheapest text op.
const ALLOWED_FEATURES = new Set([
  "translate_text",
  "translate_image",
  "translate_menu_sign",
  "translate_voice",
  "trip_create_full",
  "trip_update_ai",
  "trip_optimize_full",
  "itinerary_ai",
]);

export const Route = createFileRoute("/api/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuthFromRequest(request);
        if (!auth.ok) return auth.response;
        const userId = auth.userId;

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey)
          return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500 });

        const body = (await request.json().catch(() => null)) as {
          system?: string;
          prompt?: string;
          model?: string;
          image?: string;
          featureKey?: string;
        } | null;
        if (!body?.prompt && !body?.image) {
          return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400 });
        }

        // Resolve feature key. If client did not provide one, infer from payload.
        const requested = body.featureKey;
        const featureKey =
          requested && ALLOWED_FEATURES.has(requested)
            ? requested
            : body.image
              ? "translate_image"
              : "translate_text";

        // Pre-check balance to avoid spending AI tokens for nothing.
        const pre = await checkBalance(userId, featureKey);
        if (!pre.ok) return insufficientCreditsResponse(pre as any);

        const userContent: any = body.image
          ? [
              { type: "text", text: body.prompt || "" },
              { type: "image_url", image_url: { url: body.image } },
            ]
          : body.prompt;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: body.model || (body.image ? "google/gemini-2.5-flash" : "google/gemini-3.5-flash"),
            messages: [
              ...(body.system ? [{ role: "system", content: body.system }] : []),
              { role: "user", content: userContent },
            ],
          }),
        });

        if (!resp.ok) {
          const status = resp.status;
          let msg = "AI gateway error";
          if (status === 429) msg = "Limite atingido. Tente novamente.";
          else if (status === 402) msg = "Créditos de IA esgotados.";
          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { "content-type": "application/json" },
          });
        }
        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content ?? "";

        // Charge only after the AI call succeeded.
        const spend = await chargeFeature(userId, featureKey, { route: "api.ai" });
        const credits =
          spend.ok === true ? { spent: spend.spent, balance: spend.balance } : null;

        return new Response(JSON.stringify({ text, credits }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
