import { Link, useLocation } from "wouter";
import { 
  Sword, 
  ScrollText, 
  Store, 
  ShoppingBag,
  Skull, 
  BookOpen,
  LayoutDashboard,
  TrendingDown,
  ShieldAlert,
  Scale,
  Settings,
  Lock,
} from "lucide-react";
import { useVisualSettings } from "@/context/VisualSettingsContext";
import { usePenalty } from "@/context/PenaltyContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { title: "Status", href: "/", icon: LayoutDashboard, shadow: false },
  { title: "Quests & Chronicle", href: "/quests", icon: ScrollText, shadow: false },
  { title: "Shop", href: "/shop", icon: Store, shadow: false },
  { title: "Shadow Shop", href: "/shadow-shop", icon: ShoppingBag, shadow: false },
  { title: "Boss Arena", href: "/arena", icon: Skull, shadow: false },
  { title: "The Awakening", href: "/awakening", icon: BookOpen, shadow: false },
  { title: "Scale of Souls", href: "/celestial", icon: Scale, shadow: false },
  { title: "Bad Habits", href: "/bad-habits", icon: ShieldAlert, shadow: true },
  { title: "The Void", href: "/shadow", icon: TrendingDown, shadow: true },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { setIsSettingsOpen } = useVisualSettings();
  const { penaltyActive } = usePenalty();

  return (
    <Sidebar className="border-r border-white/5 bg-sidebar/95 backdrop-blur-xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg border"
              style={
                penaltyActive
                  ? {
                      background: "rgba(80,0,0,0.4)",
                      borderColor: "rgba(180,0,0,0.5)",
                      boxShadow: "0 0 15px rgba(180,0,0,0.3)",
                    }
                  : {
                      background: "rgba(124,58,237,0.2)",
                      borderColor: "rgba(124,58,237,0.5)",
                      boxShadow: "0 0 15px rgba(124,58,237,0.3)",
                    }
              }
            >
              <Sword
                className="h-6 w-6"
                style={{ color: penaltyActive ? "#cc0000" : "hsl(var(--primary))" }}
              />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-widest text-white">SHADOW</h1>
              <h2
                className="font-display text-xs tracking-[0.3em]"
                style={{ color: penaltyActive ? "#cc0000" : "hsl(var(--primary))" }}
              >
                {penaltyActive ? "PENALTY ZONE" : "LEVELING"}
              </h2>
            </div>
          </div>
          <button
            onClick={() => !penaltyActive && setIsSettingsOpen(true)}
            disabled={penaltyActive}
            title={penaltyActive ? "Extraction process in progress. Focus on the Trial." : "Command Center"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200"
            style={
              penaltyActive
                ? {
                    background: "rgba(30,0,0,0.4)",
                    borderColor: "rgba(100,0,0,0.3)",
                    color: "rgba(100,0,0,0.5)",
                    cursor: "not-allowed",
                  }
                : {
                    background: "rgba(120,69,0,0.4)",
                    borderColor: "rgba(245,158,11,0.6)",
                    color: "rgb(251,191,36)",
                    boxShadow: "0 0 10px rgba(245,158,11,0.25)",
                  }
            }
          >
            {penaltyActive ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
          </button>
        </div>

        {penaltyActive && (
          <div
            className="mt-4 rounded border px-3 py-2 font-mono text-xs text-center"
            style={{
              borderColor: "rgba(180,0,0,0.4)",
              background: "rgba(40,0,0,0.5)",
              color: "rgba(200,0,0,0.8)",
            }}
          >
            [ PENALTY PROTOCOL ACTIVE ]
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-widest text-muted-foreground/70 mb-2">
            {penaltyActive ? "System Locked" : "System Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {penaltyActive ? (
                <>
                  <SidebarMenuItem key="/penalty-zone">
                    <SidebarMenuButton asChild isActive={true}>
                      <Link
                        href="/penalty-zone"
                        className="flex items-center gap-3 rounded-md px-3 py-2.5 border transition-all duration-200"
                        style={{
                          background: "rgba(120,0,0,0.2)",
                          borderColor: "rgba(180,0,0,0.4)",
                          boxShadow: "inset 0 0 10px rgba(100,0,0,0.1)",
                          color: "#cc0000",
                        }}
                      >
                        <Skull className="h-5 w-5" style={{ color: "#cc0000" }} />
                        <span className="font-semibold text-base tracking-wide">Trial of the Unworthy</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="flex items-center gap-3 rounded-md px-3 py-2.5 cursor-not-allowed select-none"
                            style={{ opacity: 0.25 }}
                          >
                            <item.icon className="h-5 w-5 text-muted-foreground" />
                            <span className="font-semibold text-base tracking-wide text-muted-foreground">
                              {item.title}
                            </span>
                            <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px] text-xs">
                          Extraction process in progress. Focus on the Trial.
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  ))}
                </>
              ) : (
                navItems.map((item) => {
                  const isActive = location === item.href;
                  const isShadow = item.shadow;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-all duration-200 ${
                            isActive && isShadow
                              ? "border"
                              : isActive
                              ? "bg-primary/15 text-primary border border-primary/30 shadow-[inset_0_0_10px_rgba(124,58,237,0.1)]"
                              : "text-muted-foreground hover:bg-white/5 hover:text-white"
                          }`}
                          style={
                            isActive && isShadow
                              ? {
                                  background: "hsl(var(--destructive) / 0.12)",
                                  borderColor: "hsl(var(--destructive) / 0.35)",
                                  boxShadow: "inset 0 0 10px hsl(var(--destructive) / 0.08)",
                                  color: "hsl(var(--destructive))",
                                }
                              : undefined
                          }
                        >
                          <item.icon
                            className={`h-5 w-5 ${
                              isShadow
                                ? isActive
                                  ? "text-red-500"
                                  : "text-red-700"
                                : isActive
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          />
                          <span
                            className="font-semibold text-base tracking-wide"
                            style={isShadow && !isActive ? { color: "hsl(var(--destructive) / 0.5)" } : undefined}
                          >
                            {item.title}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 pb-4">
        <button
          onClick={() => !penaltyActive && setIsSettingsOpen(true)}
          disabled={penaltyActive}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-muted-foreground transition-all duration-200 group"
          style={penaltyActive ? { opacity: 0.3, cursor: "not-allowed" } : undefined}
        >
          <Settings className="h-5 w-5 text-amber-800 group-hover:text-amber-400 transition-colors" />
          <span className="font-semibold text-base tracking-wide">Settings</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
