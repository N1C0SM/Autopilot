import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, Download, Link2, Copy, Check, Loader2, RefreshCw, Unplug, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { DayPlan } from "@/types/training";
import { downloadICS } from "@/lib/exportPlanICS";

interface Props {
  dayPlans: DayPlan[];
  trigger?: React.ReactNode;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 - 22:00
const DURATIONS = [30, 45, 60, 75, 90, 120];
const REMINDERS = [
  { value: 0, label: "Sin recordatorio" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
];

const CalendarExportDialog = ({ dayPlans, trigger }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hourGym, setHourGym] = useState(18);
  const [hourAct, setHourAct] = useState(19);
  const [duration, setDuration] = useState(60);
  const [reminder, setReminder] = useState(60);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLastSync, setGcalLastSync] = useState<string | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from("calendar_tokens")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setToken(data.token);
        setHourGym(data.start_hour_gym);
        setHourAct(data.start_hour_activity);
        setDuration(data.duration_min);
        setReminder(data.reminder_min);
      }
      const { data: gcal } = await supabase
        .from("google_calendar_tokens")
        .select("last_sync_at")
        .eq("user_id", user.id)
        .maybeSingle();
      setGcalConnected(!!gcal);
      setGcalLastSync(gcal?.last_sync_at || null);
    })();
  }, [open, user]);

  const handleDownload = () => {
    downloadICS(dayPlans, {
      startHourGym: hourGym,
      startHourActivity: hourAct,
      durationMin: duration,
      reminderMin: reminder,
    });
    toast.success("Calendario descargado. Ábrelo para añadirlo.");
  };

  const handleSubscribe = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("calendar_tokens")
        .upsert(
          {
            user_id: user.id,
            start_hour_gym: hourGym,
            start_hour_activity: hourAct,
            duration_min: duration,
            reminder_min: reminder,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) throw error;
      setToken(data.token);
      toast.success("Suscripción activa. Copia el enlace.");
    } catch (e) {
      toast.error("Error al crear el enlace");
    } finally {
      setLoading(false);
    }
  };

  const feedUrl = token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${token}`
    : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectGoogle = async () => {
    setGcalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gcal-oauth-start", {
        body: { return_to: window.location.href },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      toast.error("No se pudo iniciar la conexión con Google");
      setGcalLoading(false);
    }
  };

  const handleSyncGoogle = async () => {
    setGcalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gcal-sync");
      if (error) throw error;
      toast.success(`✅ ${data.synced}/${data.total} eventos sincronizados`);
      setGcalLastSync(new Date().toISOString());
    } catch (e) {
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
      toast.success("Desconectado de Google Calendar");
    } catch (e) {
      toast.error("Error al desconectar");
    } finally {
      setGcalLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <CalendarIcon className="w-4 h-4 mr-1.5" /> Calendario
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" /> Tu plan en tu calendario
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conexión OAuth Google Calendar — HERO */}
          <div className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Google Calendar · 1 clic</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sincroniza tu plan directo en tu calendario. Se actualiza solo.
                </p>
              </div>
            </div>
            {!gcalConnected ? (
              <Button onClick={handleConnectGoogle} disabled={gcalLoading} className="w-full" variant="hero">
                {gcalLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
                Conectar Google Calendar
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary" />
                  Conectado{gcalLastSync ? ` · ${new Date(gcalLastSync).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSyncGoogle} disabled={gcalLoading} className="flex-1" variant="hero">
                    {gcalLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                    Sincronizar ahora
                  </Button>
                  <Button onClick={handleDisconnectGoogle} disabled={gcalLoading} size="icon" variant="outline" title="Desconectar">
                    <Unplug className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Otras opciones (plegado) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground py-2 px-1 transition-colors">
                <span>Otras opciones (Apple, Outlook, .ics)</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
          {/* Configuración */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Hora gimnasio</Label>
              <Select value={hourGym.toString()} onValueChange={(v) => setHourGym(parseInt(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => <SelectItem key={h} value={h.toString()}>{h}:00</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Hora actividad</Label>
              <Select value={hourAct.toString()} onValueChange={(v) => setHourAct(parseInt(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => <SelectItem key={h} value={h.toString()}>{h}:00</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Duración</Label>
              <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Recordatorio</Label>
              <Select value={reminder.toString()} onValueChange={(v) => setReminder(parseInt(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDERS.map((r) => <SelectItem key={r.value} value={r.value.toString()}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descarga */}
          <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-3">
              <Download className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Descargar archivo .ics</p>
                <p className="text-xs text-muted-foreground">Compatible con Google, Apple y Outlook. Una sola vez.</p>
              </div>
            </div>
            <Button onClick={handleDownload} className="w-full" size="sm">
              <Download className="w-4 h-4 mr-1.5" /> Descargar
            </Button>
          </div>

          {/* Suscripción */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-3">
              <Link2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Suscripción auto-actualizable</p>
                <p className="text-xs text-muted-foreground">Se actualiza solo cuando cambia tu plan. Recomendado.</p>
              </div>
            </div>
            {!token ? (
              <Button onClick={handleSubscribe} disabled={loading} className="w-full" size="sm" variant="hero">
                {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Link2 className="w-4 h-4 mr-1.5" />}
                Generar enlace
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={feedUrl}
                    className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 font-mono truncate"
                  />
                  <Button onClick={copyLink} size="sm" variant="outline" className="shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  📅 <b>Google Calendar:</b> Otros calendarios → Añadir → Desde URL · 🍎 <b>Apple:</b> Archivo → Nueva suscripción
                </p>
                <Button onClick={handleSubscribe} disabled={loading} variant="ghost" size="sm" className="w-full text-xs">
                  {loading && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                  Actualizar configuración
                </Button>
              </div>
            )}
          </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarExportDialog;