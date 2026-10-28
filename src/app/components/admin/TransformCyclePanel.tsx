import { useId, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticTap } from "@/shared/lib/native";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  RENEWAL_LABELS,
  currentCycleWeek,
  cycleEndDate,
  formatDateES,
  type RenewalDecision,
} from "@/shared/lib/renewal";

interface Props {
  userId: string;
  cycleStartDate: string | null;
  renewalDecision: string | null;
  disabled?: boolean;
}

const TransformCyclePanel = ({ userId, cycleStartDate, renewalDecision, disabled }: Props) => {
  const [start, setStart] = useState(cycleStartDate || "");
  const [decision, setDecision] = useState(renewalDecision || "");
  const [saving, setSaving] = useState(false);
  const formId = useId();

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        cycle_start_date: start || null,
        renewal_decision: decision ? decision : null,
      })
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar el ciclo");
      return;
    }
    toast.success("Ciclo actualizado");
  };

  const week = currentCycleWeek(start || null);
  const end = cycleEndDate(start || null);

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-4">
        <CalendarClock className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="type-headline">Ciclo Transformación 12 semanas</h3>
          <p className="mt-0.5 type-subhead text-muted-foreground tabular-nums">
            {start
              ? `${week !== null ? `Semana ${Math.min(week, 12)} de 12 · ` : ""}Termina el ${formatDateES(end)}`
              : "Sin fecha de inicio: el cliente no verá el aviso de renovación"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <Label htmlFor={`${formId}-start`} className={LABEL}>Fecha de inicio del ciclo</Label>
          <Input id={`${formId}-start`} type="date" className="tabular-nums" value={start} onChange={(e) => setStart(e.target.value)} disabled={disabled} />
        </div>
        <div className="min-w-0">
          <Label htmlFor={`${formId}-decision`} className={LABEL}>Decisión al terminar</Label>
          <select
            id={`${formId}-decision`}
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            disabled={disabled}
            className="field w-full"
          >
            <option value="">Sin respuesta (fallback: Completo)</option>
            {(Object.keys(RENEWAL_LABELS) as RenewalDecision[]).map((k) => (
              <option key={k} value={k}>
                {RENEWAL_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* En tinte: el botón dorado macizo de la ficha es «Guardar» (planes). */}
      {!disabled && (
        <Button variant="tinted" size="lg" className="w-full md:w-auto" onClick={() => { void hapticTap(); void save(); }} disabled={saving}>
          {saving && <Spinner size="sm" label="Guardando" />}
          {saving ? "Guardando…" : "Guardar ciclo"}
        </Button>
      )}
    </section>
  );
};

const LABEL = "mb-1.5 block px-1 type-subhead font-normal text-muted-foreground";

export default TransformCyclePanel;
