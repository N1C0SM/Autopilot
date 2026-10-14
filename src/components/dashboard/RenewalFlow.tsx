import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock, RefreshCw, ArrowRightLeft, PauseCircle } from "lucide-react";
import { hapticNotify, hapticTap } from "@/lib/native";
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

const OPTIONS: { value: RenewalDecision; icon: typeof RefreshCw; variant: "hero" | "tinted" | "plain" }[] = [
  { value: "renovar", icon: RefreshCw, variant: "hero" },
  { value: "completo", icon: ArrowRightLeft, variant: "tinted" },
  { value: "pausar", icon: PauseCircle, variant: "plain" },
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
      const start = (data.cycle_start_date as string) || null;
      const dec = (data.renewal_decision as RenewalDecision) || null;
      setCycleStart(start);
      setDecision(dec);
      const week = currentCycleWeek(start);
      if (!dec && week !== null && week >= 11) {
        setOpen(true);
        if (!data.renewal_prompt_shown_at) {
          await supabase
            .from("profiles")
            .update({ renewal_prompt_shown_at: new Date().toISOString() })
            .eq("user_id", userId);
        }
      }
    })();
  }, [userId, subscriptionTier]);

  const choose = async (value: RenewalDecision) => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ renewal_decision: value, renewal_decision_at: new Date().toISOString() })
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      void hapticNotify("error");
      toast.error("No se pudo guardar tu elección");
      return;
    }
    void hapticNotify("success");
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tu ciclo Transformación termina en 1 semana</DialogTitle>
            <DialogDescription>¿Qué quieres hacer al terminar?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {OPTIONS.map(({ value, icon: Icon, variant }) => (
              <Button
                key={value}
                variant={variant}
                size="lg"
                className="w-full"
                disabled={saving}
                onClick={() => { void hapticTap(); void choose(value); }}
              >
                <Icon className="mr-2 h-5 w-5" />
                {RENEWAL_LABELS[value]}
              </Button>
            ))}
          </div>
          <p className="type-footnote text-muted-foreground">
            Si no eliges nada antes del {formatDateES(end)}, pasas automáticamente al plan Completo (49€/mes) para no
            perder seguimiento.
          </p>
        </DialogContent>
      </Dialog>

      <div className="flex items-start gap-4 px-1">
        <CalendarClock className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0">
          <div className="type-headline">Tu ciclo Transformación</div>
          <p className="mt-0.5 type-subhead text-muted-foreground">
            {week !== null && <>Semana {Math.min(week, 12)} de 12 · </>}
            Termina el {formatDateES(end)}.
          </p>
          <p className="mt-2 type-subhead">
            <span className="text-muted-foreground">Al terminar: </span>
            <span className="font-semibold">
              {decision ? RENEWAL_LABELS[decision] : "Pasar a Completo (49€/mes) si no eliges otra opción"}
            </span>
          </p>
          {!decision && week !== null && week >= 11 && (
            <Button size="sm" variant="tinted" className="mt-3" onClick={() => { void hapticTap(); setOpen(true); }}>
              Elegir ahora
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default RenewalFlow;
