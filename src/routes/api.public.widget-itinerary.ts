import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";
import { chargeFeature, checkBalance } from "@/lib/credit-charge.server";

const BRAND_BUCKET = "brand-logos";
const FEATURE_KEY = "trip_create_branded";
const TRANSLATION_FEATURE_KEY = "translate_text";
const LANGUAGES = {
  pt: "Português",
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  ar: "العربية",
  ru: "Русский",
} as const;
const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "JPY", "CHF", "CAD", "AUD"] as const;
const languageSchema = z.enum(["pt", "en", "es", "fr", "it", "de", "ja", "zh", "ko", "ar", "ru"]);
const currencySchema = z.enum(CURRENCIES);

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

const generateSchema = z.object({
  action: z.literal("generate").optional(),
  slug: z.string().min(2).max(40),
  destination: z.string().min(2).max(120),
  days: z.number().int().min(1).max(30),
  startDate: z.string().max(20).optional().nullable(),
  travelers: z.number().int().min(1).max(20).optional().nullable(),
  style: z.string().max(80).optional().nullable(),
  budget: z.string().max(40).optional().nullable(),
  currency: currencySchema.optional().default("BRL"),
  language: languageSchema.optional().default("pt"),
  // honeypot — must stay empty
  website: z.string().max(0).optional().nullable(),
});

const translateSchema = z.object({
  action: z.literal("translate"),
  slug: z.string().min(2).max(40),
  generationId: z.string().uuid(),
  originalText: z.string().min(20).max(100000),
  targetLanguage: languageSchema.exclude(["pt"]),
  accessPassword: z.string().min(6).max(100).optional(),
});

const unlockSchema = z.object({
  action: z.literal("unlock"),
  slug: z.string().min(2).max(40),
  generationId: z.string().uuid(),
  password: z.string().min(6).max(100),
});

const payloadSchema = z.union([generateSchema, translateSchema, unlockSchema]);

function resultHash(widgetId: string, text: string) {
  return createHash("sha256").update(`${widgetId}:${text}`).digest("hex");
}

function isMonetized(widget: {
  monetization_enabled: boolean;
  payment_url: string | null;
  itinerary_price: number | null;
  unlock_password_hash: string | null;
  unlock_password_salt: string | null;
}) {
  return widget.monetization_enabled && Boolean(
    widget.payment_url && widget.itinerary_price && widget.unlock_password_hash && widget.unlock_password_salt,
  );
}

function firstDayPreview(markdown: string) {
  const lines = markdown.split("\n");
  const dayHeadings = lines
    .map((line, index) => (/^#{1,3}\s*(?:dia|day|día|jour|giorno|tag)\s*\d+/i.test(line.trim()) ? index : -1))
    .filter((index) => index >= 0);
  const end = dayHeadings.length > 1 ? dayHeadings[1] : lines.length;
  return lines.slice(0, end).join("\n").trim();
}

async function passwordMatches(password: string, hash: string | null, salt: string | null) {
  if (!hash || !salt) return false;
  const security = await import("@/lib/widget-monetization.server");
  const candidate = await security.hashWidgetPassword(password, salt);
  return security.safeHashEqual(candidate, hash);
}

async function aiText(system: string, prompt: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI_NOT_CONFIGURED");
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
  if (!resp.ok) throw new Error("AI_FAILED");
  const data = await resp.json();
  const text = (data?.choices?.[0]?.message?.content ?? "") as string;
  if (!text.trim()) throw new Error("AI_FAILED");
  return text;
}

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
          .select("slug, headline, intro, owner_id, active, monetization_enabled, payment_url, itinerary_price, unlock_password_hash, unlock_password_salt")
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

        const [itineraryPricing, translationPricing] = await Promise.all([
          checkBalance(widget.owner_id, FEATURE_KEY),
          checkBalance(widget.owner_id, TRANSLATION_FEATURE_KEY),
        ]);
        const itineraryCost = itineraryPricing.ok ? itineraryPricing.cost : itineraryPricing.needed;
        const translationCost = translationPricing.ok ? translationPricing.cost : translationPricing.needed;

        return json({
          slug: widget.slug,
          headline: widget.headline,
          intro: widget.intro,
          companyName: brand?.company_name ?? null,
          logoUrl,
          itineraryCost: Number(itineraryCost ?? 0),
          translationCost: Number(translationCost ?? 0),
          monetized: isMonetized(widget),
          paymentUrl: isMonetized(widget) ? widget.payment_url : null,
          price: isMonetized(widget) ? Number(widget.itinerary_price) : null,
        });
      },

      POST: async ({ request }) => {
        const raw = await request.json().catch(() => null);
        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) return json({ error: "Dados inválidos." }, 400);
        const input = parsed.data;
        if ("website" in input && input.website) return json({ error: "Dados inválidos." }, 400);

        const slug = input.slug.toLowerCase().trim();
        const sb = await admin();
        const { data: widget } = await sb
          .from("trip_widgets")
          .select("id, owner_id, active, allowed_domains, max_per_hour, max_per_day, monetization_enabled, payment_url, itinerary_price, unlock_password_hash, unlock_password_salt")
          .eq("slug", slug)
          .eq("active", true)
          .maybeSingle();
        if (!widget) return json({ error: "Este link não está disponível." }, 404);

        // Domain allowlist applies to both generation and translation requests.
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

        if (input.action === "unlock") {
          const { data: generation } = await sb
            .from("trip_widget_generations")
            .select("id, visitor_hash, protected_text, protected_original_text, unlock_attempt_count, unlock_window_started_at")
            .eq("id", input.generationId)
            .eq("widget_id", widget.id)
            .eq("owner_id", widget.owner_id)
            .eq("status", "ok")
            .maybeSingle();
          if (!generation || !isMonetized(widget) || !generation.protected_text || !generation.protected_original_text) {
            return json({ error: "Roteiro indisponível para desbloqueio." }, 404);
          }
          const requestVisitorHash = visitorHash(request, slug);
          if (generation.visitor_hash !== requestVisitorHash) return json({ error: "Roteiro indisponível para desbloqueio." }, 403);

          const windowStarted = generation.unlock_window_started_at
            ? new Date(generation.unlock_window_started_at).getTime()
            : 0;
          const windowExpired = Date.now() - windowStarted > 15 * 60 * 1000;
          const attempts = windowExpired ? 0 : generation.unlock_attempt_count;
          if (attempts >= 5) return json({ error: "Muitas tentativas. Aguarde 15 minutos." }, 429);

          const valid = await passwordMatches(input.password, widget.unlock_password_hash, widget.unlock_password_salt);
          if (!valid) {
            await sb.from("trip_widget_generations").update({
              unlock_attempt_count: attempts + 1,
              unlock_window_started_at: windowExpired ? new Date().toISOString() : generation.unlock_window_started_at,
            }).eq("id", generation.id);
            return json({ error: "Senha incorreta." }, 401);
          }
          await sb.from("trip_widget_generations").update({ unlock_attempt_count: 0, unlock_window_started_at: null }).eq("id", generation.id);
          return json({ text: generation.protected_text, originalText: generation.protected_original_text });
        }

        if (input.action === "translate") {
          const { data: generation } = await sb
            .from("trip_widget_generations")
            .select("id, widget_id, owner_id, result_hash, credits_spent, translation_credits, translated_languages")
            .eq("id", input.generationId)
            .eq("widget_id", widget.id)
            .eq("owner_id", widget.owner_id)
            .eq("status", "ok")
            .maybeSingle();
          if (!generation || generation.result_hash !== resultHash(widget.id, input.originalText)) {
            return json({ error: "Roteiro inválido para tradução." }, 403);
          }
          if (isMonetized(widget) && !(input.accessPassword && await passwordMatches(
            input.accessPassword,
            widget.unlock_password_hash,
            widget.unlock_password_salt,
          ))) {
            return json({ error: "Desbloqueie o roteiro antes de traduzir." }, 403);
          }
          const preTranslation = await checkBalance(widget.owner_id, TRANSLATION_FEATURE_KEY);
          if (!preTranslation.ok) return json({ error: "Serviço indisponível no momento. Tente mais tarde." }, 402);
          try {
            const translated = await aiText(
              `You are a professional translator. Translate the travel itinerary markdown to ${LANGUAGES[input.targetLanguage]}. Preserve all markdown, numbers, prices, currency symbols, and place names. Return only the translated markdown.`,
              input.originalText,
            );
            const spend = await chargeFeature(widget.owner_id, TRANSLATION_FEATURE_KEY, {
              route: "widget_translation",
              slug,
              generation_id: generation.id,
              target_language: input.targetLanguage,
            });
            if (!spend.ok) return json({ error: "Serviço indisponível no momento. Tente mais tarde." }, 402);
            const languages = Array.from(new Set([...(generation.translated_languages ?? []), input.targetLanguage]));
            const { error: updateError } = await sb.from("trip_widget_generations").update({
              credits_spent: generation.credits_spent + spend.spent,
              translation_credits: generation.translation_credits + spend.spent,
              translated_languages: languages,
            }).eq("id", generation.id);
            if (updateError) throw updateError;
            return json({ text: translated, language: input.targetLanguage, creditsSpent: spend.spent });
          } catch {
            return json({ error: "Não foi possível traduzir agora. Tente novamente." }, 502);
          }
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

        let translationPre: Awaited<ReturnType<typeof checkBalance>> | null = null;
        if (input.language !== "pt") {
          translationPre = await checkBalance(widget.owner_id, TRANSLATION_FEATURE_KEY);
          if (!translationPre.ok || pre.have < pre.cost + translationPre.cost) {
            return json({ error: "Serviço indisponível no momento. Tente mais tarde." }, 402);
          }
        }

        const currency = input.currency;
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

        let originalText: string;
        try {
          originalText = await aiText(system, prompt);
        } catch {
          return json({ error: "Não foi possível gerar agora. Tente novamente." }, 502);
        }

        const spend = await chargeFeature(widget.owner_id, FEATURE_KEY, {
          route: "widget",
          slug,
        });
        if (!spend.ok) return json({ error: "Serviço indisponível no momento. Tente mais tarde." }, 402);
        let text = originalText;
        let translationSpent = 0;
        let deliveredLanguage = "pt";
        if (input.language !== "pt") {
          try {
            text = await aiText(
              `You are a professional translator. Translate the travel itinerary markdown to ${LANGUAGES[input.language]}. Preserve all markdown, numbers, prices, currency symbols, and place names. Return only the translated markdown.`,
              originalText,
            );
            const translationSpend = await chargeFeature(widget.owner_id, TRANSLATION_FEATURE_KEY, {
              route: "widget_initial_translation",
              slug,
              target_language: input.language,
            });
            if (translationSpend.ok) {
              translationSpent = translationSpend.spent;
              deliveredLanguage = input.language;
            } else {
              text = originalText;
            }
          } catch {
            text = originalText;
          }
        }

        const monetized = isMonetized(widget);
        const { data: generation, error: generationError } = await sb.from("trip_widget_generations").insert({
          widget_id: widget.id,
          owner_id: widget.owner_id,
          destination: input.destination,
          days: input.days,
          credits_spent: spend.spent + translationSpent,
          visitor_hash: vhash,
          status: "ok",
          currency,
          source_language: "pt",
          result_hash: resultHash(widget.id, originalText),
          translation_credits: translationSpent,
          translated_languages: deliveredLanguage === "pt" ? [] : [deliveredLanguage],
          protected_text: monetized ? text : null,
          protected_original_text: monetized ? originalText : null,
        }).select("id").single();
        if (generationError || !generation) {
          return json({ error: "O roteiro foi criado, mas não pôde ser preparado para tradução." }, 500);
        }

        if (monetized) {
          return json({
            text: firstDayPreview(text),
            originalText: "",
            language: deliveredLanguage,
            generationId: generation.id,
            locked: true,
          });
        }
        return json({ text, originalText, language: deliveredLanguage, generationId: generation.id, locked: false });
      },
    },
  },
});
