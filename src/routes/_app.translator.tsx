import { createFileRoute } from "@tanstack/react-router";
import { ArrowRightLeft, Camera, Languages, Loader2, Mic, MicOff, ScanLine, Volume2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { authedJsonHeaders } from "@/lib/authed-fetch";
import { handleCreditError } from "@/lib/credit-error";

export const Route = createFileRoute("/_app/translator")({
  component: TranslatorPage,
});

const LANGS = [
  { code: "pt", name: "Português", bcp47: "pt-BR" },
  { code: "en", name: "English", bcp47: "en-US" },
  { code: "es", name: "Español", bcp47: "es-ES" },
  { code: "fr", name: "Français", bcp47: "fr-FR" },
  { code: "it", name: "Italiano", bcp47: "it-IT" },
  { code: "de", name: "Deutsch", bcp47: "de-DE" },
  { code: "ja", name: "日本語", bcp47: "ja-JP" },
  { code: "zh", name: "中文", bcp47: "zh-CN" },
  { code: "ko", name: "한국어", bcp47: "ko-KR" },
  { code: "ar", name: "العربية", bcp47: "ar-SA" },
  { code: "ru", name: "Русский", bcp47: "ru-RU" },
];

function bcp47Of(code: string) {
  return LANGS.find((l) => l.code === code)?.bcp47 ?? code;
}

function TranslatorPage() {
  const { t } = useI18n();
  const [from, setFrom] = React.useState("pt");
  const [to, setTo] = React.useState("en");
  const [src, setSrc] = React.useState("");
  const [out, setOut] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef<any>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = React.useState(false);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("Falha ao ler arquivo"));
      r.readAsDataURL(file);
    });

  const handleImageOcr = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem (foto ou digitalização).");
      return;
    }
    setOcrLoading(true);
    setOut("");
    try {
      const dataUrl = await fileToDataUrl(file);
      const fromName = LANGS.find((l) => l.code === from)?.name ?? from;
      const toName = LANGS.find((l) => l.code === to)?.name ?? to;
      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: await authedJsonHeaders(),
        body: JSON.stringify({
          system:
            "You are an OCR + translation assistant. Extract ALL readable text from the image, then translate it. Return ONLY a JSON object with two fields: {\"original\": string, \"translation\": string}. No markdown, no code fences.",
          prompt: `Extract the text from the image (source language: ${fromName}) and translate it to ${toName}.`,
          image: dataUrl,
          featureKey: "translate_image",
        }),
      });
      const data = await resp.json();
      if (resp.status === 401) throw new Error("Sessão expirada, faça login novamente.");
      if (resp.status === 402) throw new Error(data.error || "Créditos insuficientes.");
      if (!resp.ok) throw new Error(data.error || "Erro");
      const raw = (data.text as string) ?? "";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      let original = "";
      let translation = "";
      try {
        const parsed = JSON.parse(cleaned);
        original = parsed.original ?? "";
        translation = parsed.translation ?? "";
      } catch {
        translation = cleaned;
      }
      if (original) setSrc(original);
      setOut(translation || cleaned);
      toast.success("Texto extraído e traduzido!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcrLoading(false);
    }
  };


  const swap = () => {
    setFrom(to);
    setTo(from);
    setSrc(out);
    setOut(src);
  };

  const translateText = async (text: string, fromCode: string, toCode: string) => {
    const fromName = LANGS.find((l) => l.code === fromCode)?.name ?? fromCode;
    const toName = LANGS.find((l) => l.code === toCode)?.name ?? toCode;
    const resp = await fetch("/api/ai", {
      method: "POST",
      headers: await authedJsonHeaders(),
      body: JSON.stringify({
        system: `You are a professional translator. Translate from ${fromName} to ${toName}. Return ONLY the translation, no explanations, no quotes.`,
        prompt: text,
        featureKey: "translate_text",
      }),
    });
    const data = await resp.json();
    if (resp.status === 401) throw new Error("Sessão expirada, faça login novamente.");
    if (resp.status === 402) throw new Error(data.error || "Créditos insuficientes.");
    if (!resp.ok) throw new Error(data.error || "Erro");
    return (data.text as string) ?? "";
  };

  const translate = async () => {
    if (!src.trim() || loading) return;
    setLoading(true);
    setOut("");
    try {
      const res = await translateText(src, from, to);
      setOut(res);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const speak = (text: string, lang: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Seu navegador não suporta áudio");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp47Of(lang);
    window.speechSynthesis.speak(u);
  };

  const startListening = async () => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome/Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    // Verifica contexto seguro (HTTPS) — necessário para mic
    if (!window.isSecureContext) {
      toast.error("Microfone requer HTTPS. Abra o app em uma URL segura.");
      return;
    }

    // Pede permissão de mic explicitamente antes do SpeechRecognition.
    // Isso resolve o "not-allowed" no Chrome quando a permissão ainda não foi concedida.
    try {
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") {
            toast.error(
              "Microfone bloqueado. Clique no cadeado da barra de endereço e permita o microfone para este site.",
            );
            return;
          }
        } catch {
          /* Safari não suporta query de microphone */
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Libera imediatamente — só queríamos disparar o prompt de permissão
      stream.getTracks().forEach((tr) => tr.stop());
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error(
          "Permissão do microfone negada. Se estiver no preview, abra em nova aba e permita o microfone.",
        );
      } else if (name === "NotFoundError") {
        toast.error("Nenhum microfone encontrado no dispositivo.");
      } else if (name === "NotReadableError") {
        toast.error("Microfone em uso por outro aplicativo.");
      } else {
        toast.error("Não foi possível acessar o microfone: " + (err?.message || name));
      }
      return;
    }

    const rec = new SR();
    rec.lang = bcp47Of(from);
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setSrc((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      const code = e?.error || "desconhecido";
      const msg =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microfone bloqueado pelo navegador. Permita o acesso e tente novamente."
          : code === "no-speech"
            ? "Nenhuma fala detectada. Tente novamente."
            : code === "audio-capture"
              ? "Microfone indisponível. Verifique seu dispositivo."
              : code === "network"
                ? "Sem conexão para reconhecimento de voz."
                : "Erro no microfone: " + code;
      toast.error(msg);
      setListening(false);
    };
    rec.onend = async () => {
      setListening(false);
      const text = (finalText || "").trim();
      if (!text) return;
      setLoading(true);
      setOut("");
      try {
        const res = await translateText(text, from, to);
        setOut(res);
        // Auto fala a tradução
        setTimeout(() => speak(res, to), 200);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <Languages className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("dash.translator")}</h1>
          <p className="text-sm text-muted-foreground">100+ idiomas com IA · fale e ouça</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-2xl border border-border bg-card/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-40 border-0 bg-transparent">
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => cameraInputRef.current?.click()}
                disabled={ocrLoading}
                title="Tirar foto e traduzir"
              >
                {ocrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                title="Enviar imagem/scanner e traduzir"
              >
                <ScanLine className="h-4 w-4" />
              </Button>
              <Button
                variant={listening ? "default" : "ghost"}
                size="icon"
                onClick={startListening}
                title="Falar"
                className={listening ? "bg-gradient-primary shadow-glow" : ""}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => speak(src, from)}
                disabled={!src}
                title="Ouvir"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageOcr(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageOcr(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <Textarea
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder={listening ? "Ouvindo..." : "Digite ou fale..."}
            rows={8}
            className="resize-none border-0 bg-transparent focus-visible:ring-0"
          />
        </div>

        <div className="flex items-center justify-center">
          <Button variant="outline" size="icon" onClick={swap} className="rounded-full">
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-gradient-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="w-40 border-0 bg-transparent">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => speak(out, to)}
              disabled={!out}
              title="Ouvir tradução"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-[200px] whitespace-pre-wrap text-sm">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Traduzindo...
              </div>
            ) : (
              out || <span className="text-muted-foreground">Tradução aparecerá aqui</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Toque no microfone para falar — traduzimos e falamos a resposta automaticamente.
        </p>
        <Button
          onClick={translate}
          disabled={loading || !src.trim()}
          className="bg-gradient-primary shadow-glow"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
          Traduzir
        </Button>
      </div>
    </div>
  );
}
