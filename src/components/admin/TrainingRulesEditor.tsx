import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, RotateCcw, Loader2, Zap, Dumbbell, Heart, Shield, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TrainingRules {
  id: string;
  min_sets_per_session: number;
  max_sets_per_session: number;
  series_p1_min: number;
  series_p1_max: number;
  series_p2_min: number;
  series_p2_max: number;
  series_p3_min: number;
  series_p3_max: number;
  reps_fuerza: string;
  reps_hipertrofia: string;
  reps_resistencia: string;
  reps_isometrico: string;
  rest_fuerza: string;
  rest_hipertrofia: string;
  rest_resistencia: string;
  rest_isometrico: string;
  max_consecutive_high_fatigue: number;
  max_heavy_hinges: number;
  max_pattern_repeats: number;
  push_pull_max_diff: number;
  max_p2_exercises: number;
  max_p3_exercises: number;
  required_patterns: string[];
  recovery_hours: Record<string, number>;
}

const DEFAULTS: Omit<TrainingRules, "id"> = {
  min_sets_per_session: 12,
  max_sets_per_session: 20,
  series_p1_min: 3, series_p1_max: 5,
  series_p2_min: 3, series_p2_max: 4,
  series_p3_min: 2, series_p3_max: 3,
  reps_fuerza: "4-8", reps_hipertrofia: "8-15", reps_resistencia: "15-25", reps_isometrico: "20-60s",
  rest_fuerza: "180s", rest_hipertrofia: "90s", rest_resistencia: "45s", rest_isometrico: "60s",
  max_consecutive_high_fatigue: 2, max_heavy_hinges: 1, max_pattern_repeats: 2, push_pull_max_diff: 1,
  max_p2_exercises: 2, max_p3_exercises: 2,
  required_patterns: ["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core"],
  recovery_hours: { Pecho: 48, Espalda: 48, Hombros: 48, Bíceps: 36, Tríceps: 36, Piernas: 72, Glúteos: 48, Core: 24, "Cuerpo completo": 48, Cardio: 24 },
};

const ALL_PATTERNS = ["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core", "Aislamiento"];

const TrainingRulesEditor = () => {
  const [rules, setRules] = useState<TrainingRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const { data } = await supabase.from("training_rules").select("*").limit(1).single();
    if (data) {
      setRules({
        ...data,
        required_patterns: Array.isArray(data.required_patterns) ? data.required_patterns as string[] : DEFAULTS.required_patterns,
        recovery_hours: typeof data.recovery_hours === "object" && data.recovery_hours !== null ? data.recovery_hours as Record<string, number> : DEFAULTS.recovery_hours,
      });
    }
    setLoading(false);
  };

  const update = <K extends keyof TrainingRules>(key: K, value: TrainingRules[K]) => {
    setRules((r) => r ? { ...r, [key]: value } : r);
  };

  const togglePattern = (p: string) => {
    if (!rules) return;
    const current = rules.required_patterns;
    update("required_patterns", current.includes(p) ? current.filter(x => x !== p) : [...current, p]);
  };

  const updateRecovery = (muscle: string, hours: number) => {
    if (!rules) return;
    update("recovery_hours", { ...rules.recovery_hours, [muscle]: hours });
  };

  const save = async () => {
    if (!rules) return;
    setSaving(true);
    const { id, ...rest } = rules;
    const { error } = await (supabase.from("training_rules") as any).update(rest).eq("id", id);
    if (error) toast.error("Error al guardar");
    else toast.success("Reglas actualizadas");
    setSaving(false);
  };

  const resetDefaults = () => {
    if (!rules) return;
    setRules({ ...DEFAULTS, id: rules.id });
    toast.info("Valores por defecto restaurados (guarda para aplicar)");
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!rules) return <p className="text-sm text-muted-foreground">No se encontraron reglas.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Reglas de generación</h2>
          <p className="text-xs text-muted-foreground">Configuración del motor Autopilot</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetDefaults}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Volume */}
      <Section icon={<Dumbbell className="w-4 h-4" />} title="Volumen por sesión">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mínimo series" value={rules.min_sets_per_session} onChange={v => update("min_sets_per_session", v)} type="number" />
          <Field label="Máximo series" value={rules.max_sets_per_session} onChange={v => update("max_sets_per_session", v)} type="number" />
        </div>
      </Section>

      {/* Series by priority */}
      <Section icon={<Zap className="w-4 h-4" />} title="Series por prioridad">
        <div className="space-y-2">
          <PriorityRow label="P1 (Base)" min={rules.series_p1_min} max={rules.series_p1_max}
            onMinChange={v => update("series_p1_min", v)} onMaxChange={v => update("series_p1_max", v)} />
          <PriorityRow label="P2 (Desarrollo)" min={rules.series_p2_min} max={rules.series_p2_max}
            onMinChange={v => update("series_p2_min", v)} onMaxChange={v => update("series_p2_max", v)} />
          <PriorityRow label="P3 (Accesorio)" min={rules.series_p3_min} max={rules.series_p3_max}
            onMinChange={v => update("series_p3_min", v)} onMaxChange={v => update("series_p3_max", v)} />
        </div>
      </Section>

      {/* Reps & Rest by stimulus */}
      <Section icon={<Timer className="w-4 h-4" />} title="Reps y descanso por estímulo">
        <div className="space-y-3">
          {(["fuerza", "hipertrofia", "resistencia", "isometrico"] as const).map(s => (
            <div key={s} className="grid grid-cols-3 gap-2 items-end">
              <div>
                <Label className="text-xs capitalize">{s === "isometrico" ? "Isométrico" : s.charAt(0).toUpperCase() + s.slice(1)}</Label>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Reps</Label>
                <Input
                  value={rules[`reps_${s}`]}
                  onChange={e => update(`reps_${s}` as keyof TrainingRules, e.target.value as any)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Descanso</Label>
                <Input
                  value={rules[`rest_${s}`]}
                  onChange={e => update(`rest_${s}` as keyof TrainingRules, e.target.value as any)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Structure limits */}
      <Section icon={<Shield className="w-4 h-4" />} title="Límites de estructura">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Máx fatiga alta seguidas" value={rules.max_consecutive_high_fatigue} onChange={v => update("max_consecutive_high_fatigue", v)} type="number" />
          <Field label="Máx bisagras pesadas" value={rules.max_heavy_hinges} onChange={v => update("max_heavy_hinges", v)} type="number" />
          <Field label="Máx repetición patrón" value={rules.max_pattern_repeats} onChange={v => update("max_pattern_repeats", v)} type="number" />
          <Field label="Diferencia máx empuje/tirón" value={rules.push_pull_max_diff} onChange={v => update("push_pull_max_diff", v)} type="number" />
          <Field label="Máx ejercicios P2" value={rules.max_p2_exercises} onChange={v => update("max_p2_exercises", v)} type="number" />
          <Field label="Máx ejercicios P3" value={rules.max_p3_exercises} onChange={v => update("max_p3_exercises", v)} type="number" />
        </div>
      </Section>

      {/* Required patterns */}
      <Section icon={<Zap className="w-4 h-4" />} title="Patrones obligatorios">
        <div className="flex flex-wrap gap-2">
          {ALL_PATTERNS.map(p => (
            <button
              key={p}
              onClick={() => togglePattern(p)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                rules.required_patterns.includes(p)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </Section>

      {/* Recovery hours */}
      <Section icon={<Heart className="w-4 h-4" />} title="Horas de recuperación por músculo">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(rules.recovery_hours).map(([muscle, hours]) => (
            <div key={muscle} className="flex items-center gap-2">
              <Label className="text-xs w-24 truncate">{muscle}</Label>
              <Input
                type="number"
                value={hours}
                onChange={e => updateRecovery(muscle, parseInt(e.target.value) || 0)}
                className="h-8 text-sm w-20"
                min={0}
                max={168}
              />
              <span className="text-[10px] text-muted-foreground">h</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

// ─── Helper components ───

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-primary">{icon}</div>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type }: { label: string; value: number; onChange: (v: number) => void; type: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="h-8 text-sm mt-1"
        min={0}
      />
    </div>
  );
}

function PriorityRow({ label, min, max, onMinChange, onMaxChange }: {
  label: string; min: number; max: number;
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Badge variant="secondary" className="w-28 justify-center text-xs">{label}</Badge>
      <div className="flex items-center gap-1.5">
        <Input type="number" value={min} onChange={e => onMinChange(parseInt(e.target.value) || 0)} className="h-8 text-sm w-16" min={0} />
        <span className="text-xs text-muted-foreground">—</span>
        <Input type="number" value={max} onChange={e => onMaxChange(parseInt(e.target.value) || 0)} className="h-8 text-sm w-16" min={0} />
        <span className="text-xs text-muted-foreground">series</span>
      </div>
    </div>
  );
}

export default TrainingRulesEditor;
