import { Check, Moon, Sun, Sparkles } from "lucide-react";
import { useAppearanceMode, type AppearanceMode, type AppearanceModeDef } from "@/lib/theme/AppearanceModeProvider";
import { cn } from "@/lib/utils";

const ICONS: Record<AppearanceMode, React.ElementType> = {
  dark: Moon,
  "light-sky": Sun,
  "light-peach": Sparkles,
};

export function AppearanceModeSwitcher() {
  const { mode, setMode, modes } = useAppearanceMode();

  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-6">
      <h2 className="text-lg font-semibold">Modo de aparência</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha o pano de fundo principal do sistema.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {modes.map((m) => (
          <ModeCard key={m.id} def={m} active={m.id === mode} onSelect={() => setMode(m.id)} />
        ))}
      </div>
    </div>
  );
}

function ModeCard({
  def,
  active,
  onSelect,
}: {
  def: AppearanceModeDef;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = ICONS[def.id];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col items-start gap-3 rounded-xl border bg-card/40 p-4 text-left transition-all hover:border-primary/50",
        active ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
    >
      <div
        aria-hidden
        className="flex h-16 w-full overflow-hidden rounded-lg border border-border/40 shadow-inner"
      >
        {def.swatch.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{def.name}</span>
        </div>
        {active && <Check className="h-4 w-4 text-primary" />}
      </div>
      <p className="text-xs text-muted-foreground">{def.description}</p>
    </button>
  );
}

export function AppearanceModeQuickToggle() {
  const { mode, setMode, modes } = useAppearanceMode();
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card/40 p-1">
      {modes.map((m) => {
        const Icon = ICONS[m.id];
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            type="button"
            aria-label={m.name}
            title={m.name}
            onClick={() => setMode(m.id)}
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" />
          </button>
        );
      })}
    </div>
  );
}
