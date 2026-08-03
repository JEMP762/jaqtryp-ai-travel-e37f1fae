import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { contextualGreetingHint } from "@/lib/jax/knowledge";
import { JaxMark } from "./JaxMark";
import { JaxPanel } from "./JaxPanel";

const PHRASES = [
  "💬 Precisa de ajuda?",
  "✈️ Tire suas dúvidas com o JAX.",
  "🌍 Posso ajudar você.",
  "🤖 Fale comigo.",
  "💡 Posso ensinar como usar esta tela.",
  "✨ Precisa de ajuda com esta função?",
];

export function JaxLauncher() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [phraseIdx, setPhraseIdx] = React.useState(0);
  const [bubble, setBubble] = React.useState(true);
  const [proactive, setProactive] = React.useState<string | null>(null);
  const seenRef = React.useRef<Set<string>>(new Set());

  const firstName = React.useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const full = (meta.full_name || meta.name || user?.email || "") as string;
    return full.split(/[\s@]/)[0] || null;
  }, [user]);

  // Rotação das chamadas do botão
  React.useEffect(() => {
    if (open) return;
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 8000);
    return () => clearInterval(id);
  }, [open]);

  // Dica contextual discreta: uma vez por rota, após inatividade
  React.useEffect(() => {
    setProactive(null);
    if (open || seenRef.current.has(path)) return;
    const id = setTimeout(() => {
      const hint = contextualGreetingHint(path);
      if (!hint) return;
      seenRef.current.add(path);
      setProactive(hint.replace(/\*\*/g, ""));
      setBubble(true);
    }, 45000);
    return () => clearTimeout(id);
  }, [path, open]);

  React.useEffect(() => setMounted(true), []);
  if (!mounted || !user) return null;

  return (
    <>
      {!open && (
        <div className="fixed bottom-5 right-4 z-40 flex items-end gap-2 sm:bottom-6 sm:right-6">
          {bubble && (
            <div className="relative mb-1.5 max-w-[190px] rounded-2xl rounded-br-sm border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
              {proactive ?? PHRASES[phraseIdx]}
              <button
                onClick={() => setBubble(false)}
                aria-label="Ocultar aviso"
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-border bg-background text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir o assistente JAX"
            className="relative grid h-14 w-14 place-items-center rounded-full bg-gradient-primary shadow-glow transition-transform hover:scale-105 active:scale-95"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
            <JaxMark className="relative h-14 w-14 rounded-full shadow-none" />
          </button>
        </div>
      )}

      {open && (
        <JaxPanel
          pagePath={path}
          userName={firstName}
          onClose={() => setOpen(false)}
          onMinimize={() => setOpen(false)}
        />
      )}
    </>
  );
}
