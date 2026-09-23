import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Sparkles, Download, Languages, LockKeyhole, ExternalLink } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WidgetInfo = {
  slug: string;
  headline: string | null;
  intro: string | null;
  companyName: string | null;
  logoUrl: string | null;
  itineraryCost: number;
  translationCost: number;
  monetized: boolean;
  paymentUrl: string | null;
  price: number | null;
};

export const Route = createFileRoute("/r/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    embed: search.embed === "1" || search.embed === 1 || search.embed === true ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Monte seu roteiro de viagem com IA" },
      {
        name: "description",
        content:
          "Gere um roteiro de viagem dia a dia, personalizado e gratuito, em segundos com inteligência artificial.",
      },
      { property: "og:title", content: "Monte seu roteiro de viagem com IA" },
      {
        property: "og:description",
        content: "Roteiro de viagem dia a dia, personalizado, gerado por inteligência artificial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicWidgetPage,
});

const STYLES = ["Econômico", "Conforto", "Família", "Romântico", "Aventura", "Luxo"];
const CURRENCIES = [
  { code: "BRL", label: "Real (R$)", symbol: "R$" },
  { code: "USD", label: "Dólar (US$)", symbol: "US$" },
  { code: "EUR", label: "Euro (€)", symbol: "€" },
  { code: "GBP", label: "Libra (£)", symbol: "£" },
  { code: "ARS", label: "Peso argentino (AR$)", symbol: "AR$" },
  { code: "CLP", label: "Peso chileno (CL$)", symbol: "CL$" },
  { code: "JPY", label: "Iene (¥)", symbol: "¥" },
  { code: "CHF", label: "Franco suíço (CHF)", symbol: "CHF" },
  { code: "CAD", label: "Dólar canadense (C$)", symbol: "C$" },
  { code: "AUD", label: "Dólar australiano (A$)", symbol: "A$" },
];
const LANGUAGES = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
  { code: "ru", label: "Русский" },
] as const;

function printItinerary(
  title: string,
  markdown: string,
  brand: { logo: string | null; company: string | null },
) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Permita pop-ups para baixar o roteiro");
    return;
  }
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = esc(markdown)
    .split("\n")
    .map((line) => {
      if (/^###\s+/.test(line)) return `<h3>${line.replace(/^###\s+/, "")}</h3>`;
      if (/^##\s+/.test(line)) return `<h2>${line.replace(/^##\s+/, "")}</h2>`;
      if (/^#\s+/.test(line)) return `<h1>${line.replace(/^#\s+/, "")}</h1>`;
      if (/^[-*]\s+/.test(line))
        return `<li>${line.replace(/^[-*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`;
      if (!line.trim()) return "";
      return `<p>${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
    })
    .join("");
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:16px}.brand img{height:56px;object-fit:contain}
h1{font-size:26px;border-bottom:2px solid #eee;padding-bottom:8px}h2{font-size:20px;color:#1e40af;margin-top:24px}
li{margin:3px 0}@media print{body{margin:0}}</style></head><body>
<div class="brand">${brand.logo ? `<img src="${brand.logo}" alt="logo"/>` : ""}${
    brand.company ? `<span><strong>${esc(brand.company)}</strong></span>` : ""
  }</div>
<h1>${esc(title)}</h1>${body}
<script>setTimeout(()=>window.print(),600);</script></body></html>`);
  w.document.close();
}

function PublicWidgetPage() {
  const { slug } = Route.useParams();
  const { embed } = Route.useSearch();
  const isEmbed = embed === 1;

  const [info, setInfo] = React.useState<WidgetInfo | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [destination, setDestination] = React.useState("");
  const [days, setDays] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [travelers, setTravelers] = React.useState("2");
  const [style, setStyle] = React.useState("Conforto");
  const [budget, setBudget] = React.useState("");
  const [currency, setCurrency] = React.useState("BRL");
  const [language, setLanguage] = React.useState("pt");
  const [translateTo, setTranslateTo] = React.useState("en");
  const [honeypot, setHoneypot] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [translating, setTranslating] = React.useState(false);
  const [plan, setPlan] = React.useState("");
  const [originalPlan, setOriginalPlan] = React.useState("");
  const [generationId, setGenerationId] = React.useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = React.useState("pt");
  const [versions, setVersions] = React.useState<Record<string, string>>({});
  const [locked, setLocked] = React.useState(false);
  const [accessPassword, setAccessPassword] = React.useState("");
  const [unlocking, setUnlocking] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/public/widget-itinerary?slug=${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("nf");
        setInfo(await r.json());
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  const generate = async () => {
    if (!destination.trim()) return toast.error("Informe o destino");
    const n = Number(days);
    if (!n || n < 1) return toast.error("Informe a quantidade de dias");
    setLoading(true);
    setPlan("");
    try {
      const resp = await fetch("/api/public/widget-itinerary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          destination: destination.trim(),
          days: n,
          startDate: startDate || null,
          travelers: Number(travelers) || 1,
          style,
          budget: budget || null,
          currency,
          language,
          website: honeypot,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Não foi possível gerar agora.");
      setPlan(data.text as string);
      setOriginalPlan(data.originalText as string);
      setGenerationId(data.generationId as string | null);
      setActiveLanguage(data.language as string);
      setVersions({ pt: data.originalText as string, [data.language as string]: data.text as string });
      setLocked(data.locked === true);
      setAccessPassword("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const translate = async () => {
    if (!generationId || !originalPlan || translating || locked) return;
    const existing = versions[translateTo];
    if (existing) {
      setPlan(existing);
      setActiveLanguage(translateTo);
      return;
    }
    setTranslating(true);
    try {
      const resp = await fetch("/api/public/widget-itinerary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "translate", slug, generationId, originalText: originalPlan, targetLanguage: translateTo, accessPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Não foi possível traduzir agora.");
      setVersions((current) => ({ ...current, [translateTo]: data.text as string }));
      setPlan(data.text as string);
      setActiveLanguage(translateTo);
      toast.success("Roteiro traduzido");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setTranslating(false);
    }
  };

  const unlock = async () => {
    if (!generationId || unlocking) return;
    if (accessPassword.trim().length < 6) return toast.error("Digite a senha de acesso.");
    setUnlocking(true);
    try {
      const response = await fetch("/api/public/widget-itinerary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unlock", slug, generationId, password: accessPassword.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível liberar o roteiro.");
      setPlan(data.text as string);
      setOriginalPlan(data.originalText as string);
      setVersions({ pt: data.originalText as string, [activeLanguage]: data.text as string });
      setLocked(false);
      toast.success("Roteiro liberado");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUnlocking(false);
    }
  };

  if (notFound) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Página indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de roteiro não existe ou foi desativado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={isEmbed ? "px-3 py-4" : "mx-auto max-w-5xl px-4 py-10"}>
      {!isEmbed && (
        <header className="mb-8 flex flex-col items-center gap-3 text-center">
          {info?.logoUrl && (
            <img
              src={info.logoUrl}
              alt={info.companyName ? `Logo ${info.companyName}` : "Logo"}
              className="h-16 w-auto rounded-lg bg-white/80 object-contain p-1"
            />
          )}
          <h1 className="text-2xl font-bold sm:text-3xl">
            {info?.headline || "Monte seu roteiro de viagem"}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {info?.intro ||
              "Preencha os dados abaixo e receba um roteiro completo, dia a dia, em segundos."}
          </p>
        </header>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex: Lisboa, Portugal"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dias</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="7"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Viajantes</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={travelers}
                onChange={(e) => setTravelers(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estilo</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Moeda do orçamento</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue>{CURRENCIES.find((item) => item.code === currency)?.label}</SelectValue></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Orçamento ({CURRENCIES.find((item) => item.code === currency)?.symbol}, opcional)</Label>
            <Input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              inputMode="numeric"
              placeholder="Ex: 8000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Idioma do roteiro</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue>{LANGUAGES.find((item) => item.code === language)?.label}</SelectValue></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {language === "pt"
                ? `${info?.itineraryCost ?? 0} créditos da conta responsável pelo link.`
                : `${(info?.itineraryCost ?? 0) + (info?.translationCost ?? 0)} créditos: roteiro e tradução.`}
            </p>
          </div>

          {/* honeypot anti-robô */}
          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="hidden"
          />

          <Button
            onClick={generate}
            disabled={loading}
            className="w-full bg-gradient-primary shadow-glow"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando roteiro...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Gerar meu roteiro
              </>
            )}
          </Button>
        </div>

        <div className="min-h-[320px] rounded-2xl border border-border bg-gradient-card p-5">
          {plan ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {info?.logoUrl && (
                    <img
                      src={info.logoUrl}
                      alt=""
                      className="h-10 w-auto rounded bg-white/80 object-contain p-1"
                    />
                  )}
                  {info?.companyName && (
                    <span className="text-sm font-semibold">{info.companyName}</span>
                  )}
                </div>
                {!locked && <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    printItinerary(`${destination} — Roteiro`, plan, {
                      logo: info?.logoUrl ?? null,
                      company: info?.companyName ?? null,
                    })
                  }
                >
                  <Download className="h-4 w-4" /> Baixar PDF
                </Button>}
              </div>
              {!locked && <div className="mb-5 flex flex-col gap-2 border-y border-border py-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label>Traduzir roteiro</Label>
                  <Select value={translateTo} onValueChange={setTranslateTo}>
                    <SelectTrigger><SelectValue>{LANGUAGES.find((item) => item.code === translateTo)?.label}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.filter((item) => item.code !== "pt").map((item) => (
                        <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={translate} disabled={translating || translateTo === activeLanguage}>
                  {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                  {versions[translateTo] ? "Ver tradução" : `Traduzir · ${info?.translationCost ?? 0} créditos`}
                </Button>
                {activeLanguage !== "pt" && (
                  <Button variant="ghost" onClick={() => { setPlan(originalPlan); setActiveLanguage("pt"); }}>
                    Ver original
                  </Button>
                )}
              </div>}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{plan}</ReactMarkdown>
              </div>
              {locked && info?.monetized && (
                <div className="relative mt-5 overflow-hidden rounded-md border border-border">
                  <div aria-hidden="true" className="select-none space-y-3 p-5 blur-sm">
                    <div className="h-5 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-5/6 rounded bg-muted" />
                    <div className="h-3 w-4/5 rounded bg-muted" />
                    <div className="h-5 w-1/4 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                  </div>
                  <div className="absolute inset-0 grid place-items-center bg-background/75 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm space-y-4 rounded-md border border-border bg-card p-5 text-center shadow-lg">
                      <LockKeyhole className="mx-auto h-7 w-7 text-primary" />
                      <div>
                        <p className="font-semibold">Roteiro completo</p>
                        <p className="mt-1 text-2xl font-bold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(info.price ?? 0)}</p>
                      </div>
                      {info.paymentUrl && (
                        <Button asChild className="w-full">
                          <a href={info.paymentUrl} target="_blank" rel="noopener noreferrer">Pagar e Liberar Roteiro <ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <div className="space-y-2 text-left">
                        <Label htmlFor="access-password">Já pagou? Digite a senha de acesso</Label>
                        <Input id="access-password" type="password" value={accessPassword} onChange={(event) => setAccessPassword(event.target.value)} maxLength={100} autoComplete="off" onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} />
                        <Button variant="outline" className="w-full" onClick={unlock} disabled={unlocking}>
                          {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Liberar roteiro
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="grid h-full place-items-center text-center text-muted-foreground">
              <div>
                <Sparkles className="mx-auto h-10 w-10 opacity-50" />
                <p className="mt-2 text-sm">Seu roteiro aparecerá aqui.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isEmbed && (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Roteiros gerados com tecnologia JAQTRYP.
        </p>
      )}
    </div>
  );
}
