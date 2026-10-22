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
import { getWorkoutRestSeconds, REST_PRESETS, setWorkoutRestSeconds, getWorkoutView, setWorkoutView, type WorkoutView } from "@/lib/workoutPreferences";
import { getConsumerPlan, type ConsumerPlan } from "@/lib/entitlements";
import { TIERS } from "@/config/tiers";
import { getAvailabilityDayCount, getAvailabilityHours } from "@/lib/availability";
import { euro, usePlanAvailability } from "@/lib/planCatalog";
import { hapticNotify, hapticSelection, hapticTap } from "@/lib/native";
import { isIOSNative, isNativeApp } from "@/lib/platform";
import { compressImage } from "@/lib/imageCompression";
import TravelModeCard from "@/components/dashboard/TravelModeCard";
import type { Json } from "@/integrations/supabase/types";

import { useFreeCampaign } from "@/lib/freeCampaign";

const GOALS = [
  { value: "lose_weight", label: "Perder peso" },
  { value: "gain_muscle", label: "Ganar músculo" },
  { value: "improve_endurance", label: "Mejorar resistencia" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// La foto se comprime antes de subir: aceptamos el original de la cámara (hasta
// 10 MB) y exigimos que el resultado comprimido quede por debajo de 2 MB.
const AVATAR_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Los errores de Supabase Auth llegan en inglés; aquí se explican en español. */
const emailChangeError = (message: string): string => {
  const text = message.toLowerCase();
  if (text.includes("rate limit") || text.includes("too many")) return "Has pedido demasiados cambios de correo. Espera unos minutos y vuelve a intentarlo.";
  if (text.includes("already") || text.includes("registered") || text.includes("exists")) return "Ese correo ya está en uso en otra cuenta.";
  if (text.includes("invalid") || text.includes("format")) return "Ese correo no parece válido. Revisa que tenga el formato nombre@dominio.com.";
  return "No se pudo cambiar el correo. Inténtalo de nuevo o escríbenos por el chat.";
};

type RowSaveState = "idle" | "saving" | "saved";


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
  // Estado de guardado por fila: la de perfil y la de datos tienen el suyo para
  // que "Guardado" no aparezca en la fila equivocada.
  const [profileSaveState, setProfileSaveState] = useState<RowSaveState>("idle");
  const [dataSaveState, setDataSaveState] = useState<RowSaveState>("idle");
  // Correo nuevo a la espera de que Supabase mande la confirmación.
  const [pendingEmail, setPendingEmail] = useState("");
  // El plan de comidas deja de cuadrar cuando cambian peso, objetivo, dieta o alergias.
  const [mealsOutdated, setMealsOutdated] = useState(false);
  const [regeneratingMeals, setRegeneratingMeals] = useState(false);
  const [confirmingMeals, setConfirmingMeals] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
    }
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
  // Copia de lo guardado para saber si el cambio afecta a la nutrición (peso,
  // objetivo, dieta o alergias) sin fiarse de re-renderizados.
  const [savedNutrition, setSavedNutrition] = useState({
    weight: "", goal: "lose_weight", nutrition_preferences: "", allergies: "",
  });
  const [originalAvailability, setOriginalAvailability] = useState<Record<string, Json | undefined>>({});
  const [availabilityEdited, setAvailabilityEdited] = useState(false);

  // Google Calendar connection
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLastSync, setGcalLastSync] = useState<string | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [restSeconds, setRestSeconds] = useState(60);
  const [workoutView, setWorkoutViewState] = useState<WorkoutView>("list");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [{ data: profile }, { data: onb }] = await Promise.all([
        supabase.from("profiles").select("name, email, avatar_url, subscription_status, subscription_tier, subscription_end, payment_status, stripe_payment_id, name_public, avatar_public, progress_public").eq("user_id", user.id).maybeSingle(),
        supabase.from("onboarding").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (profile) {
        setName(profile.name || "");
        // Auth es la fuente de verdad del correo: profiles.email pudo quedar
        // desfasado por el flujo antiguo que lo escribía antes de confirmarlo.
        setEmail(user.email || profile.email || "");
        // La sesión puede traer un cambio de correo aún sin confirmar.
        if (user.new_email) setPendingEmail(user.new_email);
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
        const saved = {
          weight: onb.weight?.toString() || "",
          goal: onb.goal || "lose_weight",
          nutrition_preferences: onb.nutrition_preferences || "",
          allergies: onb.allergies || "",
        };
        setSavedNutrition(saved);
        setOnboarding({
          age: onb.age?.toString() || "", height: onb.height?.toString() || "",
          weight: saved.weight, goal: saved.goal,
          sports: onb.sports || "",
          availability: { days: getAvailabilityDayCount(avail)?.toString() ?? "", hours: getAvailabilityHours(avail)?.toString() ?? "" },
          nutrition_preferences: saved.nutrition_preferences, allergies: saved.allergies,
        });
      }
      setRestSeconds(getWorkoutRestSeconds(user.id));
      setWorkoutViewState(getWorkoutView(user.id));
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
    // Permite volver a elegir la misma foto aunque la validación falle.
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Ese archivo no es una imagen. Usa JPG, PNG o WebP.");
      void hapticNotify("error");
      return;
    }
    if (file.size > AVATAR_MAX_SOURCE_BYTES) {
      toast.error("La imagen es demasiado grande (máximo 10 MB).");
      void hapticNotify("error");
      return;
    }

    setUploading(true);
    try {
      // Comprimimos en el navegador antes de subir: una foto de cámara pesa
      // 4-12 MB y la de perfil se muestra a 80 px, así que no hace falta.
      const compressed = await compressImage(file, { maxDimension: 1024, quality: 0.82, mimeType: "image/jpeg" });
      if (compressed.size > AVATAR_MAX_UPLOAD_BYTES) {
        toast.error("La imagen sigue siendo demasiado grande después de comprimirla. Prueba con otra foto.");
        void hapticNotify("error");
        return;
      }

      const ext = /^image\/(png|webp|gif)$/.exec(compressed.type)?.[1] ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: compressed.type });
      if (uploadError) {
        toast.error("No se pudo subir la foto. Inténtalo de nuevo.");
        void hapticNotify("error");
        return;
      }

      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${publicUrl.publicUrl}?t=${Date.now()}`;
      const { error: profileError } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      if (profileError) {
        toast.error("La foto se subió pero no se pudo guardar en tu perfil. Inténtalo de nuevo.");
        void hapticNotify("error");
        return;
      }
      setAvatarUrl(url);
      setFailedAvatarUrl("");
      toast.success("Foto actualizada");
      void hapticNotify("success");
    } catch {
      toast.error("No se pudo preparar la foto. Prueba con otra imagen.");
      void hapticNotify("error");
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    const nextName = name.trim();
    const nextEmail = email.trim().toLowerCase();
    const currentEmail = (user.email || "").trim().toLowerCase();
    const emailChanged = nextEmail !== currentEmail;
    if (emailChanged && !EMAIL_PATTERN.test(nextEmail)) {
      toast.error("Ese correo no parece válido. Revisa que tenga el formato nombre@dominio.com.");
      void hapticNotify("error");
      return;
    }

    setProfileSaveState("saving");
    // 1) Auth manda. Si el cambio de correo falla, no escribimos nada en
    // profiles: nunca mostrar como confirmado un correo que Supabase rechazó.
    let pendingConfirmation = false;
    if (emailChanged) {
      const { data: authData, error: authError } = await supabase.auth.updateUser({ email: nextEmail });
      if (authError) {
        toast.error(emailChangeError(authError.message));
        void hapticNotify("error");
        setProfileSaveState("idle");
        return;
      }
      // Con doble confirmación, user.email sigue siendo el antiguo y el nuevo
      // queda en new_email hasta que la persona lo confirme.
      pendingConfirmation = (authData.user?.email || "").trim().toLowerCase() !== nextEmail;
    }

    // 2) En profiles solo se escribe el correo cuando Auth ya lo aceptó como
    // confirmado; si queda pendiente, solo se guarda el nombre.
    const changes: import("@/integrations/supabase/types").TablesUpdate<"profiles"> = pendingConfirmation
      ? { name: nextName }
      : { name: nextName, ...(emailChanged ? { email: nextEmail } : {}) };
    const { error } = await supabase.from("profiles").update(changes).eq("user_id", user.id);
    if (error) {
      toast.error(pendingConfirmation
        ? "Te enviamos la confirmación del correo, pero no se pudo guardar el nombre. Inténtalo de nuevo."
        : "No se pudo guardar el perfil. Revisa tu conexión e inténtalo de nuevo.");
      void hapticNotify("error");
      setProfileSaveState("idle");
      return;
    }

    if (emailChanged) {
      setEmail(nextEmail);
      setPendingEmail(pendingConfirmation ? nextEmail : "");
    }
    toast.success("Perfil guardado");
    if (pendingConfirmation) {
      toast.info(`Te hemos enviado un correo de confirmación a ${nextEmail}. El cambio se aplicará cuando lo confirmes.`);
    }
    void hapticNotify("success");
    setProfileSaveState("saved");
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

    // Si cambia algo que entra en la fórmula (peso, objetivo, dieta o alergias)
    // las comidas guardadas dejan de cuadrar con los macros nuevos.
    const nextNutrition = {
      weight: onboarding.weight.trim(),
      goal: onboarding.goal,
      nutrition_preferences: onboarding.nutrition_preferences.trim(),
      allergies: onboarding.allergies.trim(),
    };
    const nutritionInputsChanged =
      nextNutrition.weight !== savedNutrition.weight.trim() ||
      nextNutrition.goal !== savedNutrition.goal ||
      nextNutrition.nutrition_preferences !== savedNutrition.nutrition_preferences.trim() ||
      nextNutrition.allergies !== savedNutrition.allergies.trim();

    setDataSaveState("saving");
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
    if (error) {
      console.error("saveOnboarding", error);
      toast.error(`No se pudo guardar: ${error.message}`);
      void hapticNotify("error");
      setDataSaveState("idle");
      return;
    }

    setSavedNutrition(nextNutrition);
    void hapticNotify("success");
    toast.success("Datos guardados");
    window.dispatchEvent(new Event("autopilot:onboarding-updated"));

    // La sincronización de macros puede fallar o no aplicar: siempre se informa.
    const { data: sync, error: syncError } = await supabase.functions.invoke("sync-nutrition-macros");
    if (syncError) {
      toast.error("Tus datos se han guardado, pero no se pudo actualizar la nutrición. Inténtalo de nuevo.");
    } else if (sync?.updated) {
      toast.success("Macros actualizados");
      window.dispatchEvent(new Event("autopilot:nutrition-plan-updated"));
      if (nutritionInputsChanged) setMealsOutdated(true);
    } else {
      switch (sync?.reason) {
        case "no_access":
          toast.info("Tus datos se han guardado. La nutrición no se actualiza porque tu plan actual no la incluye.");
          break;
        case "no_weight":
          toast.info("Tus datos se han guardado. Añade tu peso para que podamos calcular los macros.");
          break;
        case "invalid":
          toast.error("Tus datos se han guardado, pero los macros calculados no son válidos. Revisa peso y objetivo.");
          break;
        default:
          toast.error("Tus datos se han guardado, pero no se pudo actualizar la nutrición.");
      }
    }
    setDataSaveState("saved");
  };

  // "Regenerar comidas": lo hace el servidor (sync-nutrition-macros con
  // regenerate_meals). El cliente no puede escribir nutrition_plan por RLS y
  // generate-plan también regeneraría el entrenamiento (y está bloqueado para
  // Coach), así que esta es la vía que solo cambia las comidas.
  const regenerateMeals = async () => {
    if (!user || regeneratingMeals) return;
    setRegeneratingMeals(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-nutrition-macros", {
        body: { regenerate_meals: true },
      });
      if (error) {
        toast.error("No se pudieron regenerar las comidas. Revisa tu conexión e inténtalo de nuevo.");
        void hapticNotify("error");
        return;
      }
      if (data?.updated && data?.meals_updated) {
        setMealsOutdated(false);
        window.dispatchEvent(new Event("autopilot:nutrition-plan-updated"));
        toast.success("Comidas actualizadas");
        void hapticNotify("success");
        return;
      }
      if (data?.updated === false) {
        if (data.reason === "no_access") toast.info("Tu plan actual no incluye nutrición, así que no se pueden regenerar las comidas.");
        else if (data.reason === "no_weight") toast.error("Añade tu peso antes de regenerar las comidas.");
        else toast.error("No se pudieron regenerar las comidas. Revisa tu peso y objetivo e inténtalo de nuevo.");
        void hapticNotify("error");
        return;
      }
      // Macros sí, comidas no: el aviso de "desactualizado" se queda para reintentar.
      toast.error("Los macros se actualizaron, pero no se pudieron generar las comidas. Inténtalo de nuevo en unos minutos.");
      void hapticNotify("error");
    } catch {
      toast.error("No se pudieron regenerar las comidas. Revisa tu conexión e inténtalo de nuevo.");
      void hapticNotify("error");
    } finally {
      setRegeneratingMeals(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    const { data, error } = await supabase.functions.invoke("customer-portal");
    const supportMail = "mailto:soporte@autopilotplan.com?subject=Gesti%C3%B3n%20de%20suscripci%C3%B3n%20Autopilot";
    const supportAction = { label: "Escribir", onClick: () => { window.location.href = supportMail; } };
    if (data?.no_customer) {
      toast.info("Tu acceso se gestiona manualmente. Escríbenos a soporte@autopilotplan.com para cambiar o cancelar tu plan.", { action: supportAction });
      setLoadingPortal(false);
      return;
    }
    if (error || !data?.url) {
      toast.error("No se pudo abrir la gestión de tu suscripción. Escríbenos a soporte@autopilotplan.com y lo resolvemos.", { action: supportAction });
      void hapticNotify("error");
      setLoadingPortal(false);
      return;
    }
    if (isNativeApp()) {
      // Nunca `window.open` dentro de la WebView: abre una pestaña que no
      // vuelve a la app. `Browser.open` usa SFSafariViewController.
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: data.url, presentationStyle: "popover" });
    } else {
      window.open(data.url, "_blank");
    }
    setLoadingPortal(false);
  };

  const cancelSubscription = async () => {
    setCancelling(true);
    const { data, error } = await supabase.functions.invoke("cancel-subscription");
    setCancelling(false);
    setConfirmingCancel(false);
    if (error || data?.error) {
      toast.error("No se pudo cancelar la suscripción. Inténtalo de nuevo.");
      void hapticNotify("error");
      return;
    }
    if (data?.canceled) {
      toast.success("Suscripción cancelada. Mantienes el acceso hasta el final del periodo.");
      void hapticNotify("success");
    } else {
      toast.info("Tu acceso lo gestiona tu entrenador. Escríbenos y lo cancelamos.");
    }
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

  const iosNoPurchases = isIOSNative();
  const initial = (name || email).trim().charAt(0).toLocaleUpperCase("es");
  const hasPaidAccess = consumerPlan !== "free";
  const isActive = hasPaidAccess && ["active", "trialing"].includes(subscriptionStatus);
  const planName = consumerPlan === "coach" ? TIERS.full.name : consumerPlan === "plus" ? TIERS.training.name : TIERS.free.name;
  const longDate = (value: string) =>
    new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const planCycle = currentPlan === "monthly" ? "Mensual" : "Anual";
  const planCyclePrice = currentPlan === "monthly" ? `${MONTHLY_PRICE_EUR}€/mes` : `${yearlyPriceEur}€/año`;
  // iOS: sin precios, ofertas ni compra in-app (App Store §3.1.1).
  const subscriptionFooter = iosNoPurchases
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
    setDataSaveState("idle");
    setOnboarding((o) => ({ ...o, availability: { ...o.availability, [field]: value } }));
  };

  const editOnboarding = (patch: Partial<typeof onboarding>) => {
    setDataSaveState("idle");
    setOnboarding((o) => ({ ...o, ...patch }));
  };

  const selectGoal = (value: string) => {
    void hapticSelection();
    setDataSaveState("idle");
    setOnboarding((o) => ({ ...o, goal: value }));
  };

  // Contenido de la fila de guardado: inactiva, guardando o confirmación visible.
  const saveRowContent = (state: RowSaveState, idle: string) =>
    state === "saving" ? "Guardando…" : state === "saved" ? (
      <span className="inline-flex items-center gap-1.5">
        <Check className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
        Guardado
      </span>
    ) : idle;

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
          <Button variant="plain" className="mt-1" disabled={uploading} onClick={() => { void hapticTap(); fileInputRef.current?.click(); }}>
            {uploading ? "Subiendo foto…" : "Cambiar foto"}
          </Button>
        </div>

        <ListGroup
          header="Perfil"
          footer={pendingEmail
            ? `Correo pendiente de confirmar: ${pendingEmail}. Revisa tu bandeja de entrada para aplicarlo.`
            : undefined}
        >
          <FieldRow label="Nombre" htmlFor="settings-name">
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setProfileSaveState("idle"); }}
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
              onChange={(e) => { setEmail(e.target.value); setProfileSaveState("idle"); }}
              placeholder="email@ejemplo.com"
              className={rowInput}
            />
          </FieldRow>
          <ListRow
            title={<span className="inline-flex items-center gap-1.5 text-primary">{saveRowContent(profileSaveState, "Guardar perfil")}</span>}
            disabled={profileSaveState === "saving"}
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
          {mealsOutdated && (
            <div className="rounded-2xl bg-card px-4 py-3" role="status">
              <p className="type-body font-semibold">Tu plan de comidas está desactualizado</p>
              <p className="mt-1 type-footnote text-muted-foreground">
                Has cambiado datos que afectan a tus macros. Regenera las comidas para que cuadren con tu nueva dieta y objetivo.
              </p>
              <Button
                variant="hero"
                className="mt-3 w-full"
                disabled={regeneratingMeals}
                onClick={() => { void hapticTap(); setConfirmingMeals(true); }}
              >
                {regeneratingMeals ? "Regenerando comidas…" : "Regenerar comidas"}
              </Button>
            </div>
          )}

          <ListGroup header="Tus datos">
            <FieldRow label="Edad" htmlFor="settings-age">
              <Input id="settings-age" type="number" inputMode="numeric" enterKeyHint="next" value={onboarding.age} onChange={(e) => editOnboarding({ age: e.target.value })} className={rowInput} />
            </FieldRow>
            <FieldRow label="Altura (cm)" htmlFor="settings-height">
              <Input id="settings-height" type="number" inputMode="decimal" enterKeyHint="next" value={onboarding.height} onChange={(e) => editOnboarding({ height: e.target.value })} className={rowInput} />
            </FieldRow>
            <FieldRow label="Peso (kg)" htmlFor="settings-weight">
              <Input id="settings-weight" type="number" inputMode="decimal" enterKeyHint="done" value={onboarding.weight} onChange={(e) => editOnboarding({ weight: e.target.value })} className={rowInput} />
            </FieldRow>
          </ListGroup>
          <Button onClick={() => void saveOnboarding()} disabled={dataSaveState === "saving"} className="w-full">
            {dataSaveState === "saving" ? "Guardando…" : dataSaveState === "saved" ? "Guardado" : "Guardar cambios"}
          </Button>

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
            {/* Se guarda en horas; en pantalla, minutos (nadie piensa en «0,92 h»). */}
            <FieldRow label="Minutos/sesión" htmlFor="availability-hours">
              <Input id="availability-hours" type="number" inputMode="numeric" enterKeyHint="done" min={15} max={240} step="5" value={onboarding.availability.hours === "" || onboarding.availability.hours == null ? "" : Math.round(Number(onboarding.availability.hours) * 60)} onChange={(e) => setAvailability("hours", e.target.value === "" ? "" : String(Number(e.target.value) / 60))} className={rowInput} />
            </FieldRow>
          </ListGroup>

          <ListGroup header="Deportes">
            <Textarea aria-label="Deportes" value={onboarding.sports} onChange={(e) => editOnboarding({ sports: e.target.value })} className={blockTextarea} rows={2} />
          </ListGroup>
          <ListGroup header="Preferencias nutricionales">
            <Textarea aria-label="Preferencias nutricionales" value={onboarding.nutrition_preferences} onChange={(e) => editOnboarding({ nutrition_preferences: e.target.value })} className={blockTextarea} rows={2} />
          </ListGroup>
          <ListGroup header="Alergias">
            <Textarea aria-label="Alergias" value={onboarding.allergies} onChange={(e) => editOnboarding({ allergies: e.target.value })} className={blockTextarea} rows={2} />
          </ListGroup>

          <ListGroup>
            <ListRow
              title={<span className="inline-flex items-center gap-1.5 text-primary">{saveRowContent(dataSaveState, "Guardar datos")}</span>}
              disabled={dataSaveState === "saving"}
              onClick={() => void saveOnboarding()}
            />
          </ListGroup>

          <AlertDialog open={confirmingMeals} onOpenChange={setConfirmingMeals}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Regenerar tus comidas?</AlertDialogTitle>
                <AlertDialogDescription>
                  Recalcularemos el plan de comidas con tus datos actuales y sustituirá a las comidas guardadas cuando termine. El plan de entrenamiento no cambia.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter stacked>
                <AlertDialogCancel>Ahora no</AlertDialogCancel>
                <AlertDialogAction onClick={() => void regenerateMeals()}>
                  Regenerar comidas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Workout preferences */}
      <ListGroup
        className={`order-3${hideForAdmin}`}
        header="Tu forma de entrenar"
        footer="Elige cuánto quieres descansar al marcar una serie. El temporizador se inicia solo durante tu entreno. Puedes cambiarlo cuando quieras. El descanso específico de cada ejercicio sigue apareciendo en tu plan."
      >
        <div className="px-4 py-3 sep-b">
          <p className="mb-2 type-body">Vista del entrenamiento</p>
          <Tabs value={workoutView} onValueChange={(value) => {
            if (!user || (value !== "list" && value !== "focus")) return;
            void hapticSelection();
            setWorkoutViewState(setWorkoutView(user.id, value));
          }}>
            <TabsList className="w-full" aria-label="Vista del entrenamiento">
              <TabsTrigger value="list" className="flex-1" aria-controls={undefined}>Lista vertical</TabsTrigger>
              <TabsTrigger value="focus" className="flex-1" aria-controls={undefined}>Ejercicio a ejercicio</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
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
            <ListRow title="Plan actual" value={iosNoPurchases ? planCycle : `${planCycle} (${planCyclePrice})`} />
          ) : null}
          {hasPaidAccess && iosNoPurchases && isActive ? (
            // En iOS se cancela dentro de la app: abrir un portal externo para
            // gestionar el pago es justo lo que §3.1.1 no permite.
            <ListRow
              destructive
              title="Cancelar suscripción"
              onClick={() => { void hapticNotify("warning"); setConfirmingCancel(true); }}
            />
          ) : hasPaidAccess && !iosNoPurchases ? (
            <ListRow
              icon={<ExternalLink className="text-muted-foreground" />}
              title="Gestionar suscripción"
              chevron={!loadingPortal}
              trailing={loadingPortal ? <Spinner size="sm" /> : undefined}
              onClick={() => { if (!loadingPortal) void handleManageSubscription(); }}
            />
          ) : null}
        </ListGroup>

        <AlertDialog open={confirmingCancel} onOpenChange={setConfirmingCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cancelar tu suscripción?</AlertDialogTitle>
              <AlertDialogDescription>
                Mantienes el acceso hasta el final del periodo que ya has pagado y no se te volverá a cobrar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter stacked>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction destructive onClick={() => { void cancelSubscription(); }} disabled={cancelling}>
                {cancelling ? "Cancelando…" : "Sí, cancelar suscripción"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {!campaign && plans.plus && !iosNoPurchases && !hasPaidAccess && onUpgrade && (
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
