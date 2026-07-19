import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Coins, Crown, Sparkles, Check, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CREDIT_PACKS } from "@/lib/credits.functions";
import { CreditPackCheckoutDialog } from "@/components/CreditPackCheckout";
import { useSubscriptionCheckout } from "@/hooks/useSubscriptionCheckout";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLANS = [
  {
    key: "pro" as const,
    name: "Pro",
    monthly: { price: "$9", period: "/mês", priceId: "price_1TdX3QF2249riykhAAlqarhW" },
    yearly: { price: "$97.20", period: "/ano", priceId: "price_1TdXZNF2249riykhwvbz6EWl" },
    features: ["Roteiros ilimitados", "Tradutor voz + câmera", "Alertas de voos", "Modo offline"],
    popular: true,
  },
  {
    key: "ultra" as const,
    name: "Ultra",
    monthly: { price: "$19", period: "/mês", priceId: "price_1TdX4XF2249riykh3ja7kaHB" },
    yearly: { price: "$205.20", period: "/ano", priceId: "price_1TdXSYF2249riykhv8DaMEYx" },
    features: ["Tudo do Pro", "Concierge IA prioritário", "Roteiros multi-cidade", "Suporte 24/7"],
    popular: false,
  },
];

export function UpgradeGateDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = React.useState<"packs" | "subs">("packs");
  const [billing, setBilling] = React.useState<"monthly" | "yearly">("monthly");
  const [packKey, setPackKey] = React.useState<string | null>(null);
  const { openCheckout, checkoutDialog } = useSubscriptionCheckout();

  const handleSubscribe = (priceId: string) => {
    if (!user) return;
    onOpenChange(false);
    setTimeout(() => openCheckout({ priceId }), 200);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <DialogTitle className="text-center text-2xl">
              Seus créditos gratuitos acabaram
            </DialogTitle>
            <DialogDescription className="text-center">
              Escolha como continuar aproveitando o Jaqtryp — recarga avulsa ou assinatura.
            </DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="mx-auto mt-4 inline-flex rounded-full border border-border bg-card/60 p-1 self-center">
            <button
              onClick={() => setTab("packs")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                tab === "packs" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
              }`}
            >
              <Coins className="mr-1 inline h-3.5 w-3.5" /> Recarga avulsa
            </button>
            <button
              onClick={() => setTab("subs")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                tab === "subs" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
              }`}
            >
              <Crown className="mr-1 inline h-3.5 w-3.5" /> Assinar
            </button>
          </div>

          {tab === "packs" ? (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {CREDIT_PACKS.map((p) => {
                const popular = (p as any).popular;
                const bonus = (p as any).bonusPct;
                return (
                  <div
                    key={p.lookupKey}
                    className={`relative flex flex-col rounded-2xl border p-4 ${
                      popular ? "border-primary/60 bg-gradient-card shadow-glow" : "border-border bg-card/60"
                    }`}
                  >
                    {popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        MAIS POPULAR
                      </span>
                    )}
                    {bonus && (
                      <span className="absolute right-2 top-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        +{bonus}%
                      </span>
                    )}
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.label}</div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black">{p.credits}</span>
                      <span className="text-xs text-muted-foreground">cr</span>
                    </div>
                    <div className="mt-2 text-lg font-bold">
                      ${p.priceUsd.toFixed(2)}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">USD</span>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      variant={popular ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        setTimeout(() => setPackKey(p.lookupKey), 200);
                      }}
                    >
                      Comprar
                    </Button>
                  </div>
                );
              })}
              <p className="md:col-span-3 mt-1 text-center text-[11px] text-emerald-300">
                ✅ Créditos avulsos nunca expiram · Compra única · Sem assinatura
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <div className="mb-4 flex justify-center">
                <div className="inline-flex rounded-full border border-border bg-card/60 p-1">
                  <button
                    onClick={() => setBilling("monthly")}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                      billing === "monthly" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setBilling("yearly")}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                      billing === "yearly" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                    }`}
                  >
                    Anual <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px]">−10%</span>
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {PLANS.map((p) => {
                  const current = p[billing];
                  return (
                    <div
                      key={p.key}
                      className={`relative rounded-2xl border p-5 ${
                        p.popular
                          ? "border-primary/60 bg-gradient-card shadow-glow"
                          : "border-border bg-card/60"
                      }`}
                    >
                      {p.popular && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          MAIS ESCOLHIDO
                        </span>
                      )}
                      <h3 className="text-lg font-semibold">{p.name}</h3>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-bold">{current.price}</span>
                        <span className="text-sm text-muted-foreground">{current.period}</span>
                      </div>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        className={`mt-5 w-full ${p.popular ? "bg-gradient-primary shadow-glow" : ""}`}
                        variant={p.popular ? "default" : "outline"}
                        onClick={() => handleSubscribe(current.priceId)}
                      >
                        Assinar {p.name}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/credits"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              Ver detalhes na Carteira <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <CreditPackCheckoutDialog lookupKey={packKey} onClose={() => setPackKey(null)} />
      {checkoutDialog}
    </>
  );
}
