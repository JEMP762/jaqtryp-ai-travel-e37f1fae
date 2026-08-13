import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Coins, Zap, Gift, Sparkles, ShoppingCart, History, Loader2, TrendingUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CREDIT_PACKS,
  getMyCredits,
  getCreditCosts,
  listCreditHistory,
} from "@/lib/credits.functions";
import { CreditPackCheckoutDialog } from "@/components/CreditPackCheckout";
import { CreditLowBalanceBanner } from "@/components/CreditLowBalanceBanner";
import { PaymentMethodDialog } from "@/components/PaymentMethodDialog";
import { PixCheckoutDialog } from "@/components/PixCheckoutDialog";
import { PIX_PRICES_BRL, formatBrl } from "@/lib/pix-packs";

export const Route = createFileRoute("/_app/credits")({
  component: CreditsPage,
});

type Wallet = Awaited<ReturnType<typeof getMyCredits>>;
type Cost = Awaited<ReturnType<typeof getCreditCosts>>[number];
type Entry = Awaited<ReturnType<typeof listCreditHistory>>[number];

function CreditsPage() {
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const [costs, setCosts] = React.useState<Cost[]>([]);
  const [history, setHistory] = React.useState<Entry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [checkoutKey, setCheckoutKey] = React.useState<string | null>(null);
  const [pixKey, setPixKey] = React.useState<string | null>(null);
  const [choosing, setChoosing] = React.useState<
    { lookupKey: string; label: string; credits: number; priceUsd: number } | null
  >(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [w, c, h] = await Promise.all([
        getMyCredits(),
        getCreditCosts(),
        listCreditHistory({ data: { limit: 40 } }),
      ]);
      setWallet(w);
      setCosts(c);
      setHistory(h);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar carteira");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    // Refresh after returning from checkout
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid")) {
      setTimeout(load, 1500); // dar tempo do webhook processar
      url.searchParams.delete("paid");
      window.history.replaceState({}, "", url.toString());
    }
  }, [load]);

  const lowestCost = costs.length ? Math.min(...costs.map((c) => c.cost)) : 0;
  const lowBalance = wallet && wallet.total < lowestCost;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <div className="-mx-4 md:-mx-8">
        <CreditLowBalanceBanner />
      </div>
      <div className="mb-8 mt-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <Coins className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carteira de Créditos</h1>
          <p className="text-sm text-muted-foreground">
            Use créditos em roteiros IA, traduções e exportações. Seus créditos avulsos nunca expiram.
          </p>
        </div>
      </div>

      {loading && !wallet ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* Saldo */}
          <section className="mb-8 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 rounded-2xl border border-border bg-gradient-card p-6 shadow-glow">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo total</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-5xl font-black text-gradient">{wallet?.total ?? 0}</span>
                <span className="text-sm text-muted-foreground">créditos</span>
              </div>
              {wallet?.nextReset && wallet.monthlyGrant > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Próxima renovação mensal:{" "}
                  <span className="font-semibold text-foreground">
                    {new Date(wallet.nextReset).toLocaleDateString("pt-BR")}
                  </span>{" "}
                  (+{wallet.monthlyGrant} créditos)
                </p>
              )}
            </div>
            <BucketCard
              icon={Zap}
              label="Mensais"
              value={wallet?.monthly ?? 0}
              hint="Resetam a cada ciclo"
              tone="primary"
            />
            <BucketCard
              icon={Gift}
              label="Gratuitos"
              value={wallet?.free ?? 0}
              hint="Bônus de boas-vindas"
              tone="muted"
            />
            <BucketCard
              icon={Sparkles}
              label="Avulsos"
              value={wallet?.topup ?? 0}
              hint="Nunca expiram"
              tone="accent"
            />
          </section>

          {lowBalance && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <Info className="mt-0.5 h-4 w-4 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-300">Seus créditos acabaram.</p>
                <p className="text-amber-200/80">
                  Aguarde a renovação dos créditos mensais, compre créditos avulsos ou aproveite o melhor
                  custo-benefício nos planos mensais.
                </p>
              </div>
            </div>
          )}

          {/* Pacotes */}
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="text-xl font-bold">Comprar créditos avulsos</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Pague uma vez, use quando quiser. Sem assinatura, sem expiração.
            </p>
            <ul className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-xs text-emerald-300">
              <li>✅ Créditos não expiram</li>
              <li>✅ Compra única</li>
              <li>✅ Sem assinatura</li>
              <li>✅ Use quando precisar</li>
            </ul>
            <div className="grid gap-4 md:grid-cols-3">
              {CREDIT_PACKS.map((p) => {
                const perCredit = ((p.priceUsd / p.credits) * 100).toFixed(2);
                return (
                  <div
                    key={p.lookupKey}
                    className={`relative flex flex-col rounded-2xl border p-5 transition ${
                      (p as any).popular
                        ? "border-primary/60 bg-gradient-card shadow-glow"
                        : "border-border bg-card/60"
                    }`}
                  >
                    {(p as any).popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        MAIS POPULAR
                      </span>
                    )}
                    {(p as any).bonusPct && (
                      <span className="absolute right-3 top-3 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        +{(p as any).bonusPct}% BÔNUS
                      </span>
                    )}
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.label}</div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-black">{p.credits}</span>
                      <span className="text-sm text-muted-foreground">cr</span>
                    </div>
                    <div className="mt-3 text-2xl font-bold">
                      ${p.priceUsd.toFixed(2)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">USD</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      ≈ ${perCredit}¢ por crédito
                    </div>
                    {PIX_PRICES_BRL[p.lookupKey] !== undefined && (
                      <div className="mt-2 text-[11px] text-emerald-300">
                        ou {formatBrl(PIX_PRICES_BRL[p.lookupKey])} no PIX
                      </div>
                    )}
                    <Button
                      className="mt-5 w-full"
                      variant={(p as any).popular ? "default" : "outline"}
                      onClick={() =>
                        setChoosing({
                          lookupKey: p.lookupKey,
                          label: p.label,
                          credits: p.credits,
                          priceUsd: p.priceUsd,
                        })
                      }
                    >
                      Comprar
                    </Button>

                  </div>
                );
              })}
            </div>
          </section>

          {/* Tabela de custos */}
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-xl font-bold">Custo por funcionalidade</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Funcionalidade</th>
                    <th className="px-4 py-3 text-left">Descrição</th>
                    <th className="px-4 py-3 text-right">Créditos</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((c) => (
                    <tr key={c.feature_key} className="border-t border-border/60">
                      <td className="px-4 py-3 font-medium">{c.label}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.description}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{c.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Buscar voos e hospedagem é <span className="font-semibold text-emerald-400">grátis</span> e não
              consome créditos.
            </p>
          </section>

          {/* Histórico */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h2 className="text-xl font-bold">Histórico</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
              {history.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Sem movimentações ainda.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Motivo</th>
                      <th className="px-4 py-3 text-right">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const positive = h.delta > 0;
                      return (
                        <tr key={h.id} className="border-t border-border/60">
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3">
                            {labelFor(h.reason)}
                            {methodFor(h) && (
                              <div className="text-[11px] text-muted-foreground">{methodFor(h)}</div>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold ${
                              positive ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {positive ? "+" : ""}
                            {h.delta}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      <PaymentMethodDialog
        pack={choosing}
        onClose={() => setChoosing(null)}
        onSelect={(method) => {
          const key = choosing?.lookupKey ?? null;
          setChoosing(null);
          if (method === "stripe") setCheckoutKey(key);
          else setPixKey(key);
        }}
      />

      <CreditPackCheckoutDialog
        lookupKey={checkoutKey}
        onClose={() => {
          setCheckoutKey(null);
          setTimeout(load, 1200);
        }}
      />

      <PixCheckoutDialog
        lookupKey={pixKey}
        onPaid={() => setTimeout(load, 800)}
        onClose={() => {
          setPixKey(null);
          setTimeout(load, 800);
        }}
      />

    </div>
  );
}

function BucketCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  hint: string;
  tone: "primary" | "muted" | "accent";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "accent"
      ? "text-emerald-400"
      : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${toneCls}`} />
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${toneCls}`}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function labelFor(reason: string): string {
  if (reason === "signup_bonus") return "Bônus de boas-vindas";
  if (reason === "purchase") return "Compra de pacote avulso";
  if (reason === "purchase_pix") return "Compra de pacote avulso";
  if (reason === "monthly_grant") return "Renovação mensal";
  if (reason === "referral_bonus") return "Bônus de indicação";
  if (reason.startsWith("feature:")) return `Uso · ${reason.slice("feature:".length)}`;
  return reason;
}

function methodFor(entry: Entry): string | null {
  const meta = (entry.metadata ?? {}) as Record<string, any>;
  if (entry.reason === "purchase_pix" || meta.payment_method === "pix") {
    const amount = Number(meta.amount_brl ?? 0);
    const price = amount ? `${formatBrl(amount)} · ` : "";
    return `${price}PIX / Mercado Pago · Pago`;
  }
  if (entry.reason === "purchase") return "Stripe (USD) · Pago";
  return null;
}

