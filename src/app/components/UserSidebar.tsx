import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import { Home, Dumbbell, Apple, MessageCircle, Settings, LogOut, Sparkles, Lock, BookOpen, ArrowLeftRight } from "lucide-react";
import { openAccountPicker } from "@/shared/lib/accounts";
import { supportsMultipleAccounts } from "@/shared/lib/platform";
import autopilotLogo from "@/shared/assets/autopilot-logo.png";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

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
          <img src={autopilotLogo} alt="Autopilot" className="h-8 w-8 rounded-full object-cover" />
          {!collapsed && (
            <span className="ml-3 font-display text-[15px] font-semibold uppercase tracking-[0.3em] text-foreground">
              Autopilot
            </span>
          )}
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
                        "h-11 rounded-xl px-3.5 gap-3.5 transition-all duration-150",
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
      <SidebarFooter className="pb-4">
        <div className="mx-4 mb-3 h-px bg-sidebar-border/50" />

        {/* Perfil */}
        {profileName && (() => {
          // En las apps nativas el perfil es el selector de cuentas, como el menú de usuarios del Mac.
          const canSwitch = supportsMultipleAccounts();
          const Row = canSwitch ? "button" : "div";
          return <Row
            {...(canSwitch ? { type: "button" as const, onClick: () => openAccountPicker(), "aria-label": `${profileName}. Cambiar de cuenta` } : {})}
            className={cn(
              "flex w-[calc(100%-1rem)] items-center gap-3 px-4 py-2.5 rounded-xl mx-2 text-left",
              "hover:bg-sidebar-accent/40 transition-colors",
              canSwitch ? "cursor-pointer active:opacity-70" : "cursor-default",
              collapsed && "justify-center px-0 mx-0",
            )}>
            <div className={cn(
              "rounded-full bg-primary/15 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-primary/25",
              collapsed ? "h-8 w-8" : "h-8 w-8",
            )}>
              {profileAvatar ? (
                <img loading="lazy" decoding="async" src={profileAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="type-footnote font-bold text-primary">
                  {profileName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block type-footnote text-sidebar-foreground/60 truncate leading-tight">{profileName}</span>
                {canSwitch && <span className="block type-footnote text-primary leading-tight mt-0.5">Cambiar de cuenta</span>}
              </span>
            )}
            {!collapsed && canSwitch && <ArrowLeftRight className="h-4 w-4 shrink-0 text-sidebar-foreground/40" aria-hidden="true" />}
          </Row>;
        })()}

        {/* Cerrar sesión */}
        <SidebarMenu className="px-3 mt-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onSignOut}
              className={cn(
                "h-10 rounded-xl px-3.5 gap-3.5 transition-all duration-150",
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
