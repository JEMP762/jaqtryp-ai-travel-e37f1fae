import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Loader2, Sparkles, Lock } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { authedJsonHeaders } from "@/lib/authed-fetch";
import { handleCreditError } from "@/lib/credit-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";


const EXPORT_LANGUAGES = [
  { code: "original", label: "Idioma original" },
  { code: "Portuguese (Brazil)", label: "Português (BR)" },
  { code: "English", label: "English" },
  { code: "Spanish", label: "Español" },
  { code: "French", label: "Français" },
  { code: "Italian", label: "Italiano" },
  { code: "German", label: "Deutsch" },
  { code: "Japanese", label: "日本語" },
  { code: "Chinese (Simplified)", label: "中文 (简体)" },
  { code: "Korean", label: "한국어" },
  { code: "Dutch", label: "Nederlands" },
  { code: "Russian", label: "Русский" },
  { code: "Arabic", label: "العربية" },
];

function markdownToHtml(md: string): string {
  // Minimal markdown → HTML for print export
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${escape(line.replace(/^###\s+/, ""))}</h3>`;
    } else if (/^##\s+/.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h2>${escape(line.replace(/^##\s+/, ""))}</h2>`;
    } else if (/^#\s+/.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h1>${escape(line.replace(/^#\s+/, ""))}</h1>`;
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      let item = escape(line.replace(/^[-*]\s+/, ""));
      item = item.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html += `<li>${item}</li>`;
    } else if (line.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      let p = escape(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html += `<p>${p}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function renderPrintWindow(
  w: Window,
  title: string,
  markdown: string,
  brand?: { logo?: string | null; company?: string | null } | null,
) {
  const body = markdownToHtml(markdown);
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const header =
    brand && (brand.logo || brand.company)
      ? `<div class="brand">${brand.logo ? `<img src="${brand.logo}" alt="logo" />` : ""}${
          brand.company ? `<span>${esc(brand.company)}</span>` : ""
        }</div>`
      : "";
  const footer =
    brand && brand.company ? `<div class="brand-footer">${esc(brand.company)}</div>` : "";
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
  .brand{display:flex;align-items:center;gap:12px;margin-bottom:16px}
  .brand img{height:56px;width:auto;object-fit:contain}
  .brand span{font-size:15px;font-weight:600;color:#334155}
  .brand-footer{margin-top:32px;padding-top:10px;border-top:1px solid #eee;font-size:12px;color:#64748b;text-align:center}
  h1{font-size:26px;margin:0 0 8px;border-bottom:2px solid #eee;padding-bottom:8px}
  h2{font-size:20px;margin:24px 0 8px;color:#1e40af}
  h3{font-size:16px;margin:18px 0 6px}
  p{margin:6px 0}
  ul{margin:6px 0 12px 22px}
  li{margin:3px 0}
  @media print { body { margin: 0; } }
</style></head><body>
${header}
<h1>${title}</h1>
${body}
${footer}
<script>setTimeout(()=>window.print(),600);</script>
</body></html>`);
  w.document.close();
}


function loadingHtml(msg: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${msg}</title>
<style>body{font-family:-apple-system,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#555}</style>
</head><body><div>${msg}…</div></body></html>`;
}

export const Route = createFileRoute("/_app/planner")({
  component: PlannerPage,
});

const CURRENCIES = [
  { code: "BRL", label: "Real (R$)", symbol: "R$" },
  { code: "USD", label: "Dólar (US$)", symbol: "US$" },
  { code: "EUR", label: "Euro (€)", symbol: "€" },
  { code: "GBP", label: "Libra (£)", symbol: "£" },
  { code: "ARS", label: "Peso Argentino ($)", symbol: "AR$" },
  { code: "CLP", label: "Peso Chileno ($)", symbol: "CL$" },
  { code: "JPY", label: "Iene (¥)", symbol: "¥" },
  { code: "CHF", label: "Franco Suíço (CHF)", symbol: "CHF" },
  { code: "CAD", label: "Dólar Canadense (C$)", symbol: "C$" },
  { code: "AUD", label: "Dólar Australiano (A$)", symbol: "A$" },
];

function PlannerPage() {
  const { lang } = useI18n();
  const [destination, setDestination] = React.useState("");
  const [days, setDays] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState<string>("");
  const [budget, setBudget] = React.useState("");
  const [currency, setCurrency] = React.useState("BRL");
  const [interests, setInterests] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [plan, setPlan] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [isPro, setIsPro] = React.useState<boolean | null>(null);


  React.useEffect(() => {
    async function checkPremium() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsPro(false); return; }
        // Libera para assinantes Pro/Ultra OU para quem possui créditos avulsos.
        const { data } = await supabase.rpc("has_premium_access", { user_uuid: user.id });
        setIsPro(data === true);
      } catch {
        setIsPro(false);
      }
    }
    checkPremium();
  }, []);


  const handleExport = async (targetLang: string) => {
    if (!plan) return;
    // Open the window SYNCHRONOUSLY (inside the click handler) so the
    // browser does not treat the later document.write as a popup.
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Permita pop-ups para exportar");
      return;
    }
    w.document.write(loadingHtml(lang === "en" ? "Preparing export" : "Preparando exportação"));
    setExporting(true);
    try {
      let content = plan;
      const title = destination
        ? `${destination} — ${lang === "en" ? "Itinerary" : "Roteiro"}`
        : (lang === "en" ? "Itinerary" : "Roteiro");
      if (targetLang !== "original") {
        const system = `You are a professional translator. Translate the following travel itinerary markdown to ${targetLang}. Preserve ALL markdown formatting (##, ###, -, **bold**), numbers, prices, currency symbols, and proper nouns (city/place names). Output ONLY the translated markdown, no extra commentary.`;
        const resp = await fetch("/api/ai", {
          method: "POST",
          headers: await authedJsonHeaders(),
          body: JSON.stringify({ system, prompt: plan, featureKey: "translate_text" }),
        });
        const data = await resp.json();
        if (resp.status === 402) throw new Error(data.error || "Créditos insuficientes. Adicione créditos em /billing.");
        if (!resp.ok) throw new Error(data.error || "Erro ao traduzir");
        content = data.text as string;
      }
      renderPrintWindow(w, title, content);
    } catch (e) {
      try { w.close(); } catch {}
      if (!handleCreditError(e)) toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };


  const generate = async () => {
    if (!destination.trim()) {
      toast.error("Informe um destino");
      return;
    }
    const nDays = Number(days);
    if (!nDays || nDays < 1) {
      toast.error("Informe a quantidade de dias");
      return;
    }
    setLoading(true);
    setPlan("");
    try {
      const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
      const budgetText = budget ? `${symbol} ${budget} (${currency})` : (lang === "en" ? "not specified" : "não informado");
      let dateBlockEn = "";
      let dateBlockPt = "";
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (!isNaN(start.getTime())) {
          const end = new Date(start);
          end.setDate(end.getDate() + Math.max(0, nDays - 1));
          const fmt = (d: Date, locale: string) => d.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
          dateBlockEn = ` The trip starts on ${fmt(start, "en-US")} and ends on ${fmt(end, "en-US")}. Label each day with its real date and weekday (e.g., "## Day 1 — ${fmt(start, "en-US")}").`;
          dateBlockPt = ` A viagem começa em ${fmt(start, "pt-BR")} e termina em ${fmt(end, "pt-BR")}. Rotule cada dia com a data real e o dia da semana (ex.: "## Dia 1 — ${fmt(start, "pt-BR")}").`;
        }
      }
      const system =
        lang === "en"
          ? `You are an expert travel planner. Build a clear, well-structured day-by-day itinerary in English using markdown (## Day 1, bullet lists). Include morning/afternoon/evening, restaurant ideas, transport tips, and a budget summary at the end. ALL prices and the budget summary MUST be in ${currency} (${symbol}).${dateBlockEn}`
          : `Você é um planejador de viagens especialista. Monte um roteiro dia a dia claro e bem estruturado em português usando markdown (## Dia 1, listas). Inclua manhã/tarde/noite, ideias de restaurantes, dicas de transporte e um resumo de orçamento no final. TODOS os preços e o resumo de orçamento DEVEM estar em ${currency} (${symbol}).${dateBlockPt}`;
      const prompt =
        lang === "en"
          ? `Plan a ${nDays}-day trip to ${destination}${startDate ? ` starting ${startDate}` : ""}. Budget: ${budgetText}. Interests: ${interests || "general"}.`
          : `Planeje uma viagem de ${nDays} dias para ${destination}${startDate ? ` começando em ${startDate}` : ""}. Orçamento: ${budgetText}. Interesses: ${interests || "geral"}.`;



      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: await authedJsonHeaders(),
        body: JSON.stringify({ system, prompt, featureKey: "trip_create_full" }),
      });
      const data = await resp.json();
      if (resp.status === 402) throw new Error(data.error || "Créditos insuficientes. Adicione créditos em /billing.");
      if (!resp.ok) throw new Error(data.error || "Erro");
      setPlan(data.text as string);
    } catch (e) {
      if (!handleCreditError(e)) toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Planejador IA</h1>
          <p className="text-sm text-muted-foreground">Roteiro completo em segundos</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-6">
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex: Tóquio, Japão"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dias</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="Ex: 7"
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
          <div className="space-y-1.5">
            <Label>Moeda</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Orçamento ({CURRENCIES.find((c) => c.code === currency)?.symbol})</Label>
            <Input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={`Ex: ${currency === "BRL" ? "10000" : "2000"}`}
              inputMode="numeric"
            />
          </div>


          <div className="space-y-1.5">
            <Label>Interesses</Label>
            <Textarea
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="gastronomia, museus, vida noturna..."
              rows={3}
            />
          </div>
          <Button
            onClick={generate}
            disabled={loading}
            className="w-full bg-gradient-primary shadow-glow"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Gerar roteiro
              </>
            )}
          </Button>
        </div>

        <div className="min-h-[400px] rounded-2xl border border-border bg-gradient-card p-6">
          {plan ? (
            <>
              <div className="mb-4 flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" disabled={exporting}>
                      {exporting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {lang === "en" ? "Exporting..." : "Exportando..."}</>
                      ) : (
                        <><Download className="h-4 w-4" /> {lang === "en" ? "Export PDF" : "Exportar PDF"}</>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                    <DropdownMenuLabel>{lang === "en" ? "Translate to" : "Traduzir para"}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {EXPORT_LANGUAGES.map((l) => {
                      const locked = !isPro && l.code !== "original";
                      return (
                        <DropdownMenuItem
                          key={l.code}
                          onClick={locked ? undefined : () => handleExport(l.code)}
                          className={locked ? "cursor-not-allowed opacity-60" : undefined}
                        >
                          <span className="flex flex-1 items-center justify-between gap-4">
                            {l.label}
                            {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                    {isPro === false && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-2">
                          <Link to="/billing" className="block w-full">
                            <Button size="sm" className="w-full bg-gradient-primary shadow-glow text-xs">
                              {lang === "en" ? "Upgrade to export translations" : "Faça upgrade para exportar traduções"}
                            </Button>
                          </Link>
                        </div>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{plan}</ReactMarkdown>
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center text-center text-muted-foreground">
              <div>
                <Sparkles className="mx-auto h-10 w-10 opacity-50" />
                <p className="mt-2 text-sm">
                  Preencha os dados e gere um roteiro completo dia a dia.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
