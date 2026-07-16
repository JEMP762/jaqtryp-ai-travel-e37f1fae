import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, MessageSquare, Languages, Plane, Mic } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { DashboardCreditsCard } from "@/components/DashboardCreditsCard";
import { PushOptIn } from "@/components/PushOptIn";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const { t } = useI18n();
  const name =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
    user?.email?.split("@")[0] ??
    "viajante";

  const cards = [
    {
      to: "/planner",
      icon: Sparkles,
      title: t("dash.planner"),
      desc: "Monte um roteiro completo com IA em segundos.",
    },
    {
      to: "/chat",
      icon: MessageSquare,
      title: t("dash.chat"),
      desc: "Tire dúvidas sobre destinos, vistos, comidas e mais.",
    },
    {
      to: "/translator",
      icon: Languages,
      title: t("dash.translator"),
      desc: "Traduza texto em mais de 100 idiomas.",
    },
    {
      to: "/live-translator",
      icon: Mic,
      title: "Live Translator",
      desc: "Tradução simultânea por voz, texto e foto. Modo conversa, guia e cruzeiro.",
    },
    {
      to: "/flights",
      icon: Plane,
      title: "Voos",
      desc: "Busque voos e crie alertas inteligentes.",
    },

  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-10">
      <div className="rounded-3xl border border-primary/30 bg-gradient-card p-8 shadow-glow md:p-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
          <Sparkles className="h-3.5 w-3.5" /> {t("hero.badge")}
        </div>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">
          {t("dash.welcome")}, <span className="text-gradient">{name}</span>
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Para onde sua próxima aventura vai te levar?
        </p>
      </div>

      <div className="mt-6">
        <PushOptIn />
      </div>



      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <DashboardCreditsCard />
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-2xl border border-border bg-gradient-card p-6 transition-all hover:border-primary/40 hover:shadow-glow"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm text-primary">
                Abrir <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
