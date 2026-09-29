import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, MessageCircle, LogOut, Users as UsersIcon, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Chat from "@/components/Chat";
import InfoHint from "@/components/InfoHint";
import UserDetail from "@/components/admin/UserDetail";
import TrainerSelfProfile from "@/components/trainer/TrainerSelfProfile";
import type { Profile } from "@/pages/Admin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-2">Entrenador</span>
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <TrainerSidebar
          section={section}
          onNavigate={(s) => { setSection(s); setSelected(null); }}
          userCount={users.length}
          onSignOut={handleSignOut}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="app-chrome h-14 border-b sticky top-0 z-40 flex items-center px-4 gap-3">
            <SidebarTrigger />
            <span className="text-sm font-medium text-muted-foreground">
              {section === "users" ? "Usuarios asignados" : section === "chat" ? "Chat con administrador" : "Mi perfil"}
            </span>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full">
            {selected ? (
              <div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4">
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver
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
              <div className="space-y-2">
                <h1 className="text-xl font-bold font-display mb-1 flex items-center gap-2">
                  Usuarios asignados ({users.length})
                  <InfoHint text="El administrador gestiona tus asignaciones. Pulsa en un cliente para revisar su plan, progreso y actividad." />
                </h1>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <p className="text-xs text-muted-foreground">Tus clientes y sus cambios aparecen aquí en directo.</p>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 shrink-0" aria-live="polite">
                    <span className={`w-1.5 h-1.5 rounded-full ${realtimeConnected ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    {realtimeConnected ? "En directo" : "Conectando…"}
                  </span>
                </div>
                {users.length > 3 && (
                  <Input
                    type="search"
                    placeholder="Buscar por email…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="mb-3"
                    aria-label="Buscar usuario asignado"
                  />
                )}
                {users.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">Aún no tienes clientes asignados.</p>
                    <p className="text-xs text-muted-foreground mt-1">Pide al administrador que te asigne clientes para empezar a seguir su progreso.</p>
                  </div>
                ) : (
                  users
                    .filter((u) => u.email.toLowerCase().includes(query.trim().toLowerCase()))
                    .map((u) => (
                    <div
                      key={u.user_id}
                      className="bg-card rounded-xl p-4 border border-border flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-all group"
                      onClick={() => setSelected(u)}
                    >
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={u.avatar_url || undefined} alt={u.name?.trim() || "Foto del cliente"} />
                        <AvatarFallback className="bg-secondary text-sm font-bold">
                          {(u.name?.trim() || u.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">{u.name?.trim() || u.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.email}{u.plan_status === "plan_ready" ? " · Plan listo" : u.plan_status === "plan_pending" ? " · Pendiente" : " · Perfil pendiente"}
                        </div>
                      </div>
                      <span className="text-muted-foreground group-hover:text-primary">→</span>
                    </div>
                  ))
                )}
              </div>
            ) : section === "profile" ? (
              <TrainerSelfProfile assignedClientCount={users.length} />
            ) : (
              user && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-[11px] text-muted-foreground">
                    <span>Chat interno con el equipo</span>
                    <InfoHint text="Canal privado con el administrador para dudas, incidencias o cambios en los planes de tus usuarios. Tus usuarios no ven esta conversación." />
                  </div>
                  <Chat conversationUserId={user.id} />
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">Conversación privada con el administrador.</p>
                </div>
              )
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default TrainerPage;