import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/shared/contexts/AuthContext";
import { supabase } from "@/shared/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { MessageCircle, LogOut, Search, Users as UsersIcon, UserRound } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { toast } from "sonner";
import Chat from "@/app/components/Chat";
import FloatingMobileNav from "@/app/components/mobile/FloatingMobileNav";
import UserDetail from "@/app/components/admin/UserDetail";
import TrainerSelfProfile from "@/app/components/trainer/TrainerSelfProfile";
import TrainerShell from "@/app/components/trainer/TrainerShell";
import type { Profile } from "@/app/pages/Admin";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { Spinner } from "@/shared/components/ui/spinner";
import { PlanStatusBadge } from "@/shared/components/ui/status-badge";
import { EmptyState } from "@/shared/components/ui/empty-state";
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
  SidebarProvider,
  useSidebar,
} from "@/shared/components/ui/sidebar";

type TrainerSection = "users" | "chat" | "profile";

// Un solo vocabulario: barra lateral, cabecera de escritorio y título grande del móvil.
const SECTION_TITLES: Record<TrainerSection, string> = {
  users: "Clientes",
  chat: "Chat con admin",
  profile: "Mi perfil",
};

/** Título de la ficha: el nombre del cliente, nunca el email entero. */
const clientName = (profile: Profile) => profile.name?.trim() || profile.email.split("@")[0];

const TrainerSidebar = ({
  section,
  onNavigate,
  userCount,
  onSignOut,
}: {
  section: TrainerSection;
  onNavigate: (s: TrainerSection) => void;
  userCount: number;
  onSignOut: () => void;
}) => {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const items: { title: string; section: TrainerSection; icon: typeof UsersIcon }[] = [
    { title: SECTION_TITLES.users, section: "users", icon: UsersIcon },
    { title: SECTION_TITLES.chat, section: "chat", icon: MessageCircle },
    { title: SECTION_TITLES.profile, section: "profile", icon: UserRound },
  ];
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-5">
          {!collapsed ? (
            <>
              <span className="type-title3 text-primary">Autopilot</span>
              <span className="ml-2 type-footnote text-muted-foreground">Entrenador</span>
            </>
          ) : (
            <span className="type-title3 text-primary">A</span>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = section === item.section;
                return (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      onClick={() => { onNavigate(item.section); if (isMobile) setOpenMobile(false); }}
                      aria-current={isActive ? "page" : undefined}
                      className={`transition-colors active:bg-sidebar-accent ${isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : ""}`}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <span className="flex flex-1 items-center justify-between">
                          {item.title}
                          {item.section === "users" && (
                            <span className="type-footnote tabular-nums text-muted-foreground">{userCount}</span>
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

const TrainerPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isTrainer, setIsTrainer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [section, setSection] = useState<TrainerSection>("users");
  const [query, setQuery] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadUsers = useCallback(async () => {
    const { data: profiles, error } = await supabase.rpc("get_trainer_assigned_profiles");
    if (error) {
      toast.error("No se pudieron actualizar tus clientes.");
      return;
    }
    const updatedProfiles = (profiles as unknown as Profile[]) || [];
    setUsers(updatedProfiles);
    setSelected((current) =>
      current && !updatedProfiles.some((assignedUser) => assignedUser.user_id === current.user_id)
        ? null
        : updatedProfiles.find((assignedUser) => assignedUser.user_id === current?.user_id) || null,
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: trainerRole } = await supabase.rpc("has_role", { _user_id: user.id, _role: "trainer" });
      const { data: adminRole } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!trainerRole && !adminRole) {
        navigate("/dashboard");
        return;
      }
      setIsTrainer(true);
      await loadUsers();
      setLoading(false);
    })();
  }, [user, navigate, loadUsers]);

  const assignedUserIds = users.map((assignedUser) => assignedUser.user_id).sort().join(",");

  useEffect(() => {
    if (!user || !isTrainer) return;
    const channel = supabase.channel(`trainer-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trainer_assignments", filter: `trainer_id=eq.${user.id}` },
        () => { void loadUsers(); },
      );

    assignedUserIds.split(",").filter(Boolean).forEach((assignedUserId) => {
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${assignedUserId}` },
        (payload) => {
          const updates = payload.new as Partial<Profile>;
          setUsers((current) => current.map((profile) =>
            profile.user_id === assignedUserId ? { ...profile, ...updates } : profile,
          ));
          setSelected((current) =>
            current?.user_id === assignedUserId ? { ...current, ...updates } : current,
          );
        },
      );
    });

    channel.subscribe((status) => {
      setRealtimeConnected(status === "SUBSCRIBED");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[Trainer] realtime status", status);
      }
    });

    return () => {
      setRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [user, isTrainer, assignedUserIds, loadUsers]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }
  if (!isTrainer) return null;

  const handleSignOut = async () => { await signOut(); navigate("/login", { replace: true }); };

  const goSection = (s: TrainerSection) => { setSection(s); setSelected(null); };
  const closeClient = () => setSelected(null);
  const visibleUsers = users.filter((u) => u.email.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <SidebarProvider>
      <div className="flex w-full bg-background md:min-h-dvh">
        <div className="hidden md:block">
          <TrainerSidebar
            section={section}
            onNavigate={goSection}
            userCount={users.length}
            onSignOut={handleSignOut}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <TrainerShell
            title={SECTION_TITLES[section]}
            screenKey={selected ? `${section}:${selected.user_id}` : section}
            detail={selected ? {
              title: clientName(selected),
              backLabel: SECTION_TITLES.users,
              backAriaLabel: "Volver a clientes",
              onBack: closeClient,
            } : null}
          >
            {selected ? (
              <div className="min-w-0">
                <UserDetail
                  profile={selected}
                  onBack={closeClient}
                  restricted
                  onUpdate={(uid, updates) => {
                    setUsers((u) => u.map((p) => (p.user_id === uid ? { ...p, ...updates } : p)));
                    setSelected((p) => (p?.user_id === uid ? { ...p, ...updates } : p));
                  }}
                />
              </div>
            ) : section === "users" ? (
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {users.length > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="type-subhead tabular-nums text-muted-foreground">
                      {users.length} {users.length === 1 ? "cliente asignado" : "clientes asignados"}
                    </p>
                    {/* Solo se anuncia cuando está conectado: un «Conectando…» eterno
                        es ruido y promete algo que puede no llegar. */}
                    {realtimeConnected ? (
                      <span className="flex shrink-0 items-center gap-1.5 type-footnote text-muted-foreground" aria-live="polite">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
                        En directo
                      </span>
                    ) : null}
                  </div>
                )}
                {users.length > 3 && (
                  <div className="relative">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      enterKeyHint="search"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Buscar por email…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Buscar usuario asignado"
                      className="pl-10"
                    />
                  </div>
                )}
                {users.length === 0 ? (
                  <EmptyState
                    icon={UsersIcon}
                    title="Aún no tienes clientes asignados"
                    description="Pide al administrador que te asigne clientes para empezar a seguir su progreso."
                    className="flex-1 md:py-20"
                  />
                ) : visibleUsers.length === 0 ? (
                  <EmptyState icon={Search} title="Sin coincidencias" description="Prueba con otro email." className="flex-1 md:py-16" />
                ) : (
                  <ListGroup footer="El administrador gestiona tus asignaciones. Los cambios de tus clientes aparecen aquí al momento.">
                    {visibleUsers.map((u) => (
                      <ListRow
                        key={u.user_id}
                        onClick={() => setSelected(u)}
                        chevron
                        leading={
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={u.avatar_url || undefined} alt={u.name?.trim() || "Foto del cliente"} className="object-cover" />
                            <AvatarFallback className="bg-secondary type-subhead font-semibold text-muted-foreground">
                              {(u.name?.trim() || u.email).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        }
                        title={<span className="block truncate type-headline">{u.name?.trim() || u.email}</span>}
                        subtitle={
                          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            {/* Sin nombre no repetimos el email dos veces. */}
                            {u.name?.trim() ? <span className="min-w-0 max-w-full truncate">{u.email}</span> : null}
                            <PlanStatusBadge planStatus={u.plan_status} />
                          </span>
                        }
                      />
                    ))}
                  </ListGroup>
                )}
              </div>
            ) : section === "profile" ? (
              <TrainerSelfProfile assignedClientCount={users.length} />
            ) : (
              user && (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                  <p className="type-subhead text-muted-foreground">
                    Canal privado con el administrador. Tus clientes no ven esta conversación.
                  </p>
                  {/* Alto fijo en escritorio: la conversación hace scroll dentro y el campo queda a la vista. */}
                  <div className="flex min-h-0 flex-1 flex-col md:h-[min(42rem,calc(100dvh-12rem))] md:flex-none">
                    <Chat conversationUserId={user.id} audience="team" layout="fill" />
                  </div>
                </div>
              )
            )}
          </TrainerShell>
        </div>
      </div>
      <FloatingMobileNav
        className="trainer-mobile-nav mobile-tabbar"
        active={section}
        items={[
          { key: "users", label: "Clientes", icon: UsersIcon },
          { key: "chat", label: "Chat admin", icon: MessageCircle },
          { key: "profile", label: "Mi perfil", icon: UserRound },
        ]}
        label="Navegación del entrenador"
        layoutId="trainer-mobile-tab"
        onChange={(k) => goSection(k as TrainerSection)}
      />
    </SidebarProvider>
  );
};

export default TrainerPage;