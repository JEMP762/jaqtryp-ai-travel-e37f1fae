import { createFileRoute } from "@tanstack/react-router";
import { Send, Sparkles, User2 } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { authedJsonHeaders } from "@/lib/authed-fetch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string };
type Profile = "economico" | "mochileiro" | "conforto" | "premium" | "luxo";

function ChatPage() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile>("conforto");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    // Small human-like "thinking" delay before the assistant starts typing
    const thinkMs = 700 + Math.floor(Math.random() * 900);
    await new Promise((r) => setTimeout(r, thinkMs));

    const profileHint: Msg = {
      role: "user",
      content: `[Contexto JAQ Price] Perfil de viagem do usuário: ${profile}. Adapte recomendações de preço, hospedagem e gastos a esse perfil. Responda em tom natural, humano e amigável, como um amigo viajante experiente — evite soar robótico.`,
    };
    const payloadMessages = [profileHint, ...next];

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: await authedJsonHeaders(),
        body: JSON.stringify({ messages: payloadMessages, lang }),
      });

      if (!resp.ok || !resp.body) {
        const data = await resp.json().catch(() => ({}));
        toast.error(data.error || t("common.error"));
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buffer += decoder.decode(r.value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) upsert(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    } finally {
      setStreaming(false);
    }
  };

  const suggestions =
    lang === "pt"
      ? [
          "💰 Esse preço é justo? Café da manhã €28 perto da Torre Eiffel",
          "🚖 Táxi do aeroporto de Roma ao centro por €70 — armadilha?",
          "🍝 Cardápio em 5 idiomas em Veneza, prato a €35. Vale?",
          "🏨 Hotel R$ 1.200/noite em Buenos Aires — está caro?",
          "Roteiro de 5 dias em Lisboa com €1500",
          "Melhor época para visitar a Patagônia",
        ]
      : [
          "💰 Is this fair? €28 breakfast near the Eiffel Tower",
          "🚖 €70 taxi from Rome airport to downtown — trap?",
          "🍝 5-language menu in Venice, €35 a plate. Worth it?",
          "🏨 $240/night hotel in Buenos Aires — too expensive?",
          "5-day itinerary in Lisbon with €1500",
          "Best time to visit Patagonia",
        ];

  const profiles: { id: Profile; label: string }[] =
    lang === "pt"
      ? [
          { id: "economico", label: "💸 Econômico" },
          { id: "mochileiro", label: "🎒 Mochileiro" },
          { id: "conforto", label: "🛋️ Conforto" },
          { id: "premium", label: "✨ Premium" },
          { id: "luxo", label: "👑 Luxo" },
        ]
      : [
          { id: "economico", label: "💸 Budget" },
          { id: "mochileiro", label: "🎒 Backpacker" },
          { id: "conforto", label: "🛋️ Comfort" },
          { id: "premium", label: "✨ Premium" },
          { id: "luxo", label: "👑 Luxury" },
        ];

  return (
    <div className="mx-auto flex h-[100dvh] max-w-4xl flex-col px-4 md:px-8">
      <div className="border-b border-border py-4">
        <h1 className="text-xl font-semibold">{t("dash.chat")}</h1>
        <p className="text-xs text-muted-foreground">
          {t("hero.badge")} · <span className="text-primary">JAQ Price</span>{" "}
          {lang === "pt" ? "ativo" : "active"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setProfile(p.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                profile === p.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="rounded-xl border border-border bg-card/50 p-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                m.role === "user"
                  ? "bg-primary/15 text-primary"
                  : "bg-gradient-primary text-primary-foreground shadow-glow",
              )}
            >
              {m.role === "user" ? <User2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                m.role === "user"
                  ? "bg-primary/10 text-foreground"
                  : "border border-border bg-card",
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1">
                  <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {streaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background/80 py-4 backdrop-blur">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={lang === "pt" ? "Pergunte qualquer coisa..." : "Ask anything..."}
            rows={1}
            className="min-h-[40px] resize-none border-0 bg-transparent focus-visible:ring-0"
          />
          <Button
            onClick={send}
            disabled={streaming || !input.trim()}
            size="icon"
            className="bg-gradient-primary shadow-glow"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
