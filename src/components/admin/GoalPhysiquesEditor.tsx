import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Upload, Target, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface GoalPhysique {
  id: string;
  name: string;
  description: string;
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
      .insert({ name: "Nuevo físico", description: "", image_url: "", sort_order: items.length, visible: true })
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
        description: it.description,
        image_url: it.image_url,
        sort_order: it.sort_order,
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
            <Target className="w-5 h-5 text-primary" />
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
          Aún no hay físicos. Añade el primero (ej: "David Laid Prime", "Jason Statham Prime").
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((it) => (
            <div key={it.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex gap-3">
                <div className="relative w-28 h-36 rounded-xl overflow-hidden bg-secondary shrink-0 border border-border">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground text-center px-2">
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
                <div className="flex-1 space-y-2 min-w-0">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nombre</Label>
                    <Input
                      value={it.name}
                      onChange={(e) => update(it.id, { name: e.target.value })}
                      placeholder="David Laid prime"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Descripción corta</Label>
                    <Textarea
                      value={it.description}
                      onChange={(e) => update(it.id, { description: e.target.value })}
                      rows={2}
                      placeholder="Definido, hombros anchos, cintura estrecha"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <GripVertical className="w-3 h-3 text-muted-foreground" />
                    <Input
                      type="number"
                      value={it.sort_order}
                      onChange={(e) => update(it.id, { sort_order: parseInt(e.target.value || "0", 10) })}
                      className="w-16 h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={it.visible}
                      onCheckedChange={(v) => update(it.id, { visible: v })}
                    />
                    <span className="text-muted-foreground">{it.visible ? "Visible" : "Oculto"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => save(it)}>
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(it.id)} className="text-destructive hover:text-destructive">
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