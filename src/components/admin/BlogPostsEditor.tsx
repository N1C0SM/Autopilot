import { jsonObject, jsonString } from "@/lib/runtimeValues";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { ListGroup, ListRow } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { hapticTap } from "@/lib/native";
import { Plus, Trash2, Save, ExternalLink, Image as ImageIcon, Sparkles, FileText } from "lucide-react";

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
  const [aiTopic, setAiTopic] = useState("");
  const [aiAudience, setAiAudience] = useState("");
  const [generating, setGenerating] = useState(false);

  const generateWithAI = async () => {
    if (!aiTopic.trim()) { toast.error("Escribe de qué quieres que hable el artículo"); return; }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-blog-post", {
      body: { topic: aiTopic.trim(), audience: aiAudience.trim() },
    });
    setGenerating(false);
    if (error || !data || data.error) {
      toast.error(data?.error || "No se pudo generar el artículo");
      return;
    }
    const d = jsonObject(data);
    setEditing({
      id: "",
      slug: slugify(jsonString(d.title) || aiTopic),
      title: jsonString(d.title) || aiTopic,
      excerpt: jsonString(d.excerpt) || "",
      body_markdown: jsonString(d.body_markdown) || "",
      cover_url: "",
      seo_title: jsonString(d.seo_title) || "",
      seo_description: jsonString(d.seo_description) || "",
      author_name: "Autopilot",
      published: false,
      published_at: null,
      reading_minutes: null,
    });
    setAiTopic("");
    setAiAudience("");
    toast.success("Borrador creado. Revísalo antes de publicar.");
  };

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
    const payload = {
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
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="plain" className="-ml-3" onClick={() => setEditing(null)}>← Volver a la lista</Button>
          <div className="flex items-center gap-3">
            <Label className="type-footnote text-muted-foreground">Publicado</Label>
            <Switch checked={editing.published} onCheckedChange={(v) => { void hapticTap(); setEditing({ ...editing, published: v }); }} />
            <Button variant="hero" onClick={save} disabled={saving}>
              {saving ? <Spinner size="sm" className="mr-1.5 text-primary-foreground" /> : <Save className="w-4 h-4 mr-1.5" />}
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <Label>Título</Label>
            <Input
              className="mt-1.5"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing.slug || slugify(e.target.value) })}
              placeholder="Cómo ganar músculo con 30 años sin tiempo"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <Label>Slug (URL)</Label>
              <Input
                className="mt-1.5"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                placeholder="ganar-musculo-30-anos"
              />
              <p className="type-footnote text-muted-foreground mt-1.5 px-1">URL: /blog/{editing.slug || "..."}</p>
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
            <div className="mt-1.5 flex items-center gap-4">
              {editing.cover_url ? (
                <img loading="lazy" decoding="async" src={editing.cover_url} alt="" className="w-32 h-20 object-cover rounded-[10px]" />
              ) : (
                <div className="w-32 h-20 rounded-[10px] bg-secondary flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col items-start gap-1">
                <label className="inline-flex">
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} />
                  <span className="pressable inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 type-body text-primary active:opacity-60">
                    {uploading ? <Spinner size="sm" /> : <ImageIcon className="w-4 h-4" />}
                    {uploading ? "Subiendo..." : "Subir portada"}
                  </span>
                </label>
                {editing.cover_url && (
                  <Button type="button" variant="plain" className="text-destructive" onClick={() => setEditing({ ...editing, cover_url: "" })}>
                    Quitar portada
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label>Contenido (Markdown)</Label>
            <Textarea
              className="mt-1.5 font-mono md:text-sm"
              rows={20}
              value={editing.body_markdown}
              onChange={(e) => setEditing({ ...editing, body_markdown: e.target.value })}
              placeholder={"# Encabezado\n\nPárrafo con **negrita** y [enlaces](https://...).\n\n## Subtítulo\n\n- Lista\n- De\n- Items"}
            />
            <p className="type-footnote text-muted-foreground mt-1.5 px-1">Soporta Markdown completo (#, **, listas, enlaces, código, tablas).</p>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="type-group-header px-1">SEO (opcional)</h3>
          <div>
            <Label>SEO title (sobrescribe el título)</Label>
            <Input
              className="mt-1.5"
              value={editing.seo_title || ""}
              onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })}
              placeholder="Máx 60 caracteres"
              maxLength={60}
            />
          </div>
          <div>
            <Label>Meta description</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              value={editing.seo_description || ""}
              onChange={(e) => setEditing({ ...editing, seo_description: e.target.value })}
              placeholder="Máx 160 caracteres"
              maxLength={160}
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="type-title1">Blog</h2>
          <p className="type-subhead text-muted-foreground">Artículos públicos en /blog. SEO orgánico a largo plazo.</p>
        </div>
        <Button variant="hero" onClick={createNew}>
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo artículo
        </Button>
      </div>

      <div className="flex items-start gap-4">
        <Sparkles className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="type-headline">Escribir con IA</p>
            <p className="type-subhead text-muted-foreground">
              La IA crea un borrador. Nunca se publica solo: lo revisas, lo editas y decides tú.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>¿De qué trata?</Label>
              <Input
                className="mt-1.5"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Cuántos días entrenar a la semana si trabajas 10 horas"
              />
            </div>
            <div>
              <Label>Para quién (opcional)</Label>
              <Input
                className="mt-1.5"
                value={aiAudience}
                onChange={(e) => setAiAudience(e.target.value)}
                placeholder="Hombres de 30-45 con poco tiempo"
              />
            </div>
          </div>
          <Button variant="tinted" onClick={generateWithAI} disabled={generating}>
            {generating ? <Spinner size="sm" className="mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {generating ? "Escribiendo borrador..." : "Generar borrador"}
          </Button>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aún no hay artículos."
          description="Escribe el primero o pide un borrador a la IA."
          action={
            <Button variant="plain" onClick={createNew}>
              <Plus className="w-4 h-4 mr-1.5" /> Crear el primero
            </Button>
          }
        />
      ) : (
        <ListGroup header="Artículos">
          {posts.map((p) => (
            <ListRow
              key={p.id}
              leading={
                p.cover_url ? (
                  <img loading="lazy" decoding="async" src={p.cover_url} alt="" className="w-16 h-12 rounded-[10px] object-cover" />
                ) : (
                  <div className="w-16 h-12 rounded-[10px] bg-secondary" />
                )
              }
              title={
                <span className="flex items-center gap-2">
                  <span className="truncate">{p.title}</span>
                  <span className={`type-caption1 shrink-0 ${p.published ? "text-primary" : "text-muted-foreground"}`}>
                    {p.published ? "Publicado" : "Borrador"}
                  </span>
                </span>
              }
              subtitle={`/blog/${p.slug}`}
              onClick={() => setEditing(p)}
              aria-label={`Editar ${p.title}`}
              trailing={
                <span className="flex items-center">
                  {p.published && (
                    <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="pressable flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground active:opacity-60" title="Ver" aria-label="Ver artículo">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)} aria-label="Eliminar">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </span>
              }
            />
          ))}
        </ListGroup>
      )}
    </div>
  );
};

export default BlogPostsEditor;
