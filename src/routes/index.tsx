import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Plane,
  Hotel,
  MessageSquare,
  Languages,
  CloudSun,
  DollarSign,
  Map,
  Wallet,
  FileText,
  Compass,
  WifiOff,
  ArrowRight,
  Check,
  Star,
  Mic,
  Bluetooth,
  Camera,
  Volume2,
} from "lucide-react";
import * as React from "react";
import { Navbar } from "@/components/site/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { TKey } from "@/lib/i18n/translations";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionCheckout } from "@/hooks/useSubscriptionCheckout";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FEATURES: { icon: React.ElementType; titleKey: TKey; descKey: TKey }[] = [
  { icon: Sparkles, titleKey: "feat.planner.title", descKey: "feat.planner.desc" },
  { icon: Plane, titleKey: "feat.flights.title", descKey: "feat.flights.desc" },
  { icon: Hotel, titleKey: "feat.hotels.title", descKey: "feat.hotels.desc" },
  { icon: MessageSquare, titleKey: "feat.chat.title", descKey: "feat.chat.desc" },
  { icon: Languages, titleKey: "feat.translator.title", descKey: "feat.translator.desc" },
  { icon: CloudSun, titleKey: "feat.weather.title", descKey: "feat.weather.desc" },
  { icon: DollarSign, titleKey: "feat.fx.title", descKey: "feat.fx.desc" },
  { icon: Map, titleKey: "feat.maps.title", descKey: "feat.maps.desc" },
  { icon: Wallet, titleKey: "feat.budget.title", descKey: "feat.budget.desc" },
  { icon: FileText, titleKey: "feat.docs.title", descKey: "feat.docs.desc" },
  { icon: Compass, titleKey: "feat.local.title", descKey: "feat.local.desc" },
  { icon: WifiOff, titleKey: "feat.offline.title", descKey: "feat.offline.desc" },
];

function Landing() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [billing, setBilling] = React.useState<"monthly" | "yearly">("monthly");
  const { user } = useAuth();
  const { openCheckout, checkoutDialog } = useSubscriptionCheckout();

  // Quem já está logado vai direto para o painel (evita a sensação de "deslogado").
  React.useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);


  const onPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate({
      to: "/signup",
      search: q ? { intent: q } : undefined,
    });
  };

  const handleSubscribe = (planKey: "pro" | "ultra") => {
    if (!user) {
      navigate({ to: "/signup", search: { intent: `subscribe:${planKey}:${billing}` } as any });
      return;
    }
    const priceId =
      planKey === "pro"
        ? billing === "yearly" ? "price_1TdXZNF2249riykhwvbz6EWl" : "price_1TdX3QF2249riykhAAlqarhW"
        : billing === "yearly" ? "price_1TdXSYF2249riykhv8DaMEYx" : "price_1TdX4XF2249riykh3ja7kaHB";
    openCheckout({ priceId });
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="absolute inset-0 -z-10 opacity-40">
          <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/30 blur-[140px]" />
          <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-primary-glow/20 blur-[140px]" />
        </div>
        <div className="mx-auto max-w-6xl px-4 text-center md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            {t("hero.badge")}
          </div>
          <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight md:text-7xl">
            {t("hero.title").split(",")[0]},
            <br />
            <span className="text-gradient">{t("hero.title").split(",")[1]?.trim()}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("hero.subtitle")}
          </p>

          <form
            onSubmit={onPlan}
            className="mx-auto mt-10 flex max-w-2xl flex-col gap-2 rounded-2xl border border-border bg-card/60 p-2 shadow-elegant backdrop-blur md:flex-row"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("hero.search.placeholder")}
              className="h-12 flex-1 border-0 bg-transparent text-base focus-visible:ring-0"
            />
            <Button type="submit" size="lg" className="h-12 bg-gradient-primary shadow-glow">
              {t("hero.search.button")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" /> 4.9/5
            </div>
            <div>+50.000 viajantes</div>
            <div>100+ idiomas</div>
            <div>Disponível em todo o mundo</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t border-border/50 py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
              {t("features.title")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("features.subtitle")}</p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.titleKey}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-6 transition-all hover:border-primary/40 hover:shadow-glow"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{t(f.titleKey)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(f.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* LIVE TRANSLATOR HIGHLIGHT */}
      <section id="live-translator" className="border-t border-border/50 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="grid items-center gap-10 rounded-3xl border border-primary/30 bg-gradient-card p-8 shadow-glow md:p-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Novo
              </div>
              <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight md:text-5xl">
                Live Translator — <span className="text-gradient">tradução em tempo real</span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                Converse em qualquer idioma com tradução simultânea por voz, texto e foto.
                Pareie dois fones Bluetooth e fale naturalmente — cada pessoa ouve no seu próprio idioma.
              </p>
              <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  { icon: Mic, label: "Voz ao vivo (STT + TTS)" },
                  { icon: Bluetooth, label: "2 dispositivos Bluetooth" },
                  { icon: Camera, label: "OCR de fotos e cardápios" },
                  { icon: Volume2, label: "Modo offline limitado" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label} className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      {item.label}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
                  <Link to="/signup">
                    Experimentar agora <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#plans">Ver planos</a>
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-primary opacity-20 blur-3xl" />
              <div className="rounded-2xl border border-border bg-card/80 p-6 backdrop-blur">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    ao vivo
                  </span>
                  <span>PT ⇄ EN</span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-border bg-background/60 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pessoa A · PT</div>
                    <div className="mt-1 text-sm">Onde fica a estação de metrô mais próxima?</div>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-primary">Pessoa B · EN</div>
                    <div className="mt-1 text-sm">Where is the nearest subway station?</div>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-primary">Pessoa B · EN</div>
                    <div className="mt-1 text-sm">Two blocks down on your left.</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pessoa A · PT</div>
                    <div className="mt-1 text-sm">Duas quadras adiante à sua esquerda.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-t border-border/50 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <h2 className="text-center text-4xl font-bold tracking-tight md:text-5xl">
            3 passos. Sua viagem pronta.
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", t: "Conte seu sonho", d: "Destino, dias, orçamento e estilo." },
              { n: "02", t: "IA monta tudo", d: "Voos, hotéis, roteiro e dicas locais." },
              { n: "03", t: "Viaje tranquilo", d: "Assistente IA + tradutor 24/7." },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-border bg-gradient-card p-8 shadow-elegant"
              >
                <div className="text-5xl font-black text-gradient">{s.n}</div>
                <h3 className="mt-4 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section id="plans" className="border-t border-border/50 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
              {t("plans.title")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("plans.subtitle")}</p>

          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                key: "free" as const,
                badge: "Grátis para começar",
                features: ["100 créditos de boas-vindas", "Tradutor texto", "Clima e câmbio"],
                cta: "default",
              },
              {
                key: "pro" as const,
                badge: "Mais escolhido",
                features: [
                  "Roteiros ilimitados",
                  "Tradutor voz + câmera",
                  "Alertas de voos",
                  "Modo offline",
                ],
                cta: "primary",
              },
              {
                key: "ultra" as const,
                badge: "Experiência completa",
                features: [
                  "Tudo do Pro",
                  "Concierge IA prioritário",
                  "Roteiros multi-cidade",
                  "Suporte 24/7",
                ],
                cta: "default",
              },
            ].map((p) => {
              const isPro = p.cta === "primary";
              return (
                <div
                  key={p.key}
                  className={`relative rounded-2xl border p-8 ${
                    isPro
                      ? "border-primary/50 bg-gradient-card shadow-glow"
                      : "border-border bg-card/60"
                  }`}
                >
                  {isPro && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold capitalize">
                    {t(`plans.${p.key}` as TKey)}
                  </h3>
                  <div className="mt-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <Sparkles className="h-3 w-3" /> {p.badge}
                    </span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={`mt-8 w-full ${isPro ? "bg-gradient-primary shadow-glow" : ""}`}
                    variant={isPro ? "default" : "outline"}
                  >
                    <Link to="/signup">Começar grátis</Link>
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Comece grátis com 100 créditos. Você escolhe recarga avulsa ou assinatura quando quiser.
          </p>
        </div>
      </section>


      {checkoutDialog}


      {/* CTA */}
      <section className="border-t border-border/50 py-24">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <div className="rounded-3xl border border-primary/30 bg-gradient-card p-12 shadow-glow">
            <h2 className="text-balance text-3xl font-bold md:text-4xl">
              Pronto para sua próxima aventura?
            </h2>
            <p className="mt-4 text-muted-foreground">
              {t("hero.subtitle")}
            </p>
            <Button asChild size="lg" className="mt-8 bg-gradient-primary shadow-glow">
              <Link to="/signup">
                {t("hero.cta.primary")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-8">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary">
              <span className="text-xs font-black text-primary-foreground">J</span>
            </div>
            <span className="text-sm font-semibold">Jaqtryp AI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Jaqtryp AI — {t("footer.rights")}
          </p>
        </div>
      </footer>
    </div>
  );
}
