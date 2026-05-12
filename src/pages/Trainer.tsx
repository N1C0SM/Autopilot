import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, MessageCircle, LogOut, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Chat from "@/components/Chat";
import UserDetail from "@/components/admin/UserDetail";
import type { Profile } from "@/pages/Admin";

const TrainerPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isTrainer, setIsTrainer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"users" | "chat">("users");

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
        const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", ids);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50 flex items-center px-4 gap-3">
        <span className="font-display text-lg font-bold text-gradient">Autopilot</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Entrenador</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/"); }}>
            <LogOut className="w-4 h-4 mr-1.5" /> Salir
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
        {selected ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver
            </Button>
            <UserDetail
              profile={selected}
              onBack={() => setSelected(null)}
              onUpdate={(uid, updates) => {
                setUsers((u) => u.map((p) => (p.user_id === uid ? { ...p, ...updates } : p)));
                setSelected((p) => (p?.user_id === uid ? { ...p, ...updates } : p));
              }}
            />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-6">
            <TabsList className="grid grid-cols-2 max-w-sm bg-secondary/50">
              <TabsTrigger value="users" className="text-xs gap-1.5"><UsersIcon className="w-3.5 h-3.5" /> Mis usuarios</TabsTrigger>
              <TabsTrigger value="chat" className="text-xs gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Chat con admin</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-2">
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
            </TabsContent>

            <TabsContent value="chat">
              {user && (
                <>
                  <Chat conversationUserId={user.id} />
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">Conversación privada con el administrador.</p>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default TrainerPage;