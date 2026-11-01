import { jsonObject, jsonString } from "@/shared/lib/runtimeValues";
import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save, ExternalLink, Loader2, Image as ImageIcon, Sparkles } from "lucide-react";
import { CATEGORIES, EVIDENCE_LABEL, LEVEL_LABEL, REVIEW_LABEL, canPublishAcademy, categoryBySlug, readingMinutes } from "@/shared/lib/academy";

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
  category?: string | null;
  level?: string | null;
  order_index?: number | null;
  evidence_level?: string | null;
  references?: unknown;
  review_status?: string | null;
}

const selectCls = "mt-1.5 w-full h-10 rounded-chip border border-input bg-background px-3 type-body sm:text-sm";

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
  const [refsText, setRefsText] = useState("[]");
  const [catFilter, setCatFilter] = useState("all");
  const openEdit = (p: Post) => { setRefsText(JSON.stringify(Array.isArray(p.references) ? p.references : [], null, 2)); setEditing(p); };

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
    setRefsText("[]");
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
    setRefsText("[]");
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
    let refs: unknown = [];
    try { refs = JSON.parse(refsText || "[]"); if (!Array.isArray(refs)) throw new Error(); }
    catch { toast.error("Las referencias deben ser una lista válida"); return; }
    const candidate = { ...editing, references: refs };
    if (editing.published && !canPublishAcademy(candidate)) {
      toast.error("Para publicar en la Academia: márcalo como Verificado y añade al menos una referencia");
      return;
    }
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
      reading_minutes: readingMinutes(editing.body_markdown),
      category: editing.category || null,
      level: editing.level || null,
      order_index: editing.order_index ?? null,
      evidence_level: editing.evidence_level || null,
      references: refs as never,
      review_status: editing.review_status || "draft",
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
            <Label className="type-footnote text-muted-foreground">Publicado</Label>
            <Switch checked={editing.published} onCheckedChange={(v) => setEditing({ ...editing, published: v })} />
            <Button variant="hero" onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-1.5" /> {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-media p-6 space-y-4">
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
              <p className="type-caption2 text-muted-foreground mt-1">URL: /blog/{editing.slug || "..."}</p>
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
                <img loading="lazy" decoding="async" src={editing.cover_url} alt="" className="w-32 h-20 object-cover rounded-chip border border-border" />
              ) : (
                <div className="w-32 h-20 rounded-chip bg-secondary flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label>
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} />
                  <span className="inline-flex items-center gap-1.5 cursor-pointer type-footnote px-3 py-1.5 rounded-chip border border-border hover:bg-secondary">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    {uploading ? "Subiendo..." : "Subir portada"}
                  </span>
                </label>
                {editing.cover_url && (
                  <button type="button" onClick={() => setEditing({ ...editing, cover_url: "" })} className="type-caption2 text-muted-foreground hover:text-destructive text-left">
                    Quitar portada
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="type-footnote font-semibold text-primary uppercase tracking-widest mb-3">Academia</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="type-footnote">Categoría</Label>
                <select className={selectCls} value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value || null })}>
                  <option value="">Sin categoría (blog normal)</option>
                  {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="type-footnote">Nivel</Label>
                <select className={selectCls} value={editing.level || ""} onChange={(e) => setEditing({ ...editing, level: e.target.value || null })}>
                  <option value="">—</option>
                  {Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label className="type-footnote">Nivel de evidencia</Label>
                <select className={selectCls} value={editing.evidence_level || ""} onChange={(e) => setEditing({ ...editing, evidence_level: e.target.value || null })}>
                  <option value="">—</option>
                  {Object.entries(EVIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="type-footnote">Estado de revisión</Label>
                <select className={selectCls} value={editing.review_status || "draft"} onChange={(e) => setEditing({ ...editing, review_status: e.target.value })}>
                  {Object.entries(REVIEW_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label className="type-footnote">Orden en el temario</Label>
                <Input className="mt-1.5" type="number" value={editing.order_index ?? ""} onChange={(e) => setEditing({ ...editing, order_index: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="mt-4">
              <Label className="type-footnote">Referencias (lista JSON: authors, year, title, journal, doi)</Label>
              <Textarea className="mt-1.5 font-mono type-footnote" rows={6} value={refsText} onChange={(e) => setRefsText(e.target.value)} />
              <p className="type-caption2 text-muted-foreground mt-1">Comprueba cada DOI en doi.org antes de marcar como Verificado. Sin verificar y sin referencias no se puede publicar.</p>
            </div>
          </div>

          <div>
            <Label>Contenido (Markdown)</Label>
            <Textarea
              className="mt-1.5 font-mono type-subhead"
              rows={20}
              value={editing.body_markdown}
              onChange={(e) => setEditing({ ...editing, body_markdown: e.target.value })}
              placeholder={"# Encabezado\n\nPárrafo con **negrita** y [enlaces](https://...).\n\n## Subtítulo\n\n- Lista\n- De\n- Items"}
            />
            <p className="type-caption2 text-muted-foreground mt-1">Soporta Markdown completo (#, **, listas, enlaces, código, tablas).</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="type-footnote font-semibold text-primary uppercase tracking-widest mb-3">SEO (opcional)</p>
            <div className="space-y-3">
              <div>
                <Label className="type-footnote">SEO title (sobrescribe el título)</Label>
                <Input
                  className="mt-1"
                  value={editing.seo_title || ""}
                  onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })}
                  placeholder="Máx 60 caracteres"
                  maxLength={60}
                />
              </div>
              <div>
                <Label className="type-footnote">Meta description</Label>
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
          <h2 className="type-headline font-bold font-display">Blog</h2>
          <p className="type-footnote text-muted-foreground">Artículos públicos en /blog. SEO orgánico a largo plazo.</p>
        </div>
        <Button variant="hero" onClick={createNew}>
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo artículo
        </Button>
      </div>

      <div className="bg-card rounded-media p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="type-subhead font-semibold">Escribir con IA</p>
        </div>
        <p className="type-footnote text-muted-foreground">
          La IA crea un borrador. Nunca se publica solo: lo revisas, lo editas y decides tú.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="type-footnote">¿De qué trata?</Label>
            <Input
              className="mt-1"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Cuántos días entrenar a la semana si trabajas 10 horas"
            />
          </div>
          <div>
            <Label className="type-footnote">Para quién (opcional)</Label>
            <Input
              className="mt-1"
              value={aiAudience}
              onChange={(e) => setAiAudience(e.target.value)}
              placeholder="Hombres de 30-45 con poco tiempo"
            />
          </div>
        </div>
        <Button variant="hero" onClick={generateWithAI} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          {generating ? "Escribiendo borrador..." : "Generar borrador"}
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-media">
          <p className="type-subhead text-muted-foreground mb-3">Aún no hay artículos.</p>
          <Button variant="outline" onClick={createNew}>
            <Plus className="w-4 h-4 mr-1.5" /> Crear el primero
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {catFilter === "all" ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[...CATEGORIES.map((c) => ({ slug: c.slug, name: c.name })), { slug: "none", name: "Blog (sin categoría)" }].map((c) => {
                const list = posts.filter((p) => (c.slug === "none" ? !p.category : p.category === c.slug));
                const pub = list.filter((p) => p.published).length;
                return (
                  <button key={c.slug} type="button" onClick={() => setCatFilter(c.slug)}
                    className="text-left rounded-media bg-card p-4 min-h-[110px] flex flex-col justify-between hover:border-primary/60 transition-colors">
                    <span className="font-semibold leading-tight">{c.name}</span>
                    <span className="type-footnote text-muted-foreground mt-3">{list.length} artículos · {pub} publicados</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <button type="button" onClick={() => setCatFilter("all")} className="h-11 type-subhead text-muted-foreground hover:text-foreground">
              ← Todas las carpetas · <span className="text-foreground font-medium">{catFilter === "none" ? "Blog (sin categoría)" : CATEGORIES.find((c) => c.slug === catFilter)?.name}</span>
            </button>
          )}
          {catFilter !== "all" && posts
            .filter((p) => (catFilter === "none" ? !p.category : p.category === catFilter))
            .sort((a, b) => (a.order_index ?? 1e9) - (b.order_index ?? 1e9))
            .map((p) => (
            <div key={p.id} className="bg-card rounded-media p-4 flex items-center gap-3">
              {p.cover_url ? (
                <img loading="lazy" decoding="async" src={p.cover_url} alt="" className="w-16 h-12 rounded-chip object-cover shrink-0" />
              ) : (
                <div className="w-16 h-12 rounded-chip bg-secondary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium type-subhead truncate">{p.title}</p>
                  <span className={`type-caption2 font-bold px-1.5 py-0.5 rounded-full ${p.published ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                    {p.published ? "Publicado" : "Borrador"}
                  </span>
                </div>
                <p className="type-caption2 text-muted-foreground truncate">
                  {p.category ? `${categoryBySlug(p.category)?.name} · ${REVIEW_LABEL[(p.review_status || "draft") as keyof typeof REVIEW_LABEL]} · ` : ""}/blog/{p.slug}
                </p>
              </div>
              {p.published && (
                <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title="Ver">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Editar</Button>
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