import { Link, useLocation } from "wouter";
import { 
  Sword, 
  ScrollText, 
  Store, 
  Skull, 
  BookOpen,
  LayoutDashboard,
  TrendingDown,
  ShieldAlert,
  Layers,
  Scale,
  Settings,
} from "lucide-react";
import { useVisualSettings } from "@/context/VisualSettingsContext";
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

const navItems = [
  { title: "Status", href: "/", icon: LayoutDashboard, shadow: false },
  { title: "Quests & Chronicle", href: "/quests", icon: ScrollText, shadow: false },
  { title: "Vocation Paths", href: "/vocations", icon: Layers, shadow: false },
  { title: "Shop", href: "/shop", icon: Store, shadow: false },
  { title: "Boss Arena", href: "/arena", icon: Skull, shadow: false },
  { title: "The Awakening", href: "/awakening", icon: BookOpen, shadow: false },
  { title: "Scale of Souls", href: "/celestial", icon: Scale, shadow: false },
  { title: "Bad Habits", href: "/bad-habits", icon: ShieldAlert, shadow: true },
  { title: "The Void", href: "/shadow", icon: TrendingDown, shadow: true },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { setIsSettingsOpen } = useVisualSettings();

  return (
    <Sidebar className="border-r border-white/5 bg-sidebar/95 backdrop-blur-xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 border border-primary/50 shadow-[0_0_15px_rgba(124,58,237,0.3)]">
              <Sword className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-widest text-white">SHADOW</h1>
              <h2 className="font-display text-xs tracking-[0.3em] text-primary">LEVELING</h2>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Command Center"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/60 bg-amber-900/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)] hover:bg-amber-800/60 hover:text-amber-200 hover:shadow-[0_0_14px_rgba(245,158,11,0.45)] hover:border-amber-400/80 transition-all duration-200"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-widest text-muted-foreground/70 mb-2">
            System Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navItems.map((item) => {
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
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 pb-4">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-muted-foreground hover:bg-amber-900/20 hover:text-amber-300 transition-all duration-200 group"
        >
          <Settings className="h-5 w-5 text-amber-800 group-hover:text-amber-400 transition-colors" />
          <span className="font-semibold text-base tracking-wide">Settings</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
