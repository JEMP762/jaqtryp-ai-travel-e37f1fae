import { Check } from "lucide-react";
import { useTheme, type ThemeDef } from "@/lib/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-6">
      <h2 className="text-lg font-semibold">Cor do tema</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha a cor de destaque que será aplicada em todo o sistema.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {themes.map((t) => (
          <ThemeCard
            key={t.id}
            def={t}
            active={t.id === theme}
            onSelect={() => setTheme(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  def,
  active,
  onSelect,
}: {
  def: ThemeDef;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col items-start gap-3 rounded-xl border bg-card/40 p-4 text-left transition-all hover:border-primary/50",
        active ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
    >
      <span
        aria-hidden
        className="h-10 w-full rounded-lg shadow-inner"
        style={{ backgroundImage: `linear-gradient(135deg, ${def.swatch.from}, ${def.swatch.to})` }}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{def.name}</span>
          {active && <Check className="h-3.5 w-3.5 text-primary" />}
        </div>
        <p className="truncate text-xs text-muted-foreground">{def.description}</p>
      </div>
    </button>
  );
}

export function ThemeQuickSwatches() {
  const { theme, setTheme, themes } = useTheme();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {themes.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-label={`Tema ${t.name}`}
          title={t.name}
          onClick={() => setTheme(t.id)}
          className={cn(
            "h-5 w-5 rounded-full border transition-transform hover:scale-110",
            t.id === theme ? "border-primary ring-2 ring-primary/60" : "border-border/60",
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, ${t.swatch.from}, ${t.swatch.to})`,
          }}
        />
      ))}
    </div>
  );
}
