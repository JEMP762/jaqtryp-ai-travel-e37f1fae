import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Mic,
  MicOff,
  PlaneLanding,
  RotateCcw,
  ShieldAlert,
  Turtle,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authedJsonHeaders } from "@/lib/authed-fetch";
import { handleCreditError } from "@/lib/credit-error";
import { speak, stopSpeaking, useVoiceRecorder } from "@/lib/voice";
import {
  buildQuestions,
  CHECKLIST,
  DESTINATIONS,
  PURPOSES,
  type Destination,
  type Purpose,
} from "@/lib/immigration-training";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/immigration")({
  head: () => ({
    meta: [
      { title: "Treinamento de Imigração em Inglês — JAQTRYP" },
      { name: "description", content: "Simule a entrevista da imigração em inglês com áudio e avaliação da IA." },
      { property: "og:title", content: "Treinamento de Imigração em Inglês — JAQTRYP" },
      { property: "og:description", content: "Pratique as perguntas do oficial de imigração com voz e dicas de segurança." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImmigrationPage,
});

type Feedback = {
  score: number;
  verdict: "ok" | "attention" | "risk";
  feedback: string;
  risk_words: string[];
  improved: string;
  improved_pt: string;
};

function ImmigrationPage() {
  const [dest, setDest] = React.useState<Destination>("usa");
  const [purpose, setPurpose] = React.useState<Purpose>("tourism");
  const questions = React.useMemo(() => buildQuestions(dest, purpose), [dest, purpose]);
  const [idx, setIdx] = React.useState(0);
  const [showText, setShowText] = React.useState(true);
  const [answer, setAnswer] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [scores, setScores] = React.useState<Record<number, number>>({});
  const q = questions[idx];
  const officer = DESTINATIONS.find((d) => d.id === dest)!;

  const voice = useVoiceRecorder("en-US", (t) => setAnswer((a) => (a ? `${a} ${t}` : t)));

  React.useEffect(() => {
    setIdx(0);
    setScores({});
    setFeedback(null);
    setAnswer("");
  }, [dest, purpose]);

  React.useEffect(() => () => stopSpeaking(), []);

  const go = (n: number) => {
    stopSpeaking();
    setIdx(n);
    setAnswer("");
    setFeedback(null);
  };

  const evaluate = async () => {
    if (!answer.trim()) return toast.error("Responda falando ou digitando em inglês.");
    setLoading(true);
    setFeedback(null);
    try {
      const resp = await fetch("/api/immigration-feedback", {
        method: "POST",
        headers: await authedJsonHeaders(),
        body: JSON.stringify({
          question: q.en,
          answer,
          destination: officer.label,
          purpose: PURPOSES.find((p) => p.id === purpose)?.label,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (!handleCreditError({ status: resp.status, message: data.error, reason: data.code }))
          toast.error(data.error || "Não foi possível avaliar agora.");
        return;
      }
      setFeedback(data as Feedback);
      setScores((s) => ({ ...s, [idx]: Number((data as Feedback).score) || 0 }));
    } finally {
      setLoading(false);
    }
  };

  const done = Object.keys(scores).length;
  const avg = done ? Object.values(scores).reduce((a, b) => a + b, 0) / done : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
          <PlaneLanding className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Treinamento de Imigração</h1>
          <p className="text-xs text-muted-foreground">
            Pratique em inglês a entrevista com o oficial antes de desembarcar.
          </p>
        </div>
      </div>

      <Tabs defaultValue="sim" className="mt-6">
        <TabsList>
          <TabsTrigger value="sim">Simulador</TabsTrigger>
          <TabsTrigger value="guide">Guia de bolso</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="sim" className="space-y-5">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Destino</p>
            <div className="flex flex-wrap gap-2">
              {DESTINATIONS.map((d) => (
                <Chip key={d.id} active={dest === d.id} onClick={() => setDest(d.id)}>
                  {d.flag} {d.label}
                </Chip>
              ))}
            </div>
            <p className="text-xs font-medium text-muted-foreground">Motivo da viagem</p>
            <div className="flex flex-wrap gap-2">
              {PURPOSES.map((p) => (
                <Chip key={p.id} active={purpose === p.id} onClick={() => setPurpose(p.id)}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {officer.officer} · pergunta {idx + 1} de {questions.length}
              </span>
              {done > 0 && <Badge variant="secondary">Média {avg.toFixed(1)}/10</Badge>}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => speak(q.en, "en-US")} className="bg-gradient-primary shadow-glow">
                <Volume2 className="h-4 w-4" /> Ouvir o oficial
              </Button>
              <Button size="sm" variant="outline" onClick={() => speak(q.en, "en-US", 0.75)}>
                <Turtle className="h-4 w-4" /> Devagar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowText((v) => !v)}>
                {showText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showText ? "Esconder texto" : "Mostrar texto"}
              </Button>
            </div>

            {showText ? (
              <div className="mt-4">
                <p className="text-lg font-semibold">“{q.en}”</p>
                <p className="text-sm text-muted-foreground">{q.pt}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm italic text-muted-foreground">Modo desafio: ouça e responda sem ler.</p>
            )}
            <p className="mt-3 rounded-lg bg-primary/10 p-3 text-xs text-foreground">💡 {q.tip}</p>

            <div className="mt-4 flex items-end gap-2">
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Sua resposta em inglês (fale no microfone ou digite)…"
                rows={2}
              />
              <Button
                size="icon"
                variant={voice.recording ? "destructive" : "outline"}
                aria-label={voice.recording ? "Parar gravação" : "Responder falando"}
                disabled={voice.transcribing}
                onClick={async () => {
                  if (voice.recording) return voice.stop();
                  stopSpeaking();
                  const err = await voice.start();
                  if (err) toast.error("Permita o acesso ao microfone para responder falando.");
                }}
              >
                {voice.transcribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : voice.recording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </div>
            {voice.recording && <p className="mt-1 text-xs text-destructive">Gravando… toque novamente para parar.</p>}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={evaluate} disabled={loading || !answer.trim()}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Avaliar resposta
              </Button>
              <Button variant="ghost" onClick={() => setAnswer("")}>
                <RotateCcw className="h-4 w-4" /> Limpar
              </Button>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="icon" disabled={idx === 0} onClick={() => go(idx - 1)} aria-label="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={idx === questions.length - 1}
                  onClick={() => go(idx + 1)}
                  aria-label="Próxima"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {feedback && (
              <div
                className={cn(
                  "mt-5 space-y-3 rounded-xl border p-4",
                  feedback.verdict === "risk"
                    ? "border-destructive/50 bg-destructive/10"
                    : feedback.verdict === "attention"
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/40",
                )}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {feedback.verdict === "risk" ? (
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  Nota {Number(feedback.score).toFixed(1)}/10
                </div>
                <p className="text-sm">{feedback.feedback}</p>
                {feedback.risk_words?.length > 0 && (
                  <p className="text-xs text-destructive">
                    Evite: {feedback.risk_words.join(", ")}
                  </p>
                )}
                <div className="rounded-lg bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Resposta sugerida</p>
                  <p className="font-medium">{feedback.improved}</p>
                  <p className="text-xs text-muted-foreground">{feedback.improved_pt}</p>
                  <Button size="sm" variant="ghost" className="mt-1 px-2" onClick={() => speak(feedback.improved, "en-US")}>
                    <Volume2 className="h-4 w-4" /> Ouvir e repetir
                  </Button>
                </div>
                {idx < questions.length - 1 && (
                  <Button size="sm" onClick={() => go(idx + 1)}>
                    Próxima pergunta <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="guide" className="space-y-2">
          {questions.map((item, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <Button size="icon" variant="ghost" onClick={() => speak(item.en, "en-US")} aria-label="Ouvir pergunta">
                <Volume2 className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-sm">
                <p className="font-medium">{item.en}</p>
                <p className="text-xs text-muted-foreground">{item.pt}</p>
                <button
                  className="mt-1 text-left text-xs text-primary hover:underline"
                  onClick={() => speak(item.sample, "en-US")}
                >
                  ▶ Exemplo: “{item.sample}”
                </button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="docs">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Tenha em mãos na fila da imigração:</p>
            <ul className="space-y-2 text-sm">
              {CHECKLIST.map((c) => (
                <li key={c} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {c}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Regras mudam com frequência; confirme no site oficial do país antes de viajar.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
