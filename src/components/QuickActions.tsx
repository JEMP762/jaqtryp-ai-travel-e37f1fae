import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  MessageSquare,
  Languages,
  Mic,
  FileText,
  Plane,
  Coins,
} from "lucide-react";

const ACTIONS = [
  { to: "/planner", icon: Sparkles, label: "Roteiro IA" },
  { to: "/chat", icon: MessageSquare, label: "Chat IA" },
  { to: "/translator", icon: Languages, label: "Tradutor" },
  { to: "/live-translator", icon: Mic, label: "Live Translator" },
  { to: "/file-translator", icon: FileText, label: "Arquivos" },
  { to: "/flights", icon: Plane, label: "Voos" },
  { to: "/credits", icon: Coins, label: "Recarregar" },
] as const;

export function QuickActions() {
  return (
    <section aria-label="Ações rápidas">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Ações rápidas
      </h2>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-4 md:overflow-visible lg:grid-cols-7">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.to}
              to={a.to}
              className="group flex min-w-[92px] shrink-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-3 text-center transition-all hover:border-primary/50 hover:shadow-glow md:min-w-0"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-medium leading-tight">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
