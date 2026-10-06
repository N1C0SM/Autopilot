import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Upload, Target } from "lucide-react";
import { toast } from "sonner";

interface GoalPhysique {
  id: string;
  name: string;
  image_url: string;
  sort_order: number;
  visible: boolean;
}

const uploadImage = async (file: File) => {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `goal-physiques/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
};

const GoalPhysiquesEditor = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GoalPhysique[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("goal_physiques")
      .select("*")
      .order("sort_order", { ascending: true });
    setItems((data as GoalPhysique[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const { data, error } = await supabase
      .from("goal_physiques")
      .insert({ name: "Nuevo físico", image_url: "", sort_order: items.length, visible: true })
      .select()
      .single();
    if (error) { toast.error("No se pudo crear"); return; }
    setItems((p) => [...p, data as GoalPhysique]);
  };

  const update = (id: string, patch: Partial<GoalPhysique>) => {
    setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const save = async (it: GoalPhysique) => {
    const { error } = await supabase
      .from("goal_physiques")
      .update({
        name: it.name,
        image_url: it.image_url,
        visible: it.visible,
      })
      .eq("id", it.id);
    if (error) toast.error("Error al guardar"); else toast.success("Guardado");
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este físico de referencia?")) return;
    const { error } = await supabase.from("goal_physiques").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    setItems((p) => p.filter((it) => it.id !== id));
  };

  const onPhoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      update(id, { image_url: url });
      // auto-save URL
      await supabase.from("goal_physiques").update({ image_url: url }).eq("id", id);
      toast.success("Foto subida");
    } catch (err: any) {
      toast.error(err.message ?? "Error al subir");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                        Físicos objetivo
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Físicos de referencia que verán los usuarios en el AI Scan. Pueden elegir uno como objetivo en vez de subir su propia foto.
          </p>
        </div>
        <Button onClick={add} variant="hero" size="sm">
          <Plus className="w-4 h-4" />
          Añadir físico
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl text-sm text-muted-foreground">
          Aún no hay físicos de referencia. Añade el primero con una foto y un nombre.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl bg-card border border-border/60 p-4 space-y-3">
              <div className="flex gap-3">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground text-center px-2">
                      Sin foto
                    </div>
                  )}
                  <label className="absolute inset-0 cursor-pointer flex items-end justify-center pb-2 opacity-0 hover:opacity-100 transition bg-background/60">
                    <span className="text-xs flex items-center gap-1 text-primary">
                      <Upload className="w-3 h-3" /> Subir
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(it.id, e)} />
                  </label>
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nombre</Label>
                  <Input
                    value={it.name}
                    onChange={(e) => update(it.id, { name: e.target.value })}
                    placeholder="Físico de referencia"
                  />
                </div>
              </div>
              {/* La fila envuelve: si no cabe, los botones bajan en vez de salirse de la tarjeta. */}
              {/* Una sola línea: el interruptor y los botones nunca se apilan.
                  Si el ancho aprieta, se recorta la etiqueta, no se baja nada. */}
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <Switch
                    className="shrink-0"
                    checked={it.visible}
                    onCheckedChange={(v) => update(it.id, { visible: v })}
                  />
                  <span className="truncate text-muted-foreground">{it.visible ? "Visible" : "Oculto"}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="outline" className="px-2.5" onClick={() => save(it)}>
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive hover:text-destructive" onClick={() => remove(it.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoalPhysiquesEditor;