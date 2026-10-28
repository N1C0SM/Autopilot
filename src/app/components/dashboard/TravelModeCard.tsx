import { generatePlanGuarded } from "@/shared/lib/planShield";
import { useState, useEffect } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Spinner } from "@/shared/components/ui/spinner";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { Plane } from "lucide-react";
import { toast } from "sonner";
import { toLocalDateString } from "@/shared/lib/localDates";
import { hapticNotify, hapticSelection } from "@/shared/lib/native";

interface Props {
  userId: string;
}

const rowInput = "h-11 min-w-0 flex-1 bg-transparent px-0 text-right";

const FieldRow = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) => (
  <div className="group/row flex min-h-[44px] items-center px-4">
    <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 group-[:not(:last-child)]/row:sep-b">
      <label htmlFor={htmlFor} className="shrink-0 type-body md:text-sm">{label}</label>
      {children}
    </div>
  </div>
);

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
      void hapticNotify("error");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ travel_mode_until: until, travel_equipment: equipment || "ninguno" })
      .eq("user_id", userId);
    if (error) {
      toast.error("Error al activar modo viaje");
      void hapticNotify("error");
      setSaving(false);
      return;
    }
    // Regenerate plan adapted to travel
    void generatePlanGuarded(supabase, { user_id: userId }, { userId });
    toast.success("Modo viaje activado. Tu plan se está adaptando");
    void hapticNotify("success");
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
      void hapticNotify("error");
      setSaving(false);
      return;
    }
    void generatePlanGuarded(supabase, { user_id: userId }, { userId });
    toast.success("Modo viaje desactivado. Volviendo a tu plan normal");
    void hapticNotify("success");
    setActive(false);
    setUntil("");
    setEquipment("");
    setSaving(false);
  };

  const showActive = active && !editing;
  const switchedOn = active || editing;

  const toggle = (on: boolean) => {
    void hapticSelection();
    if (on) setEditing(true);
    else if (active) void deactivate();
    else setEditing(false);
  };

  return (
    <ListGroup footer={editing ? "Equipamiento disponible, por ejemplo: solo gomas, gym del hotel, ninguno." : undefined}>
      <ListRow
        icon={<Plane />}
        title={showActive ? "Modo viaje activo" : "Modo viaje"}
        subtitle={showActive ? undefined : "Adapta tu plan cuando estás fuera de tu rutina habitual"}
        trailing={
          <>
            {saving && !editing ? <Spinner size="sm" className="mr-3" /> : null}
            <Switch checked={switchedOn} onCheckedChange={toggle} disabled={saving} aria-label="Modo viaje" />
          </>
        }
      />
      {showActive ? (
        <>
          <ListRow
            title="Hasta"
            value={new Date(until).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
          />
          <ListRow title="Equipamiento" value={equipment || "ninguno"} />
        </>
      ) : null}
      {editing ? (
        <>
          <FieldRow label="Hasta cuándo" htmlFor="travel-until">
            <Input
              id="travel-until"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              min={toLocalDateString()}
              className="ml-auto h-11 w-auto min-w-0 bg-transparent px-0"
            />
          </FieldRow>
          <FieldRow label="Equipamiento" htmlFor="travel-equipment">
            <Input
              id="travel-equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Opcional"
              aria-label="Equipamiento disponible"
              enterKeyHint="done"
              className={rowInput}
            />
          </FieldRow>
          <ListRow
            title={<span className="font-semibold text-primary">Activar</span>}
            trailing={saving ? <Spinner size="sm" label="Activando" /> : undefined}
            disabled={saving}
            onClick={() => void activate()}
          />
          <ListRow title="Cancelar" onClick={() => setEditing(false)} />
        </>
      ) : null}
    </ListGroup>
  );
};

export default TravelModeCard;
