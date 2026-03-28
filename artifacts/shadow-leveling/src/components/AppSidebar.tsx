import { Link, useLocation } from "wouter";
import { 
  Sword, 
  ScrollText, 
  Store, 
  Skull, 
  BookOpen,
  LayoutDashboard,
  BarChart2,
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
  { title: "Status", href: "/", icon: LayoutDashboard },
  { title: "Quests", href: "/quests", icon: ScrollText },
  { title: "Shop", href: "/shop", icon: Store },
  { title: "Boss Arena", href: "/arena", icon: Skull },
  { title: "The Awakening", href: "/awakening", icon: BookOpen },
  { title: "Analytics", href: "/analytics", icon: BarChart2 },
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
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link 
                        href={item.href}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-all duration-200 ${
                          isActive 
                            ? "bg-primary/15 text-primary border border-primary/30 shadow-[inset_0_0_10px_rgba(124,58,237,0.1)]" 
                            : "text-muted-foreground hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="font-semibold text-base tracking-wide">{item.title}</span>
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
