import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Save, Plus, Trash2, Dumbbell, UtensilsCrossed, Briefcase, Bell } from "lucide-react";
import { toast } from "sonner";

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
    setSaving(true);
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
      toast.success("Horarios guardados. Regenerando tu plan…");
      // Regenerate plan in background so the new gym_slots take effect
      supabase.functions.invoke("generate-plan").then(({ error: genErr }) => {
        if (genErr) {
          toast.error("Plan no regenerado: " + genErr.message);
        } else {
          toast.success("Plan actualizado a tu nueva semana ✓");
        }
      });
    } catch (e) {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50 flex items-center px-4 gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver
        </Button>
        <h1 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground flex-1">
          Mi semana real
        </h1>
        <Button onClick={handleSave} disabled={saving} variant="hero" size="sm">
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Guardar
        </Button>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-sm">
            Configura aquí cómo es tu semana de verdad. Tu plan de entrenos y tus comidas se sincronizarán a tu Google Calendar
            <strong> respetando estos horarios</strong>.
          </p>
        </div>

        {/* Comidas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UtensilsCrossed className="w-4 h-4 text-primary" /> Tus horarios de comidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {([
                ["breakfast", "Desayuno"],
                ["snack_am", "Snack AM"],
                ["lunch", "Comida"],
                ["snack_pm", "Snack PM"],
                ["dinner", "Cena"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="time"
                    value={mealTimes[key]}
                    onChange={(e) => setMealTimes({ ...mealTimes, [key]: e.target.value })}
                    className="h-9"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs">Duración por comida (min)</Label>
              <Input
                type="number"
                value={mealDuration}
                onChange={(e) => setMealDuration(parseInt(e.target.value) || 30)}
                className="h-9 w-24"
                min={10}
                max={120}
              />
            </div>
          </CardContent>
        </Card>

        {/* Gym slots */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Dumbbell className="w-4 h-4 text-primary" /> Tus huecos para entrenar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DAYS.map((d) => {
              const daySlots = gymSlots.map((s, i) => ({ slot: s, idx: i })).filter((x) => x.slot.day === d.id);
              return (
                <div key={d.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-20 text-sm font-medium pt-2">{d.label}</div>
                  <div className="flex-1 space-y-2">
                    {daySlots.length === 0 && (
                      <p className="text-xs text-muted-foreground pt-2">Día libre</p>
                    )}
                    {daySlots.map(({ slot, idx }) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={slot.start}
                          onChange={(e) => updateGymSlot(idx, { start: e.target.value })}
                          className="h-8 w-28"
                        />
                        <Input
                          type="number"
                          value={slot.duration}
                          onChange={(e) => updateGymSlot(idx, { duration: parseInt(e.target.value) || 60 })}
                          className="h-8 w-20"
                          min={20}
                          max={240}
                        />
                        <span className="text-xs text-muted-foreground">min</span>
                        <Button variant="ghost" size="sm" onClick={() => removeGymSlot(idx)} className="h-8 w-8 p-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addGymSlot(d.id)} className="h-8">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Hueco
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Busy blocks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="w-4 h-4 text-primary" /> Bloques ocupados (trabajo, clases…)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {busyBlocks.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin bloques. Añade los rangos en los que no estás disponible.</p>
            )}
            {busyBlocks.map((b, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 p-2 bg-secondary/30 rounded-md">
                <select
                  value={b.day}
                  onChange={(e) => updateBusyBlock(idx, { day: parseInt(e.target.value) })}
                  className="h-8 px-2 text-sm bg-background border border-border rounded-md"
                >
                  {DAYS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
                <Input type="time" value={b.start} onChange={(e) => updateBusyBlock(idx, { start: e.target.value })} className="h-8 w-28" />
                <span className="text-xs text-muted-foreground">a</span>
                <Input type="time" value={b.end} onChange={(e) => updateBusyBlock(idx, { end: e.target.value })} className="h-8 w-28" />
                <Input
                  value={b.label}
                  onChange={(e) => updateBusyBlock(idx, { label: e.target.value })}
                  placeholder="Etiqueta"
                  className="h-8 flex-1 min-w-[120px]"
                />
                <Button variant="ghost" size="sm" onClick={() => removeBusyBlock(idx)} className="h-8 w-8 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addBusyBlock}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Añadir bloque
            </Button>
          </CardContent>
        </Card>

        {/* Recordatorios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4 text-primary" /> Recordatorios semanales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Pesarse</p>
                <p className="text-xs text-muted-foreground">Domingos por la mañana</p>
              </div>
              <Switch checked={reminders.weigh_in} onCheckedChange={(v) => setReminders({ ...reminders, weigh_in: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Foto de progreso</p>
                <p className="text-xs text-muted-foreground">Primer domingo de cada mes</p>
              </div>
              <Switch checked={reminders.progress_photo} onCheckedChange={(v) => setReminders({ ...reminders, progress_photo: v })} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving} variant="hero" size="lg">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar mi semana
          </Button>
        </div>
      </main>
    </div>
  );
};

export default MySchedule;