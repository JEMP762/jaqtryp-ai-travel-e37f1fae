import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";
import { chargeFeature, checkBalance } from "@/lib/credit-charge.server";

const BRAND_BUCKET = "brand-logos";
const FEATURE_KEY = "trip_create_branded";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function admin() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Backend not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const payloadSchema = z.object({
  slug: z.string().min(2).max(40),
  destination: z.string().min(2).max(120),
  days: z.number().int().min(1).max(30),
  startDate: z.string().max(20).optional().nullable(),
  travelers: z.number().int().min(1).max(20).optional().nullable(),
  style: z.string().max(80).optional().nullable(),
  budget: z.string().max(40).optional().nullable(),
  currency: z.string().max(6).optional().nullable(),
  // honeypot — must stay empty
  website: z.string().max(0).optional().nullable(),
});

function hostFrom(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function visitorHash(request: Request, slug: string): string {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return createHash("sha256").update(`${slug}:${ip}`).digest("hex").slice(0, 32);
}

export const Route = createFileRoute("/api/public/widget-itinerary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const slug = new URL(request.url).searchParams.get("slug")?.toLowerCase().trim();
        if (!slug) return json({ error: "missing slug" }, 400);
        const sb = await admin();
        const { data: widget } = await sb
          .from("trip_widgets")
          .select("slug, headline, intro, owner_id, active")
          .eq("slug", slug)
          .eq("active", true)
          .maybeSingle();
        if (!widget) return json({ error: "not_found" }, 404);

        const { data: brand } = await sb
          .from("user_branding")
          .select("company_name, logo_path")
          .eq("user_id", widget.owner_id)
          .maybeSingle();

        let logoUrl: string | null = null;
        if (brand?.logo_path) {
          const { data } = await sb.storage
            .from(BRAND_BUCKET)
            .createSignedUrl(brand.logo_path, 60 * 60);
          logoUrl = data?.signedUrl ?? null;
        }

        return json({
          slug: widget.slug,
          headline: widget.headline,
          intro: widget.intro,
          companyName: brand?.company_name ?? null,
          logoUrl,
        });
      },

      POST: async ({ request }) => {
        const raw = await request.json().catch(() => null);
        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) return json({ error: "Dados inválidos." }, 400);
        const input = parsed.data;
        if (input.website) return json({ error: "Dados inválidos." }, 400);

        const slug = input.slug.toLowerCase().trim();
        const sb = await admin();
        const { data: widget } = await sb
          .from("trip_widgets")
          .select("id, owner_id, active, allowed_domains, max_per_hour, max_per_day")
          .eq("slug", slug)
          .eq("active", true)
          .maybeSingle();
        if (!widget) return json({ error: "Este link não está disponível." }, 404);

        // Domain allowlist (only enforced for external embeds)
        const selfHost = hostFrom(request.url);
        const callerHost =
          hostFrom(request.headers.get("origin")) || hostFrom(request.headers.get("referer"));
        const allowed = (widget.allowed_domains ?? []) as string[];
        if (callerHost && callerHost !== selfHost && allowed.length > 0) {
          const ok = allowed.some(
            (d) => callerHost === d.toLowerCase() || callerHost.endsWith(`.${d.toLowerCase()}`),
          );
          if (!ok) return json({ error: "Domínio não autorizado para este widget." }, 403);
        }

        // Rate limits
        const now = Date.now();
        const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        const vhash = visitorHash(request, slug);

        const [{ count: hourCount }, { count: dayCount }, { count: visitorCount }] =
          await Promise.all([
            sb
              .from("trip_widget_generations")
              .select("id", { count: "exact", head: true })
              .eq("widget_id", widget.id)
              .gte("created_at", hourAgo),
            sb
              .from("trip_widget_generations")
              .select("id", { count: "exact", head: true })
              .eq("widget_id", widget.id)
              .gte("created_at", dayAgo),
            sb
              .from("trip_widget_generations")
              .select("id", { count: "exact", head: true })
              .eq("widget_id", widget.id)
              .eq("visitor_hash", vhash)
              .gte("created_at", hourAgo),
          ]);

        if ((hourCount ?? 0) >= widget.max_per_hour || (dayCount ?? 0) >= widget.max_per_day) {
          return json({ error: "Muitas solicitações agora. Tente mais tarde." }, 429);
        }
        if ((visitorCount ?? 0) >= 3) {
          return json({ error: "Você já gerou vários roteiros. Tente mais tarde." }, 429);
        }

        // Owner must have credits
        const pre = await checkBalance(widget.owner_id, FEATURE_KEY);
        if (!pre.ok) {
          return json({ error: "Serviço indisponível no momento. Tente mais tarde." }, 402);
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json({ error: "Serviço indisponível." }, 500);

        const currency = (input.currency || "BRL").toUpperCase();
        let dateBlock = "";
        if (input.startDate) {
          const start = new Date(`${input.startDate}T00:00:00`);
          if (!isNaN(start.getTime())) {
            const end = new Date(start);
            end.setDate(end.getDate() + Math.max(0, input.days - 1));
            const fmt = (d: Date) =>
              d.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              });
            dateBlock = ` A viagem começa em ${fmt(start)} e termina em ${fmt(end)}. Rotule cada dia com a data real e o dia da semana.`;
          }
        }

        const system = `Você é um planejador de viagens especialista. Monte um roteiro dia a dia claro e bem estruturado em português usando markdown (## Dia 1, listas). Inclua manhã/tarde/noite, ideias de restaurantes, dicas de transporte e um resumo de orçamento no final. TODOS os preços devem estar em ${currency}.${dateBlock}`;
        const prompt = `Planeje uma viagem de ${input.days} dias para ${input.destination}${
          input.startDate ? ` começando em ${input.startDate}` : ""
        }. Viajantes: ${input.travelers ?? 1}. Estilo: ${input.style || "geral"}. Orçamento: ${
          input.budget ? `${input.budget} ${currency}` : "não informado"
        }.`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.5-flash",
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
        });
        if (!resp.ok) {
          return json({ error: "Não foi possível gerar agora. Tente novamente." }, 502);
        }
        const data = await resp.json();
        const text = (data?.choices?.[0]?.message?.content ?? "") as string;
        if (!text.trim()) return json({ error: "Não foi possível gerar agora." }, 502);

        const spend = await chargeFeature(widget.owner_id, FEATURE_KEY, {
          route: "widget",
          slug,
        });
        const spent = spend.ok === true ? spend.spent : 0;

        await sb.from("trip_widget_generations").insert({
          widget_id: widget.id,
          owner_id: widget.owner_id,
          destination: input.destination,
          days: input.days,
          credits_spent: spent,
          visitor_hash: vhash,
          status: spend.ok === true ? "ok" : "unpaid",
        });

        return json({ text });
      },
    },
  },
});
