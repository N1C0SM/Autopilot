import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Loader2, Save, Link as LinkIcon } from "lucide-react";

type Mode = "test" | "live";

interface SettingsData {
  id: string;
  payment_mode: Mode;
  payment_link_training_test: string;
  payment_link_training_live: string;
  payment_link_full_test: string;
  payment_link_full_live: string;
  payment_link_transform_test: string;
  payment_link_transform_live: string;
}

const FIELDS: Array<keyof Omit<SettingsData, "id" | "payment_mode">> = [
  "payment_link_training_test",
  "payment_link_training_live",
  "payment_link_full_test",
  "payment_link_full_live",
  "payment_link_transform_test",
  "payment_link_transform_live",
];

const PLANS = [
  { key: "training", label: "Entrenamiento", price: "29€/mes" },
  { key: "full", label: "Completo", price: "49€/mes" },
  { key: "transform", label: "Transformación 12 semanas", price: "299€ pago único" },
] as const;

const PaymentModeToggle = () => {
  const [s, setS] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings").select("*").limit(1).single();
      if (data) {
        const d = data as any;
        const next: SettingsData = {
          id: d.id,
          payment_mode: (d.payment_mode || "test") as Mode,
          payment_link_training_test: d.payment_link_training_test || "",
          payment_link_training_live: d.payment_link_training_live || "",
          payment_link_full_test: d.payment_link_full_test || "",
          payment_link_full_live: d.payment_link_full_live || "",
          payment_link_transform_test: d.payment_link_transform_test || "",
          payment_link_transform_live: d.payment_link_transform_live || "",
        };
        setS(next);
      }
      setLoading(false);
    })();
  }, []);

  const setField = (k: keyof SettingsData, v: string) => s && setS({ ...s, [k]: v });

  const toggleMode = async () => {
    if (!s) return;
    const newMode: Mode = s.payment_mode === "test" ? "live" : "test";
    setSaving(true);
    const { error } = await supabase.from("settings").update({ payment_mode: newMode } as any).eq("id", s.id);
    setSaving(false);
    if (error) return toast.error("Error al cambiar modo");
    setS({ ...s, payment_mode: newMode });
    toast.success(`Modo cambiado a ${newMode.toUpperCase()}`);
  };

  const saveAll = async () => {
    if (!s) return;
    setSaving(true);
    const payload: any = {};
    FIELDS.forEach((f) => (payload[f] = s[f]));
    const { error } = await supabase.from("settings").update(payload).eq("id", s.id);
    setSaving(false);
    if (error) return toast.error("Error al guardar");
    toast.success("Configuración guardada");
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  if (!s) return <div className="text-sm text-muted-foreground">No se encontró configuración</div>;

  const mode = s.payment_mode;

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="bg-card rounded-xl p-5 border border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">Modo de Pago</div>
            <div className="text-xs text-muted-foreground">
              Activo:{" "}
              <span className={`font-bold ${mode === "live" ? "text-destructive" : "text-primary"}`}>
                {mode.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <Button variant={mode === "live" ? "destructive" : "outline"} size="sm" onClick={toggleMode} disabled={saving}>
          {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
          Cambiar a {mode === "test" ? "LIVE" : "TEST"}
        </Button>
      </div>

      {/* Payment Links per plan */}
      <div className="bg-card rounded-xl p-5 border border-border space-y-5">
        <div className="flex items-center gap-3">
          <LinkIcon className="w-5 h-5 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">Payment Links de Stripe</div>
            <div className="text-xs text-muted-foreground">
              Pega el Payment Link de Stripe para cada plan (Test y Live). Se usará el del modo activo.
            </div>
          </div>
        </div>

        {PLANS.map((p) => (
          <div key={p.key} className="space-y-2 pt-2 border-t border-border first:border-t-0 first:pt-0">
            <div className="flex items-baseline justify-between">
              <div className="font-medium text-sm">{p.label}</div>
              <div className="text-xs text-muted-foreground">{p.price}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Test</Label>
              <Input
                value={(s as any)[`payment_link_${p.key}_test`]}
                onChange={(e) => setField(`payment_link_${p.key}_test` as any, e.target.value)}
                placeholder="https://buy.stripe.com/test_..."
                className="mt-1 text-sm font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Live</Label>
              <Input
                value={(s as any)[`payment_link_${p.key}_live`]}
                onChange={(e) => setField(`payment_link_${p.key}_live` as any, e.target.value)}
                placeholder="https://buy.stripe.com/..."
                className="mt-1 text-sm font-mono"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted/30 rounded-xl p-4 border border-border text-xs text-muted-foreground">
        Los <span className="font-medium text-foreground">webhook secrets</span> de Stripe se gestionan de forma segura
        como secretos del servidor (no en la base de datos). Si necesitas rotarlos, hazlo desde la configuración de
        secretos del backend.
      </div>

      <Button onClick={saveAll} disabled={saving} className="w-full" size="lg">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Guardar configuración
      </Button>
    </div>
  );
};

export default PaymentModeToggle;