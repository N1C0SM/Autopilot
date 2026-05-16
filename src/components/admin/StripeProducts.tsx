import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Zap } from "lucide-react";

type FormState = {
  price_id_training_test: string;
  price_id_training_live: string;
  price_id_full_test: string;
  price_id_full_live: string;
  price_id_transform_test: string;
  price_id_transform_live: string;
  contact_email: string;
  payment_mode: string;
};

const EMPTY: FormState = {
  price_id_training_test: "",
  price_id_training_live: "",
  price_id_full_test: "",
  price_id_full_live: "",
  price_id_transform_test: "",
  price_id_transform_live: "",
  contact_email: "",
  payment_mode: "test",
};

const StripeProducts = () => {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      if (data) {
        setId(data.id);
        setForm({
          price_id_training_test: (data as any).price_id_training_test || "",
          price_id_training_live: (data as any).price_id_training_live || "",
          price_id_full_test: (data as any).price_id_full_test || "",
          price_id_full_live: (data as any).price_id_full_live || "",
          price_id_transform_test: (data as any).price_id_transform_test || "",
          price_id_transform_live: (data as any).price_id_transform_live || "",
          contact_email: (data as any).contact_email || "",
          payment_mode: (data as any).payment_mode || "test",
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update(form as any)
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Error guardando: " + error.message);
    } else {
      toast.success("Productos y precios actualizados");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const Card = ({
    title,
    price,
    desc,
    testKey,
    liveKey,
  }: {
    title: string;
    price: string;
    desc: string;
    testKey: keyof FormState;
    liveKey: keyof FormState;
  }) => (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display font-bold text-base">{title}</h3>
        <span className="text-primary font-bold font-display">{price}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{desc}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Price ID (Test)</Label>
          <Input
            value={form[testKey]}
            onChange={set(testKey)}
            placeholder="price_..."
            className="mt-1 font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Price ID (Live)</Label>
          <Input
            value={form[liveKey]}
            onChange={set(liveKey)}
            placeholder="price_..."
            className="mt-1 font-mono text-xs"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 items-start">
        <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          Configura aquí los <span className="text-foreground font-semibold">Price IDs de Stripe</span> para cada producto.
          Modo activo actual: <span className="text-primary font-semibold">{form.payment_mode.toUpperCase()}</span>.
          El sistema usa automáticamente Test o Live según el toggle de "Configuración".
        </div>
      </div>

      <Card
        title="Entrenamiento"
        price="29€/mes"
        desc="Suscripción mensual con 7 días de prueba"
        testKey="price_id_training_test"
        liveKey="price_id_training_live"
      />
      <Card
        title="Completo"
        price="49€/mes"
        desc="Suscripción mensual con 7 días de prueba — Plan recomendado"
        testKey="price_id_full_test"
        liveKey="price_id_full_live"
      />
      <Card
        title="Transformación 12 semanas"
        price="299€"
        desc="Pago único · Sin prueba gratis · Lead a asesor"
        testKey="price_id_transform_test"
        liveKey="price_id_transform_live"
      />

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-display font-bold text-base mb-1">Email de contacto del asesor</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Se usa en el botón "Hablar con un asesor" de la Transformación 12 semanas.
        </p>
        <Input
          type="email"
          value={form.contact_email}
          onChange={set("contact_email")}
          placeholder="hola@autopilotplan.com"
        />
      </div>

      <div className="sticky bottom-4 z-10">
        <Button onClick={handleSave} disabled={saving} variant="hero" size="lg" className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
};

export default StripeProducts;
