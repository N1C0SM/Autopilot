import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { hapticTap } from "@/lib/native";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  RENEWAL_LABELS,
  currentCycleWeek,
  cycleEndDate,
  formatDateES,
  type RenewalDecision,
} from "@/lib/renewal";

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
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0">
          <h3 className="type-headline">Ciclo Transformación 12 semanas</h3>
          <p className="type-subhead text-muted-foreground">
            {start
              ? `${week !== null ? `Semana ${Math.min(week, 12)} de 12 · ` : ""}Termina el ${formatDateES(end)}`
              : "Sin fecha de inicio: el cliente no verá el aviso de renovación"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="type-subhead mb-1.5 block text-muted-foreground">Fecha de inicio del ciclo</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <Label className="type-subhead mb-1.5 block text-muted-foreground">Decisión al terminar</Label>
          <select
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

      {!disabled && (
        <Button onClick={save} disabled={saving} onPointerDown={() => void hapticTap()}>
          {saving && <Spinner size="sm" className="mr-2" />}
          {saving ? "Guardando…" : "Guardar ciclo"}
        </Button>
      )}
    </section>
  );
};

export default TransformCyclePanel;
