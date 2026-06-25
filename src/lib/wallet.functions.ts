import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getFxRate } from "@/lib/fx.functions";

const FREE_MONTHLY_LIMIT = 20;
const FREE_WALLET_LIMIT = 1;

async function isProUser(supabase: any, userId: string): Promise<boolean> {
  // Premium se assinante ativo OU possui créditos avulsos (topup_balance > 0)
  const { data } = await supabase.rpc("has_premium_access", { user_uuid: userId });
  return data === true;
}

export const getWalletQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const pro = await isProUser(supabase, userId);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count: expCount } = await supabase
      .from("wallet_expenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart.toISOString());
    const { count: walletCount } = await supabase
      .from("wallets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    return {
      isPro: pro,
      expensesThisMonth: expCount || 0,
      expensesLimit: pro ? null : FREE_MONTHLY_LIMIT,
      wallets: walletCount || 0,
      walletsLimit: pro ? null : FREE_WALLET_LIMIT,
    };
  });

export const listWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { wallets: data || [] };
  });

const CreateWalletSchema = z.object({
  name: z.string().min(1).max(80),
  main_currency: z.string().min(3).max(4).default("BRL"),
  trip_id: z.string().uuid().nullable().optional(),
  initial_balance: z.number().min(0).default(0),
});

export const createWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateWalletSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const pro = await isProUser(supabase, userId);
    if (!pro) {
      const { count } = await supabase
        .from("wallets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count || 0) >= FREE_WALLET_LIMIT) {
        throw new Error("Limite de carteiras do plano gratuito atingido. Faça upgrade para criar mais.");
      }
    }
    const { data: row, error } = await supabase
      .from("wallets")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return { wallet: row };
  });

export const updateWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(80).optional(),
        main_currency: z.string().min(3).max(4).optional(),
        trip_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { id, ...patch } = data;
    const { error } = await supabase.from("wallets").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("wallets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const ListExpensesSchema = z.object({
  wallet_id: z.string().uuid().optional(),
  trip_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().min(1).max(500).default(200),
});

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListExpensesSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    let q = supabase.from("wallet_expenses").select("*").order("occurred_at", { ascending: false }).limit(data.limit);
    if (data.wallet_id) q = q.eq("wallet_id", data.wallet_id);
    if (data.trip_id) q = q.eq("trip_id", data.trip_id);
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { expenses: rows || [] };
  });

const CreateExpenseSchema = z.object({
  wallet_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(3).max(4),
  category: z.enum(["food", "transport", "lodging", "shopping", "leisure", "health", "fees", "other"]).default("other"),
  merchant: z.string().max(120).optional(),
  country: z.string().max(80).optional(),
  occurred_at: z.string().optional(),
  source: z.enum(["manual", "ocr", "import"]).default("manual"),
  receipt_url: z.string().url().optional(),
  notes: z.string().max(500).optional(),
  raw_ocr: z.any().optional(),
  trip_id: z.string().uuid().nullable().optional(),
});

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateExpenseSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const pro = await isProUser(supabase, userId);
    if (!pro) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("wallet_expenses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", monthStart.toISOString());
      if ((count || 0) >= FREE_MONTHLY_LIMIT) {
        throw new Error("Limite mensal de despesas do plano gratuito atingido. Faça upgrade para registrar mais.");
      }
    }
    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("main_currency")
      .eq("id", data.wallet_id)
      .single();
    if (wErr || !wallet) throw new Error("Carteira não encontrada");
    const main = wallet.main_currency as string;
    let rate = 1;
    if (data.currency.toUpperCase() !== main.toUpperCase()) {
      try {
        const fx = await getFxRate({ data: { base: data.currency, quote: main } });
        if (fx.rate > 0) rate = fx.rate;
      } catch {
        rate = 1;
      }
    }
    const amount_in_main = +(data.amount * rate).toFixed(2);
    const { data: row, error } = await supabase
      .from("wallet_expenses")
      .insert({
        wallet_id: data.wallet_id,
        user_id: userId,
        trip_id: data.trip_id ?? null,
        amount: data.amount,
        currency: data.currency.toUpperCase(),
        amount_in_main,
        fx_rate_used: rate,
        category: data.category,
        merchant: data.merchant ?? null,
        country: data.country ?? null,
        occurred_at: data.occurred_at ?? new Date().toISOString(),
        source: data.source,
        receipt_url: data.receipt_url ?? null,
        notes: data.notes ?? null,
        raw_ocr: data.raw_ocr ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { expense: row };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("wallet_expenses").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getWalletSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ wallet_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: wallet } = await supabase.from("wallets").select("*").eq("id", data.wallet_id).single();
    if (!wallet) throw new Error("Carteira não encontrada");
    const { data: budget } = await supabase
      .from("wallet_budgets")
      .select("*")
      .eq("wallet_id", data.wallet_id)
      .maybeSingle();
    const { data: rows } = await supabase
      .from("wallet_expenses")
      .select("amount_in_main, category, country, occurred_at")
      .eq("wallet_id", data.wallet_id)
      .order("occurred_at", { ascending: true });
    const list = (rows || []) as any[];
    const totalSpent = list.reduce((s, r) => s + Number(r.amount_in_main || 0), 0);
    const byCategory: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byDay = new Map<string, number>();
    for (const r of list) {
      byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount_in_main || 0);
      if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + Number(r.amount_in_main || 0);
      const day = String(r.occurred_at).slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + Number(r.amount_in_main || 0));
    }
    const series = Array.from(byDay.entries())
      .map(([date, value]) => ({ date, value: +value.toFixed(2) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const totalBudget = Number(budget?.total_budget || 0);
    const remaining = totalBudget - totalSpent;
    return {
      wallet,
      budget: budget || null,
      kpis: {
        totalSpent: +totalSpent.toFixed(2),
        totalBudget,
        remaining: +remaining.toFixed(2),
        usagePct: totalBudget > 0 ? Math.min(100, +((totalSpent / totalBudget) * 100).toFixed(1)) : 0,
        count: list.length,
        balance: +(Number(wallet.initial_balance || 0) - totalSpent).toFixed(2),
      },
      byCategory,
      byCountry,
      series,
    };
  });

const BudgetSchema = z.object({
  wallet_id: z.string().uuid(),
  total_budget: z.number().min(0),
  daily_budget: z.number().min(0).default(0),
  emergency_reserve: z.number().min(0).default(0),
  currency: z.string().min(3).max(4),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  trip_id: z.string().uuid().nullable().optional(),
});

export const setBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BudgetSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: existing } = await supabase
      .from("wallet_budgets")
      .select("id")
      .eq("wallet_id", data.wallet_id)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await supabase.from("wallet_budgets").update(data).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("wallet_budgets").insert({ ...data, user_id: userId });
      if (error) throw error;
    }
    return { ok: true };
  });

export const listAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ wallet_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: rows } = await supabase
      .from("wallet_alerts")
      .select("*")
      .eq("wallet_id", data.wallet_id)
      .order("created_at", { ascending: false })
      .limit(50);
    return { alerts: rows || [] };
  });

export const dismissAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await supabase.from("wallet_alerts").update({ read: true }).eq("id", data.id);
    return { ok: true };
  });

const SuggestBudgetSchema = z.object({
  destination: z.string().min(1).max(120),
  days: z.number().min(1).max(365),
  currency: z.string().min(3).max(4).default("BRL"),
  style: z.enum(["budget", "standard", "premium"]).default("standard"),
});

// Heuristic budget suggestion (fast, no AI needed). Returns daily + total ranges.
export const suggestBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SuggestBudgetSchema.parse(i))
  .handler(async ({ data }) => {
    const base: Record<string, number> = { budget: 220, standard: 480, premium: 1100 };
    const dailyBase = base[data.style] || 480;
    // Convert from BRL approximate to requested currency.
    let perDay = dailyBase;
    if (data.currency.toUpperCase() !== "BRL") {
      try {
        const fx = await getFxRate({ data: { base: "BRL", quote: data.currency } });
        if (fx.rate > 0) perDay = +(dailyBase * fx.rate).toFixed(2);
      } catch {
        /* keep BRL value */
      }
    }
    const total = +(perDay * data.days).toFixed(2);
    return {
      destination: data.destination,
      days: data.days,
      currency: data.currency.toUpperCase(),
      daily_budget: perDay,
      total_budget: total,
      emergency_reserve: +(total * 0.15).toFixed(2),
    };
  });
