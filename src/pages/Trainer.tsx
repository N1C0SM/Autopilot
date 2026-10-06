import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, MessageCircle, LogOut, Search, Users as UsersIcon, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Chat from "@/components/Chat";
import FloatingMobileNav from "@/components/mobile/FloatingMobileNav";
import InfoHint from "@/components/InfoHint";
import UserDetail from "@/components/admin/UserDetail";
import TrainerSelfProfile from "@/components/trainer/TrainerSelfProfile";
import type { Profile } from "@/pages/Admin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { PlanStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

type TrainerSection = "users" | "chat" | "profile";

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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const items: { title: string; section: TrainerSection; icon: typeof UsersIcon }[] = [
    { title: "Mis usuarios", section: "users", icon: UsersIcon },
    { title: "Chat con admin", section: "chat", icon: MessageCircle },
    { title: "Mi perfil", section: "profile", icon: UserRound },
  ];
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b border-sidebar-border">
          {!collapsed ? (
            <>
              <span className="font-display text-lg font-bold text-gradient">Autopilot</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground ml-2">Entrenador</span>
            </>
          ) : (
            <span className="font-display text-lg font-bold text-gradient">A</span>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
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
                            <span className="text-xs bg-sidebar-accent text-sidebar-accent-foreground px-1.5 py-0.5 rounded-full">
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
        : current,
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }
  if (!isTrainer) return null;

  const handleSignOut = async () => { await signOut(); navigate("/login", { replace: true }); };

  const goSection = (s: TrainerSection) => { setSection(s); setSelected(null); };
  const sectionTitle = section === "users" ? "Mis clientes" : section === "chat" ? "Chat con admin" : "Mi perfil";
  const visibleUsers = users.filter((u) => u.email.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <SidebarProvider>
      <div className="min-h-dvh flex w-full bg-background">
        <div className="hidden md:block">
          <TrainerSidebar
            section={section}
            onNavigate={goSection}
            userCount={users.length}
            onSignOut={handleSignOut}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="app-chrome border-b sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
            <div className="h-14 flex items-center px-4 gap-3">
              <SidebarTrigger className="hidden md:inline-flex" />
              <span className="flex-1 text-center md:text-left text-sm font-semibold md:font-medium md:text-muted-foreground">
                {selected ? (selected.name?.trim() || selected.email) : sectionTitle}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Cerrar sesión"
                className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>
          <main className={`flex-1 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 ${section === "chat" && !selected ? "max-md:flex max-md:flex-col max-md:h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] max-md:overflow-hidden max-md:pb-[calc(6rem+env(safe-area-inset-bottom))]" : ""}`}>
            {selected ? (
              <div>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setSelected(null)}
                  className="mb-4 h-12 w-full md:w-auto justify-start rounded-xl text-sm font-semibold"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" /> Volver a mis clientes
                </Button>
                <UserDetail
                  profile={selected}
                  onBack={() => setSelected(null)}
                  restricted
                  onUpdate={(uid, updates) => {
                    setUsers((u) => u.map((p) => (p.user_id === uid ? { ...p, ...updates } : p)));
                    setSelected((p) => (p?.user_id === uid ? { ...p, ...updates } : p));
                  }}
                />
              </div>
            ) : section === "users" ? (
              <div className="space-y-3">
                <SectionHeader
                  title={
                    <span className="flex items-center gap-2">
                      Usuarios asignados ({users.length})
                      <InfoHint text="El administrador gestiona tus asignaciones. Pulsa en un cliente para revisar su plan, progreso y actividad." />
                    </span>
                  }
                  hint="Tus clientes y sus cambios aparecen aquí en directo."
                  action={
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                      <span className={`h-1.5 w-1.5 rounded-full ${realtimeConnected ? "bg-primary" : "bg-muted-foreground"}`} />
                      {realtimeConnected ? "En directo" : "Conectando…"}
                    </span>
                  }
                />
                {users.length > 3 && (
                  <Input
                    type="search"
                    placeholder="Buscar por email…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-11"
                    aria-label="Buscar usuario asignado"
                  />
                )}
                {users.length === 0 ? (
                  <EmptyState
                    icon={UsersIcon}
                    title="Aún no tienes clientes asignados"
                    description="Pide al administrador que te asigne clientes para empezar a seguir su progreso."
                  />
                ) : visibleUsers.length === 0 ? (
                  <EmptyState icon={Search} title="Sin coincidencias" description="Prueba con otro email." />
                ) : (
                  <Surface padding="none" className="divide-y divide-border overflow-hidden">
                    {visibleUsers.map((u) => (
                      <button
                        key={u.user_id}
                        type="button"
                        onClick={() => setSelected(u)}
                        className="flex h-14 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-muted/40"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={u.avatar_url || undefined} alt={u.name?.trim() || "Foto del cliente"} />
                          <AvatarFallback className="bg-secondary text-xs font-semibold text-muted-foreground">
                            {(u.name?.trim() || u.email).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{u.name?.trim() || u.email}</span>
                          <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                        </span>
                        <PlanStatusBadge planStatus={u.plan_status} />
                      </button>
                    ))}
                  </Surface>
                )}
              </div>
            ) : section === "profile" ? (
              <TrainerSelfProfile assignedClientCount={users.length} />
            ) : (
              user && (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                    <span>Chat interno con el equipo</span>
                    <InfoHint text="Canal privado con el administrador para dudas, incidencias o cambios en los planes de tus usuarios. Tus usuarios no ven esta conversación." />
                  </div>
                  <div className="min-h-0 flex-1"><Chat conversationUserId={user.id} /></div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">Conversación privada con el administrador.</p>
                </div>
              )
            )}
          </main>
        </div>
      </div>
      <FloatingMobileNav
        className="trainer-mobile-nav"
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