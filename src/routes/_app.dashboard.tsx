import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, MessageSquare, Languages, Plane, Mic, Clock3 } from "lucide-react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { DashboardCreditsCard } from "@/components/DashboardCreditsCard";
import { PushOptIn } from "@/components/PushOptIn";
import { QuickActions } from "@/components/QuickActions";
import { Button } from "@/components/ui/button";
import { getActivationState, trackActivation } from "@/lib/activation.functions";
import { optionFor } from "@/lib/onboarding-config";


export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [
    { title: "Sua viagem — JAQTRYP AI" }, { name: "description", content: "Continue seus planos e acesse suas ferramentas de viagem." },
    { property: "og:title", content: "Sua viagem — JAQTRYP AI" }, { property: "og:description", content: "Continue seus planos e acesse suas ferramentas de viagem." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [activation, setActivation] = React.useState<Awaited<ReturnType<typeof getActivationState>> | null>(null);
  const name =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
    user?.email?.split("@")[0] ??
    "viajante";

  React.useEffect(() => {
    getActivationState().then((value) => {
      setActivation(value);
      if (value.results.length > 0) trackActivation({ data: { event: "return_visit", properties: { results: value.results.length } } }).catch(() => {});
    }).catch(() => {});
  }, []);

  const onboarding = activation?.onboarding;
  const nextOption = onboarding ? optionFor(onboarding.intent as any) : optionFor("itinerary");
  const recent = activation?.results ?? [];
  const priority = onboarding?.status === "started" ? "/onboarding" : nextOption.path;

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
      <div className="border-b border-border pb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
          <Sparkles className="h-3.5 w-3.5" /> {t("hero.badge")}
        </div>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">
          {t("dash.welcome")}, <span className="text-gradient">{name}</span>
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          {onboarding?.status === "started" ? "Sua configuração está salva. Continue de onde parou." : recent.length ? "Continue seus planos ou dê o próximo passo." : "Vamos criar seu primeiro resultado em poucos minutos."}
        </p>
        <Button asChild size="lg" className="mt-5 h-12">
          <Link to={priority as any}>{onboarding?.status === "started" ? "Continuar configuração" : recent.length ? "Continuar minha viagem" : nextOption.cta}<ArrowRight /></Link>
        </Button>
      </div>

      <div className="mt-8">
        <QuickActions priority={priority} />
      </div>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-primary" />Continue de onde parou</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.slice(0, 3).map((result) => (
              <Link key={result.id} to={result.kind === "itinerary" ? "/planner" : result.kind === "translation" ? "/translator" : result.kind === "document_translation" ? "/file-translator" : result.kind === "flight_search" ? "/flights" : "/wallet"} className="rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50">
                <p className="font-semibold">{result.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{result.summary || "Resultado salvo"}</p>
                <p className="mt-3 text-xs text-primary">Abrir novamente →</p>
              </Link>
            ))}
          </div>
        </section>
      )}

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
