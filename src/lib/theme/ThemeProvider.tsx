import * as React from "react";

export type ThemeId =
  | "neon-blue"
  | "sky"
  | "violet"
  | "emerald"
  | "sunset"
  | "rose"
  | "slate";

export type ThemeDef = {
  id: ThemeId;
  name: string;
  description: string;
  swatch: { from: string; to: string };
};

export const THEMES: ThemeDef[] = [
  {
    id: "neon-blue",
    name: "Neon Blue",
    description: "Padrão futurista Jaqtryp",
    swatch: { from: "oklch(0.7 0.22 240)", to: "oklch(0.78 0.2 220)" },
  },
  {
    id: "sky",
    name: "Azul Claro",
    description: "Céu sereno e luminoso",
    swatch: { from: "oklch(0.82 0.13 230)", to: "oklch(0.9 0.09 210)" },
  },
  {
    id: "violet",
    name: "Violeta",
    description: "Sofisticado e elétrico",
    swatch: { from: "oklch(0.68 0.22 295)", to: "oklch(0.76 0.18 320)" },
  },
  {
    id: "emerald",
    name: "Esmeralda",
    description: "Energia natural",
    swatch: { from: "oklch(0.72 0.18 160)", to: "oklch(0.8 0.16 175)" },
  },
  {
    id: "sunset",
    name: "Pôr do Sol",
    description: "Coral quente",
    swatch: { from: "oklch(0.72 0.19 40)", to: "oklch(0.78 0.18 60)" },
  },
  {
    id: "rose",
    name: "Rosa",
    description: "Vibrante e marcante",
    swatch: { from: "oklch(0.7 0.2 10)", to: "oklch(0.78 0.17 340)" },
  },
  {
    id: "slate",
    name: "Grafite",
    description: "Neutro elegante",
    swatch: { from: "oklch(0.65 0.04 255)", to: "oklch(0.78 0.03 245)" },
  },
];

type Ctx = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  themes: ThemeDef[];
};

const ThemeContext = React.createContext<Ctx | null>(null);
const STORAGE_KEY = "jq_theme";
const DEFAULT_THEME: ThemeId = "neon-blue";

function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeId>(DEFAULT_THEME);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved && THEMES.some((t) => t.id === saved)) {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      applyTheme(DEFAULT_THEME);
    }
  }, []);

  const setTheme = React.useCallback((t: ThemeId) => {
    setThemeState(t);
    applyTheme(t);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const value = React.useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
