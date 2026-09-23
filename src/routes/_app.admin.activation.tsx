import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, BarChart3, Users } from "lucide-react";
import { checkIsAdmin } from "@/lib/commission.functions";
import { getActivationFunnel } from "@/lib/activation.functions";

export const Route = createFileRoute("/_app/admin/activation")({
  head: () => ({ meta: [
    { title: "Funil de ativação — JAQTRYP AI" }, { name: "description", content: "Acompanhe a ativação e a primeira experiência de novos usuários." },
    { property: "og:title", content: "Funil de ativação — JAQTRYP AI" }, { property: "og:description", content: "Acompanhe a ativação e a primeira experiência de novos usuários." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ActivationAdmin,
});

const stages = [
  ["shared_content_viewed", "Conteúdo visto"], ["context_cta_clicked", "CTA clicado"], ["signup_completed", "Cadastro"],
  ["onboarding_started", "Onboarding iniciado"], ["onboarding_completed", "Onboarding concluído"], ["first_result", "Primeiro resultado"],
  ["second_action", "Segunda ação"], ["share_clicked", "Compartilhamento"],
] as const;

function ActivationAdmin() {
  const check = useServerFn(checkIsAdmin);
  const funnel = useServerFn(getActivationFunnel);
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => check(), retry: false });
  const query = useQuery({ queryKey: ["activation-funnel", "30d"], queryFn: () => funnel(), enabled: admin.data?.isAdmin === true, retry: false });
  if (admin.isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!admin.data?.isAdmin) return <div className="mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-bold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Esta área é exclusiva para administradores.</p></div>;
  const counts = query.data?.counts ?? {};
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-10">
      <header className="mb-7"><div className="flex items-center gap-3"><BarChart3 className="h-8 w-8 text-primary" /><div><h1 className="text-2xl font-bold">Funil de ativação</h1><p className="text-sm text-muted-foreground">Últimos 30 dias</p></div></div></header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(([key, label], index) => {
          const count = counts[key] ?? 0;
          const previous = index ? counts[stages[index - 1][0]] ?? 0 : count;
          const conversion = previous ? Math.round((count / previous) * 100) : 0;
          return <div key={key} className="rounded-md border border-border bg-card p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{index > 0 && <span>{conversion}%</span>}</div><p className="mt-2 text-3xl font-bold">{count}</p>{index < stages.length - 1 && <ArrowRight className="mt-3 h-4 w-4 text-muted-foreground" />}</div>;
        })}
      </section>
      <section className="mt-8"><h2 className="mb-3 flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-primary" />Experimentos</h2><div className="overflow-x-auto rounded-md border border-border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">Variante</th><th className="p-3">Visualizações</th><th className="p-3">Cadastros</th><th className="p-3">Resultados</th></tr></thead><tbody>{Object.entries(query.data?.byVariant ?? {}).map(([variant, values]) => <tr key={variant} className="border-t border-border"><td className="p-3 font-medium">{variant}</td><td className="p-3">{values.shared_content_viewed ?? 0}</td><td className="p-3">{values.signup_completed ?? 0}</td><td className="p-3">{values.first_result ?? 0}</td></tr>)}</tbody></table></div></section>
      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4" />Dados agregados de ativação; nenhum conteúdo privado é exibido.</p>
    </main>
  );
}