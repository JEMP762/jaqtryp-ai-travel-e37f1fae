import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
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

const POS_KEY = "jax:mobile-offset";
const MIN_OFFSET = 72; // distância mínima do rodapé (px)
const MAX_OFFSET = 420;

export function JaxLauncher() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [phraseIdx, setPhraseIdx] = React.useState(0);
  const [bubble, setBubble] = React.useState(true);
  const [proactive, setProactive] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const [typing, setTyping] = React.useState(false);
  const [offset, setOffset] = React.useState(MIN_OFFSET);
  const seenRef = React.useRef<Set<string>>(new Set());
  const dragRef = React.useRef<{ startY: number; startOffset: number; moved: boolean } | null>(null);

  const firstName = React.useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const full = (meta.full_name || meta.name || user?.email || "") as string;
    return full.split(/[\s@]/)[0] || null;
  }, [user]);

  // Rotação das chamadas do botão (apenas desktop)
  React.useEffect(() => {
    if (open || isMobile) return;
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 8000);
    return () => clearInterval(id);
  }, [open, isMobile]);

  // Dica contextual discreta: uma vez por rota, após inatividade (apenas desktop)
  React.useEffect(() => {
    setProactive(null);
    if (open || isMobile || seenRef.current.has(path)) return;
    const id = setTimeout(() => {
      const hint = contextualGreetingHint(path);
      if (!hint) return;
      seenRef.current.add(path);
      setProactive(hint.replace(/\*\*/g, ""));
      setBubble(true);
    }, 45000);
    return () => clearTimeout(id);
  }, [path, open, isMobile]);

  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = Number(localStorage.getItem(POS_KEY));
      if (saved) setOffset(Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, saved)));
    } catch {
      /* ignore */
    }
  }, []);

  // Recolhe enquanto o usuário rola a página (mobile)
  React.useEffect(() => {
    if (!isMobile || open) return;
    let last = window.scrollY;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > last + 6) setCollapsed(true);
      else if (y < last - 6) setCollapsed(false);
      last = y;
      clearTimeout(timer);
      timer = setTimeout(() => setCollapsed(false), 1200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [isMobile, open]);

  // Some enquanto o usuário digita em um campo (teclado aberto no mobile)
  React.useEffect(() => {
    if (!isMobile) return;
    const check = () => {
      const el = document.activeElement;
      const tag = el?.tagName?.toLowerCase();
      setTyping(
        tag === "input" ||
          tag === "textarea" ||
          (el instanceof HTMLElement && el.isContentEditable === true),
      );
    };
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, [isMobile]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isMobile) return;
    dragRef.current = { startY: e.clientY, startOffset: offset, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = d.startY - e.clientY;
    if (Math.abs(delta) > 6) d.moved = true;
    setOffset(Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, d.startOffset + delta)));
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      try {
        localStorage.setItem(POS_KEY, String(offset));
      } catch {
        /* ignore */
      }
    } else {
      setOpen(true);
    }
  };

  if (!mounted || !user) return null;

  const hiddenOnMobile = isMobile && (typing || path.startsWith("/live-room"));
  const showBubble = !isMobile && bubble;

  return (
    <>
      {!open && !hiddenOnMobile && (
        <div
          className="fixed z-40 flex items-end gap-2"
          style={
            isMobile
              ? { right: collapsed ? -14 : 8, bottom: offset, transition: "right 200ms ease" }
              : { right: 24, bottom: 24 }
          }
        >
          {showBubble && (
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
            onClick={() => {
              if (!isMobile) setOpen(true);
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            aria-label="Abrir o assistente JAX"
            style={{ touchAction: "none" }}
            className={
              isMobile
                ? `relative grid h-10 w-10 place-items-center rounded-full bg-gradient-primary shadow-lg transition-opacity active:scale-95 ${
                    collapsed ? "opacity-50" : "opacity-100"
                  }`
                : "relative grid h-14 w-14 place-items-center rounded-full bg-gradient-primary shadow-glow transition-transform hover:scale-105 active:scale-95"
            }
          >
            {!isMobile && (
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
            )}
            <JaxMark
              className={
                isMobile
                  ? "relative h-10 w-10 rounded-full shadow-none"
                  : "relative h-14 w-14 rounded-full shadow-none"
              }
            />
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
