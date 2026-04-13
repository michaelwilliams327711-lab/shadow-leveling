import { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { VisualSettingsProvider } from "@/context/VisualSettingsContext";
import { PenaltyProvider, usePenalty } from "@/context/PenaltyContext";
import { PenaltyModal } from "@/components/PenaltyModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { toast } from "@/hooks/use-toast";
import { initAudioContext } from "@/lib/sounds";
import {
  characterLogin,
  processOverdueQuests,
  getGetCharacterQueryKey,
  getListQuestsWindowedQueryKey,
  getDailyOrdersTodayQueryKey,
  customFetch,
} from "@workspace/api-client-react";

// Pages
import Dashboard from "@/pages/Dashboard";
import Quests from "@/pages/Quests";
import Shop from "@/pages/Shop";
import BossArena from "@/pages/BossArena";
import Awakening from "@/pages/Awakening";
import ShadowDashboard from "@/pages/ShadowDashboard";
import BadHabits from "@/pages/BadHabits";
import CelestialDuel from "@/pages/CelestialDuel";
import PenaltyZone from "@/pages/PenaltyZone";
import NotFound from "@/pages/not-found";

const heroBgImg = "/images/hero-bg.webp";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function getLocalDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

interface PenaltyEvent {
  type: string;
  description: string;
  xpDeducted: number;
  goldDeducted: number;
  occurredAt: string;
}

function PenaltyChecker({ onPenalties }: { onPenalties: (p: PenaltyEvent[]) => void }) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const runChecks = async () => {
      try {
        const localDate = getLocalDateStr();
        const headers = { "x-local-date": localDate };

        const [loginResult, overdueResult] = await Promise.all([
          characterLogin({ headers }),
          processOverdueQuests({ headers }),
        ]);

        const allPenalties: PenaltyEvent[] = [
          ...(loginResult.penalties ?? []),
          ...(overdueResult.penalties ?? []),
        ];

        if (allPenalties.length > 0) {
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListQuestsWindowedQueryKey() });
          onPenalties(allPenalties);
        }

        customFetch<unknown>("/api/daily-orders/expire-stale", { method: "POST", headers }).then(() => {
          queryClient.invalidateQueries({ queryKey: getDailyOrdersTodayQueryKey() });
        }).catch(() => {});

      } catch {
        // silently ignore startup check errors
      }
    };

    runChecks();
  }, [onPenalties]);

  return null;
}

function DayChangeDetector() {
  const lastViewedDate = useRef<string>(getLocalDateStr());

  useEffect(() => {
    const intervalId = setInterval(() => {
      const today = getLocalDateStr();
      if (today !== lastViewedDate.current) {
        lastViewedDate.current = today;

        queryClient.invalidateQueries({ queryKey: getListQuestsWindowedQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });

        toast({
          title: "[SYSTEM] A new day has begun.",
          description: "Daily quests have been reset.",
          duration: 6000,
        });
      }
    }, 60_000);

    return () => clearInterval(intervalId);
  }, []);

  return null;
}

/**
 * Router-level penalty guard. If penalty is active, ALL routes except /penalty-zone
 * immediately redirect — no useEffect lag, no flash of the wrong page.
 */
function Router() {
  const { penaltyActive } = usePenalty();
  const [location] = useLocation();

  if (penaltyActive && location !== "/penalty-zone") {
    return (
      <Switch>
        <Route path="/penalty-zone" component={PenaltyZone} />
        <Route><Redirect to="/penalty-zone" /></Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/penalty-zone" component={PenaltyZone} />
      <Route path="/" component={Dashboard} />
      <Route path="/quests" component={Quests} />
      <Route path="/shop" component={Shop} />
      <Route path="/arena" component={BossArena} />
      <Route path="/awakening" component={Awakening} />
      <Route path="/analytics"><Redirect to="/quests" /></Route>
      <Route path="/shadow" component={ShadowDashboard} />
      <Route path="/bad-habits" component={BadHabits} />
      <Route path="/vocations"><Redirect to="/" /></Route>
      <Route path="/celestial" component={CelestialDuel} />
      <Route path="/planner"><Redirect to="/quests" /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [penalties, setPenalties] = useState<PenaltyEvent[]>([]);

  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  // Initialize AudioContext on first user gesture — required for Safari/Chrome mobile
  const handleFirstGesture = () => {
    initAudioContext();
    document.removeEventListener("click", handleFirstGesture);
    document.removeEventListener("touchstart", handleFirstGesture);
  };

  useEffect(() => {
    document.addEventListener("click", handleFirstGesture);
    document.addEventListener("touchstart", handleFirstGesture);
    return () => {
      document.removeEventListener("click", handleFirstGesture);
      document.removeEventListener("touchstart", handleFirstGesture);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PenaltyProvider>
      <VisualSettingsProvider>
      <TooltipProvider>
        <div className="dark min-h-screen bg-background text-foreground selection:bg-primary/30">
          <div
            className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-screen"
            style={{ backgroundImage: `url(${heroBgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <SidebarProvider style={sidebarStyle}>
            <div className="flex h-screen w-full relative z-10">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center p-4 border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-20 md:hidden">
                  <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
                  <span className="ml-4 font-display font-bold tracking-widest text-primary">SYSTEM OVERRIDE</span>
                </header>
                <main className="flex-1 overflow-y-auto scroll-smooth">
                  <ErrorBoundary>
                    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                      <Router />
                    </WouterRouter>
                  </ErrorBoundary>
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
          <PenaltyChecker onPenalties={setPenalties} />
          <DayChangeDetector />
          {penalties.length > 0 && (
            <PenaltyModal
              penalties={penalties}
              onDismiss={() => setPenalties([])}
            />
          )}
        </div>
        <SettingsDrawer />
      </TooltipProvider>
      </VisualSettingsProvider>
      </PenaltyProvider>
    </QueryClientProvider>
  );
}

export default App;
