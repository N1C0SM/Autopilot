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
import { hapticSelection, hapticTap } from "@/lib/native";
import { Sparkles, FileText, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageWithFallback, InlineBack, MONO_FIELD } from "@/components/admin/content/AdminContentParts";
import { useConfirm } from "@/components/admin/content/useConfirm";

const FIELD_LABEL = "mb-1.5 block text-muted-foreground";

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
  const { ask, dialog: confirmDialog } = useConfirm();

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
    if (!(await ask({ title: "¿Eliminar este artículo?", description: "Esta acción no se puede deshacer." }))) return;
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
        <InlineBack label="Blog" onClick={() => setEditing(null)} />

        <ListGroup>
          <ListRow
            title="Publicado"
            subtitle={editing.published ? "Visible en /blog para todo el mundo." : "Borrador: solo lo ves tú."}
            trailing={
              <Switch
                aria-label="Publicado"
                checked={editing.published}
                onCheckedChange={(v) => { void hapticSelection(); setEditing({ ...editing, published: v }); }}
              />
            }
          />
        </ListGroup>

        <div className="space-y-5">
          <div>
            <Label htmlFor="post-title" className={FIELD_LABEL}>Título</Label>
            <Input
              id="post-title"
              autoCapitalize="sentences"
              enterKeyHint="next"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing.slug || slugify(e.target.value) })}
              placeholder="Cómo ganar músculo con 30 años sin tiempo"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="post-slug" className={FIELD_LABEL}>Slug (URL)</Label>
              <Input
                id="post-slug"
                className={MONO_FIELD}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                placeholder="ganar-musculo-30-anos"
              />
              <p className="mt-1.5 px-1 type-footnote text-muted-foreground">
                URL: <span className="font-mono">/blog/{editing.slug || "…"}</span>
              </p>
            </div>
            <div>
              <Label htmlFor="post-author" className={FIELD_LABEL}>Autor</Label>
              <Input
                id="post-author"
                autoCapitalize="words"
                enterKeyHint="next"
                value={editing.author_name || ""}
                onChange={(e) => setEditing({ ...editing, author_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="post-excerpt" className={FIELD_LABEL}>Extracto (aparece en la lista del blog)</Label>
            <Textarea
              id="post-excerpt"
              rows={2}
              value={editing.excerpt || ""}
              onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
              placeholder="Un resumen corto que enganche al lector…"
            />
          </div>

          <div>
            <p className={FIELD_LABEL + " type-subhead font-medium"}>Portada</p>
            <div className="flex items-center gap-4">
              <ImageWithFallback
                src={editing.cover_url}
                className="h-20 w-32 shrink-0 rounded-[10px] object-cover"
                iconClassName="h-6 w-6"
              />
              <div className="flex flex-col items-start">
                <label className="inline-flex">
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} />
                  <span className="pressable inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 type-body text-primary active:opacity-60">
                    {uploading ? <Spinner size="sm" /> : null}
                    {uploading ? "Subiendo…" : editing.cover_url ? "Cambiar portada" : "Subir portada"}
                  </span>
                </label>
                {editing.cover_url && (
                  <Button type="button" variant="plain" className="-ml-4 text-destructive" onClick={() => setEditing({ ...editing, cover_url: "" })}>
                    Quitar portada
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="post-body" className={FIELD_LABEL}>Contenido (Markdown)</Label>
            <Textarea
              id="post-body"
              className={MONO_FIELD}
              rows={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={editing.body_markdown}
              onChange={(e) => setEditing({ ...editing, body_markdown: e.target.value })}
              placeholder={"# Encabezado\n\nPárrafo con **negrita** y [enlaces](https://...).\n\n## Subtítulo\n\n- Lista\n- De\n- Items"}
            />
            <p className="mt-1.5 px-1 type-footnote text-muted-foreground">Soporta Markdown completo (#, **, listas, enlaces, código, tablas).</p>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="type-group-header px-4">SEO (opcional)</h3>
          <div>
            <Label htmlFor="post-seo-title" className={FIELD_LABEL}>SEO title (sobrescribe el título)</Label>
            <Input
              id="post-seo-title"
              enterKeyHint="next"
              value={editing.seo_title || ""}
              onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })}
              placeholder="Máx 60 caracteres"
              maxLength={60}
            />
          </div>
          <div>
            <Label htmlFor="post-seo-description" className={FIELD_LABEL}>Meta description</Label>
            <Textarea
              id="post-seo-description"
              rows={2}
              value={editing.seo_description || ""}
              onChange={(e) => setEditing({ ...editing, seo_description: e.target.value })}
              placeholder="Máx 160 caracteres"
              maxLength={160}
            />
          </div>
        </section>

        <Button size="lg" className="w-full md:w-auto" onClick={save} disabled={saving}>
          {saving ? <Spinner size="sm" className="text-primary-foreground" /> : null}
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-4">
        <p className="type-subhead text-muted-foreground">Artículos públicos en /blog. SEO orgánico a largo plazo.</p>
        <Button size="lg" className="w-full md:w-auto" onClick={createNew}>Nuevo artículo</Button>
      </div>

      <section className="space-y-4">
        <div className="flex items-start gap-4">
          <Sparkles className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="type-headline">Escribir con IA</p>
            <p className="type-subhead text-muted-foreground">
              La IA crea un borrador. Nunca se publica solo: lo revisas, lo editas y decides tú.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ai-topic" className={FIELD_LABEL}>¿De qué trata?</Label>
            <Input
              id="ai-topic"
              autoCapitalize="sentences"
              enterKeyHint="next"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Cuántos días entrenar a la semana si trabajas 10 horas"
            />
          </div>
          <div>
            <Label htmlFor="ai-audience" className={FIELD_LABEL}>Para quién (opcional)</Label>
            <Input
              id="ai-audience"
              autoCapitalize="sentences"
              enterKeyHint="done"
              value={aiAudience}
              onChange={(e) => setAiAudience(e.target.value)}
              placeholder="Hombres de 30-45 con poco tiempo"
            />
          </div>
        </div>
        <Button variant="tinted" className="w-full sm:w-auto" onClick={generateWithAI} disabled={generating}>
          {generating ? <Spinner size="sm" /> : null}
          {generating ? "Escribiendo borrador…" : "Generar borrador"}
        </Button>
      </section>

      {posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aún no hay artículos"
          description="Escribe el primero o pide un borrador a la IA."
          action={<Button variant="plain" onClick={createNew}>Crear el primero</Button>}
        />
      ) : (
        <ListGroup header="Artículos">
          {posts.map((p) => (
            <ListRow
              key={p.id}
              leading={
                <ImageWithFallback
                  src={p.cover_url}
                  fallbackIcon={FileText}
                  className="h-12 w-12 rounded-[10px] object-cover"
                />
              }
              title={p.title}
              subtitle={<span className="block truncate font-mono">/blog/{p.slug}</span>}
              value={p.published ? "Publicado" : "Borrador"}
              onClick={() => setEditing(p)}
              aria-label={`Editar ${p.title}`}
              trailing={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 text-muted-foreground" aria-label={`Opciones de ${p.title}`} onClick={() => void hapticTap()}>
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {p.published ? (
                      <DropdownMenuItem asChild>
                        <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">Ver artículo</a>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void remove(p.id)}>
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          ))}
        </ListGroup>
      )}
      {confirmDialog}
    </div>
  );
};

export default BlogPostsEditor;
