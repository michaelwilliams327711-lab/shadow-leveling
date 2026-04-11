import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface VisualSettings {
  amberGlow: number;
  amberDensity: number;
  amberFlicker: number;
  isSettingsOpen: boolean;
  setAmberGlow: (v: number) => void;
  setAmberDensity: (v: number) => void;
  setAmberFlicker: (v: number) => void;
  setIsSettingsOpen: (v: boolean) => void;
}

const LS_KEY = "sl-visual-settings";

function loadFromStorage(): { amberGlow: number; amberDensity: number; amberFlicker: number } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { amberGlow: 15, amberDensity: 1.0, amberFlicker: 0.3 };
    const parsed = JSON.parse(raw);
    return {
      amberGlow: typeof parsed.amberGlow === "number" ? parsed.amberGlow : 15,
      amberDensity: typeof parsed.amberDensity === "number" ? parsed.amberDensity : 1.0,
      amberFlicker: typeof parsed.amberFlicker === "number" ? parsed.amberFlicker : 0.3,
    };
  } catch {
    return { amberGlow: 15, amberDensity: 1.0, amberFlicker: 0.3 };
  }
}

const VisualSettingsContext = createContext<VisualSettings | null>(null);

export function VisualSettingsProvider({ children }: { children: ReactNode }) {
  const stored = loadFromStorage();
  const [amberGlow, setAmberGlowRaw] = useState(stored.amberGlow);
  const [amberDensity, setAmberDensityRaw] = useState(stored.amberDensity);
  const [amberFlicker, setAmberFlickerRaw] = useState(stored.amberFlicker);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ amberGlow, amberDensity, amberFlicker }));
    } catch {}
  }, [amberGlow, amberDensity, amberFlicker]);

  const setAmberGlow = useCallback((v: number) => setAmberGlowRaw(v), []);
  const setAmberDensity = useCallback((v: number) => setAmberDensityRaw(v), []);
  const setAmberFlicker = useCallback((v: number) => setAmberFlickerRaw(v), []);

  return (
    <VisualSettingsContext.Provider
      value={{ amberGlow, amberDensity, amberFlicker, isSettingsOpen, setAmberGlow, setAmberDensity, setAmberFlicker, setIsSettingsOpen }}
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
