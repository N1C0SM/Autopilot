import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticTap } from "@/lib/native";
import { toast } from "sonner";
import { Settings, Save, Link as LinkIcon } from "lucide-react";

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

interface Item { id: string; title: string; kind: string; price: string | null; buy_url_test: string | null; buy_url_live: string | null }

const PaymentModeToggle = () => {
  const [s, setS] = useState<SettingsData | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: lib } = await supabase
        .from("library_books")
        .select("id, title, kind, price, buy_url_test, buy_url_live")
        .in("kind", ["book", "pack"])
        .order("sort_order", { ascending: true });
      setItems((lib as Item[]) || []);
      const { data } = await supabase.from("settings").select("*").limit(1).single();
      if (data) {
        const d = data;
        const next: SettingsData = {
          id: d.id,
          payment_mode: d.payment_mode === "live" ? "live" : "test",
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
    const { error } = await supabase.from("settings").update({ payment_mode: newMode }).eq("id", s.id);
    setSaving(false);
    if (error) return toast.error("Error al cambiar modo");
    setS({ ...s, payment_mode: newMode });
    toast.success(`Modo cambiado a ${newMode === "live" ? "producción" : "pruebas"}`);
  };

  const setItem = (id: string, p: Partial<Item>) =>
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const saveAll = async () => {
    if (!s) return;
    setSaving(true);
    const payload: import("@/integrations/supabase/types").TablesUpdate<"settings"> = {};
    FIELDS.forEach((f) => (payload[f] = s[f]));
    const { error } = await supabase.from("settings").update(payload).eq("id", s.id);
    const results = await Promise.all(
      items.map((b) =>
        supabase.from("library_books").update({
          buy_url_test: b.buy_url_test?.trim() || null,
          buy_url_live: b.buy_url_live?.trim() || null,
        }).eq("id", b.id),
      ),
    );
    setSaving(false);
    if (error || results.some((r) => r.error)) return toast.error("Error al guardar");
    toast.success("Configuración guardada");
  };

  if (loading) return <Spinner />;
  if (!s) return <div className="type-subhead text-muted-foreground">No se encontró configuración</div>;

  const mode = s.payment_mode;

  const label = (m: Mode) => (m === "live" ? "producción" : "pruebas");

  const linkField = (id: string, tag: string, value: string, placeholder: string, onChange: (v: string) => void) => (
    <div className="px-4 py-2">
      <Label htmlFor={id} className="type-footnote text-muted-foreground">{tag}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next"
        className="mt-1 bg-background font-mono"
      />
    </div>
  );

  return (
    <div className="space-y-8">
      <ListGroup>
        <ListRow
          icon={<Settings />}
          title="Modo de pago"
          subtitle={<>Activo: <span className={mode === "live" ? "text-destructive" : "text-primary"}>{label(mode)}</span></>}
          trailing={
            <Button variant={mode === "live" ? "destructive" : "tinted"} size="sm" onClick={() => { void hapticTap(); void toggleMode(); }} disabled={saving}>
              {saving && <Spinner size="sm" className="mr-1" />}
              Cambiar a {mode === "test" ? "producción" : "pruebas"}
            </Button>
          }
        />
      </ListGroup>

      <section className="space-y-4">
        <div className="flex items-start gap-3">
          <LinkIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="type-headline">Payment Links de Stripe</h2>
            <p className="type-subhead text-muted-foreground">
              Pega el enlace de cada plan, en pruebas y en producción. Se usa el del modo activo.
            </p>
          </div>
        </div>
        {PLANS.map((p) => (
          <ListGroup key={p.key} header={`${p.label} · ${p.price}`}>
            {linkField(`${p.key}-test`, "Pruebas", s[`payment_link_${p.key}_test`], "https://buy.stripe.com/test_...", (v) => setField(`payment_link_${p.key}_test`, v))}
            <div className="sep-t">{linkField(`${p.key}-live`, "Producción", s[`payment_link_${p.key}_live`], "https://buy.stripe.com/...", (v) => setField(`payment_link_${p.key}_live`, v))}</div>
          </ListGroup>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="type-headline">Libros y packs</h2>
          <p className="type-subhead text-muted-foreground">Enlaces de Stripe de todo el Drive. Se usa el del modo activo.</p>
        </div>
        {items.length === 0 && <p className="type-subhead text-muted-foreground">Aún no hay libros ni packs.</p>}
        {items.map((b) => (
          <ListGroup key={b.id} header={`${b.title} · ${b.kind === "pack" ? "Pack" : "Libro"}${b.price ? ` · ${b.price}` : ""}`}>
            {linkField(`${b.id}-test`, "Pruebas", b.buy_url_test || "", "https://buy.stripe.com/test_...", (v) => setItem(b.id, { buy_url_test: v }))}
            <div className="sep-t">{linkField(`${b.id}-live`, "Producción", b.buy_url_live || "", "https://buy.stripe.com/...", (v) => setItem(b.id, { buy_url_live: v }))}</div>
          </ListGroup>
        ))}
      </section>

      <p className="px-1 type-footnote text-muted-foreground">
        Los <span className="text-foreground">webhook secrets</span> de Stripe se gestionan de forma segura
        como secretos del servidor (no en la base de datos). Si necesitas rotarlos, hazlo desde la configuración de
        secretos del backend.
      </p>

      <Button onClick={() => { void hapticTap(); void saveAll(); }} disabled={saving} className="w-full" size="lg">
        {saving ? <Spinner size="sm" className="mr-2 text-primary-foreground" /> : <Save className="w-4 h-4 mr-2" />}
        Guardar configuración
      </Button>
    </div>
  );
};

export default PaymentModeToggle;