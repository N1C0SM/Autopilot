import { BrandMark } from "@/shared/components/ui/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import { Home, Flame as Apple, MessageCircle, Settings, LogOut, TrendingUp as Sparkles, Lock, ArrowLeftRight } from "lucide-react";
import { openAccountPicker } from "@/shared/lib/accounts";
import { supportsMultipleAccounts } from "@/shared/lib/platform";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { hapticTap } from "@/shared/lib/native";
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
  { title: "Nutrición",     section: "nutrition",  icon: Apple },
  { title: "Mi progreso",   section: "progress",   icon: Sparkles },
  { title: "Chat",          section: "chat",       icon: MessageCircle },
  { title: "Ajustes",       section: "settings",   icon: Settings },
];

/**
 * Barra lateral del usuario: la misma que Admin y Entrenador (logo, filas de 44 pt,
 * «actual» en dorado al 15 %), para que el producto se sienta uno solo.
 */
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
      <SidebarHeader className="px-4 pb-1 pt-4 group-data-[collapsible=icon]:px-2">
        {collapsed ? (
          <span className="flex justify-center"><BrandMark size={24} label="Autopilot" /></span>
        ) : (
          <div className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="text-[18px] font-bold tracking-[0.01em]">AUTOPILOT</span>
            
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="py-1">
          <SidebarMenu className="gap-1">
            {NAV_ITEMS.filter((item) => !hiddenSections.includes(item.section)).map((item) => {
              const isActive = section === item.section;
              const isLocked = lockedSections.includes(item.section);
              const hint = isLocked ? `${item.title} — no incluido en tu plan` : TOOLTIPS[item.section];

              return (
                <SidebarMenuItem key={item.section}>
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={hint}
                    onClick={() => { void hapticTap(); onNavigate(item.section); }}
                    aria-current={isActive ? "page" : undefined}
                    className="data-[active=true]:bg-transparent data-[active=true]:text-primary data-[active=true]:font-semibold [&_svg]:stroke-[1.5]"
                  >
                    <item.icon aria-hidden="true" />
                    {!collapsed && (
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate">{item.title}</span>
                        {isLocked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: cuenta + cerrar sesión ── */}
      <SidebarFooter className="pb-4">
        {profileName && (() => {
          // En las apps nativas el perfil es el selector de cuentas, como el menú de usuarios del Mac.
          const canSwitch = supportsMultipleAccounts();
          const Row = canSwitch ? "button" : "div";
          return <Row
            {...(canSwitch ? { type: "button" as const, onClick: () => openAccountPicker(), "aria-label": `${profileName}. Cambiar de cuenta` } : {})}
            className={cn(
              "mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-media px-3 py-2.5 text-left",
              "transition-colors hover:bg-accent active:opacity-70",
              collapsed && "mx-0 justify-center px-0",
            )}>
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary/15 ring-1 ring-primary/25">
              {profileAvatar ? (
                <img loading="lazy" decoding="async" src={profileAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center type-subhead font-bold text-primary">
                  {profileName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate type-footnote text-muted-foreground">{profileName}</span>
                {canSwitch && <span className="mt-0.5 block type-caption2 text-primary">Cambiar de cuenta</span>}
              </span>
            )}
            {!collapsed && canSwitch && <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          </Row>;
        })()}

        <SidebarMenu className="mt-1 px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Cerrar sesión"
              onClick={() => { void hapticTap(); onSignOut(); }}
              className="text-destructive hover:text-destructive active:text-destructive"
            >
              <LogOut aria-hidden="true" />
              {!collapsed && <span className="truncate">Cerrar sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default UserSidebar;
