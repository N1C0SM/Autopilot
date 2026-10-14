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
import { Home, Dumbbell, Apple, MessageCircle, Settings, LogOut, Sparkles, Lock, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TOOLTIPS: Partial<Record<UserSection, string>> = {
  home: "Resumen de hoy: entrenamiento, comidas y racha",
  training: "Tu rutina de la semana y registro de series",
  nutrition: "Macros y comidas del día",
  chat: "Habla con tu entrenador, envía fotos o vídeos",
  progress: "Fotos, peso, evolución semanal y AI Scan",
  settings: "Perfil, suscripción y notificaciones",
  resources: "Biblioteca, guías y recomendaciones",
};

export type UserSection = "home" | "training" | "nutrition" | "chat" | "progress" | "settings" | "resources";

interface Props {
  section: UserSection;
  onNavigate: (s: UserSection) => void;
  onSignOut: () => void;
  profileName?: string;
  profileAvatar?: string;
  lockedSections?: UserSection[];
  /** Sections not offered at all (e.g. chat while Coach is hidden in Admin). */
  hiddenSections?: UserSection[];
}

const NAV_ITEMS: { title: string; section: UserSection; icon: typeof Home }[] = [
  { title: "Inicio", section: "home", icon: Home },
  { title: "Entrenamiento", section: "training", icon: Dumbbell },
  { title: "Nutrición", section: "nutrition", icon: Apple },
  { title: "Mi progreso", section: "progress", icon: Sparkles },
  { title: "Chat", section: "chat", icon: MessageCircle },
  { title: "Ajustes", section: "settings", icon: Settings },
];

const UserSidebar = ({ section, onNavigate, onSignOut, profileName, profileAvatar, lockedSections = [], hiddenSections = [] }: Props) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="px-4 py-5">
          {!collapsed ? (
            <span className="type-title3 text-primary">Autopilot</span>
          ) : (
            <span className="type-title3 text-primary">A</span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.filter((item) => !hiddenSections.includes(item.section)).map((item) => {
                const isActive = section === item.section;
                const isLocked = lockedSections.includes(item.section);
                return (
                  <SidebarMenuItem key={item.section}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          onClick={() => onNavigate(item.section)}
                          className={`transition-colors active:bg-sidebar-accent ${isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : ""}`}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && (
                            <span className="flex-1 flex items-center justify-between">
                              <span className={isLocked ? "text-muted-foreground" : ""}>{item.title}</span>
                              {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="type-footnote max-w-[220px]">
                        {isLocked
                          ? `${item.title} — no incluido en tu plan actual`
                          : TOOLTIPS[item.section] || item.title}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Más</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onNavigate("resources")}
                  className={`transition-colors active:bg-sidebar-accent ${section === "resources" ? "bg-sidebar-accent text-sidebar-primary font-medium" : ""}`}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Recursos</span>}
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
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center overflow-hidden shrink-0">
              {profileAvatar ? (
                <img loading="lazy" decoding="async" src={profileAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="type-caption2 font-bold text-sidebar-accent-foreground">
                  {profileName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="type-footnote text-sidebar-foreground truncate">{profileName}</span>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSignOut} className="text-muted-foreground active:text-destructive hover:text-destructive">
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
