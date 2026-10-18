import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticSelection } from "@/lib/native";
import { toast } from "sonner";
import { Field, FieldRow } from "./AdminOpsParts";

import { refreshFreeCampaign, useFreeCampaign } from "@/lib/freeCampaign";
import { useApkDownloadEnabled } from "@/lib/apkDownload";

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
  const campaign = useFreeCampaign();
  const [savingCampaign, setSavingCampaign] = useState(false);
  const setCampaign = async (active: boolean) => {
    setSavingCampaign(true);
    const { data: settings, error: readError } = await supabase.from("settings").select("id").limit(1).single();
    if (readError || !settings) { setSavingCampaign(false); toast.error("No se pudo cargar la configuración"); return; }
    const { error } = await supabase.from("settings").update({ free_campaign: active }).eq("id", settings.id);
    if (error) toast.error("No se pudo cambiar la campaña");
    else { await refreshFreeCampaign(); toast.success(active ? "Campaña Free activada" : "Configuración normal restaurada"); }
    setSavingCampaign(false);
  };
  const [apkEnabled, setApkEnabled] = useApkDownloadEnabled();
  const setApk = async (on: boolean) => {
    const { data: settings } = await supabase.from("settings").select("id").limit(1).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = settings ? await (supabase.from("settings") as any).update({ apk_download_enabled: on }).eq("id", settings.id) : { error: true };
    if (error) return toast.error("No se pudo cambiar");
    setApkEnabled(on);
    toast.success(on ? "Página de descarga activada" : "Página de descarga oculta");
  };

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
      <ListGroup><ListRow title="Campaña Free / Ocultar Plus" subtitle="Oculta ofertas y cobros de planes. Abre sobrecarga progresiva y nutrición básica, sin chat ni calendario. No cambia suscripciones existentes." trailing={<Switch aria-label="Campaña Free / Ocultar Plus" checked={campaign} disabled={savingCampaign} onCheckedChange={(v) => { void hapticSelection(); void setCampaign(v); }} />} />
        <ListRow title="Página de descarga del APK (/app)" subtitle="Si la apagas, /app y /descargar llevan a la portada. Úsalo cuando estés en Google Play y App Store." trailing={<Switch aria-label="Página de descarga del APK" checked={apkEnabled !== false} disabled={apkEnabled === null} onCheckedChange={(v) => { void hapticSelection(); void setApk(v); }} />} /></ListGroup>
      <p className="type-subhead text-muted-foreground">Lo que cambies aquí se ve al momento en la portada y en /planes. Los enlaces de cobro siguen en Pagos.</p>
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {plans.map((p) => {
          const visible = p.enabled && p.publicly_visible;
          const id = (field: string) => `plan-${p.key}-${field}`;
          return (
            <ListGroup key={p.key} header={p.name}>
              <ListRow
                title={visible ? "Visible en la web" : "Oculto"}
                trailing={
                  <Switch
                    aria-label={`Mostrar ${p.name}`}
                    checked={visible}
                    onCheckedChange={(v) => { void hapticSelection(); void save(p.key, { enabled: v, publicly_visible: v }); }}
                  />
                }
              />
              <FieldRow label="Nombre" htmlFor={id("name")}>
                <Input id={id("name")} enterKeyHint="next" defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && void save(p.key, { name: e.target.value })} />
              </FieldRow>
              <FieldRow label="Frase corta" htmlFor={id("tagline")}>
                <Input id={id("tagline")} enterKeyHint="next" defaultValue={p.tagline} onBlur={(e) => e.target.value !== p.tagline && void save(p.key, { tagline: e.target.value })} />
              </FieldRow>
              <FieldRow columns>
                <Field label="Precio €/mes" htmlFor={id("price")}>
                  <Input id={id("price")} type="number" inputMode="decimal" enterKeyHint="next" min={0} defaultValue={p.price} onBlur={(e) => Number(e.target.value) !== Number(p.price) && void save(p.key, { price: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="Días de prueba" htmlFor={id("trial")}>
                  <Input id={id("trial")} type="number" inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" min={0} defaultValue={p.trial_days} onBlur={(e) => Number(e.target.value) !== p.trial_days && void save(p.key, { trial_days: Number(e.target.value) || 0 })} />
                </Field>
              </FieldRow>
              <FieldRow label="Incluye (una por línea)" htmlFor={id("features")}>
                <Textarea id={id("features")} rows={5} defaultValue={(p.features || []).join("\n")} onBlur={(e) => void save(p.key, { features: lines(e.target.value) })} />
              </FieldRow>
              <FieldRow label="No incluye (una por línea)" htmlFor={id("not-included")}>
                <Textarea id={id("not-included")} rows={2} defaultValue={(p.not_included || []).join("\n")} onBlur={(e) => void save(p.key, { not_included: lines(e.target.value) })} />
              </FieldRow>
              <FieldRow label="Texto del botón" htmlFor={id("cta")}>
                <Input id={id("cta")} enterKeyHint="done" defaultValue={p.cta} onBlur={(e) => e.target.value !== p.cta && void save(p.key, { cta: e.target.value })} />
              </FieldRow>
              <ListRow
                title="Acepta altas nuevas"
                trailing={
                  <Switch
                    aria-label="Acepta altas nuevas"
                    checked={p.accepting_new_subscriptions}
                    onCheckedChange={(v) => { void hapticSelection(); void save(p.key, { accepting_new_subscriptions: v }); }}
                  />
                }
              />
            </ListGroup>
          );
        })}
      </div>
      <p className="px-4 type-footnote text-muted-foreground">Cambiar el precio aquí cambia lo que se muestra; el importe real lo cobra el enlace de Stripe configurado en Pagos, así que actualízalo también allí.</p>
    </section>
  );
}
