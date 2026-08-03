import { Eraser, Minus, Send, X } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useJaxChat } from "./useJaxChat";
import { JaxMark } from "./JaxMark";

type Props = {
  pagePath: string;
  userName?: string | null;
  onClose: () => void;
  onMinimize: () => void;
};

export function JaxPanel({ pagePath, userName, onClose, onMinimize }: Props) {
  const { messages, typing, streaming, error, ready, send, clear, suggestions } = useJaxChat(
    pagePath,
    userName,
  );
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  React.useEffect(() => {
    if (ready) inputRef.current?.focus();
  }, [ready]);

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void send(text);
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden border border-border bg-card shadow-2xl",
        "inset-0 rounded-none",
        "sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[620px] sm:max-h-[calc(100dvh-8rem)] sm:w-[400px] sm:rounded-2xl",
        "animate-in fade-in slide-in-from-bottom-4 duration-200",
      )}
      role="dialog"
      aria-label="JAX — assistente da JAQTRYP"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-gradient-primary px-4 py-3 text-primary-foreground">
        <JaxMark className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">JAX</div>
          <div className="text-[11px] opacity-90">Especialista oficial da JAQTRYP · online</div>
        </div>
        <button
          onClick={clear}
          title="Limpar conversa"
          aria-label="Limpar conversa"
          className="rounded-md p-1.5 transition hover:bg-white/15"
        >
          <Eraser className="h-4 w-4" />
        </button>
        <button
          onClick={onMinimize}
          title="Minimizar"
          aria-label="Minimizar"
          className="rounded-md p-1.5 transition hover:bg-white/15"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={onClose}
          title="Fechar"
          aria-label="Fechar"
          className="rounded-md p-1.5 transition hover:bg-white/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!ready && (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <JaxMark className="mt-0.5 h-7 w-7 shrink-0" />
              <div className="prose prose-sm max-w-[88%] text-sm leading-relaxed text-foreground dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-strong:text-foreground">
                <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
              </div>
            </div>
          ),
        )}

        {typing && (
          <div className="flex items-center gap-2.5">
            <JaxMark className="h-7 w-7 shrink-0" />
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">JAX está digitando</span>
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    style={{ animationDelay: `${d}ms` }}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        {ready && messages.length <= 1 && (
          <div className="space-y-2 pt-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Pergunte sobre a JAQTRYP..."
            rows={1}
            className="max-h-28 min-h-[42px] flex-1 resize-none text-sm"
          />
          <Button
            size="icon"
            onClick={submit}
            disabled={!input.trim() || typing || streaming}
            aria-label="Enviar"
            className="h-[42px] w-[42px] shrink-0 bg-gradient-primary"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          JAX responde apenas sobre a plataforma JAQTRYP.
        </p>
      </div>
    </div>
  );
}
