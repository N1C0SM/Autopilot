import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type PlanRow = {
  key: string; name: string; tagline: string; description: string; price: number; trial_days: number;
  features: string[]; not_included: string[]; cta: string; enabled: boolean; publicly_visible: boolean;
  accepting_new_subscriptions: boolean; sort_order: number;
};

const KEYS = ["free", "training", "full"];
const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

/** Editor of the public Free/Plus/Coach catalog. Payment links stay in Pagos. */
export default function ConsumerPlansAdmin() {
  const [plans, setPlans] = useState<PlanRow[]>([]);

  const load = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("product_configs") as any).select("*").in("key", KEYS).order("sort_order");
    setPlans((data || []) as PlanRow[]);
  };
  useEffect(() => { void load(); }, []);

  const save = async (key: string, patch: Partial<PlanRow>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("product_configs") as any).update(patch).eq("key", key);
    if (error) return toast.error("No se pudo guardar");
    setPlans((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    toast.success("Guardado");
  };

  if (!plans.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="type-title2">Planes</h2>
        <p className="type-subhead text-muted-foreground">Lo que cambies aquí se ve al momento en la portada y en /planes. Los enlaces de cobro siguen en Pagos.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.key} className={`space-y-3 rounded-2xl bg-card p-4 ${p.enabled && p.publicly_visible ? "" : "opacity-60"}`}>
            <div className="flex items-center justify-between gap-2">
              <Input aria-label="Nombre" className="type-headline" defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && void save(p.key, { name: e.target.value })} />
              <Switch aria-label={`Mostrar ${p.name}`} checked={p.enabled && p.publicly_visible} onCheckedChange={(v) => void save(p.key, { enabled: v, publicly_visible: v })} />
            </div>
            <label className="block space-y-1 type-footnote text-muted-foreground">Frase corta
              <Input defaultValue={p.tagline} onBlur={(e) => e.target.value !== p.tagline && void save(p.key, { tagline: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 type-footnote text-muted-foreground">Precio €/mes
                <Input type="number" inputMode="decimal" min={0} defaultValue={p.price} onBlur={(e) => Number(e.target.value) !== Number(p.price) && void save(p.key, { price: Number(e.target.value) || 0 })} />
              </label>
              <label className="space-y-1 type-footnote text-muted-foreground">Días de prueba
                <Input type="number" inputMode="numeric" min={0} defaultValue={p.trial_days} onBlur={(e) => Number(e.target.value) !== p.trial_days && void save(p.key, { trial_days: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <label className="block space-y-1 type-footnote text-muted-foreground">Incluye (una por línea)
              <Textarea rows={5} defaultValue={(p.features || []).join("\n")} onBlur={(e) => void save(p.key, { features: lines(e.target.value) })} />
            </label>
            <label className="block space-y-1 type-footnote text-muted-foreground">No incluye (una por línea)
              <Textarea rows={2} defaultValue={(p.not_included || []).join("\n")} onBlur={(e) => void save(p.key, { not_included: lines(e.target.value) })} />
            </label>
            <label className="block space-y-1 type-footnote text-muted-foreground">Texto del botón
              <Input defaultValue={p.cta} onBlur={(e) => e.target.value !== p.cta && void save(p.key, { cta: e.target.value })} />
            </label>
            <label className="flex items-center justify-between type-subhead">Acepta altas nuevas
              <Switch checked={p.accepting_new_subscriptions} onCheckedChange={(v) => void save(p.key, { accepting_new_subscriptions: v })} />
            </label>
          </div>
        ))}
      </div>
      <p className="type-footnote text-muted-foreground">Cambiar el precio aquí cambia lo que se muestra; el importe real lo cobra el enlace de Stripe configurado en Pagos, así que actualízalo también allí.</p>
    </section>
  );
}
