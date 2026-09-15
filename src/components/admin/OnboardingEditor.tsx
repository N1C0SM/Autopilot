import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

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
  { value: "lose_weight", label: "🔥 Perder grasa" },
  { value: "gain_muscle", label: "💪 Ganar músculo" },
  { value: "recomp", label: "⚡ Recomposición" },
  { value: "improve_endurance", label: "🏃 Mejorar resistencia" },
  { value: "general_health", label: "❤️ Salud general" },
  { value: "skill_based", label: "🤸 Skill concreto" },
];

const EQUIPMENT = ["Gimnasio", "Casa", "Mixto", "Calistenia"];

interface Props {
  userId: string;
  data: OnboardingEditable | null;
  onSaved: (next: OnboardingEditable) => void;
  onCancel: () => void;
}

const OnboardingEditor = ({ userId, data, onSaved, onCancel }: Props) => {
  const av = (data?.availability as any) || {};
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

  return (
    <div className="bg-card rounded-xl p-6 border border-border space-y-4">
      <h2 className="font-bold font-display text-sm uppercase tracking-wider text-muted-foreground">
        Editar onboarding
      </h2>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Edad</Label>
          <Input type="number" value={form.age} onChange={(e) => set("age", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Altura (cm)</Label>
          <Input type="number" value={form.height} onChange={(e) => set("height", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Peso (kg)</Label>
          <Input type="number" value={form.weight} onChange={(e) => set("weight", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Sexo</Label>
          <Select value={form.sex || "__none__"} onValueChange={(v) => set("sex", v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              <SelectItem value="male">Hombre</SelectItem>
              <SelectItem value="female">Mujer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Equipamiento</Label>
          <Select value={form.equipment_type} onValueChange={(v) => set("equipment_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EQUIPMENT.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Intensidad (1-10)</Label>
          <Input type="number" min={1} max={10} value={form.intensity_level} onChange={(e) => set("intensity_level", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Objetivo</Label>
          <Select value={form.goal || "__none__"} onValueChange={(v) => set("goal", v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {GOALS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Días / semana</Label>
          <Input type="number" min={1} max={7} value={form.days} onChange={(e) => set("days", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Horas por sesión</Label>
          <Input type="number" step="0.5" value={form.hours} onChange={(e) => set("hours", e.target.value)} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Meta específica / skill</Label>
          <Input value={form.specific_goal} onChange={(e) => set("specific_goal", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Deportes</Label>
          <Input value={form.sports} onChange={(e) => set("sports", e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Lesiones / condiciones</Label>
        <Textarea rows={2} value={form.injuries} onChange={(e) => set("injuries", e.target.value)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Preferencias nutricionales</Label>
          <Textarea rows={2} value={form.nutrition_preferences} onChange={(e) => set("nutrition_preferences", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Alergias</Label>
          <Textarea rows={2} value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving} className="gap-2">
          <X className="w-4 h-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
};

export default OnboardingEditor;
