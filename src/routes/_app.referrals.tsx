import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { Copy, Gift, Users, Coins, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyReferral } from "@/lib/referrals.functions";

export const Route = createFileRoute("/_app/referrals")({
  head: () => ({
    meta: [
      { title: "Indique e ganhe — Jaqtryp AI" },
      { name: "description", content: "Convide amigos e ganhe créditos a cada compra ou assinatura." },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const fetchMine = useServerFn(getMyReferral);
  const { data, isLoading } = useQuery({
    queryKey: ["referrals"],
    queryFn: () => fetchMine(),
  });

  const link = React.useMemo(() => {
    if (!data?.code) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "https://jaqtryp.com";
    return `${base}/signup?ref=${data.code}`;
  }, [data?.code]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const share = async () => {
    const text = `Use meu convite no Jaqtryp AI e ganhe créditos: ${link}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: "Jaqtryp AI", text, url: link }); return; } catch {}
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 md:px-10">
      <header>
        <h1 className="text-3xl font-bold">Indique e ganhe</h1>
        <p className="mt-1 text-muted-foreground">
          Ganhe créditos quando quem você indicar comprar créditos ou assinar.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat icon={Users} label="Indicados" value={data?.referredCount ?? 0} loading={isLoading} />
        <Stat icon={Coins} label="Créditos ganhos" value={data?.totalCredits ?? 0} loading={isLoading} />
        <Stat icon={Gift} label="Recompensas" value={data?.rewards?.length ?? 0} loading={isLoading} />
      </div>

      <div className="rounded-2xl border border-border bg-gradient-card p-6">
        <h2 className="text-lg font-semibold">Seu código</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-lg border border-border bg-background/60 px-4 py-2 text-lg font-bold tracking-widest">
            {data?.code ?? "..."}
          </code>
          <Button variant="outline" size="sm" onClick={() => data?.code && copy(data.code, "Código")}>
            <Copy className="mr-1 h-4 w-4" /> Copiar código
          </Button>
        </div>
        <div className="mt-4">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Seu link</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 min-w-[240px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
            />
            <Button variant="outline" size="sm" onClick={() => copy(link, "Link")}>
              <Copy className="mr-1 h-4 w-4" /> Copiar
            </Button>
            <Button size="sm" onClick={share} className="bg-gradient-primary">
              <Share2 className="mr-1 h-4 w-4" /> Compartilhar
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-gradient-card p-6">
        <h2 className="text-lg font-semibold">Como funciona</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• <strong>Pacote de créditos:</strong> você ganha 10% em créditos (ex.: 700 → 70).</li>
          <li>• <strong>Assinatura Pro:</strong> 100 créditos a cada renovação paga.</li>
          <li>• <strong>Assinatura Ultra:</strong> 200 créditos a cada renovação paga.</li>
          <li>• O vínculo é permanente — cada indicado só conta para quem o convidou primeiro.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-gradient-card p-6">
        <h2 className="text-lg font-semibold">Histórico</h2>
        {data?.rewards?.length ? (
          <div className="mt-3 divide-y divide-border">
            {data.rewards.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">
                    {r.source === "pack" ? "Compra de pacote" : r.source === "sub_ultra" ? "Assinatura Ultra" : "Assinatura Pro"}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className="font-semibold text-primary">+{r.credits} cr</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma recompensa ainda. Compartilhe seu link!</p>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, loading }: { icon: any; label: string; value: number; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-3xl font-bold">{loading ? "…" : value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
