import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Save, Camera, Trash2, Loader2, User, Lock, ClipboardList,
  CreditCard, ExternalLink, Calendar, Crown, CalendarClock, Check, Zap, Unplug, RefreshCw,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SettingsPanel = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Subscription
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("");
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"monthly" | "yearly" | null>(null);
  const [yearlyPriceEur, setYearlyPriceEur] = useState<number>(190);

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

  // Google Calendar connection
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLastSync, setGcalLastSync] = useState<string | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [{ data: profile }, { data: onb }] = await Promise.all([
        supabase.from("profiles").select("name, email, avatar_url, subscription_status, subscription_tier, subscription_end, payment_status").eq("user_id", user.id).single(),
        supabase.from("onboarding").select("*").eq("user_id", user.id).single(),
      ]);

      if (profile) {
        setName(profile.name || "");
        setEmail(profile.email || "");
        setAvatarUrl(profile.avatar_url || "");
        setSubscriptionStatus(profile.subscription_status || "inactive");
        setSubscriptionTier(profile.subscription_tier || "none");
        setSubscriptionEnd(profile.subscription_end);
        setPaymentStatus(profile.payment_status || "unpaid");
      }

      if (onb) {
        setHasOnboarding(true);
        const avail = (onb.availability as any) || { days: "", hours: "" };
        setOnboarding({
          age: onb.age?.toString() || "", height: onb.height?.toString() || "",
          weight: onb.weight?.toString() || "", goal: onb.goal || "lose_weight",
          sports: onb.sports || "",
          availability: { days: avail.days?.toString() || "", hours: avail.hours?.toString() || "" },
          nutrition_preferences: onb.nutrition_preferences || "", allergies: onb.allergies || "",
        });
      }
      setLoading(false);

      // Fetch current plan (monthly/yearly) from check-subscription + yearly price
      (supabase.rpc as any)("get_public_settings").then(({ data }: any) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.yearly_price_eur) setYearlyPriceEur(row.yearly_price_eur);
      });
      supabase.functions.invoke("check-subscription").then(({ data }) => {
        if (data?.plan === "monthly" || data?.plan === "yearly") setCurrentPlan(data.plan);
      });

      // Fetch Google Calendar connection status
      supabase
        .from("google_calendar_connections" as any)
        .select("last_sync_at")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }: any) => {
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
      toast.success(`✅ ${parts.join(" · ")}`);
      if (data.errors?.length) {
        toast.error(`${data.errors.length} eventos fallaron. Revisa los logs.`);
        console.warn("[gcal-sync] errors:", data.errors);
      }
      setGcalLastSync(new Date().toISOString());
    } catch {
      toast.error("Error al sincronizar");
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
    } finally {
      setGcalLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("La imagen no puede superar 2MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Error al subir la imagen"); setUploading(false); return; }
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
      if (emailErr) { toast.error("Error al cambiar email: " + emailErr.message); setSaving(false); return; }
      toast.info("Se ha enviado un email de confirmación al nuevo correo");
    }
    if (!error) toast.success("Perfil guardado");
    else toast.error("Error al guardar");
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) { toast.success("Contraseña actualizada"); setNewPassword(""); setConfirmPassword(""); }
    else toast.error("Error: " + error.message);
    setChangingPassword(false);
  };

  const saveOnboarding = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("onboarding").upsert({
      user_id: user.id,
      age: parseInt(onboarding.age) || null, height: parseFloat(onboarding.height) || null,
      weight: parseFloat(onboarding.weight) || null, goal: onboarding.goal, sports: onboarding.sports,
      availability: onboarding.availability, nutrition_preferences: onboarding.nutrition_preferences,
      allergies: onboarding.allergies,
    });
    if (!error) toast.success("Datos actualizados");
    else toast.error("Error al guardar");
    setSaving(false);
  };

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error || !data?.url) {
      toast.error("Error al abrir el portal de suscripción.");
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
      setDeleting(false);
      return;
    }
    await signOut();
    navigate("/");
    toast.success("Cuenta eliminada permanentemente");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  }

  const isActive = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  return (
    <div className="space-y-8">
      {/* Avatar + Profile */}
      <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
        <div className="flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-bold font-display text-lg">Perfil</h2>
        </div>
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-20 h-20 rounded-full bg-secondary flex items-center justify-center overflow-hidden cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-muted-foreground" />}
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="text-sm text-muted-foreground">Haz clic para cambiar tu foto de perfil</div>
        </div>
        <div className="space-y-4">
          <div><Label className="text-sm">Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="mt-1" /></div>
          <div><Label className="text-sm">Correo electrónico</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" className="mt-1" /></div>
        </div>
        <Button variant="default" className="mt-4" onClick={saveProfile} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Guardando..." : "Guardar perfil"}
        </Button>
      </div>

      {/* Subscription */}
      <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-bold font-display text-lg">Suscripción</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? "bg-primary/20" : "bg-muted"}`}>
                <Crown className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <div className="font-medium text-sm">Plan {subscriptionTier === "personal" ? "Personal" : subscriptionTier || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {isActive ? (
                    subscriptionStatus === "trialing" ? "Prueba gratuita activa" : "Suscripción activa"
                  ) : paymentStatus === "paid" ? "Plan activo (pago único)" : "Sin suscripción activa"}
                </div>
              </div>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isActive ? "bg-primary/20 text-primary" : paymentStatus === "paid" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {isActive ? (subscriptionStatus === "trialing" ? "Trial" : "Activa") : paymentStatus === "paid" ? "Pagado" : "Inactiva"}
            </span>
          </div>

          {subscriptionEnd && isActive && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Calendar className="w-4 h-4" />
              <span>
                {subscriptionStatus === "trialing" ? "Tu prueba termina el" : "Próxima renovación:"}{" "}
                <span className="font-medium text-foreground">
                  {new Date(subscriptionEnd).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </span>
            </div>
          )}

          {(isActive || paymentStatus === "paid") && (
            <>
              {currentPlan && (
                <div className="p-4 rounded-xl border border-border bg-secondary/20 text-sm space-y-1.5">
                  <p>
                    Plan actual:{" "}
                    <span className="font-semibold text-foreground">
                      {currentPlan === "monthly" ? "Mensual (19€/mes)" : `Anual (${yearlyPriceEur}€/año)`}
                    </span>
                  </p>
                  {currentPlan === "monthly" ? (
                    <p className="text-xs text-muted-foreground">
                      💡 Cambia a Anual y ahorra {19 * 12 - yearlyPriceEur}€/año desde el portal de gestión.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Puedes cambiar a Mensual desde el portal de gestión cuando quieras.
                    </p>
                  )}
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={handleManageSubscription} disabled={loadingPortal}>
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                Gestionar suscripción
              </Button>
            </>
          )}

          {!isActive && paymentStatus !== "paid" && (
            <p className="text-sm text-muted-foreground text-center">No tienes una suscripción activa. Vuelve al inicio para suscribirte.</p>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock className="w-5 h-5 text-primary" />
          <h2 className="font-bold font-display text-lg">Google Calendar</h2>
        </div>
        {gcalConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl text-sm">
              <Check className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Conectado</p>
                {gcalLastSync && (
                  <p className="text-xs text-muted-foreground">
                    Última sync: {new Date(gcalLastSync).toLocaleString("es-ES")}
                  </p>
                )}
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => navigate("/my-schedule")} size="sm">
                <CalendarClock className="w-4 h-4 mr-2" /> Mi semana
              </Button>
              <Button variant="default" onClick={handleSyncGoogle} disabled={gcalLoading} size="sm">
                {gcalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sincronizar
              </Button>
              <Button variant="outline" onClick={handleDisconnectGoogle} disabled={gcalLoading} size="sm">
                <Unplug className="w-4 h-4 mr-2" /> Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sincroniza tus entrenos y comidas directamente en tu Google Calendar.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => navigate("/my-schedule")} size="sm">
                <CalendarClock className="w-4 h-4 mr-2" /> Mi semana
              </Button>
              <Button variant="hero" onClick={handleConnectGoogle} disabled={gcalLoading} size="sm">
                {gcalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Conectar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Password */}
      <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-5 h-5 text-primary" />
          <h2 className="font-bold font-display text-lg">Cambiar contraseña</h2>
        </div>
        <div className="space-y-4">
          <div><Label className="text-sm">Nueva contraseña</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="mt-1" /></div>
          <div><Label className="text-sm">Confirmar contraseña</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite la contraseña" className="mt-1" /></div>
        </div>
        <Button variant="default" className="mt-4" onClick={changePassword} disabled={changingPassword}>
          <Lock className="w-4 h-4 mr-1" /> {changingPassword ? "Cambiando..." : "Cambiar contraseña"}
        </Button>
      </div>

      {/* Onboarding data */}
      {hasOnboarding && (
        <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
          <div className="flex items-center gap-2 mb-6">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="font-bold font-display text-lg">Tus datos</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Edad</Label><Input type="number" value={onboarding.age} onChange={(e) => setOnboarding((o) => ({ ...o, age: e.target.value }))} className="mt-1" /></div>
              <div><Label className="text-xs">Altura (cm)</Label><Input type="number" value={onboarding.height} onChange={(e) => setOnboarding((o) => ({ ...o, height: e.target.value }))} className="mt-1" /></div>
              <div><Label className="text-xs">Peso (kg)</Label><Input type="number" value={onboarding.weight} onChange={(e) => setOnboarding((o) => ({ ...o, weight: e.target.value }))} className="mt-1" /></div>
            </div>
            <div>
              <Label className="text-xs">Objetivo</Label>
              <RadioGroup value={onboarding.goal} onValueChange={(v) => setOnboarding((o) => ({ ...o, goal: v }))} className="mt-1 space-y-2">
                {[
                  { value: "lose_weight", label: "Perder peso" },
                  { value: "gain_muscle", label: "Ganar músculo" },
                  { value: "improve_endurance", label: "Mejorar resistencia" },
                ].map((opt) => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors text-sm ${onboarding.goal === opt.value ? "border-primary bg-primary/5" : "border-border"}`}>
                    <RadioGroupItem value={opt.value} /><span className="font-medium">{opt.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div><Label className="text-xs">Deportes</Label><Textarea value={onboarding.sports} onChange={(e) => setOnboarding((o) => ({ ...o, sports: e.target.value }))} className="mt-1" rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Días/semana</Label><Input type="number" min={1} max={7} value={onboarding.availability.days} onChange={(e) => setOnboarding((o) => ({ ...o, availability: { ...o.availability, days: e.target.value } }))} className="mt-1" /></div>
              <div><Label className="text-xs">Horas/sesión</Label><Input type="number" step="0.5" value={onboarding.availability.hours} onChange={(e) => setOnboarding((o) => ({ ...o, availability: { ...o.availability, hours: e.target.value } }))} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Preferencias nutricionales</Label><Textarea value={onboarding.nutrition_preferences} onChange={(e) => setOnboarding((o) => ({ ...o, nutrition_preferences: e.target.value }))} className="mt-1" rows={2} /></div>
            <div><Label className="text-xs">Alergias</Label><Textarea value={onboarding.allergies} onChange={(e) => setOnboarding((o) => ({ ...o, allergies: e.target.value }))} className="mt-1" rows={2} /></div>
          </div>
          <Button variant="default" className="mt-4" onClick={saveOnboarding} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Guardando..." : "Guardar datos"}
          </Button>
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-card rounded-2xl p-6 border border-destructive/30 card-shadow">
        <h2 className="font-bold font-display text-lg text-destructive mb-4">Zona peligrosa</h2>
        <div className="space-y-4">
          <Separator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full"><Trash2 className="w-4 h-4 mr-2" /> Eliminar cuenta</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción eliminará permanentemente tu cuenta y todos tus datos. No se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount} disabled={deleting}>{deleting ? "Eliminando..." : "Sí, eliminar cuenta"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
