import { errorMessage } from "@/lib/runtimeValues";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// Calendar feature - enabled in v1.6, hidden in v1.0
const ENABLE_CALENDAR = false;

import {
  User, Crown, ExternalLink, Calendar, CalendarClock, Check, Unplug, Link2, RefreshCw,
  Download, FileText,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MONTHLY_PRICE_EUR, DEFAULT_YEARLY_PRICE_EUR } from "@/config/pricing";
import { getWorkoutRestSeconds, REST_PRESETS, setWorkoutRestSeconds } from "@/lib/workoutPreferences";
import { getConsumerPlan, type ConsumerPlan } from "@/lib/entitlements";
import { TIERS } from "@/config/tiers";
import { getAvailabilityDayCount, getAvailabilityHours } from "@/lib/availability";
import { euro, usePlanAvailability } from "@/lib/planCatalog";
import { hapticNotify, hapticSelection, hapticTap } from "@/lib/native";
import { isIOSNative } from "@/lib/platform";
import TravelModeCard from "@/components/dashboard/TravelModeCard";
import type { Json } from "@/integrations/supabase/types";

import { useFreeCampaign } from "@/lib/freeCampaign";

const GOALS = [
  { value: "lose_weight", label: "Perder peso" },
  { value: "gain_muscle", label: "Ganar músculo" },
  { value: "improve_endurance", label: "Mejorar resistencia" },
];

const rowInput = "h-11 min-w-0 flex-1 bg-transparent px-0 text-right";
const blockTextarea = "rounded-none bg-transparent px-4";

// Row with the label on the left and the value right-aligned, like a UITableView text field cell.
const FieldRow = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) => (
  <div className="group/row flex min-h-[44px] items-center px-4">
    <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 group-[:not(:last-child)]/row:sep-b">
      <label htmlFor={htmlFor} className="shrink-0 type-body md:text-sm">{label}</label>
      {children}
    </div>
  </div>
);

// Single-choice row with a trailing check, as in Settings > General > Language.
// `focusable` gives the group a single tab stop (roving tabindex); arrows move within it.
const OptionRow = ({ label, selected, focusable, onSelect }: { label: string; selected: boolean; focusable: boolean; onSelect: () => void }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    tabIndex={focusable ? 0 : -1}
    onClick={onSelect}
    className="group/row flex min-h-[44px] w-full items-center px-4 text-left transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
  >
    <span className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 py-[11px] group-[:not(:last-child)]/row:sep-b">
      <span className="min-w-0 flex-1 truncate type-body">{label}</span>
      {selected ? <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" /> : null}
    </span>
  </button>
);

const SettingsPanel = ({ onUpgrade, adminMode = false }: { onUpgrade?: (plan: "training" | "full") => void; adminMode?: boolean } = {}) => {
  const plans = usePlanAvailability();
  const campaign = useFreeCampaign();
  const hideForAdmin = adminMode ? " hidden" : "";
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  // URL de la foto que no cargó: se muestra la inicial en vez del icono de imagen rota.
  const [failedAvatarUrl, setFailedAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [privacy, setPrivacy] = useState({ name_public: false, avatar_public: false, progress_public: false });
  const updatePrivacy = async (key: keyof typeof privacy, value: boolean) => {
    if (!user) return;
    setPrivacy((p) => ({ ...p, [key]: value }));
    const changes: import("@/integrations/supabase/types").TablesUpdate<"profiles"> = { [key]: value };
    const { error } = await supabase.from("profiles").update(changes).eq("user_id", user.id);
    if (error) {
      setPrivacy((p) => ({ ...p, [key]: !value }));
      toast.error("No se pudo guardar la privacidad");
      void hapticNotify("error");
    } else toast.success("Privacidad actualizada");
  };

  // Subscription
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [consumerPlan, setConsumerPlan] = useState<ConsumerPlan>("free");
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"monthly" | "yearly" | null>(null);
  const [yearlyPriceEur, setYearlyPriceEur] = useState<number>(DEFAULT_YEARLY_PRICE_EUR);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Onboarding
  const [onboarding, setOnboarding] = useState({
    age: "", height: "", weight: "", goal: "lose_weight",
    sports: "", availability: { days: "", hours: "" },
    nutrition_preferences: "", allergies: "",
  });
  const [hasOnboarding, setHasOnboarding] = useState(false);
  const [originalAvailability, setOriginalAvailability] = useState<Record<string, Json | undefined>>({});
  const [availabilityEdited, setAvailabilityEdited] = useState(false);

  // Google Calendar connection
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLastSync, setGcalLastSync] = useState<string | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [restSeconds, setRestSeconds] = useState(60);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [{ data: profile }, { data: onb }] = await Promise.all([
        supabase.from("profiles").select("name, email, avatar_url, subscription_status, subscription_tier, subscription_end, payment_status, stripe_payment_id, name_public, avatar_public, progress_public").eq("user_id", user.id).maybeSingle(),
        supabase.from("onboarding").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (profile) {
        setName(profile.name || "");
        setEmail(profile.email || "");
        setAvatarUrl(profile.avatar_url || "");
        setPrivacy({ name_public: !!profile.name_public, avatar_public: !!profile.avatar_public, progress_public: !!profile.progress_public });
        setSubscriptionStatus(profile.subscription_status || "inactive");
        setConsumerPlan(getConsumerPlan(profile));
        setSubscriptionEnd(profile.subscription_end);
      }

      if (onb) {
        setHasOnboarding(true);
        const avail = onb.availability;
        setOriginalAvailability(avail !== null && typeof avail === "object" && !Array.isArray(avail) ? avail : {});
        setAvailabilityEdited(false);
        setOnboarding({
          age: onb.age?.toString() || "", height: onb.height?.toString() || "",
          weight: onb.weight?.toString() || "", goal: onb.goal || "lose_weight",
          sports: onb.sports || "",
          availability: { days: getAvailabilityDayCount(avail)?.toString() ?? "", hours: getAvailabilityHours(avail)?.toString() ?? "" },
          nutrition_preferences: onb.nutrition_preferences || "", allergies: onb.allergies || "",
        });
      }
      setRestSeconds(getWorkoutRestSeconds(user.id));
      setLoading(false);

      // Fetch current plan (monthly/yearly) from check-subscription + yearly price
      supabase.rpc("get_public_settings").then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.yearly_price_eur) setYearlyPriceEur(row.yearly_price_eur);
      });
      supabase.functions.invoke("check-subscription").then(({ data }) => {
        if (data?.plan === "monthly" || data?.plan === "yearly") setCurrentPlan(data.plan);
      });

      // Fetch Google Calendar connection status
      supabase
        .from("google_calendar_connections")
        .select("last_sync_at")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setGcalConnected(!!data);
          setGcalLastSync(data?.last_sync_at || null);
        });
    };
    fetch();
  }, [user]);

  const handleConnectGoogle = async () => {
    setGcalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gcal-oauth-start", {
        body: { return_to: window.location.href },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch {
      toast.error("No se pudo iniciar la conexión con Google");
      void hapticNotify("error");
      setGcalLoading(false);
    }
  };

  const handleSyncGoogle = async () => {
    setGcalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gcal-sync");
      if (error) throw error;
      const parts = [`${data.synced}/${data.total} eventos sincronizados`];
      if (data.deleted) parts.push(`${data.deleted} obsoletos eliminados`);
      toast.success(parts.join(" · "));
      void hapticNotify("success");
      if (data.errors?.length) {
        toast.error(`${data.errors.length} eventos fallaron. Revisa los logs.`);
        void hapticNotify("error");
        console.warn("[gcal-sync] errors:", data.errors);
      }
      setGcalLastSync(new Date().toISOString());
    } catch {
      toast.error("Error al sincronizar");
      void hapticNotify("error");
    } finally {
      setGcalLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setGcalLoading(true);
    try {
      const { error } = await supabase.functions.invoke("gcal-disconnect");
      if (error) throw error;
      setGcalConnected(false);
      setGcalLastSync(null);
      toast.success("Google Calendar desconectado");
    } catch {
      toast.error("Error al desconectar");
      void hapticNotify("error");
    } finally {
      setGcalLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("La imagen no puede superar 2MB"); void hapticNotify("error"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Error al subir la imagen"); void hapticNotify("error"); setUploading(false); return; }
    const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${publicUrl.publicUrl}?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setAvatarUrl(url);
    toast.success("Foto actualizada");
    setUploading(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name, email }).eq("user_id", user.id);
    if (email !== user.email) {
      const { error: emailErr } = await supabase.auth.updateUser({ email });
      if (emailErr) { toast.error("Error al cambiar email: " + emailErr.message); void hapticNotify("error"); setSaving(false); return; }
      toast.info("Se ha enviado un email de confirmación al nuevo correo");
    }
    if (!error) { toast.success("Perfil guardado"); void hapticNotify("success"); }
    else { toast.error("Error al guardar"); void hapticNotify("error"); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); void hapticNotify("error"); return; }
    if (newPassword !== confirmPassword) { toast.error("Las contraseñas no coinciden"); void hapticNotify("error"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) { toast.success("Contraseña actualizada"); void hapticNotify("success"); setNewPassword(""); setConfirmPassword(""); }
    else { toast.error("Error: " + error.message); void hapticNotify("error"); }
    setChangingPassword(false);
  };

  const saveOnboarding = async () => {
    if (!user) return;
    if (availabilityEdited) {
      const days = getAvailabilityDayCount(onboarding.availability);
      if (days === null || days < 1 || getAvailabilityHours(onboarding.availability) === null) {
        toast.error("Indica entre 1 y 7 días y una duración válida para cada sesión.");
        void hapticNotify("error");
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase.from("onboarding").upsert({
      user_id: user.id,
      age: parseInt(onboarding.age) || null, height: parseFloat(onboarding.height) || null,
      weight: parseFloat(onboarding.weight) || null, goal: onboarding.goal, sports: onboarding.sports,
      availability: availabilityEdited
        ? { ...originalAvailability, ...onboarding.availability, auto_calculated: false }
        : originalAvailability,
      nutrition_preferences: onboarding.nutrition_preferences,
      allergies: onboarding.allergies,
    }, { onConflict: "user_id" });
    if (!error) { toast.success("Datos actualizados"); void hapticNotify("success"); }
    else { console.error("saveOnboarding", error); toast.error(`No se pudo guardar: ${error.message}`); void hapticNotify("error"); }
    setSaving(false);
  };

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (data?.no_customer) {
      toast.info("Tu acceso lo gestiona tu entrenador manualmente. Escríbele por el chat para cambiar o cancelar tu plan.");
      setLoadingPortal(false);
      return;
    }
    if (error || !data?.url) {
      toast.error("No se pudo abrir la gestión de tu suscripción. Escríbele a tu entrenador por el chat y lo resuelve.");
      void hapticNotify("error");
      setLoadingPortal(false);
      return;
    }
    window.open(data.url, "_blank");
    setLoadingPortal(false);
  };

  const deleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) {
      toast.error("Error al eliminar la cuenta. Inténtalo de nuevo.");
      void hapticNotify("error");
      setDeleting(false);
      return;
    }
    await signOut();
    navigate("/");
    toast.success("Cuenta eliminada permanentemente");
  };

  const exportMyData = async () => {
    setExporting(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;
      if (!token) throw new Error("No autenticado");
      const url = `https://enebrcdrdnfkyduzyrzm.supabase.co/functions/v1/export-user-data`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `autopilot-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Tus datos se han descargado");
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "No se pudieron exportar tus datos");
      void hapticNotify("error");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  const iosReader = isIOSNative();
  const initial = (name || email).trim().charAt(0).toLocaleUpperCase("es");
  const hasPaidAccess = consumerPlan !== "free";
  const isActive = hasPaidAccess && ["active", "trialing"].includes(subscriptionStatus);
  const planName = consumerPlan === "coach" ? TIERS.full.name : consumerPlan === "plus" ? TIERS.training.name : TIERS.free.name;
  const longDate = (value: string) =>
    new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const planCycle = currentPlan === "monthly" ? "Mensual" : "Anual";
  const planCyclePrice = currentPlan === "monthly" ? `${MONTHLY_PRICE_EUR}€/mes` : `${yearlyPriceEur}€/año`;
  // iOS es una app de lectura: ni precios, ni ofertas, ni portal de pago.
  const subscriptionFooter = iosReader
    ? undefined
    : hasPaidAccess
      ? currentPlan === "monthly"
        ? `Cambia a Anual y ahorra ${MONTHLY_PRICE_EUR * 12 - yearlyPriceEur}€/año desde el portal de gestión.`
        : currentPlan
          ? "Puedes cambiar a Mensual desde el portal de gestión cuando quieras."
          : undefined
      : "No tienes una suscripción activa. Empieza cuando quieras: 7 días de prueba.";

  const setAvailability = (field: "days" | "hours", value: string) => {
    setAvailabilityEdited(true);
    setOnboarding((o) => ({ ...o, availability: { ...o.availability, [field]: value } }));
  };

  const selectGoal = (value: string) => {
    void hapticSelection();
    setOnboarding((o) => ({ ...o, goal: value }));
  };

  // Arrow keys move the selection inside the goal radio group, as the Radix RadioGroup did.
  const handleGoalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
    const current = (e.target as HTMLElement).closest<HTMLElement>('[role="radio"]');
    const from = current ? radios.indexOf(current) : -1;
    if (from === -1) return;
    e.preventDefault();
    const to = (from + step + GOALS.length) % GOALS.length;
    selectGoal(GOALS[to].value);
    radios[to]?.focus();
  };
  const goalTabStop = GOALS.some((g) => g.value === onboarding.goal) ? onboarding.goal : GOALS[0].value;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* Profile */}
      <div className="order-1 flex flex-col gap-6">
        <div className="flex flex-col items-center px-4 pt-2 text-center">
          <button
            type="button"
            aria-label="Cambiar foto de perfil"
            onClick={() => { void hapticTap(); fileInputRef.current?.click(); }}
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary transition-opacity active:opacity-70"
          >
            {avatarUrl && avatarUrl !== failedAvatarUrl ? (
              <img
                loading="lazy"
                decoding="async"
                src={avatarUrl}
                alt=""
                onError={() => setFailedAvatarUrl(avatarUrl)}
                className="h-full w-full object-cover"
              />
            ) : initial ? (
              <span aria-hidden="true" className="font-rounded type-large-title text-muted-foreground">{initial}</span>
            ) : (
              <User className="h-9 w-9 text-muted-foreground" />
            )}
            {uploading ? (
              <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Spinner size="md" className="text-foreground" label="Subiendo foto" />
              </span>
            ) : null}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          <p className="mt-3 max-w-full truncate type-title2">{name || "Tu perfil"}</p>
          {email ? <p className="max-w-full truncate type-body text-muted-foreground">{email}</p> : null}
          <Button variant="plain" className="mt-1" onClick={() => { void hapticTap(); fileInputRef.current?.click(); }}>
            Cambiar foto
          </Button>
        </div>

        <ListGroup header="Perfil">
          <FieldRow label="Nombre" htmlFor="settings-name">
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              autoCapitalize="words"
              autoComplete="name"
              enterKeyHint="next"
              className={rowInput}
            />
          </FieldRow>
          <FieldRow label="Correo" htmlFor="settings-email">
            <Input
              id="settings-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="email"
              enterKeyHint="done"
              aria-label="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              className={rowInput}
            />
          </FieldRow>
          <ListRow
            title={<span className="text-primary">{saving ? "Guardando…" : "Guardar perfil"}</span>}
            disabled={saving}
            onClick={() => void saveProfile()}
          />
        </ListGroup>

        <ListGroup
          className={hideForAdmin.trim()}
          header="Privacidad"
          footer="Tu entrenador siempre te ve. Esto decide qué pueden ver los demás."
        >
          {([
            ["name_public", "Nombre público", "Si está apagado, se muestran solo tus iniciales."],
            ["avatar_public", "Foto de perfil pública", "Si está apagado, se muestra un icono genérico."],
            ["progress_public", "Progreso público", "Permite mostrar tu evolución (fotos, logros) fuera de tu cuenta."],
          ] as const).map(([key, label, hint]) => (
            <ListRow
              key={key}
              title={label}
              subtitle={hint}
              trailing={
                <Switch
                  checked={privacy[key]}
                  onCheckedChange={(v) => { void hapticSelection(); void updatePrivacy(key, v); }}
                  aria-label={label}
                />
              }
            />
          ))}
        </ListGroup>
      </div>

      {/* Onboarding data */}
      {hasOnboarding && (
        <div className={`order-2 flex flex-col gap-6${hideForAdmin}`}>
          <ListGroup header="Tus datos">
            <FieldRow label="Edad" htmlFor="settings-age">
              <Input id="settings-age" type="number" inputMode="numeric" enterKeyHint="next" value={onboarding.age} onChange={(e) => setOnboarding((o) => ({ ...o, age: e.target.value }))} className={rowInput} />
            </FieldRow>
            <FieldRow label="Altura (cm)" htmlFor="settings-height">
              <Input id="settings-height" type="number" inputMode="decimal" enterKeyHint="next" value={onboarding.height} onChange={(e) => setOnboarding((o) => ({ ...o, height: e.target.value }))} className={rowInput} />
            </FieldRow>
            <FieldRow label="Peso (kg)" htmlFor="settings-weight">
              <Input id="settings-weight" type="number" inputMode="decimal" enterKeyHint="done" value={onboarding.weight} onChange={(e) => setOnboarding((o) => ({ ...o, weight: e.target.value }))} className={rowInput} />
            </FieldRow>
          </ListGroup>

          <ListGroup header="Objetivo">
            <div role="radiogroup" aria-label="Objetivo" onKeyDown={handleGoalKeyDown}>
              {GOALS.map((opt) => (
                <OptionRow
                  key={opt.value}
                  label={opt.label}
                  selected={onboarding.goal === opt.value}
                  focusable={goalTabStop === opt.value}
                  onSelect={() => selectGoal(opt.value)}
                />
              ))}
            </div>
          </ListGroup>

          <ListGroup header="Disponibilidad">
            <FieldRow label="Días/semana" htmlFor="availability-days">
              <Input id="availability-days" type="number" inputMode="numeric" enterKeyHint="next" min={1} max={7} value={onboarding.availability.days} onChange={(e) => setAvailability("days", e.target.value)} className={rowInput} />
            </FieldRow>
            <FieldRow label="Horas/sesión" htmlFor="availability-hours">
              <Input id="availability-hours" type="number" inputMode="decimal" enterKeyHint="done" min={0.25} max={24} step="0.01" value={onboarding.availability.hours} onChange={(e) => setAvailability("hours", e.target.value)} className={rowInput} />
            </FieldRow>
          </ListGroup>

          <ListGroup header="Deportes">
            <Textarea aria-label="Deportes" value={onboarding.sports} onChange={(e) => setOnboarding((o) => ({ ...o, sports: e.target.value }))} className={blockTextarea} rows={2} />
          </ListGroup>
          <ListGroup header="Preferencias nutricionales">
            <Textarea aria-label="Preferencias nutricionales" value={onboarding.nutrition_preferences} onChange={(e) => setOnboarding((o) => ({ ...o, nutrition_preferences: e.target.value }))} className={blockTextarea} rows={2} />
          </ListGroup>
          <ListGroup header="Alergias">
            <Textarea aria-label="Alergias" value={onboarding.allergies} onChange={(e) => setOnboarding((o) => ({ ...o, allergies: e.target.value }))} className={blockTextarea} rows={2} />
          </ListGroup>

          <ListGroup>
            <ListRow
              title={<span className="text-primary">{saving ? "Guardando…" : "Guardar datos"}</span>}
              disabled={saving}
              onClick={() => void saveOnboarding()}
            />
          </ListGroup>
        </div>
      )}

      {/* Workout preferences */}
      <ListGroup
        className={`order-3${hideForAdmin}`}
        header="Tu forma de entrenar"
        footer="Elige cuánto quieres descansar al marcar una serie. El temporizador se inicia solo durante tu entreno. Puedes cambiarlo cuando quieras. El descanso específico de cada ejercicio sigue apareciendo en tu plan."
      >
        <div className="group/row px-4">
          <div className="py-3 group-[:not(:last-child)]/row:sep-b">
            <p className="mb-2 type-body">Descanso entre series</p>
            <Tabs
              value={String(restSeconds)}
              onValueChange={(value) => {
                if (!user) return;
                void hapticSelection();
                const saved = setWorkoutRestSeconds(user.id, Number(value));
                setRestSeconds(saved);
              }}
            >
              <TabsList className="w-full" aria-label="Descanso entre series">
                {REST_PRESETS.map((seconds) => (
                  // There is no TabsContent: drop the dangling aria-controls Radix would emit.
                  <TabsTrigger key={seconds} value={String(seconds)} className="px-1" aria-controls={undefined}>
                    {seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
        <FieldRow label="Personalizado" htmlFor="settings-rest-custom">
          <Input
            id="settings-rest-custom"
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            min={15}
            max={600}
            step={5}
            value={restSeconds}
            onChange={(e) => setRestSeconds(Number(e.target.value) || 0)}
            onBlur={() => {
              if (!user) return;
              const saved = setWorkoutRestSeconds(user.id, restSeconds);
              setRestSeconds(saved);
            }}
            aria-label="Descanso personalizado en segundos"
            className={rowInput}
          />
          <span className="shrink-0 type-body text-muted-foreground md:text-sm">segundos</span>
        </FieldRow>
      </ListGroup>

      {/* Password */}
      <div className="order-4">
        <ListGroup header="Cambiar contraseña">
          <FieldRow label="Nueva" htmlFor="settings-new-password">
            <Input
              id="settings-new-password"
              type="password"
              autoComplete="new-password"
              enterKeyHint="next"
              aria-label="Nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={rowInput}
            />
          </FieldRow>
          <FieldRow label="Confirmar" htmlFor="settings-confirm-password">
            <Input
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
              enterKeyHint="done"
              aria-label="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              className={rowInput}
            />
          </FieldRow>
          <ListRow
            title={<span className="text-primary">{changingPassword ? "Cambiando…" : "Cambiar contraseña"}</span>}
            disabled={changingPassword}
            onClick={() => void changePassword()}
          />
        </ListGroup>
      </div>

      {/* Subscription */}
      {(!campaign || consumerPlan !== "free") && <div className={`order-5 space-y-3${hideForAdmin}`}>
        <ListGroup header="Suscripción" footer={subscriptionFooter}>
          <ListRow
            icon={<Crown className={hasPaidAccess ? undefined : "text-muted-foreground"} />}
            title={`Plan ${planName}`}
            subtitle={
              isActive
                ? (subscriptionStatus === "trialing" ? "Prueba gratuita activa" : "Suscripción activa")
                : hasPaidAccess ? "Acceso activo (pago único)" : "Cuenta Free · entrenador opcional"
            }
          />
          {subscriptionEnd && isActive ? (
            <ListRow
              icon={<Calendar className="text-muted-foreground" />}
              title={subscriptionStatus === "trialing" ? "Fin de la prueba" : "Próxima renovación"}
              value={new Date(subscriptionEnd).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
            />
          ) : null}
          {hasPaidAccess && currentPlan ? (
            <ListRow title="Plan actual" value={iosReader ? planCycle : `${planCycle} (${planCyclePrice})`} />
          ) : null}
          {hasPaidAccess && !iosReader ? (
            <ListRow
              icon={<ExternalLink className="text-muted-foreground" />}
              title="Gestionar suscripción"
              chevron={!loadingPortal}
              trailing={loadingPortal ? <Spinner size="sm" /> : undefined}
              onClick={() => { if (!loadingPortal) void handleManageSubscription(); }}
            />
          ) : null}
        </ListGroup>
        {!campaign && plans.plus && !iosReader && !hasPaidAccess && onUpgrade && (
          <div className="space-y-1">
            <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticTap(); onUpgrade("training"); }}>
              Mejorar a {plans.plusName} · {euro(plans.plusPrice)}/mes
            </Button>
            {plans.coach && (
              <Button variant="plain" className="w-full" onClick={() => { void hapticTap(); onUpgrade("full"); }}>
                Ver {plans.coachName} · Nicolás revisa tu plan
              </Button>
            )}
          </div>
        )}
      </div>}

      {/* Calendar */}
      {ENABLE_CALENDAR && <ListGroup
        className={`order-6${hideForAdmin}`}
        header={
          <span className="inline-flex items-center gap-2">
            Google Calendar
            {gcalLoading ? <Spinner size="sm" /> : null}
          </span>
        }
        footer={gcalConnected ? undefined : "Sincroniza tus entrenos y comidas directamente en tu Google Calendar."}
      >
        {gcalConnected ? (
          <ListRow
            icon={<Check className="text-success" />}
            title="Conectado"
            subtitle={gcalLastSync ? `Última sync: ${new Date(gcalLastSync).toLocaleString("es-ES")}` : undefined}
          />
        ) : null}
        <ListRow
          icon={<CalendarClock className="text-muted-foreground" />}
          title="Horarios y disponibilidad"
          aria-label="Horarios y disponibilidad"
          chevron
          onClick={() => navigate("/my-schedule")}
        />
        {gcalConnected ? (
          <>
            <ListRow icon={<RefreshCw className="text-muted-foreground" />} title="Sincronizar" disabled={gcalLoading} onClick={handleSyncGoogle} />
            <ListRow
              icon={<Unplug className="text-destructive" />}
              title="Desconectar"
              destructive
              disabled={gcalLoading}
              onClick={handleDisconnectGoogle}
            />
          </>
        ) : (
          <ListRow
            icon={<Link2 />}
            title={<span className="text-primary">Conectar</span>}
            aria-label="Conectar Google Calendar"
            disabled={gcalLoading}
            onClick={handleConnectGoogle}
          />
        )}
      </ListGroup>}

      {/* Privacy & Data (RGPD) */}
      <div className={`order-7 flex flex-col gap-6${hideForAdmin}`}>
        <ListGroup
          header="Privacidad y mis datos"
          footer="Conforme al RGPD tienes derecho a acceder, portar y eliminar tus datos en cualquier momento."
        >
          <ListRow
            icon={<Download className="text-muted-foreground" />}
            title={exporting ? "Generando…" : "Exportar mis datos"}
            subtitle="Descarga un JSON con todo lo que tenemos sobre ti."
            trailing={exporting ? <Spinner size="sm" /> : undefined}
            onClick={() => { if (!exporting) void exportMyData(); }}
          />
          <ListRow
            icon={<FileText className="text-muted-foreground" />}
            title="Ver Política de Privacidad"
            subtitle="Qué datos tratamos y con qué base legal."
            chevron
            to="/legal/privacidad"
          />
        </ListGroup>
        <ListGroup header="Legal">
          <ListRow title="Términos" chevron to="/legal/terminos" />
          <ListRow title="Cookies" chevron to="/legal/cookies" />
          <ListRow title="Disclaimer médico" chevron to="/legal/disclaimer-medico" />
          <ListRow title="Aviso legal" chevron to="/legal/aviso-legal" />
        </ListGroup>
      </div>

      {/* Travel mode */}
      <div className={`order-[7]${hideForAdmin}`}>
        <TravelModeCard userId={user.id} />
      </div>

      {/* Sign out */}
      <ListGroup className="order-8" header="Sesión" footer="Cierra tu sesión en este dispositivo.">
        <ListRow
          title="Cerrar sesión"
          destructive
          onClick={async () => { sessionStorage.removeItem("autopilot_section"); await signOut(); navigate("/login", { replace: true }); }}
        />
      </ListGroup>

      {/* Delete account */}
      <div className={`order-9${hideForAdmin}`}>
        <ListGroup>
          <ListRow
            title="Eliminar cuenta"
            destructive
            onClick={() => { void hapticNotify("warning"); setConfirmingDelete(true); }}
          />
        </ListGroup>
        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  {isActive && (
                    <div className="space-y-1">
                      <p className="type-footnote font-semibold text-destructive">
                        {subscriptionStatus === "trialing"
                          ? "Tienes una prueba activa"
                          : "Tienes una suscripción activa"}
                      </p>
                      <p className="type-footnote text-foreground">
                        {subscriptionStatus === "trialing"
                          ? "Al eliminar la cuenta cancelas la prueba y pierdes el acceso de inmediato — aunque aún no se te haya cobrado."
                          : "Al eliminar la cuenta se cancela la suscripción y pierdes el acceso de inmediato, aunque hayas pagado hasta el final del periodo."}
                      </p>
                      {subscriptionEnd && (
                        <p className="type-caption1 text-muted-foreground">
                          Fecha prevista: {longDate(subscriptionEnd)}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="type-footnote text-muted-foreground">
                    Esta acción elimina permanentemente tu cuenta, tus planes, tu progreso, tus fotos y tus mensajes. No se puede deshacer.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter stacked>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction destructive onClick={deleteAccount} disabled={deleting}>
                {deleting ? "Eliminando…" : "Sí, eliminar cuenta"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default SettingsPanel;
