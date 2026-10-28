import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Spinner } from "@/shared/components/ui/spinner";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { hapticNotify, hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

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

const DEFAULTS: Omit<TrainingRules,"id"> = {
  min_sets_per_session: 12,
  max_sets_per_session: 20,
  series_p1_min: 3, series_p1_max: 5,
  series_p2_min: 3, series_p2_max: 4,
  series_p3_min: 2, series_p3_max: 3,
  reps_fuerza:"4-8", reps_hipertrofia:"8-15", reps_resistencia:"15-25", reps_isometrico:"20-60s",
  rest_fuerza:"180s", rest_hipertrofia:"90s", rest_resistencia:"45s", rest_isometrico:"60s",
  max_consecutive_high_fatigue: 2, max_heavy_hinges: 1, max_pattern_repeats: 2, push_pull_max_diff: 1,
  max_p2_exercises: 2, max_p3_exercises: 2,
  required_patterns: ["Empuje","Tirón","Sentadilla","Bisagra","Core"],
  recovery_hours: { Pecho: 48, Espalda: 48, Hombros: 48, Bíceps: 36, Tríceps: 36, Piernas: 72, Glúteos: 48, Core: 24,"Cuerpo completo": 48, Cardio: 24 },
};

const ALL_PATTERNS = ["Empuje","Tirón","Sentadilla","Bisagra","Core","Aislamiento"];

const STIMULI = ["fuerza", "hipertrofia", "resistencia", "isometrico"] as const;
const STIMULUS_LABELS: Record<(typeof STIMULI)[number], string> = {
  fuerza: "Fuerza",
  hipertrofia: "Hipertrofia",
  resistencia: "Resistencia",
  isometrico: "Isométrico",
};

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
        recovery_hours: typeof data.recovery_hours ==="object" && data.recovery_hours !== null ? data.recovery_hours as Record<string, number> : DEFAULTS.recovery_hours,
      });
    }
    setLoading(false);
  };

  const update = <K extends keyof TrainingRules>(key: K, value: TrainingRules[K]) => {
    setRules((r) => r ? { ...r, [key]: value } : r);
  };

  const togglePattern = (p: string) => {
    if (!rules) return;
    void hapticSelection();
    const current = rules.required_patterns;
    update("required_patterns", current.includes(p) ? current.filter(x => x !== p) : [...current, p]);
  };

  const updateRecovery = (muscle: string, hours: number) => {
    if (!rules) return;
    update("recovery_hours", { ...rules.recovery_hours, [muscle]: hours });
  };

  const save = async () => {
    if (!rules) return;
    void hapticTap();
    setSaving(true);
    const { id, ...rest } = rules;
    const { error } = await supabase.from("training_rules").update(rest).eq("id", id);
    if (error) {
      void hapticNotify("error");
      toast.error("Error al guardar");
    } else {
      void hapticNotify("success");
      toast.success("Reglas actualizadas");
    }
    setSaving(false);
  };

  const resetDefaults = () => {
    if (!rules) return;
    void hapticTap();
    setRules({ ...DEFAULTS, id: rules.id });
    toast.info("Valores por defecto restaurados (guarda para aplicar)");
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!rules) return <EmptyState icon={SlidersHorizontal} title="Sin reglas" description="No se encontraron reglas de generación." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="type-subhead text-muted-foreground">Configuración del motor Autopilot</p>
        <Button type="button" variant="plain" size="sm" className="-mr-3.5 h-11 shrink-0" onClick={resetDefaults}>
          Restablecer
        </Button>
      </div>

      <ListGroup header="Volumen por sesión">
        <NumberRow id="rule-min-sets" label="Mínimo de series" value={rules.min_sets_per_session} onChange={v => update("min_sets_per_session", v)} />
        <NumberRow id="rule-max-sets" label="Máximo de series" value={rules.max_sets_per_session} onChange={v => update("max_sets_per_session", v)} />
      </ListGroup>

      <ListGroup header="Series por prioridad" footer="Mínimo y máximo de series para cada prioridad.">
        <RangeRow label="P1 (Base)" min={rules.series_p1_min} max={rules.series_p1_max}
          onMinChange={v => update("series_p1_min", v)} onMaxChange={v => update("series_p1_max", v)} />
        <RangeRow label="P2 (Desarrollo)" min={rules.series_p2_min} max={rules.series_p2_max}
          onMinChange={v => update("series_p2_min", v)} onMaxChange={v => update("series_p2_max", v)} />
        <RangeRow label="P3 (Accesorio)" min={rules.series_p3_min} max={rules.series_p3_max}
          onMinChange={v => update("series_p3_min", v)} onMaxChange={v => update("series_p3_max", v)} />
      </ListGroup>

      <ListGroup header="Repeticiones por estímulo" footer="Rango de repeticiones por serie, por ejemplo 8-15.">
        {STIMULI.map(s => (
          <TextRow
            key={s}
            id={`rule-reps-${s}`}
            label={STIMULUS_LABELS[s]}
            ariaLabel={`Repeticiones de ${STIMULUS_LABELS[s]}`}
            value={rules[`reps_${s}`]}
            onChange={v => update(`reps_${s}`, v)}
          />
        ))}
      </ListGroup>

      <ListGroup header="Descanso por estímulo" footer="Tiempo entre series, por ejemplo 90s.">
        {STIMULI.map(s => (
          <TextRow
            key={s}
            id={`rule-rest-${s}`}
            label={STIMULUS_LABELS[s]}
            ariaLabel={`Descanso de ${STIMULUS_LABELS[s]}`}
            value={rules[`rest_${s}`]}
            onChange={v => update(`rest_${s}`, v)}
          />
        ))}
      </ListGroup>

      <ListGroup header="Límites de estructura">
        <NumberRow id="rule-fatigue" label="Máx. fatiga alta seguidas" value={rules.max_consecutive_high_fatigue} onChange={v => update("max_consecutive_high_fatigue", v)} />
        <NumberRow id="rule-hinges" label="Máx. bisagras pesadas" value={rules.max_heavy_hinges} onChange={v => update("max_heavy_hinges", v)} />
        <NumberRow id="rule-repeats" label="Máx. repetición de patrón" value={rules.max_pattern_repeats} onChange={v => update("max_pattern_repeats", v)} />
        <NumberRow id="rule-push-pull" label="Diferencia máx. empuje/tirón" value={rules.push_pull_max_diff} onChange={v => update("push_pull_max_diff", v)} />
        <NumberRow id="rule-p2" label="Máx. ejercicios P2" value={rules.max_p2_exercises} onChange={v => update("max_p2_exercises", v)} />
        <NumberRow id="rule-p3" label="Máx. ejercicios P3" value={rules.max_p3_exercises} onChange={v => update("max_p3_exercises", v)} />
      </ListGroup>

      <ListGroup header="Patrones obligatorios">
        <div className="flex flex-wrap gap-2 p-4">
          {ALL_PATTERNS.map(p => {
            const selected = rules.required_patterns.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={selected}
                onClick={() => togglePattern(p)}
                className={cn(
                  "relative h-9 rounded-full px-4 type-subhead font-medium transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-1",
                  selected ? "bg-primary/15 text-primary active:bg-primary/25" : "bg-secondary text-muted-foreground active:bg-accent",
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
      </ListGroup>

      <ListGroup header="Horas de recuperación por músculo">
        {Object.entries(rules.recovery_hours).map(([muscle, hours]) => {
          const id = `rule-recovery-${muscle.trim().toLowerCase().replace(/\s+/g, "-")}`;
          return (
            <ListRow
              key={muscle}
              title={<label htmlFor={id} className="block whitespace-normal">{muscle}</label>}
              trailing={
                <div className="flex items-center gap-2">
                  <CountInput id={id} label={`Horas de recuperación de ${muscle}`} value={hours} max={168} onChange={v => updateRecovery(muscle, v)} />
                  <span className="type-subhead text-muted-foreground" aria-hidden="true">h</span>
                </div>
              }
            />
          );
        })}
      </ListGroup>

      <Button type="button" size="lg" className="w-full" onClick={save} disabled={saving}>
        {saving ? <Spinner size="sm" className="text-primary-foreground" /> : null}
        Guardar
      </Button>
    </div>
  );
};

// ─── Helper components ───

function CountInput({ id, label, value, onChange, max, className }: {
  id?: string; label: string; value: number; onChange: (v: number) => void; max?: number; className?: string;
}) {
  return (
    <HitArea>
      <Input
        id={id}
        aria-label={label}
        type="number"
        inputMode="numeric"
        enterKeyHint="done"
        min={0}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        onFocus={e => e.currentTarget.select()}
        className={cn("h-9 w-16 text-right", className)}
      />
    </HitArea>
  );
}

function NumberRow({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <ListRow
      title={<label htmlFor={id} className="block whitespace-normal">{label}</label>}
      trailing={<CountInput id={id} label={label} value={value} onChange={onChange} />}
    />
  );
}

function RangeRow({ label, min, max, onMinChange, onMaxChange }: {
  label: string; min: number; max: number;
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
}) {
  return (
    <ListRow
      title={label}
      trailing={
        <div className="flex items-center gap-2">
          <CountInput label={`${label}, mínimo de series`} value={min} onChange={onMinChange} className="w-14 px-2 text-center" />
          <span className="type-subhead text-muted-foreground" aria-hidden="true">–</span>
          <CountInput label={`${label}, máximo de series`} value={max} onChange={onMaxChange} className="w-14 px-2 text-center" />
        </div>
      }
    />
  );
}

function TextRow({ id, label, ariaLabel, value, onChange }: {
  id: string; label: string; ariaLabel: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <ListRow
      title={<label htmlFor={id} className="block whitespace-normal">{label}</label>}
      trailing={
        <HitArea>
          <Input
            id={id}
            aria-label={ariaLabel}
            value={value}
            onChange={e => onChange(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            className="h-9 w-24 px-2 text-right"
          />
        </HitArea>
      }
    />
  );
}

/** Keeps the compact 36 px field look while the tappable area reaches 44 px. */
function HitArea({ children }: { children: ReactNode }) {
  return <label className="-my-1 flex items-center py-1">{children}</label>;
}

export default TrainingRulesEditor;
