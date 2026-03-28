import { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PenaltyModal } from "@/components/PenaltyModal";
import {
  characterLogin,
  processOverdueQuests,
  getGetCharacterQueryKey,
  getListQuestsQueryKey,
} from "@workspace/api-client-react";

// Pages
import Dashboard from "@/pages/Dashboard";
import Quests from "@/pages/Quests";
import Shop from "@/pages/Shop";
import BossArena from "@/pages/BossArena";
import Awakening from "@/pages/Awakening";
import AnalyticsDashboard from "@/pages/AnalyticsDashboard";
import NotFound from "@/pages/not-found";

const heroBgImg = "/images/hero-bg.png";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

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
        const loginResult = await characterLogin();
        const overdueResult = await processOverdueQuests();

        const allPenalties: PenaltyEvent[] = [
          ...(loginResult.penalties ?? []),
          ...(overdueResult.penalties ?? []),
        ];

        if (allPenalties.length > 0) {
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListQuestsQueryKey() });
          onPenalties(allPenalties);
        }
      } catch {
        // silently ignore startup check errors
      }
    };

    runChecks();
  }, [onPenalties]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/quests" component={Quests} />
      <Route path="/shop" component={Shop} />
      <Route path="/arena" component={BossArena} />
      <Route path="/awakening" component={Awakening} />
      <Route path="/analytics" component={AnalyticsDashboard} />
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

  return (
    <QueryClientProvider client={queryClient}>
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
                  <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                    <Router />
                  </WouterRouter>
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
          <PenaltyChecker onPenalties={setPenalties} />
          {penalties.length > 0 && (
            <PenaltyModal
              penalties={penalties}
              onDismiss={() => setPenalties([])}
            />
          )}
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
