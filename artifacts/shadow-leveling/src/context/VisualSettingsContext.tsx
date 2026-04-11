import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type CorruptionTheme = "amber" | "blood" | "toxic" | "void";

interface VisualSettings {
  amberGlow: number;
  amberDensity: number;
  amberFlicker: number;
  amberSize: number;
  amberOpacity: number;
  corruptionTheme: CorruptionTheme;
  isSettingsOpen: boolean;
  setAmberGlow: (v: number) => void;
  setAmberDensity: (v: number) => void;
  setAmberFlicker: (v: number) => void;
  setAmberSize: (v: number) => void;
  setAmberOpacity: (v: number) => void;
  setCorruptionTheme: (v: CorruptionTheme) => void;
  setIsSettingsOpen: (v: boolean) => void;
}

const LS_KEY = "sl-visual-settings";

const VALID_THEMES: CorruptionTheme[] = ["amber", "blood", "toxic", "void"];

function loadFromStorage(): { amberGlow: number; amberDensity: number; amberFlicker: number; amberSize: number; amberOpacity: number; corruptionTheme: CorruptionTheme } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { amberGlow: 15, amberDensity: 1.0, amberFlicker: 0.3, amberSize: 1.0, amberOpacity: 0.9, corruptionTheme: "amber" };
    const parsed = JSON.parse(raw);
    return {
      amberGlow: typeof parsed.amberGlow === "number" ? parsed.amberGlow : 15,
      amberDensity: typeof parsed.amberDensity === "number" ? parsed.amberDensity : 1.0,
      amberFlicker: typeof parsed.amberFlicker === "number" ? parsed.amberFlicker : 0.3,
      amberSize: typeof parsed.amberSize === "number" ? parsed.amberSize : 1.0,
      amberOpacity: typeof parsed.amberOpacity === "number" ? parsed.amberOpacity : 0.9,
      corruptionTheme: VALID_THEMES.includes(parsed.corruptionTheme) ? parsed.corruptionTheme : "amber",
    };
  } catch {
    return { amberGlow: 15, amberDensity: 1.0, amberFlicker: 0.3, amberSize: 1.0, amberOpacity: 0.9, corruptionTheme: "amber" };
  }
}

const VisualSettingsContext = createContext<VisualSettings | null>(null);

export function VisualSettingsProvider({ children }: { children: ReactNode }) {
  const stored = loadFromStorage();
  const [amberGlow, setAmberGlowRaw] = useState(stored.amberGlow);
  const [amberDensity, setAmberDensityRaw] = useState(stored.amberDensity);
  const [amberFlicker, setAmberFlickerRaw] = useState(stored.amberFlicker);
  const [amberSize, setAmberSizeRaw] = useState(stored.amberSize);
  const [amberOpacity, setAmberOpacityRaw] = useState(stored.amberOpacity);
  const [corruptionTheme, setCorruptionThemeRaw] = useState<CorruptionTheme>(stored.corruptionTheme);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ amberGlow, amberDensity, amberFlicker, amberSize, amberOpacity, corruptionTheme }));
    } catch {}
  }, [amberGlow, amberDensity, amberFlicker, amberSize, amberOpacity, corruptionTheme]);

  const setAmberGlow = useCallback((v: number) => setAmberGlowRaw(v), []);
  const setAmberDensity = useCallback((v: number) => setAmberDensityRaw(v), []);
  const setAmberFlicker = useCallback((v: number) => setAmberFlickerRaw(v), []);
  const setAmberSize = useCallback((v: number) => setAmberSizeRaw(v), []);
  const setAmberOpacity = useCallback((v: number) => setAmberOpacityRaw(v), []);
  const setCorruptionTheme = useCallback((v: CorruptionTheme) => setCorruptionThemeRaw(v), []);

  return (
    <VisualSettingsContext.Provider
      value={{ amberGlow, amberDensity, amberFlicker, amberSize, amberOpacity, corruptionTheme, isSettingsOpen, setAmberGlow, setAmberDensity, setAmberFlicker, setAmberSize, setAmberOpacity, setCorruptionTheme, setIsSettingsOpen }}
    >
      {children}
    </VisualSettingsContext.Provider>
  );
}

export function useVisualSettings(): VisualSettings {
  const ctx = useContext(VisualSettingsContext);
  if (!ctx) throw new Error("useVisualSettings must be used within VisualSettingsProvider");
  return ctx;
}
