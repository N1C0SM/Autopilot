import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertCircle, RefreshCw, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { toast } from "sonner";
import { resetAcquisitionEvents } from "@/shared/lib/acquisition";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { StatusBadge, type StatusTone } from "@/shared/components/ui/status-badge";
import { hapticNotify, hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import {
  ACQUISITION_CHANNELS,
  ACQUISITION_STAGES,
  CAMPAIGN_LABELS,
  CHANNEL_LABELS,
  MEDIUM_LABELS,
  RANGE_OPTIONS,
  STAGE_LABELS,
  USERS_PAGE_SIZE,
  fetchAcquisitionCampaigns,
  fetchAcquisitionFunnel,
  fetchAcquisitionUsers,
  rangeDates,
  type AcquisitionChannel,
  type AcquisitionFunnel,
  type AcquisitionStage,
  type AcquisitionUser,
  type CampaignFunnel,
  type ChannelFunnel,
  type RangeKey,
} from "@/shared/lib/acquisitionFunnel";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** Admin → Captación: de qué red llega cada usuario y cómo avanza por el embudo. */
const AcquisitionPanel = () => {
  const [range, setRange] = useState<RangeKey>("30");
  const [data, setData] = useState<AcquisitionFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [usersKey, setUsersKey] = useState(0);

  const resetEvents = async () => {
    try {
      const n = await resetAcquisitionEvents();
      toast.success(n === 1 ? "Borrada 1 visita o scan de prueba" : `Borrados ${n} visitas y scans de prueba`);
      await load(range);
      setUsersKey((k) => k + 1);
    } catch {
      toast.error("No se pudo reiniciar. ¿Está aplicada la migración de reinicio?");
    }
  };

  const load = useCallback(async (key: RangeKey) => {
    setLoading(true);
    try {
      setData(await fetchAcquisitionFunnel(rangeDates(key)));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(range); }, [load, range]);

  if (!data && loadError && !loading) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Captación no disponible"
        description="No se pudo cargar el embudo. Si acabas de publicar, comprueba que la migración de captación está aplicada."
        action={<Button size="lg" onClick={() => { void hapticTap(); void load(range); }}>Reintentar</Button>}
      />
    );
  }

  const tracking = data?.trackingSince ?? null;
  const total = data?.total;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="type-subhead text-muted-foreground">De qué red llega cada usuario y hasta dónde avanza.</p>
          <div className="-mr-3 flex shrink-0 items-center">
            <Button variant="ghost" size="icon" onClick={() => { void hapticTap(); void load(range); }} aria-label="Actualizar" className="text-primary [&_svg]:size-5">
              <RefreshCw />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { void hapticNotify("warning"); setConfirmingReset(true); }} aria-label="Empezar a medir desde cero" className="text-destructive [&_svg]:size-5">
              <RotateCcw />
            </Button>
          </div>
        </div>
        <Tabs value={range} onValueChange={(v) => { void hapticSelection(); setRange(v as RangeKey); }}>
          <TabsList className="w-full sm:w-80" aria-label="Rango de fechas">
            {RANGE_OPTIONS.map((o) => <TabsTrigger key={o.key} value={o.key}>{o.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {loadError && <p role="alert" className="type-footnote text-destructive">No se pudieron actualizar los datos. Se muestra la última carga correcta.</p>}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : data && total ? (
        <>
          <section aria-label="Resumen" className={cn("grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4", loading && "opacity-60")}>
            <Kpi label="Visitantes nuevos" value={tracking ? total.visits : "—"} hint={tracking ? "Primer contacto" : "Aún sin medir"} />
            <Kpi label="Scans" value={tracking ? total.scans : "—"} hint={tracking ? "Hechos en la web" : "Aún sin medir"} />
            <Kpi label="Cuentas creadas" value={total.signups} hint={tracking && total.visits > 0 ? `${pct(total.signups, total.visits)} de las visitas` : "En el rango"} accent />
            <Kpi
              label="Activos 2ª semana"
              value={total.week2Eligible > 0 ? pct(total.activeWeek2, total.week2Eligible) : "—"}
              hint={total.week2Eligible > 0 ? `${total.activeWeek2} de ${total.week2Eligible}` : "Nadie cumple 14 días"}
            />
            <Kpi label="Plus" value={total.plus} hint={`${pct(total.plus, total.signups)} de las cuentas`} />
          </section>

          <p className="px-1 type-footnote text-muted-foreground">
            {tracking
              ? `Midiendo el origen desde el ${fmtDate(tracking)}. Las cuentas anteriores aparecen como «sin origen».`
              : "El origen se empieza a medir cuando se publique esta versión: hasta entonces todas las cuentas aparecen como «sin origen» y no hay visitas ni scans registrados."}
            {" "}Tus visitas no cuentan: este navegador queda marcado al abrir Admin, y en el móvil abre una vez autopilotplan.com/?no_contar=1 desde Instagram, TikTok, YouTube, Threads y Facebook.
            {" "}Activo en 2ª semana: al menos un entreno entre los días 8 y 14 desde el alta (solo cuenta a quien ya los ha cumplido). Sin cuentas de prueba ni del equipo.
          </p>

          <FunnelSteps total={total} tracking={!!tracking} className={cn(loading && "opacity-60")} />

          <Card className={cn(loading && "opacity-60")}>
            <SectionHeader title="Por red" size="sm" className="mb-2" />
            <ul className="divide-y divide-border/60">
              {data.channels.map((c) => <ChannelRow key={c.channel} row={c} tracking={!!tracking} />)}
            </ul>
          </Card>

          <CampaignsList key={`c${usersKey}`} range={range} />

          <UsersList key={usersKey} range={range} />
        </>
      ) : null}

      <AlertDialog open={confirmingReset} onOpenChange={setConfirmingReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Empezar a medir desde cero?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran las visitas y los scans registrados hasta ahora (por ejemplo, tus pruebas con los enlaces de las bios). Las cuentas y su origen no se tocan. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => { void resetEvents(); }}>Borrar y empezar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function ChannelRow({ row, tracking }: { row: ChannelFunnel; tracking: boolean }) {
  const empty = row.visits + row.scans + row.signups === 0;
  const stats = [
    { label: "Visitas", value: tracking ? row.visits : "—" },
    { label: "Scans", value: tracking ? row.scans : "—" },
    { label: "1er entreno", value: row.firstWorkout },
    { label: "Activos 2ª sem.", value: row.week2Eligible > 0 ? `${row.activeWeek2}/${row.week2Eligible}` : "—" },
    { label: "Plus", value: row.plus },
  ];
  return (
    <li className={cn("py-4", empty && "opacity-50")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate type-headline">{CHANNEL_LABELS[row.channel]}</span>
        <span className="shrink-0 tabular-nums">
          <span className="type-figure text-[28px]">{row.signups}</span>
          <span className="ml-1.5 type-footnote text-muted-foreground">{row.signups === 1 ? "cuenta" : "cuentas"}</span>
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-5 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="truncate type-caption1 text-muted-foreground">{s.label}</dt>
            <dd className="font-rounded type-headline tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

/** Embudo completo con lo que se pierde entre cada paso. */
function FunnelSteps({ total, tracking, className }: { total: Omit<ChannelFunnel, "channel">; tracking: boolean; className?: string }) {
  const steps = [
    { label: "Visitas", value: tracking ? total.visits : null },
    { label: "Scans", value: tracking ? total.scans : null },
    { label: "Cuentas", value: total.signups },
    { label: "1er entreno", value: total.firstWorkout },
    { label: "Activos 2ª sem.", value: total.activeWeek2 },
    { label: "Plus", value: total.plus },
  ];
  return (
    <Card className={className}>
      <SectionHeader title="Embudo" size="sm" className="mb-3" />
      <ol className="divide-y divide-border/60">
        {steps.map((st, i) => {
          const prev = i > 0 ? steps[i - 1].value : null;
          const kept = st.value != null && prev != null && prev > 0 ? Math.round((st.value / prev) * 100) : null;
          return (
            <li key={st.label} className="flex items-baseline justify-between gap-3 py-3">
              <span className="type-body">{st.label}</span>
              <span className="flex items-baseline gap-3 tabular-nums">
                {kept != null && (
                  <span className={cn("type-footnote", kept < 30 ? "text-destructive" : "text-muted-foreground")}>
                    {kept}% sigue · se pierde {100 - kept}%
                  </span>
                )}
                <span className="type-figure text-[24px]">{st.value ?? "—"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 type-footnote text-muted-foreground">
        Las visitas y los scans de quien no crea cuenta solo se cuentan: no se sigue a nadie sin cuenta. Persona a persona, abajo, solo cuentas.
      </p>
    </Card>
  );
}

/** Cada publicación (red + dónde estaba el enlace + pieza): qué trajo. */
function CampaignsList({ range }: { range: RangeKey }) {
  const [rows, setRows] = useState<CampaignFunnel[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchAcquisitionCampaigns(rangeDates(range))
      .then((r) => { if (alive) { setRows(r); setError(false); } })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [range]);

  const label = (r: CampaignFunnel) => {
    if (r.campaign) return CAMPAIGN_LABELS[r.campaign] ?? r.campaign;
    if (r.medium === "bio") return "Enlace de la bio";
    return r.channel === "directo" ? "Sin enlace etiquetado" : "Sin publicación concreta";
  };

  return (
    <Card>
      <SectionHeader title="Por publicación" size="sm" className="mb-1" />
      <p className="mb-2 type-footnote text-muted-foreground">
        Qué trajo cada reel, carrusel, short, hilo o historia. Solo se puede saber cuando el enlace es pulsable en la propia publicación (Facebook, YouTube, Threads, historias con enlace); en Instagram y TikTok cuenta como «Enlace de la bio».
      </p>
      {error && <p role="alert" className="py-2 type-footnote text-destructive">No se pudo cargar.</p>}
      {rows && rows.length === 0 && <p className="py-6 text-center type-subhead text-muted-foreground">Aún no hay visitas con enlace etiquetado en el rango.</p>}
      {!rows && !error && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      <ul className="divide-y divide-border/60">
        {(rows ?? []).map((r) => (
          <li key={`${r.channel}-${r.medium}-${r.campaign}`} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate type-headline">{label(r)}</p>
                <p className="truncate type-footnote text-muted-foreground">
                  {CHANNEL_LABELS[r.channel]}{r.medium ? ` · ${MEDIUM_LABELS[r.medium] ?? r.medium}` : ""}
                </p>
              </div>
              <span className="shrink-0 tabular-nums">
                <span className="type-figure text-[24px]">{r.signups}</span>
                <span className="ml-1.5 type-footnote text-muted-foreground">{r.signups === 1 ? "cuenta" : "cuentas"}</span>
              </span>
            </div>
            <p className="mt-1 type-footnote tabular-nums text-muted-foreground">
              {r.visits} visitas · {r.scans} scans · {r.firstWorkout} entrenaron · {r.activeWeek2} activos 2ª sem. · {r.plus} Plus
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const STAGE_TONE: Record<AcquisitionStage, StatusTone> = { cuenta: "neutral", scan: "neutral", entreno: "accent", activo: "success", plus: "success" };
const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "—");

/** Cada cuenta del rango: de dónde vino y en qué paso se quedó. */
function UsersList({ range }: { range: RangeKey }) {
  const [channel, setChannel] = useState<AcquisitionChannel | "all">("all");
  const [stage, setStage] = useState<AcquisitionStage | "all">("all");
  const [users, setUsers] = useState<AcquisitionUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const page = await fetchAcquisitionUsers(rangeDates(range), {
        channel: channel === "all" ? null : channel,
        stage: stage === "all" ? null : stage,
        offset,
      });
      setUsers((prev) => (offset === 0 ? page.users : [...prev, ...page.users]));
      setTotal(page.total);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, channel, stage]);

  useEffect(() => { void load(0); }, [load]);

  return (
    <Card>
      <SectionHeader title="Personas" size="sm" className="mb-1" />
      <p className="mb-3 type-footnote text-muted-foreground">De dónde vino cada cuenta y en qué paso del embudo se quedó.</p>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Select value={channel} onValueChange={(v) => { void hapticSelection(); setChannel(v as AcquisitionChannel | "all"); }}>
          <SelectTrigger aria-label="Red"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las redes</SelectItem>
            {ACQUISITION_CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={(v) => { void hapticSelection(); setStage(v as AcquisitionStage | "all"); }}>
          <SelectTrigger aria-label="Paso"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los pasos</SelectItem>
            {ACQUISITION_STAGES.map((st) => <SelectItem key={st} value={st}>{STAGE_LABELS[st]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error && <p role="alert" className="py-2 type-footnote text-destructive">No se pudo cargar la lista.</p>}
      {!error && !loading && users.length === 0 && <p className="py-6 text-center type-subhead text-muted-foreground">Nadie con estos filtros en el rango.</p>}
      <ul className="divide-y divide-border/60">
        {users.map((u) => (
          <li key={u.userId} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate type-headline">{u.name || u.email || u.userId.slice(0, 8)}</p>
                {u.name && u.email ? <p className="truncate type-footnote text-muted-foreground">{u.email}</p> : null}
              </div>
              <StatusBadge tone={STAGE_TONE[u.stage]}>{STAGE_LABELS[u.stage]}</StatusBadge>
            </div>
            <p className="mt-1 type-footnote text-muted-foreground">
              {CHANNEL_LABELS[u.channel]}
              {u.medium ? ` · ${u.medium}` : ""}
              {u.campaign ? ` · ${u.campaign}` : ""}
              {u.landingPath ? ` · entró por ${u.landingPath}` : ""}
              {` · alta ${fmtDay(u.signupAt)}`}
              {u.lastWorkout ? ` · último entreno ${fmtDay(u.lastWorkout)}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {loading && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      {!loading && users.length < total && (
        <Button variant="plain" className="mt-2 w-full" onClick={() => { void hapticTap(); void load(users.length); }}>
          Ver {Math.min(USERS_PAGE_SIZE, total - users.length)} más de {total}
        </Button>
      )}
    </Card>
  );
}

/** Tarjeta del sistema: sin borde, 22 px. */
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl bg-card p-5", className)}>{children}</section>;
}

/** Cifra clave en tarjeta; `accent` la marca en dorado (una por pantalla). */
function Kpi({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl bg-card p-4 lg:p-5">
      <p className="truncate type-footnote text-muted-foreground">{label}</p>
      <p className={cn("mt-2 truncate type-figure text-[34px] lg:text-[40px]", accent && "text-primary")}>{value}</p>
      {hint ? <p className="mt-1 truncate type-footnote text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default AcquisitionPanel;
