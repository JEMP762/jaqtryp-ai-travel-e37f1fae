import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Loader2,
  Download,
  Eye,
  RotateCcw,
  Globe,
  CreditCard,
  CheckCircle2,
  XCircle,
  Languages as LanguagesIcon,
  Sparkles,
  Coins,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import {
  translateFile,
  listFileTranslations,
  getFileTranslationDownloadUrl,
} from "@/lib/file-translator.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TranslationExportMenu } from "@/components/TranslationExportMenu";

export const Route = createFileRoute("/_app/file-translator")({
  component: FileTranslatorPage,
});

const LANGS = [
  { code: "pt", name: "Português" },
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文" },
  { code: "ko", name: "한국어" },
  { code: "ar", name: "العربية" },
  { code: "ru", name: "Русский" },
  { code: "nl", name: "Nederlands" },
  { code: "hi", name: "हिन्दी" },
  { code: "tr", name: "Türkçe" },
  { code: "pl", name: "Polski" },
];

const ACCEPT = ".pdf,.docx,.xlsx,.csv,.pptx,.txt,.md";
const MAX_MB = 10;
const COST = 10;
const PRO_PRICE_PER_FILE = 50; // economia estimada

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.split(",")[1] ?? r);
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function langName(code?: string | null) {
  if (!code) return "—";
  return LANGS.find((l) => l.code === code)?.name ?? code.toUpperCase();
}

function FileTranslatorPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const doTranslate = useServerFn(translateFile);
  const doList = useServerFn(listFileTranslations);
  const doGetUrl = useServerFn(getFileTranslationDownloadUrl);

  const [file, setFile] = React.useState<File | null>(null);
  const [target, setTarget] = React.useState("en");
  const [dragOver, setDragOver] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<null | {
    id: string;
    download_url: string | null;
    file_name: string;
    source_lang: string;
    credits_spent: number;
  }>(null);
  const [rangeFilter, setRangeFilter] = React.useState<"today" | "7d" | "30d" | "all">("all");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Saldo (browser-side via supabase)
  const { data: balance } = useQuery({
    queryKey: ["user_credits_total", user?.id],
    enabled: !!user?.id,
    retry: 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("free_balance,monthly_balance,topup_balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (
        (data?.free_balance ?? 0) + (data?.monthly_balance ?? 0) + (data?.topup_balance ?? 0)
      );
    },
  });

  const { data: history, error: historyError } = useQuery({
    queryKey: ["file_translations", rangeFilter, user?.id],
    enabled: !!user?.id,
    retry: 1,
    queryFn: () => doList({ data: { range: rangeFilter } }),
  });

  const rows = history?.rows ?? [];
  const stats = React.useMemo(() => {
    const success = rows.filter((r: any) => r.status === "success");
    const langs = new Set(success.map((r: any) => r.target_lang));
    const credits = success.reduce((a: number, r: any) => a + (r.credits_spent ?? 0), 0);
    return {
      files: success.length,
      langs: langs.size,
      credits,
      savings: success.length * PRO_PRICE_PER_FILE,
    };
  }, [rows]);

  const onPickFile = (f: File | null) => {
    if (!f) return setFile(null);
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo excede ${MAX_MB}MB.`);
      return;
    }
    setFile(f);
    setResult(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPickFile(f);
  };

  const insufficient = (balance ?? 0) < COST;

  const onTranslate = async () => {
    if (!file) return;
    setSubmitting(true);
    setResult(null);
    try {
      const file_base64 = await fileToBase64(file);
      const res = await doTranslate({
        data: {
          file_base64,
          file_name: file.name,
          file_type: file.type,
          target_lang: target,
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setResult({
        id: res.id,
        download_url: res.download_url,
        file_name: res.file_name,
        source_lang: res.source_lang,
        credits_spent: res.credits_spent,
      });
      toast.success("Tradução concluída com sucesso!");
      qc.invalidateQueries({ queryKey: ["user_credits_total"] });
      qc.invalidateQueries({ queryKey: ["file_translations"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao traduzir.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDownloadRow = async (id: string) => {
    try {
      const r = await doGetUrl({ data: { id } });
      if (r.url) window.open(r.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao baixar.");
    }
  };

  const onReset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <LanguagesIcon className="h-7 w-7 text-primary" />
          Tradutor de Arquivos IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Envie um arquivo e traduza para qualquer idioma em segundos, preservando a estrutura
          original.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={FileText} label="Arquivos traduzidos" value={stats.files.toString()} />
        <StatCard icon={Globe} label="Idiomas utilizados" value={stats.langs.toString()} />
        <StatCard icon={Coins} label="Créditos consumidos" value={stats.credits.toString()} />
        <StatCard
          icon={Sparkles}
          label="Economia estimada"
          value={`R$ ${stats.savings.toLocaleString("pt-BR")}`}
        />
      </div>

      {/* Upload + Confirm */}
      <Card className="space-y-4 p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
          }`}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="font-medium">
            {file ? file.name : "Arraste e solte seu arquivo aqui"}
          </div>
          <div className="text-xs text-muted-foreground">
            {file
              ? `${formatBytes(file.size)} • ${file.type || "arquivo"}`
              : `PDF, DOCX, XLSX, CSV, PPTX, TXT • até ${MAX_MB}MB`}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          {!file && (
            <Button type="button" variant="secondary" size="sm" className="mt-2">
              📁 Selecionar Arquivo
            </Button>
          )}
        </div>

        {file && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Idioma de destino</label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Custo desta tradução</span>
                  <span className="font-semibold">{COST} créditos</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Seu saldo</span>
                  <span className={insufficient ? "font-semibold text-destructive" : "font-semibold"}>
                    {balance ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {file && insufficient && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <div className="mb-2 font-medium text-destructive">
              Você não possui créditos suficientes para realizar esta tradução.
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link to="/credits">
                  <Coins className="mr-1 h-4 w-4" /> Comprar Créditos
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/billing">
                  <CreditCard className="mr-1 h-4 w-4" /> Assinar Plano
                </Link>
              </Button>
            </div>
          </div>
        )}

        {file && !result && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onTranslate} disabled={submitting || insufficient}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Traduzindo…
                </>
              ) : (
                <>Traduzir Arquivo</>
              )}
            </Button>
            <Button variant="ghost" onClick={onReset} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="mb-3 flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> Tradução concluída com sucesso.
            </div>
            <div className="mb-3 text-sm text-muted-foreground">
              {result.file_name} • {langName(result.source_lang)} → {langName(target)} •{" "}
              {result.credits_spent} créditos
            </div>
            <div className="flex flex-wrap gap-2">
              <TranslationExportMenu
                title={result.file_name.replace(/\.(md|pdf|docx|xlsx|pptx|txt|csv)$/i, "")}
                baseName={result.file_name.replace(/\.[^.]+$/, "")}
                markdownUrl={result.download_url ?? undefined}
                label="Exportar Tradução"
              />
              <Button
                variant="outline"
                onClick={() => result.download_url && window.open(result.download_url, "_blank")}
                disabled={!result.download_url}
              >
                <Eye className="mr-2 h-4 w-4" /> Visualizar
              </Button>
              <Button variant="ghost" onClick={onReset}>
                <RotateCcw className="mr-2 h-4 w-4" /> Traduzir Novamente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* História */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Histórico de Traduções</h2>
          <div className="flex gap-1 rounded-lg border border-border p-1 text-xs">
            {(
              [
                ["today", "Hoje"],
                ["7d", "7 dias"],
                ["30d", "30 dias"],
                ["all", "Todos"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRangeFilter(k)}
                className={`rounded-md px-3 py-1 transition ${
                  rangeFilter === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma tradução por aqui ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left font-medium">Data</th>
                  <th className="py-2 text-left font-medium">Arquivo</th>
                  <th className="py-2 text-left font-medium">Idiomas</th>
                  <th className="py-2 text-left font-medium">Créditos</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2">
                      <div className="font-medium">{r.file_name}</div>
                      <div className="text-xs text-muted-foreground uppercase">{r.file_type}</div>
                    </td>
                    <td className="py-2">
                      {langName(r.source_lang)} → {langName(r.target_lang)}
                    </td>
                    <td className="py-2">{r.credits_spent}</td>
                    <td className="py-2">
                      {r.status === "success" ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Sucesso
                        </Badge>
                      ) : r.status === "error" ? (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" /> Erro
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Processando
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {r.status === "success" && r.storage_path_translated && (
                        <Button size="sm" variant="ghost" onClick={() => onDownloadRow(r.id)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </Card>
  );
}
