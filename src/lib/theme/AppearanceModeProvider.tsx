import * as React from "react";

export type AppearanceMode = "dark" | "light-sky" | "light-peach";

export type AppearanceModeDef = {
  id: AppearanceMode;
  name: string;
  description: string;
  swatch: string[];
};

export const APPEARANCE_MODES: AppearanceModeDef[] = [
  {
    id: "dark",
    name: "Escuro",
    description: "Visual padrão Jaqtryp",
    swatch: ["#0e1424", "#1a2238", "#2a3656"],
  },
  {
    id: "light-sky",
    name: "Claro Azul",
    description: "Branco com toque de céu",
    swatch: ["#ffffff", "#eaf4ff", "#bcdcff"],
  },
  {
    id: "light-peach",
    name: "Claro Pêssego",
    description: "Branco creme estilo Lovable",
    swatch: ["#fff8f3", "#ffe8d6", "#ffd0b0"],
  },
];

type Ctx = {
  mode: AppearanceMode;
  setMode: (m: AppearanceMode) => void;
  modes: AppearanceModeDef[];
};

const ModeContext = React.createContext<Ctx | null>(null);
const STORAGE_KEY = "jq_appearance_mode";
const DEFAULT_MODE: AppearanceMode = "dark";

function applyMode(m: AppearanceMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-mode", m);
}

export function AppearanceModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<AppearanceMode>(DEFAULT_MODE);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as AppearanceMode | null;
    if (saved && APPEARANCE_MODES.some((m) => m.id === saved)) {
      setModeState(saved);
      applyMode(saved);
    } else {
      applyMode(DEFAULT_MODE);
    }
  }, []);

  const setMode = React.useCallback((m: AppearanceMode) => {
    setModeState(m);
    applyMode(m);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, m);
  }, []);

  const value = React.useMemo(() => ({ mode, setMode, modes: APPEARANCE_MODES }), [mode, setMode]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useAppearanceMode() {
  const ctx = React.useContext(ModeContext);
  if (!ctx) throw new Error("useAppearanceMode must be used within AppearanceModeProvider");
  return ctx;
}
