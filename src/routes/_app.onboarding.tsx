import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, MapPin, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActivationState, saveOnboarding, trackActivation } from "@/lib/activation.functions";
import { clearEntryContext, readEntryContext, type EntryContext, type EntryIntent } from "@/lib/onboarding-context";
import { ONBOARDING_OPTIONS, optionFor } from "@/lib/onboarding-config";

export const Route = createFileRoute("/_app/onboarding")({
  head: () => ({ meta: [
    { title: "Comece sua viagem — JAQTRYP AI" },
    { name: "description", content: "Configure sua primeira experiência de viagem em poucos passos." },
    { property: "og:title", content: "Comece sua viagem — JAQTRYP AI" },
    { property: "og:description", content: "Configure sua primeira experiência de viagem em poucos passos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OnboardingPage,
});

const styles = ["Econômico", "Conforto", "Família", "Romântico", "Aventura", "Luxo"];

function OnboardingPage() {
  const navigate = useNavigate();
  const [context, setContext] = React.useState<EntryContext>({ intent: "direct", variant: "default" });
  const [step, setStep] = React.useState(1);
  const [draft, setDraft] = React.useState<Record<string, string>>({ travelers: "2", style: "Conforto" });
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    Promise.all([getActivationState(), Promise.resolve(readEntryContext())]).then(([state, local]) => {
      const saved = state.onboarding;
      const nextContext = local ?? (saved?.source_context as EntryContext | null) ?? { intent: (saved?.intent as EntryIntent | undefined) ?? "direct", variant: saved?.variant ?? "default" };
      setContext(nextContext);
      if (saved?.status === "started") {
        setStep(saved.current_step);
        setDraft({ travelers: "2", style: "Conforto", ...(saved.draft as Record<string, string>) });
      }
      setReady(true);
      trackActivation({ data: { event: "onboarding_started", feature: nextContext.intent, source: nextContext.source, campaign: nextContext.campaign, variant: nextContext.variant, properties: {} } }).catch(() => {});
    }).catch(() => setReady(true));
  }, []);

  const persist = (nextStep: number, nextDraft = draft, status: "started" | "completed" = "started") => saveOnboarding({ data: { intent: context.intent, status, currentStep: nextStep, draft: nextDraft, sourceContext: context, variant: context.variant } });

  const choose = async (intent: EntryIntent) => {
    const next = { ...context, intent };
    setContext(next);
    if (intent === "itinerary") {
      setStep(1);
      await saveOnboarding({ data: { intent, status: "started", currentStep: 1, draft, sourceContext: next, variant: next.variant } });
      return;
    }
    await finish(intent, draft);
  };

  const finish = async (intent = context.intent, values = draft) => {
    await saveOnboarding({ data: { intent, status: "completed", currentStep: intent === "itinerary" ? 4 : 1, draft: values, sourceContext: context, variant: context.variant } });
    await trackActivation({ data: { event: "onboarding_completed", feature: intent, source: context.source, campaign: context.campaign, variant: context.variant, properties: {} } }).catch(() => {});
    clearEntryContext();
    if (intent === "itinerary") navigate({ to: "/planner", search: { destination: values.destination, startDate: values.startDate, days: values.days, travelers: values.travelers, style: values.style, budget: values.budget } });
    else if (intent === "flight_search") navigate({ to: "/flights", search: { origin: context.origin ?? "", destination: context.destination ?? "", departure_date: context.startDate ?? "", return_date: context.endDate ?? "", auto: false } });
    else if (intent === "image_translation") navigate({ to: "/translator", search: { action: "image" } });
    else if (intent === "document_translation") navigate({ to: "/file-translator" });
    else if (intent === "travel_budget") navigate({ to: "/wallet" });
    else navigate({ to: "/dashboard" });
  };

  const next = async () => {
    if (step === 1 && !draft.destination?.trim()) return;
    if (step === 2 && (!draft.startDate || !Number(draft.days))) return;
    if (step < 4) {
      const value = step + 1;
      setStep(value);
      await persist(value);
    } else await finish();
  };

  if (!ready) return <div className="grid min-h-[70vh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  if (context.intent === "direct") return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-14">
      <p className="text-sm font-semibold text-primary">Bem-vindo ao JAQTRYP</p>
      <h1 className="mt-2 text-3xl font-bold">O que você quer fazer agora?</h1>
      <p className="mt-2 text-muted-foreground">Escolha uma opção. Você verá somente o necessário para começar.</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {ONBOARDING_OPTIONS.map((option) => (
          <Button key={option.intent} variant="outline" className="h-auto justify-between whitespace-normal p-5 text-left" onClick={() => choose(option.intent)}>
            <span><strong className="block">{option.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{option.description}</span></span><ArrowRight />
          </Button>
        ))}
      </div>
    </div>
  );

  if (context.intent !== "itinerary") {
    const option = optionFor(context.intent);
    return <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 text-center"><div><Sparkles className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-4 text-3xl font-bold">Vamos começar</h1><p className="mt-2 text-muted-foreground">{option.description}</p><Button size="lg" className="mt-6 h-12" onClick={() => finish()}>{option.cta}<ArrowRight /></Button></div></div>;
  }

  const labels = ["Destino", "Datas", "Perfil", "Orçamento"];
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-14">
      <div className="mb-8"><div className="flex items-center justify-between text-xs font-semibold text-muted-foreground"><span>PASSO {step} DE 4</span><span>{labels[step - 1]}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${step * 25}%` }} /></div></div>
      <h1 className="text-3xl font-bold">Vamos criar sua viagem.</h1>
      <p className="mt-2 text-muted-foreground">{step === 1 ? "Para onde você vai?" : step === 2 ? "Quando será a viagem?" : step === 3 ? "Como vocês gostam de viajar?" : "Qual é o orçamento aproximado?"}</p>
      <div className="mt-8 min-h-48">
        {step === 1 && <div><Label htmlFor="destination">Destino</Label><div className="relative mt-2"><MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" /><Input id="destination" autoFocus className="h-12 pl-10" placeholder="Ex.: Lisboa, Portugal" value={draft.destination ?? context.destination ?? ""} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} /></div></div>}
        {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><div><Label>Data de início</Label><Input type="date" className="mt-2 h-12" value={draft.startDate ?? context.startDate ?? ""} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></div><div><Label>Quantos dias?</Label><Input type="number" min={1} max={60} className="mt-2 h-12" value={draft.days ?? ""} onChange={(e) => setDraft({ ...draft, days: e.target.value })} /></div></div>}
        {step === 3 && <div className="space-y-5"><div><Label>Quantas pessoas?</Label><div className="mt-2 grid grid-cols-4 gap-2">{["1","2","3","4"].map((n) => <Button key={n} variant={draft.travelers === n ? "default" : "outline"} onClick={() => setDraft({ ...draft, travelers: n })}><Users />{n}</Button>)}</div></div><div><Label>Estilo</Label><div className="mt-2 grid grid-cols-2 gap-2">{styles.map((value) => <Button key={value} variant={draft.style === value ? "default" : "outline"} className="whitespace-normal" onClick={() => setDraft({ ...draft, style: value })}>{draft.style === value && <Check />}{value}</Button>)}</div></div></div>}
        {step === 4 && <div><Label>Orçamento aproximado (opcional)</Label><Input className="mt-2 h-12" inputMode="numeric" placeholder="Ex.: 8.000" value={draft.budget ?? ""} onChange={(e) => setDraft({ ...draft, budget: e.target.value })} /><div className="mt-5 rounded-md border border-border p-4 text-sm"><p className="font-semibold">Seu roteiro completo usa 15 créditos.</p><p className="mt-1 text-muted-foreground">O saldo será usado somente quando você gerar o resultado.</p></div></div>}
      </div>
      <div className="mt-7 flex gap-3">{step > 1 && <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}><ArrowLeft />Voltar</Button>}<Button size="lg" className="h-12 flex-1" disabled={(step === 1 && !(draft.destination ?? context.destination)?.trim()) || (step === 2 && (!draft.startDate && !context.startDate || !Number(draft.days)))} onClick={next}>{step === 4 ? "Continuar para gerar" : "Continuar"}<ArrowRight /></Button></div>
      <div className="mt-6 flex items-center gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" />JAX: responda somente este passo. Você poderá ajustar tudo depois.</div>
    </div>
  );
}