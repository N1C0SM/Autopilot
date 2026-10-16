import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Users as UsersIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ListGroup, ListRow } from "@/components/ui/list";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminStats from "@/components/admin/AdminStats";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import AdminMobileHeader from "@/components/admin/AdminMobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { PaymentDot, PlanStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { TestAccountKind } from "@/components/admin/CreateTestAccountDialog";
import { clientProfiles } from "@/lib/adminMetrics";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
const SettingsPanel = lazy(() => import("@/components/SettingsPanel"));

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
  subscription_status?: string | null;
  subscription_end?: string | null;
  stripe_payment_id?: string | null;
  cycle_start_date?: string | null;
  renewal_decision?: string | null;
}

export type AdminSection = "dashboard" | "metrics" | "users" | "trainers" | "reminders" | "exercises" | "drive" | "rules" | "landing" | "blog" | "physiques" | "payments" | "emails" | "products" | "account";

const SECTION_TITLES: Record<AdminSection, string> = {
  dashboard: "Dashboard",
  metrics: "Métricas",
  users: "Usuarios",
  trainers: "Entrenadores",
  reminders: "Recordatorios",
  exercises: "Ejercicios",
  drive: "Drive · Libros",
  rules: "Reglas",
  landing: "Landing",
  blog: "Blog",
  physiques: "Físicos",
  payments: "Pagos",
  emails: "Emails",
  products: "Planes y productos",
  account: "Mi cuenta",
};

const Admin = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [trainerIds, setTrainerIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [section, setSection] = useState<AdminSection>(() =>
    new URLSearchParams(window.location.search).get("s") === "account" ? "account" : "dashboard");
  const isMobile = useIsMobile();
  const contentRef = useRef<HTMLElement>(null);

  const refreshUsers = useCallback(async () => {
    const [profilesResult, rolesResult] = await Promise.all([
      supabase.from("profiles").select("user_id, email, name, avatar_url, plan_status, payment_status, created_at, travel_mode_until, travel_equipment, subscription_tier, subscription_status, subscription_end, stripe_payment_id"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "trainer"]),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (rolesResult.error) throw rolesResult.error;
    setAllUsers(profilesResult.data || []);
    setAdminIds(new Set((rolesResult.data || []).filter((role) => role.role === "admin").map((role) => role.user_id)));
    setTrainerIds(new Set((rolesResult.data || []).filter((role) => role.role === "trainer").map((role) => role.user_id)));
    setLoadError(false);
    return clientProfiles(profilesResult.data || [], new Set((rolesResult.data || []).map((role) => role.user_id)));
  }, []);

  const clients = useMemo(() => clientProfiles(allUsers, new Set([...adminIds, ...trainerIds])), [allUsers, adminIds, trainerIds]);

  const loadAdmin = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) throw error;
      if (!data) {
        navigate("/dashboard");
        return;
      }
      setIsAdmin(true);
      await refreshUsers();
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user, navigate, refreshUsers]);

  useEffect(() => { void loadAdmin(); }, [loadAdmin]);

  const refreshRoles = async () => {
    try { await refreshUsers(); } catch { toast.error("No se pudieron actualizar las cuentas"); }
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <EmptyState
          icon={AlertCircle}
          title="No se pudo cargar"
          description="No se pudieron cargar las cuentas y sus permisos."
          action={<Button size="lg" onClick={() => { void loadAdmin(); }}>Reintentar</Button>}
        />
      </div>
    );
  }

  if (!isAdmin) return null;

  // Hide the currently-logged-in admin from every list
  const users = allUsers.filter((u) => u.user_id !== user?.id);

  // Una ficha abierta es una pantalla empujada: su barra lleva el nombre y "‹ Usuarios".
  const detailUser = section === "users" ? selectedUser : null;
  const sectionTitle = detailUser
    ? detailUser.name?.trim() || detailUser.email.split("@")[0] || "Usuario"
    : SECTION_TITLES[section];
  const closeUserDetail = () => setSelectedUser(null);

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
          <AdminMobileHeader
            title={sectionTitle}
            section={section}
            onNavigate={handleNavigate}
            onSignOut={handleSignOut}
            contentRef={contentRef}
            layoutKey={`${section}:${detailUser?.user_id ?? ""}`}
            onBack={detailUser ? closeUserDetail : undefined}
            backLabel="Usuarios"
          />

          <header className="app-chrome hidden md:flex h-14 border-b sticky top-0 z-50 items-center px-4 gap-3">
            <SidebarTrigger />
            <h1 className="type-headline truncate">
              {sectionTitle}
            </h1>
          </header>

          <main
            ref={contentRef}
            className="flex-1 min-w-0 overflow-x-hidden pt-2 md:pt-6 lg:pt-8 pl-[max(1rem,var(--safe-left,0px))] pr-[max(1rem,var(--safe-right,0px))] sm:pl-[max(1.25rem,var(--safe-left,0px))] sm:pr-[max(1.25rem,var(--safe-right,0px))] md:pl-6 md:pr-6 lg:pl-8 lg:pr-8 pb-[var(--mobile-nav-content-padding)] md:pb-8"
          >
            {!detailUser && (
              <h1 data-nav-title className="type-large-title pb-2 pt-1 md:hidden">
                {sectionTitle}
              </h1>
            )}
            <Suspense fallback={<div className="flex min-h-40 items-center justify-center" aria-hidden><Spinner /></div>}>
            {section === "dashboard" && (
              <div className="max-w-5xl space-y-8">
                <AdminStats users={clients} />

                <ListGroup header="Requiere atención">
                  <QuickAction
                    label="Planes pendientes"
                    value={clients.filter(u => u.plan_status === "plan_pending").length}
                    onClick={() => { setSection("users"); }}
                  />
                  <QuickAction
                    label="Sin pagar"
                    value={clients.filter(u => u.payment_status === "unpaid").length}
                    danger
                    onClick={() => { setSection("users"); }}
                  />
                  <QuickAction
                    label="En viaje"
                    value={clients.filter(u => u.travel_mode_until && new Date(u.travel_mode_until) >= new Date()).length}
                    onClick={() => { setSection("users"); }}
                  />
                  <QuickAction
                    label="Nuevos (hoy)"
                    value={clients.filter(u => {
                      const d = new Date(u.created_at);
                      const today = new Date();
                      return d.toDateString() === today.toDateString();
                    }).length}
                    onClick={() => { setSection("users"); }}
                  />
                </ListGroup>

                {clients.length === 0 ? (
                  <EmptyState
                    icon={UsersIcon}
                    title="Todavía no hay usuarios"
                    description="Cuando alguien se registre aparecerá aquí."
                  />
                ) : (
                  <ListGroup header="Usuarios recientes">
                    {[...clients]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .slice(0, 5)
                      .map((u) => (
                        <ListRow
                          key={u.user_id}
                          onClick={() => handleSelectUser(u)}
                          leading={
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary type-subhead font-semibold text-muted-foreground">
                              {(u.name?.trim() || u.email).charAt(0).toUpperCase()}
                            </span>
                          }
                          title={u.name?.trim() || u.email}
                          subtitle={new Date(u.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                          trailing={
                            <span className="flex items-center gap-2">
                              <PlanStatusBadge
                                planStatus={u.plan_status}
                                traveling={!!u.travel_mode_until && new Date(u.travel_mode_until) >= new Date()}
                              />
                              <PaymentDot status={u.payment_status} />
                            </span>
                          }
                        />
                      ))}
                  </ListGroup>
                )}
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
                    onBack={closeUserDetail}
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

            {section === "account" && (
              <div className="max-w-2xl">
                <SettingsPanel adminMode />
              </div>
            )}

            {section === "emails" && (
              <div className="max-w-4xl">
                <EmailTemplatesEditor />
              </div>
            )}

            {section === "metrics" && (
              <div className="max-w-7xl">
                <AdminMetrics users={clients} onRefresh={refreshUsers} />
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

function QuickAction({ label, value, danger, onClick }: { label: string; value: number; danger?: boolean; onClick: () => void }) {
  return (
    <ListRow
      title={label}
      value={<span className={`font-rounded font-semibold tabular-nums ${danger && value > 0 ? "text-destructive" : ""}`}>{value}</span>}
      chevron
      onClick={onClick}
    />
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
