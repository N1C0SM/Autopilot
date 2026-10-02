import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toLocalDateString } from "@/lib/localDates";

interface Props {
  userId: string;
}

const TravelModeCard = ({ userId }: Props) => {
  const [active, setActive] = useState(false);
  const [until, setUntil] = useState("");
  const [equipment, setEquipment] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("travel_mode_until, travel_equipment")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.travel_mode_until) {
        const endDate = new Date(data.travel_mode_until);
        if (endDate >= new Date(new Date().toDateString())) {
          setActive(true);
          setUntil(data.travel_mode_until);
          setEquipment(data.travel_equipment || "");
        }
      }
    };
    load();
  }, [userId]);

  const activate = async () => {
    if (!until) {
      toast.error("Indica hasta cuándo estarás de viaje");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ travel_mode_until: until, travel_equipment: equipment || "ninguno" })
      .eq("user_id", userId);
    if (error) {
      toast.error("Error al activar modo viaje");
      setSaving(false);
      return;
    }
    // Regenerate plan adapted to travel
    supabase.functions.invoke("generate-plan", { body: { user_id: userId } });
    toast.success("Modo viaje activado. Tu plan se está adaptando 🌴");
    setActive(true);
    setEditing(false);
    setSaving(false);
  };

  const deactivate = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ travel_mode_until: null, travel_equipment: null })
      .eq("user_id", userId);
    if (error) {
      toast.error("Error al desactivar modo viaje");
      setSaving(false);
      return;
    }
    supabase.functions.invoke("generate-plan", { body: { user_id: userId } });
    toast.success("Modo viaje desactivado. Volviendo a tu plan normal");
    setActive(false);
    setUntil("");
    setEquipment("");
    setSaving(false);
  };

  if (active && !editing) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-primary/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Plane className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-sm">Modo viaje activo</h3>
              <p className="text-xs text-muted-foreground">
                Hasta el{" "}
                {new Date(until).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Equipamiento: {equipment || "ninguno"}
              </p>
            </div>
          </div>
          <button
            onClick={deactivate}
            disabled={saving}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Desactivar modo viaje"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }

  if (editing || active) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Plane className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-sm">Activar modo viaje</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Hasta cuándo</Label>
            <Input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              min={toLocalDateString()}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Equipamiento disponible</Label>
            <Input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Ej: solo gomas, gym del hotel, ninguno"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="hero" size="sm" onClick={activate} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full bg-card rounded-2xl p-5 border border-border hover:border-primary/30 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <Plane className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-display font-bold text-sm">Modo viaje</h3>
          <p className="text-xs text-muted-foreground">
            Adapta tu plan cuando estás fuera de tu rutina habitual
          </p>
        </div>
      </div>
    </button>
  );
};

export default TravelModeCard;
