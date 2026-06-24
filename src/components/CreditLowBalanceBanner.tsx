import * as React from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Coins, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Tier = "zero" | "critical" | "low" | null;

function classify(total: number): Tier {
  if (total <= 0) return "zero";
  if (total < 70) return "critical"; // < 10% of smallest pack (700)
  if (total < 140) return "low";     // < 20%
  return null;
}

const DISMISS_KEY = "jaq.lowCreditBannerDismissed";

export function CreditLowBalanceBanner() {
  const { user } = useAuth();
  const [total, setTotal] = React.useState<number | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    setTotal(data?.balance ?? 0);
  }, [user]);

  React.useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (total === null || dismissed) return null;
  const tier = classify(total);
  if (!tier) return null;

  const styles: Record<Exclude<Tier, null>, { bg: string; text: string; title: string; body: string }> = {
    zero: {
      bg: "border-rose-500/40 bg-rose-500/10",
      text: "text-rose-200",
      title: "Saldo zerado",
      body: "Compre créditos avulsos para continuar usando IA, OCR e tradução.",
    },
    critical: {
      bg: "border-orange-500/40 bg-orange-500/10",
      text: "text-orange-200",
      title: `Saldo crítico (${total} cr)`,
      body: "Você está abaixo de 10% do menor pacote. Recarregue para evitar interrupções.",
    },
    low: {
      bg: "border-amber-500/40 bg-amber-500/10",
      text: "text-amber-200",
      title: `Saldo baixo (${total} cr)`,
      body: "Considere comprar um pacote avulso — eles nunca expiram.",
    },
  };
  const s = styles[tier];

  return (
    <div className={`mx-4 mt-3 flex items-start gap-3 rounded-xl border ${s.bg} p-3 md:mx-6 ${s.text}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">{s.title}</p>
        <p className="text-xs opacity-90">{s.body}</p>
      </div>
      <Link
        to="/credits"
        className="inline-flex items-center gap-1 rounded-lg bg-background/40 px-3 py-1.5 text-xs font-semibold hover:bg-background/60"
      >
        <Coins className="h-3.5 w-3.5" /> Comprar
      </Link>
      <button
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="rounded p-1 opacity-60 hover:opacity-100"
        aria-label="Dispensar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
