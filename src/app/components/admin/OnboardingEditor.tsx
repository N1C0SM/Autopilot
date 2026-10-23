import { useId, useState, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { toast } from "sonner";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import type { Json } from "@/shared/integrations/supabase/types";

export interface OnboardingEditable {
  age: number | null;
  height: number | null;
  weight: number | null;
  sex: string | null;
  goal: string | null;
  sports: string | null;
  injuries: string | null;
  intensity_level: number | null;
  availability: Json | null;
  nutrition_preferences: string | null;
  allergies: string | null;
  equipment_type: string | null;
  specific_goal: string | null;
}

const GOALS = [
  { value: "lose_weight", label: "Perder grasa" },
  { value: "gain_muscle", label: "Ganar músculo" },
  { value: "recomp", label: "Recomposición" },
  { value: "improve_endurance", label: "Mejorar resistencia" },
  { value: "general_health", label: "Salud general" },
  { value: "skill_based", label: "Skill concreto" },
];

const EQUIPMENT = ["Gimnasio", "Casa", "Mixto", "Calistenia"];

interface Props {
  userId: string;
  data: OnboardingEditable | null;
  onSaved: (next: OnboardingEditable) => void;
  onCancel: () => void;
}

const OnboardingEditor = ({ userId, data, onSaved, onCancel }: Props) => {
  const av = data?.availability && typeof data.availability === "object" && !Array.isArray(data.availability) ? data.availability : {};
  const [form, setForm] = useState({
    age: data?.age?.toString() ?? "",
    height: data?.height?.toString() ?? "",
    weight: data?.weight?.toString() ?? "",
    sex: data?.sex ?? "",
    goal: data?.goal ?? "",
    specific_goal: data?.specific_goal ?? "",
    sports: data?.sports ?? "",
    injuries: data?.injuries ?? "",
    intensity_level: data?.intensity_level?.toString() ?? "",
    nutrition_preferences: data?.nutrition_preferences ?? "",
    allergies: data?.allergies ?? "",
    equipment_type: data?.equipment_type ?? "Mixto",
    days: av?.days?.toString() ?? "",
    hours: av?.hours?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const formId = useId();

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = async () => {
    setSaving(true);
    const availability = {
      ...(av || {}),
      ...(form.days.trim() !== "" ? { days: num(form.days) } : {}),
      ...(form.hours.trim() !== "" ? { hours: num(form.hours) } : {}),
    };
    const payload = {
      user_id: userId,
      age: num(form.age),
      height: num(form.height),
      weight: num(form.weight),
      sex: form.sex || null,
      goal: form.goal || null,
      specific_goal: form.specific_goal || null,
      sports: form.sports || null,
      injuries: form.injuries || null,
      intensity_level: num(form.intensity_level),
      nutrition_preferences: form.nutrition_preferences || null,
      allergies: form.allergies || null,
      equipment_type: form.equipment_type || "Mixto",
      availability: availability as Json,
    };
    const { error } = await supabase.from("onboarding").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar el onboarding");
      return;
    }
    toast.success("Onboarding actualizado");
    onSaved({ ...(data as OnboardingEditable), ...payload } as OnboardingEditable);
  };

  const field = (key: string) => `${formId}-${key}`;

  return (
    <section className="space-y-8" aria-labelledby={field("title")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={field("title")} className="type-title3">Editar datos del cliente</h2>
          <p className="mt-0.5 type-subhead text-muted-foreground">Los cambios se aplican al cuestionario del cliente.</p>
        </div>
        <Button variant="plain" size="sm" className="-mr-3 shrink-0" onClick={() => { void hapticTap(); onCancel(); }} disabled={saving}>
          Cancelar
        </Button>
      </div>

      <FormGroup header="Cuerpo">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="min-w-0">
            <Label htmlFor={field("age")} className={LABEL}>Edad</Label>
            <Input id={field("age")} type="number" inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" className="tabular-nums" value={form.age} onChange={(e) => set("age", e.target.value)} />
          </div>
          <div className="min-w-0">
            <Label htmlFor={field("sex")} className={LABEL}>Sexo</Label>
            <Select value={form.sex || "__none__"} onValueChange={(v) => { void hapticSelection(); set("sex", v === "__none__" ? "" : v); }}>
              <SelectTrigger id={field("sex")}><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                <SelectItem value="male">Hombre</SelectItem>
                <SelectItem value="female">Mujer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label htmlFor={field("height")} className={LABEL}>Altura (cm)</Label>
            <Input id={field("height")} type="number" inputMode="decimal" enterKeyHint="next" className="tabular-nums" value={form.height} onChange={(e) => set("height", e.target.value)} />
          </div>
          <div className="min-w-0">
            <Label htmlFor={field("weight")} className={LABEL}>Peso (kg)</Label>
            <Input id={field("weight")} type="number" inputMode="decimal" enterKeyHint="next" className="tabular-nums" value={form.weight} onChange={(e) => set("weight", e.target.value)} />
          </div>
        </div>
      </FormGroup>

      <FormGroup header="Objetivo">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor={field("goal")} className={LABEL}>Objetivo</Label>
            <Select value={form.goal || "__none__"} onValueChange={(v) => { void hapticSelection(); set("goal", v === "__none__" ? "" : v); }}>
              <SelectTrigger id={field("goal")}><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {GOALS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label htmlFor={field("specific-goal")} className={LABEL}>Meta específica o skill</Label>
            <Input id={field("specific-goal")} enterKeyHint="next" value={form.specific_goal} onChange={(e) => set("specific_goal", e.target.value)} />
          </div>
        </div>
      </FormGroup>

      <FormGroup header="Entrenamiento">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="min-w-0">
            <Label htmlFor={field("equipment")} className={LABEL}>Equipamiento</Label>
            <Select value={form.equipment_type} onValueChange={(v) => { void hapticSelection(); set("equipment_type", v); }}>
              <SelectTrigger id={field("equipment")}><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label htmlFor={field("intensity")} className={LABEL}>Intensidad (1–10)</Label>
            <Input id={field("intensity")} type="number" inputMode="numeric" pattern="[0-9]*" min={1} max={10} enterKeyHint="next" className="tabular-nums" value={form.intensity_level} onChange={(e) => set("intensity_level", e.target.value)} />
          </div>
          <div className="min-w-0">
            <Label htmlFor={field("days")} className={LABEL}>Días por semana</Label>
            <Input id={field("days")} type="number" inputMode="numeric" pattern="[0-9]*" min={1} max={7} enterKeyHint="next" className="tabular-nums" value={form.days} onChange={(e) => set("days", e.target.value)} />
          </div>
          <div className="min-w-0">
            <Label htmlFor={field("hours")} className={LABEL}>Horas por sesión</Label>
            <Input id={field("hours")} type="number" inputMode="decimal" step="0.5" enterKeyHint="next" className="tabular-nums" value={form.hours} onChange={(e) => set("hours", e.target.value)} />
          </div>
        </div>
        <div className="mt-3 min-w-0">
          <Label htmlFor={field("sports")} className={LABEL}>Deportes</Label>
          <Input id={field("sports")} enterKeyHint="next" value={form.sports} onChange={(e) => set("sports", e.target.value)} />
        </div>
      </FormGroup>

      <FormGroup header="Salud y nutrición">
        <div className="space-y-3">
          <div className="min-w-0">
            <Label htmlFor={field("injuries")} className={LABEL}>Lesiones o condiciones</Label>
            <Textarea id={field("injuries")} rows={2} value={form.injuries} onChange={(e) => set("injuries", e.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor={field("nutrition")} className={LABEL}>Preferencias nutricionales</Label>
              <Textarea id={field("nutrition")} rows={2} value={form.nutrition_preferences} onChange={(e) => set("nutrition_preferences", e.target.value)} />
            </div>
            <div className="min-w-0">
              <Label htmlFor={field("allergies")} className={LABEL}>Alergias</Label>
              <Textarea id={field("allergies")} rows={2} value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
            </div>
          </div>
        </div>
      </FormGroup>

      {/* Acción en tinte: el botón dorado macizo de la ficha es «Guardar» (planes). */}
      <Button variant="tinted" size="lg" className="w-full md:w-auto" onClick={() => { void hapticTap(); void save(); }} disabled={saving}>
        {saving && <Spinner size="sm" label="Guardando" />}
        {saving ? "Guardando…" : "Guardar datos"}
      </Button>
    </section>
  );
};

const LABEL = "mb-1.5 block px-1 type-subhead font-normal text-muted-foreground";

/** Grupo de campos con cabecera de lista agrupada, sin caja: los campos ya van en gris sobre negro. */
const FormGroup = ({ header, children }: { header: string; children: ReactNode }) => (
  <div>
    <h3 className="type-group-header px-1 pb-2">{header}</h3>
    {children}
  </div>
);

export default OnboardingEditor;
