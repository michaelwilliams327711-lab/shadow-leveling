import { Link, useLocation } from "wouter";
import { 
  Sword, 
  ScrollText, 
  Store, 
  Skull, 
  BookOpen,
  LayoutDashboard,
  BarChart2,
  TrendingDown,
  ShieldAlert,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
  { title: "Quests", href: "/quests", icon: ScrollText, shadow: false },
  { title: "Shop", href: "/shop", icon: Store, shadow: false },
  { title: "Boss Arena", href: "/arena", icon: Skull, shadow: false },
  { title: "The Awakening", href: "/awakening", icon: BookOpen, shadow: false },
  { title: "Hunter's Chronicle", href: "/analytics", icon: BarChart2, shadow: false },
  { title: "Bad Habits", href: "/bad-habits", icon: ShieldAlert, shadow: true },
  { title: "The Void", href: "/shadow", icon: TrendingDown, shadow: true },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-white/5 bg-sidebar/95 backdrop-blur-xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 border border-primary/50 shadow-[0_0_15px_rgba(124,58,237,0.3)]">
            <Sword className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-widest text-white">SHADOW</h1>
            <h2 className="font-display text-xs tracking-[0.3em] text-primary">LEVELING</h2>
          </div>
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
                                background: "rgba(239,68,68,0.12)",
                                borderColor: "rgba(239,68,68,0.35)",
                                boxShadow: "inset 0 0 10px rgba(239,68,68,0.08)",
                                color: "#ef4444",
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
                          style={isShadow && !isActive ? { color: "#7f1d1d" } : undefined}
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
    </Sidebar>
  );
}
