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
        <div className={cn("flex items-center", collapsed ? "justify-center px-0 py-5" : "px-5 py-5")}>
          <span className={cn(
            "font-display font-bold tracking-tight text-primary",
            collapsed ? "text-[18px]" : "text-[20px]"
          )}>
            {collapsed ? "A" : "Autopilot"}
          </span>
        </div>

        {/* ── Separador sutil ── */}
        <div className="mx-3 mb-2 h-px bg-sidebar-border/60" />

        {/* ── Navegación principal ── */}
        <SidebarMenu className="px-2 gap-0.5">
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
                        "h-10 rounded-xl px-3 gap-3 transition-all duration-100",
                        "hover:bg-sidebar-accent/70",
                        "active:scale-[0.97] active:opacity-80",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                          : "text-sidebar-foreground/70 font-normal",
                      )}
                    >
                      {/* Indicador dorado lateral para item activo */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                      )}
                      <item.icon
                        className={cn(
                          "shrink-0",
                          collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
                          isActive ? "text-primary" : "text-sidebar-foreground/50",
                        )}
                      />
                      {!collapsed && (
                        <span className="flex flex-1 items-center justify-between min-w-0">
                          <span className={cn(
                            "truncate type-subhead",
                            isLocked && "text-sidebar-foreground/40",
                          )}>
                            {item.title}
                          </span>
                          {isLocked && <Lock className="h-3 w-3 shrink-0 text-sidebar-foreground/30" />}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="type-footnote max-w-[220px] bg-card border-border text-foreground"
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
      <SidebarFooter className="pb-3">
        <div className="mx-3 mb-2 h-px bg-sidebar-border/60" />

        {/* Perfil */}
        {profileName && (
          <div className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-xl mx-2",
            "hover:bg-sidebar-accent/50 transition-colors cursor-default",
            collapsed && "justify-center px-0 mx-0",
          )}>
            <div className={cn(
              "rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-primary/30",
              collapsed ? "h-8 w-8" : "h-7 w-7",
            )}>
              {profileAvatar ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={profileAvatar}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[11px] font-bold text-primary">
                  {profileName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {!collapsed && (
              <span className="type-footnote text-sidebar-foreground/70 truncate leading-tight">
                {profileName}
              </span>
            )}
          </div>
        )}

        {/* Cerrar sesión */}
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onSignOut}
              className={cn(
                "h-9 rounded-xl px-3 gap-3 transition-all duration-100",
                "text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10",
                "active:opacity-70",
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="type-subhead">Cerrar sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default UserSidebar;
