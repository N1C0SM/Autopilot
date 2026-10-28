import { generatePlanGuarded } from "@/shared/lib/planShield";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/contexts/AuthContext";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Spinner } from "@/shared/components/ui/spinner";
import { Switch } from "@/shared/components/ui/switch";
import Screen from "@/shared/components/native/Screen";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { hapticNotify, hapticSelection, hapticTap } from "@/shared/lib/native";
import { toast } from "sonner";
import PageHead from "@/web/components/PageHead";

const DAYS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
  { id: 6, label: "Sábado" },
  { id: 0, label: "Domingo" },
];

interface GymSlot {
  day: number;
  start: string; // "HH:MM"
  duration: number; // min
}
interface BusyBlock {
  day: number;
  start: string;
  end: string;
  label: string;
}
interface MealTimes {
  breakfast: string;
  snack_am: string;
  lunch: string;
  snack_pm: string;
  dinner: string;
}
interface WeeklyReminders {
  weigh_in: boolean;
  progress_photo: boolean;
}

const DEFAULT_MEALS: MealTimes = {
  breakfast: "08:00",
  snack_am: "11:00",
  lunch: "14:00",
  snack_pm: "17:30",
  dinner: "21:00",
};

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <section className="space-y-3">
    <SectionHeader title={title} hint={hint} size="md" />
    {children}
  </section>
);

// Fila de varios campos dentro de un grupo: sangría de 16 px y separador inferior, como ListRow.
const InsetRow = ({ children }: { children: ReactNode }) => (
  <div className="pl-4">
    <div className="flex flex-wrap items-center gap-2 py-2 pr-4 sep-b">{children}</div>
  </div>
);

// Un campo dentro de una ListRow ocupa 36 px; el margen negativo mantiene la fila en 44 px.
const rowField = "-my-[7px] h-9";

const MySchedule = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [gymSlots, setGymSlots] = useState<GymSlot[]>([]);
  const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>([]);
  const [mealTimes, setMealTimes] = useState<MealTimes>(DEFAULT_MEALS);
  const [mealDuration, setMealDuration] = useState(30);
  const [reminders, setReminders] = useState<WeeklyReminders>({ weigh_in: true, progress_photo: true });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_schedule")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setGymSlots((data.gym_slots as unknown as GymSlot[]) || []);
        setBusyBlocks((data.busy_blocks as unknown as BusyBlock[]) || []);
        setMealTimes({ ...DEFAULT_MEALS, ...((data.meal_times as unknown as MealTimes) || {}) });
        setMealDuration(data.meal_duration_min || 30);
        setReminders({ weigh_in: true, progress_photo: true, ...((data.weekly_reminders as unknown as WeeklyReminders) || {}) });
      }
      setLoading(false);
    })();
  }, [user]);

  const addGymSlot = (day: number) => {
    setGymSlots([...gymSlots, { day, start: "18:00", duration: 75 }]);
  };
  const removeGymSlot = (idx: number) => {
    setGymSlots(gymSlots.filter((_, i) => i !== idx));
  };
  const updateGymSlot = (idx: number, patch: Partial<GymSlot>) => {
    setGymSlots(gymSlots.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addBusyBlock = () => {
    setBusyBlocks([...busyBlocks, { day: 1, start: "09:00", end: "17:00", label: "Trabajo" }]);
  };
  const removeBusyBlock = (idx: number) => {
    setBusyBlocks(busyBlocks.filter((_, i) => i !== idx));
  };
  const updateBusyBlock = (idx: number, patch: Partial<BusyBlock>) => {
    setBusyBlocks(busyBlocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const handleSave = async () => {
    if (!user) return;
    void hapticTap();
    setSaving(true);
    const toastId = toast.loading("Guardando tu semana…");
    try {
      const { error } = await supabase.from("user_schedule").upsert(
        {
          user_id: user.id,
          gym_slots: gymSlots as never,
          busy_blocks: busyBlocks as never,
          meal_times: mealTimes as never,
          meal_duration_min: mealDuration,
          weekly_reminders: reminders as never,
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;

      toast.loading("Regenerando tu plan…", { id: toastId });

      // Run plan regeneration + (optional) calendar sync in parallel
      const { data: gcalTok } = await supabase
        .from("google_calendar_connections")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const tasks = [generatePlanGuarded(supabase, {}, { userId: user.id })];
      if (gcalTok) tasks.push(supabase.functions.invoke("gcal-sync"));

      const [planRes, syncRes] = await Promise.all(tasks);

      if (planRes?.error) {
        void hapticNotify("warning");
        toast.error("Guardado, pero no se pudo regenerar el plan", { id: toastId });
        return;
      }

      if (gcalTok && syncRes?.data) {
        const synced = syncRes.data?.synced ?? 0;
        void hapticNotify("success");
        toast.success(`Plan actualizado · ${synced} eventos en Google Calendar`, { id: toastId });
      } else {
        void hapticNotify("success");
        toast.success("Plan actualizado a tu nueva semana", { id: toastId });
      }
    } catch (e) {
      void hapticNotify("error");
      toast.error("No se pudo guardar tu semana", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => navigate("/dashboard");

  if (loading) {
    return (
      <Screen title="Mi horario" onBack={goBack} centered>
        <div className="flex justify-center">
          <Spinner size="lg" />
        </div>
      </Screen>
    );
  }

  return (
    <>
      <PageHead
        title="Horarios y disponibilidad · Autopilot"
        description="Configura tus horarios reales de entrenamiento y disponibilidad."
        path="/my-schedule"
        noindex
      />
      <Screen
        title="Mi horario"
        largeTitle
        onBack={goBack}
        footer={
          <Button onClick={handleSave} disabled={saving} size="lg" variant="hero" className="w-full">
            {saving ? <Spinner size="sm" label="Guardando" className="text-primary-foreground" /> : null}
            Guardar mi semana
          </Button>
        }
      >
        <div className="space-y-8 pb-4">
          <div className="flex items-start gap-4 px-1">
            <div className="flex w-10 shrink-0 items-center justify-center pt-0.5">
              <CalendarClock className="h-7 w-7 text-primary" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="type-headline">Configura aquí cómo es tu semana de verdad.</p>
              <p className="mt-1 type-subhead text-muted-foreground">
                Tu plan de entrenos y tus comidas se sincronizarán a tu Google Calendar{" "}
                <strong className="font-semibold text-foreground">respetando estos horarios</strong>.
              </p>
            </div>
          </div>

          {/* Comidas */}
          <Section title="Tus horarios de comidas">
            <ListGroup>
              {([
                ["breakfast", "Desayuno"],
                ["snack_am", "Snack AM"],
                ["lunch", "Comida"],
                ["snack_pm", "Snack PM"],
                ["dinner", "Cena"],
              ] as const).map(([key, label]) => (
                <ListRow
                  key={key}
                  title={label}
                  trailing={
                    <Input
                      type="time"
                      aria-label={label}
                      value={mealTimes[key]}
                      onChange={(e) => setMealTimes({ ...mealTimes, [key]: e.target.value })}
                      className={`${rowField} w-[116px]`}
                    />
                  }
                />
              ))}
              <ListRow
                title="Duración por comida"
                trailing={
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      aria-label="Duración por comida en minutos"
                      value={mealDuration}
                      onChange={(e) => setMealDuration(parseInt(e.target.value) || 30)}
                      className={`${rowField} w-[72px]`}
                      min={10}
                      max={120}
                    />
                    <span className="type-body text-muted-foreground">min</span>
                  </div>
                }
              />
            </ListGroup>
          </Section>

          {/* Gym slots */}
          <Section title="Tus huecos para entrenar">
            <div className="space-y-6">
              {DAYS.map((d) => {
                const daySlots = gymSlots.map((slot, i) => ({ slot, idx: i })).filter((x) => x.slot.day === d.id);
                return (
                  <ListGroup key={d.id} header={d.label}>
                    {daySlots.map(({ slot, idx }) => (
                      <InsetRow key={idx}>
                        <Input
                          type="time"
                          aria-label={`Hora de inicio, ${d.label}`}
                          value={slot.start}
                          onChange={(e) => updateGymSlot(idx, { start: e.target.value })}
                          className="h-9 w-[116px]"
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          aria-label={`Duración en minutos, ${d.label}`}
                          value={slot.duration}
                          onChange={(e) => updateGymSlot(idx, { duration: parseInt(e.target.value) || 60 })}
                          className="h-9 w-[72px]"
                          min={20}
                          max={240}
                        />
                        <span className="type-body text-muted-foreground">min</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar hueco, ${d.label}`}
                          onClick={() => {
                            void hapticTap();
                            removeGymSlot(idx);
                          }}
                          className="-my-1 -mr-2 ml-auto text-destructive [&_svg]:size-5"
                        >
                          <Trash2 />
                        </Button>
                      </InsetRow>
                    ))}
                    <ListRow
                      icon={<Plus />}
                      title="Añadir hueco"
                      value={daySlots.length === 0 ? "Día libre" : undefined}
                      onClick={() => addGymSlot(d.id)}
                    />
                  </ListGroup>
                );
              })}
            </div>
          </Section>

          {/* Busy blocks */}
          <Section title="Bloques ocupados (trabajo, clases…)">
            <div className="space-y-6">
              {busyBlocks.map((b, idx) => (
                <ListGroup key={idx}>
                  <ListRow
                    title="Día"
                    trailing={
                      <select
                        aria-label="Día del bloque"
                        value={b.day}
                        onChange={(e) => {
                          void hapticSelection();
                          updateBusyBlock(idx, { day: parseInt(e.target.value) });
                        }}
                        className={`field ${rowField} w-auto`}
                      >
                        {DAYS.map((d) => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                      </select>
                    }
                  />
                  <ListRow
                    title="Desde"
                    trailing={
                      <Input
                        type="time"
                        aria-label="Hora de inicio del bloque"
                        value={b.start}
                        onChange={(e) => updateBusyBlock(idx, { start: e.target.value })}
                        className={`${rowField} w-[116px]`}
                      />
                    }
                  />
                  <ListRow
                    title="Hasta"
                    trailing={
                      <Input
                        type="time"
                        aria-label="Hora de fin del bloque"
                        value={b.end}
                        onChange={(e) => updateBusyBlock(idx, { end: e.target.value })}
                        className={`${rowField} w-[116px]`}
                      />
                    }
                  />
                  <ListRow
                    title="Etiqueta"
                    trailing={
                      <Input
                        aria-label="Etiqueta del bloque"
                        value={b.label}
                        onChange={(e) => updateBusyBlock(idx, { label: e.target.value })}
                        placeholder="Etiqueta"
                        enterKeyHint="done"
                        autoCapitalize="sentences"
                        className={`${rowField} w-40`}
                      />
                    }
                  />
                  <ListRow title="Eliminar bloque" destructive onClick={() => removeBusyBlock(idx)} />
                </ListGroup>
              ))}
              <ListGroup footer={busyBlocks.length === 0 ? "Sin bloques. Añade los rangos en los que no estás disponible." : undefined}>
                <ListRow icon={<Plus />} title="Añadir bloque" onClick={addBusyBlock} />
              </ListGroup>
            </div>
          </Section>

          {/* Recordatorios */}
          <Section title="Recordatorios semanales">
            <ListGroup>
              <ListRow
                title="Pesarse"
                subtitle="Domingos por la mañana"
                trailing={
                  <Switch
                    aria-label="Pesarse"
                    checked={reminders.weigh_in}
                    onCheckedChange={(v) => {
                      void hapticSelection();
                      setReminders({ ...reminders, weigh_in: v });
                    }}
                  />
                }
              />
              <ListRow
                title="Foto de progreso"
                subtitle="Primer domingo de cada mes"
                trailing={
                  <Switch
                    aria-label="Foto de progreso"
                    checked={reminders.progress_photo}
                    onCheckedChange={(v) => {
                      void hapticSelection();
                      setReminders({ ...reminders, progress_photo: v });
                    }}
                  />
                }
              />
            </ListGroup>
          </Section>
        </div>
      </Screen>
    </>
  );
};

export default MySchedule;
