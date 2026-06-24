import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Coins, ShoppingCart, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type LedgerRow = {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
};

export function DashboardCreditsCard() {
  const { user } = useAuth();
  const [topup, setTopup] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [recent, setRecent] = React.useState<LedgerRow[]>([]);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: w }, { data: rows }] = await Promise.all([
        supabase
          .from("user_credits")
          .select("topup_balance, balance")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("credit_ledger")
          .select("id, delta, reason, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      setTopup(w?.topup_balance ?? 0);
      setTotal(w?.balance ?? 0);
      setRecent((rows ?? []) as LedgerRow[]);
    })();
  }, [user]);

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-card p-6 shadow-glow lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Créditos Avulsos</h3>
            <p className="text-xs text-muted-foreground">Nunca expiram · Use quando precisar</p>
          </div>
        </div>
        <Link to="/credits">
          <Button size="sm" className="gap-2">
            <ShoppingCart className="h-3.5 w-3.5" /> Comprar Créditos
          </Button>
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo avulso</div>
          <div className="mt-1 text-3xl font-black text-emerald-400">{topup}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo total</div>
          <div className="mt-1 text-3xl font-black text-gradient">{total}</div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <div className="mb-2 flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Últimas movimentações
          </div>
          <ul className="space-y-1.5 text-xs">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between">
                <span className="truncate text-muted-foreground">
                  {labelFor(r.reason)} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span className={r.delta > 0 ? "font-bold text-emerald-400" : "font-bold text-rose-400"}>
                  {r.delta > 0 ? "+" : ""}
                  {r.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function labelFor(reason: string): string {
  if (reason === "signup_bonus") return "Bônus inicial";
  if (reason === "purchase") return "Compra de pacote";
  if (reason === "monthly_grant") return "Renovação mensal";
  if (reason.startsWith("feature:")) return `Uso · ${reason.slice(8)}`;
  return reason;
}
