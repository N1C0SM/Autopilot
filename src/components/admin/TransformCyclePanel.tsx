import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Save } from "lucide-react";
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
      } as any)
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
    <div className="bg-card rounded-xl p-5 border border-border space-y-4">
      <div className="flex items-center gap-3">
        <CalendarClock className="w-5 h-5 text-primary" />
        <div>
          <div className="font-medium text-sm">Ciclo Transformación 12 semanas</div>
          <div className="text-xs text-muted-foreground">
            {start
              ? `${week !== null ? `Semana ${Math.min(week, 12)} de 12 · ` : ""}Termina el ${formatDateES(end)}`
              : "Sin fecha de inicio: el cliente no verá el aviso de renovación"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Fecha de inicio del ciclo</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Decisión al terminar</Label>
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            disabled={disabled}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
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
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Guardando..." : "Guardar ciclo"}
        </Button>
      )}
    </div>
  );
};

export default TransformCyclePanel;
