import { useEffect, useState } from "react";
import { Flame, Image as ImageIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { hapticSelection } from "@/shared/lib/native";
import type { DayPlan } from "@/shared/types/training";
import { SESSION_EMOJIS, cleanSessionIcon, suggestSessionIcon, suggestSessionName } from "@/shared/lib/sessionIdentity";
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";

interface Props {
  plan: DayPlan | null;
  number: number;
  onOpenChange: (open: boolean) => void;
  /** Guarda nombre e icono; devuelve false si no se pudo (la hoja sigue abierta). */
  onSave: (identity: { name: string; icon: string | null }) => Promise<boolean>;
}

/**
 * «Personalizar sesión»: nombre propio o sugerido y un icono (la foto de la sesión, un emoji
 * propio o el sugerido según sus ejercicios). Es `SessionIdentitySheet` en `TrainView.swift`.
 */
const SessionIdentitySheet = ({ plan, number, onOpenChange, onSave }: Props) => {
  const gym = plan?.type === "gimnasio";
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setName(plan.routine_name ?? "");
    setIcon(cleanSessionIcon(plan.session_icon));
  }, [plan]);

  if (!plan) return null;
  const suggestedName = suggestSessionName(plan);
  const suggestedIcon = suggestSessionIcon(plan);
  const pick = (value: string | null) => { void hapticSelection(); setIcon(value); };
  const save = async () => {
    setSaving(true);
    const ok = await onSave({ name, icon });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  const tile = "flex h-12 w-12 items-center justify-center rounded-2xl text-[24px] transition-[transform,box-shadow] duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <ResponsiveSheet
      open={!!plan}
      onOpenChange={onOpenChange}
      title="Personalizar sesión"
      description={`Sesión ${number}`}
      footer={
        <Button type="button" variant="hero" size="lg" className="w-full" disabled={saving || (gym && !name.trim())} onClick={() => void save()}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      }
    >
      <div className="space-y-6">
        {gym && (
          <section aria-labelledby="session-name" className="space-y-2.5">
            <h3 id="session-name" className="type-subhead font-semibold">Nombre</h3>
            <Input aria-labelledby="session-name" value={name} maxLength={40} placeholder={suggestedName}
              onChange={(event) => setName(event.target.value)} className="h-12" />
            {name.trim() !== suggestedName && (
              <button type="button" onClick={() => { void hapticSelection(); setName(suggestedName); }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 type-subhead text-foreground active:opacity-70">
                <span className="text-muted-foreground">Sugerido:</span> {suggestedName}
              </button>
            )}
          </section>
        )}

        <section aria-labelledby="session-icon" className="space-y-2.5">
          <h3 id="session-icon" className="type-subhead font-semibold">Icono</h3>
          <p className="type-footnote text-muted-foreground">
            {gym ? "La foto de la sesión o un emoji. El sugerido, con el punto dorado, sale de sus ejercicios." : "El icono de la actividad o un emoji. El sugerido lleva el punto dorado."}
          </p>
          <div role="radiogroup" aria-labelledby="session-icon" className="flex flex-wrap gap-2.5">
            <button type="button" role="radio" aria-checked={icon === null} aria-label={gym ? "Foto de la sesión" : "Icono de actividad"} onClick={() => pick(null)}
              className={cn(tile, "bg-secondary text-muted-foreground", icon === null && "ring-2 ring-primary")}>
              {gym ? <ImageIcon className="h-5 w-5" aria-hidden /> : <Flame className="h-5 w-5 text-primary" aria-hidden />}
            </button>
            {[suggestedIcon, ...SESSION_EMOJIS.filter((emoji) => emoji !== suggestedIcon)].map((emoji) => (
              <button key={emoji} type="button" role="radio" aria-checked={icon === emoji}
                aria-label={emoji === suggestedIcon ? `${emoji}, sugerido` : emoji} onClick={() => pick(emoji)}
                className={cn(tile, "relative bg-secondary", icon === emoji && "ring-2 ring-primary")}>
                <span aria-hidden>{emoji}</span>
                {emoji === suggestedIcon && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />}
              </button>
            ))}
          </div>
        </section>
      </div>
    </ResponsiveSheet>
  );
};

export default SessionIdentitySheet;
