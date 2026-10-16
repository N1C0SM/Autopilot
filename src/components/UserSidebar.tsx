import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Home, Dumbbell, Apple, MessageCircle, Settings, LogOut, Sparkles, Lock, BookOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  hiddenSections?: UserSection[];
}

const NAV_ITEMS: { title: string; section: UserSection; icon: typeof Home }[] = [
  { title: "Inicio",        section: "home",       icon: Home },
  { title: "Entrenamiento", section: "training",   icon: Dumbbell },
  { title: "Nutrición",     section: "nutrition",  icon: Apple },
  { title: "Mi progreso",   section: "progress",   icon: Sparkles },
  { title: "Chat",          section: "chat",       icon: MessageCircle },
  { title: "Ajustes",       section: "settings",   icon: Settings },
  { title: "Recursos",      section: "resources",  icon: BookOpen },
];

const UserSidebar = ({
  section,
  onNavigate,
  onSignOut,
  profileName,
  profileAvatar,
  lockedSections = [],
  hiddenSections = [],
}: Props) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>

        {/* ── Logo ── */}
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center px-0 py-6" : "px-6 py-6",
        )}>
          <span className={cn(
            "font-display font-bold tracking-tight text-primary",
            collapsed ? "text-[17px]" : "text-[22px]",
          )}>
            {collapsed ? "A" : "Autopilot"}
          </span>
        </div>

        {/* ── Separador sutil ── */}
        <div className="mx-4 mb-3 h-px bg-sidebar-border/50" />

        {/* ── Navegación principal ── */}
        <SidebarMenu className="px-3 gap-1">
          {NAV_ITEMS.filter((item) => !hiddenSections.includes(item.section)).map((item) => {
            const isActive = section === item.section;
            const isLocked = lockedSections.includes(item.section);

            return (
              <SidebarMenuItem key={item.section}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      onClick={() => onNavigate(item.section)}
                      className={cn(
                        // web: más alto y con más padding
                        "h-11 rounded-xl px-3.5 gap-3.5 transition-all duration-100",
                        "hover:bg-sidebar-accent/60",
                        "active:scale-[0.97] active:opacity-75",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                          : "text-sidebar-foreground/60 font-normal",
                      )}
                    >
                      {/* Indicador dorado lateral */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />
                      )}
                      <item.icon
                        className={cn(
                          "shrink-0 transition-colors",
                          collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                          isActive ? "text-primary" : "text-sidebar-foreground/40",
                        )}
                      />
                      {!collapsed && (
                        <span className="flex flex-1 items-center justify-between min-w-0">
                          <span className={cn(
                            "truncate text-[15px] leading-[22px]",
                            isLocked && "text-sidebar-foreground/35",
                          )}>
                            {item.title}
                          </span>
                          {isLocked && <Lock className="h-3 w-3 shrink-0 text-sidebar-foreground/25" />}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="text-[13px] max-w-[220px] bg-card border-border text-foreground"
                  >
                    {isLocked
                      ? `${item.title} — no incluido en tu plan`
                      : (TOOLTIPS[item.section] || item.title)}
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

      </SidebarContent>

      {/* ── Footer: avatar + cerrar sesión ── */}
      <SidebarFooter className="pb-4">
        <div className="mx-4 mb-3 h-px bg-sidebar-border/50" />

        {/* Perfil */}
        {profileName && (
          <div className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-xl mx-2",
            "hover:bg-sidebar-accent/40 transition-colors cursor-default",
            collapsed && "justify-center px-0 mx-0",
          )}>
            <div className={cn(
              "rounded-full bg-primary/15 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-primary/25",
              collapsed ? "h-8 w-8" : "h-8 w-8",
            )}>
              {profileAvatar ? (
                <img loading="lazy" decoding="async" src={profileAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[12px] font-bold text-primary">
                  {profileName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {!collapsed && (
              <span className="text-[13px] text-sidebar-foreground/60 truncate leading-tight">
                {profileName}
              </span>
            )}
          </div>
        )}

        {/* Cerrar sesión */}
        <SidebarMenu className="px-3 mt-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onSignOut}
              className={cn(
                "h-10 rounded-xl px-3.5 gap-3.5 transition-all duration-100",
                "text-sidebar-foreground/35 hover:text-destructive hover:bg-destructive/10",
                "active:opacity-70",
              )}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="text-[15px]">Cerrar sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default UserSidebar;
