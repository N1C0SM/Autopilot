import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock, RefreshCw, ArrowRightLeft, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import {
  RENEWAL_LABELS,
  currentCycleWeek,
  cycleEndDate,
  formatDateES,
  isTransformTier,
  type RenewalDecision,
} from "@/lib/renewal";

interface Props {
  userId: string;
  subscriptionTier: string;
}

const OPTIONS: { value: RenewalDecision; icon: typeof RefreshCw; variant: "hero" | "outline" | "ghost" }[] = [
  { value: "renovar", icon: RefreshCw, variant: "hero" },
  { value: "completo", icon: ArrowRightLeft, variant: "outline" },
  { value: "pausar", icon: PauseCircle, variant: "ghost" },
];

const RenewalFlow = ({ userId, subscriptionTier }: Props) => {
  const [cycleStart, setCycleStart] = useState<string | null>(null);
  const [decision, setDecision] = useState<RenewalDecision | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isTransformTier(subscriptionTier)) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("cycle_start_date, renewal_decision, renewal_prompt_shown_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) return;
      const start = ((data as any).cycle_start_date as string) || null;
      const dec = ((data as any).renewal_decision as RenewalDecision) || null;
      setCycleStart(start);
      setDecision(dec);
      const week = currentCycleWeek(start);
      if (!dec && week !== null && week >= 11) {
        setOpen(true);
        if (!(data as any).renewal_prompt_shown_at) {
          await supabase
            .from("profiles")
            .update({ renewal_prompt_shown_at: new Date().toISOString() } as any)
            .eq("user_id", userId);
        }
      }
    })();
  }, [userId, subscriptionTier]);

  const choose = async (value: RenewalDecision) => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ renewal_decision: value, renewal_decision_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar tu elección");
      return;
    }
    setDecision(value);
    setOpen(false);
    toast.success("Elección guardada. Tu entrenador ya lo sabe.");
  };

  if (!isTransformTier(subscriptionTier) || !cycleStart) return null;

  const end = cycleEndDate(cycleStart);
  const week = currentCycleWeek(cycleStart);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Tu ciclo Transformación termina en 1 semana</DialogTitle>
            <DialogDescription>¿Qué quieres hacer al terminar?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {OPTIONS.map(({ value, icon: Icon, variant }) => (
              <Button
                key={value}
                variant={variant}
                className="w-full justify-start"
                disabled={saving}
                onClick={() => choose(value)}
              >
                <Icon className="w-4 h-4 mr-2" />
                {RENEWAL_LABELS[value]}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Si no eliges nada antes del {formatDateES(end)}, pasas automáticamente al plan Completo (49€/mes) para no
            perder seguimiento.
          </p>
        </DialogContent>
      </Dialog>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <CalendarClock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-display font-semibold text-sm">Tu ciclo Transformación</div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {week !== null && <>Semana {Math.min(week, 12)} de 12 · </>}
              Termina el {formatDateES(end)}.
            </p>
            <p className="text-xs mt-2">
              <span className="text-muted-foreground">Al terminar: </span>
              <span className="font-semibold">
                {decision ? RENEWAL_LABELS[decision] : "Pasar a Completo (49€/mes) si no eliges otra opción"}
              </span>
            </p>
            {!decision && week !== null && week >= 11 && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}>
                Elegir ahora
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RenewalFlow;
