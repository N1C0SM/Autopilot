import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, MessageCircle, LogOut, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Chat from "@/components/Chat";
import UserDetail from "@/components/admin/UserDetail";
import type { Profile } from "@/pages/Admin";
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

type TrainerSection = "users" | "chat";

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

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: trainerRole } = await supabase.rpc("has_role", { _user_id: user.id, _role: "trainer" as any });
      const { data: adminRole } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!trainerRole && !adminRole) {
        navigate("/dashboard");
        return;
      }
      setIsTrainer(true);
      const { data: assignments } = await supabase
        .from("trainer_assignments")
        .select("user_id")
        .eq("trainer_id", user.id);
      const ids = (assignments || []).map((a: any) => a.user_id);
      if (ids.length > 0) {
        const { data: profiles } = await (supabase.rpc as any)("get_trainer_assigned_profiles");
        if (profiles) setUsers(profiles as unknown as Profile[]);
      }
      setLoading(false);
    })();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }
  if (!isTrainer) return null;

  const handleSignOut = () => { signOut(); navigate("/"); };

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
          <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-40 flex items-center px-4 gap-3">
            <SidebarTrigger />
            <span className="text-sm font-medium text-muted-foreground">
              {section === "users" ? "Usuarios asignados" : "Chat con administrador"}
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
                <h1 className="text-xl font-bold font-display mb-4">Usuarios asignados ({users.length})</h1>
                {users.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">Aún no tienes usuarios asignados.</p>
                  </div>
                ) : (
                  users.map((u) => (
                    <div
                      key={u.user_id}
                      onClick={() => setSelected(u)}
                      className="bg-card rounded-xl p-4 border border-border flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold">{u.email.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">{u.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.plan_status === "plan_ready" ? "✅ Plan listo" : u.plan_status === "plan_pending" ? "📋 Pendiente" : "🆕 Onboarding"}
                        </div>
                      </div>
                      <span className="text-muted-foreground group-hover:text-primary">→</span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              user && (
                <div>
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