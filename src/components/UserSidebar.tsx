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
import { Home, Dumbbell, Apple, MessageCircle, Settings, LogOut, Sparkles, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export type UserSection = "home" | "training" | "nutrition" | "chat" | "settings";

interface Props {
  section: UserSection;
  onNavigate: (s: UserSection) => void;
  onSignOut: () => void;
  profileName?: string;
  profileAvatar?: string;
  lockedSections?: UserSection[];
}

const NAV_ITEMS: { title: string; section: UserSection; icon: typeof Home }[] = [
  { title: "Inicio", section: "home", icon: Home },
  { title: "Entrenamiento", section: "training", icon: Dumbbell },
  { title: "Nutrición", section: "nutrition", icon: Apple },
  { title: "Chat", section: "chat", icon: MessageCircle },
  { title: "Ajustes", section: "settings", icon: Settings },
];

const UserSidebar = ({ section, onNavigate, onSignOut, profileName, profileAvatar, lockedSections = [] }: Props) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

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
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = section === item.section;
                const isLocked = lockedSections.includes(item.section);
                return (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      onClick={() => onNavigate(item.section)}
                      className={`cursor-pointer transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "hover:bg-sidebar-accent/50"}`}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          <span className={isLocked ? "text-muted-foreground" : ""}>{item.title}</span>
                          {isLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Herramientas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/scan")}
                  className="cursor-pointer text-primary hover:bg-sidebar-accent/50"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {!collapsed && <span>AI Physique Scan</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* Profile mini */}
        {!collapsed && profileName && (
          <div className="px-3 py-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center overflow-hidden shrink-0">
              {profileAvatar ? (
                <img src={profileAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold text-sidebar-accent-foreground">
                  {profileName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-xs text-sidebar-foreground truncate">{profileName}</span>
          </div>
        )}
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

export default UserSidebar;
