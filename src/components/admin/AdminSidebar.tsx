import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Dumbbell, LogOut, SlidersHorizontal, Mail, Globe, CreditCard, BarChart3, MailOpen } from "lucide-react";
import type { AdminSection } from "@/pages/Admin";

interface Props {
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
  userCount: number;
  onSignOut: () => void;
}

const NAV_ITEMS: { title: string; section: AdminSection; icon: typeof LayoutDashboard }[] = [
  { title: "Dashboard", section: "dashboard", icon: LayoutDashboard },
  { title: "Métricas", section: "metrics", icon: BarChart3 },
  { title: "Usuarios", section: "users", icon: Users },
  { title: "Recordatorios", section: "reminders", icon: Mail },
  { title: "Ejercicios", section: "exercises", icon: Dumbbell },
  { title: "Reglas", section: "rules", icon: SlidersHorizontal },
  { title: "Landing", section: "landing", icon: Globe },
  { title: "Emails", section: "emails", icon: MailOpen },
  { title: "Pagos", section: "payments", icon: CreditCard },
];

const AdminSidebar = ({ section, onNavigate, userCount, onSignOut }: Props) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="p-4 border-b border-sidebar-border">
          {!collapsed ? (
            <span className="font-display text-lg font-bold text-gradient">Autopilot</span>
          ) : (
            <span className="font-display text-lg font-bold text-gradient">A</span>
          )}
          {!collapsed && <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-2">Admin</span>}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = section === item.section;
                return (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      onClick={() => onNavigate(item.section)}
                      className={`cursor-pointer transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "hover:bg-sidebar-accent/50"}`}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          {item.title}
                          {item.section === "users" && (
                            <span className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground px-1.5 py-0.5 rounded-full">
                              {userCount}
                            </span>
                          )}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSignOut} className="cursor-pointer text-muted-foreground hover:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Cerrar sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
