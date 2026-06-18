import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save, ExternalLink, Loader2, Image as ImageIcon } from "lucide-react";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_markdown: string;
  cover_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  author_name: string | null;
  published: boolean;
  published_at: string | null;
  reading_minutes: number | null;
}

const slugify = (s: string) =>
  s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

const BlogPostsEditor = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    setPosts((data || []) as Post[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const createNew = () => {
    setEditing({
      id: "",
      slug: "",
      title: "",
      excerpt: "",
      body_markdown: "",
      cover_url: "",
      seo_title: "",
      seo_description: "",
      author_name: "Autopilot",
      published: false,
      published_at: null,
      reading_minutes: null,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast.error("Falta el título"); return; }
    const slug = editing.slug.trim() || slugify(editing.title);
    setSaving(true);
    const payload: any = {
      slug,
      title: editing.title.trim(),
      excerpt: editing.excerpt || null,
      body_markdown: editing.body_markdown,
      cover_url: editing.cover_url || null,
      seo_title: editing.seo_title || null,
      seo_description: editing.seo_description || null,
      author_name: editing.author_name || "Autopilot",
      published: editing.published,
      published_at: editing.published ? (editing.published_at || new Date().toISOString()) : null,
      reading_minutes: editing.reading_minutes || Math.max(1, Math.round((editing.body_markdown || "").split(/\s+/).length / 220)),
    };
    const { error } = editing.id
      ? await supabase.from("blog_posts").update(payload).eq("id", editing.id)
      : await supabase.from("blog_posts").insert(payload);
    setSaving(false);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Artículo guardado");
    setEditing(null);
    await reload();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este artículo? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Artículo eliminado");
    await reload();
  };

  const uploadCover = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `blog/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
    if (error) { toast.error("Error subiendo: " + error.message); setUploading(false); return; }
    const url = supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
    setEditing({ ...editing, cover_url: url });
    setUploading(false);
    toast.success("Portada subida");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  }

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setEditing(null)}>← Volver a la lista</Button>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Publicado</Label>
            <Switch checked={editing.published} onCheckedChange={(v) => setEditing({ ...editing, published: v })} />
            <Button variant="hero" onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-1.5" /> {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <Label>Título</Label>
            <Input
              className="mt-1.5"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing.slug || slugify(e.target.value) })}
              placeholder="Cómo ganar músculo con 30 años sin tiempo"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Slug (URL)</Label>
              <Input
                className="mt-1.5"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                placeholder="ganar-musculo-30-anos"
              />
              <p className="text-[10px] text-muted-foreground mt-1">URL: /blog/{editing.slug || "..."}</p>
            </div>
            <div>
              <Label>Autor</Label>
              <Input
                className="mt-1.5"
                value={editing.author_name || ""}
                onChange={(e) => setEditing({ ...editing, author_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Extracto (aparece en la lista del blog)</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              value={editing.excerpt || ""}
              onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
              placeholder="Un resumen corto que enganche al lector..."
            />
          </div>

          <div>
            <Label>Portada</Label>
            <div className="mt-1.5 flex items-start gap-4">
              {editing.cover_url ? (
                <img src={editing.cover_url} alt="" className="w-32 h-20 object-cover rounded-lg border border-border" />
              ) : (
                <div className="w-32 h-20 rounded-lg bg-secondary flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label>
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} />
                  <span className="inline-flex items-center gap-1.5 cursor-pointer text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    {uploading ? "Subiendo..." : "Subir portada"}
                  </span>
                </label>
                {editing.cover_url && (
                  <button type="button" onClick={() => setEditing({ ...editing, cover_url: "" })} className="text-[11px] text-muted-foreground hover:text-destructive text-left">
                    Quitar portada
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label>Contenido (Markdown)</Label>
            <Textarea
              className="mt-1.5 font-mono text-sm"
              rows={20}
              value={editing.body_markdown}
              onChange={(e) => setEditing({ ...editing, body_markdown: e.target.value })}
              placeholder={"# Encabezado\n\nPárrafo con **negrita** y [enlaces](https://...).\n\n## Subtítulo\n\n- Lista\n- De\n- Items"}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Soporta Markdown completo (#, **, listas, enlaces, código, tablas).</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">SEO (opcional)</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">SEO title (sobrescribe el título)</Label>
                <Input
                  className="mt-1"
                  value={editing.seo_title || ""}
                  onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })}
                  placeholder="Máx 60 caracteres"
                  maxLength={60}
                />
              </div>
              <div>
                <Label className="text-xs">Meta description</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={editing.seo_description || ""}
                  onChange={(e) => setEditing({ ...editing, seo_description: e.target.value })}
                  placeholder="Máx 160 caracteres"
                  maxLength={160}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-display">Blog</h2>
          <p className="text-xs text-muted-foreground">Artículos públicos en /blog. SEO orgánico a largo plazo.</p>
        </div>
        <Button variant="hero" onClick={createNew}>
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo artículo
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground mb-3">Aún no hay artículos.</p>
          <Button variant="outline" onClick={createNew}>
            <Plus className="w-4 h-4 mr-1.5" /> Crear el primero
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              {p.cover_url ? (
                <img src={p.cover_url} alt="" className="w-16 h-12 rounded-md object-cover shrink-0" />
              ) : (
                <div className="w-16 h-12 rounded-md bg-secondary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{p.title}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.published ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                    {p.published ? "Publicado" : "Borrador"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">/blog/{p.slug}</p>
              </div>
              {p.published && (
                <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title="Ver">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>Editar</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)} aria-label="Eliminar">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlogPostsEditor;