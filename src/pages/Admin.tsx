import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Users as UsersIcon } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminStats from "@/components/admin/AdminStats";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import AdminMobileHeader from "@/components/admin/AdminMobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { PaymentDot, PlanStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { TestAccountKind } from "@/components/admin/CreateTestAccountDialog";

const AdminMetrics = lazy(() => import("@/components/admin/AdminMetrics"));
const UserList = lazy(() => import("@/components/admin/UserList"));
const UserDetail = lazy(() => import("@/components/admin/UserDetail"));
const PaymentModeToggle = lazy(() => import("@/components/admin/PaymentModeToggle"));
const ExerciseLibrary = lazy(() => import("@/components/admin/ExerciseLibrary"));
const TrainingRulesEditor = lazy(() => import("@/components/admin/TrainingRulesEditor"));
const PaymentReminders = lazy(() => import("@/components/admin/PaymentReminders"));
const SiteContentEditor = lazy(() => import("@/components/admin/SiteContentEditor"));
const BlogPostsEditor = lazy(() => import("@/components/admin/BlogPostsEditor"));
const TrainerManagement = lazy(() => import("@/components/admin/TrainerManagement"));
const EmailTemplatesEditor = lazy(() => import("@/components/admin/EmailTemplatesEditor"));
const GoalPhysiquesEditor = lazy(() => import("@/components/admin/GoalPhysiquesEditor"));
const ProductsAdmin = lazy(() => import("@/components/admin/ProductsAdmin"));
const LibraryDrive = lazy(() => import("@/components/admin/LibraryDrive"));

export interface Profile {
  user_id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  plan_status: string;
  payment_status: string;
  created_at: string;
  travel_mode_until?: string | null;
  travel_equipment?: string | null;
  subscription_tier?: string | null;
}

export type AdminSection = "dashboard" | "metrics" | "users" | "trainers" | "reminders" | "exercises" | "drive" | "rules" | "landing" | "blog" | "physiques" | "payments" | "emails" | "products";

const Admin = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [trainerIds, setTrainerIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [section, setSection] = useState<AdminSection>("dashboard");
  const isMobile = useIsMobile();

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
        supabase
          .from("profiles")
          .select("user_id, email, name, avatar_url, plan_status, payment_status, created_at, travel_mode_until, travel_equipment, subscription_tier"),
        supabase.from("user_roles").select("user_id, role").in("role", ["admin", "trainer"]),
      ]);
      if (profiles) setAllUsers(profiles as unknown as Profile[]);
      if (roles) {
        setAdminIds(new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id)));
        setTrainerIds(new Set(roles.filter((r) => r.role === "trainer").map((r) => r.user_id)));
      }
      setLoading(false);
    };
    checkAdmin();
  }, [user, navigate]);

  const refreshRoles = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "trainer"]);
    if (roles) {
      setAdminIds(new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id)));
      setTrainerIds(new Set(roles.filter((r) => r.role === "trainer").map((r) => r.user_id)));
    }
  };

  const updateUserInList = (userId: string, updates: Partial<Profile>) => {
    setAllUsers((u) => u.map((p) => p.user_id === userId ? { ...p, ...updates } : p));
    setSelectedUser((p) => p?.user_id === userId ? { ...p, ...updates } : p);
  };

  const handleTestAccountCreated = (profile: Profile, kind: TestAccountKind) => {
    setAllUsers((current) => [profile, ...current.filter((item) => item.user_id !== profile.user_id)]);
    if (kind === "admin") {
      setAdminIds((current) => new Set(current).add(profile.user_id));
    } else if (kind === "trainer") {
      setTrainerIds((current) => new Set(current).add(profile.user_id));
    }
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

  // Hide the currently-logged-in admin from every list
  const users = allUsers.filter((u) => u.user_id !== user?.id);

  const sectionTitle =
    section === "dashboard" ? "Panel general" :
    section === "users" ? (selectedUser ? selectedUser.email : "Usuarios") :
    section === "trainers" ? "Entrenadores" :
    section === "reminders" ? "Recordatorios de pago" :
    section === "exercises" ? "Biblioteca de ejercicios" :
    section === "drive" ? "Autopilot Drive · Libros" :
    section === "rules" ? "Reglas de generación" :
    section === "landing" ? "Contenido de la landing" :
    section === "blog" ? "Blog · Artículos SEO" :
    section === "physiques" ? "Físicos objetivo · AI Scan" :
    section === "payments" ? "Pagos · Stripe" :
    section === "products" ? "Planes y productos" :
    section === "metrics" ? "Métricas" : "";

  const handleSignOut = async () => { sessionStorage.removeItem("autopilot_section"); await signOut(); navigate("/login", { replace: true }); };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isMobile && (
          <AdminSidebar
            section={section}
            onNavigate={handleNavigate}
            userCount={users.length}
            onSignOut={handleSignOut}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Cabecera móvil: logo + menú Admin */}
          <AdminMobileHeader
            title={sectionTitle}
            section={section}
            onNavigate={handleNavigate}
            onSignOut={handleSignOut}
          />

          {/* Top bar escritorio / tablet */}
          <header className="app-chrome hidden md:flex h-14 border-b sticky top-0 z-50 items-center px-4 gap-3">
            <SidebarTrigger />
            <h1 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground truncate">
              {sectionTitle}
            </h1>
          </header>

          <main
            className="flex-1 min-w-0 overflow-x-hidden py-3 sm:py-5 md:py-6 lg:py-8 pl-[max(0.75rem,var(--safe-left,0px))] pr-[max(0.75rem,var(--safe-right,0px))] sm:pl-5 sm:pr-5 md:pl-6 md:pr-6 lg:pl-8 lg:pr-8 pb-[var(--mobile-nav-content-padding)] md:pb-8"
          >
            <Suspense fallback={<div className="min-h-40 animate-pulse rounded-xl bg-card/50" aria-hidden />}>
            {section === "dashboard" && (
              <div className="max-w-5xl space-y-6">
                <AdminStats users={users} />

                {/* Quick actions */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <QuickAction
                    label="Planes pendientes"
                    value={users.filter(u => u.plan_status === "plan_pending").length}
                    color="text-foreground"
                    onClick={() => { setSection("users"); }}
                  />
                  <QuickAction
                    label="Sin pagar"
                    value={users.filter(u => u.payment_status === "unpaid").length}
                    color="text-destructive"
                    onClick={() => { setSection("users"); }}
                  />
                  <QuickAction
                    label="En viaje"
                    value={users.filter(u => u.travel_mode_until && new Date(u.travel_mode_until) >= new Date()).length}
                    color="text-foreground"
                    onClick={() => { setSection("users"); }}
                  />
                  <QuickAction
                    label="Nuevos (hoy)"
                    value={users.filter(u => {
                      const d = new Date(u.created_at);
                      const today = new Date();
                      return d.toDateString() === today.toDateString();
                    }).length}
                    color="text-foreground"
                    onClick={() => { setSection("users"); }}
                  />
                </div>

                {/* Recent users */}
                <div>
                  <SectionHeader title="Usuarios recientes" className="mb-2" />
                  {users.length === 0 ? (
                    <EmptyState
                      icon={UsersIcon}
                      title="Todavía no hay usuarios"
                      description="Cuando alguien se registre aparecerá aquí."
                    />
                  ) : (
                    <Surface padding="none" className="divide-y divide-border overflow-hidden">
                      {users
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 5)
                        .map((u) => (
                          <button
                            key={u.user_id}
                            type="button"
                            onClick={() => handleSelectUser(u)}
                            className="flex h-14 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-muted/40"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                              {(u.name?.trim() || u.email).charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{u.name?.trim() || u.email}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {new Date(u.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                              </span>
                            </span>
                            <PlanStatusBadge
                              planStatus={u.plan_status}
                              traveling={!!u.travel_mode_until && new Date(u.travel_mode_until) >= new Date()}
                            />
                            <PaymentDot status={u.payment_status} />
                          </button>
                        ))}
                    </Surface>
                  )}
                </div>
              </div>
            )}

            {section === "users" && (
              <div className="max-w-5xl">
                {!selectedUser ? (
                  <UserList
                    users={users}
                    adminIds={adminIds}
                    trainerIds={trainerIds}
                    onSelectUser={handleSelectUser}
                    onTestAccountCreated={handleTestAccountCreated}
                  />
                ) : (
                  <UserDetail
                    profile={selectedUser}
                    onBack={() => setSelectedUser(null)}
                    onUpdate={updateUserInList}
                    isTargetTrainer={trainerIds.has(selectedUser.user_id)}
                    isTargetAdmin={adminIds.has(selectedUser.user_id)}
                    onDelete={(userId) => {
                      setAllUsers((u) => u.filter((p) => p.user_id !== userId));
                      setSelectedUser(null);
                    }}
                  />
                )}
              </div>
            )}

            {section === "trainers" && (
              <div className="max-w-5xl">
                <TrainerManagement
                  allUsers={users}
                  trainerIds={trainerIds}
                  adminIds={adminIds}
                  onRolesChange={refreshRoles}
                />
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

            {section === "drive" && (
              <div className="max-w-5xl">
                <LibraryDrive />
              </div>
            )}

            {section === "rules" && (
              <div className="max-w-2xl">
                <TrainingRulesEditor />
              </div>
            )}

            {section === "landing" && (
              <div className="max-w-3xl">
                <SiteContentEditor />
              </div>
            )}

            {section === "blog" && (
              <div className="max-w-4xl">
                <BlogPostsEditor />
              </div>
            )}

            {section === "physiques" && (
              <div className="max-w-5xl">
                <GoalPhysiquesEditor />
              </div>
            )}

            {section === "payments" && (
              <div className="max-w-2xl space-y-6">
                <PaymentModeToggle />
              </div>
            )}

            {section === "products" && <ProductsAdmin />}

            {section === "emails" && (
              <div className="max-w-4xl">
                <EmailTemplatesEditor />
              </div>
            )}

            {section === "metrics" && (
              <div className="max-w-7xl">
                <AdminMetrics />
              </div>
            )}
            </Suspense>
          </main>

          {/* Navegación inferior (móvil / plegable cerrado) */}
          <AdminMobileNav section={section} onNavigate={handleNavigate} />
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
      className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </button>
  );
}

// Full-page exercise library (always open)
function ExerciseLibraryFull() {
  return (
    <div>
      <ExerciseLibrary />
    </div>
  );
}

export default Admin;
