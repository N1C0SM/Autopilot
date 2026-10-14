import { useEffect, useState } from "react";
import { Check, ChevronRight, Copy, Download, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
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

interface PickerRowProps {
  title: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
}

// Fila de Ajustes con el valor actual a la derecha; toda la fila abre el selector.
const PickerRow = ({ title, value, options, onChange }: PickerRowProps) => (
  <ListRow
    title={title}
    trailing={
      <Select
        value={value.toString()}
        onValueChange={(v) => {
          void hapticSelection();
          onChange(parseInt(v));
        }}
      >
        <SelectTrigger
          aria-label={title}
          className="h-auto w-auto gap-1 bg-transparent px-0 type-body text-muted-foreground before:absolute before:inset-0 before:content-['']"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value.toString()}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    }
  />
);

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
        .from("google_calendar_connections")
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
    void hapticTap();
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectGoogle = async () => {
    void hapticTap();
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
    void hapticTap();
    setGcalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gcal-sync");
      if (error) throw error;
      toast.success(`${data.synced}/${data.total} eventos sincronizados`);
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

  const lastSyncLabel = gcalLastSync
    ? new Date(gcalLastSync).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="tinted" size="sm">
            Calendario
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tu plan en tu calendario</DialogTitle>
          <DialogDescription>Sincroniza tu plan directo en tu calendario. Se actualiza solo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Conexión OAuth Google Calendar */}
          {!gcalConnected ? (
            <Button onClick={handleConnectGoogle} disabled={gcalLoading} size="lg" variant="hero" className="w-full">
              {gcalLoading ? <Spinner size="sm" label="Conectando" className="text-primary-foreground" /> : null}
              Conectar Google Calendar
            </Button>
          ) : (
            <div className="space-y-3">
              <ListGroup inset header="Google Calendar">
                <ListRow
                  icon={<Check />}
                  title="Conectado"
                  subtitle={lastSyncLabel ? `Última sincronización · ${lastSyncLabel}` : undefined}
                />
                <ListRow title="Desconectar" destructive disabled={gcalLoading} onClick={handleDisconnectGoogle} />
              </ListGroup>
              <Button onClick={handleSyncGoogle} disabled={gcalLoading} size="lg" variant="hero" className="w-full">
                {gcalLoading ? <Spinner size="sm" label="Sincronizando" className="text-primary-foreground" /> : null}
                Sincronizar ahora
              </Button>
            </div>
          )}

          {/* Otras opciones (plegado) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <div className="overflow-hidden rounded-2xl bg-secondary">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  onClick={() => void hapticSelection()}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-[7px] text-left transition-colors duration-100 active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block type-body">Otras opciones</span>
                    <span className="block type-footnote text-muted-foreground">Apple, Outlook, .ics</span>
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ease-ios",
                      advancedOpen && "rotate-90",
                    )}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-6 pt-6">
              {/* Configuración */}
              <ListGroup inset header="Horario">
                <PickerRow
                  title="Hora gimnasio"
                  value={hourGym}
                  onChange={setHourGym}
                  options={HOURS.map((h) => ({ value: h, label: `${h}:00` }))}
                />
                <PickerRow
                  title="Hora actividad"
                  value={hourAct}
                  onChange={setHourAct}
                  options={HOURS.map((h) => ({ value: h, label: `${h}:00` }))}
                />
                <PickerRow
                  title="Duración"
                  value={duration}
                  onChange={setDuration}
                  options={DURATIONS.map((d) => ({ value: d, label: `${d} min` }))}
                />
                <PickerRow title="Recordatorio" value={reminder} onChange={setReminder} options={REMINDERS} />
              </ListGroup>

              {/* Descarga */}
              <ListGroup inset footer="Compatible con Google, Apple y Outlook. Una sola vez.">
                <ListRow icon={<Download />} title="Descargar archivo .ics" onClick={handleDownload} />
              </ListGroup>

              {/* Suscripción */}
              {!token ? (
                <ListGroup inset header="Suscripción auto-actualizable" footer="Se actualiza solo cuando cambia tu plan. Recomendado.">
                  <ListRow
                    icon={<Link2 />}
                    title="Generar enlace"
                    disabled={loading}
                    trailing={loading ? <Spinner size="sm" label="Generando" /> : undefined}
                    onClick={handleSubscribe}
                  />
                </ListGroup>
              ) : (
                <ListGroup
                  inset
                  header="Suscripción auto-actualizable"
                  footer={
                    <>
                      <span className="font-semibold">Google Calendar:</span> Otros calendarios → Añadir → Desde URL ·{" "}
                      <span className="font-semibold">Apple:</span> Archivo → Nueva suscripción
                    </>
                  }
                >
                  <div className="flex items-center gap-2 p-3 sep-b">
                    <input
                      readOnly
                      aria-label="Enlace de suscripción"
                      value={feedUrl}
                      className="field selectable min-w-0 flex-1 truncate bg-card"
                    />
                    <Button
                      onClick={copyLink}
                      size="icon"
                      variant="tinted"
                      aria-label={copied ? "Enlace copiado" : "Copiar enlace"}
                      className="shrink-0"
                    >
                      {copied ? <Check /> : <Copy />}
                    </Button>
                  </div>
                  <ListRow
                    title="Actualizar configuración"
                    disabled={loading}
                    trailing={loading ? <Spinner size="sm" label="Actualizando" /> : undefined}
                    onClick={handleSubscribe}
                  />
                </ListGroup>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarExportDialog;
