import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { CreditCard, Check, ExternalLink, Sparkles, Crown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession } from "@/lib/subscription.functions";
import { useSubscriptionCheckout } from "@/hooks/useSubscriptionCheckout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
});

const PLANS = [
  {
    key: "pro",
    name: "Pro",
    icon: Sparkles,
    monthly: { price: "$9", priceId: "price_1TdX3QF2249riykhAAlqarhW" },
    yearly: { price: "$97.20", priceId: "price_1TdXZNF2249riykhwvbz6EWl" },
    features: [
      "600 créditos por mês incluídos (renovam automaticamente)",
      "Roteiros ilimitados",
      "Tradutor voz + câmera",
      "Alertas de voos",
      "Modo offline",
    ],
    highlight: true,
  },
  {
    key: "ultra",
    name: "Ultra",
    icon: Crown,
    monthly: { price: "$19", priceId: "price_1TdX4XF2249riykh3ja7kaHB" },
    yearly: { price: "$205.20", priceId: "price_1TdXSYF2249riykhv8DaMEYx" },
    features: [
      "1500 créditos por mês incluídos (renovam automaticamente)",
      "Tudo do Pro",
      "Concierge IA prioritário",
      "Roteiros multi-cidade",
      "Suporte 24/7",
    ],
    highlight: false,
  },
] as const;

const ALL_PRICE_IDS = PLANS.flatMap((p) => [p.monthly.priceId, p.yearly.priceId]);

function planFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  for (const p of PLANS) {
    if (p.monthly.priceId === priceId) return { ...p, billing: "monthly" as const };
    if (p.yearly.priceId === priceId) return { ...p, billing: "yearly" as const };
  }
  return null;
}

function BillingPage() {
  const { user } = useAuth();
  const [sub, setSub] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [billing, setBilling] = React.useState<"monthly" | "yearly">("monthly");
  const [portalLoading, setPortalLoading] = React.useState(false);
  const { openCheckout, checkoutDialog } = useSubscriptionCheckout();

  const env = React.useMemo(() => {
    try { return getStripeEnvironment(); } catch { return null; }
  }, []);

  const load = React.useCallback(async () => {
    if (!user || !env) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSub(data);
    setLoading(false);
  }, [user, env]);

  React.useEffect(() => { load(); }, [load]);

  const current = planFromPriceId(sub?.price_id);
  const isActive = sub && (
    (["active", "trialing", "past_due"].includes(sub.status) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date())) ||
    (sub.status === "canceled" && sub.current_period_end && new Date(sub.current_period_end) > new Date())
  );

  const onManage = async () => {
    if (!env) return;
    setPortalLoading(true);
    try {
      const res = await createPortalSession({
        data: { environment: env, returnUrl: window.location.href },
      });
      if ("error" in res) throw new Error(res.error);
      window.open(res.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao abrir portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const onSubscribe = (priceId: string) => {
    openCheckout({ priceId });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Minha Assinatura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie seu plano atual e descubra outros planos disponíveis.
        </p>
      </div>

      {/* Current plan */}
      <section className="mb-10 rounded-2xl border border-border bg-card/60 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <CreditCard className="h-4 w-4" /> Plano atual
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : isActive && current ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <current.icon className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">{current.name}</h2>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  {current.billing === "yearly" ? "Anual" : "Mensal"}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  sub.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                    : sub.status === "past_due" ? "bg-amber-500/15 text-amber-400"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {sub.status}
                </span>
              </div>
              {sub.current_period_end && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {sub.cancel_at_period_end ? "Acesso até " : "Renova em "}
                  {new Date(sub.current_period_end).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            <Button onClick={onManage} disabled={portalLoading} variant="outline">
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Gerenciar assinatura
            </Button>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold">Plano Free</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Você ainda não tem uma assinatura ativa. Escolha um plano abaixo para desbloquear todos os recursos.
            </p>
          </div>
        )}
      </section>

      {/* Available plans */}
      <section>
        <div className="mb-6 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Planos disponíveis</h2>
            <p className="text-sm text-muted-foreground">Atualize ou troque de plano a qualquer momento.</p>
          </div>
          <div className="inline-flex rounded-full border border-border bg-card/40 p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                billing === "monthly" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                billing === "yearly" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
              }`}
            >
              Anual <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px]">−10%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const variant = billing === "yearly" ? p.yearly : p.monthly;
            const isCurrent = isActive && sub?.price_id === variant.priceId;
            return (
              <div
                key={p.key}
                className={`relative rounded-2xl border p-8 ${
                  p.highlight ? "border-primary/50 bg-gradient-card shadow-glow" : "border-border bg-card/60"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Popular
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-bold">{variant.price}</span>
                  <span className="text-muted-foreground">{billing === "yearly" ? "/ano" : "/mês"}</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button className="mt-8 w-full" variant="outline" disabled>
                    Plano atual
                  </Button>
                ) : (
                  <Button
                    onClick={() => onSubscribe(variant.priceId)}
                    className={`mt-8 w-full ${p.highlight ? "bg-gradient-primary shadow-glow" : ""}`}
                    variant={p.highlight ? "default" : "outline"}
                  >
                    {isActive ? "Trocar para " : "Assinar "}{p.name}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Assinaturas cobradas em dólar americano (USD) via Stripe. Cancele quando quiser pelo portal.
        </p>
      </section>

      {checkoutDialog}
    </div>
  );
}
