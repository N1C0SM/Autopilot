import { getSportSchedules, getCustomActivities } from "@/lib/availability";
import { IconTile } from "@/components/ui/icon-tile";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventInput, EventClickArg, EventDropArg, EventChangeArg, DateSelectArg, EventContentArg, DayHeaderContentArg } from "@fullcalendar/core";
import { Flame, ShieldCheck, StickyNote } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
import { skipAutoFocusOnTouch } from "@/components/admin-user-detail/skipAutoFocusOnTouch";
import type { DayPlan } from "@/types/training";

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_TO_DOW: Record<string, number> = {
  Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 0,
};

// Colores de los bloques del calendario, sobre tokens: entreno en tinte, el resto en gris.
const COLORS = {
  training: { bg: "hsl(var(--primary) / 0.22)", text: "hsl(var(--primary))" },
  external: { bg: "hsl(var(--accent))", text: "hsl(var(--foreground))" },
};

const LABEL = "mb-1.5 block font-normal text-muted-foreground";

// Barra de FullCalendar con métricas iOS. `.fc-themed` (index.css) la deja como web (borde, 10–12 px,
// 24 px de alto, mayúsculas de palabra); se sobrescribe desde el contenedor con `!` porque esas reglas
// van después de las utilidades. Navegación: botones grises de 44 px. Vistas: control segmentado
// igual que `TabsList`. En el móvil el título va primero y el segmentado ocupa su propia fila.
const FC_NATIVE = [
  // Barra
  "[&_.fc-header-toolbar]:!mb-4 [&_.fc-header-toolbar]:!flex-wrap [&_.fc-header-toolbar]:!gap-3",
  "[&_.fc-toolbar-title]:!truncate [&_.fc-toolbar-title]:!text-[17px] [&_.fc-toolbar-title]:!font-semibold [&_.fc-toolbar-title]:!leading-[22px] [&_.fc-toolbar-title]:!normal-case [&_.fc-toolbar-title::first-letter]:uppercase",
  "max-sm:[&_.fc-toolbar-chunk:nth-child(2)]:order-first max-sm:[&_.fc-toolbar-chunk:nth-child(2)]:min-w-0 max-sm:[&_.fc-toolbar-chunk:nth-child(2)]:flex-1",
  "max-sm:[&_.fc-toolbar-chunk:last-child]:basis-full max-sm:[&_.fc-toolbar-chunk:last-child_.fc-button-group]:!w-full",
  // Botones: gris, sin borde, 44 px, 15 px, estado pulsado y anillo solo con teclado
  "[&_.fc-button]:!inline-flex [&_.fc-button]:!h-11 [&_.fc-button]:!min-w-11 [&_.fc-button]:!items-center [&_.fc-button]:!justify-center [&_.fc-button]:!rounded-full [&_.fc-button]:!border-0 [&_.fc-button]:!bg-secondary [&_.fc-button]:!px-4 [&_.fc-button]:!py-0",
  "[&_.fc-button]:!text-[15px] [&_.fc-button]:!font-medium [&_.fc-button]:!leading-5 [&_.fc-button]:!normal-case [&_.fc-button]:!text-foreground [&_.fc-button]:!shadow-none [&_.fc-button]:!outline-none [&_.fc-button]:transition-[background-color,transform] [&_.fc-button]:duration-150",
  "[&_.fc-button:not(:disabled):active]:!bg-accent [&_.fc-button:not(:disabled):active]:scale-[0.97] [&_.fc-button:focus-visible]:!ring-2 [&_.fc-button:focus-visible]:!ring-primary [&_.fc-button:disabled]:!opacity-40",
  "[&_.fc-prev-button]:!w-11 [&_.fc-prev-button]:!px-0 [&_.fc-next-button]:!ml-2 [&_.fc-next-button]:!w-11 [&_.fc-next-button]:!px-0 [&_.fc-today-button]:!ml-2",
  // Vistas (Semana, Mes, Día): control segmentado
  "[&_.fc-toolbar-chunk:last-child_.fc-button-group]:!flex [&_.fc-toolbar-chunk:last-child_.fc-button-group]:!h-9 [&_.fc-toolbar-chunk:last-child_.fc-button-group]:!rounded-[9px] [&_.fc-toolbar-chunk:last-child_.fc-button-group]:!bg-[rgba(118,118,128,0.24)] [&_.fc-toolbar-chunk:last-child_.fc-button-group]:!p-0.5",
  "[&_.fc-toolbar-chunk:last-child_.fc-button]:!m-0 [&_.fc-toolbar-chunk:last-child_.fc-button]:!h-full [&_.fc-toolbar-chunk:last-child_.fc-button]:!min-w-0 [&_.fc-toolbar-chunk:last-child_.fc-button]:!flex-1 [&_.fc-toolbar-chunk:last-child_.fc-button]:!rounded-[7px] [&_.fc-toolbar-chunk:last-child_.fc-button]:!bg-transparent [&_.fc-toolbar-chunk:last-child_.fc-button]:!px-3 [&_.fc-toolbar-chunk:last-child_.fc-button]:!text-[13px] [&_.fc-toolbar-chunk:last-child_.fc-button]:!leading-[18px]",
  "[&_.fc-toolbar-chunk:last-child_.fc-button-active]:!bg-[#636366] [&_.fc-toolbar-chunk:last-child_.fc-button-active]:!font-semibold [&_.fc-toolbar-chunk:last-child_.fc-button-active]:!shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]",
  // Rejilla: nada por debajo de 11 px y sin el brillo de hover en los eventos
  "[&_.fc-col-header-cell-cushion]:!px-0 [&_.fc-col-header-cell-cushion]:!text-[11px] [&_.fc-timegrid-slot-label-cushion]:tabular-nums [&_.fc-daygrid-day-number]:!text-[13px] [&_.fc-daygrid-day-number]:tabular-nums",
  "[&_.fc-event:hover]:!filter-none [&_.fc-event:active]:opacity-70",
].join(" ");

/**
 * Fatiga estimada por categoría de actividad externa.
 * Sirve para mostrar el puntito de carga y para que el admin/usuario entienda
 * por qué un entreno se reubica.
 */
const EXTERNAL_FATIGUE: Record<string, "Alta" | "Media" | "Baja"> = {
  boxeo: "Alta", escalada: "Alta", futbol: "Alta", padel: "Alta", tenis: "Alta",
  running: "Media", ciclismo: "Media", natacion: "Media", danza: "Media",
  yoga: "Baja", personal: "Baja", trabajo: "Baja", otro: "Baja",
};

const LOAD_LABEL: Record<string, { dot: string; bg: string; label: string; recovery: string }> = {
  // Escala de carga sobre tokens: alta / media / baja, sin colores fuera de paleta.
  Alta:  { dot: "bg-destructive",      bg: "bg-destructive/15 text-destructive",    label: "Carga alta",  recovery: "48h recomendadas" },
  Media: { dot: "bg-primary",          bg: "bg-primary/15 text-primary",            label: "Carga media", recovery: "24h recomendadas" },
  Baja:  { dot: "bg-muted-foreground", bg: "bg-secondary text-muted-foreground",    label: "Carga baja",  recovery: "Sin restricción" },
};

/** Estima la carga de un día de plan a partir de los fatigue_level de sus ejercicios. */
function estimatePlanLoad(plan: DayPlan): "Alta" | "Media" | "Baja" {
  if (plan?.type === "actividad") {
    const intensity = (plan.intensity || "").toLowerCase();
    if (intensity.includes("alta") || intensity.includes("intensa")) return "Alta";
    if (intensity.includes("media") || intensity.includes("moderada")) return "Media";
    return "Baja";
  }
  const exs = plan?.exercises || [];
  let high = 0, med = 0;
  for (const ex of exs) {
    const f = (ex.fatigue_level || "Media").toLowerCase();
    if (f.includes("alta")) high++;
    else if (f.includes("media")) med++;
  }
  if (high >= 3) return "Alta";
  if (high >= 1 || med >= 4) return "Media";
  return "Baja";
}

interface ScheduleConflict {
  dayLabel: string;          // "Lunes"
  trainingTitle: string;     // "Pecho + Tríceps"
  conflictType: "overlap" | "recovery";
  externalTitle: string;     // "Boxeo"
  hint: string;              // texto humano que se enseña al admin
}

// `icon` y `color` son datos que se guardan con la actividad (no se pintan en la interfaz).
const CATEGORIES = [
  { value: "boxeo", label: "Boxeo", icon: "🥊", color: "#f97316" },
  { value: "escalada", label: "Escalada", icon: "🧗", color: "#f97316" },
  { value: "yoga", label: "Yoga", icon: "🧘", color: "#10b981" },
  { value: "running", label: "Running", icon: "🏃", color: "#ef4444" },
  { value: "ciclismo", label: "Ciclismo", icon: "🚴", color: "#06b6d4" },
  { value: "natacion", label: "Natación", icon: "🏊", color: "#0ea5e9" },
  { value: "futbol", label: "Fútbol", icon: "⚽", color: "#84cc16" },
  { value: "tenis", label: "Tenis", icon: "🎾", color: "#eab308" },
  { value: "padel", label: "Pádel", icon: "🏓", color: "#a855f7" },
  { value: "danza", label: "Danza", icon: "💃", color: "#ec4899" },
  { value: "personal", label: "Personal", icon: "📌", color: "#a855f7" },
  { value: "trabajo", label: "Trabajo", icon: "💼", color: "#64748b" },
  { value: "otro", label: "Otro", icon: "✨", color: "#f97316" },
];

// Default day-of-week + hour for auto-seeded sports from onboarding.
// Uses evenings, staggered so they don't all collide on the same day.
const SPORT_DEFAULTS: Record<string, { dow: number; hour: number; label: string; icon: string; color: string }> = {
  boxeo:    { dow: 2, hour: 19, label: "Boxeo",    icon: "🥊", color: "#f97316" },
  escalada: { dow: 4, hour: 18, label: "Escalada", icon: "🧗", color: "#f97316" },
  yoga:     { dow: 3, hour: 8,  label: "Yoga",     icon: "🧘", color: "#10b981" },
  running:  { dow: 6, hour: 9,  label: "Running",  icon: "🏃", color: "#ef4444" },
  ciclismo: { dow: 6, hour: 10, label: "Ciclismo", icon: "🚴", color: "#06b6d4" },
  natacion: { dow: 5, hour: 19, label: "Natación", icon: "🏊", color: "#0ea5e9" },
  futbol:   { dow: 5, hour: 20, label: "Fútbol",   icon: "⚽", color: "#84cc16" },
  tenis:    { dow: 4, hour: 19, label: "Tenis",    icon: "🎾", color: "#eab308" },
  padel:    { dow: 4, hour: 20, label: "Pádel",    icon: "🏓", color: "#a855f7" },
  danza:    { dow: 3, hour: 19, label: "Danza",    icon: "💃", color: "#ec4899" },
};

interface ExternalActivity {
  id: string;
  title: string;
  category: string;
  day_of_week: number;
  start_hour: number;
  start_minute: number;
  duration_min: number;
  color: string;
  icon: string | null;
  note: string | null;
}

interface ScheduleOverride {
  day_label: string;
  new_day_of_week: number;
  start_hour: number;
  start_minute: number;
  duration_min: number;
  admin_note?: string | null;
}

type CalendarDetails = {
  kind: "training" | "external";
  plan?: DayPlan;
  ext?: ExternalActivity;
  load: "Alta" | "Media" | "Baja";
  override?: ScheduleOverride;
};
type ScheduleEvent = Omit<EventInput, "extendedProps"> & { extendedProps: CalendarDetails };

interface Props {
  dayPlans: DayPlan[];
  /** If set, the calendar operates on this user's data (admin mode). Otherwise uses the logged-in user. */
  targetUserId?: string;
  /** Show admin banner and skip auto-seeding from onboarding. */
  isAdminMode?: boolean;
  /** Email of the target user, shown in the admin banner. */
  targetUserEmail?: string;
  /** Callback con conflictos detectados (solo se usa en modo admin). */
  onConflictsChange?: (conflicts: ScheduleConflict[]) => void;
}

function getMondayOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateForDow(monday: Date, dow: number, hour: number, minute: number): Date {
  const d = new Date(monday);
  // dow: 0=Domingo, 1=Lunes... convertir a offset desde lunes
  const offset = dow === 0 ? 6 : dow - 1;
  d.setDate(monday.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const CalendarView = ({ dayPlans, targetUserId, isAdminMode, targetUserEmail, onConflictsChange }: Props) => {
  const { user } = useAuth();
  const formId = useId();
  const effectiveUserId = targetUserId ?? user?.id;
  const calendarRef = useRef<FullCalendar | null>(null);
  const [externals, setExternals] = useState<ExternalActivity[]>([]);
  const [overrides, setOverrides] = useState<Record<string, ScheduleOverride>>({});
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);

  // form state
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("boxeo");
  const [dow, setDow] = useState(2);
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);
  const [duration, setDuration] = useState(60);
  const [note, setNote] = useState("");

  // Admin: nota privada coach → usuario para el día seleccionado.
  const [adminNoteDraft, setAdminNoteDraft] = useState("");
  const [adminNoteSaving, setAdminNoteSaving] = useState(false);

  const monday = useMemo(() => getMondayOfWeek(), []);

  const loadData = async () => {
    if (!effectiveUserId) return;
    const [{ data: ext }, { data: ovr }] = await Promise.all([
      supabase.from("external_activities").select("*").eq("user_id", effectiveUserId),
      supabase.from("training_schedule_overrides").select("*").eq("user_id", effectiveUserId),
    ]);
    setExternals((ext as ExternalActivity[]) || []);
    const map: Record<string, ScheduleOverride> = {};
    (ovr || []).forEach((o) => { map[o.day_label] = o; });
    setOverrides(map);
    setLoading(false);
  };

  // Auto-seed external activities from onboarding sports (the ones that aren't
  // the main training focus, e.g. boxeo, escalada, yoga…). Runs once per user.
  const seedFromOnboarding = async () => {
    if (!effectiveUserId) return;
    const { data: onb } = await supabase
      .from("onboarding")
      .select("sports, primary_focus, availability")
      .eq("user_id", effectiveUserId)
      .maybeSingle();
    if (!onb?.sports) return;
    const focus = (onb.primary_focus || "").toLowerCase();
    const sportsList = String(onb.sports)
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // Horarios definidos por el usuario en el onboarding (formato nuevo: start/end como "HH:MM")
    const userSchedules: Record<string, { dow: number; start: string; end: string }> =
      getSportSchedules(onb.availability);

    // Actividades personalizadas del onboarding (salir con amigos, trabajo, etc.)
    const customActivities = getCustomActivities(onb.availability);

    const { data: existing } = await supabase
      .from("external_activities")
      .select("category, title")
      .eq("user_id", effectiveUserId);
    const existingCats = new Set((existing || []).map((e) => e.category));
    const existingTitles = new Set((existing || []).map((e) => `personal::${(e.title || "").toLowerCase()}`));

    const parseHM = (hm: string, fallback = { h: 19, m: 0 }) => {
      const [hStr, mStr] = (hm || "").split(":");
      const h = parseInt(hStr);
      const m = parseInt(mStr);
      return {
        h: Number.isFinite(h) ? h : fallback.h,
        m: Number.isFinite(m) ? m : fallback.m,
      };
    };
    const minutesBetween = (start: string, end: string) => {
      const a = parseHM(start, { h: 19, m: 0 });
      const b = parseHM(end, { h: 20, m: 0 });
      const diff = (b.h * 60 + b.m) - (a.h * 60 + a.m);
      return diff > 0 ? diff : 60;
    };

    // 1) Deportes secundarios → external_activities
    const sportsToInsert = sportsList
      .filter((s) => SPORT_DEFAULTS[s])
      .filter((s) => s !== "gimnasio" && s !== "calistenia") // entrenos, no externas
      .filter((s) => !(focus === "gimnasio" && s === "gimnasio"))
      .filter((s) => !existingCats.has(s))
      .map((s) => {
        const def = SPORT_DEFAULTS[s];
        const userSched = userSchedules[s];
        const start = userSched?.start;
        const end = userSched?.end;
        const startHM = start ? parseHM(start, { h: def.hour, m: 0 }) : { h: def.hour, m: 0 };
        const dur = start && end ? minutesBetween(start, end) : 60;
        return {
          user_id: effectiveUserId,
          title: def.label,
          category: s,
          day_of_week: userSched?.dow ?? def.dow,
          start_hour: startHM.h,
          start_minute: startHM.m,
          duration_min: dur,
          color: def.color,
          icon: def.icon,
          note: userSched
            ? "Añadido desde tu onboarding · puedes editarlo o moverlo"
            : "Horario por defecto · ajústalo arrastrando el bloque",
        };
      });

    // 2) Actividades personalizadas → external_activities (categoría "personal")
    const customsToInsert = customActivities
      .filter((a) => a.title && a.title.trim().length > 0)
      .filter((a) => !existingTitles.has(`personal::${a.title.trim().toLowerCase()}`))
      .map((a) => {
        const startHM = parseHM(a.start, { h: 20, m: 0 });
        const dur = minutesBetween(a.start, a.end);
        return {
          user_id: effectiveUserId,
          title: a.title.trim(),
          category: "personal",
          day_of_week: a.dow,
          start_hour: startHM.h,
          start_minute: startHM.m,
          duration_min: dur,
          color: "#a855f7", // púrpura para "vida personal"
          icon: "📌",
          note: "Añadido desde tu onboarding · puedes editarlo o moverlo",
        };
      });

    const toInsert = [...sportsToInsert, ...customsToInsert];
    if (toInsert.length > 0) {
      await supabase.from("external_activities").insert(toInsert);
    }
  };

  useEffect(() => {
    if (!effectiveUserId) return;
    (async () => {
      // En modo admin no auto-sembramos para no contaminar los datos del usuario.
      if (!isAdminMode) {
        await seedFromOnboarding();
      }
      await loadData();
    })();

    // Realtime: refrescar el calendario cuando cambien externas u overrides
    const channel = supabase
      .channel(`calendar-${effectiveUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "external_activities", filter: `user_id=eq.${effectiveUserId}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "training_schedule_overrides", filter: `user_id=eq.${effectiveUserId}` },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, isAdminMode]);

  // Build events from plan + externals
  const events: ScheduleEvent[] = useMemo(() => {
    const out: ScheduleEvent[] = [];

    for (const plan of dayPlans) {
      const baseDow = DAY_TO_DOW[plan.day];
      if (baseDow === undefined) continue;
      const ovr = overrides[plan.day];
      const finalDow = ovr?.new_day_of_week ?? baseDow;
      const h = ovr?.start_hour ?? (plan.type === "gimnasio" ? 18 : 19);
      const m = ovr?.start_minute ?? 0;
      const dur = ovr?.duration_min ?? 60;
      const start = dateForDow(monday, finalDow, h, m);
      const end = new Date(start.getTime() + dur * 60 * 1000);
      const titleText = plan.type === "gimnasio"
        ? (plan.routine_name || "Entrenamiento")
        : (plan.sport || "Actividad");
      const load = estimatePlanLoad(plan);

      out.push({
        id: `plan-${plan.day}`,
        title: titleText,
        start,
        end,
        backgroundColor: COLORS.training.bg,
        borderColor: COLORS.training.bg,
        textColor: COLORS.training.text,
        extendedProps: { kind: "training", plan, load, override: ovr },
      });
    }

    for (const ext of externals) {
      const start = dateForDow(monday, ext.day_of_week, ext.start_hour, ext.start_minute);
      const end = new Date(start.getTime() + ext.duration_min * 60 * 1000);
      const load = EXTERNAL_FATIGUE[ext.category] || "Baja";
      out.push({
        id: `ext-${ext.id}`,
        title: ext.title,
        start,
        end,
        backgroundColor: COLORS.external.bg,
        borderColor: COLORS.external.bg,
        textColor: COLORS.external.text,
        extendedProps: { kind: "external", ext, load },
      });
    }

    return out;
  }, [dayPlans, externals, overrides, monday]);

  // Detección de conflictos: si hay una externa de carga Alta dentro de las
  // 24h previas a un entreno, marcamos como conflicto de recuperación.
  const conflicts: ScheduleConflict[] = useMemo(() => {
    const list: ScheduleConflict[] = [];
    const trainingEvents = events.filter((e) => e.extendedProps?.kind === "training");
    const externalEvents = events.filter((e) => e.extendedProps?.kind === "external");
    for (const tr of trainingEvents) {
      const trStart = tr.start as Date;
      const trEnd = tr.end as Date;
      const trProps = tr.extendedProps;
      for (const ex of externalEvents) {
        const exStart = ex.start as Date;
        const exEnd = ex.end as Date;
        const exProps = ex.extendedProps;
        // Solape directo
        if (exStart < trEnd && exEnd > trStart) {
          list.push({
            dayLabel: trProps.plan.day,
            trainingTitle: trProps.plan.routine_name || trProps.plan.sport || "Entrenamiento",
            conflictType: "overlap",
            externalTitle: exProps.ext.title,
            hint: `Solape directo con ${exProps.ext.title}`,
          });
          continue;
        }
        // Recuperación: externa Alta dentro de las 24h previas al entreno (no Baja)
        if (exProps.load === "Alta" && trProps.load !== "Baja") {
          const hoursBetween = (trStart.getTime() - exEnd.getTime()) / 3600000;
          if (hoursBetween > 0 && hoursBetween < 24) {
            list.push({
              dayLabel: trProps.plan.day,
              trainingTitle: trProps.plan.routine_name || trProps.plan.sport || "Entrenamiento",
              conflictType: "recovery",
              externalTitle: exProps.ext.title,
              hint: `Solo ${Math.round(hoursBetween)}h tras ${exProps.ext.title} (carga alta)`,
            });
          }
        }
      }
    }
    return list;
  }, [events]);

  useEffect(() => {
    onConflictsChange?.(conflicts);
  }, [conflicts, onConflictsChange]);

  const resetForm = () => {
    setEditId(null);
    setTitle("");
    setCategory("boxeo");
    setDow(2);
    setHour(18);
    setMinute(0);
    setDuration(60);
    setNote("");
  };

  const openCreate = (preset?: { dow?: number; hour?: number; minute?: number }) => {
    resetForm();
    if (preset?.dow !== undefined) setDow(preset.dow);
    if (preset?.hour !== undefined) setHour(preset.hour);
    if (preset?.minute !== undefined) setMinute(preset.minute);
    setEditOpen(true);
  };

  const openEdit = (ext: ExternalActivity) => {
    setEditId(ext.id);
    setTitle(ext.title);
    setCategory(ext.category);
    setDow(ext.day_of_week);
    setHour(ext.start_hour);
    setMinute(ext.start_minute);
    setDuration(ext.duration_min);
    setNote(ext.note || "");
    setDetailOpen(false);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!effectiveUserId) return;
    if (!title.trim()) { toast.error("Pon un nombre"); return; }
    const cat = CATEGORIES.find((c) => c.value === category) || CATEGORIES[0];
    const icon = cat.icon;
    const payload = {
      user_id: effectiveUserId,
      title: title.trim(),
      category,
      day_of_week: dow,
      start_hour: hour,
      start_minute: minute,
      duration_min: duration,
      color: cat.color,
      icon,
      note,
    };
    if (editId) {
      const { error } = await supabase.from("external_activities").update(payload).eq("id", editId);
      if (error) { toast.error("Error al guardar"); return; }
      toast.success("Actividad actualizada");
    } else {
      const { error } = await supabase.from("external_activities").insert(payload);
      if (error) { toast.error("Error al crear"); return; }
      toast.success("Actividad añadida");
    }
    setEditOpen(false);
    loadData();
  };

  const saveAdminNote = async () => {
    if (!effectiveUserId || !detailProps?.plan?.day) return;
    setAdminNoteSaving(true);
    const dayLabel = detailProps.plan.day;
    const existingOvr = overrides[dayLabel];
    const baseDow = DAY_TO_DOW[dayLabel] ?? 1;
    const { error } = await supabase.from("training_schedule_overrides").upsert({
      user_id: effectiveUserId,
      day_label: dayLabel,
      new_day_of_week: existingOvr?.new_day_of_week ?? baseDow,
      start_hour: existingOvr?.start_hour ?? 18,
      start_minute: existingOvr?.start_minute ?? 0,
      duration_min: existingOvr?.duration_min ?? 60,
      admin_note: adminNoteDraft.trim() || null,
    }, { onConflict: "user_id,day_label" });
    setAdminNoteSaving(false);
    if (error) { toast.error("No se pudo guardar la nota"); return; }
    toast.success("Nota guardada");
    loadData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("external_activities").delete().eq("id", id);
    if (error) { toast.error("Error al borrar"); return; }
    toast.success("Actividad eliminada");
    setDetailOpen(false);
    loadData();
  };

  const handleEventClick = (arg: EventClickArg) => {
    const props = arg.event.extendedProps as CalendarDetails;
    if (props?.kind === "training") {
      const dayLabel = props.plan?.day;
      const existingNote = dayLabel ? (overrides[dayLabel]?.admin_note || "") : "";
      setAdminNoteDraft(existingNote);
    }
    setSelectedEvent({
      id: arg.event.id,
      title: arg.event.title,
      start: arg.event.start || undefined,
      end: arg.event.end || undefined,
      extendedProps: props,
    });
    setDetailOpen(true);
  };

  const handleEventDrop = async (arg: EventDropArg | EventChangeArg) => {
    if (!effectiveUserId) return;
    const ev = arg.event;
    const newStart = ev.start;
    const newEnd = ev.end;
    if (!newStart) return;
    const newDow = newStart.getDay();
    const newHour = newStart.getHours();
    const newMinute = newStart.getMinutes();
    const newDuration = newEnd ? Math.round((newEnd.getTime() - newStart.getTime()) / 60000) : 60;
    const props = ev.extendedProps as CalendarDetails;

    if (props.kind === "external") {
      const { error } = await supabase.from("external_activities").update({
        day_of_week: newDow,
        start_hour: newHour,
        start_minute: newMinute,
        duration_min: newDuration,
      }).eq("id", props.ext.id);
      if (error) { toast.error("No se pudo mover"); arg.revert(); return; }
      toast.success("Movido");
      loadData();
    } else if (props.kind === "training") {
      const dayLabel = props.plan.day;
      const { error } = await supabase.from("training_schedule_overrides").upsert({
        user_id: effectiveUserId,
        day_label: dayLabel,
        new_day_of_week: newDow,
        start_hour: newHour,
        start_minute: newMinute,
        duration_min: newDuration,
      }, { onConflict: "user_id,day_label" });
      if (error) { toast.error("No se pudo mover"); arg.revert(); return; }
      toast.success("Entreno movido");
      loadData();
    }
  };

  const handleSelect = (sel: DateSelectArg) => {
    openCreate({
      dow: sel.start.getDay(),
      hour: sel.start.getHours(),
      minute: sel.start.getMinutes(),
    });
    sel.view.calendar.unselect();
  };

  const detailProps = selectedEvent?.extendedProps;

  const renderEventContent = (arg: EventContentArg) => {
    const load = (arg.event.extendedProps as CalendarDetails)?.load ?? "Baja";
    return (
      <div className="flex min-w-0 items-start gap-1 overflow-hidden">
        <span className={cn("mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full", LOAD_LABEL[load].dot)} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate">{arg.event.title}</span>
          {arg.timeText ? <span className="block truncate font-normal tabular-nums opacity-80">{arg.timeText}</span> : null}
        </span>
      </div>
    );
  };

  // Cabecera de columna como el Calendario de iOS: día de la semana pequeño y el número debajo (hoy en tinte).
  const renderDayHeader = (arg: DayHeaderContentArg) => {
    const weekday = arg.date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
    if (arg.view.type === "dayGridMonth") {
      return <span className="block py-1.5 type-footnote text-muted-foreground">{weekday}</span>;
    }
    return (
      <span className="flex flex-col items-center py-1">
        <span className="type-caption2 text-muted-foreground">{weekday}</span>
        <span className={cn("type-subhead font-semibold tabular-nums", arg.isToday ? "text-primary" : "text-foreground")}>{arg.date.getDate()}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {isAdminMode && (
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-0 type-subhead text-muted-foreground">
            Estás editando el calendario de{" "}
            <span className="break-all text-foreground">{targetUserEmail || "este usuario"}</span>. Los cambios se sincronizan en tiempo real.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 type-footnote text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLORS.training.bg }} aria-hidden="true" /> Entreno</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLORS.external.bg }} aria-hidden="true" /> Otra actividad</span>
          <span className="flex items-center gap-1.5">
            Carga
            <span role="img" className={cn("h-1.5 w-1.5 rounded-full", LOAD_LABEL.Alta.dot)} aria-label="alta" />
            <span role="img" className={cn("h-1.5 w-1.5 rounded-full", LOAD_LABEL.Media.dot)} aria-label="media" />
            <span role="img" className={cn("h-1.5 w-1.5 rounded-full", LOAD_LABEL.Baja.dot)} aria-label="baja" />
          </span>
        </div>
        <Button size="sm" variant="plain" className="-mr-3.5 shrink-0" onClick={() => { void hapticTap(); openCreate(); }}>
          Añadir actividad
        </Button>
      </div>

      <div className={`fc-themed rounded-2xl bg-card p-2 sm:p-4 ${FC_NATIVE}`}>
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={esLocale}
          headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,dayGridMonth,timeGridDay" }}
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día" }}
          firstDay={1}
          allDaySlot={false}
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          slotDuration="00:30:00"
          height="auto"
          expandRows
          nowIndicator
          editable
          selectable
          selectMirror
          eventDurationEditable
          eventStartEditable
          events={events}
          eventContent={renderEventContent}
          dayHeaderContent={renderDayHeader}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventDrop}
          select={handleSelect}
          dayMaxEvents={3}
        />
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={skipAutoFocusOnTouch}>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar actividad" : "Nueva actividad"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor={`${formId}-category`} className={LABEL}>Tipo</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id={`${formId}-category`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${formId}-title`} className={LABEL}>Nombre</Label>
              <Input id={`${formId}-title`} enterKeyHint="next" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Boxeo en BoxStudio" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`${formId}-dow`} className={LABEL}>Día</Label>
                <Select value={dow.toString()} onValueChange={(v) => setDow(parseInt(v))}>
                  <SelectTrigger id={`${formId}-dow`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,0].map((d) => <SelectItem key={d} value={d.toString()}>{DAYS_ES[d]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`${formId}-duration`} className={LABEL}>Duración</Label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                  <SelectTrigger id={`${formId}-duration`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[30,45,60,75,90,120,150,180].map((d) => <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`${formId}-hour`} className={LABEL}>Hora</Label>
                <Select value={hour.toString()} onValueChange={(v) => setHour(parseInt(v))}>
                  <SelectTrigger id={`${formId}-hour`} className="tabular-nums"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => <SelectItem key={h} value={h.toString()}>{h}:00</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`${formId}-minute`} className={LABEL}>Minutos</Label>
                <Select value={minute.toString()} onValueChange={(v) => setMinute(parseInt(v))}>
                  <SelectTrigger id={`${formId}-minute`} className="tabular-nums"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0,15,30,45].map((m) => <SelectItem key={m} value={m.toString()}>:{m.toString().padStart(2,"0")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor={`${formId}-note`} className={LABEL}>Nota (opcional)</Label>
              <Textarea id={`${formId}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Lugar, profesor, etc." />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <Button size="lg" className="w-full" onClick={() => { void hapticTap(); void handleSave(); }}>
              {editId ? "Guardar" : "Añadir"}
            </Button>
            {editId && (
              <Button variant="plain" className="w-full text-destructive" onClick={() => { void hapticTap(); void handleDelete(editId); }}>
                Borrar actividad
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={skipAutoFocusOnTouch}>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            {selectedEvent?.start instanceof Date && (
              <DialogDescription className="tabular-nums first-letter:uppercase">
                {selectedEvent.start.toLocaleString("es-ES", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
                {selectedEvent.end instanceof Date && ` — ${selectedEvent.end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`}
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {detailProps?.load && (
                  <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 type-footnote", LOAD_LABEL[detailProps.load].bg)}>
                    <span className={cn("h-2 w-2 rounded-full", LOAD_LABEL[detailProps.load].dot)} aria-hidden="true" />
                    {LOAD_LABEL[detailProps.load].label} · {LOAD_LABEL[detailProps.load].recovery}
                  </span>
                )}
                {detailProps?.kind === "training" && detailProps.plan?.type === "actividad" && (
                  <>
                    {detailProps.plan.intensity && (
                      <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-secondary px-3 type-footnote">
                        <Flame className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{detailProps.plan.intensity}
                      </span>
                    )}
                    {detailProps.plan.duration && (
                      <span className="inline-flex min-h-7 items-center rounded-full bg-secondary px-3 type-footnote">{detailProps.plan.duration}</span>
                    )}
                  </>
                )}
              </div>

              {detailProps?.kind === "training" && detailProps.plan?.type === "gimnasio" && (
                <ListGroup inset header={detailProps.plan.muscle_focus || undefined}>
                  {(detailProps.plan.exercises || []).map((ex, i) => (
                    <ListRow key={i} title={ex.name} subtitle={<span className="tabular-nums">{ex.series} × {ex.reps} · {ex.rest}</span>} />
                  ))}
                </ListGroup>
              )}

              {/* Nota del coach (visible para el usuario, editable por admin) */}
              {detailProps?.kind === "training" && (() => {
                const dayLabel = detailProps.plan?.day;
                const existingNote = dayLabel ? overrides[dayLabel]?.admin_note : null;
                if (isAdminMode) {
                  return (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`${formId}-admin-note`} className={LABEL}>Nota del coach (visible para el usuario)</Label>
                        <Textarea
                          id={`${formId}-admin-note`}
                          value={adminNoteDraft}
                          onChange={(e) => setAdminNoteDraft(e.target.value)}
                          rows={2}
                          placeholder="Ej. Hoy mete RIR 1, ya estás listo."
                        />
                      </div>
                      <Button size="lg" onClick={() => { void hapticTap(); void saveAdminNote(); }} disabled={adminNoteSaving} className="w-full">
                        {adminNoteSaving ? "Guardando…" : "Guardar nota"}
                      </Button>
                    </div>
                  );
                }
                if (existingNote) {
                  return (
                    <div className="flex items-start gap-3">
                      <IconTile icon={StickyNote} />
                      <div className="min-w-0">
                        <p className="type-headline">Nota de tu coach</p>
                        <p className="mt-0.5 break-words type-subhead text-muted-foreground">{existingNote}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {detailProps?.kind === "external" && (
                <>
                  {detailProps.ext.note && <p className="break-words type-subhead text-muted-foreground">{detailProps.ext.note}</p>}
                  <div className="space-y-3">
                    <Button size="lg" onClick={() => { void hapticTap(); openEdit(detailProps.ext); }} className="w-full">
                      Editar
                    </Button>
                    <Button variant="plain" onClick={() => { void hapticTap(); void handleDelete(detailProps.ext.id); }} className="w-full text-destructive">
                      Borrar actividad
                    </Button>
                  </div>
                </>
              )}

              {detailProps?.kind === "training" && (
                <p className="text-center type-footnote text-muted-foreground">
                  Arrastra el entreno en el calendario para moverlo a otro día u hora.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;