import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const LS_KEY = "sl-penalty-active";

interface PenaltyContextValue {
  penaltyActive: boolean;
  activatePenalty: () => void;
  clearPenalty: () => void;
}

const PenaltyContext = createContext<PenaltyContextValue | null>(null);

export function PenaltyProvider({ children }: { children: ReactNode }) {
  const [penaltyActive, setPenaltyActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_KEY) === "true";
    } catch {
      return false;
    }
  });

  const activatePenalty = useCallback(() => {
    try { localStorage.setItem(LS_KEY, "true"); } catch {}
    setPenaltyActive(true);
  }, []);

  const clearPenalty = useCallback(() => {
    try { localStorage.removeItem(LS_KEY); } catch {}
    setPenaltyActive(false);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "PENALTY_ACTIVE") {
        activatePenalty();
      }
    }
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [activatePenalty]);

  return (
    <PenaltyContext.Provider value={{ penaltyActive, activatePenalty, clearPenalty }}>
      {children}
    </PenaltyContext.Provider>
  );
}

export function usePenalty(): PenaltyContextValue {
  const ctx = useContext(PenaltyContext);
  if (!ctx) throw new Error("usePenalty must be used within PenaltyProvider");
  return ctx;
}
