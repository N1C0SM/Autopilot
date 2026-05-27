import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Upload, User, Star } from "lucide-react";
import { toast } from "sonner";

interface Testimonial {
  id: string;
  name: string;
  result: string;
  text: string;
  photo_url: string | null;
  sort_order: number;
  visible: boolean;
}

const uploadImage = async (file: File, folder: string) => {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
};

const SiteContentEditor = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trainer, setTrainer] = useState({ trainer_name: "", trainer_photo_url: "", trainer_bio: "" });
  const [settingsId, setSettingsId] = useState<string>("");
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: t }] = await Promise.all([
      supabase.from("settings").select("id, trainer_name, trainer_photo_url, trainer_bio").limit(1).maybeSingle(),
      supabase.from("site_testimonials").select("*").order("sort_order"),
    ]);
    if (s) {
      setSettingsId(s.id);
      setTrainer({
        trainer_name: s.trainer_name || "Nicolás",
        trainer_photo_url: s.trainer_photo_url || "",
        trainer_bio: s.trainer_bio || "",
      });
    }
    if (t) setTestimonials(t as Testimonial[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveTrainer = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update(trainer).eq("id", settingsId);
    if (error) toast.error("Error al guardar"); else toast.success("Entrenador actualizado");
    setSaving(false);
  };

  const onTrainerPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "trainer");
      setTrainer((t) => ({ ...t, trainer_photo_url: url }));
      toast.success("Foto subida");
    } catch (err: any) { toast.error(err.message); }
  };

  const addTestimonial = async () => {
    const { data, error } = await supabase.from("site_testimonials")
      .insert({ name: "Nuevo testimonio", result: "", text: "", sort_order: testimonials.length })
      .select().single();
    if (error) { toast.error("Error"); return; }
    setTestimonials((t) => [...t, data as Testimonial]);
  };

  const updateTestimonial = (id: string, patch: Partial<Testimonial>) => {
    setTestimonials((arr) => arr.map((t) => t.id === id ? { ...t, ...patch } : t));
  };

  const saveTestimonial = async (t: Testimonial) => {
    const { error } = await supabase.from("site_testimonials").update({
      name: t.name, result: t.result, text: t.text, photo_url: t.photo_url, sort_order: t.sort_order, visible: t.visible,
    }).eq("id", t.id);
    if (error) toast.error("Error al guardar"); else toast.success("Guardado");
  };

  const deleteTestimonial = async (id: string) => {
    if (!confirm("¿Eliminar testimonio?")) return;
    await supabase.from("site_testimonials").delete().eq("id", id);
    setTestimonials((t) => t.filter((x) => x.id !== id));
  };

  const onTestPhoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "testimonials");
      updateTestimonial(id, { photo_url: url });
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      {/* Entrenador */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold">Sobre el fundador</h2>
        </div>
        <div className="flex items-center gap-4">
          {trainer.trainer_photo_url ? (
            <img src={trainer.trainer_photo_url} alt="" className="w-20 h-20 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><User className="w-8 h-8" /></div>
          )}
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={onTrainerPhoto} />
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary"><Upload className="w-3.5 h-3.5" /> Subir foto</span>
          </label>
        </div>
        <div>
          <Label className="text-xs">Nombre</Label>
          <Input value={trainer.trainer_name} onChange={(e) => setTrainer((t) => ({ ...t, trainer_name: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Bio</Label>
          <Textarea rows={4} value={trainer.trainer_bio} onChange={(e) => setTrainer((t) => ({ ...t, trainer_bio: e.target.value }))} placeholder="Llevo años ayudando a personas a..." />
        </div>
        <Button onClick={saveTrainer} disabled={saving}>{saving ? "Guardando..." : "Guardar entrenador"}</Button>
      </div>

      {/* Testimonios */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold">Testimonios</h2>
          </div>
          <Button size="sm" onClick={addTestimonial}><Plus className="w-4 h-4 mr-1" /> Añadir</Button>
        </div>
        {testimonials.length === 0 && <p className="text-sm text-muted-foreground">Aún no has añadido testimonios.</p>}
        <div className="space-y-4">
          {testimonials.map((t) => (
            <div key={t.id} className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                {t.photo_url ? (
                  <img src={t.photo_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">Foto</div>
                )}
                <label className="cursor-pointer text-xs px-2 py-1 rounded border border-border hover:bg-secondary inline-flex items-center gap-1">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onTestPhoto(t.id, e)} />
                  <Upload className="w-3 h-3" /> Foto
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Visible</span>
                  <Switch checked={t.visible} onCheckedChange={(v) => updateTestimonial(t.id, { visible: v })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nombre" value={t.name} onChange={(e) => updateTestimonial(t.id, { name: e.target.value })} />
                <Input placeholder="Resultado (-8kg en 3 meses)" value={t.result} onChange={(e) => updateTestimonial(t.id, { result: e.target.value })} />
              </div>
              <Textarea rows={3} placeholder="Texto del testimonio" value={t.text} onChange={(e) => updateTestimonial(t.id, { text: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveTestimonial(t)}>Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteTestimonial(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SiteContentEditor;