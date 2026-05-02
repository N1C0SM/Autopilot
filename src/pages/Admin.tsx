import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminStats from "@/components/admin/AdminStats";
import UserList from "@/components/admin/UserList";
import UserDetail from "@/components/admin/UserDetail";
import PaymentModeToggle from "@/components/admin/PaymentModeToggle";
import ExerciseLibrary from "@/components/admin/ExerciseLibrary";
import TrainingRulesEditor from "@/components/admin/TrainingRulesEditor";
import PaymentReminders from "@/components/admin/PaymentReminders";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export interface Profile {
  user_id: string;
  email: string;
  plan_status: string;
  payment_status: string;
  created_at: string;
  travel_mode_until?: string | null;
  travel_equipment?: string | null;
}

export type AdminSection = "dashboard" | "users" | "reminders" | "exercises" | "rules" | "settings";

const Admin = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [section, setSection] = useState<AdminSection>("dashboard");

  useEffect(() => {
    if (!user) return;
    const checkAdmin = async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!data) {
        navigate("/dashboard");
        return;
      }
      setIsAdmin(true);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      if (profiles) setUsers(profiles as unknown as Profile[]);
      if (roles) setAdminIds(new Set(roles.map((r) => r.user_id)));
      setLoading(false);
    };
    checkAdmin();
  }, [user, navigate]);

  const updateUserInList = (userId: string, updates: Partial<Profile>) => {
    setUsers((u) => u.map((p) => p.user_id === userId ? { ...p, ...updates } : p));
    setSelectedUser((p) => p?.user_id === userId ? { ...p, ...updates } : p);
  };

  const handleSelectUser = (u: Profile) => {
    setSelectedUser(u);
    setSection("users");
  };

  const handleNavigate = (s: AdminSection) => {
    setSection(s);
    if (s !== "users") setSelectedUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar
          section={section}
          onNavigate={handleNavigate}
          userCount={users.length}
          onSignOut={() => { signOut(); navigate("/"); }}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50 flex items-center px-4 gap-3">
            <SidebarTrigger />
            <h1 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground">
              {section === "dashboard" && "Panel general"}
              {section === "users" && (selectedUser ? selectedUser.email : "Usuarios")}
              {section === "reminders" && "Recordatorios de pago"}
              {section === "exercises" && "Biblioteca de ejercicios"}
              {section === "rules" && "Reglas de generación"}
              {section === "settings" && "Configuración"}
            </h1>
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            {section === "dashboard" && (
              <div className="max-w-5xl space-y-6">
                <AdminStats users={users} />

                {/* Quick actions */}
                <div className="grid sm:grid-cols-4 gap-4">
                  <QuickAction
                    label="Planes pendientes"
                    value={users.filter(u => u.plan_status === "plan_pending").length}
                    color="text-amber-400"
                    onClick={() => { setSection("users"); }}
                  />
                  <QuickAction
                    label="Sin pagar"
                    value={users.filter(u => u.payment_status === "unpaid").length}
                    color="text-destructive"
                    onClick={() => { setSection("users"); }}
                  />
                  <QuickAction
                    label="✈️ En viaje"
                    value={users.filter(u => u.travel_mode_until && new Date(u.travel_mode_until) >= new Date()).length}
                    color="text-amber-400"
                    onClick={() => { setSection("users"); }}
                  />
                  <QuickAction
                    label="Nuevos (hoy)"
                    value={users.filter(u => {
                      const d = new Date(u.created_at);
                      const today = new Date();
                      return d.toDateString() === today.toDateString();
                    }).length}
                    color="text-primary"
                    onClick={() => { setSection("users"); }}
                  />
                </div>

                {/* Recent users */}
                <div>
                  <h2 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">Usuarios recientes</h2>
                  <div className="space-y-2">
                    {users
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .slice(0, 5)
                      .map((u) => (
                        <div
                          key={u.user_id}
                          className="bg-card rounded-xl p-4 border border-border flex items-center gap-3 cursor-pointer hover:border-primary/50 transition-all"
                          onClick={() => handleSelectUser(u)}
                        >
                          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-muted-foreground">{u.email.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{u.email}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                            </div>
                          </div>
                          <StatusDot status={u.plan_status} payment={u.payment_status} />
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {section === "users" && (
              <div className="max-w-5xl">
                {!selectedUser ? (
                  <UserList users={users} adminIds={adminIds} onSelectUser={handleSelectUser} />
                ) : (
                  <UserDetail
                    profile={selectedUser}
                    onBack={() => setSelectedUser(null)}
                    onUpdate={updateUserInList}
                    onDelete={(userId) => {
                      setUsers((u) => u.filter((p) => p.user_id !== userId));
                      setSelectedUser(null);
                    }}
                  />
                )}
              </div>
            )}

            {section === "reminders" && (
              <div className="max-w-5xl">
                <PaymentReminders users={users.filter(u => !adminIds.has(u.user_id))} />
              </div>
            )}

            {section === "exercises" && (
              <div className="max-w-3xl">
                <ExerciseLibraryFull />
              </div>
            )}

            {section === "rules" && (
              <div className="max-w-2xl">
                <TrainingRulesEditor />
              </div>
            )}

            {section === "settings" && (
              <div className="max-w-2xl space-y-6">
                <PaymentModeToggle />
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

// ─── Small helper components ───

function QuickAction({ label, value, color, onClick }: { label: string; value: number; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-xl p-5 border border-border hover:border-primary/30 transition-all text-left group"
    >
      <div className={`text-3xl font-bold font-display ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1 group-hover:text-foreground transition-colors">{label}</div>
    </button>
  );
}

function StatusDot({ status, payment }: { status: string; payment: string }) {
  if (payment === "unpaid") return <span className="w-2.5 h-2.5 rounded-full bg-destructive shrink-0" title="Sin pagar" />;
  if (status === "plan_ready") return <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" title="Plan listo" />;
  if (status === "plan_pending") return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" title="Pendiente" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground shrink-0" title="Onboarding" />;
}

// Full-page exercise library (always open)
function ExerciseLibraryFull() {
  return (
    <div>
      <ExerciseLibrary defaultOpen />
    </div>
  );
}

export default Admin;
