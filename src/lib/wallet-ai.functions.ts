import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getFxRate } from "@/lib/fx.functions";
import { chargeFeatureWith } from "@/lib/credit-charge.server";

async function callLovableAI(opts: {
  system?: string;
  prompt?: string;
  image?: string;
  model?: string;
  json?: boolean;
}): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("IA não configurada");
  const userContent: any = opts.image
    ? [
        { type: "text", text: opts.prompt || "" },
        { type: "image_url", image_url: { url: opts.image } },
      ]
    : opts.prompt;
  const body: any = {
    model: opts.model || (opts.image ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview"),
    messages: [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: userContent },
    ],
  };
  if (opts.json) body.response_format = { type: "json_object" };
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Limite de IA atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos.");
    throw new Error("Falha ao consultar IA");
  }
  const json: any = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function requireProAccess(supabase: any, userId: string) {
  // Libera para assinantes Pro/Ultra OU para quem possui créditos avulsos disponíveis.
  const { data } = await supabase.rpc("has_premium_access", { user_uuid: userId });
  if (data !== true) {
    throw new Error(
      "Recurso premium. Assine um plano ou adquira créditos avulsos em /billing para liberar.",
    );
  }
}

// Charge after a successful AI call; throws a user-facing error when the
// user has no credits, so the handler does not appear to "succeed for free".
async function chargeOrThrow(supabase: any, userId: string, feature: string, meta: Record<string, unknown> = {}) {
  const res = await chargeFeatureWith(supabase, userId, feature, meta);
  if (res.ok === false) {
    if (res.reason === "insufficient") {
      const needed = (res as any).needed;
      const have = (res as any).have;
      throw new Error(`Créditos insuficientes. Faltam ${needed - have} créditos.`);
    }
    throw new Error("Falha ao debitar créditos.");
  }
  return res;
}

// ---------- SCANNER OCR ----------
export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        image: z.string().min(20), // data URL or https URL
        wallet_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireProAccess(supabase, userId);
    const system =
      "Você é um extrator de recibos de viagem. A partir da imagem, extraia os dados em JSON estrito com as chaves: amount (número), currency (ISO 4217 ex BRL/EUR/USD), date (ISO 8601 ou null), category (food|transport|lodging|shopping|leisure|health|fees|other), merchant (string ou null), country (nome ou null). Se algum dado não estiver claro, use null. Responda apenas com JSON.";
    const prompt =
      "Extraia os dados do recibo/comprovante na imagem. Use moeda no formato ISO. Categorize automaticamente.";
    const text = await callLovableAI({
      system,
      prompt,
      image: data.image,
      json: true,
      model: "google/gemini-2.5-flash",
    });
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const result = {
      suggestion: {
        amount: Number(parsed.amount) || 0,
        currency: String(parsed.currency || "BRL").toUpperCase().slice(0, 4),
        occurred_at: parsed.date || new Date().toISOString(),
        category: ["food", "transport", "lodging", "shopping", "leisure", "health", "fees", "other"].includes(
          parsed.category,
        )
          ? parsed.category
          : "other",
        merchant: parsed.merchant || null,
        country: parsed.country || null,
      },
      raw: parsed,
    };
    await chargeOrThrow(supabase, userId, "scanner_ocr", { wallet_id: data.wallet_id });
    return result;
  });

// ---------- CHAT FINANCEIRO ----------
async function buildWalletContext(supabase: any, walletId: string): Promise<string> {
  const { data: wallet } = await supabase.from("wallets").select("*").eq("id", walletId).maybeSingle();
  if (!wallet) return "Sem carteira selecionada.";
  const { data: budget } = await supabase
    .from("wallet_budgets")
    .select("*")
    .eq("wallet_id", walletId)
    .maybeSingle();
  const { data: rows } = await supabase
    .from("wallet_expenses")
    .select("amount_in_main, category, country, occurred_at, currency, amount, merchant")
    .eq("wallet_id", walletId)
    .order("occurred_at", { ascending: false })
    .limit(80);
  const list = (rows || []) as any[];
  const total = list.reduce((s, r) => s + Number(r.amount_in_main || 0), 0);
  const byCat: Record<string, number> = {};
  for (const r of list) byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount_in_main || 0);
  return `Carteira: ${wallet.name} (moeda principal: ${wallet.main_currency}). Saldo inicial: ${wallet.initial_balance}.
Orçamento total: ${budget?.total_budget ?? "não definido"} ${budget?.currency ?? wallet.main_currency}. Diário: ${budget?.daily_budget ?? "—"}.
Total gasto (convertido): ${total.toFixed(2)} ${wallet.main_currency}.
Gastos por categoria: ${Object.entries(byCat)
    .map(([k, v]) => `${k}=${v.toFixed(2)}`)
    .join(", ")}.
Últimas despesas (até 80): ${list
    .slice(0, 30)
    .map(
      (r) =>
        `${String(r.occurred_at).slice(0, 10)} ${r.merchant || r.category} ${r.amount} ${r.currency} (=${Number(
          r.amount_in_main,
        ).toFixed(2)} ${wallet.main_currency})`,
    )
    .join(" | ")}`;
}

export const askWalletAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ wallet_id: z.string().uuid(), prompt: z.string().min(1).max(1000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireProAccess(supabase, userId);
    const ctx = await buildWalletContext(supabase, data.wallet_id);
    const system = `Você é o assistente financeiro de viagem do JAQTRYP AI. Responda em português brasileiro, curto e direto, com números formatados. Baseie-se nos dados a seguir:\n${ctx}`;
    const text = await callLovableAI({ system, prompt: data.prompt });
    await chargeOrThrow(supabase, userId, "translate_text", { wallet_id: data.wallet_id, kind: "wallet_chat" });
    return { text };
  });

// ---------- CONSULTOR ----------
export const advisorReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ wallet_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireProAccess(supabase, userId);
    const ctx = await buildWalletContext(supabase, data.wallet_id);
    const system =
      "Você é um Consultor Financeiro de Viagem IA. Gere um relatório curto em markdown com seções: 1) Diagnóstico; 2) Gastos excessivos detectados; 3) Sugestões de economia; 4) Momento ideal para câmbio; 5) Previsão até o fim da viagem; 6) Recomendações personalizadas. Use bullets e seja prático.";
    const text = await callLovableAI({ system, prompt: `Dados da carteira:\n${ctx}` });
    await chargeOrThrow(supabase, userId, "itinerary_ai", { wallet_id: data.wallet_id, kind: "advisor_report" });
    return { report: text };
  });

// ---------- FX em linguagem natural ----------
const FxAskSchema = z.object({ prompt: z.string().min(1).max(300) });
export const fxAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FxAskSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const system =
      'Você interpreta perguntas de conversão de moedas. Retorne JSON estrito {"amount": number, "from": "ISO", "to": "ISO"}. Use BRL como destino padrão quando não especificado. Apenas JSON.';
    const raw = await callLovableAI({ system, prompt: data.prompt, json: true });
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const amount = Number(parsed.amount) || 0;
    const from = String(parsed.from || "USD").toUpperCase().slice(0, 4);
    const to = String(parsed.to || "BRL").toUpperCase().slice(0, 4);
    let rate = 1;
    try {
      const fx = await getFxRate({ data: { base: from, quote: to } });
      rate = fx.rate || 1;
    } catch {
      rate = 1;
    }
    const result = +(amount * rate).toFixed(2);
    await chargeOrThrow(supabase, userId, "translate_text", { kind: "fx_ask" });
    return { amount, from, to, rate, result };
  });
